"""The Aurora integration — a capability-first smart alarm clock.

``async_setup`` (domain-level, once) owns the alarm collection, the WebSocket CRUD
transport, the domain services and the self-registration of the bundled Lovelace
card. ``async_setup_entry`` (per the single installation entry) owns the runtime:
the scheduler/state-machine coordinator and the read-model entities.
"""

import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import CARD_FILENAME, CARD_URL, CARD_URL_BASE, DOMAIN
from .coordinator import AuroraConfigEntry, AuroraCoordinator, AuroraRuntimeData
from .services import async_setup_services
from .storage import async_create_alarm_collection

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.BINARY_SENSOR, Platform.SENSOR]

# manifest.json version, appended to the card URL for cache-busting.
_CARD_VERSION = "0.0.1"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up domain-global services, storage and the frontend card (once)."""
    alarms = await async_create_alarm_collection(hass)
    hass.data[DOMAIN] = alarms

    async_setup_services(hass)
    await _async_register_card(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    """Set up the Aurora installation from its config entry."""
    alarms = hass.data[DOMAIN]
    coordinator = AuroraCoordinator(hass, entry, alarms)
    entry.runtime_data = AuroraRuntimeData(coordinator=coordinator)

    await coordinator.async_config_entry_first_refresh()
    await coordinator.async_setup()

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    """Unload the Aurora config entry (timer cleanup runs via async_on_unload)."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate an old config entry. Schema is at v1.1 — nothing to do yet."""
    _LOGGER.debug(
        "Aurora config entry version %s.%s — no migration needed",
        entry.version,
        entry.minor_version,
    )
    if entry.version > 1:
        return False
    return True


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve and register the bundled Lovelace card with no manual user action."""
    card_dir = Path(__file__).parent / "www"
    card_file = card_dir / CARD_FILENAME
    if not await hass.async_add_executor_job(card_file.is_file):
        _LOGGER.debug("Aurora card bundle not present yet (%s); skipping", card_file)
        return

    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL_BASE, str(card_dir), False)]
    )
    frontend.add_extra_js_url(hass, f"{CARD_URL}?v={_CARD_VERSION}")
    _LOGGER.debug("Registered Aurora card at %s", CARD_URL)
