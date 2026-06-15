# Aurora — Third-Party Adapter Research
## Capability Probes for Auto-Detection (Target: HA ~2026.6)

> **Purpose**: Implementation-ready notes for Aurora's capability probe layer.  
> Each section covers a third-party integration's current entity model, services, and
> the concrete signals a probe can use to auto-assign a role — without hardcoding the
> integration name.
>
> **Last researched**: 2026-06-15  
> **Anti-stale note**: HA integration APIs change. Re-verify service names against
> HA source before shipping. Service existence should be checked via
> `hass.services.has_service(domain, service)` at runtime.

---

## 1. Fully Kiosk Browser (FKB)

**HA integration**: Built into HA core since ~2023.  
**Requirements**: Fully Plus licence, Remote Admin enabled on the device.  
**Official docs**: https://www.home-assistant.io/integrations/fully_kiosk/  
**HACS legacy component**: https://github.com/cgarwood/homeassistant-fullykiosk (deprecated in favour of core)

### 1.1 Entity Model

| Domain | What it represents | Key attributes / notes |
|---|---|---|
| `light` | Screen on/off + brightness | `brightness` attribute (0–255); setting brightness also turns screen on. This is the **primary DisplaySurface + WakeLight probe target**. |
| `number` | Screen brightness as numeric | entity_id pattern: `number.*_screen_brightness`; state `unknown` when `screenBrightness` is empty (HA issue #84154). Secondary probe; prefer `light`. |
| `switch` | Screensaver on/off, maintenance mode, kiosk lock, motion detection, media play/stop | `switch.*_screensaver` is the canonical screensaver control. |
| `sensor` | Battery level, current page/URL, current foreground app, RAM, storage, device plugged-in, Wi-Fi status, kiosk mode enabled | `sensor.*_current_page` is useful for probing whether a URL was loaded. |
| `media_player` | Audio playback on the device | **No feedback on volume level or playback status** from FKB API — state stays `idle`. Limited `supported_features`. |
| `camera` | MJPEG device camera feed | Requires motion detection enabled in FKB. |
| `button` | Restart FKB, reload start URL, reboot device, to foreground/background | Replaces older deprecated services. |
| `notify` / `tts` | Text-to-speech via FKB | Available through the FKB REST API; in HA exposed as `notify.*` or through `fully_kiosk.set_config` + the TTS endpoint. |
| `image` | Screenshot capture | |

### 1.2 Services

| Service | Parameters | Notes |
|---|---|---|
| `fully_kiosk.load_url` | `device_id`, `url` | Navigate tablet to any URL. Key for DisplaySurface role. |
| `fully_kiosk.start_application` | `device_id`, `application` | Launch Android app by package name. |
| `fully_kiosk.set_config` | `device_id`, `key`, `value` | Sets any FKB configuration key; can control screensaver timeout, motion detection, TTS voice, overlay message, etc. |

**Deprecated services** (replaced by button entities): `fullykiosk.restart`, `reboot_device`, `to_foreground`, `to_background`, `load_start_url`.

### 1.3 Probe Signals

#### Role: DisplaySurface
A device running Fully Kiosk Browser exposes a `light` entity whose `unique_id` or `entity_id` matches the FKB device. Probe:
1. Entity in `light` domain exists for the device.
2. `hass.services.has_service("fully_kiosk", "load_url")` → `True`.
3. The `light` entity has a `brightness` attribute (not `None`).
4. Optional: `sensor.*_current_page` exists (confirms FKB REST API is reachable).

If all four pass: **DisplaySurface role confirmed via Fully Kiosk Browser**.

#### Role: WakeLight-via-Screen (using screen brightness ramp)
Same device as DisplaySurface. Additional check:
- `light` entity supports `SUPPORT_BRIGHTNESS` (feature flag in `supported_features`; value `1` in the `ColorMode`/`LightEntityFeature` enum).
- Alternatively: `number.*_screen_brightness` entity exists and state is not `unavailable`.

**Implementation note**: For a wake-light effect, Aurora should call `light.turn_on` with a `brightness` sweep (via a script loop or transition). FKB does NOT support `transition` natively, so Aurora must step brightness via repeated service calls.

---

## 2. browser_mod

**HACS custom integration**: https://github.com/thomasloven/hass-browser_mod  
**Version context**: browser_mod 2.x (2.3+). API changed significantly from 1.x.

### 2.1 Entity Model

| Domain | What it represents | Key attributes |
|---|---|---|
| `media_player` | Audio/video playback through the browser tab | Attributes: `video_interaction_required` (bool), `audio_interaction_required` (bool). State: `playing`, `idle`, `unavailable`. |
| `light` | Screen on/off + simulated brightness | If running on FKB: real screen control. If plain browser: simulated by overlaying a black/semitransparent div. Attribute: `brightness`. |
| `binary_sensor` | Browser "activity" / user-present | Optional; depends on registration. |

**Registration requirement**: The browser tab must have the "Register" toggle checked in the browser_mod sidebar panel. Un-registered browsers receive no backend services.

### 2.2 Services

| Service | Parameters | Notes |
|---|---|---|
| `browser_mod.navigate` | `browser_id` (optional, targets specific browser), `path` | Redirects browser to any HA path. Any `/local/` path works too — useful for loading alarm UI. |
| `browser_mod.popup` | `browser_id`, `content` (card YAML), `title`, `large` | Shows a Lovelace card as modal popup. |
| `browser_mod.close_popup` | `browser_id` | Closes popup. |
| `browser_mod.notification` | `browser_id`, `message`, `duration`, `action` | Snackbar-style notification. |
| `browser_mod.set_theme` | `browser_id`, `theme`, `dark`, `primaryColor`, `accentColor` | Changes theme on target browser. |
| `browser_mod.more_info` | `browser_id`, `entity_id` | Opens more-info dialog. |
| `browser_mod.console` | `browser_id`, `message` | Logs to browser console (debug use). |
| `browser_mod.javascript` | `browser_id`, `code` | Executes arbitrary JS in the browser. Useful for custom alarm sounds/TTS via Web Speech API. |

**Note**: As of browser_mod 2.x there is **no dedicated `browser_mod.tts` service**. TTS can be achieved via `browser_mod.javascript` calling `window.speechSynthesis` or by sending audio to the `media_player` entity.

### 2.3 Probe Signals

#### Role: DisplaySurface (browser_mod)
1. `hass.services.has_service("browser_mod", "navigate")` → `True`.
2. At least one entity in the `media_player` domain whose `platform` attribute is `browser_mod` (check via `entity_registry`).
3. The `light` entity for the browser exists (may be simulated if not on FKB).

**Distinguish from FKB**: If `hass.services.has_service("fully_kiosk", "load_url")` is also `True` on the same device, FKB takes precedence for DisplaySurface (more reliable screen control). browser_mod is preferred for overlay/popup-based alarm UI when FKB is not present.

#### Role: WakeLight-via-Screen (browser_mod)
- `light` entity from browser_mod is available for the browser device.
- If running on FKB underneath: real brightness ramp is possible.
- If pure browser: simulated brightness only — Aurora should note this in its role metadata and treat it as a "soft" WakeLight.

---

## 3. Sleep as Android

**HA native integration** (added HA 2025.9): https://www.home-assistant.io/integrations/sleep_as_android/  
**HACS custom integration** (older): https://github.com/IATkachenko/HA-SleepAsAndroid  
**Upstream webhook/automation docs**: https://docs.sleep.urbandroid.org/services/custom_webhooks.html  
**Intent API docs**: https://www.sleep.urbandroid.org/docs/devs/intent_api.html

### 3.1 Entity Model (Native Integration)

| Domain | Entity | State / Attributes |
|---|---|---|
| `sensor` | `sensor.*_next_alarm` | Datetime of next Sleep as Android alarm. |
| `sensor` | `sensor.*_alarm_label` | Label string of the next/current alarm. |
| `event` | `event.sleep_as_android_*` | Stateless event entities; `event_type` attribute holds the current event name. |

**Note**: The native integration creates `event` domain entities (HA 2023.8+ event entities), not `sensor` with state. Automations should trigger on `state` of the event entity filtered by `attribute: event_type`.

### 3.2 Event Names

Events are grouped by category. The `event_type` attribute of the `event` entity will carry these string values:

**Alarm Clock**:
- `alert_start` — alarm started ringing (equivalent to old `alarm_alert_start`)
- `alert_dismiss` — alarm dismissed
- `snooze_clicked` — alarm snoozed
- `snooze_canceled` — snooze cancelled
- `rescheduled` — alarm rescheduled
- `skip_next` — "skip next alarm" used

**Smart Wake-up**:
- `smart_period` — smart wake-up window started
- `before_smart_period` — pre-smart-period notification

**Sleep Tracking**:
- `started` — sleep tracking started
- `stopped` — sleep tracking stopped
- `paused` — sleep tracking paused
- `resumed` — sleep tracking resumed

**Sleep Phase** (from actigraphy/accelerometer):
- `deep_sleep`
- `light_sleep`
- `rem`
- `awake`
- `not_awake`

**Sound Recognition**:
- `snore`, `talk`, `cough`, `laugh`, `baby`

**Sleep Health**:
- `antisnoring` — anti-snoring intervention triggered
- `apnea_alarm` — apnea detected

**Lullaby**:
- `start`, `stop`, `volume_down`

**Jet Lag Prevention**:
- `jet_lag_start`, `jet_lag_stop`

**User Notifications**:
- `wake_up_check`, `show_skip_next_alarm`, `time_to_bed_alarm_alert`

### 3.3 Webhook Payload (Legacy / HACS Integration)

For blueprints/automations using the webhook-based approach (pre-native or HACS variant), the payload is:
```json
{
  "event": "<event_name>",
  "value1": "<unix_timestamp_ms>",
  "value2": "<alarm_label>",
  "value3": ""
}
```
`value1` = UNIX timestamp in milliseconds of the event.  
`value2` = alarm label (tabs and newlines stripped).

### 3.4 Probe Signals

#### Role: SleepSignal
1. An `event` entity exists whose `entity_id` matches `event.*sleep_as_android*` OR `event.*sleep_as_android_alarm*`.
2. The entity's `event_types` attribute contains `alert_start` (confirms this is the alarm event entity).
3. OR: `sensor.*_next_alarm` entity exists with `device_class: timestamp`.
4. OR (HACS/webhook): a webhook automation exists with trigger type `webhook` that references the Sleep as Android webhook ID.

**Key probe for Aurora**: Look for entities in the `event` domain with `event_types` containing `["alert_start", "started", "stopped"]` as a minimum set.

---

## 4. Music Assistant (MA)

**HA native integration** (core since 2024.x): https://www.home-assistant.io/integrations/music_assistant/  
**MA integration docs**: https://www.music-assistant.io/integration/  
**Play media FAQ**: https://www.music-assistant.io/faq/massplaymedia/  
**GitHub**: https://github.com/music-assistant/hass-music-assistant

### 4.1 Entity Model

| Domain | What it represents | Notes |
|---|---|---|
| `media_player` | One entity per MA player + group | Full media_player with rich `supported_features`. |
| `button` | "Favourite current song" per player | |
| `number` / `select` / `switch` / `sensor` / `text` | Player-specific options | Present when the player provider exposes them. As of HA 2026.5.0, player options are mapped to these entity types. |

**`media_player` `supported_features`** (MA players are feature-rich):
- `SUPPORT_PLAY`, `SUPPORT_PAUSE`, `SUPPORT_STOP`
- `SUPPORT_NEXT_TRACK`, `SUPPORT_PREVIOUS_TRACK`
- `SUPPORT_VOLUME_SET`, `SUPPORT_VOLUME_STEP`, `SUPPORT_VOLUME_MUTE`
- `SUPPORT_SELECT_SOURCE` (switch between MA queues/sources)
- `SUPPORT_BROWSE_MEDIA` (MA media browser integration)
- `SUPPORT_PLAY_MEDIA`
- `SUPPORT_GROUPING` (multi-room groups)

Attribute `mass_player_id` or `mass_player_type` is set on MA media_player entities, providing a reliable probe signal.

### 4.2 Services / Actions

| Service | Key Parameters | Notes |
|---|---|---|
| `music_assistant.play_media` | `entity_id`, `media_id` (URI/name), `media_type` (track/album/playlist/radio/artist), `artist`, `album`, `enqueue`, `radio_mode` | This is the primary play service. `enqueue` values: `play` (replace & play immediately), `replace`, `next`, `replace_next`, `add` (append to queue). `radio_mode` (bool) enables MA radio from the item. |
| `music_assistant.play_announcement` | `entity_id`, `url`, `use_pre_announce`, `pre_announce_url`, `announce_volume` | Plays a URL as an announcement (ducks volume). Ideal for Aurora wake chime/TTS. |
| `music_assistant.transfer_queue` | `source_player`, `entity_id`, `auto_play` | Move queue from one player to another. |
| `music_assistant.search` | `config_entry_id`, `name`, `media_type`, `artist`, `album`, `limit`, `library_only` | Returns search results (for scripts). |
| `music_assistant.get_library` | `config_entry_id`, `media_type`, `favorite`, `limit`, `offset`, `search`, `order_by`, ... | Query MA library. |
| `music_assistant.get_queue` | `entity_id` | Get full queue state for a player. |

**Volume fade**: MA does not expose a native volume-fade service. Aurora must implement a fade script using repeated `media_player.volume_set` calls. MA's `play_announcement` with `announce_volume` handles ducking for announcements.

### 4.3 Probe Signals

#### Role: AudioSink (Music Assistant)
1. `hass.services.has_service("music_assistant", "play_media")` → `True`.
2. Entity in `media_player` domain with attribute `mass_player_id` present (strong signal — unique to MA).
3. `supported_features` includes `SUPPORT_PLAY_MEDIA` (flag `4`) AND `SUPPORT_BROWSE_MEDIA` (flag `131072`).

**All three together are definitive**. Signal #2 alone is sufficient if the attribute is present.

---

## 5. Spotcast

**HACS custom component**: https://github.com/fondberg/spotcast  
**Also**: https://github.com/soldag/spotcast (fork, similar API)

### 5.1 What Spotcast Does
Spotcast is not a full media_player — it bootstraps Spotify playback on an idle Chromecast or Spotify Connect device, then hands off control to the native Spotify or Cast integration.

### 5.2 Service

| Service | Key Parameters | Notes |
|---|---|---|
| `spotcast.start` | `account`, `device_name`, `uri` (Spotify URI string), `random_song` (bool), `repeat` (bool), `shuffle` (bool), `force_playback` (bool), `volume` (0–100) | Primary service. `uri` can be empty to resume last session. Supports `spotify:playlist:…`, `spotify:album:…`, `spotify:track:…`, `spotify:artist:…` URIs. |

**No entities created by Spotcast itself**. It relies on the existing Spotify or Cast media_player entities created by HA's built-in Spotify and Google Cast integrations.

### 5.3 Probe Signals

#### Role: AudioSink (Spotcast)
1. `hass.services.has_service("spotcast", "start")` → `True`.
2. At least one `media_player` entity with `platform` = `spotify` or `cast` exists (the actual player Spotcast will drive).
3. Check that the target `media_player` is a Spotify-capable player: `source_list` attribute contains Spotify Connect device names.

**Note**: Spotcast is weaker than MA for Aurora's AudioSink role because it provides no feedback on play state and cannot be reliably introspected. Prefer MA if both are available. Spotcast is best used as a "playlist launcher" capability, not a general AudioSink.

---

## 6. Home Assistant Companion App (Android)

**Official sensor docs**: https://companion.home-assistant.io/docs/core/sensors/  
**Notification docs**: https://companion.home-assistant.io/docs/notifications/notifications-basic/  
**Notification commands**: https://companion.home-assistant.io/docs/notifications/notification-commands/

### 6.1 Relevant Sensors

All Companion App sensors are in the `sensor` domain under `mobile_app` platform. Entity IDs follow the pattern `sensor.<device_name>_<sensor_name>`.

| Sensor | `entity_id` pattern | `device_class` | Key attributes | Notes |
|---|---|---|---|---|
| Next Alarm | `sensor.*_next_alarm` | `timestamp` | `package` (alarm app package, e.g. `com.urbandroid.sleep`, `com.google.android.deskclock`), `local_only` (bool) | State is ISO 8601 datetime in UTC. Becomes `unavailable` when no alarm is set. The `package` attribute lets Aurora distinguish which app set the alarm. |
| Sleep Confidence | `sensor.*_sleep_confidence` | None / `measurement` | `unit_of_measurement: "%"` | Uses Google Sleep API. Updates ~every 10 min. Range 0–100. Requires Google Play Services. |
| Sleep Segment | `sensor.*_sleep_segment` | None | Start/end times of detected sleep segment | Updates ~once per day from Google Sleep API. |
| Detected Activity | `sensor.*_detected_activity` | None | `confidence`, `activities` list | Uses Android Activity Recognition API. Requires `ACTIVITY_RECOGNITION` permission. States: `still`, `walking`, `running`, `in_vehicle`, `on_bicycle`, `tilting`, `unknown`. |
| Ringer Mode | `sensor.*_ringer_mode` | None | | States: `normal`, `vibrate`, `silent`. Useful for conditioning TTS. |
| Interactive | `binary_sensor.*_is_charging` / `binary_sensor.*_interactive` | None | | Whether screen is on/phone interacted with. |

### 6.2 Notification / TTS Capabilities

**Service domain**: `notify`, service name: `notify.mobile_app_<device_id>` (e.g. `notify.mobile_app_pixel_9`).

| Capability | How to invoke | Key parameters |
|---|---|---|
| Standard notification | `notify.mobile_app_<device>` with `message: "…"` | `title`, `data.channel`, `data.importance`, `data.ttl`, `data.actions` |
| TTS via notify | `message: "TTS"` with `data.tts_text: "Text to speak"` | `data.media_stream`: `"music_stream"` or `"alarm_stream"` (plays on alarm volume channel — survives DND/silent). `data.tts_voice` for voice selection. |
| Stop TTS | `message: "command_stop_tts"` | |
| Notification actions (interactive) | `data.actions: [{action: "ACTION_ID", title: "Label"}]` | Up to 3 actions. Aurora can use this for "Snooze" / "Dismiss" buttons in alarm notification. |
| Command: DND | `message: "command_dnd"` with `data.command: "on"/"off"/"alarms_only"` | |
| Command: Ringer mode | `message: "command_ringer_mode"` with `data.command: "normal"/"vibrate"/"silent"` | |

**`media_stream: "alarm_stream"`**: This is critical for Aurora — it plays TTS on the alarm audio stream, which is not muted by ringer/DND settings on Android. Use this for wake-up TTS.

### 6.3 Probe Signals

#### Role: NotifyChannel (Companion App)
1. A `notify` service exists matching `notify.mobile_app_*` — check via `hass.services.async_services().get("notify", {})` and look for keys starting with `mobile_app_`.
2. The associated device has a `sensor.*_next_alarm` entity with `device_class: timestamp` (confirms Companion App with alarm sensor).
3. Entity platform in entity registry: `platform == "mobile_app"`.

#### Role: SleepSignal / PresenceSignal (Companion App)
1. `sensor.*_sleep_confidence` entity exists, platform `mobile_app`, state not `unavailable`.
2. `sensor.*_detected_activity` entity exists, platform `mobile_app`.
3. `sensor.*_next_alarm` entity with `package` attribute available.

**Probe priority**: `sleep_confidence` (Google Sleep API) is the strongest sleep signal if available. Fall back to `detected_activity` state `still` as a weak presence signal.

---

## 7. Role-to-Probe Summary Table

| Aurora Role | Primary Domain(s) | Key Probe Signal(s) | Fallback |
|---|---|---|---|
| **DisplaySurface** | `light` (FKB), `media_player` (browser_mod) | `hass.services.has_service("fully_kiosk", "load_url")` + `light` entity with `brightness` attribute; OR `hass.services.has_service("browser_mod", "navigate")` + `media_player` with platform `browser_mod` | Any `media_player` with `SUPPORT_PLAY_MEDIA` |
| **WakeLight** | `light` | FKB: `light` + `brightness` attr + FKB service present. browser_mod: `light` + browser_mod service present (may be simulated). HA built-in: any `light` with `SUPPORT_BRIGHTNESS` | Any `light` with `supported_features & 1` |
| **AudioSink** | `media_player` | MA: `hass.services.has_service("music_assistant", "play_media")` + `mass_player_id` attr. Spotcast: `hass.services.has_service("spotcast", "start")`. Generic: `SUPPORT_PLAY_MEDIA` in `supported_features` | `media_player` with `SUPPORT_VOLUME_SET` |
| **SleepSignal** | `event` (SaA native), `sensor` (Companion), `sensor` (SaA HACS) | SaA native: `event.*sleep_as_android*` with `event_types` containing `alert_start`. Companion: `sensor.*_sleep_confidence` platform `mobile_app`. | Webhook trigger in automation (structural probe only) |
| **PresenceSignal** | `sensor`, `binary_sensor` | `sensor.*_detected_activity` platform `mobile_app`; OR any `binary_sensor` with `device_class: occupancy`/`motion` | `input_boolean` or `person` entity state |
| **NotifyChannel** | `notify` | `notify.mobile_app_*` service present; OR `notify.*` with associated device having Companion App `sensor.*_next_alarm` | Any `notify.*` service |

---

## 8. Implementation Notes for Aurora Probe Layer

### 8.1 Service Existence Check Pattern
```python
# Preferred async pattern in HA
async def _has_service(hass: HomeAssistant, domain: str, service: str) -> bool:
    return hass.services.has_service(domain, service)
```

### 8.2 Entity Registry Attribute Probe Pattern
```python
from homeassistant.helpers import entity_registry as er

async def _entities_by_platform(hass, platform: str) -> list:
    registry = er.async_get(hass)
    return [e for e in registry.entities.values() if e.platform == platform]
```

### 8.3 FKB vs browser_mod Screen Control Priority
- FKB available: use `light.turn_on(brightness=X)` for real screen brightness.
- browser_mod only (no FKB): use `light.turn_on` for simulated dim + `browser_mod.navigate` to alarm UI.
- Both present on same device: prefer FKB for screen, browser_mod for UI overlay/popup.

### 8.4 TTS Priority for Wake Events
1. **MA `music_assistant.play_announcement`** (best: ducks music, plays chime/TTS URL, uses MA's audio pipeline).
2. **Companion App `notify.mobile_app_*`** with `media_stream: alarm_stream` (ignores DND/silent on Android).
3. **FKB TTS** via `fully_kiosk.set_config` with the TTS key (device-local, no HA TTS pipeline).
4. **browser_mod.javascript** with Web Speech API (browser must be active and have user interaction).

### 8.5 Sleep Signal Event Trigger Pattern (SaA Native)
```yaml
trigger:
  - trigger: state
    entity_id: event.sleep_as_android_alarm_clock
    attribute: event_type
    to: alert_start
```

### 8.6 Next Alarm Disambiguation
When `sensor.*_next_alarm` exists from **both** SaA (HACS integration) and the Companion App, distinguish by the `package` attribute on the Companion sensor:
- `package: "com.urbandroid.sleep"` → alarm set by Sleep as Android app.
- `package: "com.google.android.deskclock"` → stock Clock app.
- SaA native integration creates its own `sensor.*_next_alarm` (no `package` attr) — use entity platform to disambiguate.

---

## 9. Known Gaps / TODO

- **browser_mod TTS service**: No dedicated `browser_mod.tts` in v2.x. Only workaround is `browser_mod.javascript` with Web Speech API. Confirm if this changed in any browser_mod 2.4+ release.
- **FKB `media_player` `supported_features` bitmask**: The exact integer bitmask for FKB's media_player was not confirmed from docs. FKB media_player has no volume feedback — probe should NOT rely on `SUPPORT_VOLUME_SET` for FKB's media_player. Use FKB `notify` path for TTS instead.
- **Spotcast v4+**: The `fondberg/spotcast` repo may have been superseded by a rewrite. Re-check service signature (especially `device_name` vs `entity_id` targeting) before shipping Aurora's Spotcast adapter.
- **MA volume fade**: No native fade. Aurora needs a fade script utility. Confirm if MA 2.x+ adds a fade action before implementing custom fade logic.
- **SaA native integration event entity naming**: Event entity `entity_id` format was not confirmed (may be per-device or global). Test against a live instance.
- **Companion App `sleep_segment` sensor**: Update frequency (once/day) makes it unsuitable for real-time wake triggers. Document this limitation in Aurora's probe result.

---

## Sources

- https://www.home-assistant.io/integrations/fully_kiosk/
- https://github.com/cgarwood/homeassistant-fullykiosk
- https://github.com/thomasloven/hass-browser_mod
- https://github.com/thomasloven/hass-browser_mod/blob/master/documentation/services.md
- https://www.home-assistant.io/integrations/sleep_as_android/
- https://docs.sleep.urbandroid.org/services/custom_webhooks.html
- https://www.sleep.urbandroid.org/docs/devs/intent_api.html
- https://github.com/IATkachenko/HA-SleepAsAndroid
- https://www.home-assistant.io/integrations/music_assistant/
- https://www.music-assistant.io/integration/
- https://www.music-assistant.io/faq/massplaymedia/
- https://github.com/music-assistant/hass-music-assistant
- https://github.com/fondberg/spotcast
- https://companion.home-assistant.io/docs/core/sensors/
- https://companion.home-assistant.io/docs/notifications/notifications-basic/
- https://companion.home-assistant.io/docs/notifications/notification-commands/
