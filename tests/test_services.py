"""Tests for Aurora domain service registration and behaviours.

Covers the nine services defined in services.py / services.yaml. Tests drive
behaviour through the public surface (service calls -> entity state / collection
query) and avoid poking private coordinator attributes. Error-path tests verify
that translated ``ServiceValidationError`` exceptions are raised for unknown alarm
IDs and that ``HomeAssistantError`` with ``translation_key="not_setup"`` is raised
when no loaded entry exists for ring-control services.

Not covered here (already in test_init.py / test_ring_flow.py):
- add_alarm happy-path (covered by test_add_alarm_service_updates_next_alarm)
- trigger_now / dismiss round-trip (covered by test_trigger_ring_and_dismiss)
"""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_BENCHMARK_VISION,
    SERVICE_DISMISS,
    SERVICE_REMOVE_ALARM,
    SERVICE_SKIP_NEXT,
    SERVICE_SNOOZE,
    SERVICE_SPEAK_BRIEFING,
    SERVICE_TRIGGER_NOW,
    SERVICE_UPDATE_ALARM,
)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_ALL_SERVICES = (
    SERVICE_ADD_ALARM,
    SERVICE_UPDATE_ALARM,
    SERVICE_REMOVE_ALARM,
    SERVICE_SKIP_NEXT,
    SERVICE_SNOOZE,
    SERVICE_DISMISS,
    SERVICE_TRIGGER_NOW,
    SERVICE_SPEAK_BRIEFING,
    SERVICE_BENCHMARK_VISION,
)


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Load Aurora and return the loaded config entry."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _add_alarm(
    hass: HomeAssistant, alarm_time: str = "07:00", label: str = "Test"
) -> None:
    """Add an alarm via the public service and drain the event loop."""
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": alarm_time, "label": label},
        blocking=True,
    )
    await hass.async_block_till_done()


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


async def test_all_services_registered(hass: HomeAssistant) -> None:
    """All nine Aurora services are registered after entry setup."""
    await _setup(hass)
    for name in _ALL_SERVICES:
        assert hass.services.has_service(DOMAIN, name), f"Missing service: {name}"


async def test_services_registered_idempotent(hass: HomeAssistant) -> None:
    """Services survive an unload/reload cycle without duplication or errors."""
    entry = await _setup(hass)
    # Unload, then reload the same entry — services must still be registered.
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    for name in _ALL_SERVICES:
        assert hass.services.has_service(DOMAIN, name), f"Missing after reload: {name}"


# ---------------------------------------------------------------------------
# update_alarm
# ---------------------------------------------------------------------------


async def test_update_alarm_changes_label(hass: HomeAssistant) -> None:
    """update_alarm with a new label persists the change in the collection."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="06:30", label="Original")

    # Discover the generated id from the coordinator's next_alarm snapshot.
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    alarm_id = coordinator.data.next_alarm.alarm_id

    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ALARM,
        {"id": alarm_id, "label": "Renamed"},
        blocking=True,
    )
    await hass.async_block_till_done()

    # The collection stores the canonical dict — check the label changed.
    items = coordinator.alarms.async_items()
    assert any(item["id"] == alarm_id and item["label"] == "Renamed" for item in items)


async def test_update_alarm_changes_enabled_flag(hass: HomeAssistant) -> None:
    """update_alarm can disable an alarm, removing it from next-alarm tracking."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="08:00", label="Disableable")

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    alarm_id = coordinator.data.next_alarm.alarm_id

    # Disable the alarm.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ALARM,
        {"id": alarm_id, "enabled": False},
        blocking=True,
    )
    await hass.async_block_till_done()

    # With the only alarm disabled the next_alarm field must be None.
    assert coordinator.data.next_alarm is None


async def test_update_alarm_unknown_id_raises(hass: HomeAssistant) -> None:
    """update_alarm with a nonexistent id raises ServiceValidationError."""
    await _setup(hass)
    try:
        await hass.services.async_call(
            DOMAIN,
            SERVICE_UPDATE_ALARM,
            {"id": "does_not_exist", "label": "Ghost"},
            blocking=True,
        )
    except ServiceValidationError as exc:
        assert exc.translation_key == "unknown_alarm"
        assert exc.translation_domain == DOMAIN
    else:
        raise AssertionError("Expected ServiceValidationError was not raised")


# ---------------------------------------------------------------------------
# remove_alarm
# ---------------------------------------------------------------------------


