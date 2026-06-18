"""Capability model: abstract roles, runtime probes and onboarding auto-detect.

The Aurora core never imports a third-party integration. It asks two questions of
any candidate entity: *can you fill this role?* (:func:`probe_role`) and *which
entities could fill this role?* (:func:`suggest_entities`). Probes key on domain,
supported color modes / features and the presence of services — never on a brand.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

from homeassistant.components.light import (
    ATTR_SUPPORTED_COLOR_MODES,
    brightness_supported,
)
from homeassistant.components.media_player import MediaPlayerEntityFeature
from homeassistant.const import ATTR_SUPPORTED_FEATURES
from homeassistant.core import HomeAssistant, split_entity_id

from .const import (
    ALL_ROLES,
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
    def good(cls) -> CapabilityResult:
        """Return a passing result."""
        return cls(ok=True)

    @classmethod
    def fail(cls, *missing: str) -> CapabilityResult:
        """Return a failing result with the reasons it failed."""
        return cls(ok=False, missing=list(missing))


def _supported_features(hass: HomeAssistant, entity_id: str) -> int:
    """Return the ``supported_features`` bitmask of an entity (0 if unknown)."""
    if (state := hass.states.get(entity_id)) is None:
        return 0
    return int(state.attributes.get(ATTR_SUPPORTED_FEATURES, 0) or 0)


# --- Per-role probes (only roles needing more than a domain check) -----------


def _probe_audio_sink(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """Check a media_player also supports PLAY_MEDIA (a valid AudioSink)."""
    if not _supported_features(hass, entity_id) & MediaPlayerEntityFeature.PLAY_MEDIA:
        return CapabilityResult.fail("feature:play_media")
    return CapabilityResult.good()


def _probe_wake_light(hass: HomeAssistant, entity_id: str) -> CapabilityResult:
    """Check a light is dimmable; a number (screen backlight) always qualifies."""
    if split_entity_id(entity_id)[0] == "number":
        return CapabilityResult.good()
    state = hass.states.get(entity_id)
    modes = state.attributes.get(ATTR_SUPPORTED_COLOR_MODES) if state else None
    if not modes or not brightness_supported(modes):
        return CapabilityResult.fail("feature:brightness")
    return CapabilityResult.good()


@dataclass(slots=True)
class RoleSpec:
    """Static description of a capability role.

    ``probe`` is an extra check beyond the domain; ``None`` for roles whose only
    requirement is the entity domain.
    """

    role: str
    domains: tuple[str, ...]
    probe: Callable[[HomeAssistant, str], CapabilityResult] | None = None


ROLE_SPECS: dict[str, RoleSpec] = {
    ROLE_AUDIO_SINK: RoleSpec(ROLE_AUDIO_SINK, ("media_player",), _probe_audio_sink),
    ROLE_WAKE_LIGHT: RoleSpec(ROLE_WAKE_LIGHT, ("light", "number"), _probe_wake_light),
    ROLE_DISPLAY_SURFACE: RoleSpec(
        ROLE_DISPLAY_SURFACE, ("media_player", "switch", "light")
    ),
    ROLE_NOTIFY_CHANNEL: RoleSpec(ROLE_NOTIFY_CHANNEL, ("notify",)),
    ROLE_VISION_PROVIDER: RoleSpec(ROLE_VISION_PROVIDER, ("ai_task",)),
    ROLE_SLEEP_SIGNAL: RoleSpec(ROLE_SLEEP_SIGNAL, ("binary_sensor", "sensor")),
    ROLE_PRESENCE_SIGNAL: RoleSpec(ROLE_PRESENCE_SIGNAL, ("binary_sensor", "sensor")),
    ROLE_CONVERSATION: RoleSpec(ROLE_CONVERSATION, ("conversation",)),
    ROLE_TTS: RoleSpec(ROLE_TTS, ("tts",)),
}


def probe_role(hass: HomeAssistant, role: str, entity_id: str) -> CapabilityResult:
    """Probe whether ``entity_id`` can fill ``role``.

    Checks the domain, then any role-specific ``probe``.

    Raises:
        KeyError: if ``role`` is unknown.
    """
    spec = ROLE_SPECS[role]
    if split_entity_id(entity_id)[0] not in spec.domains:
        return CapabilityResult.fail("domain:" + "|".join(spec.domains))
    return spec.probe(hass, entity_id) if spec.probe else CapabilityResult.good()


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
    return {role: suggest_entities(hass, role) for role in ALL_ROLES}
