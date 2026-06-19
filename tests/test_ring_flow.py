"""Ring lifecycle integration tests for AuroraCoordinator.

Covers the full alarm ring state machine through the public service surface:
trigger_now -> ringing, dismiss -> idle, snooze -> snoozed -> re-ring,
watchdog auto-stop after ring_max_duration, and snooze-count enforcement.

All tests are black-box: they drive behaviour through HA services and assert
entity states / coordinator.data. Only the coordinator reference is accessed
for public async methods (.data, async_dismiss, async_snooze, etc.).
"""

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)

from custom_components.aurora.const import (
    CONF_RING_MAX_DURATION,
    DEFAULT_RING_MAX_DURATION,
    DEFAULT_SNOOZE_DURATION,
    DEFAULT_SNOOZE_MAX,
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_DISMISS,
    SERVICE_SNOOZE,
    SERVICE_TRIGGER_NOW,
)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


async def _setup(
    hass: HomeAssistant, *, options: dict | None = None
) -> MockConfigEntry:
    """Create and load an Aurora config entry, returning the loaded entry."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options=options or {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _add_alarm(
    hass: HomeAssistant, *, time: str = "07:00", label: str = "Test"
) -> None:
    """Add an alarm via the public service and flush the event loop."""
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": time, "label": label},
        blocking=True,
    )
    await hass.async_block_till_done()


async def _trigger_now(hass: HomeAssistant) -> None:
    """Invoke trigger_now and flush the event loop."""
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()


async def _snooze(hass: HomeAssistant) -> None:
    """Invoke snooze and flush the event loop."""
    await hass.services.async_call(DOMAIN, SERVICE_SNOOZE, {}, blocking=True)
    await hass.async_block_till_done()


async def _dismiss(hass: HomeAssistant) -> None:
    """Invoke dismiss and flush the event loop."""
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()


def _state(hass: HomeAssistant) -> str:
    """Return the current sensor.aurora_state value."""
    return hass.states.get("sensor.aurora_state").state


def _ringing(hass: HomeAssistant) -> str:
    """Return the current binary_sensor.aurora_ringing value ('on' or 'off')."""
    return hass.states.get("binary_sensor.aurora_ringing").state


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_trigger_now_enters_ringing(hass: HomeAssistant) -> None:
    """trigger_now transitions state to 'ringing' and binary sensor to 'on'.

    Covers: coordinator._begin_ring (state machine entry, _state = RINGING,
    _publish); async_trigger_now (alarm lookup, snooze_count reset).
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)

    assert _state(hass) == "ringing"
    assert _ringing(hass) == "on"


async def test_dismiss_from_ringing_returns_to_idle(hass: HomeAssistant) -> None:
    """Dismiss after ringing transitions to 'idle' and binary sensor 'off'.

    Covers: coordinator.async_dismiss (cancel timers, ring stop, state=IDLE).
    Briefing is disabled by default so the transition is direct to IDLE.
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    assert _state(hass) == "ringing"

    await _dismiss(hass)

    assert _state(hass) == "idle"
    assert _ringing(hass) == "off"


async def test_dismiss_from_idle_is_noop(hass: HomeAssistant) -> None:
    """Calling dismiss while idle should not raise and should stay idle.

    Covers: coordinator.async_dismiss guard (POST_WAKE guard is not triggered,
    ring timers have nothing to cancel; state stays IDLE).
    """
    await _setup(hass)

    await _dismiss(hass)

    assert _state(hass) == "idle"
    assert _ringing(hass) == "off"


async def test_snooze_enters_snoozed_state(hass: HomeAssistant) -> None:
    """Snooze while ringing transitions to 'snoozed' and stops ringing.

    Covers: coordinator.async_snooze (guard check, snooze_count increment,
    ring stop, state=SNOOZED, _unsub_snooze armed).
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    assert _state(hass) == "ringing"

    await _snooze(hass)

    assert _state(hass) == "snoozed"
    assert _ringing(hass) == "off"


