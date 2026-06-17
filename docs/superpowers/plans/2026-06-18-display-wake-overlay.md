# Display wake overlay + in-card ring animation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give selected fully_kiosk displays a fullscreen, info-only "sunrise" wake overlay (pushed by the backend, with a physical screen-brightness ramp), and turn the existing card ring overlay into an opt-in *in-card* animation — so the Aurora management UI never takes over a device.

**Architecture:** A new per-alarm `DisplayFeature` (enabled + a list of `display_surface` entity targets) drives a new capability-tiered `DisplaySurfaceAdapter`. Its implemented tier is fully_kiosk: it resolves the device and its sibling control entities from the entity registry (by locale-independent `translation_key`), wakes the screen, ramps the brightness `number`, and `load_url`s the kiosk to a new `/aurora/ring` panel route that renders only the info-only `aurora-ring-display`. On dismiss it presses the kiosk's `load_start_url` button to restore. The old fullscreen `aurora-ring-overlay` becomes an in-card animation gated by a renamed card config.

**Tech Stack:** Home Assistant custom integration (Python 3.14 / HA on CI, 3.12 pure-tests locally), Lit + TypeScript frontend bundle (`aurora-card`), Vitest/pytest.

## Global Constraints

- HA version floor: 2026.3. Quality scale: Platinum.
- **No hardcoded user-facing strings or entity_ids.** UI strings go through
  `localize` / `translations.ts` (English default + Italian bundled). Backend
  resolves entities dynamically (here: by `translation_key` via the entity
  registry), never by a literal entity_id.
- No new hard dependency: `fully_kiosk` / `browser_mod` stay optional and probed.
- Local test box is Python 3.12: only pure tests (no `homeassistant` import) run
  locally via the conftest shim; HA-dependent tests + mypy are CI-only. Each task
  notes which of its tests run where.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Stage only feature-relevant files; never stage `AURORA_DEV_PROMPT.md`,
  `design/`, `docs/UX-IA.md`, `tools/wf_tests.js`.
- gh CLI (if needed) only via the full WinGet path.

## File Structure

**Backend (`custom_components/aurora/`)**
- `models.py` — add `DisplayFeature`; wire it into `AlarmFeatures`. *(modify)*
- `adapters/display.py` — new `DisplaySurfaceAdapter` (fully_kiosk tier). *(create)*
- `ring.py` — construct + start/stop the display adapters. *(modify)*
- `const.py` — fully_kiosk domain + translation-key constants used by the adapter. *(modify)*

**Frontend (`aurora-card/src/`)**
- `types.ts` — add `display` to `AlarmFeatures`. *(modify)*
- `ring-display.ts` — new info-only `aurora-ring-display` element. *(create)*
- `aurora-panel.ts` — `route` prop → render only `aurora-ring-display` on `/ring`. *(modify)*
- `alarm-dialog.ts` — new Display section (toggle + multi-select of bound displays). *(modify)*
- `devices-view.ts` — allow `display_surface` to bind multiple entities. *(modify)*
- `ring-overlay.ts` — drop fullscreen fixed positioning → in-card animation. *(modify)*
- `aurora-card.ts` / `aurora-card-editor.ts` — rename `ring_screen` → `ring_animation` (back-compat). *(modify)*
- `translations.ts` — new en+it strings. *(modify)*

**Release**
- `manifest.json`, `__init__.py` (`_CARD_VERSION`), `CHANGELOG.md`. *(modify)*

---

## Task 1: `DisplayFeature` model

**Files:**
- Modify: `custom_components/aurora/models.py` (add dataclass near `LightFeature` ~line 95; wire into `AlarmFeatures` ~line 275-308)
- Test: `tests/test_models_display.py`

**Interfaces:**
- Produces: `DisplayFeature(enabled: bool = False, targets: list[str] = [])` with
  `.as_dict() -> dict` and `.from_dict(dict) -> DisplayFeature`; `AlarmFeatures`
  gains a `display: DisplayFeature` field serialised under the `"display"` key.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_models_display.py
"""Pure-logic tests for DisplayFeature (no homeassistant import → runs locally)."""

from custom_components.aurora.models import AlarmFeatures, DisplayFeature


def test_display_defaults():
    d = DisplayFeature()
    assert d.enabled is False
    assert d.targets == []


def test_display_roundtrip():
    d = DisplayFeature(enabled=True, targets=["media_player.smartclock"])
    assert DisplayFeature.from_dict(d.as_dict()) == d


def test_display_from_dict_guards_bad_targets():
    d = DisplayFeature.from_dict({"enabled": True, "targets": ["a", "", None, 7]})
    assert d.targets == ["a", "7"]  # falsy dropped, others coerced to str


