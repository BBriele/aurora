"""Domain services for Aurora (registered once in async_setup).

CRUD services delegate to the alarm collection (the single source of truth).
Ring-control services delegate to the per-installation coordinator. All services
raise ``ServiceValidationError`` on bad input and ``HomeAssistantError`` on
runtime failure, per the Quality Scale ``action-exceptions`` rule.
"""

import logging
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
    callback,
)
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers.collection import ItemNotFound

from .const import (
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_BENCHMARK_VISION,
    SERVICE_DISMISS,
    SERVICE_REMOVE_ALARM,
    SERVICE_SKIP_NEXT,
    SERVICE_SNOOZE,
    SERVICE_TRIGGER_NOW,
    SERVICE_UPDATE_ALARM,
)
from .coordinator import AuroraCoordinator
from .storage import AlarmStorageCollection

_LOGGER = logging.getLogger(__name__)

_ID_SCHEMA = vol.Schema({vol.Required("id"): str})
_EMPTY_SCHEMA = vol.Schema({})
_ALARM_FIELDS = {
    vol.Optional("label"): str,
    vol.Optional("owner"): vol.Any(None, str),
    vol.Optional("enabled"): bool,
    vol.Optional("skip_next"): bool,
    vol.Optional("schedule"): dict,
    vol.Optional("features"): dict,
}
_ADD_SCHEMA = vol.Schema({vol.Required("time"): str, **_ALARM_FIELDS})
_UPDATE_SCHEMA = vol.Schema({vol.Required("id"): str, vol.Optional("time"): str, **_ALARM_FIELDS})
_BENCHMARK_SCHEMA = vol.Schema(
    {vol.Optional("samples", default=5): vol.All(vol.Coerce(int), vol.Range(min=1, max=50))}
)


def _alarms(hass: HomeAssistant) -> AlarmStorageCollection:
    """Return the alarm collection (always present after async_setup)."""
    return hass.data[DOMAIN]


def _coordinator(hass: HomeAssistant) -> AuroraCoordinator:
    """Return the single installation's coordinator, or raise if not loaded."""
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data.coordinator
    raise HomeAssistantError("Aurora is not set up yet")


@callback
def async_setup_services(hass: HomeAssistant) -> None:
    """Register all Aurora domain services (idempotent)."""
    if hass.services.has_service(DOMAIN, SERVICE_ADD_ALARM):
        return

    async def add_alarm(call: ServiceCall) -> None:
        try:
            await _alarms(hass).async_create_item(dict(call.data))
        except vol.Invalid as err:
            raise ServiceValidationError(str(err)) from err

    async def update_alarm(call: ServiceCall) -> None:
        updates = {k: v for k, v in call.data.items() if k != "id"}
        try:
            await _alarms(hass).async_update_item(call.data["id"], updates)
        except ItemNotFound as err:
            raise ServiceValidationError(f"Unknown alarm: {call.data['id']}") from err
        except vol.Invalid as err:
            raise ServiceValidationError(str(err)) from err

    async def remove_alarm(call: ServiceCall) -> None:
        try:
            await _alarms(hass).async_delete_item(call.data["id"])
        except ItemNotFound as err:
            raise ServiceValidationError(f"Unknown alarm: {call.data['id']}") from err

    async def skip_next(call: ServiceCall) -> None:
        try:
            await _alarms(hass).async_update_item(call.data["id"], {"skip_next": True})
        except ItemNotFound as err:
            raise ServiceValidationError(f"Unknown alarm: {call.data['id']}") from err

    async def snooze(call: ServiceCall) -> None:
        await _coordinator(hass).async_snooze()

    async def dismiss(call: ServiceCall) -> None:
        await _coordinator(hass).async_dismiss()

    async def trigger_now(call: ServiceCall) -> None:
        await _coordinator(hass).async_trigger_now(call.data.get("id"))

    async def benchmark_vision(call: ServiceCall) -> ServiceResponse:
        # Vision (and its benchmark) is implemented in Phase 3; surface a clear
        # placeholder so the service contract exists from day one.
        return {
            "status": "not_implemented",
            "phase": 3,
            "samples": call.data["samples"],
        }

    hass.services.async_register(DOMAIN, SERVICE_ADD_ALARM, add_alarm, schema=_ADD_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_UPDATE_ALARM, update_alarm, schema=_UPDATE_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_REMOVE_ALARM, remove_alarm, schema=_ID_SCHEMA
    )
    hass.services.async_register(DOMAIN, SERVICE_SKIP_NEXT, skip_next, schema=_ID_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_SNOOZE, snooze, schema=_EMPTY_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_DISMISS, dismiss, schema=_EMPTY_SCHEMA)
    hass.services.async_register(
        DOMAIN,
        SERVICE_TRIGGER_NOW,
        trigger_now,
        schema=vol.Schema({vol.Optional("id"): str}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_BENCHMARK_VISION,
        benchmark_vision,
        schema=_BENCHMARK_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
