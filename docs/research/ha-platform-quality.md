# HA Platform, Versioning & Integration Quality Scale — Research Notes

**Researched:** 2026-06-15  
**Scope:** HA version, breaking changes, dev tooling, Integration Quality Scale (IQS) for Aurora custom integration

---

## 1. Current Stable HA Version & Python

| Field | Value |
|---|---|
| Current stable | **2026.6.3** (released 2026-06-12) |
| Release cadence | Monthly minor releases; patch releases as needed |
| Python in 2026.6 | **Python 3.14.4** (bumped in base image 2026.04.0; mandated since 2026.3) |
| Minimum Python for dev | 3.14.2+ per official dev environment docs |
| Policy | Support the latest two released minor Python versions (ADR-0002, superseded by ADR-0020) |

**Sources:**
- https://github.com/home-assistant/core/releases
- https://www.home-assistant.io/changelogs/core-2026.6/
- https://developers.home-assistant.io/docs/development_environment/

### Recent releases (for context)
- 2026.6.3 — 2026-06-12
- 2026.6.2 — 2026-06-09
- 2026.6.1 — 2026-06-05
- 2026.6.0 — 2026-06-03
- 2026.5.4 — 2026-05-22

---

## 2. Minimum HA Version to Target for Aurora

**Recommendation: Target `2026.3` as minimum, advertise `2026.6` as current.**

**Rationale:**
- 2026.3 introduced Python 3.14 and the `from __future__ import annotations` removal/ruff ban — code must be compatible.
- 2026.3 introduced `type MyIntegrationConfigEntry = ConfigEntry[T]` as the canonical typed entry alias (PEP 695 syntax); this requires Python 3.12+ syntax, and HA 2026.3 guarantees it.
- All ServiceInfo models must be imported from `homeassistant.helpers.service_info.*` (old paths removed in 2026.2).
- `DataUpdateCoordinator` must receive explicit `config_entry=entry` (ContextVar-based implicit passing removal scheduled for 2026.8 — safe to build with explicit param now).
- Building for 2026.3+ also allows full IQS Gold/Platinum tooling without legacy workarounds.

---

## 3. Breaking Changes & Deprecations (last ~9 months, affecting custom_components)

### 3.1 `from __future__ import annotations` — REMOVED in HA codebase, ruff-banned

- **When:** HA 2026.3 (2026-03-04), enforced via ruff rule
- **Why:** PEP 563 is deprecated as of Python 3.14; PEP 649 (lazy evaluation) takes over. `from __future__ import annotations` causes incompatibilities with PEP 695 type parameter syntax.
- **Action for Aurora:** Do **not** use `from __future__ import annotations`. Use native Python 3.12+ union syntax (`X | Y`), `list[str]`, `dict[str, Any]`, etc. directly.

### 3.2 ServiceInfo model import paths — OLD PATHS REMOVED in 2026.2

| Model | Old (removed) | New |
|---|---|---|
| `DhcpServiceInfo` | `homeassistant.components.dhcp` | `homeassistant.helpers.service_info.dhcp` |
| `SsdpServiceInfo` | `homeassistant.components.ssdp` | `homeassistant.helpers.service_info.ssdp` |
| `UsbServiceInfo` | `homeassistant.components.usb` | `homeassistant.helpers.service_info.usb` |
| `ZeroconfServiceInfo` | `homeassistant.components.zeroconf` | `homeassistant.helpers.service_info.zeroconf` |

**Source:** https://developers.home-assistant.io/blog/2025/01/15/service-info/

### 3.3 `DataUpdateCoordinator` — explicit `config_entry` parameter

- **Deprecation:** ContextVar-based implicit passing will be removed in **2026.8**
- **Action:** Always pass `config_entry=entry` explicitly:

```python
coordinator = MyCoordinator(hass, config_entry=entry, ...)

class MyCoordinator(DataUpdateCoordinator[MyData]):
    def __init__(self, hass: HomeAssistant, config_entry: MyIntegrationConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            config_entry=config_entry,
            update_interval=timedelta(seconds=30),
            always_update=False,  # set False when data supports __eq__
        )
```

