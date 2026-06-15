"""Diagnostics for the Aurora config entry."""

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from .const import CONF_OWNER, DOMAIN
from .coordinator import AuroraConfigEntry

TO_REDACT = {CONF_OWNER, "owner"}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: AuroraConfigEntry
) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    coordinator = entry.runtime_data.coordinator
    alarms = hass.data[DOMAIN]
    data = coordinator.data
    return {
        "entry": {
            "version": f"{entry.version}.{entry.minor_version}",
            "data": async_redact_data(dict(entry.data), TO_REDACT),
            "options": async_redact_data(dict(entry.options), TO_REDACT),
        },
        "state": data.state.value,
        "active_alarm_id": data.active_alarm_id,
        "next_alarm": data.next_alarm.as_dict() if data.next_alarm else None,
        "alarm_count": len(alarms.async_items()),
        "alarms": [async_redact_data(item, TO_REDACT) for item in alarms.async_items()],
    }
