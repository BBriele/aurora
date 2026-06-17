# Display wake overlay + in-card ring animation — Design

Date: 2026-06-17 (revised 2026-06-18 after live capability probe)
Status: Approved (design); pending implementation plan

## Live capability probe (2026-06-18)

Verified against the running instance before planning:

- **`browser_mod` is NOT installed.** Only `fully_kiosk` is present. The
  `browser_mod` popup tier is therefore *designed-for* (the adapter keeps the
  tier seam) but **not implemented or tested in this cycle**.
- **`fully_kiosk` services**: `load_url(device_id, url)`, `start_application`,
  `set_config(device_id, key, value)`. There is **no** `set_screen_brightness`
  service; brightness is a `number` entity instead.
- **Display device "SmartClock"** (`device_id 0dd16a06c289dadf96302e3a6ae4687d`,
  integration `fully_kiosk`) exposes, with **locale-independent
  `translation_key`s** (so we resolve by key, never by localized name):
  - `switch` tk `screen_on` — turn the screen on/off
  - `switch` tk `screensaver` — screensaver on/off
  - `number` tk `screen_brightness` — screen brightness (ramped via
    `number.set_value`, exactly what `WakeLightAdapter` already does for numbers)
  - `button` tk `load_start_url` — reload the kiosk's configured start URL
    (clean **restore** with no previous-URL bookkeeping)
  - `button` tk `to_foreground` — bring the browser to the foreground
  - `media_player.smartclock` — also the AudioSink for that device
- **"Sveglia Gabriel" is a `media_player` whose screen cannot be driven** → it is
  an **AudioSink only, not a display target**. Only screen-controllable devices
  (fully_kiosk tier) are display targets.

### Resulting delivery (the implemented + tested path)

1. **Bind** the fully_kiosk **media_player entity** (e.g. `media_player.smartclock`)
   as a `display_surface` role target. This reuses the existing entity-based role
   model and `_probe_display_surface` (which already accepts `media_player`). The
   adapter resolves the HA `device_id` and the sibling control entities from the
   **entity registry** (`RegistryEntry.device_id` + `RegistryEntry.translation_key`).
2. **Overlay surface**: the Aurora panel gains a ring route. `fully_kiosk.load_url`
   navigates the device to `get_url(hass) + "/aurora/ring"`, where `aurora-panel`
   renders **only** the info-only `aurora-ring-display` (no tabs, no management UI).
3. **Wake**: turn on the `screen_on` switch, turn off the `screensaver` switch,
   press `to_foreground`.
4. **Light**: ramp the `screen_brightness` number from low to high over
   `duration_min` (physical), while the overlay also renders the sunrise visually
   (the visual fallback when no brightness number exists).
5. **Restore (on dismiss)**: press the `load_start_url` button and restore the
   screensaver switch + brightness to their pre-ring values.

## Problem

Today a single concept (`ring-overlay` mounted by any card with `ring_screen: true`)
does three jobs at once and does them on the wrong surfaces:

- It takes over the whole device with a fullscreen, **interactive** overlay
  (snooze / stop / mission) whenever *any* alarm rings.
- It appears on the Aurora management app/card, which is not meant to act as the
  alarm surface.
- It has no notion of *which* display an alarm targets — every `ring_screen`
  card reacts to every ring.

The desired model separates two distinct behaviours and adds real per-alarm
display targeting, using the already-defined but unused `display_surface` role.

## Two behaviours (the core distinction)

### A. In-card ring animation
When an alarm rings and an Aurora card has the in-card animation opted in, the
card shows its "ringing" state **contained within the card's own bounds** — never
a device-wide fullscreen takeover. It stays **interactive** (snooze / stop /
mission) because it is the user's own management surface.

This is a refactor of the current fullscreen `aurora-ring-overlay` into card-
contained content (no `position: fixed; inset: 0`).