### 3.4 Config Entry Listener + Reload Methods — DEPRECATED in 2026.6

- **Deprecated:** 2026-06-03 (2026.6)
- **Will error:** 2026.12
- **Issue:** Using a config entry listener together with any reloading methods in a config flow can cause double-reload and race conditions.
- **Fix:**
  - Remove the config entry listener
  - Use `async_update_and_abort()` instead of `async_update_reload_and_abort()`
  - Set `reload_on_update=False` when calling `_abort_if_unique_id_configured()`

### 3.5 `FlowHandler.show_advanced_options` — DEPRECATED in 2026.6

- **Deprecated:** 2026-05-26
- **Removal:** HA Core 2027.6
- **Change:** During deprecation period, unconditionally returns `True` so gated options remain accessible. `show_advanced_options` key no longer in `FlowHandler.context`.
- **Action for Aurora:** Do not gate any UI options behind this flag.

### 3.6 Service helpers — `hass` argument removed

- **Deprecated:** 2025-09-22
- **Removal:** HA 2026.10
- **Affected functions:** `verify_domain_control`, `extract_entity_ids`, `async_extract_entities`, `async_extract_entity_ids`, `async_extract_config_entry_ids`
- **Change:** `HomeAssistant` is now a property on `ServiceCall` object; no longer needs to be passed separately.

```python
# OLD (deprecated):
target_entry_ids = await async_extract_config_entry_ids(hass, service_call)

# NEW:
target_entry_ids = await async_extract_config_entry_ids(service_call)

# OLD decorator:
@verify_domain_control(hass, DOMAIN)
async def do_action(call: ServiceCall) -> None: ...

# NEW:
@verify_domain_control(DOMAIN)
async def do_action(call: ServiceCall) -> None: ...
```

**Source:** https://developers.home-assistant.io/blog/2025/09/22/deprecate-hass-argument-service-helpers/

### 3.7 Recorder Statistics API — `has_mean` replaced

- **Removal:** HA 2026.11
- **Change:** `has_mean` boolean replaced by `mean_type` (enum: `StatisticMeanType.NONE/ARITHMETIC/CIRCULAR`)
- **Impact on Aurora:** Only if Aurora tracks/exposes long-term statistics (e.g., alarm trigger count).

### 3.8 Template Entities — Legacy Platform Syntax REMOVED in 2026.6

- **Removed:** After 6-month deprecation (deprecated in 2025.12)
- **Affected platforms:** alarm_control_panel, binary_sensor, cover, fan, light, lock, sensor, switch, vacuum, weather
- **Action for Aurora:** Use modern `template:` syntax only; never use legacy platform-style template config.

### 3.9 `BrowseMediaSource` — domain now required str

- **Change (2026.6):** `domain` parameter changed from `str | None` to `str`; root node is now `RootBrowseMediaSource`
- **Impact on Aurora:** Only if Aurora implements a media source (e.g., alarm sounds browser).

### 3.10 Conditions and Scripts — new class-based API (2026.5/2026.6)

- Conditions are now instances of classes with `async_check` and `async_unload` methods
- Scripts now require `async_unload()` when no longer needed
- **Source:** https://developers.home-assistant.io/blog/2026/05/13/

### 3.11 Color Temperature (Light) — mireds deprecated in 2026.3

- `color_temp` (mireds), `min_mireds`, `max_mireds`, `kelvin` attributes removed
- Replaced by `color_temp_kelvin`, `min_color_temp_kelvin`, `max_color_temp_kelvin`
- **Impact on Aurora:** If Aurora controls light entities for wake-up simulation.

### 3.12 MQTT Protocol — Version 3.x deprecated (2026.6)

- Migrating to MQTT version 5
- `message_expiry_interval` parameter added
- MQTT publish API will require explicit `qos` and `retain` values by HA Core 2027.6

### 3.13 Legacy Device Tracker Platform API — deprecated 2026.4, removal 2027.5

