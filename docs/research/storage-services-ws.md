# Aurora — Research Notes: Storage, Collections, Services & WebSocket API

**HA Target:** 2026.6 (current stable as of 2026-06-03)  
**Python version:** 3.14 (upgraded in HA 2026.3, March 2026)  
**Minimum sensible target:** HA 2026.3+ (Python 3.14 baseline; anything earlier means Python 3.13 compat issues)

Primary sources researched:
- `homeassistant/helpers/storage.py` (dev branch)
- `homeassistant/helpers/collection.py` (dev branch)
- `homeassistant/components/websocket_api/` (dev branch)
- `homeassistant/helpers/service.py` (dev branch)
- `homeassistant/core.py` (dev branch)
- HA Developer Docs: https://developers.home-assistant.io
- Reference integrations: `tag`, `input_boolean`, `config/device_registry`

---

## 1. Platform & Python Version

| Item | Value |
|------|-------|
| Current stable HA | **2026.6** (released 2026-06-03) |
| Python bundled | **3.14** (since HA 2026.3, March 2026) |
| Minimum to target | **2026.3** (Python 3.14 + recent API surface) |
| Release cadence | First Wednesday of each month |

**Key developer changes in 2026.x affecting Aurora:**
- **2026.3**: Python 3.14 upgrade (performance: faster interpreter, better startup). `async_listen` deprecated in Labs.
- **2025.11** (important pre-req): `Store.serialize_in_event_loop` param added — serialization now happens in event loop by default (was executor thread). **If you pass non-thread-safe data to `async_delay_save`, you now get correct behaviour by default.**
- **2026.5**: `pyserial` → `serialx` migration (irrelevant for Aurora). Custom dashboard strategy registration added.
- **2026.6**: Config entry listener deprecation for reload methods; template platform legacy syntax removed.

---

## 2. `homeassistant.helpers.storage.Store`

**Source:** `homeassistant/helpers/storage.py`  
**Developer blog:** https://developers.home-assistant.io/blog/2025/11/25/storage-helper-opt-in-serialize-in-executor/

### 2.1 Constructor Signature

```python
class Store(Generic[_T]):
    def __init__(
        self,
        hass: HomeAssistant,
        version: int,              # major version (bump triggers _async_migrate_func)
        key: str,                  # storage key → .storage/<key>.json
        private: bool = False,     # exclude from backups if True
        *,
        atomic_writes: bool = False,       # use atomic rename on write (recommended: True)
        encoder: type[JSONEncoder] | None = None,  # custom JSON encoder
        max_readable_version: int | None = None,   # forward-compat: ignore files newer than this
        minor_version: int = 1,            # minor version (non-breaking schema additions)
        read_only: bool = False,           # prevent writes
        serialize_in_event_loop: bool = True,  # NEW in 2025.11 — keep True (default)
    ) -> None:
```

**Important 2025.11 note on `serialize_in_event_loop`:**  
Previously, `Store.async_save` / `async_delay_save` serialized JSON in a worker thread (executor). This was undocumented and unsafe for code that accessed `hass` or non-thread-safe objects inside a `data_func`. As of PR #157158/#157263, the **default is now `True`** (event loop), which is safe. Only set `False` if you have provably thread-safe data and need throughput optimization.

**Recommendation for Aurora:** Use `serialize_in_event_loop=True` (default) and `atomic_writes=True`.

### 2.2 Async Methods

```python
# Load data from disk. Returns None if no file exists.
# On version mismatch, calls _async_migrate_func automatically.
# On JSON corruption: renames file to .corrupt.<ISO8601>, creates persistent HA issue.
async def async_load(self) -> _T | None: ...

# Save data immediately. Thread-safe at event-loop. Writes version metadata.
async def async_save(self, data: _T) -> None: ...

# Schedule a deferred save. data_func is called at write time (lazy evaluation).
# Reschedules if another delay_save is pending. Ideal for batching rapid updates.
@callback
def async_delay_save(
    self,
    data_func: Callable[[], _T],  # called in event loop (since 2025.11 default)
    delay: float = 0,              # seconds; 0 = next event loop iteration
) -> None: ...

# Delete the storage file and cancel any pending writes.
async def async_remove(self) -> None: ...
```

### 2.3 On-Disk Format

```json
{
  "version": 1,
  "minor_version": 1,
  "key": "aurora.alarms",
  "data": { /* your payload */ }
}
```

### 2.4 Migration Pattern

```python
from homeassistant.helpers.storage import Store

class AuroraStore(Store[dict]):
    """Custom store with migration support."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict,
    ) -> dict:
        """Migrate storage data between versions."""
        if old_major_version == 1:
            if old_minor_version < 2:
                # Minor migration: add new optional field with default
                for item in old_data.get("items", []):
                    item.setdefault("snooze_count", 0)
        elif old_major_version > 2:
            raise ValueError(f"Cannot migrate from version {old_major_version}")
        return old_data
```