### B. Display wake overlay
The displays selected for a given alarm receive a **fullscreen, info-only,
non-interactive** overlay: clock + alarm label + a sunrise colour/brightness
ramp. No snooze, no stop, no mission — it is a software equivalent of turning on
a light/LED. It is pushed by the backend to the targeted displays and removed on
dismiss.

The management panel continues to never ring (already the case).

## Architecture

### Backend

**`DisplayFeature`** (new, per-alarm, in `models.py`):
- `enabled: bool = False`
- `targets: list[str]` — `display_surface` **entity_ids** selected for this alarm
  (the fully_kiosk media_player entity, consistent with the entity-based role
  model). Empty → fall back to all bound `display_surface` targets, mirroring how
  `audio.target` falls back to `options[ROLE_AUDIO_SINK]`. The adapter resolves
  `device_id` and sibling control entities from the entity registry.
- Reuses `LightFeature.color_temp_kelvin` and `LightFeature.duration_min` for the
  overlay's sunrise ramp parameters, **independently of `light.enabled`**
  (`light.enabled` governs only the physical lamp). So "the light & colour
  settings configured for light-wake" drive the screen too, with no duplicated
  fields.
- `as_dict` / `from_dict` symmetric with the other features; guards bad input.
- Wired into `AlarmFeatures` (serialise/deserialise + defaults).

**`display_surface` role → multi-device**:
- Setup binds one or more display devices to `display_surface` (today role
  bindings are single-target; for this role a list is stored).
- The per-alarm `DisplayFeature.targets` is a subset of the bound displays.

**`DisplaySurfaceAdapter`** (new, `adapters/display.py`), capability-tiered per
target entity. For each bound `display_surface` entity it resolves the
`device_id` (entity registry) and detects the tier:
- **fully_kiosk tier (implemented + tested)** — device whose integration is
  `fully_kiosk`:
  - `async_start`: resolve sibling entities by `translation_key` — `screen_on`
    (switch → `turn_on`), `screensaver` (switch → `turn_off`, capturing prior
    state), `screen_brightness` (number → ramp low→high over `duration_min`, the
    same number-ramp `WakeLightAdapter` already does), `to_foreground` (button →
    press). Then `fully_kiosk.load_url(device_id, get_url(hass) + "/aurora/ring")`.
  - `async_stop`: cancel the ramp; press the `load_start_url` button (restore);
    restore the screensaver switch and brightness to their captured pre-ring
    values. All best-effort, swallow device errors.
- **browser_mod tier (seam only, not implemented this cycle — absent on the
  instance)**: the adapter has a clear branch point where a future
  `browser_mod.popup` + `close_popup` path slots in.
- **Visual fallback**: when no `screen_brightness` number exists, the overlay's
  own CSS sunrise ramp is the light — the physical ramp is purely additive.
- Signature: `async_start(self)` / `async_stop(self)` (an `OutputAdapter`); the
  controller constructs one per resolved target with `(hass, entity_id,
  color_temp_kelvin, duration_min, label)`.

**Capability detection** for the tiers (browser_mod / fully_kiosk presence per
device) lives alongside the existing probes in `capabilities.py` / the adapter,
consistent with Aurora's no-hard-dependency philosophy (domains are probed, never
required — `DOMAIN_BROWSER_MOD`, `DOMAIN_FULLY_KIOSK` already exist).

**Coordinator / `ring.py`**:
- In `_begin_ring` → `ring.async_start`: if `display.enabled and display.targets`,
  start the `DisplaySurfaceAdapter`.
- In `async_dismiss` (and shutdown paths): stop the display adapter alongside the
  audio and light adapters.

### Frontend

**New `aurora-ring-display` element** (info-only):
- Clock + alarm label + sunrise gradient driven by `color_temp_kelvin` and
  elapsed/`duration_min`.
- **Zero** buttons, missions, or interactions.
- Reads what it needs from the ringing binary_sensor attributes (state + mission
  is ignored; it only shows info).