- Non-config-entry device tracker platform must migrate to `TrackerEntity` / `ScannerEntity`
- **Impact on Aurora:** N/A (Aurora is a clock/alarm, not a device tracker)

### 3.14 OAuth 2.0 Helper Error Handling — changed 2026.2

- **Source:** https://developers.home-assistant.io/blog/2026/02/19/oauth-token-request-error-handling/

---

## 4. Current Dev Tooling Expectations

### 4.1 Python
- **Minimum:** Python 3.14.2 for dev environment
- Use native PEP 695 type alias syntax: `type MyAlias = SomeType[T]`
- No `from __future__ import annotations`
- Full `X | Y` union syntax throughout

### 4.2 Ruff (linter + formatter)
- Ruff is the primary linter and formatter; replaces flake8 + black + isort
- Commands:
  ```bash
  ruff format .           # format
  ruff check --fix .      # lint + auto-fix
  ```
- HA core has a ruff rule banning `from __future__ import annotations` (as of 2026.3)
- Configuration in `pyproject.toml` or `ruff.toml`

### 4.3 Mypy (type checker)
- All integrations in `.strict-typing` list get strict mypy checks
- Configuration: `mypy.ini` in core repo
- For custom integrations: run `mypy --strict custom_components/aurora/`
- Requires library to be PEP-561 compliant (`py.typed` marker file)
- For typed ConfigEntry: must use `type MyIntegrationConfigEntry = ConfigEntry[T]` throughout

### 4.4 Hassfest
- Tool: `python3 -m script.hassfest`
- Validates: `manifest.json`, `strings.json`, `quality_scale.yaml`, icon assets, service definitions
- Can be run on custom components (not just core)
- Available as GitHub Action for CI: `home-assistant/actions/hassfest`

### 4.5 Pre-commit hooks (recommended)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    hooks:
      - id: mypy
        args: [--strict]
```

### 4.6 Testing
- Framework: pytest + pytest-homeassistant-custom-component
- Coverage requirement for Silver: **>95%**
- Run: `pytest tests/components/<domain>/ --cov=homeassistant.components.<domain> --cov-report term-missing -vv`
- Snapshot testing supported: `pytest --snapshot-update`
- Integration tests must use `async_setup_component` or `hass.config_entries.async_setup`; assert via `hass.states`, `hass.services`, device/entity registries

---

## 5. Integration Quality Scale (IQS) — Mechanism & Rules

### 5.1 Mechanism

Every integration that claims a quality tier must ship a `quality_scale.yaml` at:
```
custom_components/<domain>/quality_scale.yaml
```

**File format:**
```yaml
rules:
  config_flow: done
  brands: done
  entity_unique_id: done
  docs-high-level-description:
    status: exempt
    comment: >
      This integration does not connect to an external device or service;
      it is a local-only alarm clock helper.
  discovery:
    status: exempt
    comment: >
      Aurora is an alarm clock integration; devices are not discoverable
      on the network.
