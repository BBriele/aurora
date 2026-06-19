"""Typed data models for Aurora alarms.

These dataclasses are the in-memory source of truth for a single alarm. They are
serialised to plain JSON-safe dicts for the :class:`homeassistant.helpers.storage.Store`
and the WebSocket API. Every feature block is fully optional and carries sensible
defaults, mirroring the capability-first design: an alarm with everything disabled
is still a valid alarm (it simply rings via whatever output role is bound).
"""

from dataclasses import dataclass, field
from datetime import date, time
from enum import StrEnum
from typing import Any, Self


class RepeatMode(StrEnum):
    """How an alarm recurs."""

    ONCE = "once"  # one-shot: next occurrence of the time, or a specific date
    DAILY = "daily"
    WEEKLY = "weekly"  # on the configured weekdays


class MissionType(StrEnum):
    """Anti-snooze mission types (per-slot)."""

    NONE = "none"
    TAP = "tap"
    MATH = "math"
    QR = "qr"
    SHAKE = "shake"
    OPEN_DOOR = "open_door"
    VISION = "vision"


class VolumeProfile(StrEnum):
    """How the ringtone volume behaves."""

    FIXED = "fixed"
    FADE_IN = "fade_in"


class VolumeEndMode(StrEnum):
    """What to do with the speaker volume once the ring stops."""

    NONE = "none"  # leave the speaker at the ring volume
    RESTORE = "restore"  # restore the volume captured before the ring
    FIXED = "fixed"  # set a fixed end volume


# datetime.weekday(): Monday == 0 ... Sunday == 6
WEEKDAYS: tuple[int, ...] = tuple(range(7))


def _parse_time(value: str | None) -> time | None:
    """Parse an ``HH:MM`` (or ``HH:MM:SS``) string into a ``time``."""
    if not value:
        return None
    return time.fromisoformat(value)


def _parse_date(value: str | None) -> date | None:
    """Parse an ISO date string into a ``date``."""
    if not value:
        return None
    return date.fromisoformat(value)


