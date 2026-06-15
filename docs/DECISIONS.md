# Aurora — Architectural Decisions & Resolved Questions

**Date:** 2026-06-15
**Author:** Lead architect (Aurora)
**Companion:** `RESEARCH.md` (consolidated research + API signatures)
**Scope:** Resolve the 10 open research "dubbi", record key architectural decisions with rationale/alternatives, list the questions that genuinely need Gabriel, and provide a Phase 0 readiness checklist + risk register.

---

## 0. LOCKED (user-confirmed 2026-06-15)

These were put to Gabriel and **decided**; the rest of this document is consistent with them:

- ✅ **Multi-user model = subentries + `owner` field** (one installation, one subentry per alarm, per-person via owner label). **No real per-user isolation in v1** — deferred to a later phase. *This deviates from the literal wording of the dev prompt §2 ("un config-entry per persona") but honours its intent; the modern subentries pattern (GA 2025.7) did not exist when that line was written.*
- ✅ **Quality target = Platinum from day one** (strict end-to-end typing + `py.typed` + async). Cheap here because Aurora has no external Python deps.
- ⚙️ **Defaults for the still-open, non-blocking questions** (revisit anytime): reference display/wake-screen recipe defaults to **Fully Kiosk** (per the P4 reference fixture) while the core stays capability-first/auto-detecting; **Vision lands in Phase 3** (per dev prompt §8), MVP degrades to Tap/math; **long-term statistics (LTS) deferred** (not v1).

---

## A. Target Platform

| Item | Decision |
|---|---|
| `homeassistant` minimum (manifest) | **2026.3.0** |
| Tested / advertised against | **2026.6.3** (current stable) |
| Python baseline | **3.14** |

**Rationale:** 2026.3 is the first release that mandates Python 3.14 and bakes in everything Aurora relies on natively — PEP 695 `type` aliases, the `from __future__ import annotations` ban, finalized `ServiceInfo` paths, and explicit `DataUpdateCoordinator(config_entry=...)`. Building for 2026.3+ means **zero legacy compat shims**. Subentries (GA 2025.7) and the AI/`ai_task` framework are all available well before 2026.3. Picking 2026.3 over 2026.6 widens the install base by a quarter at no code cost: the only 2026.6-specific items Aurora touches (config-entry-listener-with-reload deprecation, removed frontend components) are simply built the modern way from day one rather than requiring a 2026.6 floor.

---

## B. Resolved Dubbi (the 10 open questions)

Confidence legend: **High** = settled, build it this way. **Medium** = sensible default chosen, revisit if a constraint appears. **Low** = needs benchmark/user input before locking.

