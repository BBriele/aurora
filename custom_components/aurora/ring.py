"""Assemble and drive the output adapters for one active ring.

The controller is capability-first: it picks adapters from the per-alarm feature
overrides, falling back to the installation's role bindings, and always adds a
``persistent_notification`` so even a Tier-0 setup rings visibly. A failing
adapter never breaks the others (or the alarm).
"""

from collections.abc import Mapping
import logging
from typing import Any

from homeassistant.core import HomeAssistant

from .adapters.audio import AudioSinkAdapter
from .adapters.base import OutputAdapter
from .adapters.light import WakeLightAdapter
from .adapters.notify import NotifyChannelAdapter
from .const import ROLE_AUDIO_SINK, ROLE_NOTIFY_CHANNEL, ROLE_WAKE_LIGHT
from .models import AuroraAlarm, VolumeProfile

_LOGGER = logging.getLogger(__name__)


def _as_list(value: Any) -> list[str]:
    """Coerce a binding (str | list | None) into a list of entity_ids."""
    if not value:
        return []
    if isinstance(value, str):
        return [value]
    return list(value)


class RingController:
    """Start/stop the set of output adapters for the ringing alarm."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialise with no active adapters."""
        self._hass = hass
        self._adapters: list[OutputAdapter] = []

    @property
    def active(self) -> bool:
        """Whether any adapters are currently running."""
        return bool(self._adapters)

    async def async_start(self, alarm: AuroraAlarm, options: Mapping[str, Any]) -> None:
        """Build the adapters for ``alarm`` and start them all."""
        await self.async_stop()
        adapters: list[OutputAdapter] = []

        audio = alarm.features.audio
        audio_target = audio.target or options.get(ROLE_AUDIO_SINK)
        if audio.enabled and audio_target and audio.source:
            adapters.append(
                AudioSinkAdapter(
                    self._hass,
                    audio_target,
                    audio.source,
                    fade_in=audio.volume_profile is VolumeProfile.FADE_IN,
                    volume_max=audio.volume_max,
                )
            )

        light = alarm.features.light
        light_target = light.target or options.get(ROLE_WAKE_LIGHT)
        if light.enabled and light_target:
            adapters.append(
                WakeLightAdapter(
                    self._hass,
                    light_target,
                    duration_min=light.duration_min,
                    post_stop=light.post_stop,
                    color_temp_kelvin=light.color_temp_kelvin,
                )
            )

        # NotifyChannel is always present (persistent_notification = Tier-0 floor).
        adapters.append(
            NotifyChannelAdapter(
                self._hass,
                _as_list(options.get(ROLE_NOTIFY_CHANNEL)),
                title="Aurora",
                message=f"⏰ {alarm.label or 'Alarm'}",
                notification_id=f"aurora_{alarm.id}",
            )
        )

        self._adapters = adapters
        for adapter in adapters:
            try:
                await adapter.async_start()
            except Exception:
                _LOGGER.exception("Aurora: adapter failed to start")

    async def async_stop(self) -> None:
        """Stop all active adapters."""
        for adapter in self._adapters:
            try:
                await adapter.async_stop()
            except Exception:
                _LOGGER.exception("Aurora: adapter failed to stop")
        self._adapters = []
