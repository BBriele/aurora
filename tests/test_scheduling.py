"""Integration tests for Aurora scheduling via the public HA surface.

Covers: daily and weekly recurrence selection, disabled alarms being skipped,
skip_next choosing the following occurrence, nearest-alarm selection across
multiple alarms, and removal of all alarms leaving next_alarm as None.

All tests drive behaviour through the public entry + service surface (setup
entry -> call SERVICE_ADD_ALARM / SERVICE_UPDATE_ALARM / SERVICE_REMOVE_ALARM ->
assert entity state and coordinator.data) and use the ``freezer`` fixture to
pin wall-clock time so expected fire instants are deterministic.

Key schema note: all alarm-id services use ``"id"`` as the payload key (not
``"alarm_id"``), matching the ``_ID_SCHEMA`` / ``_UPDATE_SCHEMA`` in services.py.
"""

from datetime import UTC, datetime

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)

from custom_components.aurora.const import (
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_REMOVE_ALARM,
    SERVICE_SKIP_NEXT,
    SERVICE_UPDATE_ALARM,
)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Load the Aurora integration and wait for it to be ready."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _next_alarm_state(hass: HomeAssistant) -> str:
    """Return the raw state string of sensor.aurora_next_alarm."""
    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None, "sensor.aurora_next_alarm must exist after setup"
    return state.state


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_no_alarms_next_alarm_unknown(hass: HomeAssistant) -> None:
    """With no alarms the next_alarm sensor must be unknown or unavailable.

    Covers: coordinator._compute_next_alarm returning None when the collection
    is empty, and _rearm publishing next_alarm=None to the sensor.
    """
    await _setup(hass)
    state = _next_alarm_state(hass)
    assert state in ("unknown", "unavailable"), (
        f"Expected unknown/unavailable with no alarms, got {state!r}"
    )


async def test_daily_alarm_produces_timestamp(
    hass: HomeAssistant, freezer
) -> None:
    """A single daily alarm makes sensor.aurora_next_alarm a valid timestamp.

    Covers: coordinator._compute_next_alarm iterating the collection and
    building a NextAlarm, _rearm publishing it, and the sensor rendering a
    non-unknown state (device_class timestamp -> ISO string).
    """
    # Pin clock to Wednesday 2026-06-17 06:00 UTC so 07:00 is strictly ahead.
    freezer.move_to("2026-06-17T06:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 6, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Morning"},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = _next_alarm_state(hass)
    assert state not in ("unknown", "unavailable"), (
        f"Expected a timestamp after adding a daily alarm, got {state!r}"
    )
    # Verify coordinator data is consistent.
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    assert coordinator.data.next_alarm is not None
    assert coordinator.data.next_alarm.label == "Morning"


async def test_nearest_alarm_chosen_from_multiple(
    hass: HomeAssistant, freezer
) -> None:
    """coordinator.data.next_alarm points to the earliest of several alarms.

    Covers: coordinator._compute_next_alarm selecting best=min(fire_utc) when
    multiple enabled alarms exist.
    """
    freezer.move_to("2026-06-17T05:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 5, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    # Add a later alarm first, then an earlier one.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "09:00", "label": "Late"},
        blocking=True,
    )
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Early"},
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    assert coordinator.data.next_alarm is not None
    assert coordinator.data.next_alarm.label == "Early", (
        "Coordinator must pick the nearest (earliest) alarm"
    )


async def test_disabled_alarm_is_skipped(
    hass: HomeAssistant, freezer
) -> None:
    """A disabled alarm must not be selected as next_alarm.

    Covers: coordinator._compute_next_alarm checking alarm.enabled before
    calling next_occurrence and skipping disabled entries entirely.
    """
    freezer.move_to("2026-06-17T05:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 5, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    # Add a disabled alarm; with no enabled alarm next_alarm must stay None.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Disabled", "enabled": False},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = _next_alarm_state(hass)
    assert state in ("unknown", "unavailable"), (
        f"Disabled alarm must not produce a next_alarm timestamp, got {state!r}"
    )
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert entry.runtime_data.coordinator.data.next_alarm is None


async def test_disabled_alarm_not_chosen_over_enabled(
    hass: HomeAssistant, freezer
) -> None:
    """When one alarm is disabled and another enabled, the enabled one is chosen.

    Covers: _compute_next_alarm skipping disabled entries; the enabled alarm
    populates coordinator.data.next_alarm.
    """
    freezer.move_to("2026-06-17T05:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 5, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "06:00", "label": "DisabledEarly", "enabled": False},
        blocking=True,
    )
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "08:00", "label": "EnabledLate", "enabled": True},
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    assert coordinator.data.next_alarm is not None
    assert coordinator.data.next_alarm.label == "EnabledLate"