**Rule of thumb:**
- Bump `minor_version` for backwards-compatible additions (new optional fields).
- Bump `version` for breaking changes (field removals, restructuring) — triggers full `_async_migrate_func`.
- `max_readable_version` prevents newer data being silently corrupted on HA downgrade.

### 2.5 Concurrency / Performance Details

- Max 6 concurrent loads (`MAX_LOAD_CONCURRENTLY = 6` semaphore).
- `_StoreManager` preloads and caches frequently accessed keys.
- `SAVE_DELAY = 10` seconds used by collection helper (see §3).

### 2.6 Raw Store vs. Collection Helper — Decision Matrix

| Scenario | Recommendation |
|----------|---------------|
| Single blob of config (not a list) | Raw `Store` |
| Dynamic user-editable **list** of items (alarms, presets) needing CRUD + WS | `DictStorageCollection` + `DictStorageCollectionWebsocket` |
| Typed items needing custom domain objects | Custom `StorageCollection[MyItem, ...]` subclass |
| Read-only data ingested from API | Raw `Store(read_only=True)` |

**For Aurora:** Use `DictStorageCollection` for the alarm list (alarm entries as dicts). Use a raw `Store` for singleton global config (default volumes, global enable/disable state).

---

## 3. `homeassistant.helpers.collection` — Observable & Storage Collections

**Source:** `homeassistant/helpers/collection.py`  
**Reference implementations:** `homeassistant/components/tag/`, `homeassistant/components/input_boolean/`

### 3.1 Type Definitions

```python
# A listener called when a single change happens
type ChangeListener = Callable[
    [str, str, dict],  # change_type, item_id, updated_config
    Awaitable[None],
]

# A listener called with a batch of changes (preferred for performance)
type ChangeSetListener = Callable[
    [Iterable[CollectionChange]],
    Awaitable[None],
]
```

### 3.2 `CollectionChange` Dataclass

```python
@dataclass(slots=True)
class CollectionChange:
    change_type: str        # CHANGE_ADDED | CHANGE_UPDATED | CHANGE_REMOVED
    item_id: str
    item: Any
    item_hash: str | None = None  # for deduplication

# Constants
CHANGE_ADDED   = "added"
CHANGE_UPDATED = "updated"
CHANGE_REMOVED = "removed"
SAVE_DELAY     = 10  # seconds between dirty → disk writes
```

### 3.3 `ObservableCollection[_ItemT]`

Base class. Holds an in-memory `dict[str, _ItemT]` and notifies listeners on changes.

```python
class ObservableCollection[_ItemT]:
    def __init__(self, id_manager: IDManager | None) -> None: ...

    @callback
    def async_items(self) -> list[_ItemT]: ...

    # Register a listener; returns unsubscribe callback
    @callback
    def async_add_listener(self, listener: ChangeListener) -> Callable[[], None]: ...

    @callback
    def async_add_change_set_listener(
        self, listener: ChangeSetListener
    ) -> Callable[[], None]: ...

    # Notify all listeners (called internally after CRUD)
    async def notify_changes(self, change_set: Iterable[CollectionChange]) -> None: ...
```

### 3.4 `StorageCollection[_ItemT, _StoreT]`

Abstract base that adds persistence on top of `ObservableCollection`. You must subclass it.

```python
class StorageCollection[_ItemT, _StoreT: SerializedStorageCollection](
    ObservableCollection[_ItemT]
):
    def __init__(
        self,
        store: Store[_StoreT],
        id_manager: IDManager | None = None,
    ) -> None: ...

    # --- Must override ---
    async def _process_create_data(self, data: dict) -> dict:
        """Validate and transform incoming create data."""
        ...

    @callback
    @abstractmethod
    def _get_suggested_id(self, info: dict) -> str:
        """Return a slug for ID generation from item data."""
        ...

    async def _update_data(self, item: _ItemT, update_data: dict) -> _ItemT:
        """Apply updates to an existing item."""
        ...

    def _create_item(self, item_id: str, data: dict) -> _ItemT:
        """Instantiate item from id + data dict."""
        ...

    def _deserialize_item(self, data: dict) -> _ItemT:
        """Reconstruct item from stored dict."""
        ...

    def _serialize_item(self, item_id: str, item: _ItemT) -> dict:
        """Flatten item to dict for storage."""
        ...

    @callback
    def _data_to_save(self) -> _StoreT:
        """Return the full payload to persist."""
        ...

    # --- Public CRUD (use these from services/websocket) ---
    async def async_load(self) -> None:
        """Load from disk, notify CHANGE_ADDED for all loaded items."""
        ...

    async def async_create_item(self, data: dict) -> _ItemT:
        """Validate, ID-generate, store, notify CHANGE_ADDED. Returns new item."""
        ...

    async def async_update_item(self, item_id: str, updates: dict) -> _ItemT:
        """Apply updates, persist, notify CHANGE_UPDATED. Returns updated item."""
        ...

    async def async_delete_item(self, item_id: str) -> None:
        """Remove item, persist, notify CHANGE_REMOVED."""
        ...
```

