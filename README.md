<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# 🌅 Aurora

**A smart, modular alarm clock for Home Assistant — one product for thousands of different setups.**

*Easy as your phone's alarm app, far richer. Capability-first, provider-agnostic, degrades gracefully.*

</div>

> 🚧 **Status: in active development (v0.1.0).** Installable via HACS as a custom repository. A working MVP: alarms ring (audio fade-in / sunrise / notification), snooze & dismiss, plus a **custom Aurora app** — a full-page panel in the sidebar *and* a dashboard card — to manage alarms and devices entirely from a custom UI (no YAML, no HA config screens). Built in incremental, end-to-end testable phases (see [Roadmap](#roadmap)).

---

## What is Aurora?

Aurora is a Home Assistant **custom integration + Lovelace card** that turns HA into a full-featured alarm clock — capable of replacing your phone's routine alarms — while running on **anyone's** setup, from the most spartan (a single `media_player` or just a phone) to the richest (kiosk tablet + smartwatch + AI vision + smart lights).

The guiding principle: **rich hardware *enables* features, it is never a *prerequisite*.** Anything you don't have simply degrades with grace — and **the exact alarm time is never missed.**

## Core ideas

### Capability-first (no hardcoded entities)

The core never knows about specific integrations or `entity_id`s. It reasons in terms of **abstract roles**, each backed by auto-detected adapters with a generic fallback:

| Role | What it does | Generic fallback |
|---|---|---|
| `DisplaySurface` | sunrise/ring view, overlay | none → ring via `NotifyChannel` |
| `AudioSink` | ringtone + fade-in volume | any `media_player`; none → notify/overlay |
| `WakeLight` | sunrise ramp | any `light`; none → audio only |
| `VisionProvider` | AI selfie anti-snooze mission | none → Tap or math mission |
| `SleepSignal` | smart (early) wake | none → **exact time guaranteed** |
| `NotifyChannel` | ring channels | `persistent_notification` always available |
| `Conversation` | voice control via Assist | native HA intents |
| `TTS` | spoken briefing | text briefing on display/notify |
| `Briefing` | time/weather/calendar/todo | static template |

### Setup tiers (progressive disclosure)

| Tier | Requirement | Unlocks |
|---|---|---|
| **T0 — Bare minimum** | *one* output: a `NotifyChannel` (even just `persistent_notification`) **or** an `AudioSink` | Alarm rings/notifies, snooze, Tap mission. **Aurora already works here.** |
| **T1 — Audio + Light** | + a `media_player` and/or a `light`/WLED/screen | Ringtone with fade-in, sunrise ramp |
| **T2 — Smart wake** | + one or more `SleepSignal`/`PresenceSignal` | Sleep-aware early wake (with exact-time fallback) |
| **T3 — AI & rich surfaces** | + kiosk `DisplaySurface`, `VisionProvider`, `Conversation`, `TTS` | AI selfie mission, voice briefing, tablet overlay, voice control |

### Target personas (tested beyond a single setup)

- **P1 "Phone only"** — Companion App, no tablet/AI/watch. Full alarm via phone audio, actionable ring, snooze, Tap mission.
- **P2 "Voice-first"** — Echo/Nest + some Hue lights. Sunrise on Hue, voice control, no tablet/vision.
- **P3 "Generic tablet + WLED, no AI"** — browser_mod tablet, WLED sunrise, math mission.
- **P4 "Power user"** — kiosk + watch + LLM Vision + Sleep as Android. Every feature.

## Architecture

Clean MVC, three decoupled pieces (the Alarmo model: backend / config / card):

- **Model** — dynamic alarm list persisted to HA storage (versioned, with migration). Config entry holds only role bindings.
- **Controller** — `coordinator.py`: scheduler + state machine `idle → pre-wake → ringing → snoozed → mission → dismissed → post-wake`. Role adapters resolved at runtime.
- **View** — a LitElement/TypeScript Lovelace card that consumes stable read-models only (never touches adapters), with progressive disclosure of configured features.

**Backend robustness:** AI calls are always non-blocking (async, timeout, retry, circuit-breaker); ring state survives restarts; one active ring per user; the exact time is guaranteed even when every optional sensor is down.

## Roadmap

- **Phase 0 — Scaffold:** roles/capabilities + generic adapter, config flow with auto-detect, storage, CRUD services.
- **Phase 1 — MVP (T0/T1):** recurring alarm → ring on `AudioSink`/`NotifyChannel` (+ sunrise if `WakeLight`), Tap mission, snooze. Verified on a minimal setup.
- **Phase 2 — Feature modularity (T1/T2):** multi-target sunrise, ringtones, volume profiles, sleep-aware, skip-next + holiday auto-skip, TTS briefing, full degradation matrix.
- **Phase 3 — Advanced missions (T3):** open-door, AI selfie vision (provider/model/prompt + benchmark), mini-tasks, graceful Vision → Tap/math.
- **Phase 4 — View & voice:** native Lit card (`<ha-dialog>` + visual editor), Assist intents, ring channels, post-wake routines, multi-user.
- **Phase 5 — Packaging & quality:** HACS metadata, docs for non-technical users, translations, releases, card auto-registration, Integration Quality Scale (Gold), hassfest + HACS validation.

## Repository layout

```
custom_components/aurora/   # the integration (backend + bundled card build)
aurora-card/                # TypeScript (Lit) card sources → build into the integration's www/
docs/                       # research notes, decisions, design docs
```

## License

To be finalized during packaging (Phase 5).

---

<div align="center">
<sub>Built capability-first so it works on <em>your</em> Home Assistant — whatever that looks like.</sub>
</div>