@dataclass(slots=True)
class AlarmSchedule:
    """Recurrence rules for an alarm (internalised, no external scheduler)."""

    repeat_mode: RepeatMode = RepeatMode.DAILY
    weekdays: frozenset[int] = field(default_factory=lambda: frozenset(WEEKDAYS))
    on_date: date | None = None  # used when repeat_mode == ONCE

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {
            "repeat_mode": self.repeat_mode.value,
            "weekdays": sorted(self.weekdays),
            "on_date": self.on_date.isoformat() if self.on_date else None,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict."""
        return cls(
            repeat_mode=RepeatMode(data.get("repeat_mode", RepeatMode.DAILY)),
            weekdays=frozenset(data.get("weekdays", WEEKDAYS)),
            on_date=_parse_date(data.get("on_date")),
        )


@dataclass(slots=True)
class LightFeature:
    """Sunrise (WakeLight) behaviour. ``target`` is a role-binding entity_id."""

    enabled: bool = False
    target: str | None = None
    duration_min: int = 30
    color_temp_kelvin: int | None = None
    post_stop: str = "off"  # off | keep | dim

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {
            "enabled": self.enabled,
            "target": self.target,
            "duration_min": self.duration_min,
            "color_temp_kelvin": self.color_temp_kelvin,
            "post_stop": self.post_stop,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict."""
        return cls(
            enabled=bool(data.get("enabled", False)),
            target=data.get("target"),
            duration_min=int(data.get("duration_min", 30)),
            color_temp_kelvin=data.get("color_temp_kelvin"),
            post_stop=data.get("post_stop", "off"),
        )


@dataclass(slots=True)
class DisplayFeature:
    """Wake-overlay on screen-controllable displays.

    ``targets`` are ``display_surface`` role entity_ids (the kiosk's media_player
    entity). Empty means "use every bound display_surface target", mirroring how
    the audio feature falls back to the role binding. The overlay's colour/ramp
    reuse the alarm's LightFeature settings, so there is nothing else to store.
    """

    enabled: bool = False
    targets: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {"enabled": self.enabled, "targets": list(self.targets)}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict, dropping empty/invalid targets."""
        raw = data.get("targets") or []
        targets = [str(t) for t in raw if t]
        return cls(enabled=bool(data.get("enabled", False)), targets=targets)


@dataclass(slots=True)
class AudioFeature:
    """Ringtone (AudioSink) behaviour. ``target`` is a role-binding entity_id.

    ``volume_max`` is the ring volume. ``volume_end_mode``/``volume_end`` control
    what happens to the speaker volume once the ring stops (leave as is, restore
    the level captured before the ring, or set a fixed level).
    """

    enabled: bool = True
    target: str | None = None
    source: str | None = None  # media uri / playlist / radio / tts
    volume_profile: VolumeProfile = VolumeProfile.FADE_IN
    volume_max: float = 0.7
    volume_end_mode: VolumeEndMode = VolumeEndMode.NONE
    volume_end: float | None = None  # 0-1, used when volume_end_mode is FIXED

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {
            "enabled": self.enabled,
            "target": self.target,
            "source": self.source,
            "volume_profile": self.volume_profile.value,
            "volume_max": self.volume_max,
            "volume_end_mode": self.volume_end_mode.value,
            "volume_end": self.volume_end,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict."""
        try:
            end_mode = VolumeEndMode(data.get("volume_end_mode", "none"))
        except ValueError:
            end_mode = VolumeEndMode.NONE
        raw_end = data.get("volume_end")
        return cls(
            enabled=bool(data.get("enabled", True)),
            target=data.get("target"),
            source=data.get("source"),
            volume_profile=VolumeProfile(
                data.get("volume_profile", VolumeProfile.FADE_IN)
            ),
            volume_max=float(data.get("volume_max", 0.7)),
            volume_end_mode=end_mode,
            volume_end=None if raw_end is None else float(raw_end),
        )


@dataclass(slots=True)
class SmartWindowFeature:
    """Sleep-aware early-wake window. Always falls back to the exact time.

    ``sensitivity`` (0-1) tunes how eagerly the fusion declares you awake: higher
    wakes at the first sign of stirring, lower waits until you are clearly awake.
    0.5 is the neutral default (maps to the historical 0.6 fusion threshold).
    """

    enabled: bool = False
    minutes: int = 30
    signals: list[str] = field(default_factory=list)  # role-binding entity_ids
    sensitivity: float = 0.5

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {
            "enabled": self.enabled,
            "minutes": self.minutes,
            "signals": list(self.signals),
            "sensitivity": self.sensitivity,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict."""
        return cls(
            enabled=bool(data.get("enabled", False)),
            minutes=int(data.get("minutes", 30)),
            signals=list(data.get("signals", [])),
            sensitivity=max(0.0, min(1.0, float(data.get("sensitivity", 0.5)))),
        )


@dataclass(slots=True)
class MissionFeature:
    """Anti-snooze mission. ``vision_prompt`` only applies to VISION."""

    type: MissionType = MissionType.TAP
    params: dict[str, Any] = field(default_factory=dict)
    vision_prompt: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {
            "type": self.type.value,
            "params": dict(self.params),
            "vision_prompt": self.vision_prompt,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict."""
        return cls(
            type=MissionType(data.get("type", MissionType.TAP)),
            params=dict(data.get("params", {})),
            vision_prompt=data.get("vision_prompt"),
        )


@dataclass(slots=True)
class SnoozeFeature:
    """Snooze policy."""

    max: int = 3
    duration: int = 540  # seconds

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {"max": self.max, "duration": self.duration}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict."""
        return cls(
            max=int(data.get("max", 3)),
            duration=int(data.get("duration", 540)),
        )


@dataclass(slots=True)
class BriefingFeature:
    """Wake-up briefing content."""

    enabled: bool = False
    blocks: list[str] = field(default_factory=list)  # time, weather, calendar, todo
    template: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {
            "enabled": self.enabled,
            "blocks": list(self.blocks),
            "template": self.template,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict."""
        return cls(
            enabled=bool(data.get("enabled", False)),
            blocks=list(data.get("blocks", [])),
            template=data.get("template"),
        )


@dataclass(slots=True)
class AlarmFeatures:
    """The full set of per-slot feature overrides (all optional)."""

    light: LightFeature = field(default_factory=LightFeature)
    audio: AudioFeature = field(default_factory=AudioFeature)
    smart_window: SmartWindowFeature = field(default_factory=SmartWindowFeature)
    mission: MissionFeature = field(default_factory=MissionFeature)
    snooze: SnoozeFeature = field(default_factory=SnoozeFeature)
    briefing: BriefingFeature = field(default_factory=BriefingFeature)
    display: DisplayFeature = field(default_factory=DisplayFeature)

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {
            "light": self.light.as_dict(),
            "audio": self.audio.as_dict(),
            "smart_window": self.smart_window.as_dict(),
            "mission": self.mission.as_dict(),
            "snooze": self.snooze.as_dict(),
            "briefing": self.briefing.as_dict(),
            "display": self.display.as_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict."""
        data = data or {}
        return cls(
            light=LightFeature.from_dict(data.get("light", {})),
            audio=AudioFeature.from_dict(data.get("audio", {})),
            smart_window=SmartWindowFeature.from_dict(data.get("smart_window", {})),
            mission=MissionFeature.from_dict(data.get("mission", {})),
            snooze=SnoozeFeature.from_dict(data.get("snooze", {})),
            briefing=BriefingFeature.from_dict(data.get("briefing", {})),
            display=DisplayFeature.from_dict(data.get("display", {})),
        )


@dataclass(slots=True)
class AuroraAlarm:
    """A single alarm. The ``id`` is stable across edits."""

    id: str
    alarm_time: time
    label: str = ""
    owner: str | None = None
    profile_id: str | None = None  # HA user id this alarm belongs to (per-user)
    enabled: bool = True
    skip_next: bool = False
    # The specific date being skipped, pinned when skip_next is set so re-arming
    # (calendar refresh, edits) never re-skips a different occurrence. The
    # coordinator maintains this; None means "not yet pinned / nothing to skip".
    skip_date: date | None = None
    schedule: AlarmSchedule = field(default_factory=AlarmSchedule)
    features: AlarmFeatures = field(default_factory=AlarmFeatures)

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict for storage / WebSocket."""
        return {
            "id": self.id,
            "time": self.alarm_time.isoformat(timespec="minutes"),
            "label": self.label,
            "owner": self.owner,
            "profile_id": self.profile_id,
            "enabled": self.enabled,
            "skip_next": self.skip_next,
            "skip_date": self.skip_date.isoformat() if self.skip_date else None,
            "schedule": self.schedule.as_dict(),
            "features": self.features.as_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict.

        Raises:
            ValueError: if a required field (``id``, ``time``) is missing/invalid.
        """
        alarm_id = data.get("id")
        alarm_time = _parse_time(data.get("time"))
        if not alarm_id or alarm_time is None:
            raise ValueError("alarm requires a non-empty 'id' and a valid 'time'")
        return cls(
            id=alarm_id,
            alarm_time=alarm_time,
            label=data.get("label", ""),
            owner=data.get("owner"),
            profile_id=data.get("profile_id"),
            enabled=bool(data.get("enabled", True)),
            skip_next=bool(data.get("skip_next", False)),
            skip_date=_parse_date(data.get("skip_date")),
            schedule=AlarmSchedule.from_dict(data.get("schedule", {})),
            features=AlarmFeatures.from_dict(data.get("features", {})),
        )