def test_alarm_features_includes_display():
    feats = AlarmFeatures.from_dict({"display": {"enabled": True, "targets": ["x"]}})
    assert feats.display.enabled is True
    assert feats.display.targets == ["x"]
    assert "display" in feats.as_dict()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_models_display.py -v`
Expected: FAIL — `ImportError: cannot import name 'DisplayFeature'`.

- [ ] **Step 3: Add the `DisplayFeature` dataclass**

Insert after `LightFeature` (after line 124, before `AudioFeature`):

```python
@dataclass(slots=True)
class DisplayFeature:
    """Wake-overlay on screen-controllable displays.

    ``targets`` are ``display_surface`` role entity_ids (the kiosk's media_player
    entity). Empty means "use every bound display_surface target", mirroring how
    the audio feature falls back to the role binding. The overlay's colour/ramp
    reuse the alarm's LightFeature settings, so there is nothing else to store.
    """

    enabled: bool = False
    targets: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-safe dict."""
        return {"enabled": self.enabled, "targets": list(self.targets)}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Deserialise from a stored dict, dropping empty/invalid targets."""
        raw = data.get("targets") or []
        targets = [str(t) for t in raw if t]
        return cls(enabled=bool(data.get("enabled", False)), targets=targets)
```

- [ ] **Step 4: Wire `display` into `AlarmFeatures`**

In `AlarmFeatures` (the dataclass at ~line 275): add the field after `briefing`:

```python
    briefing: BriefingFeature = field(default_factory=BriefingFeature)
    display: DisplayFeature = field(default_factory=DisplayFeature)
```

In `AlarmFeatures.as_dict` add the entry:

```python
            "briefing": self.briefing.as_dict(),
            "display": self.display.as_dict(),
```

In `AlarmFeatures.from_dict` add the kwarg:

```python
            briefing=BriefingFeature.from_dict(data.get("briefing", {})),
            display=DisplayFeature.from_dict(data.get("display", {})),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_models_display.py -v`
Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
git add custom_components/aurora/models.py tests/test_models_display.py
git commit -m "$(cat <<'EOF'
Add DisplayFeature (per-alarm display targets) to the alarm model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `DisplaySurfaceAdapter` (fully_kiosk tier)

**Files:**
- Modify: `custom_components/aurora/const.py` (add fully_kiosk constants)
- Create: `custom_components/aurora/adapters/display.py`
- Test: `tests/test_adapter_display.py` *(HA-dependent → CI; still authored now)*

**Interfaces:**
- Consumes: `LightFeature.color_temp_kelvin`, `LightFeature.duration_min` (passed
  in by the controller).
- Produces: `DisplaySurfaceAdapter(hass, entity_id, *, color_temp_kelvin: int | None,
  duration_min: int, label: str)` implementing the `OutputAdapter` protocol
  (`async_start()` / `async_stop()`). Non-fully_kiosk targets no-op cleanly.

- [ ] **Step 1: Add fully_kiosk constants to `const.py`**

Append to the "Known third-party domains" section (after `DOMAIN_BROWSER_MOD`):

```python
# Fully Kiosk display control. translation_keys are locale-independent, so the
# DisplaySurfaceAdapter resolves the device's control entities by these keys via
# the entity registry — never by a localized entity_id.
FK_LOAD_URL_SERVICE: Final = "load_url"
FK_TK_SCREEN_ON: Final = "screen_on"          # switch
FK_TK_SCREENSAVER: Final = "screensaver"      # switch
FK_TK_SCREEN_BRIGHTNESS: Final = "screen_brightness"  # number
FK_TK_LOAD_START_URL: Final = "load_start_url"  # button (restore)
FK_TK_TO_FOREGROUND: Final = "to_foreground"    # button
RING_ROUTE_PATH: Final = "/aurora/ring"
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_adapter_display.py
"""Tier-selection + service-call tests for DisplaySurfaceAdapter (CI: imports HA)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.aurora.adapters.display import DisplaySurfaceAdapter


@pytest.fixture
def hass():
    h = MagicMock()
    h.services.async_call = AsyncMock()
    return h


def _registry(entities):
    """Build a fake entity registry: entities = list of (entity_id, tk, platform)."""
    reg = MagicMock()
    by_id = {e[0]: MagicMock(entity_id=e[0], translation_key=e[1],
                             platform=e[2], device_id="dev1") for e in entities}
    reg.async_get.side_effect = lambda eid: by_id.get(eid)
    return reg, list(by_id.values())


@pytest.mark.asyncio
async def test_non_fully_kiosk_target_noops(hass):
    reg, entries = _registry([("media_player.tv", None, "cast")])
    with patch("custom_components.aurora.adapters.display.er.async_get", return_value=reg), \
         patch("custom_components.aurora.adapters.display.er.async_entries_for_device",
               return_value=entries):
        a = DisplaySurfaceAdapter(hass, "media_player.tv",
                                  color_temp_kelvin=2700, duration_min=30, label="x")
        await a.async_start()
    hass.services.async_call.assert_not_called()


@pytest.mark.asyncio
async def test_fully_kiosk_start_loads_ring_and_wakes(hass):
    reg, entries = _registry([
        ("media_player.smartclock", None, "fully_kiosk"),
        ("switch.sc_screen", "screen_on", "fully_kiosk"),
        ("switch.sc_ss", "screensaver", "fully_kiosk"),
        ("number.sc_bri", "screen_brightness", "fully_kiosk"),
        ("button.sc_fg", "to_foreground", "fully_kiosk"),
        ("button.sc_home", "load_start_url", "fully_kiosk"),
    ])
    hass.states.get.return_value = MagicMock(state="on", attributes={"min": 0, "max": 255})
    with patch("custom_components.aurora.adapters.display.er.async_get", return_value=reg), \
         patch("custom_components.aurora.adapters.display.er.async_entries_for_device",
               return_value=entries), \
         patch("custom_components.aurora.adapters.display.get_url", return_value="http://ha"):
        a = DisplaySurfaceAdapter(hass, "media_player.smartclock",
                                  color_temp_kelvin=2700, duration_min=30, label="Wake")
        await a.async_start()
    calls = [(c.args[0], c.args[1], c.args[2]) for c in hass.services.async_call.call_args_list]
    # fully_kiosk.load_url to the ring route
    assert ("fully_kiosk", "load_url",
            {"device_id": "dev1", "url": "http://ha/aurora/ring"}) in calls
    # screen on + screensaver off issued
    assert ("switch", "turn_on", {"entity_id": "switch.sc_screen"}) in calls
    assert ("switch", "turn_off", {"entity_id": "switch.sc_ss"}) in calls


@pytest.mark.asyncio
async def test_fully_kiosk_stop_restores(hass):
    reg, entries = _registry([
        ("media_player.smartclock", None, "fully_kiosk"),
        ("button.sc_home", "load_start_url", "fully_kiosk"),
        ("switch.sc_ss", "screensaver", "fully_kiosk"),
    ])
    hass.states.get.return_value = MagicMock(state="on", attributes={"min": 0, "max": 255})
    with patch("custom_components.aurora.adapters.display.er.async_get", return_value=reg), \
         patch("custom_components.aurora.adapters.display.er.async_entries_for_device",
               return_value=entries), \
         patch("custom_components.aurora.adapters.display.get_url", return_value="http://ha"):
        a = DisplaySurfaceAdapter(hass, "media_player.smartclock",
                                  color_temp_kelvin=None, duration_min=1, label="x")
        await a.async_start()
        hass.services.async_call.reset_mock()
        await a.async_stop()
    calls = [(c.args[0], c.args[1], c.args[2]) for c in hass.services.async_call.call_args_list]
    assert ("button", "press", {"entity_id": "button.sc_home"}) in calls
```

- [ ] **Step 3: Run test to verify it fails**

Run (CI environment): `python -m pytest tests/test_adapter_display.py -v`
Expected: FAIL — `ModuleNotFoundError: ...adapters.display`.

- [ ] **Step 4: Implement the adapter**

```python
# custom_components/aurora/adapters/display.py
"""DisplaySurface adapter — a software sunrise overlay on a screen-controllable display.

