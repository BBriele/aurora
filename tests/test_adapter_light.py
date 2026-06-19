"""WakeLight effect-tier tests (CI: imports HA via the adapter module)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.aurora.adapters.light import (
    WakeLightAdapter,
    find_sunrise_effect,
)


def test_find_sunrise_effect_matches_known_words() -> None:
    """A sunrise/wake/dawn effect is detected case-insensitively."""
    assert find_sunrise_effect(["Solid", "Sunrise", "Rainbow"]) == "Sunrise"
    assert find_sunrise_effect(["wake-up light"]) == "wake-up light"
    assert find_sunrise_effect(["Alba"]) == "Alba"


def test_find_sunrise_effect_no_match() -> None:
    """No sunrise-like effect (or a non-list) returns None."""
    assert find_sunrise_effect(["Solid", "Rainbow", "Strobe"]) is None
    assert find_sunrise_effect(None) is None
    assert find_sunrise_effect("Sunrise") is None  # a bare string is not a list


@pytest.mark.asyncio
async def test_async_start_uses_native_effect_when_available() -> None:
    """A light advertising a sunrise effect triggers it instead of ramping."""
    hass = MagicMock()
    hass.services.async_call = AsyncMock()
    state = MagicMock()
    state.attributes = {"effect_list": ["Solid", "Sunrise"]}
    hass.states.get.return_value = state

    adapter = WakeLightAdapter(hass, "light.wled", duration_min=30)
    await adapter.async_start()

    # The effect path calls light.turn_on with effect=Sunrise and starts no ramp.
    assert adapter._task is None
    hass.services.async_call.assert_awaited_once()
    args = hass.services.async_call.call_args.args
    assert args[0] == "light"
    assert args[2]["effect"] == "Sunrise"


@pytest.mark.asyncio
async def test_async_start_ramps_without_effect() -> None:
    """A plain dimmable light with no sunrise effect falls back to the ramp."""
    hass = MagicMock()
    hass.services.async_call = AsyncMock()
    hass.async_create_task = MagicMock(return_value="task")
    state = MagicMock()
    state.attributes = {"effect_list": ["Solid", "Rainbow"]}
    hass.states.get.return_value = state

    adapter = WakeLightAdapter(hass, "light.bulb", duration_min=30)
    await adapter.async_start()

    # No effect → a ramp task is created.
    hass.async_create_task.assert_called_once()
    assert adapter._task == "task"
