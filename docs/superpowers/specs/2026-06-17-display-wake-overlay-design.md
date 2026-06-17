# Display wake overlay + in-card ring animation — Design

Date: 2026-06-17
Status: Approved (design); pending implementation plan

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
- `targets: list[str]` — HA `device_id`s of the display devices selected for
  this alarm (`device_id` is the common target both `browser_mod` and
  `fully_kiosk` services accept).
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
target device:
- `browser_mod` present → `browser_mod.popup` rendering the `aurora-ring-display`
  card fullscreen on that device, plus `browser_mod.command` to wake the screen.
- else `fully_kiosk` present → `fully_kiosk.load_url` to the ring view + screen-on.
- **Physical brightness (preferred, with visual fallback)**: if the device
  exposes `fully_kiosk.set_screen_brightness`, ramp it over `duration_min`
  (mirroring `WakeLightAdapter`); otherwise the overlay's own CSS ramp is the
  light (pure visual fallback). Both layers are best-effort and degrade silently.
- `async_start(targets, color_temp_kelvin, duration_min, alarm_label)`.
- `async_stop()` → `browser_mod.close_popup` / restore the kiosk URL + restore
  screen brightness / screen state.

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

**New `aurora-ring-display` card** (info-only):
- Clock + alarm label + sunrise gradient driven by `color_temp_kelvin` and
  elapsed/`duration_min`.
- **Zero** buttons, missions, or interactions.
- Reads what it needs from the ringing sensor attributes and/or the card config
  passed by `browser_mod.popup`.

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
- **Live on the instance**: trigger an alarm targeting SmartClock + Sveglia
  Gabriel → confirm the overlay pops fullscreen, sunrise ramp + physical screen
  brightness, info-only (no buttons), and that dismiss closes it and restores the
  previous screen state.

## Decisions taken

1. The overlay **reuses `LightFeature`** colour/duration rather than introducing
   its own → no duplication.
2. The **in-card animation stays interactive** (snooze / stop / mission).
3. Card config **`ring_screen` → `ring_animation`** with backward compatibility.
4. Display targeting is **per-alarm**, selected from `display_surface` bindings
   set in Setup (role-based, multi-device).
5. Overlay delivery uses a **capability-tiered `DisplaySurfaceAdapter`**
   (browser_mod popup → fully_kiosk load_url; physical brightness via fully_kiosk
   with visual fallback).

## Out of scope

- No new hard dependency on browser_mod or fully_kiosk (both stay optional,
  probed).
- No changes to the existing physical anti-snooze missions (already shipped).
- No redesign of the audio/preset subsystem.
