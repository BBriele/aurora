# Vision mission tuning — per-alarm prompt, benchmark UI, pre-warm — Design

> Status: approved-for-planning (2026-06-18). Completes the Phase 3 AI-vision
> selfie mission. The backend inference path, circuit breaker, rolling latency
> window, `benchmark_vision` service, `aurora/vision/check` WS command,
> `sensor.aurora_vision_latency`, and the in-overlay selfie capture already
> exist. This adds the missing **user-facing config + tuning**: per-alarm vision
> prompt editing, a benchmark button with results, and model pre-warm. See
> [DECISIONS](../../DECISIONS.md), [AURORA_DEV_PROMPT](../../../AURORA_DEV_PROMPT.md) §6.

## Goal

Make the vision mission configurable and self-tuning from the UI, and hide
cold-model latency, without changing the working inference path. Three
independent pieces:

1. **Per-alarm vision prompt** — expose `mission.vision_prompt` in the editor
   (backend already reads it; the editor never wrote it).
2. **Benchmark UI** — a "Run benchmark" button surfacing `benchmark_vision`
   results inline.
3. **Pre-warm** — a best-effort warm-up inference before the alarm fires, so the
   first real selfie check is fast on cold local models.

## Locked decision: runtime stats reflect real usage only

`sensor.aurora_vision_latency` (rolling avg) and the circuit breaker must reflect
**only real mission checks**. Synthetic inferences — the benchmark loop and the
pre-warm — must NOT feed the rolling latency window nor trip/affect the breaker.

Today this is violated: `async_vision_benchmark` calls `async_vision_check` in a
loop, and `async_vision_check` records both latency and breaker outcome. Fix: add
a keyword-only `record_stats: bool = True` to `async_vision_check`; benchmark and
pre-warm pass `record_stats=False`. The benchmark still computes its own
min/avg/max from the returned `latency_ms`; it just stops polluting the sensor.

---

## Piece 1 — Per-alarm vision prompt (frontend only)

**Files:** `aurora-card/src/alarm-dialog.ts`, `aurora-card/src/translations.ts`,
`aurora-card/src/mission-overlay.ts` (stale comment).

- `types.ts` already declares `mission.vision_prompt?: string | null` — no type
  change.
- Add `@state() private _visionPrompt = "";`.
- In `_populate`: `this._visionPrompt = a?.features.mission.vision_prompt ?? "";`.
- In `_missionParamsBlock()` add a `vision` branch rendering an `ha-textarea`
  (label `mission.vision_prompt`, placeholder `mission.vision_prompt_ph`), bound
  to `_visionPrompt`. Empty is valid.
- In `_save`, change the mission object to:
  ```ts
  mission: {
    ...prev?.mission,
    type: this._mission,
    params: this._missionParams,
    vision_prompt: this._mission === "vision" ? (this._visionPrompt.trim() || null) : null,
  },
  ```
  Empty/whitespace → `null` → backend falls back to `DEFAULT_VISION_PROMPT`. No
  need to mirror the default string in the frontend.
