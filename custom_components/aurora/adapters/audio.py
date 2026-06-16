"""AudioSink adapter — play a ringtone on any media_player, with volume fade-in."""

import asyncio
import contextlib
import logging

from homeassistant.components.media_player import (
    ATTR_MEDIA_CONTENT_ID,
    ATTR_MEDIA_CONTENT_TYPE,
    SERVICE_PLAY_MEDIA,
    MediaType,
)
from homeassistant.components.media_player import (
    DOMAIN as MEDIA_PLAYER_DOMAIN,
)
from homeassistant.const import (
    ATTR_ENTITY_ID,
    SERVICE_MEDIA_STOP,
    SERVICE_VOLUME_SET,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)

_FADE_STEPS = 10


class AudioSinkAdapter:
    """Play a media source and (optionally) fade the volume in over time."""

    def __init__(
        self,
        hass: HomeAssistant,
        entity_id: str,
        source: str,
        *,
        fade_in: bool,
        volume_max: float,
        fade_seconds: float = 30.0,
    ) -> None:
        """Store the target and ringtone parameters."""
        self._hass = hass
        self._entity_id = entity_id
        self._source = source
        self._fade_in = fade_in
        self._volume_max = max(0.0, min(volume_max, 1.0))
        self._fade_seconds = fade_seconds
        self._fade_task: asyncio.Task[None] | None = None

    async def async_start(self) -> None:
        """Set the starting volume and start playing the source."""
        start_volume = self._volume_max * 0.1 if self._fade_in else self._volume_max
        await self._set_volume(start_volume)
        try:
            await self._hass.services.async_call(
                MEDIA_PLAYER_DOMAIN,
                SERVICE_PLAY_MEDIA,
                {
                    ATTR_ENTITY_ID: self._entity_id,
                    ATTR_MEDIA_CONTENT_ID: self._source,
                    ATTR_MEDIA_CONTENT_TYPE: MediaType.MUSIC,
                },
                blocking=False,
            )
        except HomeAssistantError as err:
            _LOGGER.warning("Aurora audio: play failed on %s: %s", self._entity_id, err)
            return
        if self._fade_in:
            self._fade_task = self._hass.async_create_task(self._async_fade())

    async def _async_fade(self) -> None:
        """Ramp the volume from the starting level to the configured maximum."""
        with contextlib.suppress(asyncio.CancelledError):
            for step in range(1, _FADE_STEPS + 1):
                await asyncio.sleep(self._fade_seconds / _FADE_STEPS)
                await self._set_volume(self._volume_max * step / _FADE_STEPS)

    async def _set_volume(self, level: float) -> None:
        """Set the media player volume, swallowing device errors."""
        try:
            await self._hass.services.async_call(
                MEDIA_PLAYER_DOMAIN,
                SERVICE_VOLUME_SET,
                {
                    ATTR_ENTITY_ID: self._entity_id,
                    "volume_level": max(0.0, min(level, 1.0)),
                },
                blocking=False,
            )
        except HomeAssistantError as err:
            _LOGGER.debug(
                "Aurora audio: volume_set failed on %s: %s", self._entity_id, err
            )

    async def async_stop(self) -> None:
        """Cancel the fade and stop playback."""
        if self._fade_task is not None:
            self._fade_task.cancel()
            self._fade_task = None
        with contextlib.suppress(HomeAssistantError):
            await self._hass.services.async_call(
                MEDIA_PLAYER_DOMAIN,
                SERVICE_MEDIA_STOP,
                {ATTR_ENTITY_ID: self._entity_id},
                blocking=False,
            )
