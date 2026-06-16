# Changelog

All notable changes to Aurora are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.7.0 - 2026-06-16

### Added
- Assist (voice) intents: `AuroraSnooze`, `AuroraDismiss`, `AuroraSkipNext`,
  `AuroraNextAlarm`, and `AuroraSetAlarm` (with a `time` slot). Spoken responses
  are localized. README documents sentence examples for the sentence-based agent.

## 0.6.1 - 2026-06-16

### Added
- AI vision (selfie) anti-snooze mission. Captures a selfie and asks the bound
  vision provider whether the person is awake; the alarm only dismisses on a
  positive verdict.
- Provider support for both `ai_task` (structured output with an image
  attachment) and LLM Vision (`image_analyzer`), auto-detected.
- Vision latency diagnostic sensor (disabled by default).

### Changed
- `benchmark_vision` action now runs timed inferences against the configured
  provider and returns min/avg/max latency and a success count.

### Fixed
- Vision inference is time-boxed with retry and backoff and guarded by a circuit
  breaker; on repeated failure the mission degrades to the math challenge so an
  alarm can always be dismissed.

## 0.6.0 - 2026-06-16

### Added
- Anti-snooze missions are now enforced before an alarm can be dismissed: math,
  shake (device motion), QR scan, and open-door (a `binary_sensor`).
- Per-mission options in the alarm editor (math difficulty, shake count, QR
  value, door sensor).
- The ringing binary sensor exposes the active alarm's mission so the card can
  present the matching challenge.

### Changed
- Missions degrade to a simpler challenge when a device or setup cannot run the
  requested one, always ending at a single confirmation.

### Fixed
- Open-door solves only on an off-to-on transition and never if the entity is
  missing; mission solving is idempotent; the camera stream cannot leak across
  async gaps; mission state resets correctly between attempts.

## 0.5.1 - 2026-06-16

### Added
- Full user documentation in the README (installation, removal, configuration
  and installation parameters, actions, supported devices and functions, use
  cases, examples, troubleshooting, known limitations, data-update model).
- MIT license.
- Brand assets (icon and logo) plus a generator and a submission guide.

## 0.5.0 - 2026-06-16

### Added
- Internationalization for the card and the spoken briefing. English is the
  default language, Italian is bundled, and other languages fall back to
  English, selected from the Home Assistant language.
- Translated exceptions for the integration's actions.
- Repair issue raised when alarms are enabled but no speaker (AudioSink) is
  bound.

### Changed
- The wake-up briefing is English by default and fully customizable per alarm
  via a template.
- The vision latency sensor is disabled by default.
- `entity-unavailable` and `log-when-unavailable` are marked exempt (local,
  push-based integration).

### Fixed
- The ring overlay no longer reads a hardcoded English entity id, so it appears
  on non-English installations.
- The alarm list shows a loading state instead of a misleading "no alarms"
  message before data arrives.

## 0.4.2 - 2026-06-16

### Changed
- The dashboard card hero uses the active theme's accent instead of the fixed
  sunrise gradient.

### Fixed
- The card's next-alarm lookup no longer relies on a hardcoded English entity id
  (it matches the timestamp sensor), so the hero shows the next alarm on
  non-English installations.

## 0.4.1 - 2026-06-16

### Changed
- Interactive accents (toggles, chips, segmented controls, primary buttons,
  pills) follow the active Home Assistant theme, with readable on-accent text.
  The sunrise gradient is reserved for brand and ring moments.

### Fixed
- The alarm editor's time field renders at its intended size (a CSS specificity
  conflict had shrunk it).

## 0.4.0 - 2026-06-16

### Added
- Wake-up briefing spoken when an alarm is dismissed, composed from the time,
  weather, today's calendar events and open to-dos, via the TTS role.
- `speak_briefing` action.
- Briefing data sources (weather, calendars, to-do lists) in the shared
  settings.

## 0.3.0 - 2026-06-15

### Added
- Sleep-aware smart wake: rings earlier within a window when sleep and presence
  signals indicate the user is already stirring, always falling back to the
  exact alarm time.
- Calendar-based auto-skip for skip-day and holiday calendars.

## 0.2.0

### Added
- Per-user alarms and device profiles with a shared settings page.

## 0.1.0

### Added
- Initial release: recurring alarms ringing via the audio, light and
  notification roles, snooze and dismiss, and the custom Aurora panel and
  dashboard card.
