"""Tests for custom_components.aurora.capabilities.

Covers probe_role, suggest_entities, available_roles, and get_llm_vision_providers
through the public API only.  Entities are registered by calling
hass.states.async_set with the appropriate domain and attributes so the probes
see realistic HA state objects — no integration setup required for most tests.

A small subset that calls get_llm_vision_providers needs a MockConfigEntry so that
hass.config_entries.async_entries("llmvision") returns synthetic data.
"""

from homeassistant.components.light import ATTR_SUPPORTED_COLOR_MODES, ColorMode
from homeassistant.components.media_player import MediaPlayerEntityFeature
from homeassistant.const import ATTR_SUPPORTED_FEATURES
from homeassistant.core import HomeAssistant
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.capabilities import (
    CapabilityResult,
    available_roles,
    get_llm_vision_providers,
    probe_role,
    suggest_entities,
)
from custom_components.aurora.const import (
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

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PLAY_MEDIA_FLAG = int(MediaPlayerEntityFeature.PLAY_MEDIA)


def _set_media_player(
    hass: HomeAssistant, entity_id: str, *, play_media: bool
) -> None:
    """Register a synthetic media_player state with selectable supported_features."""
    features = _PLAY_MEDIA_FLAG if play_media else 0
    hass.states.async_set(entity_id, "idle", {ATTR_SUPPORTED_FEATURES: features})


def _set_light(
    hass: HomeAssistant,
    entity_id: str,
    *,
    color_modes: list[str] | None = None,
) -> None:
    """Register a synthetic light state with the given color_modes."""
    attrs: dict = {}
    if color_modes is not None:
        attrs[ATTR_SUPPORTED_COLOR_MODES] = color_modes
    hass.states.async_set(entity_id, "on", attrs)


# ---------------------------------------------------------------------------
# CapabilityResult unit tests
# ---------------------------------------------------------------------------


def test_capability_result_good_has_ok_true() -> None:
    """CapabilityResult.good() returns ok=True with an empty missing list."""
    result = CapabilityResult.good()
    assert result.ok is True
    assert result.missing == []


def test_capability_result_fail_has_ok_false_and_missing() -> None:
    """CapabilityResult.fail() stores the supplied reason strings."""
    result = CapabilityResult.fail("domain:light", "feature:brightness")
    assert result.ok is False
    assert "domain:light" in result.missing
    assert "feature:brightness" in result.missing


# ---------------------------------------------------------------------------
# ROLE_AUDIO_SINK
# ---------------------------------------------------------------------------


async def test_audio_sink_happy_path(hass: HomeAssistant) -> None:
    """A media_player with PLAY_MEDIA satisfies ROLE_AUDIO_SINK."""
    _set_media_player(hass, "media_player.speaker", play_media=True)
    result = probe_role(hass, ROLE_AUDIO_SINK, "media_player.speaker")
    assert result.ok is True


async def test_audio_sink_missing_play_media_feature(hass: HomeAssistant) -> None:
    """A media_player without PLAY_MEDIA fails ROLE_AUDIO_SINK."""
    _set_media_player(hass, "media_player.speaker", play_media=False)
    result = probe_role(hass, ROLE_AUDIO_SINK, "media_player.speaker")
    assert result.ok is False
    assert any("play_media" in m for m in result.missing)


async def test_audio_sink_wrong_domain(hass: HomeAssistant) -> None:
    """A non-media_player entity fails ROLE_AUDIO_SINK."""
    hass.states.async_set("switch.amp", "off")
    result = probe_role(hass, ROLE_AUDIO_SINK, "switch.amp")
    assert result.ok is False
    assert any("media_player" in m for m in result.missing)


async def test_audio_sink_entity_not_in_hass(hass: HomeAssistant) -> None:
    """Probing ROLE_AUDIO_SINK for a missing entity fails (supported_features=0)."""
    result = probe_role(hass, ROLE_AUDIO_SINK, "media_player.ghost")
    assert result.ok is False


# ---------------------------------------------------------------------------
# ROLE_WAKE_LIGHT
# ---------------------------------------------------------------------------


async def test_wake_light_dimmable_light(hass: HomeAssistant) -> None:
    """A brightness-supporting light satisfies ROLE_WAKE_LIGHT."""
    _set_light(hass, "light.bedroom", color_modes=[ColorMode.BRIGHTNESS])
    result = probe_role(hass, ROLE_WAKE_LIGHT, "light.bedroom")
    assert result.ok is True


async def test_wake_light_rgb_light(hass: HomeAssistant) -> None:
    """An RGB light (which implies brightness) satisfies ROLE_WAKE_LIGHT."""
    _set_light(hass, "light.rgb_strip", color_modes=[ColorMode.RGB])
    result = probe_role(hass, ROLE_WAKE_LIGHT, "light.rgb_strip")
    assert result.ok is True


async def test_wake_light_no_brightness_fails(hass: HomeAssistant) -> None:
    """A light whose color_modes only contain ONOFF does not support brightness."""
    _set_light(hass, "light.basic", color_modes=[ColorMode.ONOFF])
    result = probe_role(hass, ROLE_WAKE_LIGHT, "light.basic")
    assert result.ok is False
    assert any("brightness" in m for m in result.missing)


async def test_wake_light_no_color_modes_fails(hass: HomeAssistant) -> None:
    """A light with an empty color_modes list fails ROLE_WAKE_LIGHT."""
    _set_light(hass, "light.empty", color_modes=[])
    result = probe_role(hass, ROLE_WAKE_LIGHT, "light.empty")
    assert result.ok is False


async def test_wake_light_number_entity(hass: HomeAssistant) -> None:
    """A number entity (screen backlight) satisfies ROLE_WAKE_LIGHT."""
    hass.states.async_set("number.screen_brightness", "80")
    result = probe_role(hass, ROLE_WAKE_LIGHT, "number.screen_brightness")
    assert result.ok is True


async def test_wake_light_wrong_domain_fails(hass: HomeAssistant) -> None:
    """A switch entity fails ROLE_WAKE_LIGHT."""
    hass.states.async_set("switch.lamp", "off")
    result = probe_role(hass, ROLE_WAKE_LIGHT, "switch.lamp")
    assert result.ok is False
    assert any("light" in m or "number" in m for m in result.missing)


async def test_wake_light_missing_color_modes_attribute_fails(
    hass: HomeAssistant,
) -> None:
    """A light with no ATTR_SUPPORTED_COLOR_MODES attribute at all fails."""
    hass.states.async_set("light.no_attrs", "on", {})
    result = probe_role(hass, ROLE_WAKE_LIGHT, "light.no_attrs")
    assert result.ok is False


# ---------------------------------------------------------------------------
# ROLE_DISPLAY_SURFACE
# ---------------------------------------------------------------------------


async def test_display_surface_media_player(hass: HomeAssistant) -> None:
    """A media_player satisfies ROLE_DISPLAY_SURFACE (no feature check needed)."""
    hass.states.async_set("media_player.tv", "idle")
    result = probe_role(hass, ROLE_DISPLAY_SURFACE, "media_player.tv")
    assert result.ok is True


async def test_display_surface_switch(hass: HomeAssistant) -> None:
    """A switch entity satisfies ROLE_DISPLAY_SURFACE."""
    hass.states.async_set("switch.kiosk", "on")
    result = probe_role(hass, ROLE_DISPLAY_SURFACE, "switch.kiosk")
    assert result.ok is True


async def test_display_surface_light(hass: HomeAssistant) -> None:
    """A light entity satisfies ROLE_DISPLAY_SURFACE (best-effort probe)."""
    _set_light(hass, "light.display", color_modes=[ColorMode.ONOFF])
    result = probe_role(hass, ROLE_DISPLAY_SURFACE, "light.display")
    assert result.ok is True


async def test_display_surface_wrong_domain(hass: HomeAssistant) -> None:
    """A binary_sensor is not a valid ROLE_DISPLAY_SURFACE."""
    hass.states.async_set("binary_sensor.motion", "off")
    result = probe_role(hass, ROLE_DISPLAY_SURFACE, "binary_sensor.motion")
    assert result.ok is False
    assert any(
        "media_player" in m or "switch" in m or "light" in m
        for m in result.missing
    )


# ---------------------------------------------------------------------------
# ROLE_NOTIFY_CHANNEL
# ---------------------------------------------------------------------------


async def test_notify_channel_happy_path(hass: HomeAssistant) -> None:
    """A notify entity satisfies ROLE_NOTIFY_CHANNEL."""
    hass.states.async_set("notify.mobile_app_phone", "notifying")
    result = probe_role(hass, ROLE_NOTIFY_CHANNEL, "notify.mobile_app_phone")
    assert result.ok is True


async def test_notify_channel_wrong_domain(hass: HomeAssistant) -> None:
    """A non-notify entity fails ROLE_NOTIFY_CHANNEL."""
    hass.states.async_set("sensor.temperature", "22")
    result = probe_role(hass, ROLE_NOTIFY_CHANNEL, "sensor.temperature")
    assert result.ok is False
    assert any("notify" in m for m in result.missing)


# ---------------------------------------------------------------------------
# ROLE_CONVERSATION
# ---------------------------------------------------------------------------


async def test_conversation_happy_path(hass: HomeAssistant) -> None:
    """A conversation entity satisfies ROLE_CONVERSATION."""
    hass.states.async_set("conversation.home_assistant", "idle")
    result = probe_role(hass, ROLE_CONVERSATION, "conversation.home_assistant")
    assert result.ok is True


async def test_conversation_wrong_domain(hass: HomeAssistant) -> None:
    """A non-conversation entity fails ROLE_CONVERSATION."""
    hass.states.async_set("sensor.chat", "idle")
    result = probe_role(hass, ROLE_CONVERSATION, "sensor.chat")
    assert result.ok is False
    assert any("conversation" in m for m in result.missing)


# ---------------------------------------------------------------------------
# ROLE_TTS
# ---------------------------------------------------------------------------


async def test_tts_happy_path(hass: HomeAssistant) -> None:
    """A tts entity satisfies ROLE_TTS."""
    hass.states.async_set("tts.home_assistant_cloud", "idle")
    result = probe_role(hass, ROLE_TTS, "tts.home_assistant_cloud")
    assert result.ok is True


async def test_tts_wrong_domain(hass: HomeAssistant) -> None:
    """A media_player is not a valid ROLE_TTS."""
    _set_media_player(hass, "media_player.speaker", play_media=True)
    result = probe_role(hass, ROLE_TTS, "media_player.speaker")
    assert result.ok is False
    assert any("tts" in m for m in result.missing)


# ---------------------------------------------------------------------------
# ROLE_SLEEP_SIGNAL / ROLE_PRESENCE_SIGNAL
# ---------------------------------------------------------------------------


async def test_sleep_signal_binary_sensor(hass: HomeAssistant) -> None:
    """A binary_sensor satisfies ROLE_SLEEP_SIGNAL."""
    hass.states.async_set("binary_sensor.bed_occupancy", "on")
    result = probe_role(hass, ROLE_SLEEP_SIGNAL, "binary_sensor.bed_occupancy")
    assert result.ok is True


async def test_sleep_signal_sensor(hass: HomeAssistant) -> None:
    """A numeric sensor also satisfies ROLE_SLEEP_SIGNAL."""
    hass.states.async_set("sensor.sleep_confidence", "85")
    result = probe_role(hass, ROLE_SLEEP_SIGNAL, "sensor.sleep_confidence")
    assert result.ok is True


async def test_sleep_signal_wrong_domain(hass: HomeAssistant) -> None:
    """A switch fails ROLE_SLEEP_SIGNAL."""
    hass.states.async_set("switch.bed_heater", "off")
    result = probe_role(hass, ROLE_SLEEP_SIGNAL, "switch.bed_heater")
    assert result.ok is False
    assert any("binary_sensor" in m or "sensor" in m for m in result.missing)


async def test_presence_signal_binary_sensor(hass: HomeAssistant) -> None:
    """A binary_sensor satisfies ROLE_PRESENCE_SIGNAL."""
    hass.states.async_set("binary_sensor.room_presence", "on")
    result = probe_role(
        hass, ROLE_PRESENCE_SIGNAL, "binary_sensor.room_presence"
    )
    assert result.ok is True


async def test_presence_signal_sensor(hass: HomeAssistant) -> None:
    """A sensor satisfies ROLE_PRESENCE_SIGNAL."""
    hass.states.async_set("sensor.ble_tracker", "home")
    result = probe_role(hass, ROLE_PRESENCE_SIGNAL, "sensor.ble_tracker")
    assert result.ok is True


async def test_presence_signal_wrong_domain(hass: HomeAssistant) -> None:
    """A light fails ROLE_PRESENCE_SIGNAL."""
    _set_light(hass, "light.bedroom", color_modes=[ColorMode.BRIGHTNESS])
    result = probe_role(hass, ROLE_PRESENCE_SIGNAL, "light.bedroom")
    assert result.ok is False


# ---------------------------------------------------------------------------
# ROLE_VISION_PROVIDER
# ---------------------------------------------------------------------------


async def test_vision_provider_ai_task(hass: HomeAssistant) -> None:
    """An ai_task entity satisfies ROLE_VISION_PROVIDER."""
    hass.states.async_set("ai_task.vision_model", "ready")
    result = probe_role(hass, ROLE_VISION_PROVIDER, "ai_task.vision_model")
    assert result.ok is True


async def test_vision_provider_wrong_domain(hass: HomeAssistant) -> None:
    """A non-ai_task entity fails ROLE_VISION_PROVIDER."""
    hass.states.async_set("sensor.camera_feed", "streaming")
    result = probe_role(hass, ROLE_VISION_PROVIDER, "sensor.camera_feed")
    assert result.ok is False
    assert any("ai_task" in m for m in result.missing)


# ---------------------------------------------------------------------------
# probe_role: unknown role raises KeyError
# ---------------------------------------------------------------------------


def test_probe_role_unknown_role_raises(hass: HomeAssistant) -> None:
    """probe_role raises KeyError for an unregistered role name."""
    with pytest.raises(KeyError):
        probe_role(hass, "nonexistent_role", "media_player.x")


# ---------------------------------------------------------------------------
# suggest_entities
# ---------------------------------------------------------------------------


async def test_suggest_entities_returns_matching(hass: HomeAssistant) -> None:
    """suggest_entities lists entities that pass the role probe."""
    _set_media_player(hass, "media_player.sonos", play_media=True)
    _set_media_player(hass, "media_player.cast", play_media=True)
    hass.states.async_set("switch.unrelated", "off")

    suggestions = suggest_entities(hass, ROLE_AUDIO_SINK)
    assert "media_player.sonos" in suggestions
    assert "media_player.cast" in suggestions
    assert "switch.unrelated" not in suggestions


async def test_suggest_entities_excludes_non_qualifying(
    hass: HomeAssistant,
) -> None:
    """suggest_entities omits media_player entities that lack PLAY_MEDIA."""
    _set_media_player(hass, "media_player.no_play", play_media=False)
    suggestions = suggest_entities(hass, ROLE_AUDIO_SINK)
    assert "media_player.no_play" not in suggestions


async def test_suggest_entities_returns_sorted(hass: HomeAssistant) -> None:
    """suggest_entities returns results in sorted order."""
    _set_media_player(hass, "media_player.zzz", play_media=True)
    _set_media_player(hass, "media_player.aaa", play_media=True)
    suggestions = suggest_entities(hass, ROLE_AUDIO_SINK)
    assert suggestions == sorted(suggestions)


async def test_suggest_entities_empty_when_none_match(
    hass: HomeAssistant,
) -> None:
    """suggest_entities returns an empty list when no entities pass the probe."""
    suggestions = suggest_entities(hass, ROLE_AUDIO_SINK)
    assert suggestions == []


async def test_suggest_entities_respects_limit(hass: HomeAssistant) -> None:
    """suggest_entities caps results at the supplied limit."""
    for i in range(5):
        _set_media_player(hass, f"media_player.speaker_{i}", play_media=True)
    suggestions = suggest_entities(hass, ROLE_AUDIO_SINK, limit=3)
    assert len(suggestions) <= 3


# ---------------------------------------------------------------------------
# available_roles
# ---------------------------------------------------------------------------


async def test_available_roles_returns_all_role_keys(
    hass: HomeAssistant,
) -> None:
    """available_roles always returns a dict with every role key."""
    result = available_roles(hass)
    for role in ALL_ROLES:
        assert role in result


async def test_available_roles_values_are_lists(hass: HomeAssistant) -> None:
    """Each value in available_roles is a list (possibly empty)."""
    result = available_roles(hass)
    for role, entities in result.items():
        assert isinstance(entities, list), f"Role {role} did not return a list"


async def test_available_roles_reflects_registered_entities(
    hass: HomeAssistant,
) -> None:
    """available_roles surfaces a freshly registered entity under the correct role."""
    hass.states.async_set("tts.piper", "idle")
    result = available_roles(hass)
    assert "tts.piper" in result[ROLE_TTS]


# ---------------------------------------------------------------------------
# get_llm_vision_providers
# ---------------------------------------------------------------------------


async def test_get_llm_vision_providers_empty_without_entries(
    hass: HomeAssistant,
) -> None:
    """With no llmvision config entries, the provider list is empty."""
    providers = get_llm_vision_providers(hass)
    assert providers == []


async def test_get_llm_vision_providers_returns_entry(
    hass: HomeAssistant,
) -> None:
    """A usable llmvision config entry appears in the provider list."""
    entry = MockConfigEntry(
        domain=DOMAIN_LLM_VISION,
        title="OpenAI Vision",
        data={"provider": "openai"},
    )
    entry.add_to_hass(hass)

    providers = get_llm_vision_providers(hass)
    entry_ids = [eid for eid, _ in providers]
    titles = [t for _, t in providers]
    assert entry.entry_id in entry_ids
    assert "OpenAI Vision" in titles


async def test_get_llm_vision_providers_excludes_settings_entry(
    hass: HomeAssistant,
) -> None:
    """The special 'Settings' llmvision entry is filtered out."""
    settings_entry = MockConfigEntry(
        domain=DOMAIN_LLM_VISION,
        title="LLM Vision Settings",
        data={"provider": "Settings"},
    )
    settings_entry.add_to_hass(hass)

    providers = get_llm_vision_providers(hass)
    entry_ids = [eid for eid, _ in providers]
    assert settings_entry.entry_id not in entry_ids


async def test_get_llm_vision_providers_mixed_entries(
    hass: HomeAssistant,
) -> None:
    """Settings entries are excluded while real providers are returned."""
    real_entry = MockConfigEntry(
        domain=DOMAIN_LLM_VISION,
        title="Gemini Vision",
        data={"provider": "gemini"},
    )
    settings_entry = MockConfigEntry(
        domain=DOMAIN_LLM_VISION,
        title="LLM Vision Settings",
        data={"provider": "Settings"},
    )
    real_entry.add_to_hass(hass)
    settings_entry.add_to_hass(hass)

    providers = get_llm_vision_providers(hass)
    assert len(providers) == 1
    assert providers[0][0] == real_entry.entry_id


# ---------------------------------------------------------------------------
# _is_available / edge-cases exercised via probe_role
# ---------------------------------------------------------------------------


async def test_probe_role_entity_missing_returns_fail(
    hass: HomeAssistant,
) -> None:
    """Absent entity for a feature-gated role returns ok=False."""
    # ROLE_AUDIO_SINK checks supported_features; missing entity => features=0 => fail
    result = probe_role(hass, ROLE_AUDIO_SINK, "media_player.not_registered")
    assert result.ok is False


async def test_wake_light_entity_not_registered(hass: HomeAssistant) -> None:
    """Probing ROLE_WAKE_LIGHT for an absent light entity returns ok=False."""
    result = probe_role(hass, ROLE_WAKE_LIGHT, "light.not_registered")
    # state is None -> modes is None -> brightness_supported fails
    assert result.ok is False