**Persistence:** After every CRUD call, `async_delay_save` is scheduled with `SAVE_DELAY=10` seconds. The store writes to disk after the delay, coalescing rapid bursts.

### 3.5 `DictStorageCollection` — Concrete Subclass

The simplest usable form — items are plain `dict`. No custom domain objects needed.

```python
class DictStorageCollection(
    StorageCollection[dict, SerializedStorageCollection]
):
    """Items are raw dicts; ID is stored as 'id' key inside the dict."""
    # _create_item, _deserialize_item, _serialize_item all implemented.
    # Only need to override _process_create_data and _get_suggested_id.
```

**On-disk format (`.storage/<key>.json`):**
```json
{
  "version": 1,
  "minor_version": 1,
  "key": "aurora.alarms",
  "data": {
    "items": [
      {"id": "alarm_abc123", "name": "Morning", "time": "07:00", "days": ["mon","tue"]},
      {"id": "alarm_def456", "name": "Weekend", "time": "09:00", "days": ["sat","sun"]}
    ]
  }
}
```

### 3.6 `IDManager`

Tracks IDs across multiple collections to avoid collisions.

```python
class IDManager:
    def __init__(self) -> None: ...
    def add_collection(self, collection: dict[str, Any]) -> None: ...
    def has_id(self, item_id: str) -> bool: ...
    def generate_id(self, suggestion: str) -> str:
        """Slugify suggestion + suffix digits to ensure uniqueness."""
        ...
```

### 3.7 `StorageCollectionWebsocket` / `DictStorageCollectionWebsocket`

Automatically wires CRUD WebSocket commands for a storage collection.

```python
class StorageCollectionWebsocket[_StorageCollectionT: StorageCollection]:
    def __init__(
        self,
        storage_collection: _StorageCollectionT,
        api_prefix: str,       # e.g. "aurora" → commands: "aurora/list", "aurora/create" ...
        model_name: str,       # used in error messages ("aurora item not found")
        create_schema: VolDictType,  # voluptuous dict schema for creation
        update_schema: VolDictType,  # voluptuous dict schema for updates
        *,
        admin_only: bool = False,    # gate all commands behind require_admin
    ) -> None: ...

    @callback
    def async_setup(self, hass: HomeAssistant) -> None:
        """Register all websocket commands on hass."""
        ...

    # Registered commands (auto-generated from api_prefix):
    # GET  {api_prefix}/list    → ws_list_item()    (sync callback)
    # POST {api_prefix}/create  → ws_create_item()  (async)
    # PUT  {api_prefix}/update  → ws_update_item()  (async)
    # DEL  {api_prefix}/delete  → ws_delete_item()  (async)
    # SUB  {api_prefix}/subscribe → _ws_subscribe() (push, sync setup + async events)
```

**Subscription mechanism (`_ws_subscribe`):**
1. Client sends `{"type": "aurora/subscribe", "id": 42}`.
2. Server sends `{"type": "result", "id": 42, "success": true}` (ack).
3. Server immediately sends one `event_message(42, {"type": "added", ...})` per existing item.
4. On future CRUD changes, server pushes `event_message(42, {"type": "updated/added/removed", ...})`.
5. On connection close, `connection.subscriptions[42]()` is called → listener removed.

### 3.8 Complete Aurora Alarm Collection Pattern

