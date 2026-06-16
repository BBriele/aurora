"""Aurora ringing binary sensor."""

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .coordinator import AuroraConfigEntry, AuroraCoordinator, AuroraState
from .entity import AuroraEntity

# Read-only entity driven by a single coordinator; no outbound writes.
PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant,
    entry: AuroraConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the Aurora binary sensors."""
    coordinator = entry.runtime_data.coordinator
    async_add_entities([AuroraRingingBinarySensor(coordinator)])


class AuroraRingingBinarySensor(AuroraEntity, BinarySensorEntity):
    """On while an alarm is actively ringing or in its mission."""

    _attr_translation_key = "ringing"

    def __init__(self, coordinator: AuroraCoordinator) -> None:
        """Set a stable unique id."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_ringing"

    @property
    def is_on(self) -> bool:
        """Return True while ringing or running a mission."""
        return self.coordinator.data.state in (
            AuroraState.RINGING,
            AuroraState.MISSION,
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Expose the active alarm's id + mission so the card can challenge."""
        data = self.coordinator.data
        if not self.is_on:
            return None
        return {
            "alarm_id": data.active_alarm_id,
            "mission": data.active_mission,
        }
