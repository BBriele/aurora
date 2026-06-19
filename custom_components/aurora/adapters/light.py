"""WakeLight adapter — a capability-tiered sunrise ramp.

Handles a dimmable ``light`` (brightness, optionally with a warm colour
temperature) or a ``number`` entity (e.g. a screen-backlight). Anything else is
the caller's concern (it simply won't bind a WakeLight).
"""

import asyncio
import contextlib
import logging

from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_COLOR_TEMP_KELVIN,
    ATTR_EFFECT,
    ATTR_EFFECT_LIST,
)
from homeassistant.components.light import (
    DOMAIN as LIGHT_DOMAIN,
)
from homeassistant.const import (
    ATTR_ENTITY_ID,
    SERVICE_TURN_OFF,
    SERVICE_TURN_ON,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)

_RAMP_STEPS = 20

# number domain literals (avoid importing constants that may live only in .const)
NUMBER_DOMAIN = "number"
SERVICE_SET_VALUE = "set_value"
ATTR_VALUE = "value"
ATTR_MIN = "min"
ATTR_MAX = "max"

# Keywords that mark a native sunrise/wake-up effect (e.g. WLED's "Sunrise").
_SUNRISE_EFFECT_WORDS = ("sunrise", "wake", "dawn", "alba", "sunup")


def find_sunrise_effect(effect_list: object) -> str | None:
    """Return the first sunrise-like effect name in a light's effect_list, if any.

    Pure helper (no HA) so the WLED/effect tier can be unit-tested: a light that
    advertises a native sunrise effect should ramp via that effect rather than a
    stepped brightness ramp.
    """
    if not isinstance(effect_list, (list, tuple)):
        return None
    for effect in effect_list:
        if isinstance(effect, str) and any(
            word in effect.lower() for word in _SUNRISE_EFFECT_WORDS
        ):
            return effect
    return None


class WakeLightAdapter:
    """Ramp a light or number entity from dim to bright over the fade window."""

    def __init__(
        self,
        hass: HomeAssistant,
        entity_id: str,
        *,
        duration_min: int,
        post_stop: str = "off",
        color_temp_kelvin: int | None = None,
    ) -> None:
        """Store the target and ramp parameters."""
        self._hass = hass
        self._entity_id = entity_id
        self._domain = entity_id.partition(".")[0]
        self._duration_s = max(1, duration_min) * 60
        self._post_stop = post_stop
        self._kelvin = color_temp_kelvin
        self._task: asyncio.Task[None] | None = None

    async def async_start(self) -> None:
        """Start the sunrise ramp.

        If the bound light advertises a native sunrise/wake-up effect (WLED and
        similar), trigger that effect once and let the device own the ramp;
        otherwise fall back to the generic stepped brightness ramp.
        """
        effect = self._native_sunrise_effect()
        if effect is not None:
            await self._start_effect(effect)
            return
        self._task = self._hass.async_create_task(self._async_ramp())

    def _native_sunrise_effect(self) -> str | None:
        """Return the bound light's native sunrise effect name, or None."""
        if self._domain != LIGHT_DOMAIN:
            return None
        state = self._hass.states.get(self._entity_id)
        if state is None:
            return None
        return find_sunrise_effect(state.attributes.get(ATTR_EFFECT_LIST))

    async def _start_effect(self, effect: str) -> None:
        """Trigger a native sunrise effect on the bound light."""
        data: dict[str, object] = {ATTR_ENTITY_ID: self._entity_id, ATTR_EFFECT: effect}
        if self._kelvin is not None:
            data[ATTR_COLOR_TEMP_KELVIN] = self._kelvin
        with contextlib.suppress(HomeAssistantError):
            await self._hass.services.async_call(
                LIGHT_DOMAIN, SERVICE_TURN_ON, data, blocking=False
            )
            _LOGGER.debug(
                "Aurora light: native sunrise effect '%s' on %s",
                effect,
                self._entity_id,
            )

    async def _async_ramp(self) -> None:
        """Step brightness from minimum to maximum across the window."""
        interval = self._duration_s / _RAMP_STEPS
        with contextlib.suppress(asyncio.CancelledError):
            for step in range(1, _RAMP_STEPS + 1):
                await self._apply(step / _RAMP_STEPS)
                if step < _RAMP_STEPS:
                    await asyncio.sleep(interval)

    async def _apply(self, fraction: float) -> None:
        """Apply a ramp fraction (0..1) to the bound entity."""
        try:
            if self._domain == LIGHT_DOMAIN:
                data: dict[str, object] = {
                    ATTR_ENTITY_ID: self._entity_id,
                    ATTR_BRIGHTNESS: max(1, round(255 * fraction)),
                }
                if self._kelvin is not None:
                    data[ATTR_COLOR_TEMP_KELVIN] = self._kelvin
                await self._hass.services.async_call(
                    LIGHT_DOMAIN, SERVICE_TURN_ON, data, blocking=False
                )
            elif self._domain == NUMBER_DOMAIN:
                low, high = self._number_range()
                await self._hass.services.async_call(
                    NUMBER_DOMAIN,
                    SERVICE_SET_VALUE,
                    {
                        ATTR_ENTITY_ID: self._entity_id,
                        ATTR_VALUE: low + (high - low) * fraction,
                    },
                    blocking=False,
                )
        except HomeAssistantError as err:
            _LOGGER.debug("Aurora light: step failed on %s: %s", self._entity_id, err)

    def _number_range(self) -> tuple[float, float]:
        """Return the (min, max) range of the bound number entity."""
        state = self._hass.states.get(self._entity_id)
        if state is None:
            return (0.0, 100.0)
        return (
            float(state.attributes.get(ATTR_MIN, 0.0)),
            float(state.attributes.get(ATTR_MAX, 100.0)),
        )

    async def async_stop(self) -> None:
        """Cancel the ramp and apply the configured post-stop behaviour."""
        if self._task is not None:
            self._task.cancel()
            self._task = None
        if self._post_stop == "keep":
            return
        with contextlib.suppress(HomeAssistantError):
            if self._domain == LIGHT_DOMAIN:
                await self._hass.services.async_call(
                    LIGHT_DOMAIN,
                    SERVICE_TURN_OFF,
                    {ATTR_ENTITY_ID: self._entity_id},
                    blocking=False,
                )
            elif self._domain == NUMBER_DOMAIN:
                low, _ = self._number_range()
                await self._hass.services.async_call(
                    NUMBER_DOMAIN,
                    SERVICE_SET_VALUE,
                    {ATTR_ENTITY_ID: self._entity_id, ATTR_VALUE: low},
                    blocking=False,
                )