```python
# custom_components/aurora/storage.py
import voluptuous as vol
from homeassistant.helpers import collection
from homeassistant.helpers.storage import Store

STORAGE_KEY = "aurora.alarms"
STORAGE_VERSION = 1
STORAGE_VERSION_MINOR = 1

CREATE_SCHEMA = {
    vol.Required("name"): str,
    vol.Required("time"): str,       # "HH:MM"
    vol.Optional("days", default=[]): [str],
    vol.Optional("enabled", default=True): bool,
    vol.Optional("media_player"): str,
    vol.Optional("volume", default=0.5): vol.Coerce(float),
}

UPDATE_SCHEMA = {
    vol.Optional("name"): str,
    vol.Optional("time"): str,
    vol.Optional("days"): [str],
    vol.Optional("enabled"): bool,
    vol.Optional("media_player"): str,
    vol.Optional("volume"): vol.Coerce(float),
}


class AlarmStorageCollection(collection.DictStorageCollection):
    """Manage Aurora alarm entries."""

    async def _process_create_data(self, data: dict) -> dict:
        return vol.Schema(CREATE_SCHEMA)(data)

    @callback
    def _get_suggested_id(self, info: dict) -> str:
        return info["name"]  # slugified + deduped by IDManager


# custom_components/aurora/__init__.py (relevant excerpt)
async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    id_manager = collection.IDManager()
    store = Store(
        hass,
        STORAGE_VERSION,
        STORAGE_KEY,
        minor_version=STORAGE_VERSION_MINOR,
        atomic_writes=True,          # safe atomic rename on write
        serialize_in_event_loop=True,  # default, stated explicitly for clarity
    )

    alarm_collection = AlarmStorageCollection(store, id_manager)
    await alarm_collection.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["alarms"] = alarm_collection

    # Wire up websocket CRUD + subscription automatically
    collection.DictStorageCollectionWebsocket(
        alarm_collection,
        api_prefix="aurora",          # → "aurora/list", "aurora/create", etc.
        model_name="aurora_alarm",
        create_schema=CREATE_SCHEMA,
        update_schema=UPDATE_SCHEMA,
        admin_only=False,             # allow non-admin users to manage their own alarms
    ).async_setup(hass)

    # Register domain services
    _register_services(hass, alarm_collection)
    return True
```

### 3.9 Alarmo / Scheduler Style — Dispatcher Pattern Alternative

Both Alarmo and the Scheduler component use a **custom coordinator + dispatcher** pattern rather than the collection helper:

```python
# Alarmo pattern: custom store methods
class AlarmoStore:
    async def async_create_area(self, data: dict) -> str: ...
    async def async_update_area(self, area_id: str, changes: dict) -> None: ...

# Dispatcher for cross-module change notification
dispatcher_send(hass, "alarmo_config_updated")
async_dispatcher_connect(hass, "alarmo_config_updated", self._handle_config_update)
```

**Trade-offs vs. collection helper:**

| | `DictStorageCollection` | Custom Store + Dispatcher |
|---|---|---|
| Lines of code | ~30 (+ schema) | ~300+ |
| Built-in WebSocket CRUD | Yes (free via `DictStorageCollectionWebsocket`) | Must write manually |
| Built-in subscription/push | Yes | Must write manually |
| Custom domain objects | Requires subclassing `StorageCollection` | Full control |
| Per-item business logic | Via overrides | Full control |
| When to choose | Standard alarm list CRUD | Complex state machines, cross-entity orchestration |

**Recommendation for Aurora:** Use `DictStorageCollection` for the alarm definition list. Aurora's alarms are config records (not stateful machines) — the collection helper eliminates ~300 lines of boilerplate WS handling. Use raw `Store` for the singleton global config blob.

---

## 4. Service Registration

**Sources:**
- `homeassistant/helpers/service.py`
- `homeassistant/core.py` (`ServiceRegistry.async_register`)
- https://developers.home-assistant.io/docs/dev_101_services/
- https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/action-exceptions/

### 4.1 Service Registration Methods

#### `hass.services.async_register` — General Services

```python
@callback
def async_register(
    self,
    domain: str,
    service: str,
    service_func: Callable[
        [ServiceCall],
        Coroutine[Any, Any, ServiceResponse | EntityServiceResponse]
        | ServiceResponse
        | EntityServiceResponse
        | None,
    ],
    schema: VolSchemaType | None = None,
    supports_response: SupportsResponse = SupportsResponse.NONE,
    job_type: HassJobType | None = None,
    *,
    description_placeholders: Mapping[str, str] | None = None,
) -> None:
```

#### `async_register_admin_service` — Admin-Only Services

```python
# from homeassistant.helpers.service
@callback
def async_register_admin_service(
    hass: HomeAssistant,
    domain: str,
    service: str,
    service_func: Callable[[ServiceCall], Coroutine | ServiceResponse | None],
    schema: VolSchemaType = vol.Schema({}, extra=vol.PREVENT_EXTRA),
    supports_response: SupportsResponse = SupportsResponse.NONE,
    *,
    description_placeholders: Mapping[str, str] | None = None,
) -> None:
    """Register a service that requires admin access."""
```

**Difference:** Wraps `service_func` with `_async_admin_handler`, which checks `call.context` user has `is_admin=True`. Raises `Unauthorized` otherwise. Use this for dangerous operations (factory reset, raw config import).

#### `async_register_platform_entity_service` — Entity Services

```python
@callback
def async_register_platform_entity_service(
    hass: HomeAssistant,
    service_domain: str,        # your domain
    service_name: str,          # service name
    *,
    entity_domain: str,         # target entity platform domain (e.g. "media_player")
    func: str | Callable[..., Any],  # method name on entity, or async callable
    schema: VolDictType | VolSchemaType | None,
    required_features: Iterable[int] | None = None,
    entity_device_classes: Iterable[str | None] | None = None,
    supports_response: SupportsResponse = SupportsResponse.NONE,
    description_placeholders: Mapping[str, str] | None = None,
) -> None:
```

