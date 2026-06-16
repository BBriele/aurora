"""Read-model entity tests for Aurora: sensor, binary_sensor, and entity base.

Covers the three sensor classes (AuroraStateSensor, AuroraNextAlarmSensor,
AuroraVisionLatencySensor) and the binary sensor (AuroraRingingBinarySensor)
through the public HA surface: config-entry setup, service calls, entity
state reads, entity-registry metadata. No private methods are accessed.
"""

from homeassistant.components.sensor import SensorDeviceClass
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_DISMISS,
    SERVICE_SNOOZE,
    SERVICE_TRIGGER_NOW,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _setup(
    hass: HomeAssistant, *, options: dict | None = None
) -> MockConfigEntry:
    """Set up an Aurora config entry and wait for all platforms to initialise."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options=options or {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _add_alarm(
    hass: HomeAssistant,
    alarm_time: str = "07:00",
    label: str = "Test",
) -> None:
    """Add an alarm via the public service and drain the event loop."""
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": alarm_time, "label": label},
        blocking=True,
    )
    await hass.async_block_till_done()


# ---------------------------------------------------------------------------
# aurora_state sensor
# ---------------------------------------------------------------------------


async def test_state_sensor_idle_after_setup(hass: HomeAssistant) -> None:
    """sensor.aurora_state reports 'idle' immediately after a clean setup."""
    await _setup(hass)
    state = hass.states.get("sensor.aurora_state")
    assert state is not None
    assert state.state == "idle"


async def test_state_sensor_device_class_enum(hass: HomeAssistant) -> None:
    """sensor.aurora_state carries the ENUM device class (for localised options)."""
    await _setup(hass)
    state = hass.states.get("sensor.aurora_state")
    assert state is not None
    assert state.attributes.get("device_class") == SensorDeviceClass.ENUM


async def test_state_sensor_options_contain_all_states(
    hass: HomeAssistant,
) -> None:
    """sensor.aurora_state options list covers the full AuroraState StrEnum."""
    await _setup(hass)
    state = hass.states.get("sensor.aurora_state")
    assert state is not None
    options = state.attributes.get("options", [])
    expected = {
        "idle",
        "pre_wake",
        "ringing",
        "snoozed",
        "mission",
        "dismissed",
        "post_wake",
    }
    assert expected == set(options)


async def test_state_sensor_transitions_to_ringing(hass: HomeAssistant) -> None:
    """trigger_now advances sensor.aurora_state to 'ringing'."""
    await _setup(hass)
    await _add_alarm(hass)
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    state = hass.states.get("sensor.aurora_state")
    assert state is not None
    assert state.state == "ringing"


async def test_state_sensor_back_to_idle_after_dismiss(
    hass: HomeAssistant,
) -> None:
    """Dismiss after a trigger returns sensor.aurora_state to 'idle'."""
    await _setup(hass)
    await _add_alarm(hass)
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()
    state = hass.states.get("sensor.aurora_state")
    assert state is not None
    assert state.state == "idle"


async def test_state_sensor_snoozed_state(hass: HomeAssistant) -> None:
    """Snooze while ringing transitions sensor.aurora_state to 'snoozed'."""
    await _setup(hass)
    await _add_alarm(hass)
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_SNOOZE, {}, blocking=True)
    await hass.async_block_till_done()
    state = hass.states.get("sensor.aurora_state")
    assert state is not None
    assert state.state == "snoozed"


# ---------------------------------------------------------------------------
# aurora_next_alarm sensor
# ---------------------------------------------------------------------------


async def test_next_alarm_sensor_unknown_when_no_alarms(
    hass: HomeAssistant,
) -> None:
    """sensor.aurora_next_alarm is 'unknown' when no alarms are configured."""
    await _setup(hass)
    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None
    # No alarm means None native_value → HA renders 'unknown' or 'unavailable'
    assert state.state in ("unknown", "unavailable")


async def test_next_alarm_sensor_device_class_timestamp(
    hass: HomeAssistant,
) -> None:
    """sensor.aurora_next_alarm always carries the TIMESTAMP device class."""
    await _setup(hass)
    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None
    assert state.attributes.get("device_class") == SensorDeviceClass.TIMESTAMP


async def test_next_alarm_sensor_populated_after_add(
    hass: HomeAssistant,
) -> None:
    """sensor.aurora_next_alarm becomes a concrete timestamp after adding an alarm."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="07:00", label="Morning")
    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None
    assert state.state not in ("unknown", "unavailable")


async def test_next_alarm_sensor_attributes_present(hass: HomeAssistant) -> None:
    """sensor.aurora_next_alarm extra_state_attributes exposes alarm metadata."""
    await _setup(hass)
    await _add_alarm(hass, alarm_time="07:00", label="Breakfast")
    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None
    attrs = state.attributes
    # NextAlarm.as_dict() returns {alarm_id, label, owner, fire_at}
    assert "alarm_id" in attrs
    assert "label" in attrs
    assert attrs["label"] == "Breakfast"
    assert "owner" in attrs
    assert "fire_at" in attrs


async def test_next_alarm_attributes_absent_when_no_alarm(
    hass: HomeAssistant,
) -> None:
    """sensor.aurora_next_alarm has no alarm_id attribute when there are no alarms."""
    await _setup(hass)
    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None
    assert "alarm_id" not in state.attributes


# ---------------------------------------------------------------------------
# aurora_vision_latency sensor (disabled by default)
# ---------------------------------------------------------------------------


