# Vision: layered defaults + per-level tuning — Design

> Status: approved-for-planning (2026-06-18). Builds on the 0.18.x vision
> mission work. Adds a 3-level resolution chain for the vision prompt, a 2-level
> chain for the model and the robustness knobs (timeout / retries / max-fails),
> and a criteria "prompt builder". See
> [vision tuning spec](2026-06-18-vision-mission-tuning-design.md), [DECISIONS](../../DECISIONS.md).

## Goal

Let the user tune the AI-vision selfie mission at the right altitude instead of
only per-alarm. Every vision parameter resolves through a chain, most-specific
wins:

| Setting | Global (Shared) | Per-user (Setup) | Per-alarm | Built-in fallback |
|---|---|---|---|---|
| **Prompt** | default | override | override *(exists)* | `DEFAULT_VISION_PROMPT` |
| **Model** | default | override | — | provider default (omit param) |
| **Timeout (s)** | default | override | — | `VISION_TIMEOUT_S` |
| **Retries** | default | override | — | `VISION_MAX_ATTEMPTS` |
| **Max fails → degrade** | default | override | — | `3` (today's `VISION_MAX_FAILS`) |

Plus a **criteria builder**: a row of toggle chips (standing / eyes open / face
detected) that *generate* the prompt text into the adjacent field. Only the
resulting string is stored — one source of truth, no text-vs-toggle conflict.
The chips are write-only helpers; after generating you may free-edit the text.

## Storage

- **Global** → `config_entry.options`: `vision_prompt`, `vision_model`,
  `vision_timeout_s`, `vision_retries`, `vision_max_fails` (all optional).
- **Per-user** → `options[CONF_PROFILES][profile_id]` profile-level keys (NOT in
  the bindings sub-dict): same five keys.
- **Per-alarm** → `alarm.features.mission.vision_prompt` (already exists).

`vision_model` applies to the **LLM Vision** path only (`image_analyzer` gets a
`model` param); `ai_task` entities use their own configured model.

## Backend (`custom_components/aurora/`)

**`coordinator.py`**
- New resolver returning the effective values for an alarm:
  ```python
  def _resolve_vision(self, alarm: AuroraAlarm | None) -> dict:
      """Effective vision params: per-alarm → per-user profile → global → default."""
      options = dict(self.config_entry.options)
      profiles = options.get(CONF_PROFILES) or {}
      profile = profiles.get(alarm.profile_id or "") if (alarm and isinstance(profiles, dict)) else None
      profile = profile if isinstance(profile, dict) else {}

      def pick(key, default):
          v = profile.get(key)
          if v not in (None, ""):
              return v
          v = options.get(key)
          return v if v not in (None, "") else default

      prompt = (alarm.features.mission.vision_prompt if alarm and alarm.features.mission.vision_prompt
                else pick("vision_prompt", DEFAULT_VISION_PROMPT))
      return {
          "prompt": prompt,
          "model": pick("vision_model", None) or None,
          "timeout_s": float(pick("vision_timeout_s", VISION_TIMEOUT_S)),
          "retries": int(pick("vision_retries", VISION_MAX_ATTEMPTS)),
      }
  ```
- `async_vision_check`: replace the prompt-only logic with `v = self._resolve_vision(alarm)`.
  Use `v["prompt"]`, wrap the inference in `asyncio.timeout(v["timeout_s"])`, loop
  `range(v["retries"])`, and pass `v["model"]` into `_async_vision_infer`. (Keep
  `record_stats` behaviour from 0.18.0 untouched.)
- `_async_vision_infer(self, image_path, media_uri, prompt, options, *, model=None)`:
  when `model` is set, add `"model": model` to the `llmvision.image_analyzer`
  service data. (ai_task branch unchanged.)
- Coerce bad stored numbers defensively (wrap the `float()/int()` in the picker
  with a try/except → fall back to the constant).

**`websocket.py`**
- `settings/get` already returns `options`, `profiles`, `vision_providers`. No new
  resolver needed server-side for the UI; the frontend resolves max-fails itself
  from `options` + the ringing alarm's profile. Confirm `settings/set` already
  merges arbitrary new option keys and per-profile keys without wiping siblings
  (the existing merge comment says it does) — add a test if not.

**No `const.py` change** beyond reusing existing `VISION_TIMEOUT_S`,
`VISION_MAX_ATTEMPTS` as the built-in fallbacks.

## Frontend (`aurora-card/src/`)

**New shared module `vision-prompt.ts`** (DRY across the two editors):
- `VISION_CRITERIA = ["standing", "eyes_open", "face"]`.
- `composeVisionPrompt(criteria: string[], lang?: string): string` — joins the
  localized clause for each selected criterion into one instruction sentence
  (e.g. "Answer only YES or NO: is the person standing up, with both eyes open,
  and their face clearly visible?"). Empty list → "".
- `renderVisionPrompt(value, lang, onChange)` → `TemplateResult`: a row of chip
  buttons (one per criterion) that call `onChange(composeVisionPrompt([...]))`,
  plus an `ha-textarea` bound to `value` emitting `onChange(text)` on input.
  Stateless generator — chips write text, text is the stored value.

**`globals-view.ts` (Shared)** — extend the vision section with:
- `renderVisionPrompt(this._options.vision_prompt, …)` → writes `_options.vision_prompt`.
- model `ha-textfield` (placeholder `e.g. gemma3, qwen2.5vl`) → `_options.vision_model`.
- three number `ha-textfield`s: timeout_s / retries / max_fails → the matching
  `_options` keys. (Run-benchmark button stays.)

**`devices-view.ts` (Setup)** — add a per-user **Vision** sub-section (mirrors the
globals fields but writes into the active profile object): prompt+criteria,
model, timeout_s, retries, max_fails. Reuse the existing profile-save path that
preserves `bindings`/`audio_presets`; these are new sibling keys on the profile.

**`mission-overlay.ts`** — stop using the hardcoded `VISION_MAX_FAILS`; on
connect, resolve it from settings: `profile(owner)?.vision_max_fails ??
global.vision_max_fails ?? 3` (fetch via the existing `getSettings`). Fallback 3
if settings unavailable.

**`translations.ts`** (en + it): criteria chip labels (`vision.crit_standing`,
`vision.crit_eyes_open`, `vision.crit_face`), the composed-sentence template
(`vision.prompt_template`), and field labels for model / timeout / retries /
max-fails in both the globals and per-user sections.

## Out of scope

- Per-alarm model / timeout / retries (only the prompt is per-alarm).
- Enumerating available models (free-text field; empty = provider default).
- Persisting criteria as structured toggles (they generate text only).
- A model selector dropdown (text field is enough; HACS/LLM-Vision model lists
  aren't reliably enumerable).

## Test plan

- Pure (local): `composeVisionPrompt` clause ordering + empty case
  (`tests`/vitest if present, else a `vision-prompt` assert). Backend resolver
  precedence is pure-ish but lives on the coordinator → CI test
  `test_coordinator_vision_resolve.py` (per-alarm > profile > global > default for
  each of prompt/model/timeout/retries).
- Live (Chrome): set a global prompt+model+timeout; set a different per-user
  override; confirm an alarm with no per-alarm prompt uses the per-user value;
  run the benchmark; trigger the alarm and confirm the resolved prompt is used.
