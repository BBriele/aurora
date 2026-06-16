<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# 🌅 Aurora

**A smart, modular alarm clock for Home Assistant — one product for thousands of different setups.**

*As easy as your phone's alarm app, far richer. Capability-first, provider-agnostic, degrades gracefully.*

</div>

> **Status: v0.5.0 — installable via HACS.** Recurring alarms ring (audio fade-in / sunrise / notification), snooze & dismiss, a sleep-aware smart wake, calendar auto-skip, a spoken wake-up briefing, and a **custom Aurora app** (sidebar panel + dashboard card) that manages everything from a localized UI — no YAML, no HA config screens. English-first, Italian included. See the [Roadmap](#roadmap) for what's next.

---

## What is Aurora?

Aurora is a Home Assistant **custom integration + Lovelace card** that turns HA into a full-featured alarm clock — capable of replacing your phone's routine alarms — while running on **anyone's** setup, from the most spartan (a single `media_player`, or just a phone notification) to the richest (kiosk tablet + smartwatch + AI vision + smart lights).

The guiding principle: **rich hardware *enables* features, it is never a *prerequisite*.** Anything you don't have simply degrades with grace — and **the exact alarm time is never missed.**

### Capability-first (no hardcoded entities)

The core never knows about specific integrations or `entity_id`s. It reasons in terms of **abstract roles**, each backed by auto-detected adapters with a generic fallback:

| Role | What it does | Fills it (auto-detected) | Fallback |
|---|---|---|---|
| `AudioSink` | ringtone + fade-in volume | a `media_player` that supports `play_media` | notify / overlay |
| `WakeLight` | sunrise ramp | a dimmable `light`/WLED, or a `number` (screen backlight) | audio only |
| `DisplaySurface` | ring/sunrise view | a `media_player` / `switch` / `light` (kiosk) | ring via `NotifyChannel` |
| `NotifyChannel` | ring channels | any `notify.*` entity | `persistent_notification` (always present) |
| `SleepSignal` / `PresenceSignal` | smart (early) wake | `binary_sensor` / `sensor` | **exact time guaranteed** |
| `VisionProvider` | AI selfie mission *(Phase 3)* | an `ai_task` entity or an LLM Vision provider | Tap / math mission |
| `Conversation` | voice control *(Phase 4)* | a `conversation` agent | native HA intents |
| `TTS` | spoken briefing | any `tts.*` entity | text notification |

## Installation

### HACS (recommended)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/BBriele/aurora`, category **Integration**.
2. Search **Aurora** in HACS, **Download**, then **restart Home Assistant**.
3. **Settings → Devices & Services → Add Integration → Aurora.** One click; nothing else is required.
4. Open **Aurora** in the sidebar (or add the *Aurora* card to a dashboard) and bind your devices.

> The Lovelace card is registered automatically — there is **no manual "resource" step**. After updating, do a hard refresh (Ctrl/Cmd+F5).

### Manual

Copy `custom_components/aurora/` into your HA `config/custom_components/` directory and restart, then add the integration as in step 3 above.

## Removal

1. **Settings → Devices & Services → Aurora → ⋮ → Delete.** This removes the config entry, its entities, and stored alarms.
2. If installed via HACS, remove it from HACS too.
3. Remove the *Aurora* card from any dashboard you added it to. (The sidebar panel and the card resource are unregistered automatically on restart.)

## Getting started & configuration

Everything is managed from the **Aurora app** (sidebar) or the **Aurora dashboard card** — no YAML needed. The app has three tabs:

- **Alarms** — your alarms (per user). Create/edit with time, label, repeat (once / daily / weekly + days), and the per-alarm features below.
- **Devices** — *your* role bindings (per user). Bind only what you have; everything is optional.
- **Shared** — installation-wide settings (below).

### Installation parameters

Setup is a single click — there are **no required parameters**. An optional **owner** (a display name) can be set during setup or later via **⋮ → Reconfigure**.

### Configuration parameters

**Per-user device bindings** (Devices tab) — one entity (or several, where noted) per role: *Speaker, Light/screen, Display surface, Notifications (multiple), Sleep signals (multiple), Presence signals (multiple), Voice agent, Text-to-speech*.

**Shared settings** (Shared tab):

| Setting | Meaning |
|---|---|
| Max ring duration | Safety auto-stop if a ring is never dismissed (default 10 min). |
| Skip-day calendars | Alarms are skipped on days with an event in these calendars. |
| Holiday calendars | Same, for holidays (auto-skip). |
| Weather (briefing) | `weather.*` entity read by the briefing. Empty = auto-detect. |
| Briefing calendars | Calendars read for "today's events". Empty = auto-detect. |
| To-do lists | `todo.*` lists read for open items. Empty = auto-detect. |

**Per-alarm features** (in the alarm editor):

| Feature | Options |
|---|---|
| Repeat | once / daily / weekly (+ weekdays) |
| Anti-snooze mission | Tap *(more in Phase 3)* |
| Sound | media URI / playlist (optional; uses your Speaker) |
| Snooze | max count + length (min) |
| Rising volume | fade-in on/off |
| Sunrise | light/screen ramp + duration |
| Smart wake | ring earlier when your sleep signals say you're stirring (exact time always kept) + window (min) |
| Wake-up briefing | speak time / weather / calendar / to-dos when you stop the alarm; selectable blocks; optional custom template |

## Supported devices & functions

Aurora is **brand-agnostic**: any entity that fills a role works (see the roles table above). Concretely it supports:

- **Speakers**: any `media_player` (Google/Nest, Sonos, Music Assistant, Squeezelite, AirPlay, ESPHome…) with `play_media`.
- **Lights**: any dimmable `light` (Hue, WLED, Zigbee…) or a `number` entity for screen/backlight ramps.
- **Notifications**: any `notify.*` channel (Companion app, etc.); `persistent_notification` is always used as a floor.
- **Sleep/presence**: any `binary_sensor`/`sensor` (Sleep as Android, mattress/watch sensors, mmWave presence…).
- **TTS**: any `tts.*` engine (Piper, Cloud, Google…). **Calendars/to-dos**: any `calendar.*` / `todo.*`.

**Functions**: recurring alarms with DST-safe scheduling; ringtone with fade-in; multi-stage sunrise; snooze/dismiss; skip-next + calendar/holiday auto-skip; sleep-aware early wake with guaranteed exact-time fallback; spoken wake-up briefing (English default, localizable, template-overridable); per-user alarms and device profiles with a shared settings page.

## Actions (services)

All actions live under the `aurora.` domain:

| Action | Description | Fields |
|---|---|---|
| `aurora.add_alarm` | Create an alarm | `time` (req), `label`, `owner`, `enabled`, `schedule`, `features` |
| `aurora.update_alarm` | Update an alarm | `id` (req), any of `time`, `label`, `enabled`, `skip_next`, `schedule`, `features` |
| `aurora.remove_alarm` | Delete an alarm | `id` (req) |
| `aurora.skip_next` | Skip the next occurrence | `id` (req) |
| `aurora.snooze` | Snooze the active ring | — |
| `aurora.dismiss` | Stop the active ring | — |
| `aurora.trigger_now` | Ring immediately (testing) | `id` (optional) |
| `aurora.speak_briefing` | Compose & speak the briefing now | `id` (optional) |
| `aurora.benchmark_vision` | Measure AI-vision latency *(Phase 3)* | `samples` |

> Day-to-day you won't call these — the app does it for you. They exist for automations and power users.

## Use cases & examples

- **Phone-only** — bind the Companion app as a Notification channel; alarms notify and snooze from your phone.
- **Voice-first** — Echo/Nest speaker as the Speaker + Hue light as the Sunrise; wake to a sunrise and a spoken briefing.
- **Tablet + WLED** — a kiosk tablet as Display surface, WLED as Sunrise.
- **Power user** — speaker + watch sleep signal + TTS: sleep-aware early wake and a full morning briefing.

Speak the briefing from an automation:

```yaml
automation:
  - alias: "Morning briefing on arrival in kitchen"
    triggers:
      - trigger: state
        entity_id: binary_sensor.kitchen_presence
        to: "on"
    conditions:
      - condition: time
        after: "06:00:00"
        before: "09:00:00"
    actions:
      - action: aurora.speak_briefing
```

Add an alarm from an automation:

```yaml
- action: aurora.add_alarm
  data:
    time: "06:45"
    label: "Gym"
    schedule: { repeat_mode: weekly, weekdays: [0, 2, 4] }
    features:
      audio: { enabled: true, volume_profile: fade_in }
      briefing: { enabled: true, blocks: [time, weather, calendar] }
```

## Troubleshooting

- **Alarm rings but there's no sound.** Bind a **Speaker** in *Devices*. Without one, alarms only show a notification — Aurora raises a repair issue to remind you.
- **The briefing doesn't speak.** It needs a **Text-to-speech** entity *and* a **Speaker** bound; otherwise it falls back to a persistent notification with the text.
- **The card briefly says "custom element doesn't exist."** The bundle loads asynchronously after the page; it resolves on its own — hard-refresh if needed.
- **Smart wake / calendar skip not working.** Bind your **Sleep/Presence signals** (Devices) and **Skip/Holiday calendars** (Shared). Smart wake still falls back to the exact time.
- **Wrong language.** The card and briefing follow your Home Assistant language (English by default, Italian included; other languages fall back to English). Override the briefing text per-alarm with a custom template.

## Known limitations

- **Missions**: only *Tap/Stop* is enforced in the ring screen today. Math / QR / Shake / Open-door / **AI Vision selfie** are modeled but land in **Phase 3**; `benchmark_vision` and the vision-latency sensor are placeholders until then.
- **Per-user isolation is "soft"**: the UI filters alarms/devices by the logged-in HA user, but the backend store is shared — it's a convenience split, not a security boundary.
- **Calendars/to-dos** are read best-effort; a provider that doesn't expose `calendar.get_events` / `todo.get_items` simply contributes nothing to the briefing.
- **One active ring** at a time per installation.

## How it works (architecture & data model)

Clean MVC, three decoupled pieces:

- **Model** — a dynamic alarm list persisted to HA storage (versioned, migratable). The config entry holds only role bindings + shared settings.
- **Controller** — `coordinator.py`: a **push-driven** scheduler + state machine `idle → pre-wake → ringing → snoozed → mission → dismissed → post-wake`. A single UTC timer is armed for the nearest alarm and re-armed on changes; times are computed in local wall-clock and converted once to UTC so **DST and timezone changes never drop an alarm**. Role adapters are resolved at ring time.
- **View** — a Lit/TypeScript card consuming stable read-models only (it never touches adapters): a `State` sensor, a `Next alarm` timestamp sensor, a `Ringing` binary sensor, and a diagnostic `Vision latency` sensor (disabled by default).

**Data updates** are event-driven (no polling): the coordinator pushes a new snapshot to its entities whenever the state machine advances or alarms change. AI calls (Phase 3) are always non-blocking (timeout + retry + circuit-breaker), and the exact alarm time is guaranteed even when every optional sensor is down.

## Roadmap

- ✅ **Phase 0 — Scaffold:** roles/capabilities + generic adapters, 1-click config flow with auto-detect, storage, CRUD services.
- ✅ **Phase 1 — MVP:** recurring alarm → ring on Speaker/Notification (+ sunrise), Tap mission, snooze/dismiss.
- ✅ **Phase 2 — Modularity:** ringtones, volume fade-in, sleep-aware smart wake, skip-next + calendar/holiday auto-skip, TTS briefing.
- ✅ **Phase 4 — View & multi-user:** Lit card + sidebar app, per-user alarms & device profiles, shared settings, full **i18n** (English-first).
- ⏳ **Phase 3 — Advanced missions:** open-door, AI selfie vision (provider/model/prompt + benchmark), math/QR/shake, graceful Vision → Tap/math.
- ⏳ **Phase 4 (rest) — Voice:** Assist intents, ring channels, post-wake routines.
- ⏳ **Phase 5 — Packaging & quality:** brands submission, test coverage, strict typing, hassfest/HACS CI.

## Repository layout

```
custom_components/aurora/   # the integration (backend + bundled card build)
aurora-card/                # Lit/TypeScript card sources → built into the integration's www/
docs/                       # research notes, decisions, design docs
```

## Contributing & development

```bash
cd aurora-card
npm ci
npm run build       # bundles to ../custom_components/aurora/www/aurora-card.js
npm run lint        # tsc --noEmit
python ../tests/validate_assets.py   # JSON + translation parity
```

## License

MIT — see [`LICENSE`](LICENSE).

---

<div align="center">
<sub>Built capability-first so it works on <em>your</em> Home Assistant — whatever that looks like.</sub>
</div>