Use this when a service targets specific entities (e.g. snooze an alarm entity).

### 4.2 `ServiceCall` Structure

```python
class ServiceCall:
    __slots__ = ("context", "data", "domain", "hass", "return_response", "service")

    hass: HomeAssistant
    domain: str
    service: str
    data: ReadOnlyDict[str, Any]   # validated, immutable
    context: Context
    return_response: bool          # True if caller expects a return value
```

### 4.3 `SupportsResponse` Enum

```python
class SupportsResponse(enum.StrEnum):
    NONE = "none"        # default — service returns nothing
    OPTIONAL = "optional"  # returns data only when caller sets return_response=True
    ONLY = "only"          # read-only service — ALWAYS returns data
```

Usage:
```python
async def async_get_alarm_status(call: ServiceCall) -> ServiceResponse:
    alarm_id = call.data["alarm_id"]
    alarm = hass.data[DOMAIN]["alarms"].data.get(alarm_id)
    if alarm is None:
        raise ServiceValidationError(f"Alarm {alarm_id} not found")
    return {"id": alarm_id, "next_trigger": alarm.get("next_trigger")}

hass.services.async_register(
    DOMAIN,
    "get_alarm_status",
    async_get_alarm_status,
    schema=vol.Schema({vol.Required("alarm_id"): str}),
    supports_response=SupportsResponse.ONLY,
)
```

### 4.4 `services.yaml` Schema

**Location:** `custom_components/aurora/services.yaml`  
**Format:** Only service names as top-level keys (no domain prefix):

```yaml
# services.yaml
set_alarm:
  fields:
    alarm_id:
      required: true
      selector:
        text: {}
    time:
      required: true
      example: "07:30"
      selector:
        time: {}
    days:
      required: false
      selector:
        select:
          multiple: true
          options:
            - value: "mon"
              label: "Monday"
            - value: "tue"
              label: "Tuesday"
            - value: "wed"
              label: "Wednesday"
            - value: "thu"
              label: "Thursday"
            - value: "fri"
              label: "Friday"
            - value: "sat"
              label: "Saturday"
            - value: "sun"
              label: "Sunday"
    volume:
      required: false
      default: 0.5
      selector:
        number:
          min: 0.0
          max: 1.0
          step: 0.05
          mode: slider

snooze_alarm:
  fields:
    alarm_id:
      required: true
      selector:
        text: {}
    duration:
      required: false
      default: 9
      selector:
        number:
          min: 1
          max: 60
          unit_of_measurement: min

get_alarm_status:
  # No fields needed — uses entity target
```

### 4.5 Exception Handling (IQS Gold Rule: `action-exceptions`)

**Rule:** Services must raise exceptions on failure, not return error codes.

```python
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

async def async_set_alarm(call: ServiceCall) -> None:
    alarm_id = call.data["alarm_id"]
    time_str = call.data["time"]

    # ServiceValidationError: wrong user input
    try:
        datetime.strptime(time_str, "%H:%M")
    except ValueError as err:
        raise ServiceValidationError(
            f"Invalid time format '{time_str}' — use HH:MM"
        ) from err

    alarm = hass.data[DOMAIN]["alarms"].data.get(alarm_id)
    if alarm is None:
        raise ServiceValidationError(f"Alarm '{alarm_id}' not found")

    # HomeAssistantError: integration/device failure
    try:
        await media_player.async_set_volume(call.data.get("volume", 0.5))
    except MyDeviceError as err:
        raise HomeAssistantError(
            f"Failed to configure media player for alarm: {err}"
        ) from err
```

### 4.6 Service Registration Location (IQS Rule: `action-setup`)

**Rule:** Register services in `async_setup`, not in `async_setup_entry` or platform setup.

```python
# custom_components/aurora/__init__.py
async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    # Register domain-level services here
    hass.services.async_register(DOMAIN, "set_alarm", ...)
    hass.services.async_register(DOMAIN, "snooze_alarm", ...)
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Register ENTITY services in setup_entry (bound to entities)
    component.async_register_entity_service("snooze", snooze_schema, "async_snooze")
    return True
```

---

## 5. Custom WebSocket API

**Sources:**
- `homeassistant/components/websocket_api/` (dev branch)
- https://developers.home-assistant.io/docs/frontend/extending/websocket-api/
- Reference: `homeassistant/components/config/device_registry.py`

### 5.1 Full Public API Surface

