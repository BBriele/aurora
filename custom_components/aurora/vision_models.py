"""Live harvest of *configured* vision model names from Home Assistant.

The Aurora card offers a model combo box for the AI-vision mission. There is no
generic HA API that lists every model a provider *could* run, so instead we read
the models the user has actually configured — from the LLM Vision provider
entries and from the config entry behind any ``ai_task`` / ``conversation``
entity. This auto-updates as the user changes providers; nothing is hardcoded.

The extraction core (:func:`_models_from_mapping`, :func:`_models_from_entry`) is
HA-free so it runs in the local test shim; the registry walk in
:func:`collect_vision_models` imports HA lazily.
"""

from __future__ import annotations

from typing import Any

from .const import DOMAIN_LLM_VISION

# Config-entry/subentry key names different AI integrations store their model
# under (OpenAI/Google: ``chat_model``; Ollama: ``model``; LLM Vision:
# ``default_model``). These are HA *structural* keys, not a catalog of models.
MODEL_KEYS: tuple[str, ...] = ("chat_model", "model", "default_model")

# Entity domains whose backing config entry holds a vision-capable model.
_AI_DOMAINS = ("ai_task", "conversation")


def _models_from_mapping(mapping: Any) -> set[str]:
    """Return the model strings stored under MODEL_KEYS in a single config dict."""
    out: set[str] = set()
    if not isinstance(mapping, dict):
        return out
    for key in MODEL_KEYS:
        value = mapping.get(key)
        if isinstance(value, str) and value.strip():
            out.add(value.strip())
    return out


def _models_from_entry(entry: Any) -> set[str]:
    """Collect models from a config entry's data, options and every subentry."""
    out = _models_from_mapping(getattr(entry, "data", None))
    out |= _models_from_mapping(getattr(entry, "options", None))
    for sub in (getattr(entry, "subentries", None) or {}).values():
        out |= _models_from_mapping(getattr(sub, "data", None))
    return out


def collect_vision_models(hass: Any) -> list[str]:
    """Return the sorted, de-duplicated list of configured vision models."""
    from homeassistant.helpers import entity_registry as er

    entries: dict[str, Any] = {
        entry.entry_id: entry
        for entry in hass.config_entries.async_entries(DOMAIN_LLM_VISION)
    }
    ent_reg = er.async_get(hass)
    for ent in ent_reg.entities.values():
        if ent.domain in _AI_DOMAINS and ent.config_entry_id:
            entry = hass.config_entries.async_get_entry(ent.config_entry_id)
            if entry is not None:
                entries[entry.entry_id] = entry

    models: set[str] = set()
    for entry in entries.values():
        models |= _models_from_entry(entry)
    return sorted(models)