async def test_weekly_alarm_skips_non_matching_days(
    hass: HomeAssistant, freezer
) -> None:
    """A weekly alarm limited to Friday must not fire on Wednesday.

    Covers: scheduler.next_occurrence RepeatMode.WEEKLY + day_matches returning
    False for non-configured weekdays; _compute_next_alarm picking the next
    Friday occurrence (weekday==4).
    """
    # 2026-06-17 is a Wednesday (weekday=2).  Friday=4 is two days away.
    freezer.move_to("2026-06-17T05:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 5, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {
            "time": "07:00",
            "label": "FridayOnly",
            "schedule": {"repeat_mode": "weekly", "weekdays": [4]},
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    assert coordinator.data.next_alarm is not None
    fire_dt = coordinator.data.next_alarm.fire_at_utc
    # Fire time must land on a Friday.
    assert fire_dt.weekday() == 4, (
        "Weekly alarm (weekdays=[4]) must fire on Friday, "
        f"got weekday={fire_dt.weekday()}"
    )
    assert coordinator.data.next_alarm.label == "FridayOnly"


async def test_weekly_alarm_picks_nearest_weekday(
    hass: HomeAssistant, freezer
) -> None:
    """With multiple weekdays configured, the very next qualifying day is chosen.

    Covers: scheduler.next_occurrence scanning forward day-by-day and returning
    the first day_matches() == True candidate strictly after now.
    """
    # Wednesday 2026-06-17 05:00 UTC. Weekdays 0=Monday,3=Thursday,6=Sunday.
    # Thursday (3) is the nearest qualifying day.
    freezer.move_to("2026-06-17T05:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 5, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {
            "time": "07:00",
            "label": "MultiDay",
            "schedule": {"repeat_mode": "weekly", "weekdays": [0, 3, 6]},
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    assert coordinator.data.next_alarm is not None
    fire_dt = coordinator.data.next_alarm.fire_at_utc
    # Thursday is weekday 3; should be 2026-06-18.
    assert fire_dt.weekday() == 3, (
        "Nearest weekday from Mon/Thu/Sun on Wed should be Thursday, "
        f"got {fire_dt.weekday()}"
    )


async def test_skip_next_defers_to_following_occurrence(
    hass: HomeAssistant, freezer
) -> None:
    """skip_next=True causes the immediately upcoming occurrence to be skipped.

    Covers: scheduler.next_occurrence honoring alarm.skip_next by advancing one
    extra iteration; coordinator._compute_next_alarm propagating this to
    coordinator.data.next_alarm.fire_at_utc being at least 1 day further than
    the nominal next occurrence.

    SERVICE_SKIP_NEXT schema: ``{vol.Required("id"): str}`` (see services.py).
    """
    # Pin to Wednesday 2026-06-17 06:00 UTC; 07:00 on the same day is nominal.
    freezer.move_to("2026-06-17T06:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 6, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    # Add alarm without skip_next to establish the baseline next fire time.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Baseline"},
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    assert coordinator.data.next_alarm is not None
    baseline_fire = coordinator.data.next_alarm.fire_at_utc

    # Obtain the alarm id so we can skip it.
    # SERVICE_SKIP_NEXT uses key "id" (matches _ID_SCHEMA in services.py).
    coll = coordinator.alarms
    items = list(coll.async_items())
    assert items, "Collection must have the alarm just created"
    alarm_id = items[0]["id"]

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SKIP_NEXT,
        {"id": alarm_id},
        blocking=True,
    )
    await hass.async_block_till_done()

    skipped_fire = coordinator.data.next_alarm.fire_at_utc
    # The skipped occurrence must be strictly later than the baseline (at least
    # one full day forward for a daily alarm).
    assert skipped_fire > baseline_fire, (
        f"skip_next must push the fire time beyond the baseline; "
        f"baseline={baseline_fire.isoformat()}, skipped={skipped_fire.isoformat()}"
    )


async def test_removing_alarm_reverts_to_unknown(
    hass: HomeAssistant, freezer
) -> None:
    """Removing the only alarm returns next_alarm to None / sensor to unknown.

    Covers: coordinator._handle_collection_change -> _rearm -> _compute_next_alarm
    returning None when the collection is empty; _publish setting next_alarm=None;
    the sensor falling back to unknown/unavailable.

    SERVICE_REMOVE_ALARM schema: ``{vol.Required("id"): str}`` (see services.py).
    """
    freezer.move_to("2026-06-17T06:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 6, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "ToRemove"},
        blocking=True,
    )
    await hass.async_block_till_done()

    # Confirm the alarm is scheduled.
    assert _next_alarm_state(hass) not in ("unknown", "unavailable")

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    items = list(coordinator.alarms.async_items())
    assert items
    alarm_id = items[0]["id"]

    # SERVICE_REMOVE_ALARM uses key "id" (matches _ID_SCHEMA in services.py).
    await hass.services.async_call(
        DOMAIN,
        SERVICE_REMOVE_ALARM,
        {"id": alarm_id},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = _next_alarm_state(hass)
    assert state in ("unknown", "unavailable"), (
        "After removing the only alarm, sensor must revert to "
        f"unknown/unavailable; got {state!r}"
    )
    assert coordinator.data.next_alarm is None


async def test_removing_one_of_two_alarms_keeps_other(
    hass: HomeAssistant, freezer
) -> None:
    """Removing one alarm from two keeps the remaining one as next_alarm.

    Covers: _handle_collection_change recomputing across remaining items; the
    coordinator re-selecting the surviving alarm.
    """
    freezer.move_to("2026-06-17T05:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 5, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "AlarmA"},
        blocking=True,
    )
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "09:00", "label": "AlarmB"},
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    assert coordinator.data.next_alarm is not None
    assert coordinator.data.next_alarm.label == "AlarmA"

    # Remove AlarmA; AlarmB must become next_alarm.
    # SERVICE_REMOVE_ALARM uses key "id" (matches _ID_SCHEMA in services.py).
    items = list(coordinator.alarms.async_items())
    alarm_a_id = next(i["id"] for i in items if i.get("label") == "AlarmA")

    await hass.services.async_call(
        DOMAIN,
        SERVICE_REMOVE_ALARM,
        {"id": alarm_a_id},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert coordinator.data.next_alarm is not None
    assert coordinator.data.next_alarm.label == "AlarmB", (
        "After removing AlarmA the coordinator must select AlarmB"
    )


async def test_updating_alarm_time_rescheduled(
    hass: HomeAssistant, freezer
) -> None:
    """Updating an alarm's time causes the coordinator to reschedule.

    Covers: _handle_collection_change -> _rearm recomputing after an update;
    the new fire_at_utc reflecting the updated alarm_time.

    SERVICE_UPDATE_ALARM schema: ``{vol.Required("id"): str, ...}`` (services.py).
    """
    freezer.move_to("2026-06-17T05:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 5, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Adjustable"},
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    original_fire = coordinator.data.next_alarm.fire_at_utc

    items = list(coordinator.alarms.async_items())
    alarm_id = items[0]["id"]

    # SERVICE_UPDATE_ALARM uses key "id" (matches _UPDATE_SCHEMA in services.py).
    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ALARM,
        {"id": alarm_id, "time": "08:30"},
        blocking=True,
    )
    await hass.async_block_till_done()

    updated_fire = coordinator.data.next_alarm.fire_at_utc
    assert updated_fire != original_fire, (
        "Changing alarm time from 07:00 to 08:30 must change the scheduled fire instant"
    )
    # 08:30 is later than 07:00 on the same day.
    assert updated_fire > original_fire


async def test_re_enabling_alarm_reschedules(
    hass: HomeAssistant, freezer
) -> None:
    """Disabling then re-enabling an alarm properly restores it as next_alarm.

    Covers: _compute_next_alarm skipping disabled (enabled=False) and then
    selecting the alarm again once enabled=True is restored.
    """
    freezer.move_to("2026-06-17T05:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 5, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Toggle"},
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    items = list(coordinator.alarms.async_items())
    alarm_id = items[0]["id"]

    # Disable the alarm (key "id" per _UPDATE_SCHEMA in services.py).
    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ALARM,
        {"id": alarm_id, "enabled": False},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert coordinator.data.next_alarm is None, (
        "Disabled alarm must not appear as next_alarm"
    )

    # Re-enable the alarm.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ALARM,
        {"id": alarm_id, "enabled": True},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert coordinator.data.next_alarm is not None, (
        "Re-enabled alarm must reappear as next_alarm"
    )
    assert coordinator.data.next_alarm.label == "Toggle"


async def test_next_alarm_sensor_reflects_coordinator(
    hass: HomeAssistant, freezer
) -> None:
    """sensor.aurora_next_alarm state matches coordinator.data.next_alarm.fire_at_utc.

    Covers: the sensor platform rendering NextAlarm.fire_at_utc as an ISO
    timestamp string that round-trips to a datetime, consistent with the
    coordinator read-model.
    """
    freezer.move_to("2026-06-17T06:00:00+00:00")
    await _setup(hass)
    async_fire_time_changed(hass, datetime(2026, 6, 17, 6, 0, tzinfo=UTC))
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "08:00", "label": "Check"},
        blocking=True,
    )
    await hass.async_block_till_done()

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    next_alarm = coordinator.data.next_alarm
    assert next_alarm is not None

    sensor_state = _next_alarm_state(hass)
    assert sensor_state not in ("unknown", "unavailable")

    # The sensor state must parse as a datetime and be temporally consistent
    # with coordinator.data.next_alarm.fire_at_utc (same instant or very close).
    parsed = datetime.fromisoformat(sensor_state)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    diff_s = abs((parsed - next_alarm.fire_at_utc).total_seconds())
    assert diff_s < 60, (
        f"Sensor state {sensor_state!r} diverges from coordinator by {diff_s}s"
    )
