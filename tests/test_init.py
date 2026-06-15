"""Setup/teardown tests for Aurora."""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_DISMISS,
    SERVICE_TRIGGER_NOW,
)


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_setup_and_entities(hass: HomeAssistant) -> None:
    """The entry loads and exposes the read-model entities + services."""
    entry = await _setup(hass)
    assert entry.state is ConfigEntryState.LOADED

    assert hass.states.get("sensor.aurora_state") is not None
    assert hass.states.get("sensor.aurora_next_alarm") is not None
    assert hass.states.get("binary_sensor.aurora_ringing") is not None

    for service in (SERVICE_ADD_ALARM, SERVICE_DISMISS, SERVICE_TRIGGER_NOW):
        assert hass.services.has_service(DOMAIN, service)


async def test_add_alarm_service_updates_next_alarm(hass: HomeAssistant) -> None:
    """Adding an alarm via the service schedules a next alarm."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Morning"},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None
    assert state.state not in ("unknown", "unavailable")


async def test_trigger_ring_and_dismiss(hass: HomeAssistant) -> None:
    """trigger_now starts a ring; dismiss returns to idle."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:00", "label": "Test"}, blocking=True
    )
    await hass.async_block_till_done()

    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get("binary_sensor.aurora_ringing").state == "on"
    assert hass.states.get("sensor.aurora_state").state == "ringing"

    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get("binary_sensor.aurora_ringing").state == "off"
    assert hass.states.get("sensor.aurora_state").state == "idle"


async def test_unload(hass: HomeAssistant) -> None:
    """The entry unloads cleanly."""
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.NOT_LOADED
