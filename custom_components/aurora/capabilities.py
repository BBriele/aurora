"""Capability model: abstract roles, runtime probes and onboarding auto-detect.

The Aurora core never imports a third-party integration. It asks two questions of
any candidate entity: *can you fill this role?* (:func:`probe_role`) and *which
entities could fill this role?* (:func:`suggest_entities`). Probes key on domain,
supported color modes / features and the presence of services — never on a brand.
"""

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

from homeassistant.components.light import brightness_supported
from homeassistant.components.light import ATTR_SUPPORTED_COLOR_MODES
from homeassistant.components.media_player import MediaPlayerEntityFeature
from homeassistant.const import ATTR_SUPPORTED_FEATURES
from homeassistant.core import HomeAssistant

from .const import (
    DOMAIN_LLM_VISION,
    ROLE_AUDIO_SINK,
    ROLE_CONVERSATION,
    ROLE_DISPLAY_SURFACE,
    ROLE_NOTIFY_CHANNEL,
    ROLE_PRESENCE_SIGNAL,
    ROLE_SLEEP_SIGNAL,
    ROLE_TTS,
    ROLE_VISION_PROVIDER,
    ROLE_WAKE_LIGHT,
)

# Settings entry of the LLM Vision integration is config, not a usable provider.
_LLM_VISION_SETTINGS_MARKER = "Settings"


@dataclass(slots=True)
class CapabilityResult:
    """Outcome of probing an entity for a role."""

    ok: bool
    missing: list[str] = field(default_factory=list)

    @classmethod
    def good(cls) -> "CapabilityResult":
        """A passing result."""
        return cls(ok=True)

    @classmethod
    def fail(cls, *missing: str) -> "CapabilityResult":
        """A failing result with the reasons it failed."""
        return cls(ok=False, missing=list(missing))


def _domain_of(entity_id: str) -> str:
    """Return the domain part of an entity_id."""
    return entity_id.partition(".")[0]


def _supported_features(hass: HomeAssistant, entity_id: str) -> int:
    """Return the ``supported_features`` bitmask of an entity (0 if unknown)."""
    if (state := hass.states.get(entity_id)) is None:
        return 0
    return int(state.attributes.get(ATTR_SUPPORTED_FEATURES, 0) or 0)


def _is_available(hass: HomeAssistant, entity_id: str) -> bool:
    """Return True if the entity currently has a usable state."""
    state = hass.states.get(entity_id)
    return state is not None and state.state not in ("unavailable", "unknown")


# --- Per-role probes --------------------------------------------------------


