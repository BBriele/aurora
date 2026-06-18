"""Custom WebSocket API for the Aurora panel/card.

Alarm CRUD + push is already provided by ``DictStorageCollectionWebsocket``
(``aurora/alarms/*``). This module adds what the custom UI additionally needs:
read/write the installation settings (role bindings + globals) and discover which
entities can fill each role, so the UI can do *everything* without HA's config UI.
"""

from typing import Any

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
import voluptuous as vol

from .capabilities import available_roles, get_llm_vision_providers
from .const import DOMAIN


def _entry(hass: HomeAssistant) -> Any:
    """Return the single Aurora config entry, or None."""
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0] if entries else None


def _coordinator(hass: HomeAssistant) -> Any:
    """Return the loaded installation's coordinator, or None."""
    entry = _entry(hass)
    if entry is None or entry.state is not ConfigEntryState.LOADED:
        return None
    return entry.runtime_data.coordinator


@websocket_api.websocket_command({vol.Required("type"): "aurora/settings/get"})
@callback
def ws_settings_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return the installation settings (entry data + options)."""
    entry = _entry(hass)
    connection.send_result(
        msg["id"],
        {
            "entry_id": entry.entry_id if entry else None,
            "data": dict(entry.data) if entry else {},
            "options": dict(entry.options) if entry else {},
        },
    )


@websocket_api.websocket_command(
    {vol.Required("type"): "aurora/settings/set", vol.Required("options"): dict}
)
@websocket_api.async_response
async def ws_settings_set(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Persist new role bindings / globals to the config entry options."""
    entry = _entry(hass)
    if entry is None:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Aurora is not set up"
        )
        return
    # Shallow-merge over current options so partial updates (e.g. just the
    # profiles map, or one global key) don't wipe the rest.
    merged = {**dict(entry.options), **msg["options"]}
    options = {k: v for k, v in merged.items() if v not in ("", None, [])}
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"options": dict(entry.options)})


@websocket_api.websocket_command({vol.Required("type"): "aurora/options/entities"})
@callback
def ws_options_entities(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return, per role, the entities that currently satisfy it (for selectors)."""
    roles = available_roles(hass)
    calendars = sorted(state.entity_id for state in hass.states.async_all("calendar"))
    weather = sorted(state.entity_id for state in hass.states.async_all("weather"))
    todo = sorted(state.entity_id for state in hass.states.async_all("todo"))
    providers = [
        {"id": entry_id, "title": title}
        for entry_id, title in get_llm_vision_providers(hass)
    ]
    connection.send_result(
        msg["id"],
        {
            "roles": roles,
            "calendars": calendars,
            "weather": weather,
            "todo": todo,
            "vision_providers": providers,
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "aurora/vision/check",
        vol.Required("image"): str,
        vol.Optional("alarm_id"): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_vision_check(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Verify a selfie via the AI-vision provider; returns {awake, latency_ms}."""
    coordinator = _coordinator(hass)
    if coordinator is None:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Aurora is not set up"
        )
        return
    result = await coordinator.async_vision_check(msg["image"], msg.get("alarm_id"))
    connection.send_result(msg["id"], result)


@callback
def async_setup_websocket(hass: HomeAssistant) -> None:
    """Register the Aurora custom websocket commands."""
    websocket_api.async_register_command(hass, ws_settings_get)
    websocket_api.async_register_command(hass, ws_settings_set)
    websocket_api.async_register_command(hass, ws_options_entities)
    websocket_api.async_register_command(hass, ws_vision_check)