**Panel ring route** (`aurora-panel`):
- The custom panel receives HA's `route` prop. When `route.path === "/ring"` the
  panel renders **only** `aurora-ring-display` (no bar, tabs, or management UI).
- `fully_kiosk.load_url` points the kiosk at `/aurora/ring`; the kiosk is already
  authenticated to HA (it renders HA dashboards), so the route loads directly.

**Refactor of `aurora-ring-overlay`**:
- Becomes the card-contained ring animation (behaviour A): drop the fullscreen
  fixed positioning; keep interactivity (snooze / stop / mission).
- No longer a device-wide takeover on the management surface.

**Card config**:
- Rename `ring_screen` → `ring_animation` (in-card animation toggle), keeping
  backward compatibility by still honouring the old key. Description: "show the
  ringing animation inside this card".
- Updated in `AuroraCardConfig`, `getStubConfig`, and the visual card editor
  (`aurora-card-editor`).

**Alarm editor (`alarm-dialog.ts`)**:
- New **Display** section: an enable toggle + a multi-select of the displays bound
  as `display_surface`.

**Setup → Wake & display (`devices-view.ts`)**:
- Multi-device binding UI for `display_surface`.

### Data flow

1. Alarm rings → coordinator `_begin_ring` → `ring.async_start` starts the audio,
   light, and (if enabled) display adapters.
2. `DisplaySurfaceAdapter` pops up `aurora-ring-display` on each target device
   (screen-on; physical brightness ramp where supported, else visual ramp).
3. Any visible Aurora card with in-card animation on shows its contained ring
   state (interactive).
4. Dismiss (physical mission / voice / card) → coordinator `async_dismiss` →
   `ring.async_stop` stops the display adapter (close popup / restore URL +
   restore screen/brightness).

## Localization

New strings (en + it) for: the editor Display section (label / description /
picker), the Setup multi-bind, and the card config in-card animation toggle. No
hardcoded user-facing strings or entity_ids (per project rules; English default,
Italian bundled).

## Testing

- **Pure-logic (local, Python 3.12)**: `DisplayFeature` serialise/deserialise;
  `DisplaySurfaceAdapter` tier-selection logic with a mocked `hass.services`
  (browser_mod vs fully_kiosk vs neither; brightness present vs absent); `ring.py`
  wiring (adapter started/stopped under the right conditions).
- **HA-dependent**: CI (Python 3.14 + HA).
- **Live on the instance**: trigger an alarm targeting **SmartClock** (the only
  screen-controllable display) → confirm the kiosk loads `/aurora/ring`, screen
  wakes, brightness ramps, the overlay is info-only (no buttons), and that dismiss
  presses `load_start_url` and restores the screensaver/brightness. Sveglia
  Gabriel rings as audio only.

## Decisions taken

1. The overlay **reuses `LightFeature`** colour/duration rather than introducing
   its own → no duplication.
2. The **in-card animation stays interactive** (snooze / stop / mission).
3. Card config **`ring_screen` → `ring_animation`** with backward compatibility.
4. Display targeting is **per-alarm**, selected from `display_surface` bindings
   set in Setup (role-based, multi-device).
5. Overlay delivery uses a **capability-tiered `DisplaySurfaceAdapter`**. The
   **fully_kiosk tier is implemented + tested** (load_url to `/aurora/ring` +
   screen/screensaver switches + brightness number ramp + `load_start_url`
   restore); the browser_mod tier is a seam only (absent on the instance).
6. Display targets are bound as **entity_ids** (the fully_kiosk media_player),
   reusing the entity-based role model; the adapter resolves device_id + sibling
   control entities via the entity registry by locale-independent
   `translation_key`.

## Out of scope

- No new hard dependency on browser_mod or fully_kiosk (both stay optional,
  probed).
- No changes to the existing physical anti-snooze missions (already shipped).
- No redesign of the audio/preset subsystem.