```

**Rule statuses:**
- `done` — requirement is fully implemented
- `exempt` — rule does not apply; `comment` field is **required** explaining why

The `quality_scale` field in `manifest.json` declares the tier:
```json
{
  "quality_scale": "gold"
}
```

Hassfest validates the `quality_scale.yaml` against the current rule list.

---

### 5.2 Tier Rules — Complete List

#### BRONZE (19 rules) — Required for all integrations

| Rule ID | Requirement |
|---|---|
| `action-setup` | Service actions registered in `async_setup` (not `async_setup_entry`) |
| `appropriate-polling` | Polling integrations set a sensible polling interval |
| `brands` | Brand assets (icon.png, logo.png) provided |
| `common-modules` | Common patterns placed in shared modules (`coordinator.py`, `entity.py`, etc.) |
| `config-flow-test-coverage` | Full test coverage for the config flow module |
| `config-flow` | Integration can be set up entirely via UI (config_flow.py + `config_flow: true` in manifest) |
| `dependency-transparency` | External dependencies listed in `requirements`; sources clear |
| `docs-actions` | Documentation describes all service actions |
| `docs-high-level-description` | Documentation includes high-level description of the brand/product/service |
| `docs-installation-instructions` | Step-by-step setup instructions in documentation |
| `docs-removal-instructions` | How to remove/uninstall the integration documented |
| `entity-event-setup` | Entity events subscribed in `async_added_to_hass`, unsubscribed in `async_will_remove_from_hass` |
| `entity-unique-id` | All entities have a stable unique ID |
| `has-entity-name` | Entities set `has_entity_name = True` |
| `runtime-data` | `ConfigEntry.runtime_data` used to store runtime state (not `hass.data[DOMAIN]`) |
| `test-before-configure` | Config flow tests actual connection before creating entry |
| `test-before-setup` | `async_setup_entry` raises `ConfigEntryNotReady` if device/service unreachable |
| `unique-config-entry` | Duplicate config entry for same device/service is prevented |

*(Note: some counts differ slightly between sources; 18-19 bronze rules depending on source version)*

#### SILVER (10 rules) — Adds reliability

| Rule ID | Requirement |
|---|---|
| `action-exceptions` | Service actions raise proper exceptions (`ServiceValidationError`) on failure |
| `config-entry-unloading` | `async_unload_entry` implemented; unloads platforms, cancels subscriptions |
| `docs-configuration-parameters` | All config entry options documented |
| `docs-installation-parameters` | All installation-time parameters documented |
| `entity-unavailable` | Entities set `available = False` when device/service unreachable |
| `integration-owner` | `codeowners` set in manifest; active maintainer |
| `log-when-unavailable` | Log once (not every poll) when going unavailable; log once on recovery |
| `parallel-updates` | `PARALLEL_UPDATES: int` constant defined in platform modules |
| `reauthentication-flow` | UI-based reauthentication flow (`async_step_reauth`) implemented |
| `test-coverage` | **>95% test coverage** across all integration modules |

#### GOLD (21-24 rules) — Comprehensive support

| Rule ID | Requirement |
|---|---|
| `devices` | Integration creates Device entries in device registry |
| `diagnostics` | `diagnostics.py` with `async_get_config_entry_diagnostics` implemented (redacts secrets) |
| `discovery` | Devices can be auto-discovered (Zeroconf, DHCP, Bluetooth, SSDP, etc.) |
| `discovery-update-info` | Discovery info updates device network information (IP/hostname) |
| `docs-data-update` | Documents how/when data is refreshed |
| `docs-examples` | Provides real automation YAML examples users can copy |
| `docs-known-limitations` | Known limitations explicitly documented |
| `docs-supported-devices` | Lists known supported and unsupported devices/firmware versions |
| `docs-supported-functions` | Describes which entities/platforms/features are provided |
| `docs-troubleshooting` | Troubleshooting steps and known issues documented |
| `docs-use-cases` | Real use-case scenarios illustrated |
| `dynamic-devices` | Devices can be added after initial setup (no re-setup required) |
| `entity-category` | Entities assign `EntityCategory` (`CONFIG`, `DIAGNOSTIC`) where appropriate |
| `entity-device-class` | Uses device classes wherever applicable (e.g., `SensorDeviceClass.DURATION`) |
| `entity-disabled-by-default` | Verbose/diagnostic/less-used entities disabled by default |
| `entity-translations` | Entity names are translatable (`translation_key` set) |
| `exception-translations` | Exception/error messages are translatable (in `exceptions.py`) |
| `icon-translations` | Icons customizable per-state via `icons.json` |
| `reconfiguration-flow` | `async_step_reconfigure` implemented for post-setup reconfiguration |
| `repair-issues` | HA Repair issues/flows used for required user interventions |
| `stale-devices` | Devices removed from service are removed from device registry |

#### PLATINUM (3 rules) — Technical excellence

| Rule ID | Requirement |
|---|---|
| `async-dependency` | All external library dependencies are async (asyncio-native); no blocking I/O on event loop |
| `inject-websession` | External HTTP library accepts an injected `aiohttp.ClientSession` (uses HA's shared session) |
| `strict-typing` | All code passes mypy strict; integration added to `.strict-typing` file; library is PEP-561 compliant |

---

## 6. Aurora Gold Checklist

The following is Aurora's compliance checklist for **Gold** (cumulative: Bronze + Silver + Gold). Items marked as potentially exempt are noted.

### Bronze Checklist

- [ ] `action-setup` — Register alarm service actions in `async_setup`, not `async_setup_entry`
- [ ] `appropriate-polling` — If polling a time source, set appropriate interval (e.g., every 60s or event-driven)
- [ ] `brands` — Provide `icon.png` (256×256) and `logo.png` assets
- [ ] `common-modules` — Split code into `coordinator.py`, `entity.py`, `const.py`, `helpers.py`
- [ ] `config-flow-test-coverage` — 100% branch coverage on `config_flow.py`
- [ ] `config-flow` — Full UI setup via config flow; `config_flow: true` in manifest
- [ ] `dependency-transparency` — All pip deps in `requirements`; no hidden deps
- [ ] `docs-actions` — Document `aurora.set_alarm`, `aurora.snooze_alarm`, etc.
- [ ] `docs-high-level-description` — Intro paragraph about Aurora's purpose
- [ ] `docs-installation-instructions` — Step-by-step HACS + manual install guide
- [ ] `docs-removal-instructions` — How to delete config entry + HACS uninstall
- [ ] `entity-event-setup` — Subscribe in `async_added_to_hass`; unsubscribe in `async_will_remove_from_hass`
- [ ] `entity-unique-id` — e.g., `f"{entry.entry_id}_{alarm_slot_id}"`
- [ ] `has-entity-name` — `has_entity_name = True` on all entities; use `translation_key` for name
- [ ] `runtime-data` — Store coordinator in `entry.runtime_data`; use typed alias
- [ ] `test-before-configure` — Validate any external service (media player, TTS) reachable in config flow
- [ ] `test-before-setup` — Raise `ConfigEntryNotReady` if prerequisites unavailable at startup
- [ ] `unique-config-entry` — Prevent duplicate alarm instances (use unique ID based on name/slot)

### Silver Checklist

- [ ] `action-exceptions` — Raise `ServiceValidationError` with translatable message on bad input
- [ ] `config-entry-unloading` — `async_unload_entry` fully implemented; all platforms unloaded
- [ ] `docs-configuration-parameters` — All options flow fields documented
- [ ] `docs-installation-parameters` — All config flow fields documented
- [ ] `entity-unavailable` — Mark entities unavailable if media player / TTS provider is gone
- [ ] `integration-owner` — Set `codeowners` in manifest
- [ ] `log-when-unavailable` — Single log on unavailability; single log on recovery
- [ ] `parallel-updates` — Define `PARALLEL_UPDATES = 1` (or appropriate) in each platform
- [ ] `reauthentication-flow` — If using a cloud TTS/music service with auth, implement reauth
- [ ] `test-coverage` — >95% coverage across all modules

### Gold Checklist

- [ ] `devices` — Create a device per alarm instance with manufacturer/model/sw_version
- [ ] `diagnostics` — Implement `async_get_config_entry_diagnostics`; redact music service credentials
- [ ] `discovery` — **EXEMPT** (alarm clock instances are not network-discoverable)
- [ ] `discovery-update-info` — **EXEMPT** (follows from discovery exemption)
- [ ] `docs-data-update` — Document how alarm state/next-trigger updates (event-driven vs. polling)
- [ ] `docs-examples` — Provide automation YAML: "when alarm fires, run routine"
- [ ] `docs-known-limitations` — Document HA restart behavior, missed alarms, time zone edge cases
- [ ] `docs-supported-devices` — List supported TTS providers, media player platforms
- [ ] `docs-supported-functions` — List all entities (time sensor, alarm status, snooze button, etc.)
- [ ] `docs-troubleshooting` — Log locations, common errors, reset procedure
- [ ] `docs-use-cases` — "Wake up with Spotify + smart lights fade-in" scenario
- [ ] `dynamic-devices` — Allow adding new alarm slots without re-setup (options flow or sub-entry)
- [ ] `entity-category` — `EntityCategory.CONFIG` for settings entities; `EntityCategory.DIAGNOSTIC` for status
- [ ] `entity-device-class` — Use `SensorDeviceClass.TIMESTAMP` for next-alarm time sensor; `ButtonDeviceClass.SNOOZE` if available
- [ ] `entity-disabled-by-default` — Disable verbose diagnostic entities by default
- [ ] `entity-translations` — All entity names in `strings.json` / `en.json`
- [ ] `exception-translations` — All error strings in `strings.json` exceptions section
- [ ] `icon-translations` — State-specific icons in `icons.json`
- [ ] `reconfiguration-flow` — Allow changing alarm name / time zone / media source post-setup
- [ ] `repair-issues` — Use Repair API if media player becomes permanently unavailable
- [ ] `stale-devices` — Remove device if alarm slot is deleted

---

## 7. Platinum Extras (beyond Gold)

Platinum adds 3 additional rules. Aurora should target these where possible:

### `async-dependency`
All communication libraries Aurora depends on must be asyncio-native. No `requests`, no blocking calls on the event loop.
- Use `aiohttp` for HTTP
- Use `async_timeout` for timeouts (or `asyncio.timeout` in Python 3.11+)
- If wrapping a sync library, run in executor: `await hass.async_add_executor_job(sync_fn)`

### `inject-websession`
If Aurora's library makes HTTP requests, it must accept an injected `aiohttp.ClientSession`:
```python
from homeassistant.helpers.aiohttp_client import async_get_clientsession