- Remove the now-false comments: `mission-overlay.ts:28` ("Vision is wired in a
  later increment — for now it degrades to math") and the `alarm-dialog.ts`
  comment that lists vision prompt among fields "the dialog does not edit".

**Test:** covered by the existing build + a live edit/save round-trip (the model
round-trip is already tested in Python). No new pure test needed — it is wiring.

## Piece 2 — Benchmark UI (frontend + one api helper)

**Files:** `aurora-card/src/api.ts`, `aurora-card/src/globals-view.ts`,
`aurora-card/src/translations.ts`.

- `api.ts`: 
  ```ts
  export interface BenchmarkResult {
    samples: number; succeeded: number; failed: number;
    latency_ms: { min: number | null; avg: number | null; max: number | null };
  }
  export async function benchmarkVision(hass: HomeAssistant, samples: number): Promise<BenchmarkResult> {
    const res = await hass.callService("aurora", "benchmark_vision", { samples }, undefined, false, true);
    return res.response as BenchmarkResult;
  }
  ```
- `globals-view.ts`: below the `vision_provider` picker, a **Run benchmark**
  `ha-button` (fixed `samples = 3`). On click: set a `_benchRunning` state
  (button disabled + spinner text), `await benchmarkVision(...)`, store
  `_benchResult`. Render an inline result block: `succeeded/failed` and
  `min · avg · max ms`. On throw: inline `ha-alert` (error) with the message.
  No dialog — inline, lazy. Hidden entirely when no `vision_provider` is bound.
- i18n keys: `globals.run_benchmark`, `globals.benchmark_running`,
  `globals.benchmark_result` (a template like `{ok}/{n} ok · {min}/{avg}/{max} ms`),
  `globals.benchmark_failed` (en + it).

**Test:** build compiles; live click against the real provider.

## Piece 3 — Pre-warm (backend)

**Files:** `custom_components/aurora/coordinator.py`,
`custom_components/aurora/const.py`, `tests/test_coordinator_prewarm.py` (CI).

Pre-warm runs a single throwaway inference so the model is loaded before the
first real check. Both triggers (user picked "entrambi"):

- **Hook A (sleep-aware):** call it at the top of `_start_prewake()`.
- **Hook B (always):** `_maybe_schedule_prewarm()`, called from the same rearm
  path as `_maybe_schedule_prewake()`, arms `async_track_point_in_utc_time` at
  `fire_at_utc - PREWARM_LEAD_S` when the next alarm's mission is `vision` and a
  vision provider is configured. Stored in `_unsub_prewarm`.

A `_warmed_alarm_id: str | None` guard ensures **at most one** warm-up per
schedule cycle — whichever trigger fires first warms; the other is a no-op. It is
reset (and `_unsub_prewarm` cancelled) on rearm / `_cancel_prewake`.

```python
async def _async_vision_prewarm(self, alarm: AuroraAlarm) -> None:
    """Best-effort warm-up so the first real selfie check is not cold."""
    if alarm.features.mission.type != MissionType.VISION:
        return
    if self._warmed_alarm_id == alarm.id:
        return
    options = self._effective_options(alarm)
    if not _first_entity(options.get(ROLE_VISION_PROVIDER)):
        return
    if not self._vision_breaker.allow(time.monotonic()):
        return
    self._warmed_alarm_id = alarm.id
    image = await self.hass.async_add_executor_job(self._sample_image_b64)
    with contextlib.suppress(Exception):
        await self.async_vision_check(image, alarm.id, record_stats=False)
```

- Extract `_sample_image_b64()` from `async_vision_benchmark` (shared helper,
  Pillow-backed) so both reuse it.
- `async_vision_check(self, image, alarm_id, *, record_stats: bool = True)`:
  guard the `self._vision_latency.add(...)` and `self._vision_breaker.record(...)`
  calls behind `if record_stats:`.
- `async_vision_benchmark` passes `record_stats=False` to its inner check calls.
- `const.py`: `PREWARM_LEAD_S: Final = 60`.
- Pre-warm tasks are fire-and-forget via `config_entry.async_create_task`,
  non-blocking, never raise into the state machine.

**Tests (CI, import HA):** `tests/test_coordinator_prewarm.py`
- warms once when mission=vision + provider bound (asserts `async_vision_check`
  called with `record_stats=False`);
- no-op when mission != vision;
- no-op when no provider bound;
- the guard prevents a second warm in the same cycle;
- benchmark/pre-warm do not change `vision_latency_ms` (record_stats path).

---

## Release

- `manifest.json` `version` → `0.18.0`; `__init__.py` `_CARD_VERSION` → `0.18.0`.
- `CHANGELOG.md` (Keep a Changelog, English, no emoji): Added — per-alarm vision
  prompt, benchmark button; Changed — latency sensor/breaker now reflect real
  mission checks only (benchmark no longer pollutes them); pre-warm.
- `cd aurora-card && npm run build` to emit `www/aurora-card.js`.
- Live test on the instance: bind a vision provider, set a vision-mission alarm
  with a custom prompt, run the benchmark (see min/avg/max), trigger the alarm
  and confirm the first selfie check is fast (pre-warmed) and the prompt is used.

## Out of scope

- Per-alarm vision *provider/model* selection (stays global in Profiles).
- A dedicated Settings tab (UX-IA.md redesign) — benchmark lives in the existing
  globals/devices view for now.
- Recording or charting benchmark history (LTS deferred per DECISIONS).