Capability-tiered. The implemented tier is Fully Kiosk: the adapter resolves the
target media_player's device and its sibling control entities from the entity
registry (by locale-independent ``translation_key``), wakes the screen, ramps the
screen-brightness ``number`` over the wake window, and points the kiosk at the
Aurora ``/aurora/ring`` route (rendered info-only by the panel). On stop it
presses the kiosk's "load start URL" button to restore, and restores the
screensaver + brightness it captured. Non-fully_kiosk targets no-op (a future
browser_mod tier slots in at the marked seam). Every call is best-effort.
"""

import asyncio
import contextlib
import logging

from homeassistant.const import (
    ATTR_ENTITY_ID,
    SERVICE_TURN_OFF,
    SERVICE_TURN_ON,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.network import NoURLAvailableError, get_url

from ..const import (
    DOMAIN_FULLY_KIOSK,
    FK_LOAD_URL_SERVICE,
    FK_TK_LOAD_START_URL,
    FK_TK_SCREEN_BRIGHTNESS,
    FK_TK_SCREEN_ON,
    FK_TK_SCREENSAVER,
    FK_TK_TO_FOREGROUND,
    RING_ROUTE_PATH,
)

_LOGGER = logging.getLogger(__name__)

_RAMP_STEPS = 20
_NUMBER_DOMAIN = "number"
_BUTTON_DOMAIN = "button"
_SWITCH_DOMAIN = "switch"
_SERVICE_SET_VALUE = "set_value"
_SERVICE_PRESS = "press"


class DisplaySurfaceAdapter:
    """Drive one screen-controllable display as a wake overlay."""

    def __init__(
        self,
        hass: HomeAssistant,
        entity_id: str,
        *,
        color_temp_kelvin: int | None,
        duration_min: int,
        label: str,
    ) -> None:
        """Store the target and the (reused) light ramp parameters."""
        self._hass = hass
        self._entity_id = entity_id
        self._color_temp_kelvin = color_temp_kelvin
        self._duration_s = max(1, duration_min) * 60
        self._label = label
        self._device_id: str | None = None
        self._controls: dict[str, str] = {}  # translation_key -> entity_id
        self._task: asyncio.Task[None] | None = None
        self._restore_screensaver: str | None = None
        self._restore_brightness: float | None = None

    def _resolve(self) -> bool:
        """Resolve the device + sibling control entities. False if not fully_kiosk."""
        registry = er.async_get(self._hass)
        entry = registry.async_get(self._entity_id)
        if entry is None or entry.platform != DOMAIN_FULLY_KIOSK:
            return False  # seam: a browser_mod tier would branch here.
        self._device_id = entry.device_id
        if self._device_id is None:
            return False
        for sibling in er.async_entries_for_device(registry, self._device_id):
            if sibling.translation_key:
                self._controls[sibling.translation_key] = sibling.entity_id
        return True

    async def async_start(self) -> None:
        """Wake the screen, load the ring route and ramp the brightness."""
        if not self._resolve() or self._device_id is None:
            return
        await self._capture_restore_state()
        await self._switch(FK_TK_SCREEN_ON, SERVICE_TURN_ON)
        await self._switch(FK_TK_SCREENSAVER, SERVICE_TURN_OFF)
        await self._press(FK_TK_TO_FOREGROUND)
        await self._load_ring_url()
        if FK_TK_SCREEN_BRIGHTNESS in self._controls:
            self._task = self._hass.async_create_task(self._async_ramp())

    async def _load_ring_url(self) -> None:
        """Point the kiosk at the info-only ring route."""
        try:
            url = f"{get_url(self._hass)}{RING_ROUTE_PATH}"
        except NoURLAvailableError:
            _LOGGER.debug("Aurora display: no HA URL available; cannot load ring route")
            return
        await self._call(
            DOMAIN_FULLY_KIOSK,
            FK_LOAD_URL_SERVICE,
            {"device_id": self._device_id, "url": url},
        )

    async def _capture_restore_state(self) -> None:
        """Remember the screensaver + brightness so async_stop can put them back."""
        if (ss := self._controls.get(FK_TK_SCREENSAVER)) and (
            state := self._hass.states.get(ss)
        ):
            self._restore_screensaver = state.state
        if (bri := self._controls.get(FK_TK_SCREEN_BRIGHTNESS)) and (
            state := self._hass.states.get(bri)
        ):
            with contextlib.suppress(TypeError, ValueError):
                self._restore_brightness = float(state.state)

    async def _async_ramp(self) -> None:
        """Step the screen-brightness number from min to max over the window."""
        entity_id = self._controls[FK_TK_SCREEN_BRIGHTNESS]
        low, high = self._number_range(entity_id)
        interval = self._duration_s / _RAMP_STEPS
        with contextlib.suppress(asyncio.CancelledError):
            for step in range(1, _RAMP_STEPS + 1):
                value = low + (high - low) * (step / _RAMP_STEPS)
                await self._call(
                    _NUMBER_DOMAIN, _SERVICE_SET_VALUE,
                    {ATTR_ENTITY_ID: entity_id, "value": value},
                )
                if step < _RAMP_STEPS:
                    await asyncio.sleep(interval)

    def _number_range(self, entity_id: str) -> tuple[float, float]:
        """Return (min, max) for the brightness number (defaults 0..255)."""
        state = self._hass.states.get(entity_id)
        if state is None:
            return (0.0, 255.0)
        return (
            float(state.attributes.get("min", 0.0)),
            float(state.attributes.get("max", 255.0)),
        )

    async def async_stop(self) -> None:
        """Cancel the ramp, restore the start URL, screensaver and brightness."""
        if self._task is not None:
            self._task.cancel()
            self._task = None
        await self._press(FK_TK_LOAD_START_URL)
        if self._restore_screensaver in ("on", "off") and (
            ss := self._controls.get(FK_TK_SCREENSAVER)
        ):
            service = SERVICE_TURN_ON if self._restore_screensaver == "on" else SERVICE_TURN_OFF
            await self._call(_SWITCH_DOMAIN, service, {ATTR_ENTITY_ID: ss})
        if self._restore_brightness is not None and (
            bri := self._controls.get(FK_TK_SCREEN_BRIGHTNESS)
        ):
            await self._call(
                _NUMBER_DOMAIN, _SERVICE_SET_VALUE,
                {ATTR_ENTITY_ID: bri, "value": self._restore_brightness},
            )

    async def _switch(self, tk: str, service: str) -> None:
        """Call a switch service on the sibling entity with this translation_key."""
        if entity_id := self._controls.get(tk):
            await self._call(_SWITCH_DOMAIN, service, {ATTR_ENTITY_ID: entity_id})

    async def _press(self, tk: str) -> None:
        """Press the sibling button with this translation_key."""
        if entity_id := self._controls.get(tk):
            await self._call(_BUTTON_DOMAIN, _SERVICE_PRESS, {ATTR_ENTITY_ID: entity_id})

    async def _call(self, domain: str, service: str, data: dict) -> None:
        """Fire a service call, swallowing device errors (best-effort)."""
        try:
            await self._hass.services.async_call(domain, service, data, blocking=False)
        except HomeAssistantError as err:
            _LOGGER.debug("Aurora display: %s.%s failed: %s", domain, service, err)
```

- [ ] **Step 5: Run test to verify it passes**

Run (CI): `python -m pytest tests/test_adapter_display.py -v`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add custom_components/aurora/const.py custom_components/aurora/adapters/display.py tests/test_adapter_display.py
git commit -m "$(cat <<'EOF'
Add DisplaySurfaceAdapter (fully_kiosk wake-overlay tier)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire the display adapter into `RingController`

**Files:**
- Modify: `custom_components/aurora/ring.py` (imports ~line 16-28; `async_start` ~line 136-147)
- Test: `tests/test_ring_display.py` *(HA-dependent → CI)*

**Interfaces:**
- Consumes: `DisplaySurfaceAdapter` (Task 2), `DisplayFeature` (Task 1),
  `ROLE_DISPLAY_SURFACE`.
- Produces: one `DisplaySurfaceAdapter` per resolved target appended to the ring's
  adapter list when `display.enabled` and a target resolves.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ring_display.py
"""RingController wires display adapters under the right conditions (CI)."""

from unittest.mock import MagicMock, patch

import pytest

from custom_components.aurora.models import AuroraAlarm
from custom_components.aurora.ring import RingController


def _alarm(display_enabled, targets):
    return AuroraAlarm.from_dict({
        "id": "a1", "time": "07:00",
        "features": {"display": {"enabled": display_enabled, "targets": targets}},
    })


@pytest.mark.asyncio
async def test_display_adapter_added_when_enabled_with_target():
    rc = RingController(MagicMock())
    with patch("custom_components.aurora.ring.DisplaySurfaceAdapter") as Adapter:
        Adapter.return_value.async_start = MagicMock(return_value=None)
        await rc.async_start(_alarm(True, ["media_player.smartclock"]), {})
    Adapter.assert_called_once()
    assert Adapter.call_args.args[1] == "media_player.smartclock"


@pytest.mark.asyncio
async def test_no_display_adapter_when_disabled():
    rc = RingController(MagicMock())
    with patch("custom_components.aurora.ring.DisplaySurfaceAdapter") as Adapter:
        await rc.async_start(_alarm(False, ["media_player.smartclock"]), {})
    Adapter.assert_not_called()


@pytest.mark.asyncio
async def test_display_targets_fall_back_to_role_binding():
    rc = RingController(MagicMock())
    with patch("custom_components.aurora.ring.DisplaySurfaceAdapter") as Adapter:
        await rc.async_start(_alarm(True, []), {"display_surface": "media_player.sc"})
    Adapter.assert_called_once()
    assert Adapter.call_args.args[1] == "media_player.sc"
```

(Note: `await adapter.async_start()` is awaited in the controller; the patched
adapter returns a coroutine-free mock via `AsyncMock` if needed — adjust the mock
to `AsyncMock` on `async_start`/`async_stop` if the runner complains.)

- [ ] **Step 2: Run test to verify it fails**

Run (CI): `python -m pytest tests/test_ring_display.py -v`
Expected: FAIL — `ImportError: cannot import name 'DisplaySurfaceAdapter'` from ring.

- [ ] **Step 3: Add the import**

In `ring.py`, after `from .adapters.light import WakeLightAdapter` (line 18):

```python
from .adapters.display import DisplaySurfaceAdapter
```

And add `ROLE_DISPLAY_SURFACE` to the `from .const import (...)` block (after
`ROLE_AUDIO_SINK`):

```python
    ROLE_AUDIO_SINK,
    ROLE_DISPLAY_SURFACE,
```

- [ ] **Step 4: Construct the adapters**

In `async_start`, immediately after the light block (after line 147, before the
NotifyChannel block):

```python
        display = alarm.features.display
        display_targets = display.targets or _as_list(options.get(ROLE_DISPLAY_SURFACE))
        if display.enabled and display_targets:
            for target in display_targets:
                adapters.append(
                    DisplaySurfaceAdapter(
                        self._hass,
                        target,
                        color_temp_kelvin=light.color_temp_kelvin,
                        duration_min=light.duration_min,
                        label=alarm.label,
                    )
                )
```

(`light` is already in scope from the light block above; the overlay reuses its
colour + duration per the design.)

- [ ] **Step 5: Run test to verify it passes**

Run (CI): `python -m pytest tests/test_ring_display.py -v`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add custom_components/aurora/ring.py tests/test_ring_display.py
git commit -m "$(cat <<'EOF'
Ring: start a DisplaySurfaceAdapter per targeted display

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend types + alarm-editor Display section

**Files:**
- Modify: `aurora-card/src/types.ts` (`AlarmFeatures` ~line 82-103)
- Modify: `aurora-card/src/alarm-dialog.ts` (state, `_populate` ~line 86, `_save` ~line 322, render ~line 595)
- Modify: `aurora-card/src/translations.ts` (new keys — see Task 8; add the keys this task references)

**Interfaces:**
- Consumes: bound `display_surface` entities (from `getRoleEntities`/`getSettings`).
- Produces: `features.display = { enabled, targets }` in the save payload.

- [ ] **Step 1: Add the `display` type**

In `types.ts`, inside `AlarmFeatures` (after `briefing`):

```typescript
  briefing: { enabled: boolean; blocks: string[]; template?: string | null };
  display: { enabled: boolean; targets: string[] };
```

- [ ] **Step 2: Add editor state + populate**

In `alarm-dialog.ts`, add states near the other `@state()` fields:

```typescript
  @state() private _display = false;
  @state() private _displayTargets: string[] = [];
  @state() private _displayOptions: string[] = [];
```

In `_populate` (after the briefing lines ~112):

```typescript
    this._display = a?.features.display?.enabled ?? false;
    this._displayTargets = [...(a?.features.display?.targets ?? [])];
```

In the dialog's load path (where it already fetches settings/role entities; mirror
how the open-door mission entity list is obtained), populate `_displayOptions`
with the bound `display_surface` entity_ids:

```typescript
    // roleEntities.roles is { role: entity_id[] } from getRoleEntities(hass)
    this._displayOptions = roleEntities.roles["display_surface"] ?? [];
```

- [ ] **Step 3: Render the Display section**

Add a `_displayBlock` method (mirrors the briefing multi-select + a toggle row):

```typescript
  private _displayBlock(lang?: string): TemplateResult {
    return html`
      <div class="togglerow">
        <label>${localize(lang, "dialog.display")}</label>
        <ha-switch
          .checked=${this._display}
          @change=${(e: Event) => (this._display = (e.target as HTMLInputElement).checked)}
        ></ha-switch>
      </div>
      ${this._display
        ? this._displayOptions.length
          ? html`<ha-selector
              .hass=${this.hass}
              .selector=${{ select: {
                multiple: true,
                options: this._displayOptions.map((id) => ({
                  value: id,
                  label: this.hass.states[id]?.attributes.friendly_name ?? id,
                })),
              } }}
              .value=${this._displayTargets}
              @value-changed=${(e: CustomEvent) => (this._displayTargets = e.detail.value)}
            ></ha-selector>`
          : html`<div class="hint">${localize(lang, "dialog.display_none")}</div>`
        : nothing}
    `;
  }
```

Render it after `${this._volumeBlock(lang)}` (~line 595):

```typescript
        ${this._volumeBlock(lang)}
        ${this._displayBlock(lang)}
```

- [ ] **Step 4: Write `display` in `_save`**

In `_save`'s `features` object (after the `briefing` entry, ~line 343):

```typescript
        display: {
          ...prev?.display,
          enabled: this._display,
          targets: this._display ? this._displayTargets : [],
        },
```

- [ ] **Step 5: Build to verify the bundle compiles**

Run: `cd aurora-card && npm run build`
Expected: build succeeds, emits `custom_components/aurora/www/aurora-card.js`.

- [ ] **Step 6: Commit**

```bash
git add aurora-card/src/types.ts aurora-card/src/alarm-dialog.ts aurora-card/src/translations.ts custom_components/aurora/www/aurora-card.js
git commit -m "$(cat <<'EOF'
Alarm editor: Display section (enable + pick target displays)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Multi-bind `display_surface` in Setup

**Files:**
- Modify: `aurora-card/src/devices-view.ts` (role-binding render + save)

**Interfaces:**
- Produces: `display_surface` stored as a list of entity_ids in the profile/role
  bindings (the backend + Task 3 already read it via `_as_list`).

- [ ] **Step 1: Allow multiple selection for display_surface**

In `devices-view.ts`, where each role renders its entity picker, branch
`display_surface` to a multi-select (the other roles stay single). Use the same
`ha-selector` entity picker with `multiple: true` and the role's domains:

```typescript
    const multiple = role === "display_surface";
    return html`<ha-selector
      .hass=${this.hass}
      .selector=${{ entity: { domain: ["media_player", "switch", "light"], multiple } }}
      .value=${multiple ? (this._binding(role) as string[]) : (this._binding(role) as string)}
      @value-changed=${(e: CustomEvent) => this._setBinding(role, e.detail.value)}
    ></ha-selector>`;
```

- [ ] **Step 2: Persist a list for display_surface**

In `_setBinding`/`_save`, store `display_surface` as the array value directly
(other roles keep their single string). Ensure the existing re-fetch-and-spread
save path (preserving `audio_presets` etc.) is unchanged.

- [ ] **Step 3: Build**

Run: `cd aurora-card && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add aurora-card/src/devices-view.ts custom_components/aurora/www/aurora-card.js
git commit -m "$(cat <<'EOF'
Setup: display_surface binds multiple displays

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `aurora-ring-display` element + panel ring route

**Files:**
- Create: `aurora-card/src/ring-display.ts`
- Modify: `aurora-card/src/aurora-panel.ts` (add `route` prop + branch render)

**Interfaces:**
- Produces: `<aurora-ring-display .hass>` info-only element; `aurora-panel` renders
  only it when `route.path === "/ring"`.

- [ ] **Step 1: Create the info-only element**

```typescript
// aurora-card/src/ring-display.ts
import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HassEntity, HomeAssistant } from "./types";

/**
 * Info-only wake overlay rendered fullscreen on a pushed display (/aurora/ring).
 * It shows the time, the alarm label and a sunrise gradient — NO buttons, no
 * mission, no interaction. It is a software sunrise lamp, not an alarm control.
 */
@customElement("aurora-ring-display")
export class AuroraRingDisplay extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _now = new Date();
  private _timer?: number;

  connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => (this._now = new Date()), 1000);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) window.clearInterval(this._timer);
  }

  private get _sensor(): HassEntity | undefined {
    return Object.values(this.hass?.states ?? {}).find((e) =>
      e.entity_id.startsWith("binary_sensor.aurora")
    );
  }
  private get _ringing(): boolean {
    return this._sensor?.state === "on";
  }
  private get _label(): string {
    return (this._sensor?.attributes?.["label"] as string | undefined) ?? "";
  }

  static styles = [
    auroraStyles,
    css`
      .screen {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        color: #fff;
        overflow: hidden;
        background: #14122a;
      }
      .sky {
        position: absolute;
        inset: 0;
        background: radial-gradient(120% 80% at 50% 118%,
          #ffd27a 0%, #f0883e 22%, #a44a86 48%, #3a2a6b 72%, #14122a 100%);
        animation: rise 7s ease-out both;
      }
      .content { position: relative; text-align: center; }
      .big { font-size: clamp(5rem, 22vw, 14rem); text-shadow: 0 6px 40px rgba(0,0,0,.35); }
      .label { font-size: 1.4rem; letter-spacing: .16em; text-transform: uppercase; opacity: .9; }
      .idle { opacity: .5; font-size: 1.1rem; }
      @keyframes rise { from { filter: brightness(.3) saturate(.8); } to { filter: brightness(1); } }
    `,
  ];

  render(): TemplateResult | typeof nothing {
    if (!this.hass) return nothing;
    const hh = String(this._now.getHours()).padStart(2, "0");
    const mm = String(this._now.getMinutes()).padStart(2, "0");
    if (!this._ringing) {
      return html`<div class="screen"><div class="content">
        <div class="big clock">${hh}:${mm}</div>
      </div></div>`;
    }
    return html`<div class="screen">
      <div class="sky"></div>
      <div class="content">
        <div class="big clock">${hh}:${mm}</div>
        <div class="label">${this._label || localize(this.hass?.language, "ring.label")}</div>
      </div>
    </div>`;
  }
}
```

- [ ] **Step 2: Add the ring route to the panel**

In `aurora-panel.ts`, import the element and add the `route` property:

```typescript
import "./ring-display";
```

```typescript
  @property({ attribute: false }) route?: { prefix: string; path: string };
```

At the very top of `render()` (before the normal markup), short-circuit:

```typescript
  render(): TemplateResult {
    if (!this.hass) return html`${nothing}`;
    if (this.route?.path === "/ring") {
      return html`<aurora-ring-display .hass=${this.hass}></aurora-ring-display>`;
    }
    // ...existing management UI...
```

- [ ] **Step 3: Build and verify it compiles**

Run: `cd aurora-card && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add aurora-card/src/ring-display.ts aurora-card/src/aurora-panel.ts custom_components/aurora/www/aurora-card.js
git commit -m "$(cat <<'EOF'
Add info-only aurora-ring-display + /aurora/ring panel route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: In-card ring animation (rename `ring_screen` → `ring_animation`)

**Files:**
- Modify: `aurora-card/src/ring-overlay.ts` (drop fullscreen fixed positioning)
- Modify: `aurora-card/src/aurora-card.ts` (config key + gating ~line 11-18, 174-176)
- Modify: `aurora-card/src/aurora-card-editor.ts` (toggle label/key)

**Interfaces:**
- Produces: `AuroraCardConfig.ring_animation?: boolean` (honouring legacy
  `ring_screen`); the overlay renders inside the card, not as a device overlay.

- [ ] **Step 1: Make the overlay card-contained**

In `ring-overlay.ts`, change the `.overlay` style from a fixed device overlay to
a contained block:

```css
      .overlay {
        position: relative;     /* was: fixed; inset: 0; z-index: 20; */
        min-height: 360px;
        border-radius: var(--aurora-radius);
        display: grid;
        place-items: center;
        color: #fff;
        overflow: hidden;
        background: #14122a;
      }
```

(Keep the sky/sun/content/actions styles and the interactive snooze/stop/mission
behaviour — the in-card animation stays interactive.)

- [ ] **Step 2: Rename the config key with back-compat**

In `aurora-card.ts`, update the interface + accessor:

```typescript
export interface AuroraCardConfig {
  type: string;
  title?: string;
  compact?: boolean;
  /** Show the ringing animation inside this card (opt-in). Legacy key:
   * ring_screen. Off by default. */
  ring_animation?: boolean;
  /** @deprecated use ring_animation */
  ring_screen?: boolean;
}
```

Add a getter and use it in `render()`:

```typescript
  private get _ringAnimation(): boolean {
    return this._config.ring_animation ?? this._config.ring_screen ?? false;
  }
```

Replace the gating block (line 174-176):

```typescript
      ${this._ringAnimation
        ? html`<aurora-ring-overlay .hass=${this.hass}></aurora-ring-overlay>`
        : nothing}
```

Place the overlay *inside* the `ha-card` wrap (so it is contained), e.g. after the
`.body` div, instead of after `</ha-card>`.

Update `getStubConfig`:

```typescript
  static getStubConfig(): Partial<AuroraCardConfig> {
    return { title: "Aurora", ring_animation: false };
  }
```

- [ ] **Step 3: Update the visual card editor**

In `aurora-card-editor.ts`, switch the toggle to `ring_animation` (read legacy
`ring_screen` as fallback) and update its label keys to `carded.ring_animation` /
`carded.ring_animation_desc` (added in Task 8).

- [ ] **Step 4: Build**

Run: `cd aurora-card && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add aurora-card/src/ring-overlay.ts aurora-card/src/aurora-card.ts aurora-card/src/aurora-card-editor.ts aurora-card/src/translations.ts custom_components/aurora/www/aurora-card.js
git commit -m "$(cat <<'EOF'
Card: ring overlay becomes an opt-in in-card animation (ring_animation)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Localization strings

**Files:**
- Modify: `aurora-card/src/translations.ts` (en + it)

**Interfaces:**
- Produces all keys referenced above: `dialog.display`, `dialog.display_none`,
  `carded.ring_animation`, `carded.ring_animation_desc`. (`ring.label` already
  exists.)

- [ ] **Step 1: Add the English strings**

In the `en` block:

```typescript
    "dialog.display": "Wake on displays",
    "dialog.display_none": "No displays are set up. Bind one in Setup → Wake & display.",
    "carded.ring_animation": "Ring animation in this card",
    "carded.ring_animation_desc": "Show the ringing animation inside this card (this card only, not a full-screen takeover).",
```

- [ ] **Step 2: Add the Italian strings**

In the `it` block:

```typescript
    "dialog.display": "Sveglia sui display",
    "dialog.display_none": "Nessun display configurato. Assegnane uno in Setup → Sveglia & display.",
    "carded.ring_animation": "Animazione suoneria in questa card",
    "carded.ring_animation_desc": "Mostra l'animazione di suoneria dentro questa card (solo questa card, non a tutto schermo).",
```

- [ ] **Step 3: Build + commit**

```bash
cd aurora-card && npm run build && cd ..
git add aurora-card/src/translations.ts custom_components/aurora/www/aurora-card.js
git commit -m "$(cat <<'EOF'
i18n: display section + ring_animation strings (en+it)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Version bump, changelog, deploy + live test

**Files:**
- Modify: `custom_components/aurora/manifest.json` (`version`)
- Modify: `custom_components/aurora/__init__.py` (`_CARD_VERSION`)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run the full local pure-test + lint suite**

Run: `python -m pytest tests/test_models_display.py -v && cd aurora-card && npm run build && cd ..`
Expected: pure model tests PASS; bundle builds. (Adapter/ring tests run on CI.)

- [ ] **Step 2: Bump the version to 0.16.0**

In `manifest.json`: `"version": "0.16.0"`. In `__init__.py`:
`_CARD_VERSION = "0.16.0"`.

- [ ] **Step 3: Add the changelog entry**

Prepend under the title (Keep a Changelog style, English, no emoji):

```markdown
## 0.16.0 - 2026-06-18

### Added
- Per-alarm **display wake overlay**: pick one or more screen-controllable
  displays (Fully Kiosk) in the alarm editor; when the alarm rings, Aurora wakes
  the screen, ramps its brightness over the wake window, and shows a fullscreen,
  info-only sunrise (clock + label) by loading the new `/aurora/ring` view. On
  dismiss it reloads the kiosk's start URL and restores the screen. The overlay
  reuses the alarm's light colour/duration and is non-interactive — a software
  sunrise lamp, not an alarm control.
- `display_surface` can now be bound to multiple displays in Setup.

### Changed
- The card's ringing view is now an opt-in **in-card animation**
  (`ring_animation`, formerly `ring_screen`) contained within the card, instead
  of a full-screen device takeover. The old key is still honoured.
```

- [ ] **Step 4: Commit**

```bash
git add custom_components/aurora/manifest.json custom_components/aurora/__init__.py CHANGELOG.md
git commit -m "$(cat <<'EOF'
Release 0.16.0: display wake overlay + in-card ring animation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Push + deploy via HACS, then live-test on the instance**

Push, update through HACS, restart HA (the user performs the HA login/restart).
Then:
1. In Setup → Wake & display, bind `media_player.smartclock` as a display.
2. Edit `human_test`: enable **Display**, select SmartClock; ensure Light has a
   colour/duration.
3. Trigger `aurora.trigger_now` with `{id: "human_test"}`.
4. Verify on SmartClock: screen wakes, loads `/aurora/ring`, shows the info-only
   sunrise (no buttons), brightness ramps.
5. Dismiss (open the door / `aurora.dismiss`) → verify the kiosk reloads its start
   URL and the screensaver/brightness restore.
6. Confirm the management panel shows **no** overlay, and a card with
   `ring_animation: true` shows the animation only inside the card.

---

## Self-Review

**Spec coverage:**
- Behaviour A (in-card animation) → Task 7. ✓
- Behaviour B (display overlay, info-only, pushed) → Tasks 2, 3, 6. ✓
- `DisplayFeature` + reuse of LightFeature colour/duration → Tasks 1, 3. ✓
- `display_surface` multi-bind + per-alarm selection → Tasks 4, 5. ✓
- fully_kiosk tier (load_url to /aurora/ring, screen/screensaver, brightness ramp,
  load_start_url restore), entity resolution by translation_key → Task 2. ✓
- Panel ring route → Task 6. ✓
- Localization (en+it, no hardcoded strings) → Task 8. ✓
- Testing (pure local + CI + live) → Tasks 1-3 tests, Task 9 live. ✓
- Release → Task 9. ✓

**Placeholder scan:** No TBD/TODO; every code step shows real code. Task 5's
devices-view edits reference the file's existing save path (the implementer must
keep the re-fetch-and-spread that preserves `audio_presets`) — flagged, not
deferred.

**Type consistency:** `DisplayFeature(enabled, targets)` is used identically in
models, ring wiring, and the frontend `features.display = { enabled, targets }`.
The adapter constructor `(hass, entity_id, *, color_temp_kelvin, duration_min,
label)` matches its call site in Task 3. `translation_key` constants
(`FK_TK_*`) are defined in Task 1's const edit (Task 2 Step 1) and consumed in
Task 2 Step 4.

**Known risk to verify during execution:** Task 4 assumes the alarm dialog has (or
can call) `getRoleEntities(hass)` to list bound `display_surface` entities; if the
dialog doesn't already fetch role entities, add that fetch in Task 4 Step 2 (the
panel/devices-view already use `getSettings`/role-entities helpers in `api.ts`).
