# Aurora — Consolidated Research Report

**Project:** Aurora — a capability-first, provider-agnostic Home Assistant alarm-clock integration + Lovelace card
**Quality target:** Integration Quality Scale (IQS) **Gold**, with **Platinum** as a stretch goal where the 3 extra rules are cheap to satisfy.
**Report date:** 2026-06-15
**Status:** Durable reference. Consolidates the output of 6 parallel research agents. Companion document: `DECISIONS.md` (resolved questions, key decisions, Phase 0 checklist, risks).

> Detailed source notes live under `docs/research/*.md`:
> - `ha-platform-quality.md` — version, breaking changes, tooling, IQS
> - `config-flow-entries.md` — manifest, config-entry lifecycle, flows, selectors
> - `coordinator-scheduler-time.md` — coordinator, entities, time triggers, DST
> - `storage-services-ws.md` — Store, collections, services, WebSocket
> - `recurrence-calendar.md` — recurrence model, calendar exposure/skip
> - `ai-task-vision.md` — ai_task, LLM Vision, robust async AI

> Note on conflicting agent notes: the `recurrence-calendar.md` and parts of `ai-task-vision.md` files use `from __future__ import annotations` and reference Python 3.13. These are **superseded** by the authoritative platform research (`ha-platform-quality.md`): Aurora targets **Python 3.14** and must **not** use `from __future__ import annotations` (ruff-banned in HA 2026.3+). When in doubt, the platform-quality notes win.

---

## 0. Target Platform Decision (summary)

| Item | Value |
|---|---|
| **`homeassistant` minimum (manifest)** | **`2026.3.0`** |
| **Tested/advertised against** | **2026.6.3** (current stable, 2026-06-12) |
| **Python baseline** | **3.14** (mandated by HA since 2026.3; HA 2026.6 ships 3.14.4/3.14.5) |
| Release cadence | Monthly minor (`YYYY.M.patch`) |

**Why 2026.3 as the floor (not 2026.6):**
- Python 3.14 is mandatory from 2026.3 → guarantees PEP 695 `type X = ...` aliases natively, no `typing_extensions`.
- `from __future__ import annotations` is removed from core and ruff-banned as of 2026.3.
- All `ServiceInfo` import paths were finalized under `homeassistant.helpers.service_info.*` by 2026.2.
- `DataUpdateCoordinator(config_entry=...)` explicit param is safe to rely on (implicit removal lands 2026.8 — we are already explicit).
- Subentries are GA since 2025.7, well before 2026.3.
- Choosing 2026.3 (rather than 2026.6) widens the install base by one quarter while still requiring **zero legacy compat shims**. The only 2026.6-only behaviors Aurora touches (config-entry-listener-with-reload deprecation, removed `ha-radio`/`ha-fab`/`ha-top-app-bar` frontend tokens) are things we simply build the modern way from day one, so they are not a hard floor.

---

## 1. HA Platform, Breaking Changes & Tooling

### 1.1 Breaking changes that shape Aurora's code (last ~9 months)

