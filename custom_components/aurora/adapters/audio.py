"""AudioSink adapter — play a ringtone/playlist on any media_player, with fade-in."""

import asyncio
import contextlib
import logging
import random

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

# One playable entry: a media_content_id plus its content type.
type AudioItem = tuple[str, str]


class AudioSinkAdapter:
    """Play one or more media sources and (optionally) fade the volume in.

    A single source plays as before; a multi-item playlist plays the first
    entry and *enqueues* the rest (graceful — players that ignore enqueue still
    ring the first track). Optional ``shuffle`` randomises the order, ``loop``
    repeats the queue while ringing, and ``volume_end`` restores a comfortable
    volume on the speaker once the ring stops.
    """

    def __init__(
        self,
        hass: HomeAssistant,
        entity_id: str,
        items: list[AudioItem],
        *,
        fade_in: bool,
        volume_max: float,
        shuffle: bool = False,
        loop: bool = False,
        volume_end: float | None = None,
        fade_seconds: float = 30.0,
    ) -> None:
        """Store the target and ringtone parameters."""
        self._hass = hass
        self._entity_id = entity_id
        self._items = items
        self._fade_in = fade_in
        self._volume_max = max(0.0, min(volume_max, 1.0))
        self._shuffle = shuffle
        self._loop = loop
        self._volume_end = (
            None if volume_end is None else max(0.0, min(volume_end, 1.0))
        )
        self._fade_seconds = fade_seconds
        self._fade_task: asyncio.Task[None] | None = None

    async def async_start(self) -> None:
        """Set the starting volume and start playing the source(s)."""
        if not self._items:
            return
        items = list(self._items)
        if self._shuffle:
            random.shuffle(items)
        start_volume = self._volume_max * 0.1 if self._fade_in else self._volume_max
        await self._set_volume(start_volume)
        first, *rest = items
        if not await self._play(first[0], first[1], enqueue="replace"):
            return
        for content_id, content_type in rest:
            await self._play(content_id, content_type, enqueue="add")
        if self._loop:
            await self._set_repeat("all")
        if self._fade_in:
            self._fade_task = self._hass.async_create_task(self._async_fade())

    async def _play(self, content_id: str, content_type: str, *, enqueue: str) -> bool:
        """Call media_player.play_media for one entry; return False on failure."""
        try:
            await self._hass.services.async_call(
                MEDIA_PLAYER_DOMAIN,
                SERVICE_PLAY_MEDIA,
                {
                    ATTR_ENTITY_ID: self._entity_id,
                    ATTR_MEDIA_CONTENT_ID: content_id,
                    ATTR_MEDIA_CONTENT_TYPE: content_type or MediaType.MUSIC,
                    "enqueue": enqueue,
                },
                blocking=False,
            )
        except HomeAssistantError as err:
            _LOGGER.warning("Aurora audio: play failed on %s: %s", self._entity_id, err)
            return False
        return True

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

    async def _set_repeat(self, mode: str) -> None:
        """Set the player's repeat mode ("all"/"off"); ignore unsupported players."""
        with contextlib.suppress(HomeAssistantError):
            await self._hass.services.async_call(
                MEDIA_PLAYER_DOMAIN,
                "repeat_set",
                {ATTR_ENTITY_ID: self._entity_id, "repeat": mode},
                blocking=False,
            )

    async def async_stop(self) -> None:
        """Cancel the fade, stop playback and restore the end-of-ring volume."""
        if self._fade_task is not None:
            self._fade_task.cancel()
            self._fade_task = None
        if self._loop:
            await self._set_repeat("off")
        with contextlib.suppress(HomeAssistantError):
            await self._hass.services.async_call(
                MEDIA_PLAYER_DOMAIN,
                SERVICE_MEDIA_STOP,
                {ATTR_ENTITY_ID: self._entity_id},
                blocking=False,
            )
        if self._volume_end is not None:
            await self._set_volume(self._volume_end)
