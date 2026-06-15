# Aurora: Config Flow, Entries & Selectors — Implementation-Ready Research

**Prepared:** 2026-06-15  
**Target:** Home Assistant 2026.6 (current stable, released 2026-06-03)  
**Python:** 3.14.2+ (verified from `pyproject.toml` at tag `2026.6.0`: `requires-python = ">=3.14.2"`)  
**Minimum viable target:** HA 2025.7+ (subentries GA'd) — aim for 2026.6 as baseline.

Primary sources:
- https://developers.home-assistant.io/docs/creating_integration_manifest/
- https://developers.home-assistant.io/docs/config_entries_index/
- https://developers.home-assistant.io/docs/core/integration/config_flow/
- https://developers.home-assistant.io/docs/config_entries_options_flow_handler/
- https://raw.githubusercontent.com/home-assistant/core/2026.6.0/homeassistant/helpers/selector.py
- https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/config_entries.py
- https://developers.home-assistant.io/blog/2025/02/16/config-subentries/
- https://developers.home-assistant.io/blog/2025/03/24/config-subentry-flow-changes/
- https://developers.home-assistant.io/blog/2025/10/14/device-filter-removed-from-target-selector/

---

## 1. Platform / Python Version

| Item | Value |
|------|-------|
| Current stable HA | **2026.6.0** (released 2026-06-03) |
| Minimum Python (2026.6.0) | **3.14.2** (`requires-python = ">=3.14.2"` in pyproject.toml) |
| dev-branch python | 3.14.x (supports 3.13 + 3.14 classifiers) |
| Minimum HA to target | 2025.7 (subentries GA); recommend **2026.1** as floor |

> **Note:** Earlier search results showed `>=3.13.2` for the dev branch (which may support both Python versions), but the tagged release `2026.6.0` pyproject.toml shows `>=3.14.2`. Aurora should target Python 3.14.2+ since that is what ships with the current stable.

---

## 2. Full `manifest.json` Schema

### 2.1 Required fields

```json
{
  "domain": "aurora_alarm",
  "name": "Aurora Alarm",
  "codeowners": ["@yourghhandle"],
  "documentation": "https://github.com/you/aurora",
  "integration_type": "hub",
  "iot_class": "local_push",
  "requirements": []
}
```

### 2.2 All fields with notes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `domain` | string | YES | Characters + underscores only; must match directory name; globally unique |
| `name` | string | YES | User-facing integration name |
| `codeowners` | `string[]` | YES | GitHub usernames (`@user`) or team names (`@org/team`) |
| `documentation` | URL string | YES | Docs URL; for core: `https://www.home-assistant.io/integrations/<domain>` |
| `integration_type` | enum | YES (for config-flow integrations) | See values below |
| `iot_class` | enum | YES | See values below |
| `requirements` | `string[]` | YES (can be `[]`) | pip-compatible packages, e.g. `["aioaurora==1.0.0"]` |
| `version` | string | Custom only | OMIT for core; CalVer or SemVer, validated by AwesomeVersion |
| `config_flow` | boolean | — | `true` if integration has a config flow (requires `config_flow.py`) |
| `single_config_entry` | boolean | — | `true` to limit the integration to exactly one config entry |
| `after_dependencies` | `string[]` | — | Non-essential integrations to wait for if configured (installs requirements regardless) |
| `dependencies` | `string[]` | — | Essential integrations that MUST load successfully before this one |
| `quality_scale` | enum | — | `bronze`, `silver`, `gold`, `platinum` |
| `loggers` | `string[]` | — | Logger names from requirements' `getLogger` calls |
| `issue_tracker` | URL string | — | Omit for core; used for custom integrations' bug tracking |
| `bluetooth` | array | — | Bluetooth discovery matchers |
| `zeroconf` | array | — | Zeroconf/mDNS service types + optional property filters |
| `ssdp` | array | — | SSDP matchers |
| `homekit` | object | — | HomeKit model names |
| `mqtt` | `string[]` | — | MQTT discovery topics |
| `dhcp` | array | — | DHCP hostname/MAC matchers |
| `usb` | array | — | USB VID/PID matchers |

### 2.3 `integration_type` allowed values

| Value | Use case |
|-------|----------|
| `device` | Single device per config entry (e.g. ESPHome) |
| `entity` | Basic entity platform |
| `hardware` | Hardware integration (Raspberry Pi, etc.) |
| `helper` | Automation helpers (input_boolean, group) |
| `hub` | Gateway to multiple devices/services — **use this for Aurora** |
| `service` | Single external service per config entry (DuckDNS, AdGuard) |
| `system` | Reserved for system integrations |
| `virtual` | Points to another integration; uses `supported_by` or `iot_standards` |

### 2.4 `iot_class` allowed values

| Value | Meaning |
|-------|---------|
| `assumed_state` | State inferred from last command sent |
| `cloud_polling` | Cloud, may lag |
| `cloud_push` | Cloud, immediate notifications |
| `local_polling` | Local network, may lag |
| `local_push` | Local network, immediate — **suitable for Aurora** |
| `calculated` | No direct communication, calculated values |

### 2.5 Aurora recommended manifest

```json
{
  "domain": "aurora_alarm",
  "name": "Aurora",
  "codeowners": ["@yourghhandle"],
  "config_flow": true,
  "documentation": "https://github.com/you/aurora",
  "integration_type": "hub",
  "iot_class": "local_push",
  "quality_scale": "gold",
  "requirements": [],
  "version": "2026.6.0",
  "dependencies": ["http", "frontend", "websocket_api"],
  "after_dependencies": ["media_player", "input_boolean"]
}
```

> **`dependencies` on `http` / `frontend` / `websocket_api`**: List these in `dependencies` (not `after_dependencies`) if your integration registers HTTP views or Lovelace card resources at startup. This ensures the HTTP server and frontend subsystems are fully initialized first.

---

## 3. Config Entry Lifecycle

### 3.1 `ConfigEntry` dataclass (key fields)

Source: `homeassistant/config_entries.py` (dev branch, 2026.6.0 tag)

```python
class ConfigEntry[_DataT = Any]:
    """Hold a configuration entry."""
    
    entry_id: str           # Unique ID for this entry (ULID)
    version: int            # Major version (for migration)
    minor_version: int      # Minor version (backward-compatible changes)
    domain: str             # Integration domain
    title: str              # User-visible title
    data: MappingProxyType[str, Any]    # Persistent config data (stored to disk)
    options: MappingProxyType[str, Any] # Options data (stored to disk)
    unique_id: str | None   # Unique ID for de-duplication
    state: ConfigEntryState # Current lifecycle state
    runtime_data: _DataT    # Runtime-only data (NOT stored to disk)
```

`ConfigEntryState` enum values:
```python
class ConfigEntryState(Enum):
    LOADED           = "loaded",           True   # (value, recoverable)
    SETUP_ERROR      = "setup_error",      True
    MIGRATION_ERROR  = "migration_error",  False
    SETUP_RETRY      = "setup_retry",      True
    NOT_LOADED       = "not_loaded",       True
    FAILED_UNLOAD    = "failed_unload",    False
    SETUP_IN_PROGRESS    = "setup_in_progress",    False
    UNLOAD_IN_PROGRESS   = "unload_in_progress",   False
```

### 3.2 `ConfigEntry.runtime_data` — typed pattern (REQUIRED for Gold/Platinum)

The `runtime_data` attribute stores runtime-only objects (API clients, coordinators, etc.) that are NOT serialized to disk. Use a typed alias for full type safety.

**`const.py`** (or `__init__.py`):
```python
from homeassistant.config_entries import ConfigEntry
from .coordinator import AuroraCoordinator

# Type alias — this is the typed ConfigEntry used throughout the integration
type AuroraConfigEntry = ConfigEntry[AuroraCoordinator]
```

**`__init__.py`**:
```python
from homeassistant.core import HomeAssistant
from .const import AuroraConfigEntry, PLATFORMS
from .coordinator import AuroraCoordinator

async def async_setup_entry(
    hass: HomeAssistant,
    entry: AuroraConfigEntry,
) -> bool:
    """Set up Aurora from a config entry."""
    coordinator = AuroraCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    
    # Store coordinator in runtime_data (not in hass.data!)
    entry.runtime_data = coordinator
    
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True
```

**Platform file (e.g. `sensor.py`)**:
```python
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from .const import AuroraConfigEntry

async def async_setup_entry(
    hass: HomeAssistant,
    entry: AuroraConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = entry.runtime_data  # Fully typed as AuroraCoordinator
    async_add_entities([AuroraSensor(coordinator)])
```

> **Important:** If the integration implements `strict-typing`, use of `AuroraConfigEntry` everywhere is **required**. The old pattern `hass.data[DOMAIN][entry.entry_id]` is deprecated at Gold/Platinum tier.

### 3.3 `async_setup_entry`

```python
async def async_setup_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    """Set up Aurora alarm from a config entry."""
    # Called at startup for each entry AND when a new entry is created at runtime
    ...
    return True
```

### 3.4 `async_unload_entry`

```python
async def async_unload_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    """Unload a config entry."""
    # entry.state is ConfigEntryState.UNLOAD_IN_PROGRESS at this point
    # Must forward unloading to all platforms
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
```

### 3.5 `async_remove_entry`

```python
async def async_remove_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> None:
    """Handle removal of an entry — called AFTER entry is removed from hass.config_entries."""
    # Clean up cloud resources, revoke tokens, delete files, etc.
```

### 3.6 `async_reload_entry` (optional)

HA provides a default implementation. You only need to override it for custom reload logic:

```python
async def async_reload_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> None:
    """Reload config entry."""
    await async_unload_entry(hass, entry)
    await async_setup_entry(hass, entry)
```

---

## 4. ConfigFlow — Full Implementation

### 4.1 Basic structure

```python
# config_flow.py
from __future__ import annotations
from typing import Any
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.core import callback
from .const import DOMAIN

class AuroraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the Aurora config flow."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        
        if user_input is not None:
            # Validate and create entry
            return self.async_create_entry(
                title=user_input["name"],
                data=user_input,
            )
        
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("name"): str,
            }),
            errors=errors,
        )
```

### 4.2 Version migration — `async_migrate_entry`

Place in `__init__.py`. Called automatically when a stored entry's version doesn't match the flow's `VERSION`/`MINOR_VERSION`.

**Rules:**
- Major version bump (e.g. 1→2): `async_migrate_entry` is REQUIRED. If not implemented and user has old entry, setup fails.
- Minor version bump (e.g. 1.1→1.2): Backward-compatible; HA allows setup to continue even if `async_migrate_entry` is not implemented. But implement it anyway for correctness.

```python
# __init__.py
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

async def async_migrate_entry(hass: HomeAssistant, config_entry: ConfigEntry) -> bool:
    """Migrate old entry to current version."""
    _LOGGER.debug(
        "Migrating config from version %s.%s",
        config_entry.version,
        config_entry.minor_version,
    )

    if config_entry.version > 2:
        # Downgrade scenario — cannot migrate forward
        _LOGGER.error("Cannot migrate from version %s", config_entry.version)
        return False

    if config_entry.version == 1:
        new_data = {**config_entry.data}
        
        if config_entry.minor_version < 2:
            # 1.1 → 1.2: added "volume" field with default
            new_data.setdefault("volume", 50)
        
        if config_entry.minor_version < 3:
            # 1.2 → 1.3: renamed "alarm_time" to "wake_time"
            if "alarm_time" in new_data:
                new_data["wake_time"] = new_data.pop("alarm_time")
        
        hass.config_entries.async_update_entry(
            config_entry, data=new_data, minor_version=3, version=1
        )

    if config_entry.version == 1 and config_entry.minor_version >= 3:
        # Migrate major version 1 → 2
        new_data = {**config_entry.data}
        # ... major transformations ...
        hass.config_entries.async_update_entry(
            config_entry, data=new_data, version=2, minor_version=1
        )

    _LOGGER.debug(
        "Migration to version %s.%s successful",
        config_entry.version,
        config_entry.minor_version,
    )
    return True
```

---

## 5. OptionsFlow

### 5.1 Standard pattern

```python
# config_flow.py (continued in the same file)
from homeassistant.config_entries import OptionsFlow, OptionsFlowWithReload

class AuroraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    # ...
    
    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> AuroraOptionsFlow:
        """Create the options flow."""
        return AuroraOptionsFlow()


class AuroraOptionsFlow(OptionsFlowWithReload):
    """Aurora options flow.
    
    Use OptionsFlowWithReload (not bare OptionsFlow) to automatically reload
    the integration when options change — avoids manual update listener setup.
    """

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage Aurora options."""
        if user_input is not None:
            return self.async_create_entry(data=user_input)

        OPTIONS_SCHEMA = vol.Schema({
            vol.Optional("snooze_minutes", default=9): vol.All(
                vol.Coerce(int), vol.Range(min=1, max=60)
            ),
            vol.Optional("volume", default=80): vol.All(
                vol.Coerce(int), vol.Range(min=0, max=100)
            ),
        })

        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                OPTIONS_SCHEMA,
                self.config_entry.options,  # Pre-fill with existing values
            ),
        )
```

> **Deprecation note (2026.6):** Setting `config_entry` explicitly in options flow is deprecated (since ~2025.12). Use `self.config_entry` via the inherited property from `OptionsFlow`. Also, the pattern of manually registering an `add_update_listener` for reloading is superseded by `OptionsFlowWithReload`.

---

## 6. Reconfigure Flow

Allows users to change setup data (e.g. hostname, credentials) without removing and re-adding the entry. Not for options (use OptionsFlow) and not for auth failures (use reauth).

```python
class AuroraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle reconfiguration."""
        if user_input is not None:
            # If using unique_id, verify it matches the existing entry:
            # await self.async_set_unique_id(new_unique_id)
            # self._abort_if_unique_id_mismatch()
            return self.async_update_reload_and_abort(
                self._get_reconfigure_entry(),
                data_updates=user_input,
            )
        
        # Pre-fill form with current data
        current_entry = self._get_reconfigure_entry()
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self.add_suggested_values_to_schema(
                vol.Schema({vol.Required("name"): str}),
                current_entry.data,
            ),
        )
```

Key helpers:
- `self._get_reconfigure_entry()` — returns the `ConfigEntry` being reconfigured
- `self.async_update_reload_and_abort(entry, data_updates=...)` — updates + reloads + aborts flow
- `self._abort_if_unique_id_mismatch()` — prevents user from changing to a different device

Check if in reconfigure flow: `if self.source == SOURCE_RECONFIGURE`

---

## 7. Config Entry SUBENTRIES

### 7.1 What are subentries?

Introduced as GA in 2025.7 (design discussion: [architecture#1070](https://github.com/home-assistant/architecture/discussions/1070)).

Subentries are owned by a config entry. They allow logically separate configuration under a single auth/connection config entry. Examples:
- **Weather integration**: one config entry holds API credentials; each city is a subentry
- **OpenAI** (migrated in 2025.7): one main entry, each assistant/agent is a subentry
- **MQTT**: one broker connection; each virtual device is a subentry

**Data hierarchy:** Integration → Config Entry → Config Subentry (new layer) → Device/Entity

### 7.2 `ConfigSubentry` dataclass

```python
@dataclass(frozen=True, kw_only=True)
class ConfigSubentry:
    """Container for a configuration subentry."""
    data: MappingProxyType[str, Any]         # The subentry's stored data
    subentry_id: str = field(default_factory=ulid_util.ulid_now)  # Auto-generated ULID
    subentry_type: str                        # Developer-defined type string (e.g. "alarm")
    title: str                                # User-visible title
    unique_id: str | None                     # Optional; only unique within parent entry
```

Note: `ConfigSubentry` is immutable (frozen dataclass). Never mutate directly; use `async_update_entry`.

### 7.3 Declaring subentry support in ConfigFlow

```python
from homeassistant.config_entries import (
    ConfigFlow,
    ConfigSubentryFlow,
    SubentryFlowResult,
    ConfigEntry,
)
from homeassistant.core import callback

class AuroraConfigFlow(ConfigFlow, domain=DOMAIN):
    """Main config flow."""

    @classmethod
    @callback
    def async_get_supported_subentry_types(
        cls, config_entry: ConfigEntry
    ) -> dict[str, type[ConfigSubentryFlow]]:
        """Return subentry types this integration supports.
        
        Keys are subentry_type strings; values are the flow handler classes.
        """
        return {
            "alarm": AuroraAlarmSubentryFlowHandler,
        }
```

### 7.4 Implementing `ConfigSubentryFlow`

```python
from homeassistant.config_entries import ConfigSubentryFlow, SubentryFlowResult
from typing import Any
import voluptuous as vol

ALARM_SCHEMA = vol.Schema({
    vol.Required("name"): str,
    vol.Required("wake_time"): str,  # HH:MM string; use TimeSelector
    vol.Optional("enabled", default=True): bool,
})

class AuroraAlarmSubentryFlowHandler(ConfigSubentryFlow):
    """Handle subentry flow for adding and modifying an alarm."""

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        """Flow to add a new alarm subentry."""
        errors: dict[str, str] = {}

        if user_input is not None:
            # Optionally set a unique_id (unique within the parent entry)
            await self.async_set_unique_id(user_input["name"].lower())
            self._abort_if_unique_id_configured()
            
            return self.async_create_entry(
                title=user_input["name"],
                data=user_input,
            )

        # Access parent config entry data if needed:
        # parent_entry = self._get_entry()
        
        return self.async_show_form(
            step_id="user",
            data_schema=ALARM_SCHEMA,
            errors=errors,
        )

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        """Flow to modify an existing alarm subentry."""
        current_subentry = self._get_reconfigure_subentry()
        
        if user_input is not None:
            return self.async_update_and_abort(
                self._get_entry(),
                self._get_reconfigure_subentry(),
                data=user_input,
                title=user_input["name"],
            )
        
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self.add_suggested_values_to_schema(
                ALARM_SCHEMA, current_subentry.data
            ),
        )
```

### 7.5 API changes (March 2025 — PR #141017)

Attribute and method names were renamed. Use the new names:

| Old (pre-2025.4) | New (current) |
|------------------|---------------|
| `self._reconfigure_entry_id` | `self._entry_id` |
| `self._get_reconfigure_entry()` | `self._get_entry()` |

`self._get_reconfigure_subentry()` remains the method to get the subentry being reconfigured.

### 7.6 Setting up subentries in `async_setup_entry`

```python
async def async_setup_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    """Set up Aurora."""
    coordinator = AuroraCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator

    # Register entities/devices from the main entry's subentries
    for subentry_id, subentry in entry.subentries.items():
        if subentry.subentry_type == "alarm":
            coordinator.register_alarm(subentry)
    
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True
```

Subentries are available as `entry.subentries: dict[str, ConfigSubentry]`.

### 7.7 Subentry translations (`strings.json`)

```json
{
  "config_subentries": {
    "alarm": {
      "title": "Aurora Alarm",
      "step": {
        "user": {
          "title": "Add alarm",
          "description": "Configure a new alarm.",
          "data": {
            "name": "Alarm name",
            "wake_time": "Wake time",
            "enabled": "Enabled"
          }
        },
        "reconfigure": {
          "title": "Update alarm",
          "description": "Modify this alarm's settings."
        }
      },
      "error": {
        "already_configured": "An alarm with this name already exists."
      },
      "abort": {
        "already_configured": "Alarm already configured."
      }
    }
  }
}
```

### 7.8 Fitness assessment for Aurora

Aurora needs to model **multiple alarms** (possibly per-user):

**Verdict: Subentries are the correct fit.**

- One main config entry: Aurora integration settings, global options
- One subentry per alarm: `subentry_type="alarm"`, stores wake_time, days, sound, media player, etc.
- Optional: one subentry per user profile (`subentry_type="user_profile"`)

Benefits vs alternatives:
- vs. `hass.data[DOMAIN]` lists: subentries are first-class, UI-managed, persistent
- vs. multiple config entries: subentries share the parent entry's connection/auth context
- vs. options flow lists: subentries get individual UI management (add/remove/reconfigure per item)
- Each subentry can independently be disabled/enabled/deleted from the UI

---

## 8. Optional Fields — The Known Issue & Exact Pattern

### 8.1 The problem

When a user clears an optional field backed by an `EntitySelector` (or other selector), the frontend submits an empty string `""`. If voluptuous expects a valid entity_id, validation fails with a red error.

Additionally: `vol.Optional("field", default=some_value)` will **revert** the field to `some_value` if left empty — the user cannot actually clear it.

### 8.2 The correct pattern: `suggested_value`

**Use `description={"suggested_value": ...}` instead of `default=`.**

```python
# WRONG — user cannot clear the field; default prevents empty submission
vol.Optional("media_player", default="media_player.bedroom"): selector.EntitySelector(...)

# CORRECT — pre-fills the form but allows the user to leave it empty
vol.Optional(
    "media_player",
    description={"suggested_value": current_options.get("media_player")}
): selector.EntitySelector(
    selector.EntitySelectorConfig(domain="media_player")
)
```

**Key distinction:**
- `default=x`: pre-fills AND acts as fallback when field is empty (user cannot clear)
- `suggested_value=x`: pre-fills the UI only; submits as empty/missing if user clears it

### 8.3 Using `add_suggested_values_to_schema()`

This helper method (available on flow handlers) applies suggested values to a static schema:

```python
SCHEMA = vol.Schema({
    vol.Required("name"): str,
    vol.Optional("media_player"): selector.EntitySelector(
        selector.EntitySelectorConfig(domain="media_player")
    ),
    vol.Optional("light_entity"): selector.EntitySelector(
        selector.EntitySelectorConfig(domain="light")
    ),
})

return self.async_show_form(
    step_id="init",
    data_schema=self.add_suggested_values_to_schema(
        SCHEMA,
        self.config_entry.options,  # existing options become suggested values
    ),
)
```

### 8.4 Stripping empty keys from `user_input`

When the user clears an optional field, `user_input` may contain `""` (empty string) or `None`. Strip these before saving:

```python
async def async_step_init(
    self, user_input: dict[str, Any] | None = None
) -> ConfigFlowResult:
    if user_input is not None:
        # Strip falsy optional values so they don't get stored as empty strings
        cleaned = {k: v for k, v in user_input.items() if v not in ("", None)}
        return self.async_create_entry(data=cleaned)
    ...
```

Or use a voluptuous transformer:
```python
import voluptuous as vol

def remove_empty_strings(value: dict) -> dict:
    return {k: v for k, v in value.items() if v != ""}

SCHEMA = vol.Schema(vol.All(
    {
        vol.Required("name"): str,
        vol.Optional("extra"): str,
    },
    remove_empty_strings,
))
```

### 8.5 `vol.Optional` with `| None` type hint for selectors

For EntitySelector and similar, explicitly allow `None`:

```python
vol.Optional("backup_media_player"): vol.Any(
    None, selector.EntitySelector(selector.EntitySelectorConfig(domain="media_player"))
)
```

Or validate with:
```python
vol.Optional("backup_media_player"): vol.Any(None, cv.entity_id)
```

### 8.6 Known frontend bug (2026.1 era, fixed in PR #29790)

Optional entity selectors with `default: []` or `default: none` in blueprints showed a red "Unknown entity selected" warning even when correctly left empty. This was a **display-only** bug fixed in PR #29790. For config flows (not blueprints), using `suggested_value` instead of `default` avoids the issue entirely.

---

## 9. Form Sections (Collapsible Groups)

Introduced to reduce visual complexity for flows with many fields.

```python
from homeassistant.data_entry_flow import section
import voluptuous as vol

DATA_SCHEMA = vol.Schema({
    vol.Required("name"): str,
    vol.Required("wake_time"): selector.TimeSelector(),
    
    # Collapsible section for advanced options
    vol.Required("advanced"): section(
        vol.Schema({
            vol.Optional("volume", default=80): selector.NumberSelector(
                selector.NumberSelectorConfig(min=0, max=100, mode="slider")
            ),
            vol.Optional("fade_in_minutes", default=0): selector.NumberSelector(
                selector.NumberSelectorConfig(min=0, max=30, mode="box")
            ),
            vol.Optional("snooze_count", default=3): selector.NumberSelector(
                selector.NumberSelectorConfig(min=0, max=10, mode="box")
            ),
        }),
        {"collapsed": True},  # Start collapsed (False = start expanded)
    ),
})
```

**Constraints:**
- Only **one level** of nesting: sections cannot contain sections
- User input from sections arrives **nested**: `{"advanced": {"volume": 80, "fade_in_minutes": 5}}`
- Section names are translated in `strings.json` under `"sections"`

**Translation structure:**
```json
{
  "config": {
    "step": {
      "user": {
        "data": {
          "name": "Alarm name",
          "wake_time": "Wake time"
        },
        "sections": {
          "advanced": "Advanced settings"
        }
      }
    }
  }
}
```

**Icon for section** (in `icons.json`):
```json
{
  "config": {
    "step": {
      "user": {
        "sections": {
          "advanced": "mdi:cog"
        }
      }
    }
  }
}
```

---

## 10. Menu Steps

Use `async_show_menu` for branching flows (e.g., choose between manual setup and discovery).

```python
async def async_step_user(
    self, user_input: dict[str, Any] | None = None
) -> ConfigFlowResult:
    return self.async_show_menu(
        step_id="user",
        menu_options=["manual", "import_yaml"],
        description_placeholders={"name": "Aurora"},
    )

async def async_step_manual(
    self, user_input: dict[str, Any] | None = None
) -> ConfigFlowResult:
    # Manual setup flow
    ...

async def async_step_import_yaml(
    self, user_input: dict[str, Any] | None = None
) -> ConfigFlowResult:
    # YAML import flow
    ...
```

**Translation (`strings.json`):**
```json
{
  "config": {
    "step": {
      "user": {
        "menu_options": {
          "manual": "Set up manually",
          "import_yaml": "Import from YAML ({name})"
        },
        "menu_option_descriptions": {
          "manual": "Configure Aurora settings step by step.",
          "import_yaml": "Import existing YAML configuration."
        }
      }
    }
  }
}
```

Add `sort=True` to `async_show_menu(...)` to alphabetically sort options by translated label.

---

## 11. Selectors — Full Reference

Source: `homeassistant/helpers/selector.py` (2026.6.0)

Import pattern:
```python
from homeassistant.helpers import selector
# or
from homeassistant.helpers.selector import (
    EntitySelector, EntitySelectorConfig,
    EntityFilterSelectorConfig,
    SelectSelector, SelectSelectorConfig, SelectSelectorMode, SelectOptionDict,
    NumberSelector, NumberSelectorConfig, NumberSelectorMode,
    TextSelector, TextSelectorConfig, TextSelectorType,
    TimeSelector, TimeSelectorConfig,
    BooleanSelector, BooleanSelectorConfig,
    ColorRGBSelector, ColorRGBSelectorConfig,
    DeviceSelector, DeviceSelectorConfig,
    DeviceFilterSelectorConfig,
    DurationSelector, DurationSelectorConfig,
)
```

### 11.1 EntitySelector

```python
class EntitySelectorConfig(BaseSelectorConfig, total=False):
    exclude_entities: list[str]          # Entity IDs to exclude
    include_entities: list[str]          # Whitelist of entity IDs
    multiple: bool                        # Allow multi-select
    reorder: bool                         # Allow drag reordering
    filter: EntityFilterSelectorConfig | list[EntityFilterSelectorConfig]

class EntityFilterSelectorConfig(TypedDict, total=False):
    integration: str                      # Filter by integration (e.g. "media_player")
    domain: str | list[str]              # Filter by domain(s)
    device_class: str | list[str]        # Filter by device class(es)
    supported_features: list[str]        # Filter by supported features
    unit_of_measurement: str | list[str] # Filter by unit(s)
```

**Examples:**
```python
# Single media player selector
selector.EntitySelector(
    selector.EntitySelectorConfig(domain="media_player")
)

# Multiple sensors, filtered to temperature
selector.EntitySelector(
    selector.EntitySelectorConfig(
        filter=selector.EntityFilterSelectorConfig(
            domain="sensor",
            device_class="temperature",
        ),
        multiple=True,
    )
)

# Filter with multiple domains
selector.EntitySelector(
    selector.EntitySelectorConfig(
        filter=[
            selector.EntityFilterSelectorConfig(domain="light"),
            selector.EntityFilterSelectorConfig(domain="switch"),
        ],
        multiple=True,
    )
)

# Read-only display (no edit)
selector.EntitySelector(
    selector.EntitySelectorConfig(read_only=True)
)
```

> **Device filter change (2026.11 warning, already enforced):** The `device` filter option was removed from `TargetSelector`. Entity selectors retain full filtering. Source: [developer blog 2025-10-14](https://developers.home-assistant.io/blog/2025/10/14/device-filter-removed-from-target-selector/).

### 11.2 DeviceSelector

```python
class DeviceSelectorConfig(BaseSelectorConfig, total=False):
    entity: EntityFilterSelectorConfig | list[EntityFilterSelectorConfig]
    multiple: bool
    filter: DeviceFilterSelectorConfig | list[DeviceFilterSelectorConfig]

class DeviceFilterSelectorConfig(TypedDict, total=False):
    integration: str     # Filter by integration
    manufacturer: str    # Filter by manufacturer
    model: str           # Filter by model
    model_id: str        # Filter by model ID
```

### 11.3 SelectSelector

```python
class SelectOptionDict(TypedDict):
    value: str           # The stored value
    label: str           # The displayed label

class SelectSelectorMode(StrEnum):
    LIST     = "list"      # Radio-button style list
    DROPDOWN = "dropdown"  # Dropdown menu

class SelectSelectorConfig(BaseSelectorConfig, total=False):
    options: Sequence[SelectOptionDict] | Sequence[str]  # REQUIRED
    multiple: bool          # Allow multi-select (default: False)
    custom_value: bool      # Allow arbitrary user input (default: False)
    mode: SelectSelectorMode
    translation_key: str    # Key for translating option labels from strings.json
    sort: bool              # Sort options alphabetically (default: False)
```

**Examples:**
```python
# Simple string options
selector.SelectSelector(
    selector.SelectSelectorConfig(
        options=["gentle", "normal", "loud"],
        mode=selector.SelectSelectorMode.DROPDOWN,
    )
)

# Options with labels (using translation_key recommended for i18n)
selector.SelectSelector(
    selector.SelectSelectorConfig(
        options=[
            selector.SelectOptionDict(value="workday", label="Workday"),
            selector.SelectOptionDict(value="weekend", label="Weekend"),
            selector.SelectOptionDict(value="daily", label="Every day"),
        ],
        translation_key="alarm_schedule",
    )
)
```

### 11.4 NumberSelector

```python
class NumberSelectorMode(StrEnum):
    BOX    = "box"     # Text input box
    SLIDER = "slider"  # Slider control

class NumberSelectorConfig(BaseSelectorConfig, total=False):
    min: float
    max: float
    step: float | Literal["any"]   # Default: 1
    unit_of_measurement: str
    mode: NumberSelectorMode
    translation_key: str
```

**Example:**
```python
selector.NumberSelector(
    selector.NumberSelectorConfig(
        min=0,
        max=100,
        step=1,
        unit_of_measurement="%",
        mode=selector.NumberSelectorMode.SLIDER,
    )
)
```

### 11.5 TextSelector

```python
class TextSelectorType(StrEnum):
    COLOR          = "color"
    DATE           = "date"
    DATETIME_LOCAL = "datetime-local"
    EMAIL          = "email"
    MONTH          = "month"
    NUMBER         = "number"
    PASSWORD       = "password"
    SEARCH         = "search"
    TEL            = "tel"
    TEXT           = "text"
    TIME           = "time"
    URL            = "url"
    WEEK           = "week"

class TextSelectorConfig(BaseSelectorConfig, total=False):
    multiline: bool        # Multi-line textarea (default: False)
    prefix: str            # Prefix label
    suffix: str            # Suffix label
    type: TextSelectorType # HTML input type
    autocomplete: str      # HTML autocomplete attribute
    multiple: bool         # Allow multiple values (default: False)
```

**Example:**
```python
selector.TextSelector(
    selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)
)
```

### 11.6 TimeSelector

```python
class TimeSelectorConfig(BaseSelectorConfig):
    pass  # No additional fields — renders a time picker (HH:MM:SS)
```

```python
vol.Required("wake_time"): selector.TimeSelector()
# Returns string like "07:30:00"
```

### 11.7 DurationSelector

```python
class DurationSelectorConfig(BaseSelectorConfig, total=False):
    enable_day: bool          # Show day field
    enable_second: bool       # Show seconds field (default: True)
    enable_millisecond: bool  # Show millisecond field
    allow_negative: bool      # Allow negative durations
```

### 11.8 BooleanSelector

```python
class BooleanSelectorConfig(BaseSelectorConfig):
    pass  # No additional fields — renders a toggle switch
```

```python
vol.Optional("enabled", default=True): selector.BooleanSelector()
```

### 11.9 ColorRGBSelector

```python
class ColorRGBSelectorConfig(BaseSelectorConfig):
    pass  # No additional fields — renders color picker; returns [R, G, B] list
```

```python
vol.Optional("light_color", default=[255, 200, 100]): selector.ColorRGBSelector()
# Returns list: [255, 200, 100]
```

### 11.10 BaseSelectorConfig (all selectors inherit)

```python
class BaseSelectorConfig(TypedDict, total=False):
    read_only: bool  # Render as read-only display (no interaction)
```

---

## 12. Integration Quality Scale

Targeting **Gold** (required for "Works with Home Assistant" program); **Platinum** where reasonable.

### Bronze (minimum for any new integration)
- Config flow setup via UI
- Basic coding standards + dev guidelines
- Automated tests for config flow
- Basic end-user documentation

### Silver (all Bronze +)
- Active code owners
- Auto-recovers from connection errors (no excessive logging)
- Triggers re-authentication automatically on auth failure
- Troubleshooting docs

### Gold (all Silver +) — Aurora target
- Streamlined, intuitive user experience
- Automatic discovery (where applicable)
- Reconfigure flow implemented
- Translations (strings.json)
- Full automated test coverage
- Extensive docs for non-technical users
- `runtime_data` typed pattern used
- `OptionsFlowWithReload` used

### Platinum (all Gold +) — stretch goal
- Full type annotations + `strict-typing` enabled
- Fully async codebase
- Efficient data handling (minimized network/CPU)

Set in manifest: `"quality_scale": "gold"` (or `"platinum"`).

---

## 13. SchemaConfigFlowHandler — Simplified Flows

For simple helper-like integrations where all config goes into `options`:

```python
from homeassistant.helpers.schema_config_entry_flow import (
    SchemaCommonFlowHandler,
    SchemaConfigFlowHandler,
    SchemaFlowError,
    SchemaFlowFormStep,
    SchemaFlowMenuStep,
)

CONFIG_FLOW = {
    "user": SchemaFlowFormStep(
        schema=DATA_SCHEMA_SETUP,
        next_step="options",
    ),
    "options": SchemaFlowFormStep(
        schema=DATA_SCHEMA_OPTIONS,
        validate_user_input=validate_options,
    ),
}

OPTIONS_FLOW = {
    "init": SchemaFlowFormStep(
        DATA_SCHEMA_OPTIONS,
        validate_user_input=validate_options,
    ),
}

class AuroraFlowHandler(SchemaConfigFlowHandler, domain=DOMAIN):
    config_flow = CONFIG_FLOW
    options_flow = OPTIONS_FLOW
    options_flow_reloads = True

    def async_config_entry_title(self, options: Mapping[str, Any]) -> str:
        return cast(str, options[CONF_NAME])
```

**Limitation:** All data stored in `entry.options`, not `entry.data`. Not suitable if you need to separate auth credentials (in `data`) from user-configurable options (in `options`).

---

## 14. `strings.json` Structure Reference

```json
{
  "title": "Aurora",
  "config": {
    "flow_title": "{name}",
    "step": {
      "user": {
        "title": "Set up Aurora",
        "description": "Configure your Aurora alarm system.",
        "data": {
          "name": "Name"
        },
        "data_description": {
          "name": "A name for this Aurora instance."
        },
        "sections": {
          "advanced": "Advanced settings"
        }
      }
    },
    "error": {
      "cannot_connect": "[%key:common::config_flow::error::cannot_connect%]",
      "invalid_auth": "[%key:common::config_flow::error::invalid_auth%]"
    },
    "abort": {
      "already_configured": "[%key:common::config_flow::abort::already_configured_device%]",
      "reauth_successful": "[%key:common::config_flow::abort::reauth_successful%]"
    }
  },
  "options": {
    "step": {
      "init": {
        "title": "Aurora options",
        "data": {
          "volume": "Default volume",
          "snooze_minutes": "Snooze duration"
        }
      }
    }
  },
  "config_subentries": {
    "alarm": {
      "title": "Aurora Alarm",
      "step": {
        "user": {
          "title": "Add alarm",
          "data": {
            "name": "Alarm name",
            "wake_time": "Wake time"
          }
        },
        "reconfigure": {
          "title": "Update alarm"
        }
      },
      "abort": {
        "already_configured": "An alarm with this name already exists."
      }
    }
  }
}
```

---

## 15. Key Gotchas & Deprecations (2025–2026)

1. **`ConfigEntry.runtime_data` is required at Gold+**: Never use `hass.data[DOMAIN][entry.entry_id]` for Gold/Platinum integrations.

2. **`OptionsFlowWithReload` replaces manual `add_update_listener`**: The old pattern of registering a listener to reload on options change is deprecated. Use `OptionsFlowWithReload`.

3. **Setting `config_entry` in OptionsFlow directly is deprecated**: Deprecated since ~2025.12. Use `self.config_entry` (inherited property).

4. **Device filter removed from TargetSelector**: `TargetSelector` no longer accepts device filters. `EntitySelector` with `filter` still fully supported. Breaking enforcement in HA 2026.11.

5. **`suggested_value` vs `default` is critical for optional fields**: Using `default` prevents the user from clearing an optional field. Always use `description={"suggested_value": ...}` for fields that should be clearable.

6. **`ConfigSubentryFlow.reconfigure_entry_id` → `_entry_id`** and **`_get_reconfigure_entry()` → `_get_entry()`**: Changed in PR #141017 (2025). Any code using old names will break.

7. **Sections cannot be nested**: Only one level of `section()` is allowed in a form schema.

8. **`VERSION` and `MINOR_VERSION` both default to 1**: Only set them in your ConfigFlow class when you actually need migration. Bumping `MINOR_VERSION` only (same `VERSION`) is backward-compatible; bumping `VERSION` requires `async_migrate_entry`.

9. **`config_flow: true` in manifest requires `config_flow.py`**: Without the file, HA will error. Run `python3 -m script.hassfest` after adding.

10. **`single_config_entry: true`**: Use this if Aurora should only be configured once per HA instance (no multi-hub scenario). For Aurora with multiple alarms per user, use subentries instead of multiple config entries.

11. **Advanced mode removal (2026.6)**: "Advanced mode" toggles in data entry flows are being phased out in 2026.6. Do not add new `advanced_mode` conditional logic in config flows.

12. **Python 3.14.2+**: HA 2026.6 ships with Python 3.14.2. Use `type` keyword for type aliases (PEP 695) rather than `TypeAlias` from `typing_extensions`.

---

## 16. Recommended Aurora Architecture Summary

```
manifest.json:
  - integration_type: "hub"
  - iot_class: "local_push"
  - quality_scale: "gold"
  - config_flow: true
  - single_config_entry: false  (allow multiple instances, e.g. household A vs B)
  - dependencies: ["http", "frontend", "websocket_api"]

Config Entry (one per "installation"):
  - data: {name, ...global settings}
  - runtime_data: AuroraCoordinator (typed via type AuroraConfigEntry = ConfigEntry[AuroraCoordinator])

Subentries (one per alarm):
  - subentry_type: "alarm"
  - data: {name, wake_time, days, media_player, sound, volume, ...}
  - unique_id: slugified name (unique within parent entry)
  - Supports reconfigure step

Config Flow: AuroraConfigFlow (with VERSION=1, MINOR_VERSION=1)
Options Flow: AuroraOptionsFlow extends OptionsFlowWithReload
Reconfigure: implemented via async_step_reconfigure
Migration: async_migrate_entry in __init__.py
```