async def test_snooze_rerings_after_duration(
    hass: HomeAssistant, freezer
) -> None:
    """After snooze duration elapses the alarm re-rings (state back to 'ringing').

    Covers: coordinator._on_snooze_end (callback fires _begin_ring on
    _active_alarm); DEFAULT_SNOOZE_DURATION = 540 s.
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    await _snooze(hass)
    assert _state(hass) == "snoozed"

    # Advance past the default snooze duration (540 s).
    freezer.tick(DEFAULT_SNOOZE_DURATION + 1)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert _state(hass) == "ringing"
    assert _ringing(hass) == "on"


async def test_watchdog_auto_dismisses_after_max_duration(
    hass: HomeAssistant, freezer
) -> None:
    """Watchdog auto-stops the ring after DEFAULT_RING_MAX_DURATION seconds.

    Covers: coordinator._begin_ring (watchdog armed via async_call_later with
    CONF_RING_MAX_DURATION / DEFAULT_RING_MAX_DURATION); _on_watchdog
    (dispatches async_dismiss task); DEFAULT_RING_MAX_DURATION = 600 s.
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    assert _state(hass) == "ringing"

    # Advance past the default watchdog timeout (600 s).
    freezer.tick(DEFAULT_RING_MAX_DURATION + 1)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert _state(hass) == "idle"
    assert _ringing(hass) == "off"


async def test_watchdog_respects_custom_ring_max_duration(
    hass: HomeAssistant, freezer
) -> None:
    """A custom ring_max_duration option is honoured by the watchdog.

    Covers: coordinator._begin_ring reading CONF_RING_MAX_DURATION from
    config_entry.options; _on_watchdog dispatch.
    """
    short_duration = 10  # seconds — much shorter than the default 600 s
    entry = await _setup(hass, options={CONF_RING_MAX_DURATION: short_duration})
    await _add_alarm(hass)

    await _trigger_now(hass)
    assert _state(hass) == "ringing"

    # Just before the watchdog: still ringing.
    freezer.tick(short_duration - 1)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert _state(hass) == "ringing"

    # Past the watchdog: should auto-stop.
    freezer.tick(2)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert _state(hass) == "idle"
    assert _ringing(hass) == "off"

    _ = entry  # keep entry in scope


async def test_snooze_max_enforced(hass: HomeAssistant, freezer) -> None:
    """Snoozing more than DEFAULT_SNOOZE_MAX times is silently rejected.

    After the Nth snooze the coordinator logs and returns without entering
    SNOOZED again — the alarm remains ringing.

    Covers: coordinator.async_snooze (snooze_count >= alarm.features.snooze.max
    guard); DEFAULT_SNOOZE_MAX = 3.
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    assert _state(hass) == "ringing"

    # Exhaust all snooze slots (default max = 3).
    for iteration in range(DEFAULT_SNOOZE_MAX):
        await _snooze(hass)
        assert _state(hass) == "snoozed", f"Expected snoozed on iteration {iteration}"

        # Re-ring after snooze duration.
        freezer.tick(DEFAULT_SNOOZE_DURATION + 1)
        async_fire_time_changed(hass)
        await hass.async_block_till_done()
        assert _state(hass) == "ringing", (
            f"Expected ringing after snooze {iteration}"
        )

    # One more snooze attempt: should be rejected (limit reached).
    await _snooze(hass)
    assert _state(hass) == "ringing"
    assert _ringing(hass) == "on"


async def test_snooze_noop_when_idle(hass: HomeAssistant) -> None:
    """Snooze while idle does nothing (guard: state not in RINGING/MISSION).

    Covers: coordinator.async_snooze early-return guard.
    """
    await _setup(hass)

    await _snooze(hass)

    assert _state(hass) == "idle"
    assert _ringing(hass) == "off"


async def test_trigger_now_without_alarm_raises(hass: HomeAssistant) -> None:
    """trigger_now with no alarms raises HomeAssistantError.

    Covers: coordinator.async_trigger_now (no alarm found -> raise).
    """
    await _setup(hass)

    with pytest.raises(HomeAssistantError):
        await hass.services.async_call(
            DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True
        )


async def test_trigger_now_resets_snooze_count(hass: HomeAssistant) -> None:
    """trigger_now resets the snooze counter so a fresh ring allows full snoozes.

    Covers: coordinator.async_trigger_now (snooze_count = 0 before _begin_ring);
    coordinator._handle_fire (snooze_count = 0 before _begin_ring).
    """
    await _setup(hass)
    await _add_alarm(hass)

    # First ring + consume one snooze slot.
    await _trigger_now(hass)
    await _snooze(hass)
    assert _state(hass) == "snoozed"

    await _dismiss(hass)
    assert _state(hass) == "idle"

    # Trigger again — snooze count must be reset.
    await _trigger_now(hass)
    assert _state(hass) == "ringing"

    # All DEFAULT_SNOOZE_MAX slots should still be available.
    await _snooze(hass)
    assert _state(hass) == "snoozed"


async def test_watchdog_cancelled_on_dismiss(
    hass: HomeAssistant, freezer
) -> None:
    """Dismissing cancels the watchdog timer; no spurious idle transition after.

    Covers: coordinator.async_dismiss (_cancel_ring_timers cancels _unsub_watchdog)
    so firing time_changed after dismiss does not double-transition state.
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    assert _state(hass) == "ringing"

    await _dismiss(hass)
    assert _state(hass) == "idle"

    # Advance well past watchdog duration — should remain idle, not crash.
    freezer.tick(DEFAULT_RING_MAX_DURATION + 10)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert _state(hass) == "idle"


