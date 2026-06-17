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

from .adapters.audio import AudioItem, AudioSinkAdapter
from .adapters.base import OutputAdapter
from .adapters.light import WakeLightAdapter
from .adapters.notify import NotifyChannelAdapter
from .const import (
    CONF_AUDIO_PRESETS,
    CONF_PROFILES,
    PRESET_SOURCE_PREFIX,
    ROLE_AUDIO_SINK,
    ROLE_NOTIFY_CHANNEL,
    ROLE_WAKE_LIGHT,
)
from .models import AuroraAlarm, VolumeProfile

_LOGGER = logging.getLogger(__name__)


def _as_list(value: Any) -> list[str]:
    """Coerce a binding (str | list | None) into a list of entity_ids."""
    if not value:
        return []
    if isinstance(value, str):
        return [value]
    return list(value)


def _profile_presets(alarm: AuroraAlarm, options: Mapping[str, Any]) -> list[dict]:
    """Return the owner profile's saved audio presets (empty if none)."""
    profiles = options.get(CONF_PROFILES)
    if not isinstance(profiles, dict):
        return []
    profile = profiles.get(alarm.profile_id or "")
    if not isinstance(profile, dict):
        return []
    presets = profile.get(CONF_AUDIO_PRESETS)
    return presets if isinstance(presets, list) else []


def _resolve_audio_items(
    source: str, alarm: AuroraAlarm, options: Mapping[str, Any]
) -> list[AudioItem]:
    """Expand an alarm's audio source into playable (content_id, type) entries.

    A plain source is a single entry; an ``aurora_preset:<id>`` reference is
    resolved against the owner profile's presets into its ordered item list.
    """
    if source.startswith(PRESET_SOURCE_PREFIX):
        preset_id = source[len(PRESET_SOURCE_PREFIX) :]
        for preset in _profile_presets(alarm, options):
            if isinstance(preset, dict) and preset.get("id") == preset_id:
                items: list[AudioItem] = []
                for entry in preset.get("items") or []:
                    if not isinstance(entry, dict):
                        continue
                    content_id = entry.get("media_content_id")
                    if content_id:
                        items.append(
                            (str(content_id), str(entry.get("media_content_type") or ""))
                        )
                return items
        return []
    return [(source, "")]


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
            items = _resolve_audio_items(audio.source, alarm, options)
            if items:
                adapters.append(
                    AudioSinkAdapter(
                        self._hass,
                        audio_target,
                        items,
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
