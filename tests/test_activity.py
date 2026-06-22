"""Activity-log tests for AuroraCoordinator.

The activity log records how each alarm behaved (rang / snoozed / dismissed /
timed out) so a non-admin can understand what happened without the HA logs.

Black-box where possible (drive via services, read coordinator.activity_events);
the cap/order is unit-tested directly via the recorder.
"""

from datetime import time as dt_time

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)

from custom_components.aurora.const import (
    ACTIVITY_MAX,
    DEFAULT_RING_MAX_DURATION,
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_DISMISS,
    SERVICE_TRIGGER_NOW,
)
from custom_components.aurora.models import AuroraAlarm


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _add_alarm(hass: HomeAssistant, *, label: str = "Test") -> None:
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:00", "label": label}, blocking=True
    )
    await hass.async_block_till_done()


def _coord(hass: HomeAssistant):
    return hass.config_entries.async_entries(DOMAIN)[0].runtime_data.coordinator


async def test_ringing_records_activity(hass: HomeAssistant) -> None:
    """trigger_now logs a 'ringing' event with the alarm label and mission."""
    await _setup(hass)
    await _add_alarm(hass, label="AI test")

    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()

    events = _coord(hass).activity_events()
    assert events, "expected at least one activity event"
    assert events[0]["kind"] == "ringing"
    assert events[0]["label"] == "AI test"
    assert "mission" in events[0]["detail"]


async def test_dismiss_records_dismissed(hass: HomeAssistant) -> None:
    """A manual dismiss is logged with kind 'dismissed' (newest first)."""
    await _setup(hass)
    await _add_alarm(hass)

    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()

    assert _coord(hass).activity_events()[0]["kind"] == "dismissed"


async def test_timeout_records_timeout(hass: HomeAssistant, freezer) -> None:
    """A ring that runs past the max duration is logged as 'timeout', not 'dismissed'.

    This is the distinction that explains "my AI alarm rang but never got
    dismissed" — exactly what the activity view surfaces.
    """
    await _setup(hass)
    await _add_alarm(hass)

    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()

    freezer.tick(DEFAULT_RING_MAX_DURATION + 1)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert _coord(hass).activity_events()[0]["kind"] == "timeout"


async def test_activity_cap_and_order(hass: HomeAssistant) -> None:
    """The log is capped at ACTIVITY_MAX and returned newest-first."""
    await _setup(hass)
    coord = _coord(hass)

    for i in range(ACTIVITY_MAX + 10):
        alarm = AuroraAlarm(id=f"a{i}", alarm_time=dt_time(7, 0), label=f"L{i}")
        coord._record_activity(alarm, "ringing")

    events = coord.activity_events()
    assert len(events) == ACTIVITY_MAX
    # Newest first: the last recorded label leads.
    assert events[0]["label"] == f"L{ACTIVITY_MAX + 9}"