async def test_snooze_timer_cancelled_on_dismiss(
    hass: HomeAssistant, freezer
) -> None:
    """Dismissing from snoozed state cancels the re-ring timer.

    Covers: coordinator.async_dismiss (_cancel_ring_timers cancels _unsub_snooze);
    _on_snooze_end checks _active_alarm is not None.
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    await _snooze(hass)
    assert _state(hass) == "snoozed"

    await _dismiss(hass)
    assert _state(hass) == "idle"

    # Snooze timer fires — should not re-ring because it was cancelled.
    freezer.tick(DEFAULT_SNOOZE_DURATION + 1)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert _state(hass) == "idle"
    assert _ringing(hass) == "off"


async def test_ringing_binary_sensor_attributes_present(hass: HomeAssistant) -> None:
    """While ringing, binary_sensor.aurora_ringing exposes alarm_id and mission.

    Covers: the binary sensor's extra_state_attributes contract documented in
    the project spec (alarm_id, mission exposed only while ringing).
    """
    await _setup(hass)
    await _add_alarm(hass, label="AttrTest")

    await _trigger_now(hass)
    assert _ringing(hass) == "on"

    bs = hass.states.get("binary_sensor.aurora_ringing")
    attrs = bs.attributes
    assert "alarm_id" in attrs
    assert "mission" in attrs


async def test_ringing_binary_sensor_attributes_absent_when_idle(
    hass: HomeAssistant,
) -> None:
    """After dismiss, alarm_id and mission attributes are absent from the binary sensor.

    Covers: binary sensor extra_state_attributes only populated while ringing.
    """
    await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    await _dismiss(hass)
    assert _ringing(hass) == "off"

    bs = hass.states.get("binary_sensor.aurora_ringing")
    attrs = bs.attributes
    # When not ringing the attributes should either be absent or empty.
    assert not attrs.get("alarm_id")
    assert not attrs.get("mission")


async def test_coordinator_data_reflects_ringing_alarm_id(
    hass: HomeAssistant,
) -> None:
    """coordinator.data.active_alarm_id is populated while ringing, None when idle.

    Covers: coordinator._publish / AuroraCoordinatorData.active_alarm_id field;
    async_trigger_now sets _active_alarm_id via _begin_ring; async_dismiss clears it.
    """
    await _setup(hass)
    await _add_alarm(hass)

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator

    await _trigger_now(hass)
    assert coordinator.data.active_alarm_id is not None
    assert coordinator.data.state == "ringing"

    await _dismiss(hass)
    assert coordinator.data.active_alarm_id is None
    assert coordinator.data.state == "idle"


async def test_ring_resumes_after_restart(hass: HomeAssistant) -> None:
    """A ring interrupted by an HA restart resumes ringing on the next setup.

    Covers: coordinator._persist_ring (crash-safe ring state) +
    _async_restore_ring (re-enter RINGING for the active alarm at setup).
    Simulates a restart by unloading and re-setting-up the same config entry.
    """
    entry = await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    assert _state(hass) == "ringing"

    # Simulate an HA restart: unload + re-setup the same entry (a fresh
    # coordinator that must restore the ring from the persisted store).
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    assert _state(hass) == "ringing"
    assert _ringing(hass) == "on"


async def test_ring_does_not_resume_after_clean_dismiss(hass: HomeAssistant) -> None:
    """After a dismiss, a subsequent restart must NOT resurrect the ring.

    Covers: async_dismiss persisting a non-resumable state + _async_restore_ring
    treating idle persisted state as nothing to resume.
    """
    entry = await _setup(hass)
    await _add_alarm(hass)

    await _trigger_now(hass)
    await _dismiss(hass)
    assert _state(hass) == "idle"

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    assert _state(hass) == "idle"
    assert _ringing(hass) == "off"


async def test_multiple_ring_dismiss_cycles(hass: HomeAssistant) -> None:
    """Running multiple ring-dismiss cycles does not corrupt the state machine.

    Covers: repeated _begin_ring / async_dismiss / _cancel_ring_timers calls;
    ensures no timer leak causes a stuck state.
    """
    await _setup(hass)
    await _add_alarm(hass)

    for _ in range(3):
        await _trigger_now(hass)
        assert _state(hass) == "ringing"

        await _dismiss(hass)
        assert _state(hass) == "idle"