async def test_remove_alarm_deletes_from_collection(hass: HomeAssistant) -> None:
    """remove_alarm deletes the item from the storage collection."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="09:00", label="ToDelete")

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    alarm_id = coordinator.data.next_alarm.alarm_id

    await hass.services.async_call(
        DOMAIN,
        SERVICE_REMOVE_ALARM,
        {"id": alarm_id},
        blocking=True,
    )
    await hass.async_block_till_done()

    items = coordinator.alarms.async_items()
    assert not any(item["id"] == alarm_id for item in items)


async def test_remove_alarm_clears_next_alarm_sensor(hass: HomeAssistant) -> None:
    """Removing the only alarm drives sensor.aurora_next_alarm to unknown."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="09:30", label="Solo")

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    alarm_id = coordinator.data.next_alarm.alarm_id

    await hass.services.async_call(
        DOMAIN,
        SERVICE_REMOVE_ALARM,
        {"id": alarm_id},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None
    assert state.state in ("unknown", "unavailable")


async def test_remove_alarm_unknown_id_raises(hass: HomeAssistant) -> None:
    """remove_alarm with a nonexistent id raises ServiceValidationError."""
    await _setup(hass)
    try:
        await hass.services.async_call(
            DOMAIN,
            SERVICE_REMOVE_ALARM,
            {"id": "ghost_id"},
            blocking=True,
        )
    except ServiceValidationError as exc:
        assert exc.translation_key == "unknown_alarm"
        assert exc.translation_domain == DOMAIN
    else:
        raise AssertionError("Expected ServiceValidationError was not raised")


# ---------------------------------------------------------------------------
# skip_next
# ---------------------------------------------------------------------------


async def test_skip_next_sets_flag_on_alarm(hass: HomeAssistant) -> None:
    """skip_next sets the skip_next flag on the targeted alarm in the collection."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="10:00", label="Skippable")

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    alarm_id = coordinator.data.next_alarm.alarm_id

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SKIP_NEXT,
        {"id": alarm_id},
        blocking=True,
    )
    await hass.async_block_till_done()

    items = coordinator.alarms.async_items()
    matched = next((item for item in items if item["id"] == alarm_id), None)
    assert matched is not None
    assert matched["skip_next"] is True


async def test_skip_next_unknown_id_raises(hass: HomeAssistant) -> None:
    """skip_next with a nonexistent id raises ServiceValidationError."""
    await _setup(hass)
    try:
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SKIP_NEXT,
            {"id": "no_such_alarm"},
            blocking=True,
        )
    except ServiceValidationError as exc:
        assert exc.translation_key == "unknown_alarm"
        assert exc.translation_domain == DOMAIN
    else:
        raise AssertionError("Expected ServiceValidationError was not raised")


# ---------------------------------------------------------------------------
# Ring-control services without a loaded entry (not_setup error path)
# ---------------------------------------------------------------------------


async def test_snooze_without_loaded_entry_raises(hass: HomeAssistant) -> None:
    """Snooze raises HomeAssistantError(not_setup) when no entry is loaded."""
    # Services are domain-level and survive unload, but the coordinator lookup
    # fails: _coordinator() raises HomeAssistantError(translation_key="not_setup").
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    try:
        await hass.services.async_call(DOMAIN, SERVICE_SNOOZE, {}, blocking=True)
    except HomeAssistantError as exc:
        assert exc.translation_key == "not_setup"
    else:
        raise AssertionError("Expected HomeAssistantError was not raised")


async def test_dismiss_without_loaded_entry_raises(hass: HomeAssistant) -> None:
    """Dismiss raises HomeAssistantError(not_setup) when no entry is loaded."""
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    try:
        await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    except HomeAssistantError as exc:
        assert exc.translation_key == "not_setup"
    else:
        raise AssertionError("Expected HomeAssistantError was not raised")


async def test_speak_briefing_without_loaded_entry_raises(hass: HomeAssistant) -> None:
    """speak_briefing raises HomeAssistantError(not_setup) when entry is unloaded."""
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    try:
        await hass.services.async_call(
            DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
        )
    except HomeAssistantError as exc:
        assert exc.translation_key == "not_setup"
    else:
        raise AssertionError("Expected HomeAssistantError was not raised")


# ---------------------------------------------------------------------------
# trigger_now: no_alarm_to_trigger error path
# ---------------------------------------------------------------------------


async def test_trigger_now_without_alarms_raises(hass: HomeAssistant) -> None:
    """trigger_now raises HomeAssistantError(no_alarm_to_trigger) with no alarms."""
    await _setup(hass)
    # Entry is loaded but no alarms have been added.
    try:
        await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    except HomeAssistantError as exc:
        assert exc.translation_key == "no_alarm_to_trigger"
    else:
        raise AssertionError("Expected HomeAssistantError was not raised")


# ---------------------------------------------------------------------------
# snooze: happy-path state transition
# ---------------------------------------------------------------------------


async def test_snooze_while_ringing_transitions_to_snoozed(
    hass: HomeAssistant,
) -> None:
    """Snooze during a ring moves the state to 'snoozed'."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="07:00", label="Snooze Test")

    # Trigger an immediate ring.
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get("sensor.aurora_state").state == "ringing"

    await hass.services.async_call(DOMAIN, SERVICE_SNOOZE, {}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get("sensor.aurora_state").state == "snoozed"
    assert hass.states.get("binary_sensor.aurora_ringing").state == "off"


# ---------------------------------------------------------------------------
# update_alarm: multiple field update
# ---------------------------------------------------------------------------


async def test_update_alarm_multiple_fields(hass: HomeAssistant) -> None:
    """update_alarm can change time and label in a single call."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="06:00", label="Early")

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    alarm_id = coordinator.data.next_alarm.alarm_id

    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ALARM,
        {"id": alarm_id, "label": "Late", "time": "22:00"},
        blocking=True,
    )
    await hass.async_block_till_done()

    items = coordinator.alarms.async_items()
    matched = next((item for item in items if item["id"] == alarm_id), None)
    assert matched is not None
    assert matched["label"] == "Late"
    assert matched["time"] == "22:00"