| Change | Landed | Becomes error/removed | Aurora rule |
|---|---|---|---|
| `from __future__ import annotations` ruff-banned | 2026.3 | n/a (lint fail now) | Never use it. Native `X | Y`, `list[str]`, `dict[str, Any]`. |
| `ServiceInfo` import paths moved to `homeassistant.helpers.service_info.*` | 2026.2 | old paths removed | Only import from new paths (only relevant if we add discovery — we don't). |
| `DataUpdateCoordinator` requires explicit `config_entry=` | deprecated | removed 2026.8 | Always pass `config_entry=entry`; set `always_update=False`. |
| Config-entry listener + reloading methods in config flow | deprecated 2026.6 | error 2026.12 | Use `OptionsFlowWithReload`; use `async_update_and_abort()`; never add a manual `add_update_listener` paired with reload. |
| Service helpers drop `hass` first arg | 2025.9 | removed 2026.10 | `async_extract_config_entry_ids(call)`, `verify_domain_control(DOMAIN)`. `hass` is a property on `ServiceCall`. |
| `FlowHandler.show_advanced_options` | deprecated 2026.6 | removal 2027.6 | Do not gate UI behind advanced mode. |
| Template legacy platform syntax | removed 2026.6 | done | Use modern `template:` only (only relevant if we ship template examples). |
| Light `color_temp` mireds | removed 2026.3 | done | Use `*_color_temp_kelvin` for any wake-up light control. |
| Recorder `has_mean` boolean | — | removed 2026.11 | If exposing LTS, use `StatisticMeanType` enum. |
| Frontend: `ha-radio`, `ha-fab`, `ha-top-app-bar` removed | 2026.6 | done | Card uses `ha-radio-group`/`ha-radio-option`, `ha-button`; CSS tokens `--ha-sidebar-width`, `--ha-top-app-bar-width`; `@consumeLocalize()` for i18n. |

### 1.2 Dev tooling

```bash
ruff format .            # formatter (replaces black/isort)
ruff check --fix .       # linter (replaces flake8) — bans __future__ annotations
mypy --strict custom_components/aurora/
python3 -m script.hassfest   # validates manifest.json, strings.json, quality_scale.yaml, icons, services
pytest tests/ --cov --cov-report term-missing   # >95% for Silver
```
- Dev environment requires Python ≥ 3.14.2.
- Wire `home-assistant/actions/hassfest` + ruff + mypy + pytest into GitHub Actions CI.

### 1.3 Typed ConfigEntry (canonical, post-2026.3)

```python
# const.py
from homeassistant.config_entries import ConfigEntry
from .coordinator import AuroraCoordinator

type AuroraConfigEntry = ConfigEntry[AuroraCoordinator]   # PEP 695, no TypeAlias import

# __init__.py
async def async_setup_entry(hass: HomeAssistant, entry: AuroraConfigEntry) -> bool:
    coordinator = AuroraCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator                # NEVER hass.data[DOMAIN]
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True
```

### 1.4 IQS tier map (what Aurora must implement)

- **Bronze (~18):** `config-flow`, `entity-unique-id`, `has-entity-name`, `runtime-data`, `action-setup` (services in `async_setup`), `test-before-setup` (`ConfigEntryNotReady`), `unique-config-entry`, `config-flow-test-coverage`, `brands`, `common-modules`, `entity-event-setup`, `dependency-transparency`, `docs-*` basics.
- **Silver (10):** `config-entry-unloading`, `entity-unavailable`, `reauthentication-flow` (exempt for pure-local), `test-coverage >95%`, `parallel-updates`, `log-when-unavailable`, `action-exceptions` (`ServiceValidationError`), `integration-owner`, `docs-*` params.
- **Gold (~21):** `devices`, `diagnostics` (redacted), `discovery` (**exempt** — alarms aren't network-discoverable), `entity-category`, `entity-device-class`, `entity-translations`, `exception-translations`, `icon-translations`, `reconfiguration-flow`, `repair-issues`, `stale-devices`, `dynamic-devices`, 7× `docs-*`.
- **Platinum (3):** `async-dependency`, `inject-websession`, `strict-typing`. Trivial to hit because Aurora has **no external Python deps** (no HTTP library to inject; logic is pure-Python + HA helpers). The only work is full `mypy --strict` and a `py.typed` marker.

`quality_scale.yaml` ships beside the code; statuses are `done` or `exempt` (exempt requires a `comment`). Set `"quality_scale": "gold"` in `manifest.json`.

---

## 2. Manifest, Config Entries, Flows & Selectors

### 2.1 manifest.json (Aurora)

```json
{
  "domain": "aurora",
  "name": "Aurora Alarm Clock",
  "version": "0.1.0",
  "codeowners": ["@gabriel-antico"],
  "config_flow": true,
  "dependencies": ["http", "frontend", "websocket_api"],
  "after_dependencies": ["media_player", "calendar", "workday", "ai_task"],
  "documentation": "https://github.com/<org>/aurora",
  "issue_tracker": "https://github.com/<org>/aurora/issues",
  "integration_type": "hub",
  "iot_class": "local_push",
  "loggers": ["aurora"],
  "quality_scale": "gold",
  "requirements": []
}
```

Notes:
- `integration_type: "hub"` — Aurora is a gateway to multiple logical alarm instances (subentries). (`"service"` was floated by one agent but `"hub"` fits the multi-alarm + multi-device model better.)
- `iot_class: "local_push"` — alarm events are generated and pushed locally; no polling of an external service.
- `version` is **required for custom integrations** (AwesomeVersion: SemVer or CalVer). Omit only for core.
- `dependencies` (not `after_dependencies`) for `http`/`frontend`/`websocket_api` because we register a Lovelace resource + WS commands at startup.
- `after_dependencies` for optional collaborators we read but don't require.
- Do **not** set `single_config_entry: true` — multiple Aurora installs (e.g. households) should be allowed; per-person modeling is via subentries (see DECISIONS §multi-user).

### 2.2 Config entry lifecycle

```python
async def async_unload_entry(hass, entry: AuroraConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

async def async_migrate_entry(hass, entry: ConfigEntry) -> bool:
    if entry.version > CURRENT_VERSION:        # downgrade guard
        return False
    if entry.version == 1:
        data = {**entry.data}
        if entry.minor_version < 2:
            data.setdefault("volume", 50)
        hass.config_entries.async_update_entry(entry, data=data, minor_version=2, version=1)
    return True
```
- `VERSION`/`MINOR_VERSION` default to 1. Minor bumps are backward-compatible; major bumps require `async_migrate_entry`.
- Never mutate `ConfigEntry`/`ConfigSubentry` directly — always `hass.config_entries.async_update_entry(...)`.
- Implement migration infrastructure from day one (even at 1.1) so the first schema change is painless.

### 2.3 ConfigFlow / OptionsFlow / Reconfigure / Subentries

```python
class AuroraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1
    MINOR_VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> AuroraOptionsFlow:
        return AuroraOptionsFlow()

    @classmethod
    @callback
    def async_get_supported_subentry_types(
        cls, config_entry: ConfigEntry
    ) -> dict[str, type[ConfigSubentryFlow]]:
        return {"alarm": AuroraAlarmSubentryFlowHandler}

    async def async_step_reconfigure(self, user_input=None):
        if user_input is not None:
            return self.async_update_reload_and_abort(
                self._get_reconfigure_entry(), data_updates=user_input
            )
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self.add_suggested_values_to_schema(
                SCHEMA, self._get_reconfigure_entry().data
            ),
        )

class AuroraOptionsFlow(OptionsFlowWithReload):           # NOT bare OptionsFlow
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                OPTIONS_SCHEMA, self.config_entry.options
            ),
        )
```

**Subentry flow** (one subentry per alarm, `subentry_type="alarm"`):

```python
class AuroraAlarmSubentryFlowHandler(ConfigSubentryFlow):
    async def async_step_user(self, user_input=None) -> SubentryFlowResult:
        if user_input is not None:
            await self.async_set_unique_id(slugify(user_input["name"]))
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title=user_input["name"], data=user_input)
        return self.async_show_form(step_id="user", data_schema=ALARM_SCHEMA)

    async def async_step_reconfigure(self, user_input=None) -> SubentryFlowResult:
        if user_input is not None:
            return self.async_update_and_abort(
                self._get_entry(),                       # NOT _get_reconfigure_entry()
                self._get_reconfigure_subentry(),
                data=user_input, title=user_input["name"],
            )
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self.add_suggested_values_to_schema(
                ALARM_SCHEMA, self._get_reconfigure_subentry().data
            ),
        )
```

Gotchas:
- March-2025 API rename: `_reconfigure_entry_id → _entry_id`, `_get_reconfigure_entry() → _get_entry()` inside `ConfigSubentryFlow`. (Top-level `ConfigFlow` still uses `_get_reconfigure_entry()`.)
- Subentries support only `user` + `reconfigure` steps (no reauth/discovery). Translations under `config_subentries` in `strings.json`.
- Subentry `unique_id` is unique **within the parent entry**, not globally.
- `OptionsFlowWithReload` replaces the deprecated manual update-listener pattern. Do not set `self.config_entry` manually (deprecated ~2025.12).

### 2.4 Optional fields without validation errors (critical)

```python
# WRONG — default prevents clearing; selectors reject "" 
vol.Optional("media_player", default="media_player.bedroom"): EntitySelector(...)

# RIGHT — pre-fill via suggested_value, allow clearing
vol.Optional(
    "media_player",
    description={"suggested_value": current.get("media_player")},
): EntitySelector(EntitySelectorConfig(filter=EntityFilterSelectorConfig(domain="media_player")))
```
- Use `self.add_suggested_values_to_schema(SCHEMA, current_values)` to apply current values as suggestions.
- Strip empties before saving: `cleaned = {k: v for k, v in user_input.items() if v not in ("", None)}`.
- For schemas that must accept None: `vol.Optional("x"): vol.Any(None, EntitySelector(...))`.

### 2.5 Selectors used by Aurora

- `TimeSelector()` → returns `"HH:MM:SS"` (alarm time).
- `SelectSelector(SelectSelectorConfig(options=[...], translation_key=..., sort=True))` (weekday/repeat/role choices).
- `NumberSelector(NumberSelectorConfig(min, max, step, mode="slider"|"box", unit_of_measurement))` (volume, fade minutes, snooze).
- `EntitySelector(EntitySelectorConfig(filter=EntityFilterSelectorConfig(domain=..., device_class=..., supported_features=[...]), multiple=..., reorder=...))` — supports multi-filter via a list.
- `BooleanSelector()`, `ColorRGBSelector()` (returns `[R,G,B]` list), `DurationSelector(...)`.
- `ConfigEntrySelector({"integration": "llmvision"})` (LLM Vision provider picker — returns the entry_id ULID).
- Form `section(schema, {"collapsed": True})` to group advanced options (one nesting level only; section data arrives nested under the section key; section names must be `vol.Required`).
- Device filter was removed from `TargetSelector` (enforced 2026.11) — use `EntitySelector.filter`, which is unaffected.

---

## 3. Coordinator, Entities, Time Triggers & DST

### 3.1 Push coordinator

```python
class AuroraCoordinator(DataUpdateCoordinator[AuroraData]):
    config_entry: AuroraConfigEntry
    def __init__(self, hass, entry: AuroraConfigEntry) -> None:
        super().__init__(
            hass, _LOGGER, name=DOMAIN,
            config_entry=entry,        # REQUIRED (implicit removed 2026.8)
            # omit update_method + update_interval => push-only
            always_update=False,       # AuroraData implements __eq__
        )
    async def _async_setup(self) -> None:
        # one-time startup: load persisted alarms, arm scheduler.
        # Runs inside async_config_entry_first_refresh; failures -> ConfigEntryNotReady.
        ...
    @callback
    def async_handle_alarm_fired(self, alarm_id: str) -> None:
        ...                            # mutate data, then:
        self.async_set_updated_data(self.data)
```
- Push-only coordinator (no polling) directly satisfies Platinum's efficiency expectation.
- For a never-failing push coordinator, set `last_update_success=True` after `_async_setup` so `CoordinatorEntity.available` is correct.

### 3.2 Entities

```python
class AuroraNextAlarmSensor(CoordinatorEntity[AuroraCoordinator], SensorEntity):
    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    def __init__(self, coordinator, alarm_id, description):
        super().__init__(coordinator, context=alarm_id)   # context filters callbacks
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_{alarm_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{coordinator.config_entry.entry_id}_{alarm_id}")},
            entry_type=DeviceEntryType.SERVICE,
        )
```
- `has_entity_name = True` everywhere; friendly name = device name + entity name; use `translation_key`.
- `unique_id` from `entry_id + alarm_id + key` — never IP/hostname/user-editable string.
- For restart survival, extend **`RestoreSensor`** (NOT `RestoreEntity`) and use `async_get_last_sensor_data()` — `RestoreSensor` preserves `native_value`/unit, `RestoreEntity` only the formatted string. **Aurora persists alarm state in `Store` regardless**, so RestoreSensor is belt-and-suspenders. (Watch issue #164802 — 2026.3 Docker restore regression; verify fixed before release.)
- `PARALLEL_UPDATES = 1` in each platform module (Silver rule).

### 3.3 Time triggers & DST (the load-bearing detail)

```python
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.util import dt as dt_util

# Compute next local wall-clock occurrence, convert ONCE to UTC, schedule in UTC:
tz = dt_util.get_default_time_zone()
local_dt = datetime(d.year, d.month, d.day, alarm.hour, alarm.minute, 0, tzinfo=tz, fold=0)
utc_dt = dt_util.as_utc(local_dt)
cancel = async_track_point_in_utc_time(hass, scheduler._async_on_fire, utc_dt)
```
- All `async_track_*` helpers are `@callback` and return a `CALLBACK_TYPE` cancel function.
- `async_track_point_in_utc_time` / `async_track_point_in_time` are **one-shot** — re-arm manually in the callback. Store the cancel and call it before re-arming. Use `self.async_on_remove(cancel)` to auto-clean.
- **DST strategy:** schedule in UTC via pre-computed `utc_dt`; this sidesteps issue #90293 (local `time:` triggers firing 1h late after DST until restart). Re-arm on `EVENT_CORE_CONFIG_UPDATE` (HA timezone change). For spring-forward, skip wall-clock times that don't exist (`_datetime_exists` round-trip check) — treat as firing at the first valid moment after the gap. For fall-back, `fold=0` selects the first (earlier) occurrence.

### 3.4 Single-timer scheduler

```python
def compute_next_occurrence(alarm, now) -> datetime | None:
    tz = dt_util.get_default_time_zone()
    skip = alarm.skip_next
    for offset in range(8):                         # bounded: full week + 1
        d = now.date() + timedelta(days=offset)
        cand = datetime(d.year, d.month, d.day, alarm.hour, alarm.minute, 0, tzinfo=tz, fold=0)
        if cand <= now or not is_valid_weekday(alarm, d) or not _datetime_exists(cand):
            continue
        if skip:
            skip = False
            continue
        return dt_util.as_utc(cand)
    return None
```
- Maintain ONE armed `CALLBACK_TYPE` across all N alarms: compute each alarm's next occurrence, arm the earliest. On fire → run actions, consume `skip_next` **before** re-arming, advance, re-arm. On config change → cancel + re-arm. On HA start → arm in `_async_setup`.
- Bound the search to 8 days. `ONCE` alarms return `None` after their date passes (auto-disable).

---

## 4. Storage, Services & WebSocket API

### 4.1 Storage strategy

- **Alarm list → `DictStorageCollection`** + `DictStorageCollectionWebsocket`. Auto-wires `aurora/list|create|update|delete|subscribe` WS commands (eliminates ~300 lines), gives change-set listeners for push, SAVE_DELAY coalescing. Subclass and override `_process_create_data` (voluptuous validation) + `_get_suggested_id` (slug).
- **Singleton global config → raw `Store`** with `atomic_writes=True` (crash-safe rename). `serialize_in_event_loop=True` is the default since 2025.11 — leave it.
- Key names are domain-prefixed and globally unique: `aurora.alarms`, `aurora.config`.

```python
class AlarmStorageCollection(collection.DictStorageCollection):
    async def _process_create_data(self, data: dict) -> dict:
        return self.CREATE_SCHEMA(data)
    @callback
    def _get_suggested_id(self, info: dict) -> str:
        return info["name"]

collection.DictStorageCollectionWebsocket(
    alarm_collection, api_prefix="aurora", model_name="aurora_alarm",
    create_schema=CREATE_SCHEMA, update_schema=UPDATE_SCHEMA,
).async_setup(hass)
```

> Tension to resolve in build: subentries (config-flow-managed alarms) vs `DictStorageCollection` (card/WS-managed alarms). See DECISIONS — Aurora uses **subentries as the source of truth for config-flow-created alarms** and a **`Store`-backed runtime/mutable state model** for fast card CRUD + push; the collection helper is the chosen WS transport for card-driven alarm CRUD. The two are reconciled by treating the card-managed alarm list as the primary store and exposing config-flow subentry creation as a convenience path that writes into the same model.

### 4.2 Services (actions)

```python
# Register in async_setup (action-setup rule), not async_setup_entry:
hass.services.async_register(
    DOMAIN, "set_alarm", async_set_alarm,
    schema=SET_ALARM_SCHEMA, supports_response=SupportsResponse.NONE,
)
hass.services.async_register(
    DOMAIN, "get_next_triggers", async_get_next,
    schema=..., supports_response=SupportsResponse.ONLY,   # read-only query
)
async_register_admin_service(hass, DOMAIN, "factory_reset", async_reset, schema=vol.Schema({}))
```
- Raise `ServiceValidationError` for bad user input (bad time, unknown alarm id); `HomeAssistantError` for device/integration failures. Never return error dicts.
- `SupportsResponse`: `NONE` default; `ONLY` for pure queries; `OPTIONAL` only when the caller genuinely may not need the result.
- `services.yaml` lists service names (no domain prefix), `fields` with selectors; use translation keys for Gold.
- New service-helper signatures (no `hass`): `async_extract_config_entry_ids(call)`, `verify_domain_control(DOMAIN)`.

### 4.3 Custom WebSocket commands (beyond the auto-CRUD)

```python
@websocket_api.websocket_command({vol.Required("type"): "aurora/test_media", vol.Required("entity_id"): str})
@websocket_api.async_response          # use for any I/O
async def ws_test_media(hass, connection, msg):
    try:
        await hass.services.async_call("media_player", "media_play", {"entity_id": msg["entity_id"]}, blocking=True)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], websocket_api.ERR_HOME_ASSISTANT_ERROR, str(err)); return
    connection.send_result(msg["id"])
```
- Decorator order: `@websocket_command` (outermost) → `@require_admin` (optional) → `@async_response`/`@callback` → fn. Wrong order is a runtime error.
- Subscriptions: ack with `send_result`, send current items as `event_message`, register a change-set listener, store the unsub in `connection.subscriptions[msg_id]` (auto-cleaned on disconnect).

### 4.4 Card ↔ backend contract (frontend)

```ts
const unsub = await hass.connection.subscribeMessage(
  (ev) => { /* added|updated|removed -> update local map */ this.requestUpdate(); },
  { type: "aurora/subscribe" },
);
await hass.callWS({ type: "aurora/create", name: "Morning", time: "07:00" });
```
- Use `subscribeMessage` (auto-reconnect) for the alarm list; `callWS` for one-shot CRUD. Optimistic UI: placeholder → reconcile on event → revert+toast on error.

---

## 5. Recurrence Model & Calendar Exposure / Skip

### 5.1 Internal recurrence schema (do NOT depend on scheduler-component)

```python
from dataclasses import dataclass, field
from enum import StrEnum

class RepeatMode(StrEnum):
    ONCE = "once"; DAILY = "daily"; WEEKLY = "weekly"

@dataclass
class AuroraAlarmSchedule:
    hour: int
    minute: int
    repeat_mode: RepeatMode = RepeatMode.WEEKLY
    weekdays: frozenset[int] = field(default_factory=lambda: frozenset({0, 1, 2, 3, 4}))  # 0=Mon
    start_date: str | None = None      # "YYYY-MM-DD"
    end_date: str | None = None
    skip_holidays: bool = False
    skip_entity_id: str | None = None  # workday binary_sensor OR holiday calendar
    skip_next: bool = False            # transient per-instance skip
    next_occurrence_override: str | None = None  # ISO, one-shot
    enabled: bool = True
    pre_alarm_minutes: int = 0
```
- scheduler-component is a HACS component (no stable cross-integration API, switch.schedule_* entities) → unfit for Gold. HA native `schedule` helper lacks holidays/one-shot → too limited.
- Persist via `Store` (or as subentry data). Serialize with `dataclasses.asdict`.

### 5.2 Expose alarms as a `CalendarEntity` (agenda view)

```python
class AuroraCalendarEntity(CalendarEntity):
    _attr_supported_features = (
        CalendarEntityFeature.CREATE_EVENT | CalendarEntityFeature.DELETE_EVENT | CalendarEntityFeature.UPDATE_EVENT
    )
    @property
    def event(self) -> CalendarEvent | None: ...
    async def async_get_events(self, hass, start_date, end_date) -> list[CalendarEvent]:
        # start_date/end_date arrive UTC -> convert to local before weekday math.
        # HA core does NOT expand RRULE — Aurora expands its own recurrences.
        ...
```
- `state`/`state_attributes` are `@final` — don't override. After CRUD, call `self.async_update_event_listeners()` to push to WS subscribers (Lovelace calendar card).
- `CalendarEvent(start, end, summary, ...)`: tz-aware datetimes for timed events, `datetime.date` for all-day; `end` exclusive.

### 5.3 Holiday / workday skip (provider-agnostic)

- Accept either a **workday `binary_sensor`** (`on`=workday) or a **holiday `calendar`** entity as `skip_entity_id`.
- Today: `hass.states.get(entity_id)` (sync, fast). Future dates: `workday.check_date` or `calendar.get_events` with `blocking=True, return_response=True`.
- **Pre-compute skip decisions in the coordinator (next ~7 days)**, never via async service calls at alarm-fire time. The calendar trigger polls every ~15 min and is unsuitable for time-critical decisions.
- Fail-open default (entity unavailable → do not skip), surfaced as a config choice.

```python
resp = await hass.services.async_call(
    "calendar", "get_events",
    {"start_date_time": start.isoformat(), "end_date_time": end.isoformat()},
    target={"entity_id": cal_id}, blocking=True, return_response=True,
)
has_holiday = bool((resp or {}).get(cal_id, {}).get("events", []))
```
- Don't rely on CalDAV `uid` (often missing, issue #170761). Don't bind Aurora to `python-holidays` directly — delegate to user-selected entities.

---

## 6. AI Task, LLM Vision & Robust Async AI

### 6.1 Built-in `ai_task` (preferred vision path)

```python
from homeassistant.components.ai_task import async_generate_data, GenDataTaskResult

result: GenDataTaskResult = await async_generate_data(
    hass, task_name="aurora_vision",
    entity_id=entity_id,             # None -> user's preferred (DATA_PREFERENCES.gen_data_entity_id)
    instructions="Classify ...",
    structure=build_vol_schema(...), # Python API needs a pre-built vol.Schema (YAML uses a dict)
    attachments=[{"media_content_id": f"media-source://camera/{cam}"}],  # local only; resolved to temp file
)
```
- `AITaskEntityFeature`: `GENERATE_DATA=1`, `SUPPORT_ATTACHMENTS=2`, `GENERATE_IMAGE=4`. Check `SUPPORT_ATTACHMENTS` before sending camera images or `async_generate_data` raises.
- Enumerate vision-capable entities via `hass.data.get(DATA_COMPONENT).entities` filtered by both feature flags (guard `DATA_COMPONENT` may be missing).
- Structured-output may fail on some local models (Ollama `gpt-oss`, Gemma) → catch `HomeAssistantError`, retry without `structure`, parse text.
- `conversation_id` in the result is tracking-only, not reusable for follow-up.

### 6.2 LLM Vision (HACS, optional)

```python
def get_llmvision_providers(hass) -> list[dict]:
    return [
        {"entry_id": e.entry_id, "title": e.title, "provider": e.data.get("provider")}
        for e in hass.config_entries.async_entries("llmvision")
        if e.data.get("provider") != "Settings"     # exclude timeline/retention entry
    ]
# is_llmvision_installed = bool(get_llmvision_providers(hass))
```
- `provider` parameter is the **config-entry ULID**, not a name. Use `ConfigEntrySelector({"integration": "llmvision"})` in `services.yaml`/flow.
- Service: `llmvision.image_analyzer(provider, message, image_entity=[...], max_tokens, target_width, ...)`, `SupportsResponse.ONLY`, result key `response_text`. LLM Vision has its own built-in fallback chain (Settings entry) — Aurora needn't replicate it.

### 6.3 Robust async wrappers (Gold observability)

```python
async with asyncio.timeout(25.0):           # stdlib only; async_timeout is removed
    ...
# retry: 2-3 attempts, exponential backoff (base 2s, cap 10s), per-attempt timeout
# CircuitBreaker: open after 3 failures, half-open after 60s recovery
# LatencyTracker: rolling deque(maxlen=20) exposing avg_ms / p95_ms as diagnostics
```
- `asyncio.timeout` must run inside a task (always true in HA service/entity methods).
- Circuit-breaker state is in-memory (resets on restart) — acceptable.

### 6.4 VisionProvider abstraction (capability-first)

Define a `Protocol` with `analyze_image(camera_entity_id, prompt, structure)` + `is_available`. Concrete impls: `AiTaskVisionProvider` (built-in, default), `LlmVisionProvider` (HACS). A future `ConversationVisionProvider` (multimodal `conversation`) is possible but `ai_task` already covers it. Each impl wraps its own `CircuitBreaker` + `LatencyTracker`. User picks the provider in the options flow; if none available, vision features are disabled but setup still succeeds.

---

## 7. Lovelace Card

- Lit + TypeScript custom card, auto-registered by the integration as a frontend extra-module URL (see DECISIONS §card auto-registration). Opt into the card picker via `getEntitySuggestion` in `window.customCards`.
- Avoid removed components: `ha-radio` → `ha-radio-group`/`ha-radio-option`; `ha-fab` → `ha-button`; `ha-top-app-bar` removed. CSS tokens: `--ha-sidebar-width`, `--ha-top-app-bar-width`. i18n via `@consumeLocalize()`.
- Data: `hass.connection.subscribeMessage({type:"aurora/subscribe"})` for live alarm list; `hass.callWS` for CRUD; custom `aurora/test_media`, `aurora/get_next_triggers` for extras.

---

## 8. Consolidated API Signature Quick-Reference

```python
# Coordinator / entities
DataUpdateCoordinator(hass, logger, *, name, config_entry, update_interval=None, always_update=False)
coordinator.async_set_updated_data(data)            # push
CoordinatorEntity.__init__(coordinator, context=...)
RestoreSensor.async_get_last_sensor_data() -> RestoreStateData | None

# Time (all @callback -> CALLBACK_TYPE)
async_track_point_in_utc_time(hass, action, point_in_time)   # one-shot, UTC
async_track_point_in_time(hass, action, point_in_time)       # one-shot, local
async_call_later(hass, delay, action)                        # passes UTC
dt_util.now()/utcnow()/as_utc()/as_local()/get_default_time_zone()

# Storage / collection
Store(hass, version, key, *, minor_version=1, atomic_writes=True)  # + async_load/save/delay_save/remove
collection.DictStorageCollection(store, id_manager)               # _process_create_data, _get_suggested_id
collection.DictStorageCollectionWebsocket(coll, api_prefix=, model_name=, create_schema=, update_schema=).async_setup(hass)

# Services / WS
hass.services.async_register(DOMAIN, name, handler, schema=, supports_response=)
async_register_admin_service(hass, DOMAIN, name, handler, schema=)
websocket_api.async_register_command(hass, handler)

# Config flow
ConfigFlow(domain=DOMAIN); OptionsFlowWithReload; ConfigSubentryFlow
self.add_suggested_values_to_schema(schema, values)
self.async_update_reload_and_abort(entry, data_updates=)      # top-level reconfigure
self.async_update_and_abort(entry, subentry, data=, title=)   # subentry reconfigure
self._get_entry(); self._get_reconfigure_subentry()           # subentry flow

# Calendar / AI
CalendarEntity.async_get_events(hass, start_date, end_date); .async_update_event_listeners()
ai_task.async_generate_data(hass, *, task_name, entity_id=None, instructions, structure=None, attachments=None, llm_api=None)
```

---

## 9. Primary Sources

- IQS: https://developers.home-assistant.io/docs/core/integration-quality-scale/ (+ /rules/, /checklist/)
- Manifest: https://developers.home-assistant.io/docs/creating_integration_manifest/
- Config entries / flow: https://developers.home-assistant.io/docs/config_entries_index/ , /docs/core/integration/config_flow/ , /docs/config_entries_options_flow_handler/
- Subentries: https://developers.home-assistant.io/blog/2025/02/16/config-subentries/ , .../2025/03/24/config-subentry-flow-changes/
- Fetching data / coordinator: https://developers.home-assistant.io/docs/integration_fetching_data/
- Event helpers / dt: core `homeassistant/helpers/event.py`, `homeassistant/util/dt.py`
- DST regression: https://github.com/home-assistant/core/issues/90293 ; RestoreEntity regression: .../issues/164802
- Storage/collection: core `homeassistant/helpers/storage.py`, `homeassistant/helpers/collection.py`
- WebSocket API: https://developers.home-assistant.io/docs/frontend/extending/websocket-api/
- Calendar: https://developers.home-assistant.io/docs/core/entity/calendar/ ; RRULE arch: .../architecture/discussions/797
- Holiday/Workday: https://www.home-assistant.io/integrations/holiday/ , .../workday/
- ai_task: https://developers.home-assistant.io/docs/core/entity/ai-task/ ; core `components/ai_task/*`
- LLM Vision: https://github.com/valentinfrlch/ha-llmvision
- Frontend 2026.6: https://developers.home-assistant.io/blog/2026/05/27/frontend-component-updates-2026.6/
- HACS publishing: https://www.hacs.xyz/docs/publish/integration/
- Service-helper hass deprecation: https://developers.home-assistant.io/blog/2025/09/22/deprecate-hass-argument-service-helpers/
</content>
</invoke>