def _probe_audio_sink(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """A media_player that can play media is a valid AudioSink."""
    if _domain_of(entity_id) != "media_player":
        return CapabilityResult.fail("domain:media_player")
    features = _supported_features(hass, entity_id)
    if not features & MediaPlayerEntityFeature.PLAY_MEDIA:
        return CapabilityResult.fail("feature:play_media")
    return CapabilityResult.good()


def _probe_wake_light(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """A dimmable light, or a number (screen backlight), can drive a sunrise."""
    domain = _domain_of(entity_id)
    if domain == "light":
        state = hass.states.get(entity_id)
        modes = state.attributes.get(ATTR_SUPPORTED_COLOR_MODES) if state else None
        if not modes or not brightness_supported(modes):
            return CapabilityResult.fail("feature:brightness")
        return CapabilityResult.good()
    if domain == "number":
        # A number entity (e.g. screen backlight) can be ramped via number.set_value.
        return CapabilityResult.good()
    return CapabilityResult.fail("domain:light|number")


def _probe_notify_channel(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """A notify entity is a valid NotifyChannel (persistent_notification is the
    universal last-resort fallback handled by the adapter, not bound here)."""
    if _domain_of(entity_id) != "notify":
        return CapabilityResult.fail("domain:notify")
    return CapabilityResult.good()


def _probe_conversation(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """Any conversation agent entity."""
    if _domain_of(entity_id) != "conversation":
        return CapabilityResult.fail("domain:conversation")
    return CapabilityResult.good()


def _probe_tts(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """Any TTS entity."""
    if _domain_of(entity_id) != "tts":
        return CapabilityResult.fail("domain:tts")
    return CapabilityResult.good()


def _probe_signal(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """Sleep/presence signals are binary_sensor or sensor entities."""
    if _domain_of(entity_id) not in ("binary_sensor", "sensor"):
        return CapabilityResult.fail("domain:binary_sensor|sensor")
    return CapabilityResult.good()


def _probe_display_surface(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """A DisplaySurface is best-effort: a media_player or a switch/light screen.

    Concrete kiosk control (load URL, screensaver off) is delegated to an optional
    user-supplied action; this probe only validates a plausible binding target.
    """
    if _domain_of(entity_id) not in ("media_player", "switch", "light"):
        return CapabilityResult.fail("domain:media_player|switch|light")
    return CapabilityResult.good()


def _probe_vision_provider(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """An ai_task entity is the built-in VisionProvider candidate.

    LLM Vision providers are config entries, not entities — see
    :func:`get_llm_vision_providers`.
    """
    if _domain_of(entity_id) != "ai_task":
        return CapabilityResult.fail("domain:ai_task")
    return CapabilityResult.good()


@dataclass(slots=True)
class RoleSpec:
    """Static description of a capability role."""

    role: str
    domains: tuple[str, ...]
    probe: Callable[[HomeAssistant, str], CapabilityResult]


ROLE_SPECS: dict[str, RoleSpec] = {
    ROLE_AUDIO_SINK: RoleSpec(ROLE_AUDIO_SINK, ("media_player",), _probe_audio_sink),
    ROLE_WAKE_LIGHT: RoleSpec(ROLE_WAKE_LIGHT, ("light", "number"), _probe_wake_light),
    ROLE_DISPLAY_SURFACE: RoleSpec(
        ROLE_DISPLAY_SURFACE, ("media_player", "switch", "light"), _probe_display_surface
    ),
    ROLE_NOTIFY_CHANNEL: RoleSpec(ROLE_NOTIFY_CHANNEL, ("notify",), _probe_notify_channel),
    ROLE_VISION_PROVIDER: RoleSpec(
        ROLE_VISION_PROVIDER, ("ai_task",), _probe_vision_provider
    ),
    ROLE_SLEEP_SIGNAL: RoleSpec(
        ROLE_SLEEP_SIGNAL, ("binary_sensor", "sensor"), _probe_signal
    ),
    ROLE_PRESENCE_SIGNAL: RoleSpec(
        ROLE_PRESENCE_SIGNAL, ("binary_sensor", "sensor"), _probe_signal
    ),
    ROLE_CONVERSATION: RoleSpec(ROLE_CONVERSATION, ("conversation",), _probe_conversation),
    ROLE_TTS: RoleSpec(ROLE_TTS, ("tts",), _probe_tts),
}


def probe_role(hass: HomeAssistant, role: str, entity_id: str) -> CapabilityResult:
    """Probe whether ``entity_id`` can fill ``role``.

    Raises:
        KeyError: if ``role`` is unknown.
    """
    return ROLE_SPECS[role].probe(hass, entity_id)


def suggest_entities(hass: HomeAssistant, role: str, limit: int = 25) -> list[str]:
    """Return entity_ids that currently satisfy ``role`` (onboarding auto-detect)."""
    spec = ROLE_SPECS[role]
    found: list[str] = []
    for state in hass.states.async_all(spec.domains):
        if probe_role(hass, role, state.entity_id).ok:
            found.append(state.entity_id)
            if len(found) >= limit:
                break
    return sorted(found)


def get_llm_vision_providers(hass: HomeAssistant) -> list[tuple[str, str]]:
    """Return ``(entry_id, title)`` for each usable LLM Vision provider config entry.

    Excludes the special "Settings" entry. Empty if LLM Vision is not installed —
    in which case the VisionProvider degrades to ai_task or is disabled.
    """
    providers: list[tuple[str, str]] = []
    for entry in hass.config_entries.async_entries(DOMAIN_LLM_VISION):
        if entry.data.get("provider") == _LLM_VISION_SETTINGS_MARKER:
            continue
        providers.append((entry.entry_id, entry.title))
    return providers


def available_roles(hass: HomeAssistant) -> dict[str, list[str]]:
    """Map each role to the entities that currently satisfy it (for onboarding UI)."""
    return {role: suggest_entities(hass, role) for role in ROLE_SPECS}