### 1. Enumerate LLM Vision providers + graceful degradation — **High, no user input needed**
**Resolution:** Enumerate via `hass.config_entries.async_entries("llmvision")`, excluding the entry whose `data["provider"] == "Settings"` (that's the timeline/retention config, not a model). For the options-flow UI, prefer the built-in `ConfigEntrySelector({"integration": "llmvision"})` (returns the entry_id ULID HA expects) when at least one real provider exists; otherwise omit the field and show an informational note. Degrade: if `get_llmvision_providers(hass)` is empty, the LLM Vision option is hidden and the VisionProvider falls back to `ai_task` (or "disabled"). At `async_setup_entry`, re-validate the stored `vision_provider` entry_id still exists and is `domain == "llmvision"`; if not, log once and disable vision. Never hard-depend on `llmvision` (it stays out of `dependencies`; only optionally in `after_dependencies`).

### 2. Generic sunrise-ramp method + waking a tablet screen — **Medium, one user confirmation**
**Resolution:** Implement a **capability-tiered ramp executor** that picks the best mechanism per the selected target entity, never assuming a brand:
- **`light` with `color_temp_kelvin` + `brightness` supported** → stepped ramp from warm/dim to bright/cool over the configured fade window (use kelvin attributes; mireds are removed in 2026.3). Preferred for real bulbs/WLED-as-light.
- **WLED / effect-capable light** → if the entity exposes effects (`supported_features` / `effect_list` contains a sunrise effect), offer to trigger the native effect; otherwise fall back to brightness ramp.
- **`number` entity (screen/backlight brightness)** → ramp via `number.set_value` across the window.
- **`media_player`/cast screen or generic display** → no brightness API; ramp is not applicable, fall back to audio-only + (optional) screensaver-off action.
- **Tablet screensaver-off:** this is device-specific and **not** generically solvable. Aurora exposes an **optional user-provided "wake screen" action/script + entity** (e.g. Fully Kiosk Browser `switch`/`button`/`service`, or an Android `media_player`/notify). Aurora calls it at pre-wake; it does not try to auto-detect kiosk apps. Document the Fully Kiosk pattern as the reference recipe.
The ramp is driven by the scheduler firing stepped `async_call_later` updates (or a short-interval re-arm) between pre-wake and alarm time.
**User confirmation needed:** which display/tablet stack Gabriel actually uses (Fully Kiosk? Google Cast? Android tablet? WLED matrix?) so we ship the right reference recipe and default target picker filters.

### 3. Recurrence persistence: internalize vs scheduler-component — **High, no user input needed**
**Resolution:** **Internalize.** Aurora owns `AuroraAlarmSchedule` (dataclass: `repeat_mode` once/daily/weekly, `weekdays: frozenset[int]`, date bounds, skip fields, one-shot override). scheduler-component is a HACS component with no stable cross-integration read API and would break Gold's self-contained requirement; the native `schedule` helper lacks holidays/one-shot. Persist via HA `Store` (and/or subentry data). This is also what makes the calendar expansion and DST-safe scheduling possible.

### 4. Auto-register the card (no manual Lovelace resource) — **High, no user input needed**
**Resolution:** Bundle the built card JS under the integration and register it as a frontend extra-module URL at startup. Concretely: serve the file via a `StaticPathConfig`/HTTP view registered in `async_setup`, then `frontend.add_extra_js_url(hass, url)` (the supported replacement for the deprecated `hass.components.frontend.async_register_extra_module_url`). Register in **`async_setup`** (domain-level, once) — not `async_setup_entry` — to avoid re-registering on entry reload, and declare `dependencies: ["http", "frontend", "websocket_api"]`. Add the card to `window.customCards` from the JS with `getEntitySuggestion` so it appears in the card picker. Cache-bust the URL with the integration version. (HACS also auto-registers dashboard resources for cards, but Aurora ships as a single integration repo, so the integration self-registers to guarantee zero manual steps regardless of install method.)

### 5. Default Vision timeout / retry / circuit-breaker policy — **Medium (confirm via benchmark), no user input needed**
**Resolution (initial defaults, marked tunable):** per-attempt `asyncio.timeout(25s)`; `max_attempts=2` with exponential backoff (`base_delay=2s`, `cap=10s`); `CircuitBreaker(failure_threshold=3, recovery_timeout=60s, success_threshold=1)`; `LatencyTracker(window=20)` exposing `avg_ms`/`p95_ms` as diagnostic attributes. These are configuration constants in `const.py`, surfaced in diagnostics, and re-tuned after a real benchmark against the user's actual provider (local models can take 30-60s; cloud 2-10s). Vision calls are fire-and-forget relative to the alarm pipeline — a slow/failed vision call must never delay an alarm.

### 6. Model pre-warm at pre-wake — **Medium, no user input needed**
**Resolution:** Support an **optional, best-effort pre-warm** at pre-wake time for the configured Vision/AI entity, gated behind a capability/availability check and the circuit breaker. Because local providers (Ollama, etc.) frequently report `unavailable` between calls and there is no standard "warm" API, pre-warm is implemented as a tiny throwaway `async_generate_data` (or a no-op probe) wrapped in a short timeout, never blocking, with failures swallowed and logged once. It is **off by default** and only meaningful when a local provider is selected; for cloud providers it is a no-op. Do not rely on it for correctness — the alarm proceeds regardless.

### 7. DST / timezone handling for wall-clock triggers — **High, no user input needed**
**Resolution:** Always compute the next **local** wall-clock occurrence with `tzinfo=get_default_time_zone(), fold=0`, convert **once** to UTC via `dt_util.as_utc`, and schedule with `async_track_point_in_utc_time`. This sidesteps the known local-`time:`-trigger DST regression (issue #90293). Re-arm on `EVENT_CORE_CONFIG_UPDATE` (HA timezone change). Spring-forward: skip non-existent wall-clock times (UTC round-trip `_datetime_exists` check) and treat the alarm as firing at the first valid instant after the gap. Fall-back: `fold=0` deterministically picks the earlier (first) occurrence. The single-timer scheduler re-arms after every fire / config change / startup.

### 8. Multi-user: one entry per person vs subentries — **High default; confirm scope with user**
**Resolution:** **One config entry per Aurora installation; one `subentry_type="alarm"` per alarm; per-person modeling via an optional alarm field (`owner`/`profile`) and optionally a `subentry_type="user_profile"`** — NOT one config entry per person. Subentries give native UI add/remove/reconfigure per item, share the parent's runtime context, and map cleanly to the device registry (one device per alarm). Separate config entries would lose shared context and complicate the card/coordinator. HA has **no built-in per-user storage partitioning**, so true per-user private alarm sets are out of scope for v1; "multi-user" means labeled/owned alarms within one shared installation. **User confirmation:** is multi-user a hard v1 requirement, and does it need real per-user isolation (separate visibility/permissions) or just per-person labeling? Default assumes labeling.

### 9. Capability probe (does an entity satisfy a role?) + onboarding auto-detect — **High, no user input needed**
**Resolution:** Implement a `capabilities.py` with role probes that check, in order: **domain** (e.g. `media_player`, `light`, `number`, `calendar`, `binary_sensor`, `ai_task`), **`device_class`** where relevant (e.g. workday → `binary_sensor` with appropriate class), **`supported_features`** bitmask (e.g. `MediaPlayerEntityFeature.PLAY_MEDIA | VOLUME_SET`; `LightEntityFeature`/`ColorMode` for ramp; `CalendarEntityFeature`), and **presence of required services** (`hass.services.has_service(domain, service)`), plus **live availability** (`state not in (unavailable, unknown)`). Each role returns a typed `CapabilityResult(ok, missing=[...])` used both to filter `EntitySelector` choices in the flow and to validate at setup. Onboarding auto-detect: at first run, scan the registries for entities matching each role and pre-suggest the strongest candidate (e.g. a `media_player` in the bedroom area, a workday sensor, an `ai_task` entity with `SUPPORT_ATTACHMENTS`) via `suggested_value`. Use `EntitySelectorConfig(filter=EntityFilterSelectorConfig(domain=..., device_class=..., supported_features=[...]))` so the UI itself enforces most constraints.

### 10. Empty OPTIONAL selector fields without validation errors — **High, no user input needed**
**Resolution:** For every clearable optional field use `description={"suggested_value": current}` (never `default=`), apply via `self.add_suggested_values_to_schema(SCHEMA, current_values)`, and strip empties before persisting (`{k: v for k, v in user_input.items() if v not in ("", None)}`). Where the schema must accept None, wrap `vol.Any(None, EntitySelector(...))`. This is the documented, regression-free pattern (the 2026.1 "Unknown entity selected" warning was display-only and fixed in PR #29790).

---

## C. Key Architectural Decisions

### (a) Multi-user modeling — **Subentries + alarm owner field**
- **Decision:** One config entry per installation; alarms as subentries; optional `owner` field / `user_profile` subentry type for per-person labeling.
- **Rationale:** Native per-item UI management, shared runtime context, clean device-registry mapping, future-proof. HA lacks per-user storage isolation, so true isolation is deferred.
- **Alternatives considered:** One config entry per person (loses shared context, clutters UI, no shared global config); flat options-flow list (no per-item management); separate integration instances (heavy, no shared card/coordinator).

### (b) Dynamic alarm list storage — **`Store`-backed model as source of truth + collection helper as the WS/card transport**
- **Decision:** The mutable, card-editable alarm list lives in a `DictStorageCollection`-style model persisted via `Store(atomic_writes=True)`, exposed to the card through `DictStorageCollectionWebsocket` (auto `aurora/list|create|update|delete|subscribe`). Config-flow subentry creation writes into the same model. Singleton global config in a separate raw `Store`.
- **Rationale:** The collection helper eliminates ~300 lines of WS/subscription boilerplate and gives push updates for free; `Store` gives crash-safe persistence and supports the scheduler/calendar expansion that subentries alone don't. This reconciles "subentries are the idiomatic config-flow fit" (config-flow-entries research) with "DictStorageCollection is the idiomatic CRUD fit" (storage research).
- **Alternatives considered:** Pure subentries (clunky for rapid card CRUD, no push subscription transport, no fast in-memory mutable state); raw `Store` + hand-rolled WS (300 lines of avoidable boilerplate); Alarmo-style custom dispatcher (overkill for a config-record list).
- **Open build note:** define the exact ownership contract between subentry data and the collection store in Phase 1 (single writer = the collection; subentry flow delegates to it) to avoid dual-source drift.

### (c) Recurrence — **Internalize**
- **Decision:** Own `AuroraAlarmSchedule`; persist in HA `Store`; expand recurrences in Aurora's own `CalendarEntity.async_get_events` and scheduler.
- **Rationale:** Self-contained (Gold requirement), richer semantics (weekday sets, one-shot, holiday skip) than native `schedule`, no fragile HACS dependency.
- **Alternatives considered:** scheduler-component (HACS, no stable read API, switch.* entities); native `schedule` helper (no holidays/one-shot); raw RRULE delegated to core (core does not expand RRULE — discussion #797).

### (d) Card auto-registration — **Integration self-registers a frontend extra-module URL in `async_setup`**
- **Decision:** Serve bundled card JS via an HTTP static path and `frontend.add_extra_js_url` at domain setup; version-cache-busted; `window.customCards` + `getEntitySuggestion` for the picker.
- **Rationale:** Zero manual Lovelace resource step regardless of install method; registering in `async_setup` avoids duplicate registration on entry reload.
- **Alternatives considered:** Manual user-added resource (bad UX); HACS-only dashboard resource registration (only works for the HACS-frontend install path; integration self-registration is universal); registering in `async_setup_entry` (re-registers on every reload).

### (e) Generic sunrise-ramp — **Capability-tiered executor (light kelvin/brightness → WLED effect → number.set_value → audio-only) + optional user wake-screen action**
- **Decision:** Pick the ramp mechanism from the target entity's capabilities; never assume a brand. Tablet screensaver-off is an optional user-supplied action, not auto-detected.
- **Rationale:** Provider-agnostic (core project value), works across bulbs/WLED/tablet backlights/displays, degrades cleanly to audio-only.
- **Alternatives considered:** Light-only (excludes tablet/WLED users); hard-coding Fully Kiosk (not provider-agnostic); screen-brightness-only (excludes bulb users).

### (f) VisionProvider abstraction — **`Protocol` over ai_task (default) + LLM Vision (optional)**
- **Decision:** `VisionProvider` Protocol with `analyze_image(...)` + `is_available`; concrete `AiTaskVisionProvider` (built-in, preferred) and `LlmVisionProvider` (HACS, optional); each wraps its own timeout/retry/circuit-breaker/latency tracker; user selects in options flow; absent providers → vision disabled, setup still succeeds.
- **Rationale:** Capability-first and provider-agnostic; `ai_task` ships with HA (no extra install) and supports multimodal via `SUPPORT_ATTACHMENTS`; LLM Vision is a power-user upgrade. Robustness wrappers keep a slow/failing AI from affecting the alarm pipeline.
- **Alternatives considered:** LLM Vision only (HACS dependency, not built-in); ai_task only (misses LLM Vision power features/fallback chain); raw `conversation.async_converse` (no first-class attachment path — `ai_task` already covers multimodal).

---

## D. Questions That Genuinely Need Gabriel

1. **Display/tablet stack for sunrise + screen-wake:** Fully Kiosk Browser, Google/Nest Cast displays, Android tablet, WLED, smart bulbs — which do you actually use? This sets the default target filters and the reference "wake screen" recipe (Dubbio 2 / Decision e).
2. **Multi-user scope for v1:** Is multi-user required now, and does it need real per-user isolation (separate visibility/permissions) or just per-person labeling/ownership within one shared install? (Dubbio 8 / Decision a). Default = labeling only.
3. **Platinum from day one vs Gold-first:** Aurora can plausibly hit Platinum cheaply (no external deps → `async-dependency`/`inject-websession` are near-free; only `strict-typing` + `py.typed` is real work). Ship Gold first then upgrade, or hold the bar at Platinum from the start?
4. **Vision use-case priority:** Is camera/Vision analysis (e.g. "who/what triggered", presence-aware wake) a v1 feature or a later phase? This decides whether the VisionProvider + benchmark land in Phase 1 or are deferred.
5. **Long-term statistics:** Should Aurora expose LTS (alarm fire count, snooze count) via the recorder? If yes, we wire `StatisticMeanType` now (affects sensor design).

---

## E. Phase 0 Readiness Checklist (scaffold)

1. Create repo skeleton: `custom_components/aurora/` with `__init__.py`, `const.py`, `manifest.json`, `coordinator.py`, `entity.py`, `config_flow.py`, `models.py`, `capabilities.py`, `storage.py`, `scheduler.py`, `services.yaml`, `strings.json`, `translations/en.json`, `quality_scale.yaml`, `diagnostics.py`, `icons.json`.
2. Write `manifest.json` (domain `aurora`, `integration_type: hub`, `iot_class: local_push`, `quality_scale: gold`, `homeassistant: "2026.3.0"`, `version`, `dependencies: [http, frontend, websocket_api]`, `after_dependencies: [media_player, calendar, workday, ai_task]`, `codeowners`).
3. Define `type AuroraConfigEntry = ConfigEntry[AuroraCoordinator]` in `const.py`; establish the `entry.runtime_data` pattern; no `hass.data[DOMAIN]`.
4. Stub `AuroraCoordinator` (push-only, explicit `config_entry`, `always_update=False`, `_async_setup`).
5. Stub `async_migrate_entry` (VERSION=1, MINOR_VERSION=1) so migration infra exists from the start.
6. Define `AuroraAlarmSchedule` + `AuroraData` dataclasses (with `__eq__`) in `models.py`.
7. Scaffold `capabilities.py` role probes (media_player, light/ramp, number, calendar, workday binary_sensor, ai_task vision) returning `CapabilityResult`.
8. Scaffold config flow: user step + `OptionsFlowWithReload` + `async_step_reconfigure` + `AuroraAlarmSubentryFlowHandler` (user/reconfigure) using `suggested_value` + `add_suggested_values_to_schema`.
9. Scaffold storage: `DictStorageCollection` alarm model + `DictStorageCollectionWebsocket` (`api_prefix="aurora"`) + raw `Store("aurora.config", atomic_writes=True)`.
10. Scaffold single-timer scheduler using `async_track_point_in_utc_time` + UTC conversion + `EVENT_CORE_CONFIG_UPDATE` re-arm.
11. Scaffold `diagnostics.py` with `async_get_config_entry_diagnostics` + `async_redact_data`.
12. Write initial `quality_scale.yaml` with `discovery`/`discovery-update-info` exempt (+ comment) and `reauthentication-flow` exempt (pure-local).
13. Card scaffold: Lit + TS project, build to a single JS, integration self-registration via static path + `frontend.add_extra_js_url` in `async_setup`; `window.customCards` entry.
14. CI: GitHub Actions running `ruff format --check`, `ruff check`, `mypy --strict`, `pytest --cov`, and `hassfest`.
15. Tooling: `pyproject.toml`/`ruff.toml`, `.pre-commit-config.yaml`, `requires-python = ">=3.14"`, `py.typed` marker.
16. Brand assets placeholder (`icon.png` 256×256, `logo.png`) for the `brands` rule.
17. Test harness: `pytest-homeassistant-custom-component`, `tests/` layout, snapshot fixtures.

---

## F. Risks

1. **DST scheduling correctness** — highest-stakes for an alarm clock. Mitigation: UTC scheduling + spring-forward existence guard + `EVENT_CORE_CONFIG_UPDATE` re-arm; dedicated DST unit tests (spring-forward gap, fall-back fold, timezone change).
2. **Dual source of truth (subentries vs collection store)** — drift risk if both can write alarms. Mitigation: single-writer contract (collection store is authoritative; subentry flow delegates), defined in Phase 1.
3. **RestoreEntity/RestoreSensor 2026.3 Docker regression (#164802)** — could lose state on restart. Mitigation: Aurora persists in `Store` independently; verify the regression is fixed in target patch before release.
4. **Vision provider latency/availability** — local models slow/unavailable; could stall alarm if mishandled. Mitigation: fire-and-forget, timeout+retry+circuit-breaker, vision never on the alarm critical path; defaults tuned via benchmark.
5. **Provider-agnostic ramp gaps** — some targets (cast screens) have no brightness API. Mitigation: capability tiers with audio-only fallback; clear docs on what each target supports.
6. **LLM Vision API drift** — it's a HACS component (registers in sync `setup()`, `provider` = ULID, "Settings" entry quirk). Mitigation: keep it optional, validate at setup, isolate behind `LlmVisionProvider`.
7. **Frontend component churn (2026.6 removals)** — `ha-radio`/`ha-fab`/`ha-top-app-bar` gone; more may follow. Mitigation: use current components/CSS tokens, pin tested HA versions in CI, snapshot card behavior.
8. **Gold/Platinum test-coverage burden (>95%)** — large surface (scheduler, flows, calendar, vision, WS). Mitigation: TDD from Phase 1, snapshot testing for entity state, coverage gate in CI.
9. **Holiday/workday skip timing** — async service calls are unsafe at alarm-fire time. Mitigation: pre-compute next ~7 days of skip decisions in the coordinator; fail-open default.
10. **Card auto-registration fragility across install methods** — extra-module URL registration and cache-busting can break on upgrade. Mitigation: version-stamped URL, register in `async_setup`, integration test the resource is served.
</content>
