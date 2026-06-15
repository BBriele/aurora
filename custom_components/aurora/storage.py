"""Persistence for the dynamic alarm list.

The alarm list is a user-editable collection, so it uses HA's
``DictStorageCollection`` helper: it gives crash-safe ``Store`` persistence plus
the full ``aurora/alarms/{list,create,update,delete,subscribe}`` WebSocket CRUD +
push transport for free. Every item is validated through the typed model in
:mod:`.models`, so whatever is stored is always canonical.
"""

import logging
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import collection
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY_ALARMS, STORAGE_MINOR_VERSION, STORAGE_VERSION
from .models import AuroraAlarm

_LOGGER = logging.getLogger(__name__)

# WebSocket-layer schemas (validated again, in depth, by the model below).
CREATE_FIELDS: dict[Any, Any] = {
    vol.Required("time"): str,  # "HH:MM"
    vol.Optional("label", default=""): str,
    vol.Optional("owner"): vol.Any(None, str),
    vol.Optional("enabled", default=True): bool,
    vol.Optional("skip_next", default=False): bool,
    vol.Optional("schedule"): dict,
    vol.Optional("features"): dict,
}

UPDATE_FIELDS: dict[Any, Any] = {
    vol.Optional("time"): str,
    vol.Optional("label"): str,
    vol.Optional("owner"): vol.Any(None, str),
    vol.Optional("enabled"): bool,
    vol.Optional("skip_next"): bool,
    vol.Optional("schedule"): dict,
    vol.Optional("features"): dict,
}


def _validate_alarm(data: dict[str, Any], *, item_id: str) -> dict[str, Any]:
    """Normalise a raw alarm dict through the typed model.

    Returns the canonical JSON-safe dict (including ``id``).

    Raises:
        vol.Invalid: if the data cannot form a valid alarm.
    """
    try:
        alarm = AuroraAlarm.from_dict({**data, "id": item_id})
    except (ValueError, TypeError) as err:
        raise vol.Invalid(f"Invalid alarm: {err}") from err
    return alarm.as_dict()


class AlarmStorageCollection(collection.DictStorageCollection):
    """Manage the dynamic list of Aurora alarms."""

    async def _process_create_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Validate incoming create data; id is assigned by the collection."""
        validated = vol.Schema(CREATE_FIELDS)(data)
        # Normalise through the model with a placeholder id, then drop it so the
        # collection can assign the real generated id.
        canonical = _validate_alarm(validated, item_id="__pending__")
        canonical.pop("id", None)
        return canonical

    @callback
    def _get_suggested_id(self, info: dict[str, Any]) -> str:
        """Suggest a slug for ID generation from the alarm label/time."""
        return info.get("label") or f"alarm_{info.get('time', '')}" or "alarm"

    async def _update_data(
        self, item: dict[str, Any], update_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Merge a partial update over an existing alarm and re-validate."""
        validated = vol.Schema(UPDATE_FIELDS)(update_data)
        merged = {**item, **validated}
        # DictStorageCollection stores the generated id under the "id" key.
        return _validate_alarm(merged, item_id=item["id"])


async def async_create_alarm_collection(
    hass: HomeAssistant,
) -> AlarmStorageCollection:
    """Create, load and WebSocket-wire the alarm collection."""
    store: Store[collection.SerializedStorageCollection] = Store(
        hass,
        STORAGE_VERSION,
        STORAGE_KEY_ALARMS,
        minor_version=STORAGE_MINOR_VERSION,
        atomic_writes=True,
    )
    alarms = AlarmStorageCollection(store, collection.IDManager())
    await alarms.async_load()

    collection.DictStorageCollectionWebsocket(
        alarms,
        "aurora/alarms",
        "alarm",
        CREATE_FIELDS,
        UPDATE_FIELDS,
    ).async_setup(hass)

    return alarms