```python
from homeassistant.components import websocket_api

# All public symbols:
websocket_api.async_register_command(hass, handler)
websocket_api.websocket_command(schema)      # decorator
websocket_api.async_response                 # decorator
websocket_api.require_admin                  # decorator
websocket_api.ws_require_user(...)           # decorator factory
websocket_api.ActiveConnection
websocket_api.current_connection()
websocket_api.result_message(id, result)
websocket_api.error_message(id, code, message, ...)
websocket_api.event_message(id, event)
websocket_api.BASE_COMMAND_MESSAGE_SCHEMA

# Error constants (all str):
websocket_api.ERR_INVALID_FORMAT       # "invalid_format"
websocket_api.ERR_NOT_FOUND            # "not_found"
websocket_api.ERR_NOT_ALLOWED          # "not_allowed"
websocket_api.ERR_NOT_SUPPORTED        # "not_supported"
websocket_api.ERR_UNAUTHORIZED         # "unauthorized"
websocket_api.ERR_TIMEOUT              # "timeout"
websocket_api.ERR_UNKNOWN_ERROR        # "unknown_error"
websocket_api.ERR_UNKNOWN_COMMAND      # "unknown_command"
websocket_api.ERR_TEMPLATE_ERROR       # "template_error"
websocket_api.ERR_HOME_ASSISTANT_ERROR # "home_assistant_error"
websocket_api.ERR_SERVICE_VALIDATION_ERROR  # "service_validation_error"
```

### 5.2 Decorator Signatures

#### `@websocket_command(schema)` — Required

Attaches the command type string and schema. The `vol.Required("type")` value becomes the WS message type.

```python
@websocket_api.websocket_command({
    vol.Required("type"): "aurora/list",
    # optional additional fields:
    vol.Optional("filter"): str,
})
@callback
def ws_list_alarms(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None: ...
```

#### `@async_response` — For Async Handlers

Wraps an `async def` handler. Schedules it as an eager background task (non-blocking on the WS event loop).

```python
@websocket_api.websocket_command({vol.Required("type"): "aurora/create"})
@websocket_api.async_response
async def ws_create_alarm(hass, connection, msg): ...
```

#### `@require_admin` — Admin Guard

```python
@websocket_api.websocket_command({vol.Required("type"): "aurora/admin/reset"})
@websocket_api.require_admin
@callback
def ws_factory_reset(hass, connection, msg): ...
```

**Decorator order matters:** `@websocket_command` must be outermost, then `@require_admin`, then `@async_response` / `@callback`, then `async def` / `def`.

#### `ws_require_user` — Finer-Grained Auth

```python
@websocket_api.ws_require_user(only_active_user=True, allow_system_user=False)
```

### 5.3 `ActiveConnection` Methods

```python
class ActiveConnection:
    subscriptions: dict[Hashable, Callable[[], Any]]  # cleanup callbacks by msg id

    @callback
    def send_result(self, msg_id: int, result: Any | None = None) -> None:
        """Send a single success result. Use for request-response."""
        # Produces: {"id": msg_id, "type": "result", "success": true, "result": result}

    @callback
    def send_error(
        self,
        msg_id: int,
        code: str,
        message: str,
        translation_key: str | None = None,
        translation_domain: str | None = None,
        translation_placeholders: dict[str, Any] | None = None,
    ) -> None:
        """Send an error result."""
        # Produces: {"id": msg_id, "type": "result", "success": false, "error": {...}}

    def send_message(self, data: bytes | str | dict[str, Any]) -> None:
        """Send a raw message. Use for subscription events (multiple over time)."""
        # Produces: {"id": msg_id, "type": "event", "event": <data>}
        # (wrap data with event_message() first)

    def async_handle_exception(self, msg: dict, err: Exception) -> None:
        """Categorizes exception → ERR_* and calls send_error."""
```

**On connection close:** `async_handle_close()` calls each `subscriptions[key]()` in order. Individual failures don't block others.

### 5.4 Wire Protocol — Message Shapes

```json
// → Client sends (command):
{"id": 42, "type": "aurora/create", "name": "Morning", "time": "07:00", "days": ["mon"]}

// ← Server sends (success result):
{"id": 42, "type": "result", "success": true, "result": {"id": "morning_abc", "name": "Morning", ...}}

// ← Server sends (error result):
{"id": 42, "type": "result", "success": false, "error": {"code": "invalid_format", "message": "..."}}

// ← Server sends (subscription event — multiple over time):
{"id": 42, "type": "event", "event": {"type": "added", "item": {"id": "morning_abc", ...}}}
{"id": 42, "type": "event", "event": {"type": "updated", "item": {...}}}
{"id": 42, "type": "event", "event": {"type": "removed", "item_id": "morning_abc"}}
```

### 5.5 Subscription / Push Pattern

This is the idiomatic pattern for pushing collection changes to a connected Lovelace card:

```python
@websocket_api.websocket_command({
    vol.Required("type"): "aurora/subscribe_alarms",
})
@callback
def ws_subscribe_alarms(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Subscribe to alarm collection changes."""
    msg_id = msg["id"]
    alarm_collection: AlarmStorageCollection = hass.data[DOMAIN]["alarms"]

    # 1. Acknowledge subscription
    connection.send_result(msg_id)

    # 2. Send current state as "added" events
    for item in alarm_collection.async_items():
        connection.send_message(
            websocket_api.messages.message_to_json_bytes(
                websocket_api.event_message(msg_id, {
                    "type": CHANGE_ADDED,
                    "item": item,
                })
            )
        )

    # 3. Register change listener for future events
    @callback
    def forward_changes(change_set: Iterable[CollectionChange]) -> None:
        for change in change_set:
            connection.send_message(
                websocket_api.messages.message_to_json_bytes(
                    websocket_api.event_message(msg_id, {
                        "type": change.change_type,
                        "item": change.item,
                        "item_id": change.item_id,
                    })
                )
            )

    # 4. Store unsubscribe in connection.subscriptions for auto-cleanup
    connection.subscriptions[msg_id] = alarm_collection.async_add_change_set_listener(
        forward_changes
    )
```

> **Note:** If you use `DictStorageCollectionWebsocket`, the above is auto-generated via `_ws_subscribe`. The manual pattern is only needed for custom push semantics (e.g. next-trigger time updates).

### 5.6 Full WebSocket Command Registration Example

```python
# custom_components/aurora/websocket_api.py
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN
from .storage import AlarmStorageCollection


@websocket_api.websocket_command({
    vol.Required("type"): "aurora/get_next_triggers",
    vol.Optional("count", default=5): int,
})
@callback
def ws_get_next_triggers(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Return the next N alarm trigger times (sync — pure in-memory)."""
    alarm_collection: AlarmStorageCollection = hass.data[DOMAIN]["alarms"]
    triggers = _compute_next_triggers(alarm_collection.async_items(), msg["count"])
    connection.send_result(msg["id"], {"triggers": triggers})


@websocket_api.websocket_command({
    vol.Required("type"): "aurora/test_media",
    vol.Required("media_player_entity_id"): str,
    vol.Optional("volume", default=0.3): vol.Coerce(float),
})
@websocket_api.async_response
async def ws_test_media(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Test-play media (async — calls media player service)."""
    try:
        await hass.services.async_call(
            "media_player", "volume_set",
            {"entity_id": msg["media_player_entity_id"], "volume_level": msg["volume"]},
            blocking=True,
        )
    except HomeAssistantError as err:
        connection.send_error(msg["id"], websocket_api.ERR_HOME_ASSISTANT_ERROR, str(err))
        return
    connection.send_result(msg["id"], {"status": "playing"})


@websocket_api.websocket_command({
    vol.Required("type"): "aurora/admin/purge_history",
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_admin_purge_history(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Admin-only: purge alarm trigger history."""
    await hass.data[DOMAIN]["history_store"].async_remove()
    connection.send_result(msg["id"])


@callback
def async_setup_websocket_api(hass: HomeAssistant) -> None:
    """Register all custom Aurora websocket commands."""
    websocket_api.async_register_command(hass, ws_get_next_triggers)
    websocket_api.async_register_command(hass, ws_test_media)
    websocket_api.async_register_command(hass, ws_admin_purge_history)
    # DictStorageCollectionWebsocket handles: aurora/list, aurora/create,
    # aurora/update, aurora/delete, aurora/subscribe automatically.
```

### 5.7 Frontend (Lovelace Card) Contract

**Recommended card ↔ backend contract for alarm list:**

```typescript
// TypeScript / Lit card

// 1. Initial load + subscribe to changes
async subscribeAlarms(hass: HomeAssistant, callback: (alarms: Alarm[]) => void) {
  const alarms = new Map<string, Alarm>();

  return hass.connection.subscribeMessage(
    (event: { type: string; item?: Alarm; item_id?: string }) => {
      if (event.type === "added") alarms.set(event.item!.id, event.item!);
      if (event.type === "updated") alarms.set(event.item!.id, event.item!);
      if (event.type === "removed") alarms.delete(event.item_id!);
      callback([...alarms.values()]);
    },
    { type: "aurora/subscribe" }  // DictStorageCollectionWebsocket auto-generates this
  );
}

// 2. CRUD (optimistic: update local state, then confirm)
async createAlarm(hass: HomeAssistant, data: Partial<Alarm>) {
  return hass.callWS({ type: "aurora/create", ...data });
}

async updateAlarm(hass: HomeAssistant, id: string, data: Partial<Alarm>) {
  return hass.callWS({ type: "aurora/update", id, ...data });
}

async deleteAlarm(hass: HomeAssistant, id: string) {
  return hass.callWS({ type: "aurora/delete", id });
}

// 3. One-shot query for next triggers
async getNextTriggers(hass: HomeAssistant, count = 5) {
  return hass.callWS({ type: "aurora/get_next_triggers", count });
}
```