session = async_get_clientsession(hass)
client = AuroraApiClient(session=session)
```

### `strict-typing`
```python
# __init__.py
type AuroraConfigEntry = ConfigEntry[AuroraCoordinator]

async def async_setup_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    coordinator = AuroraCoordinator(hass, config_entry=entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    ...
```

Requirements:
- Add Aurora's library to `.strict-typing` (for core submission) or run `mypy --strict` locally
- Library must have `py.typed` marker
- All type annotations explicit; no `Any` where avoidable
- No `from __future__ import annotations`

---

## 8. Manifest.json Template for Aurora

```json
{
  "domain": "aurora",
  "name": "Aurora Alarm Clock",
  "version": "0.1.0",
  "codeowners": ["@your-github-handle"],
  "config_flow": true,
  "dependencies": ["media_player", "tts"],
  "documentation": "https://github.com/your-org/aurora/blob/main/README.md",
  "integration_type": "service",
  "iot_class": "local_push",
  "issue_tracker": "https://github.com/your-org/aurora/issues",
  "loggers": ["aurora"],
  "quality_scale": "gold",
  "requirements": []
}
```

**Notes:**
- `integration_type: "service"` — Aurora provides a single logical service (alarm clock), not a hub or device entity
- `iot_class: "local_push"` — Alarm events are generated locally and pushed (no network polling)
- `version` — Required for custom components; must be AwesomeVersion format (SemVer or CalVer)
- `dependencies` — List any HA built-in integration Aurora relies on

---

## 9. quality_scale.yaml Template for Aurora

```yaml
rules:
  action-setup: done
  appropriate-polling:
    status: exempt
    comment: >
      Aurora is event-driven (alarm scheduler); it does not poll external
      devices or services on an interval.
  brands: done
  common-modules: done
  config-flow-test-coverage: done
  config-flow: done
  dependency-transparency: done
  docs-actions: done
  docs-high-level-description: done
  docs-installation-instructions: done
  docs-removal-instructions: done
  entity-event-setup: done
  entity-unique-id: done
  has-entity-name: done
  runtime-data: done
  test-before-configure: done
  test-before-setup: done
  unique-config-entry: done
  action-exceptions: done
  config-entry-unloading: done
  docs-configuration-parameters: done
  docs-installation-parameters: done
  entity-unavailable: done
  integration-owner: done
  log-when-unavailable: done
  parallel-updates: done
  reauthentication-flow:
    status: exempt
    comment: >
      Aurora does not authenticate with any external service in its base
      configuration. Cloud TTS provider sub-integrations handle their own auth.
  test-coverage: done
  devices: done
  diagnostics: done
  discovery:
    status: exempt
    comment: >
      Alarm clock instances are user-created logical entities; they cannot
      be discovered on the network.
  discovery-update-info:
    status: exempt
    comment: Follows from discovery exemption.
  docs-data-update: done
  docs-examples: done
  docs-known-limitations: done
  docs-supported-devices: done
  docs-supported-functions: done
  docs-troubleshooting: done
  docs-use-cases: done
  dynamic-devices: done
  entity-category: done
  entity-device-class: done
  entity-disabled-by-default: done
  entity-translations: done
  exception-translations: done
  icon-translations: done
  reconfiguration-flow: done
  repair-issues: done
  stale-devices: done
  async-dependency: done
  inject-websession: done
  strict-typing: done
```

---

## 10. Typed ConfigEntry Pattern (canonical, post-2026.3)

```python
# custom_components/aurora/__init__.py
from __future__ import annotations  # DO NOT ADD — banned in HA 2026.3+

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from .coordinator import AuroraCoordinator

# PEP 695 type alias — requires Python 3.12+, standard in HA 2026.3+
type AuroraConfigEntry = ConfigEntry[AuroraCoordinator]

PLATFORMS: list[str] = ["sensor", "switch", "button", "select", "time"]


async def async_setup_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    coordinator = AuroraCoordinator(hass, config_entry=entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
```

```python
# custom_components/aurora/coordinator.py
from datetime import timedelta
import logging
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.config_entries import ConfigEntry

_LOGGER = logging.getLogger(__name__)

type AuroraConfigEntry = ConfigEntry["AuroraCoordinator"]


class AuroraCoordinator(DataUpdateCoordinator[dict]):
    config_entry: AuroraConfigEntry  # typed attribute

    def __init__(self, hass: HomeAssistant, config_entry: AuroraConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name="Aurora Alarm",
            config_entry=config_entry,  # explicit — required pre-2026.8 removal
            update_interval=timedelta(seconds=60),
            always_update=False,  # avoids unnecessary state machine writes
        )

    async def _async_update_data(self) -> dict:
        try:
            return await self._fetch_alarm_state()
        except Exception as err:
            raise UpdateFailed(f"Error fetching Aurora data: {err}") from err
```

---

## 11. Key Sources

| Topic | URL |
|---|---|
| IQS main page | https://developers.home-assistant.io/docs/core/integration-quality-scale/ |
| IQS rules index | https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/ |
| IQS checklist | https://developers.home-assistant.io/docs/core/integration-quality-scale/checklist/ |
| runtime-data rule | https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/runtime-data/ |
| strict-typing rule | https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/strict-typing/ |
| async-dependency rule | https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/async-dependency/ |
| config-flow rule | https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-flow/ |
| Fetching data docs | https://developers.home-assistant.io/docs/integration_fetching_data/ |
| Manifest reference | https://developers.home-assistant.io/docs/creating_integration_manifest/ |
| Developer blog | https://developers.home-assistant.io/blog/ |
| HA 2026.6 changelog | https://www.home-assistant.io/changelogs/core-2026.6/ |
| HA 2026.3 release | https://www.home-assistant.io/blog/2026/03/04/release-20263/ |
| ServiceInfo relocation | https://developers.home-assistant.io/blog/2025/01/15/service-info/ |
| Service helpers hass deprecation | https://developers.home-assistant.io/blog/2025/09/22/deprecate-hass-argument-service-helpers/ |
| Frontend 2026.6 | https://developers.home-assistant.io/blog/2026/05/27/frontend-component-updates-2026.6/ |
| HACS integration publishing | https://www.hacs.xyz/docs/publish/integration/ |
| ADR-0022 IQS | https://github.com/home-assistant/architecture/blob/master/adr/0022-integration-quality-scale.md |
| HA Core releases | https://github.com/home-assistant/core/releases |
