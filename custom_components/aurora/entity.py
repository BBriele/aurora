"""Shared base entity for Aurora."""

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import AuroraCoordinator


class AuroraEntity(CoordinatorEntity[AuroraCoordinator]):
    """Base class wiring every Aurora entity to the coordinator + device."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: AuroraCoordinator) -> None:
        """Attach to the coordinator and the single Aurora service device."""
        super().__init__(coordinator)
        entry = coordinator.config_entry
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Aurora",
            manufacturer="Aurora",
            model="Smart Alarm",
            entry_type=DeviceEntryType.SERVICE,
        )
