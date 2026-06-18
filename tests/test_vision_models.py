"""Tests for custom_components.aurora.vision_models.

The pure extraction helpers (``_models_from_mapping`` / ``_models_from_entry``)
are HA-free and run on the local box via the conftest namespace shim. The
``collect_vision_models`` walk over hass config entries + the entity registry is
HA-dependent and only collected in CI.
"""

import importlib.util
import types
from types import MappingProxyType

from custom_components.aurora.vision_models import (
    MODEL_KEYS,
    _models_from_entry,
    _models_from_mapping,
)

_HA_AVAILABLE = importlib.util.find_spec("homeassistant") is not None


# ---------------------------------------------------------------------------
# _models_from_mapping (pure)
# ---------------------------------------------------------------------------


def test_mapping_pulls_each_model_key() -> None:
    """Every key in MODEL_KEYS is harvested when present."""
    for key in MODEL_KEYS:
        assert _models_from_mapping({key: "some-model"}) == {"some-model"}


def test_mapping_ignores_non_string_and_blank() -> None:
    """Non-string and blank/whitespace values are skipped."""
    assert _models_from_mapping({"chat_model": 123}) == set()
    assert _models_from_mapping({"model": ""}) == set()
    assert _models_from_mapping({"model": "   "}) == set()


def test_mapping_strips_whitespace() -> None:
    """Surrounding whitespace is trimmed."""
    assert _models_from_mapping({"model": "  llava  "}) == {"llava"}


def test_mapping_handles_non_dict() -> None:
    """A non-mapping input contributes nothing, never raises."""
    assert _models_from_mapping(None) == set()
    assert _models_from_mapping("not-a-dict") == set()
    assert _models_from_mapping(["model"]) == set()


def test_mapping_accepts_mappingproxy() -> None:
    """Config entry/subentry data is a MappingProxyType, not a dict — must work."""
    assert _models_from_mapping(MappingProxyType({"model": "llava"})) == {"llava"}


def test_mapping_ignores_unrelated_keys() -> None:
    """Keys outside MODEL_KEYS are not harvested."""
    assert _models_from_mapping({"sw_version": "1.2.3", "name": "Foo"}) == set()


# ---------------------------------------------------------------------------
# _models_from_entry (pure, with a duck-typed fake entry)
# ---------------------------------------------------------------------------


def _entry(data=None, options=None, subentries=None):
    """Build a minimal ConfigEntry stand-in: data/options + subentries map."""
    subs = {}
    for i, sub_data in enumerate(subentries or []):
        subs[str(i)] = types.SimpleNamespace(data=sub_data)
    return types.SimpleNamespace(
        data=data or {}, options=options or {}, subentries=subs
    )


def test_entry_merges_data_options_and_subentries() -> None:
    """Models are collected from entry.data, entry.options and every subentry."""
    entry = _entry(
        data={"default_model": "a"},
        options={"chat_model": "b"},
        subentries=[{"model": "c"}, {"chat_model": "d"}],
    )
    assert _models_from_entry(entry) == {"a", "b", "c", "d"}


def test_entry_dedupes_across_sources() -> None:
    """The same model in data and a subentry yields a single value."""
    entry = _entry(data={"chat_model": "qwen"}, subentries=[{"model": "qwen"}])
    assert _models_from_entry(entry) == {"qwen"}


def test_entry_tolerates_missing_attributes() -> None:
    """An entry lacking options/subentries attributes does not raise."""
    entry = types.SimpleNamespace(data={"model": "x"})
    assert _models_from_entry(entry) == {"x"}


# ---------------------------------------------------------------------------
# collect_vision_models (HA-dependent — CI only)
# ---------------------------------------------------------------------------

if _HA_AVAILABLE:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers import entity_registry as er
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from custom_components.aurora.const import DOMAIN_LLM_VISION
    from custom_components.aurora.vision_models import collect_vision_models

    async def test_collect_empty_without_providers(hass: HomeAssistant) -> None:
        """No providers and no AI entities -> empty list."""
        assert collect_vision_models(hass) == []

    async def test_collect_harvests_llm_vision_entry(hass: HomeAssistant) -> None:
        """A configured model on an LLM Vision provider entry is returned."""
        entry = MockConfigEntry(
            domain=DOMAIN_LLM_VISION,
            title="Ollama",
            data={"provider": "ollama", "default_model": "qwen2.5vl"},
        )
        entry.add_to_hass(hass)
        assert "qwen2.5vl" in collect_vision_models(hass)

    async def test_collect_harvests_ai_task_entity_entry(
        hass: HomeAssistant,
    ) -> None:
        """The config entry behind an ai_task entity contributes its model."""
        entry = MockConfigEntry(
            domain="openai_conversation",
            title="OpenAI",
            data={"chat_model": "gpt-4o-mini"},
        )
        entry.add_to_hass(hass)
        ent_reg = er.async_get(hass)
        ent_reg.async_get_or_create(
            "ai_task",
            "openai_conversation",
            "unique-ai",
            config_entry=entry,
        )
        assert "gpt-4o-mini" in collect_vision_models(hass)

    async def test_collect_sorted_and_deduped(hass: HomeAssistant) -> None:
        """Results are sorted and free of duplicates."""
        for title, model in (("A", "zeta"), ("B", "alpha"), ("C", "alpha")):
            MockConfigEntry(
                domain=DOMAIN_LLM_VISION,
                title=title,
                data={"provider": "x", "default_model": model},
            ).add_to_hass(hass)
        result = collect_vision_models(hass)
        assert result == sorted(result)
        assert result.count("alpha") == 1