async def test_vision_latency_disabled_by_default(hass: HomeAssistant) -> None:
    """sensor.aurora_vision_latency is registered but disabled by default."""
    await _setup(hass)
    registry = er.async_get(hass)
    entry = registry.async_get("sensor.aurora_vision_latency")
    assert entry is not None, "vision_latency entity must be registered"
    assert entry.disabled_by is not None, "vision_latency must be disabled by default"


async def test_vision_latency_not_in_hass_states_when_disabled(
    hass: HomeAssistant,
) -> None:
    """A disabled entity should not appear in hass.states by default."""
    await _setup(hass)
    # Disabled entities are not added to the state machine.
    assert hass.states.get("sensor.aurora_vision_latency") is None


async def test_vision_latency_entity_category_diagnostic(
    hass: HomeAssistant,
) -> None:
    """sensor.aurora_vision_latency is categorised as DIAGNOSTIC."""
    await _setup(hass)
    registry = er.async_get(hass)
    entry = registry.async_get("sensor.aurora_vision_latency")
    assert entry is not None
    assert entry.entity_category == EntityCategory.DIAGNOSTIC


# ---------------------------------------------------------------------------
# binary_sensor.aurora_ringing
# ---------------------------------------------------------------------------


async def test_ringing_sensor_off_after_setup(hass: HomeAssistant) -> None:
    """binary_sensor.aurora_ringing is 'off' after a clean setup."""
    await _setup(hass)
    state = hass.states.get("binary_sensor.aurora_ringing")
    assert state is not None
    assert state.state == "off"


async def test_ringing_sensor_no_attributes_when_idle(hass: HomeAssistant) -> None:
    """binary_sensor.aurora_ringing exposes no alarm_id/mission attributes when idle."""
    await _setup(hass)
    state = hass.states.get("binary_sensor.aurora_ringing")
    assert state is not None
    assert "alarm_id" not in state.attributes
    assert "mission" not in state.attributes


async def test_ringing_sensor_on_after_trigger(hass: HomeAssistant) -> None:
    """binary_sensor.aurora_ringing turns 'on' when trigger_now fires."""
    await _setup(hass)
    await _add_alarm(hass)
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    state = hass.states.get("binary_sensor.aurora_ringing")
    assert state is not None
    assert state.state == "on"


async def test_ringing_sensor_attributes_while_ringing(
    hass: HomeAssistant,
) -> None:
    """binary_sensor.aurora_ringing exposes alarm_id and mission attrs while ringing."""
    await _setup(hass)
    await _add_alarm(hass)
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    state = hass.states.get("binary_sensor.aurora_ringing")
    assert state is not None
    assert state.state == "on"
    attrs = state.attributes
    # extra_state_attributes returns {"alarm_id": ..., "mission": ...} when ringing
    assert "alarm_id" in attrs
    assert attrs["alarm_id"] is not None
    assert "mission" in attrs


async def test_ringing_sensor_off_after_dismiss(hass: HomeAssistant) -> None:
    """binary_sensor.aurora_ringing returns to 'off' after dismiss."""
    await _setup(hass)
    await _add_alarm(hass)
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()
    state = hass.states.get("binary_sensor.aurora_ringing")
    assert state is not None
    assert state.state == "off"


async def test_ringing_attributes_absent_after_dismiss(hass: HomeAssistant) -> None:
    """binary_sensor.aurora_ringing has no alarm_id/mission attrs once back to idle."""
    await _setup(hass)
    await _add_alarm(hass)
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()
    state = hass.states.get("binary_sensor.aurora_ringing")
    assert state is not None
    assert "alarm_id" not in state.attributes
    assert "mission" not in state.attributes


# ---------------------------------------------------------------------------
# Device / entity wiring
# ---------------------------------------------------------------------------


async def test_all_entities_use_aurora_device(hass: HomeAssistant) -> None:
    """All non-disabled entities belong to the single Aurora service device."""
    await _setup(hass)
    dev_registry = dr.async_get(hass)
    ent_registry = er.async_get(hass)

    # Every enabled Aurora entity must point at the same device.
    entity_ids = [
        "sensor.aurora_state",
        "sensor.aurora_next_alarm",
        "binary_sensor.aurora_ringing",
    ]
    device_ids: set[str | None] = set()
    for entity_id in entity_ids:
        ent_entry = ent_registry.async_get(entity_id)
        assert ent_entry is not None, f"{entity_id} must be registered"
        device_ids.add(ent_entry.device_id)

    assert len(device_ids) == 1, "All entities must share a single device"
    device_id = next(iter(device_ids))
    assert device_id is not None
    device = dev_registry.async_get(device_id)
    assert device is not None
    assert device.name == "Aurora"


async def test_entities_have_entity_name(hass: HomeAssistant) -> None:
    """All visible Aurora entities use has_entity_name (set by AuroraEntity base)."""
    await _setup(hass)
    registry = er.async_get(hass)
    for entity_id in (
        "sensor.aurora_state",
        "sensor.aurora_next_alarm",
        "binary_sensor.aurora_ringing",
    ):
        entry = registry.async_get(entity_id)
        assert entry is not None, f"{entity_id} not in entity registry"
        # has_entity_name=True means HA builds the name from device + translation key;
        # the registry entry will have a non-None translation_key.
        assert entry.translation_key is not None, (
            f"{entity_id} must carry a translation_key (has_entity_name=True)"
        )