**Optimistic CRUD pattern for card:**
1. User clicks "Create alarm".
2. Card sends `aurora/create` WS message.
3. Card immediately shows skeleton/placeholder in UI.
4. Server broadcasts `aurora/subscribe` event with `type: "added"`.
5. Card replaces placeholder with real data.
6. On error: card shows toast / reverts.

---

## 6. IQS Gold Checklist — Storage/Services/WS Relevant Rules

| Rule ID | Requirement | Aurora Approach |
|---------|-------------|-----------------|
| `action-setup` | Services registered in `async_setup`, not `setup_entry` | Register domain services in `async_setup` |
| `action-exceptions` | Services raise `ServiceValidationError` / `HomeAssistantError` | See §4.5 examples |
| `test-before-configure` | No side effects during config flow setup | N/A for services |
| `appropriate-polling` | Don't poll if push available | WS subscriptions are push |
| `entity-translations` | All entity names translatable | Use `strings.json` |
| `diagnostics` | `async_get_config_entry_diagnostics` | Include alarm count, storage version |

---

## 7. Gotchas & Deprecations

1. **`serialize_in_event_loop` (2025.11):** Default flipped to `True`. Non-thread-safe `data_func` lambdas are now safe. If you had deliberately set `False` for perf, verify thread safety.

2. **`async_listen` deprecated in Labs (2026.3):** Affects Labs-only APIs, not standard WS subscription pattern.

3. **Services renamed "Actions" (2024.8):** In UI/docs, "service" is now "action". Python API names unchanged (`hass.services.async_register` still valid). `services.yaml` filename still used.

4. **Config entry listeners deprecated (2026.6):** `entry.async_on_unload` pattern for cleanup still valid; the deprecated form was listeners attached to reload hooks. Review PR notes before using `entry.add_update_listener`.

5. **Decorator order for WS commands:** Must be `@websocket_command` outermost, then auth decorators, then `@callback`/`@async_response`, then the function definition. Wrong order = runtime error.

6. **`DictStorageCollectionWebsocket` command naming:** The auto-generated commands are `{api_prefix}/list`, `{api_prefix}/create`, `{api_prefix}/update`, `{api_prefix}/delete`, `{api_prefix}/subscribe`. The item ID field key in update/delete is always `"id"` (from `item_id_key` property).

7. **Storage file location:** `.storage/{key}.json` relative to HA config dir. Key must be globally unique — use `"aurora.alarms"` not just `"alarms"`.

8. **`atomic_writes=True` recommendation:** Uses `write_utf8_file_atomic()` (temp file + rename). Prevents corruption on sudden HA crash/power loss. Always use for critical user data.

9. **Collection `SAVE_DELAY = 10s`:** After any CRUD operation, the file write is deferred 10 seconds. Don't assume the file is updated immediately. For UI, rely on the in-memory collection state, not re-reading the file.

10. **`_process_create_data` must validate thoroughly:** The WebSocket layer validates against `create_schema`, but `_process_create_data` is called inside the collection and is your last chance for domain-specific validation (e.g., conflicting alarm times).

---

## 8. Source URLs

- Storage helper (dev): https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/storage.py
- Collection helper (dev): https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/collection.py
- WebSocket API module: https://github.com/home-assistant/core/tree/dev/homeassistant/components/websocket_api
- WebSocket decorators: https://github.com/home-assistant/core/blob/dev/homeassistant/components/websocket_api/decorators.py
- WebSocket connection: https://github.com/home-assistant/core/blob/dev/homeassistant/components/websocket_api/connection.py
- Service helper: https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/service.py
- HA core (ServiceCall, SupportsResponse): https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/core.py
- Tag component (reference): https://github.com/home-assistant/core/blob/dev/homeassistant/components/tag/__init__.py
- Input boolean (reference): https://github.com/home-assistant/core/blob/dev/homeassistant/components/input_boolean/__init__.py
- Extending WS API (dev docs): https://developers.home-assistant.io/docs/frontend/extending/websocket-api/
- Services dev docs: https://developers.home-assistant.io/docs/dev_101_services/
- IQS action-exceptions rule: https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/action-exceptions/
- IQS overview: https://developers.home-assistant.io/docs/core/integration-quality-scale/
- Storage serialization change (2025.11): https://developers.home-assistant.io/blog/2025/11/25/storage-helper-opt-in-serialize-in-executor/
- HA 2026.3 release notes (Python 3.14): https://www.home-assistant.io/blog/2026/03/04/release-20263/
- HA 2026.6 release notes: https://www.home-assistant.io/blog/2026/06/03/release-20266/
- Alarmo integration: https://github.com/nielsfaber/alarmo
- Scheduler component: https://github.com/nielsfaber/scheduler-component
