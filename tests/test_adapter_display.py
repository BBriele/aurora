"""Tier-selection + service-call tests for DisplaySurfaceAdapter (CI: imports HA)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.aurora.adapters.display import DisplaySurfaceAdapter


@pytest.fixture
def hass():
    h = MagicMock()
    h.services.async_call = AsyncMock()
    return h


def _registry(entities):
    """Build a fake entity registry: entities = list of (entity_id, tk, platform)."""
    reg = MagicMock()
    by_id = {e[0]: MagicMock(entity_id=e[0], translation_key=e[1],
                             platform=e[2], device_id="dev1") for e in entities}
    reg.async_get.side_effect = lambda eid: by_id.get(eid)
    return reg, list(by_id.values())


@pytest.mark.asyncio
async def test_non_fully_kiosk_target_noops(hass):
    reg, entries = _registry([("media_player.tv", None, "cast")])
    with patch("custom_components.aurora.adapters.display.er.async_get", return_value=reg), \
         patch("custom_components.aurora.adapters.display.er.async_entries_for_device",
               return_value=entries):
        a = DisplaySurfaceAdapter(hass, "media_player.tv",
                                  duration_min=30)
        await a.async_start()
    hass.services.async_call.assert_not_called()


@pytest.mark.asyncio
async def test_fully_kiosk_start_loads_ring_and_wakes(hass):
    reg, entries = _registry([
        ("media_player.smartclock", None, "fully_kiosk"),
        ("switch.sc_screen", "screen_on", "fully_kiosk"),
        ("switch.sc_ss", "screensaver", "fully_kiosk"),
        ("number.sc_bri", "screen_brightness", "fully_kiosk"),
        ("button.sc_fg", "to_foreground", "fully_kiosk"),
        ("button.sc_home", "load_start_url", "fully_kiosk"),
    ])
    hass.states.get.return_value = MagicMock(state="on", attributes={"min": 0, "max": 255})
    with patch("custom_components.aurora.adapters.display.er.async_get", return_value=reg), \
         patch("custom_components.aurora.adapters.display.er.async_entries_for_device",
               return_value=entries), \
         patch("custom_components.aurora.adapters.display.get_url", return_value="http://ha"):
        a = DisplaySurfaceAdapter(hass, "media_player.smartclock",
                                  duration_min=30)
        await a.async_start()
    calls = [(c.args[0], c.args[1], c.args[2]) for c in hass.services.async_call.call_args_list]
    # fully_kiosk.load_url to the ring route
    assert ("fully_kiosk", "load_url",
            {"device_id": "dev1", "url": "http://ha/aurora/ring"}) in calls
    # screen on + screensaver off issued
    assert ("switch", "turn_on", {"entity_id": "switch.sc_screen"}) in calls
    assert ("switch", "turn_off", {"entity_id": "switch.sc_ss"}) in calls


@pytest.mark.asyncio
async def test_fully_kiosk_stop_restores(hass):
    reg, entries = _registry([
        ("media_player.smartclock", None, "fully_kiosk"),
        ("button.sc_home", "load_start_url", "fully_kiosk"),
        ("switch.sc_ss", "screensaver", "fully_kiosk"),
    ])
    hass.states.get.return_value = MagicMock(state="on", attributes={"min": 0, "max": 255})
    with patch("custom_components.aurora.adapters.display.er.async_get", return_value=reg), \
         patch("custom_components.aurora.adapters.display.er.async_entries_for_device",
               return_value=entries), \
         patch("custom_components.aurora.adapters.display.get_url", return_value="http://ha"):
        a = DisplaySurfaceAdapter(hass, "media_player.smartclock",
                                  duration_min=1)
        await a.async_start()
        hass.services.async_call.reset_mock()
        await a.async_stop()
    calls = [(c.args[0], c.args[1], c.args[2]) for c in hass.services.async_call.call_args_list]
    assert ("button", "press", {"entity_id": "button.sc_home"}) in calls
