# Aurora: Coordinator, Entities, Time Triggers & DST — Research Notes

**Research date:** 2026-06-15  
**Target platform:** Home Assistant 2026.6 (stable), Python ≥ 3.14.2  
**Researcher:** Claude (senior HA engineer context)

---

## 1. Platform Version Baseline

### HA 2026.6 — confirmed stable

- **Release date:** 2026-06-03 (blog: https://www.home-assistant.io/blog/2026/06/03/release-20266/)
- **`requires-python`** in `pyproject.toml` (tag `2026.6.0`): **`>=3.14.2`**
- Dev branch (`dev` as of 2026-06-15) already reads `2026.7.0.dev0`, still `>=3.14.2`.
- Source: https://github.com/home-assistant/core/blob/2026.6.0/pyproject.toml

**Implication for Aurora:** Target Python 3.14.2+. Use `type` keyword for TypeAlias (PEP 695), `zoneinfo` (stdlib, no backport needed), `|` union syntax everywhere.

---

## 2. DataUpdateCoordinator — Current API

### 2.1 Source & Key Imports

```python
# homeassistant/helpers/update_coordinator.py
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.helpers.update_coordinator import CoordinatorEntity
```

Source: https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/update_coordinator.py  
Developer docs: https://developers.home-assistant.io/docs/integration_fetching_data/

### 2.2 Generic Type Parameter

```python
_DataT = TypeVar("_DataT", default=dict[str, Any])

class DataUpdateCoordinator(BaseDataUpdateCoordinatorProtocol, Generic[_DataT]):
    ...
```

Aurora will use a typed custom dataclass as `_DataT`, e.g. `DataUpdateCoordinator[AuroraData]`.

### 2.3 `__init__` Full Signature

```python
def __init__(
    self,
    hass: HomeAssistant,
    logger: logging.Logger,
    *,
    config_entry: config_entries.ConfigEntry | None | UndefinedType = UNDEFINED,
    name: str,
    update_interval: timedelta | None = None,
    update_method: Callable[[], Awaitable[_DataT]] | None = None,
    setup_method: Callable[[], Awaitable[None]] | None = None,
    request_refresh_debouncer: Debouncer[Coroutine[Any, Any, None]] | None = None,
    always_update: bool = True,
) -> None:
```

**CRITICAL — `config_entry` is now MANDATORY (since HA 2025.11):**  
> "Not passing the argument will stop working in Home Assistant 2025.11."  
Source: https://github.com/home-assistant/core/issues/128077  
Pass `config_entry=entry` (the current ConfigEntry) or `config_entry=None` if no entry.

### 2.4 Key Methods

| Method | Decorator | Description |
|--------|-----------|-------------|
| `_async_update_data(self) -> _DataT` | — | Override to fetch data. Raise `UpdateFailed` on error, `ConfigEntryAuthFailed` on auth error. |
| `async_refresh(self) -> None` | — | Force immediate refresh, respects debounce lock. |
| `async_request_refresh(self) -> None` | — | Debounced refresh request. |
| `async_set_updated_data(self, data: _DataT) -> None` | `@callback` | Inject data without a fetch. Resets poll timer, notifies listeners. |
| `_async_setup(self) -> None` | — | Override for one-time initialization (runs inside `async_config_entry_first_refresh`). |

### 2.5 `async_set_updated_data` — Full Implementation

```python
@callback
def async_set_updated_data(self, data: _DataT) -> None:
    """Manually update data, notify listeners and reset refresh interval."""
    self._async_unsub_refresh()
    self._debounced_refresh.async_cancel()
    self.data = data
    self.last_update_success = True
    if self._listeners:
        self._schedule_refresh()
    self.async_update_listeners()
```

### 2.6 `_async_update_data` Pattern

```python
async def _async_update_data(self) -> _DataT:
    """Fetch the latest data from the source."""
    try:
        return await self._client.fetch()
    except ApiAuthError as err:
        raise ConfigEntryAuthFailed from err
    except ApiError as err:
        raise UpdateFailed(str(err)) from err
```

### 2.7 Event-Driven (Push / No Polling) Pattern

For Aurora's alarm coordinator, data is **not polled** — it is updated when:
- Config options change (user edits an alarm)
- An alarm fires and state must be written
- HA restarts (restore from storage)

```python
coordinator = DataUpdateCoordinator[AuroraData](
    hass,
    _LOGGER,
    config_entry=entry,      # REQUIRED since 2025.11
    name="aurora_alarm",
    # Deliberately omit update_method and update_interval
    always_update=True,
)

# When alarm config changes or alarm fires:
coordinator.async_set_updated_data(new_data)
```

### 2.8 `_async_setup` One-Time Initialization

```python
class AuroraCoordinator(DataUpdateCoordinator[AuroraData]):
    async def _async_setup(self) -> None:
        """Load persistent alarm state once at startup."""
        stored = await self._storage.async_load()
        self.data = AuroraData.from_storage(stored or {})
```

Called automatically inside `async_config_entry_first_refresh()`. Exceptions are caught and converted to `ConfigEntryNotReady`.

### 2.9 Setup in `async_setup_entry`

```python
async def async_setup_entry(
    hass: HomeAssistant,
    entry: AuroraConfigEntry,
) -> bool:
    coordinator = AuroraCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()  # runs _async_setup
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True
```

### 2.10 `retry_after` for `UpdateFailed` (since HA 2025.11)

```python
raise UpdateFailed("API rate limited", retry_after=60.0)
```

Note: ignored during `async_config_entry_first_refresh`. Source: https://developers.home-assistant.io/blog/2025/11/17/retry-after-update-failed/

### 2.11 `entry.runtime_data` Pattern (replaces `hass.data`)

```python
# __init__.py
type AuroraConfigEntry = ConfigEntry[AuroraCoordinator]

async def async_setup_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    coordinator = AuroraCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    ...

# sensor.py / binary_sensor.py
async def async_setup_entry(
    hass: HomeAssistant,
    entry: AuroraConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    coordinator: AuroraCoordinator = entry.runtime_data
    ...
```

Source: https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/runtime-data/

### 2.12 `BaseDataUpdateCoordinatorProtocol`

```python
class BaseDataUpdateCoordinatorProtocol(Protocol):
    @callback
    def async_add_listener(
        self, update_callback: CALLBACK_TYPE, context: Any = None
    ) -> Callable[[], None]: ...
```

Useful for typing purposes when you want to accept any coordinator in a function.

---

## 3. CoordinatorEntity

### 3.1 Class Signature

```python
class CoordinatorEntity(Entity, Generic[_DataUpdateCoordinatorT]):
    def __init__(
        self,
        coordinator: _DataUpdateCoordinatorT,
        context: Any = None,
    ) -> None:
        super().__init__(coordinator, context)
```

### 3.2 Key Properties and Methods

```python
@property
def available(self) -> bool:
    """Return True if coordinator last_update_success."""
    return self.coordinator.last_update_success

@callback
def _handle_coordinator_update(self) -> None:
    """Handle updated data from the coordinator.
    Override to compute entity state from coordinator.data before writing."""
    self.async_write_ha_state()

async def async_added_to_hass(self) -> None:
    """Register with coordinator; called before first state write."""
    await super().async_added_to_hass()
    self.async_on_remove(
        self.coordinator.async_add_listener(
            self._handle_coordinator_update, self.coordinator_context
        )
    )
```

### 3.3 Aurora Entity Pattern

```python
class AuroraAlarmSensor(CoordinatorEntity[AuroraCoordinator], SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(
        self,
        coordinator: AuroraCoordinator,
        alarm_id: str,
        description: SensorEntityDescription,
    ) -> None:
        super().__init__(coordinator, context=alarm_id)
        self.entity_description = description
        self._alarm_id = alarm_id
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_{alarm_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, coordinator.config_entry.entry_id)},
            name="Aurora Alarm Clock",
            manufacturer="Aurora",
            model="Smart Alarm",
            sw_version=VERSION,
        )

    @callback
    def _handle_coordinator_update(self) -> None:
        alarm = self.coordinator.data.alarms.get(self._alarm_id)
        if alarm is None:
            return
        self._attr_native_value = alarm.next_alarm_time
        self.async_write_ha_state()
```

---

## 4. Sensor & Binary Sensor Best Practices

### 4.1 Sensor Entity

```python
from homeassistant.components.sensor import (
    SensorEntity,
    SensorEntityDescription,
    SensorDeviceClass,
    SensorStateClass,
    RestoreSensor,
)
```

Key properties:
- `native_value`: The actual measurement (before unit conversion)
- `native_unit_of_measurement`: The unit of `native_value`
- `device_class`: `SensorDeviceClass.*` (e.g., `TIMESTAMP` for next alarm time)
- `state_class`: For statistics (`SensorStateClass.MEASUREMENT` / `TOTAL`)
- `has_entity_name = True`: **Mandatory for new integrations**
- `unique_id`: Stable, never user-configurable identifier

**RestoreSensor** (not `RestoreEntity`) for sensors that need state across restart:

```python
class AuroraNextAlarmSensor(RestoreSensor, CoordinatorEntity[AuroraCoordinator]):
    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        # RestoreSensor-specific: restores native_value and native_unit_of_measurement
        if (last_data := await self.async_get_last_sensor_data()) is not None:
            self._attr_native_value = last_data.native_value
            self._attr_native_unit_of_measurement = last_data.native_unit_of_measurement
```

**GOTCHA:** Do NOT extend `RestoreEntity` for sensors — it stores the formatted state string, not `native_value`. Use `RestoreSensor` instead.  
Source: https://developers.home-assistant.io/docs/core/entity/sensor/

### 4.2 Binary Sensor Entity

```python
from homeassistant.components.binary_sensor import (
    BinarySensorEntity,
    BinarySensorEntityDescription,
    BinarySensorDeviceClass,
)
```

Key device classes for Aurora:
- `BinarySensorDeviceClass.OCCUPANCY` — alarm active/inactive
- `BinarySensorDeviceClass.PROBLEM` — alarm error state
- `BinarySensorDeviceClass.SAFETY` — do-not-disturb mode

Required property: `is_on: bool | None`

```python
class AuroraAlarmActiveBinarySensor(
    CoordinatorEntity[AuroraCoordinator], BinarySensorEntity
):
    _attr_has_entity_name = True
    _attr_device_class = BinarySensorDeviceClass.OCCUPANCY

    @property
    def is_on(self) -> bool | None:
        alarm = self.coordinator.data.alarms.get(self._alarm_id)
        return alarm.enabled if alarm else None
```

### 4.3 `has_entity_name` and `DeviceInfo`

```python
# has_entity_name = True means `name` is the DATA POINT name only.
# The device name comes from DeviceInfo.
# friendly_name = "<DeviceInfo.name> <entity.name>"

class AuroraEntity(CoordinatorEntity[AuroraCoordinator]):
    _attr_has_entity_name = True

    @property
    def name(self) -> str | None:
        # For the "primary" feature of the device, return None to use just the device name
        # For secondary features, return a short descriptive string
        return self.entity_description.name  # e.g., "Next Alarm", "Enabled"
```

DeviceInfo fields (all optional except `identifiers` or `connections`):

```python
DeviceInfo(
    identifiers={(DOMAIN, entry.entry_id)},  # Required: set of (domain, unique_id) tuples
    name="Aurora Alarm Clock",
    manufacturer="Aurora",
    model="Smart Alarm v2",
    sw_version="1.0.0",
    hw_version=None,
    configuration_url=None,  # URL to device config page
    entry_type=DeviceEntryType.SERVICE,  # For virtual/software devices (no physical HW)
)
```

### 4.4 `RestoreEntity` for Non-Sensor Entities

```python
from homeassistant.helpers.restore_state import RestoreEntity, ExtraStoredData

class AuroraAlarmEntity(RestoreEntity, CoordinatorEntity[AuroraCoordinator]):
    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        # Retrieve last state (string representation) from DB
        last_state = await self.async_get_last_state()
        if last_state is not None:
            self._restore_from_state(last_state)
        # Retrieve extra typed data
        last_extra = await self.async_get_last_extra_data()
        if last_extra is not None:
            self._restore_extra(last_extra)

    @property
    def extra_restore_state_data(self) -> ExtraStoredData | None:
        return AuroraExtraData(self._alarm_config)
```

**Note (2026.3 regression):** There was a 2026.3 regression where entities restored to stale state on Docker restart. Check https://github.com/home-assistant/core/issues/164802 — may have been fixed in a subsequent 2026.3.x patch.

---

## 5. Time Event Tracking — Exact Signatures

Source: https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/helpers/event.py

All functions are decorated `@callback` and return `CALLBACK_TYPE` (a `Callable[[], None]` that cancels the listener).

### 5.1 `async_track_point_in_time`

```python
@callback
def async_track_point_in_time(
    hass: HomeAssistant,
    action: HassJob[[datetime], Coroutine[Any, Any, None] | None]
         | Callable[[datetime], Coroutine[Any, Any, None] | None],
    point_in_time: datetime,
) -> CALLBACK_TYPE:
    """Add a listener that fires once at or after a specific point in time.
    The listener is passed the time it fires in LOCAL time.
    """
```

**When to use:** Schedule a one-shot callback at a known future local datetime. The canonical choice for Aurora's alarm scheduler.

**Key detail:** `point_in_time` should be **timezone-aware**. Pass a local-tz-aware datetime (from `dt_util.as_local()` or constructed with `dt_util.get_default_time_zone()`).

### 5.2 `async_track_point_in_utc_time`

```python
@callback
def async_track_point_in_utc_time(
    hass: HomeAssistant,
    action: HassJob[[datetime], Coroutine[Any, Any, None] | None]
         | Callable[[datetime], Coroutine[Any, Any, None] | None],
    point_in_time: datetime,
) -> CALLBACK_TYPE:
    """Add a listener that fires once at or after a specific point in time.
    The listener is passed the time it fires in UTC time.
    """
```

**When to use:** When you have a UTC datetime. Internally `async_track_point_in_time` likely delegates here after conversion.

### 5.3 `async_track_time_change`

```python
@callback
def async_track_time_change(
    hass: HomeAssistant,
    action: Callable[[datetime], Coroutine[Any, Any, None] | None],
    hour: Any | None = None,
    minute: Any | None = None,
    second: Any | None = None,
) -> CALLBACK_TYPE:
    """Add a listener that fires every time the local time matches a pattern.
    The listener is passed the time it fires in LOCAL time.
    """
```

**When to use:** Repeating pattern triggers (e.g., fire every day at 06:30). Less flexible than the point-in-time approach for complex weekday/one-shot logic.

**NOT suitable for Aurora's multi-alarm scheduler** because it cannot do per-alarm weekday filtering or one-shot dates. Use only as a fallback heartbeat.

### 5.4 `async_track_utc_time_change`

```python
@callback
def async_track_utc_time_change(
    hass: HomeAssistant,
    action: Callable[[datetime], Coroutine[Any, Any, None] | None],
    hour: Any | None = None,
    minute: Any | None = None,
    second: Any | None = None,
    local: bool = False,
) -> CALLBACK_TYPE:
    """Add a listener that fires every time the UTC or local time matches a pattern.
    local=True means treat the pattern as local time.
    """
```

### 5.5 `async_call_later`

```python
@callback
def async_call_later(
    hass: HomeAssistant,
    delay: float | timedelta,
    action: HassJob[[datetime], Coroutine[Any, Any, None] | None]
         | Callable[[datetime], Coroutine[Any, Any, None] | None],
) -> CALLBACK_TYPE:
    """Add a listener that fires at or after <delay> seconds/timedelta.
    The listener is passed the time it fires in UTC time.
    """
```

**When to use:** Relative delays (e.g., snooze: fire in 9 minutes). Simple and reliable.

### 5.6 Cancellation Pattern

All return a `CALLBACK_TYPE` (`Callable[[], None]`). Always cancel when unloading:

```python
# Register
self._cancel_alarm = async_track_point_in_time(hass, self._on_alarm_fire, next_time)

# Cancel (on config change, unload, or re-arm)
if self._cancel_alarm is not None:
    self._cancel_alarm()
    self._cancel_alarm = None
```

Use `self.async_on_remove(cancel_fn)` inside `CoordinatorEntity.async_added_to_hass` to auto-cancel on entity removal.

---

## 6. Timezone & DST Handling

### 6.1 `dt_util` Core Functions

Source: https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/util/dt.py

```python
from homeassistant.util import dt as dt_util

# Get current local time (aware, in HA's configured timezone)
now_local: datetime = dt_util.now()

# Get current UTC time
now_utc: datetime = dt_util.utcnow()

# Convert any datetime to HA's local timezone
local_dt: datetime = dt_util.as_local(some_datetime)

# Convert any datetime to UTC
utc_dt: datetime = dt_util.as_utc(some_datetime)

# Get HA's configured timezone (a ZoneInfo object)
tz: zoneinfo.ZoneInfo = dt_util.get_default_time_zone()

# Build a local-tz-aware datetime for a given wall-clock time
alarm_time = datetime(2026, 6, 16, 7, 30, 0, tzinfo=dt_util.get_default_time_zone())
```

**CRITICAL:** `dt_util.now()` returns the current time in the HA-configured timezone. `dt_util.utcnow()` returns UTC. Both are timezone-aware.

### 6.2 Constructing a Future Local Datetime Correctly

```python
from datetime import datetime, timedelta
import zoneinfo
from homeassistant.util import dt as dt_util

def build_next_alarm_datetime(
    hour: int, minute: int, target_date: date
) -> datetime:
    """Build a timezone-aware local datetime for the alarm."""
    tz = dt_util.get_default_time_zone()
    return datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        hour,
        minute,
        0,
        tzinfo=tz,
        fold=0,  # Prefer first occurrence (pre-DST-end) for ambiguous times
    )
```

### 6.3 `find_next_time_expression_time` — Full Implementation & DST Logic

Source: `homeassistant/util/dt.py`

```python
def find_next_time_expression_time(
    now: datetime,
    seconds: list[int],
    minutes: list[int],
    hours: list[int],
) -> datetime:
    """Find the next datetime from now for which the time expression matches."""
    # ...cron-style matching with DST-aware handling...
```

The function handles two DST edge cases:

**Spring forward (clocks skip an hour):**
- The algorithm detects non-existent wall-clock times via `_datetime_exists()`.
- `_datetime_exists` does a UTC round-trip: `dattim == dattim.astimezone(UTC).astimezone(original_tzinfo)`.
- If the computed `result` doesn't exist, iterates `now += timedelta(seconds=1)` until a valid match is found (max ~3600 iterations, once per year).
- Effect: alarms during the skipped hour fire at the first valid moment after the transition.

**Fall back (clocks repeat an hour):**
- Detected via `_datetime_ambiguous()`: checks if UTC offset differs with `fold=1`.
- If both `now` and `result` are ambiguous: use `result.replace(fold=now.fold)` — stay in the same fold.
- If `now` is in fold=0 but result is not ambiguous: check if the result would also match in fold=1 — if so, emit fold=1 version.
- Effect: alarms scheduled in the repeated hour fire at the correct wall-clock time in the first occurrence, and also potentially in the second.

**For Aurora's use case**, `find_next_time_expression_time` is an excellent building block but targets cron-style patterns. For arbitrary next-datetime among N alarms, implement a custom version (see Section 7).

### 6.4 Known DST Bug: Time Triggers One Hour Late

**Issue #90293:** After DST transitions, `time:` trigger automations fire one hour late until HA is restarted.  
Source: https://github.com/home-assistant/core/issues/90293

**Root cause:** The timer scheduled before the DST transition does not automatically recalibrate. The UTC offset changes, but the scheduled UTC time stays the same, resulting in a one-hour offset.

**Mitigation for Aurora:**
1. **Always schedule in UTC**: convert the local alarm time to UTC using `dt_util.as_utc()`, then arm `async_track_point_in_utc_time`. This avoids local-time ambiguity at schedule time.
2. **Subscribe to the `EVENT_CORE_CONFIG_UPDATE` event** (which fires when HA timezone changes) to re-arm all timers.
3. **Re-arm after DST transitions**: listen to `EVENT_TIME_CHANGED` at the :00 boundary and recompute if the UTC offset has changed.

```python
# Recommended: schedule in UTC
utc_alarm = dt_util.as_utc(local_alarm_datetime)
cancel = async_track_point_in_utc_time(hass, self._on_fire, utc_alarm)
```

---

## 7. Robust Multi-Alarm Scheduler Pattern

### 7.1 Architecture

Aurora maintains a **single scheduled timer** for the next-to-fire alarm. When it fires:
1. Execute alarm actions
2. Compute the next occurrence for that alarm (advance to next valid weekday/date)
3. Recompute next-to-fire across ALL alarms
4. Re-arm the single timer

On config change:
1. Cancel existing timer
2. Recompute next-to-fire across all alarms
3. Arm new timer

### 7.2 Alarm Data Model

```python
from dataclasses import dataclass, field
from datetime import date, time as time_type
from enum import StrEnum, auto

class AlarmRecurrence(StrEnum):
    DAILY = "daily"
    WEEKDAYS = "weekdays"  # Mon-Fri
    CUSTOM = "custom"      # specific weekday set
    ONE_SHOT = "one_shot"  # specific date, fires once

@dataclass
class AlarmConfig:
    alarm_id: str
    enabled: bool
    hour: int
    minute: int
    recurrence: AlarmRecurrence
    weekdays: set[int] = field(default_factory=set)  # 0=Mon, 6=Sun (isoweekday-1)
    one_shot_date: date | None = None
    skip_next: bool = False  # skip the very next occurrence
```

### 7.3 `compute_next_occurrence` Implementation

```python
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from homeassistant.util import dt as dt_util

def compute_next_occurrence(
    alarm: AlarmConfig,
    now: datetime,  # timezone-aware local datetime
) -> datetime | None:
    """Return the next fire time for a single alarm, or None if never."""
    if not alarm.enabled:
        return None

    tz = dt_util.get_default_time_zone()
    today = now.date()
    skip_flag = alarm.skip_next  # will consume the skip on first valid candidate

    def candidate_for_date(d: date) -> datetime:
        """Build tz-aware datetime for alarm on date d."""
        return datetime(d.year, d.month, d.day, alarm.hour, alarm.minute, 0,
                        tzinfo=tz, fold=0)

    def is_valid_weekday(d: date) -> bool:
        if alarm.recurrence == AlarmRecurrence.DAILY:
            return True
        if alarm.recurrence == AlarmRecurrence.WEEKDAYS:
            return d.isoweekday() <= 5  # Mon-Fri
        if alarm.recurrence == AlarmRecurrence.CUSTOM:
            return (d.isoweekday() - 1) in alarm.weekdays
        if alarm.recurrence == AlarmRecurrence.ONE_SHOT:
            return d == alarm.one_shot_date
        return False

    # Determine first candidate date: today or tomorrow depending on time
    start_date = today
    candidate = candidate_for_date(start_date)

    # If today's alarm time has already passed, start from tomorrow
    if candidate <= now:
        start_date = today + timedelta(days=1)

    # Search forward up to 8 days (covers full week + 1)
    for offset in range(8):
        check_date = start_date + timedelta(days=offset)
        if not is_valid_weekday(check_date):
            continue

        candidate = candidate_for_date(check_date)

        # Handle non-existent times (spring-forward gap)
        if not _datetime_exists_local(candidate, tz):
            # Find the next valid minute after the gap
            candidate += timedelta(hours=1)  # jump past the gap
            # Recalculate to first valid second
            continue

        # Skip-next logic: consume the skip flag on the FIRST valid candidate
        if skip_flag:
            skip_flag = False
            continue  # skip this occurrence, look for the next one

        return dt_util.as_utc(candidate)  # Return in UTC for reliable scheduling

    return None  # No match in 8 days (e.g., one-shot already passed)


def _datetime_exists_local(dt_obj: datetime, tz: ZoneInfo) -> bool:
    """Check if a local datetime actually exists (spring-forward check)."""
    from homeassistant.util.dt import UTC
    return dt_obj == dt_obj.astimezone(UTC).astimezone(tz)
```

### 7.4 `compute_next_across_all_alarms`

```python
def compute_next_across_all_alarms(
    alarms: dict[str, AlarmConfig],
    now: datetime,
) -> tuple[str, datetime] | None:
    """Return (alarm_id, next_utc_datetime) for the soonest alarm, or None."""
    candidates: list[tuple[datetime, str]] = []

    for alarm_id, alarm in alarms.items():
        next_dt = compute_next_occurrence(alarm, now)
        if next_dt is not None:
            candidates.append((next_dt, alarm_id))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0])
    next_dt, alarm_id = candidates[0]
    return alarm_id, next_dt
```

### 7.5 Scheduler Class

```python
from __future__ import annotations
import logging
from datetime import datetime
from typing import TYPE_CHECKING
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_point_in_utc_time, CALLBACK_TYPE
from homeassistant.util import dt as dt_util

if TYPE_CHECKING:
    from .coordinator import AuroraCoordinator

_LOGGER = logging.getLogger(__name__)


class AuroraScheduler:
    """Manages a single armed timer for the next Aurora alarm."""

    def __init__(self, hass: HomeAssistant, coordinator: AuroraCoordinator) -> None:
        self._hass = hass
        self._coordinator = coordinator
        self._cancel: CALLBACK_TYPE | None = None
        self._armed_alarm_id: str | None = None

    @callback
    def async_arm(self) -> None:
        """Cancel existing timer and arm for next alarm."""
        self._async_cancel()
        now = dt_util.now()
        result = compute_next_across_all_alarms(
            self._coordinator.data.alarms, now
        )
        if result is None:
            _LOGGER.debug("Aurora: no alarms scheduled")
            return

        alarm_id, next_utc = result
        self._armed_alarm_id = alarm_id
        _LOGGER.debug(
            "Aurora: arming alarm %s at %s (UTC)", alarm_id, next_utc.isoformat()
        )
        self._cancel = async_track_point_in_utc_time(
            self._hass, self._async_on_fire, next_utc
        )

    @callback
    def _async_cancel(self) -> None:
        if self._cancel is not None:
            self._cancel()
            self._cancel = None
            self._armed_alarm_id = None

    @callback
    def _async_on_fire(self, now: datetime) -> None:
        """Called when the armed alarm fires."""
        alarm_id = self._armed_alarm_id
        _LOGGER.info("Aurora: alarm %s fired at %s", alarm_id, now.isoformat())

        # Execute alarm actions via the coordinator
        self._coordinator.async_handle_alarm_fired(alarm_id)

        # Mark skip_next consumed if applicable
        if alarm_id and alarm_id in self._coordinator.data.alarms:
            alarm = self._coordinator.data.alarms[alarm_id]
            if alarm.skip_next:
                alarm.skip_next = False

        # Re-arm for the next occurrence
        self.async_arm()

    def async_shutdown(self) -> None:
        """Clean up on integration unload."""
        self._async_cancel()
```

### 7.6 Re-arm on Config Change

```python
# In coordinator:
@callback
def async_update_alarm_config(self, alarm_id: str, new_config: AlarmConfig) -> None:
    """Called when user edits an alarm."""
    self.data.alarms[alarm_id] = new_config
    self.async_set_updated_data(self.data)  # notify entities
    self._scheduler.async_arm()             # re-arm timer

# In async_setup_entry / coordinator setup:
entry.async_on_unload(scheduler.async_shutdown)
```

### 7.7 Re-arm on HA Config Change (Timezone Change)

```python
from homeassistant.const import EVENT_CORE_CONFIG_UPDATE

@callback
def _async_on_core_config_update(event) -> None:
    """Rearm when HA timezone changes."""
    scheduler.async_arm()

entry.async_on_unload(
    hass.bus.async_listen(EVENT_CORE_CONFIG_UPDATE, _async_on_core_config_update)
)
```

---

## 8. DST Edge Case Summary Table

| Scenario | HA Behavior | Aurora Mitigation |
|----------|-------------|-------------------|
| **Spring forward**: 02:30 doesn't exist | `find_next_time_expression_time` skips to next valid second; effectively fires ~03:00 | Schedule in UTC; alarm at the skipped wall-clock time fires at the moment clocks advance |
| **Fall back**: 02:30 happens twice | `find_next_time_expression_time` uses `fold` to pick the correct occurrence | Schedule in UTC; the UTC conversion is unambiguous |
| **Timezone change in HA config** | Existing timers still use old offset | Listen to `EVENT_CORE_CONFIG_UPDATE` → re-arm |
| **HA restart** | RestoreSensor / RestoreEntity load last known state; timers must be re-armed | Re-arm in `async_added_to_hass` / `_async_setup` |
| **DST bug in time triggers (issue #90293)** | `time:` trigger automations fire 1h late until restart | Use `async_track_point_in_utc_time` with pre-converted UTC times |

---

## 9. Integration Quality Scale — Gold / Platinum Requirements Summary

Source: https://developers.home-assistant.io/docs/core/integration-quality-scale/

### Gold (minimum target for Aurora)
- Automatic device discovery where applicable
- UI-only configuration (config flow, no YAML)
- Full translations
- Diagnostic info / download
- Comprehensive documentation (user-facing)
- Firmware update support where possible
- Full automated test coverage

### Platinum (stretch goal)
- Fully typed with type annotations throughout (PEP 695 `type` aliases, generics)
- Full async code — no blocking I/O on the event loop
- Efficient data handling — no unnecessary polling
- All coding and HA integration standards met

Aurora-relevant rules:
- `runtime-data`: use `entry.runtime_data` (not `hass.data`)
- `config-entry`: always pass `config_entry=entry` to coordinator
- `has-entity-name`: `_attr_has_entity_name = True` on all entities
- `unique-id`: stable unique IDs derived from `entry.entry_id + alarm_id + entity_key`
- `entity-unavailable`: set `available = False` when coordinator has no data

---

## 10. Key Deprecations & Breaking Changes (2025–2026)

| Change | Deadline | Action Required |
|--------|----------|-----------------|
| `DataUpdateCoordinator` without `config_entry=` | **HA 2025.11** (already past) | Pass `config_entry=entry` or `config_entry=None` |
| `hass.data` for runtime data | Soft deprecation | Use `entry.runtime_data` with typed `ConfigEntry` |
| `async_track_state_change` | Removed HA 2025.5 | Use `async_track_state_change_event` |
| `RestoreEntity` for sensors | Soft deprecation | Use `RestoreSensor` + `async_get_last_sensor_data` |
| Legacy template platform syntax under individual platform keys | **Removed HA 2026.6** (deprecated 2025.12) | Remove from any YAML config |
| `async_config_entry_first_refresh` without `_async_setup` | Pattern change (not breaking) | Use `_async_setup` override for one-time init |

---

## 11. Complete Copy-Pasteable Coordinator Shell

```python
"""Aurora coordinator — event-driven, no polling."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DOMAIN, VERSION
from .scheduler import AuroraScheduler
from .storage import AuroraStorage

_LOGGER = logging.getLogger(__name__)

type AuroraConfigEntry = ConfigEntry[AuroraCoordinator]


@dataclass
class AuroraData:
    alarms: dict[str, AlarmConfig] = field(default_factory=dict)

    @classmethod
    def from_storage(cls, raw: dict[str, Any]) -> AuroraData:
        # Deserialize from stored dict
        ...


class AuroraCoordinator(DataUpdateCoordinator[AuroraData]):
    """Aurora coordinator: push-based, no polling."""

    config_entry: AuroraConfigEntry  # typed narrowing

    def __init__(self, hass: HomeAssistant, entry: AuroraConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=DOMAIN,
            # No update_method, no update_interval — pure push
            always_update=True,
        )
        self._storage = AuroraStorage(hass, entry.entry_id)
        self._scheduler = AuroraScheduler(hass, self)

    async def _async_setup(self) -> None:
        """Load persisted alarm configs once at startup."""
        stored = await self._storage.async_load()
        self.data = AuroraData.from_storage(stored or {})
        # Arm the timer for the next alarm
        self._scheduler.async_arm()

    @callback
    def async_handle_alarm_fired(self, alarm_id: str | None) -> None:
        """Called by scheduler when an alarm fires."""
        # Fire an HA event, trigger automations, etc.
        self.hass.bus.async_fire(
            f"{DOMAIN}_alarm_triggered",
            {"alarm_id": alarm_id},
        )
        # Notify entities to update state
        self.async_set_updated_data(self.data)

    @callback
    def async_update_alarm(self, alarm_id: str, config: AlarmConfig) -> None:
        """Update an alarm config and re-arm scheduler."""
        self.data.alarms[alarm_id] = config
        self.async_set_updated_data(self.data)
        self._scheduler.async_arm()

    def async_shutdown(self) -> None:
        """Clean up on unload."""
        self._scheduler.async_shutdown()
```

---

## 12. Sources

- HA 2026.6 release blog: https://www.home-assistant.io/blog/2026/06/03/release-20266/
- HA core pyproject.toml (2026.6.0 tag): https://github.com/home-assistant/core/blob/2026.6.0/pyproject.toml
- Fetching data / DataUpdateCoordinator docs: https://developers.home-assistant.io/docs/integration_fetching_data/
- update_coordinator.py source: https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/update_coordinator.py
- event.py source: https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/helpers/event.py
- dt.py source: https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/util/dt.py
- restore_state.py source: https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/restore_state.py
- Entity docs: https://developers.home-assistant.io/docs/core/entity/
- Sensor entity docs: https://developers.home-assistant.io/docs/core/entity/sensor/
- Binary sensor entity docs: https://developers.home-assistant.io/docs/core/entity/binary-sensor/
- runtime-data IQS rule: https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/runtime-data/
- Integration Quality Scale: https://developers.home-assistant.io/docs/core/integration-quality-scale/
- config_entry required for coordinator: https://github.com/home-assistant/core/issues/128077
- retry_after for UpdateFailed: https://developers.home-assistant.io/blog/2025/11/17/retry-after-update-failed/
- _async_setup discussion: https://github.com/home-assistant/architecture/discussions/1073
- DST bug issue #90293: https://github.com/home-assistant/core/issues/90293
- RestoreEntity 2026.3 regression: https://github.com/home-assistant/core/issues/164802
- Alarm clock architecture discussion: https://github.com/home-assistant/architecture/discussions/1089
- time trigger source: https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/homeassistant/triggers/time.py
- time_pattern trigger source: https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/homeassistant/triggers/time_pattern.py
