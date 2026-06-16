"""Aurora read-model sensors consumed by the card and automations."""

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .coordinator import AuroraConfigEntry, AuroraCoordinator, AuroraState
from .entity import AuroraEntity

# Read-only entities driven by a single coordinator; no outbound writes.
PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant,
    entry: AuroraConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the Aurora sensors."""
    coordinator = entry.runtime_data.coordinator
    async_add_entities(
        [
            AuroraStateSensor(coordinator),
            AuroraNextAlarmSensor(coordinator),
            AuroraVisionLatencySensor(coordinator),
        ]
    )


class AuroraStateSensor(AuroraEntity, SensorEntity):
    """The alarm state machine value (idle/ringing/…)."""

    _attr_translation_key = "state"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [state.value for state in AuroraState]

    def __init__(self, coordinator: AuroraCoordinator) -> None:
        """Set a stable unique id."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_state"

    @property
    def native_value(self) -> str:
        """Return the current state value."""
        return self.coordinator.data.state.value


class AuroraNextAlarmSensor(AuroraEntity, SensorEntity):
    """The next upcoming alarm across all enabled alarms (UTC timestamp)."""

    _attr_translation_key = "next_alarm"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, coordinator: AuroraCoordinator) -> None:
        """Set a stable unique id."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_next_alarm"

    @property
    def native_value(self) -> datetime | None:
        """Return when the next alarm fires, or None if none scheduled."""
        next_alarm = self.coordinator.data.next_alarm
        return next_alarm.fire_at_utc if next_alarm else None

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Expose slot/owner details for the card."""
        next_alarm = self.coordinator.data.next_alarm
        return next_alarm.as_dict() if next_alarm else None


class AuroraVisionLatencySensor(AuroraEntity, SensorEntity):
    """Rolling AI-vision latency (populated from Phase 3 onward)."""

    _attr_translation_key = "vision_latency"
    _attr_native_unit_of_measurement = "ms"
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_suggested_display_precision = 0
    # No data until the AI-vision mission lands (Phase 3); keep it out of the way.
    _attr_entity_registry_enabled_default = False

    def __init__(self, coordinator: AuroraCoordinator) -> None:
        """Set a stable unique id."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_vision_latency"

    @property
    def native_value(self) -> float | None:
        """Return the rolling average vision latency in ms (None until measured)."""
        return self.coordinator.vision_latency_ms
