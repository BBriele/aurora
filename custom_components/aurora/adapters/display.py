"""DisplaySurface adapter — a software sunrise overlay on a screen-controllable display.

Capability-tiered. The implemented tier is Fully Kiosk: the adapter resolves the
target media_player's device and its sibling control entities from the entity
registry (by locale-independent ``translation_key``), wakes the screen, ramps the
screen-brightness ``number`` over the wake window, and points the kiosk at the
Aurora ``/aurora/ring`` route (rendered info-only by the panel). On stop it
presses the kiosk's "load start URL" button to restore, and restores the
screensaver + brightness it captured. Non-fully_kiosk targets no-op (a future
browser_mod tier slots in at the marked seam). Every call is best-effort.
"""

import asyncio
import contextlib
import logging

from homeassistant.const import (
    ATTR_ENTITY_ID,
    SERVICE_TURN_OFF,
    SERVICE_TURN_ON,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.network import NoURLAvailableError, get_url

from ..const import (
    DOMAIN_FULLY_KIOSK,
    FK_LOAD_URL_SERVICE,
    FK_TK_LOAD_START_URL,
    FK_TK_SCREEN_BRIGHTNESS,
    FK_TK_SCREEN_ON,
    FK_TK_SCREENSAVER,
    FK_TK_TO_FOREGROUND,
    RING_ROUTE_PATH,
)

_LOGGER = logging.getLogger(__name__)

_RAMP_STEPS = 20
_NUMBER_DOMAIN = "number"
_BUTTON_DOMAIN = "button"
_SWITCH_DOMAIN = "switch"
_SERVICE_SET_VALUE = "set_value"
_SERVICE_PRESS = "press"


class DisplaySurfaceAdapter:
    """Drive one screen-controllable display as a wake overlay."""

    def __init__(
        self,
        hass: HomeAssistant,
        entity_id: str,
        *,
        color_temp_kelvin: int | None,
        duration_min: int,
        label: str,
    ) -> None:
        """Store the target and the (reused) light ramp parameters."""
        self._hass = hass
        self._entity_id = entity_id
        self._color_temp_kelvin = color_temp_kelvin
        self._duration_s = max(1, duration_min) * 60
        self._label = label
        self._device_id: str | None = None
        self._controls: dict[str, str] = {}  # translation_key -> entity_id
        self._task: asyncio.Task[None] | None = None
        self._restore_screensaver: str | None = None
        self._restore_brightness: float | None = None

    def _resolve(self) -> bool:
        """Resolve the device + sibling control entities. False if not fully_kiosk."""
        registry = er.async_get(self._hass)
        entry = registry.async_get(self._entity_id)
        if entry is None or entry.platform != DOMAIN_FULLY_KIOSK:
            return False  # seam: a browser_mod tier would branch here.
        self._device_id = entry.device_id
        if self._device_id is None:
            return False
        for sibling in er.async_entries_for_device(registry, self._device_id):
            if sibling.translation_key:
                self._controls[sibling.translation_key] = sibling.entity_id
        return True

    async def async_start(self) -> None:
        """Wake the screen, load the ring route and ramp the brightness."""
        if not self._resolve() or self._device_id is None:
            return
        await self._capture_restore_state()
        await self._switch(FK_TK_SCREEN_ON, SERVICE_TURN_ON)
        await self._switch(FK_TK_SCREENSAVER, SERVICE_TURN_OFF)
        await self._press(FK_TK_TO_FOREGROUND)
        await self._load_ring_url()
        if FK_TK_SCREEN_BRIGHTNESS in self._controls:
            self._task = self._hass.async_create_task(self._async_ramp())

    async def _load_ring_url(self) -> None:
        """Point the kiosk at the info-only ring route."""
        try:
            url = f"{get_url(self._hass)}{RING_ROUTE_PATH}"
        except NoURLAvailableError:
            _LOGGER.debug("Aurora display: no HA URL available; cannot load ring route")
            return
        await self._call(
            DOMAIN_FULLY_KIOSK,
            FK_LOAD_URL_SERVICE,
            {"device_id": self._device_id, "url": url},
        )

    async def _capture_restore_state(self) -> None:
        """Remember the screensaver + brightness so async_stop can put them back."""
        if (ss := self._controls.get(FK_TK_SCREENSAVER)) and (
            state := self._hass.states.get(ss)
        ):
            self._restore_screensaver = state.state
        if (bri := self._controls.get(FK_TK_SCREEN_BRIGHTNESS)) and (
            state := self._hass.states.get(bri)
        ):
            with contextlib.suppress(TypeError, ValueError):
                self._restore_brightness = float(state.state)

    async def _async_ramp(self) -> None:
        """Step the screen-brightness number from min to max over the window."""
        entity_id = self._controls[FK_TK_SCREEN_BRIGHTNESS]
        low, high = self._number_range(entity_id)
        interval = self._duration_s / _RAMP_STEPS
        with contextlib.suppress(asyncio.CancelledError):
            for step in range(1, _RAMP_STEPS + 1):
                value = low + (high - low) * (step / _RAMP_STEPS)
                await self._call(
                    _NUMBER_DOMAIN, _SERVICE_SET_VALUE,
                    {ATTR_ENTITY_ID: entity_id, "value": value},
                )
                if step < _RAMP_STEPS:
                    await asyncio.sleep(interval)

    def _number_range(self, entity_id: str) -> tuple[float, float]:
        """Return (min, max) for the brightness number (defaults 0..255)."""
        state = self._hass.states.get(entity_id)
        if state is None:
            return (0.0, 255.0)
        return (
            float(state.attributes.get("min", 0.0)),
            float(state.attributes.get("max", 255.0)),
        )

    async def async_stop(self) -> None:
        """Cancel the ramp, restore the start URL, screensaver and brightness."""
        if self._task is not None:
            self._task.cancel()
            self._task = None
        await self._press(FK_TK_LOAD_START_URL)
        if self._restore_screensaver in ("on", "off") and (
            ss := self._controls.get(FK_TK_SCREENSAVER)
        ):
            service = SERVICE_TURN_ON if self._restore_screensaver == "on" else SERVICE_TURN_OFF
            await self._call(_SWITCH_DOMAIN, service, {ATTR_ENTITY_ID: ss})
        if self._restore_brightness is not None and (
            bri := self._controls.get(FK_TK_SCREEN_BRIGHTNESS)
        ):
            await self._call(
                _NUMBER_DOMAIN, _SERVICE_SET_VALUE,
                {ATTR_ENTITY_ID: bri, "value": self._restore_brightness},
            )

    async def _switch(self, tk: str, service: str) -> None:
        """Call a switch service on the sibling entity with this translation_key."""
        if entity_id := self._controls.get(tk):
            await self._call(_SWITCH_DOMAIN, service, {ATTR_ENTITY_ID: entity_id})

    async def _press(self, tk: str) -> None:
        """Press the sibling button with this translation_key."""
        if entity_id := self._controls.get(tk):
            await self._call(_BUTTON_DOMAIN, _SERVICE_PRESS, {ATTR_ENTITY_ID: entity_id})

    async def _call(self, domain: str, service: str, data: dict) -> None:
        """Fire a service call, swallowing device errors (best-effort)."""
        try:
            await self._hass.services.async_call(domain, service, data, blocking=False)
        except HomeAssistantError as err:
            _LOGGER.debug("Aurora display: %s.%s failed: %s", domain, service, err)
