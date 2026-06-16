"""Tests for Aurora smart-wake window behaviour.

Verifies the sleep-aware pre-wake path end-to-end through the public surface:
set up with ROLE_SLEEP_SIGNAL / ROLE_PRESENCE_SIGNAL bound to fake entities,
add a smart-window alarm, advance time into the 30-minute pre-wake window, and
assert observable entity state transitions (pre_wake -> ringing vs. idle until
exact time).

Pure sleep.py helpers (interpret_signal, fuse, SleepFusion) are tested in
isolation so regressions in signal interpretation are caught independently from
the coordinator integration.  The pure-unit tests in tests/test_sleep.py cover
the same helpers from a different angle; the tests here add edge-case coverage
that is not duplicated there.
"""

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)

from custom_components.aurora.const import (
    DEFAULT_SMART_WINDOW_MIN,
    DOMAIN,
    ROLE_PRESENCE_SIGNAL,
    ROLE_SLEEP_SIGNAL,
    SERVICE_ADD_ALARM,
    SERVICE_DISMISS,
)
from custom_components.aurora.sleep import SleepFusion, fuse, interpret_signal

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SLEEP_ENTITY = "binary_sensor.fake_sleep"
_PRESENCE_ENTITY = "binary_sensor.fake_presence"


async def _setup(
    hass: HomeAssistant, *, extra_options: dict | None = None
) -> MockConfigEntry:
    """Set up Aurora with optional role bindings and return the loaded entry.

    Binds ROLE_SLEEP_SIGNAL and ROLE_PRESENCE_SIGNAL to fake binary_sensor
    entities so the coordinator can read stirring signals during the pre-wake
    window.
    """
    options: dict = {
        ROLE_SLEEP_SIGNAL: _SLEEP_ENTITY,
        ROLE_PRESENCE_SIGNAL: _PRESENCE_ENTITY,
    }
    if extra_options:
        options.update(extra_options)
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options=options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _set_signals(hass: HomeAssistant, *, stirring: bool) -> None:
    """Set the fake signal entities to indicate stirring (on) or asleep (off).

    binary_sensor 'on' maps to awake-ness 1.0, 'off' maps to 0.0 in
    interpret_signal (confirmed from sleep.py _ON_WORDS).
    """
    value = "on" if stirring else "off"
    hass.states.async_set(_SLEEP_ENTITY, value)
    hass.states.async_set(_PRESENCE_ENTITY, value)


async def _add_smart_alarm(hass: HomeAssistant, alarm_time: str) -> None:
    """Add a daily alarm with smart_window enabled at ``alarm_time`` (HH:MM)."""
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {
            "time": alarm_time,
            "label": "Smart Wake Test",
            "features": {
                "smart_window": {
                    "enabled": True,
                    "minutes": DEFAULT_SMART_WINDOW_MIN,
                },
            },
        },
        blocking=True,
    )
    await hass.async_block_till_done()


# ---------------------------------------------------------------------------
# Unit tests for pure sleep.py helpers (no HA dependency)
# ---------------------------------------------------------------------------


def test_interpret_signal_binary_on_is_awake() -> None:
    """binary_sensor 'on' maps to awake-ness score 1.0."""
    assert interpret_signal("binary_sensor", "on", {}) == 1.0


def test_interpret_signal_binary_off_is_asleep() -> None:
    """binary_sensor 'off' maps to awake-ness score 0.0."""
    assert interpret_signal("binary_sensor", "off", {}) == 0.0


def test_interpret_signal_awake_word() -> None:
    """Sensor state 'awake' returns 1.0 regardless of domain."""
    assert interpret_signal("sensor", "awake", {}) == 1.0


def test_interpret_signal_asleep_word() -> None:
    """Sensor state 'asleep' returns 0.0 regardless of domain."""
    assert interpret_signal("sensor", "asleep", {}) == 0.0


def test_interpret_signal_light_sleep_returns_awake() -> None:
    """Sensor state 'light_sleep' is in _AWAKE_WORDS and returns 1.0."""
    assert interpret_signal("sensor", "light_sleep", {}) == 1.0


def test_interpret_signal_deep_sleep_returns_asleep() -> None:
    """Sensor state 'deep_sleep' is in _ASLEEP_WORDS and returns 0.0."""
    assert interpret_signal("sensor", "deep_sleep", {}) == 0.0


def test_interpret_signal_numeric_low_confidence_is_awake() -> None:
    """Low sleep-confidence (e.g. 5%) maps to high awake-ness (~0.95)."""
    score = interpret_signal("sensor", "5", {})
    assert score is not None
    assert score > 0.9


def test_interpret_signal_numeric_high_confidence_is_asleep() -> None:
    """High sleep-confidence (e.g. 95%) maps to low awake-ness (~0.05)."""
    score = interpret_signal("sensor", "95", {})
    assert score is not None
    assert score < 0.1


def test_interpret_signal_unknown_state_returns_none() -> None:
    """Unknown/unavailable state returns None (unusable sample)."""
    assert interpret_signal("sensor", "unavailable", {}) is None
    assert interpret_signal("sensor", "unknown", {}) is None


def test_fuse_ignores_none_samples() -> None:
    """fuse() averages only non-None values; all-None gives None."""
    assert fuse([None, None]) is None
    result = fuse([1.0, None, 0.0])
    assert result is not None
    assert abs(result - 0.5) < 1e-9


def test_sleep_fusion_requires_full_window_before_deciding() -> None:
    """SleepFusion (window=3) does not fire until 3 samples are collected."""
    sf = SleepFusion(window=3)
    assert sf.add(1.0) is False  # 1 sample
    assert sf.add(1.0) is False  # 2 samples
    # Third sample pushes the window past high threshold (avg = 1.0 >= 0.6)
    assert sf.add(1.0) is True


def test_sleep_fusion_hysteresis_prevents_early_flip_back() -> None:
    """Once ready, the fusion stays ready until the average drops below `low`."""
    sf = SleepFusion(window=3, high=0.6, low=0.4)
    # Prime the window with awake scores
    sf.add(1.0)
    sf.add(1.0)
    sf.add(1.0)  # now ready
    assert sf.ready is True
    # A single weak sample (avg drops to (1+1+0.5)/3 ≈ 0.83) still above low
    result = sf.add(0.5)
    assert result is True


def test_sleep_fusion_low_scores_never_trigger() -> None:
    """SleepFusion never fires when all scores are below the high threshold."""
    sf = SleepFusion(window=3, high=0.6, low=0.4)
    result = False
    for _ in range(10):
        result = sf.add(0.0)
    assert result is False
    assert sf.ready is False


def test_sleep_fusion_none_score_preserved_ready_state() -> None:
    """A None score leaves the ready state unchanged (not a new sample)."""
    sf = SleepFusion(window=3)
    sf.add(1.0)
    sf.add(1.0)
    sf.add(1.0)
    assert sf.ready is True
    # None must not reset or alter readiness
    assert sf.add(None) is True


# ---------------------------------------------------------------------------
# Integration tests — coordinator + entities (require HA)
# ---------------------------------------------------------------------------


async def test_state_transitions_to_pre_wake_at_window_start(
    hass: HomeAssistant, freezer
) -> None:
    """Entering the smart window transitions state to pre_wake.

    Alarm at 07:30, window = 30 min → pre-wake starts at 07:00. Advance time
    to 07:00:01 and confirm sensor.aurora_state becomes pre_wake.
    """
    freezer.move_to("2026-06-17 06:55:00+00:00")
    await _setup(hass)
    # Signals show asleep so we do not immediately trigger a ring
    _set_signals(hass, stirring=False)
    await _add_smart_alarm(hass, "07:30")

    # Advance into the pre-wake window (07:00 UTC)
    freezer.move_to("2026-06-17 07:00:01+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    state = hass.states.get("sensor.aurora_state")
    assert state is not None
    assert state.state == "pre_wake"


async def test_stirring_signals_trigger_early_ring(
    hass: HomeAssistant, freezer
) -> None:
    """When signals show stirring inside the window, the alarm rings early.

    SleepFusion requires 3 evaluations at 5-minute intervals. We position the
    clock so the pre-wake window has already opened, then set signals to
    'stirring' and advance time by three 5-minute eval ticks.  The expected
    observable outcome is sensor.aurora_state == 'ringing' before 07:30.

    Timing:
      t=07:00:05 — prewake start fires, _evaluate_prewake(None) called once
                   with signals=off (score 0.0). Window not yet full (1 sample).
      signals switched to "on" (score 1.0) before first interval tick.
      t=07:05:05 — 2nd sample (1.0), history=[0.0, 1.0], window not full.
      t=07:10:05 — 3rd sample (1.0), history=[0.0,1.0,1.0], avg≈0.67≥0.6 → ring.
      t=07:15:05 — not reached (ring cancelled prewake eval loop).
    """
    # Start well before the alarm so the scheduler arms normally
    freezer.move_to("2026-06-17 06:40:00+00:00")
    await _setup(hass)
    # Signals quiet initially so pre-wake opens without immediately ringing
    _set_signals(hass, stirring=False)
    await _add_smart_alarm(hass, "07:30")

    # Enter the pre-wake window (alarm - 30 min = 07:00)
    freezer.move_to("2026-06-17 07:00:05+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "pre_wake"

    # Now user is stirring — binary_sensor 'on' scores 1.0
    _set_signals(hass, stirring=True)

    # Drive three evaluation cycles at 5-minute spacing.
    # _PREWAKE_EVAL_INTERVAL = 5 min; SleepFusion.window = 3.
    # First sample was taken at _start_prewake (t=07:00, signals=off → 0.0).
    # After the third interval tick the moving average (0.0+1.0+1.0)/3 ≈ 0.67
    # >= high (0.6) → early ring fires.
    for minute_offset in (5, 10, 15):
        freezer.move_to(f"2026-06-17 07:{minute_offset:02d}:05+00:00")
        async_fire_time_changed(hass)
        await hass.async_block_till_done()

    alarm_state = hass.states.get("sensor.aurora_state")
    assert alarm_state is not None
    assert alarm_state.state == "ringing", (
        f"Expected early ring before 07:30, got '{alarm_state.state}'"
    )
    assert hass.states.get("binary_sensor.aurora_ringing").state == "on"


async def test_quiet_signals_do_not_trigger_early_ring(
    hass: HomeAssistant, freezer
) -> None:
    """When signals remain quiet the alarm does NOT ring early.

    Signals stay 'off' (asleep) throughout the smart window. The state should
    remain pre_wake (not ringing) up until the exact scheduled time.
    """
    freezer.move_to("2026-06-17 06:40:00+00:00")
    await _setup(hass)
    _set_signals(hass, stirring=False)
    await _add_smart_alarm(hass, "07:30")

    # Enter the pre-wake window
    freezer.move_to("2026-06-17 07:00:05+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "pre_wake"

    # Advance through multiple eval cycles but keep signals asleep
    for minute_offset in (5, 10, 15, 20, 25):
        freezer.move_to(f"2026-06-17 07:{minute_offset:02d}:05+00:00")
        async_fire_time_changed(hass)
        await hass.async_block_till_done()

    # Should still be in pre_wake, NOT ringing.
    # All-zero scores keep avg at 0.0 < high (0.6), fusion never fires.
    alarm_state = hass.states.get("sensor.aurora_state")
    assert alarm_state is not None
    assert alarm_state.state == "pre_wake", (
        f"Expected pre_wake (signals asleep), got '{alarm_state.state}'"
    )
    assert hass.states.get("binary_sensor.aurora_ringing").state == "off"


async def test_fallback_rings_at_exact_time(
    hass: HomeAssistant, freezer
) -> None:
    """Quiet signals through the window → alarm fires at the exact scheduled time.

    After the smart window passes with no stirring the original UTC timer still
    fires at 07:30, producing state 'ringing'.
    """
    freezer.move_to("2026-06-17 06:40:00+00:00")
    await _setup(hass)
    _set_signals(hass, stirring=False)
    await _add_smart_alarm(hass, "07:30")

    # Jump directly to the exact alarm time (bypass intermediate eval ticks).
    # async_fire_time_changed fires ALL pending timers (07:00 prewake start
    # and 07:30 main alarm) in chronological order, so we reach 'ringing'.
    freezer.move_to("2026-06-17 07:30:00+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    alarm_state = hass.states.get("sensor.aurora_state")
    assert alarm_state is not None
    assert alarm_state.state == "ringing", (
        f"Expected ringing at exact time, got '{alarm_state.state}'"
    )
    assert hass.states.get("binary_sensor.aurora_ringing").state == "on"


async def test_smart_wake_off_never_enters_pre_wake(
    hass: HomeAssistant, freezer
) -> None:
    """An alarm with smart_window disabled never transitions through pre_wake.

    Even with stirring signals bound, the state should jump from idle directly
    to ringing at the scheduled time.
    """
    freezer.move_to("2026-06-17 06:40:00+00:00")
    await _setup(hass)
    _set_signals(hass, stirring=True)

    # Add a plain alarm (no features override → smart_window.enabled = False by
    # default per SmartWindowFeature.enabled = False in models.py).
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:30", "label": "No Smart Wake"},
        blocking=True,
    )
    await hass.async_block_till_done()

    # Advance to what would be pre-wake start
    freezer.move_to("2026-06-17 07:00:05+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    # Must NOT be pre_wake
    assert hass.states.get("sensor.aurora_state").state != "pre_wake"

    # At exact time must ring
    freezer.move_to("2026-06-17 07:30:00+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "ringing"


async def test_no_signals_bound_skips_pre_wake(
    hass: HomeAssistant, freezer
) -> None:
    """smart_window enabled but no role signals bound → no pre_wake phase.

    _resolve_signals returns an empty list when neither per-alarm signals nor
    global ROLE_SLEEP_SIGNAL / ROLE_PRESENCE_SIGNAL are configured; the
    coordinator skips _start_prewake entirely.
    """
    freezer.move_to("2026-06-17 06:40:00+00:00")
    # Set up WITHOUT any role bindings
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    await _add_smart_alarm(hass, "07:30")

    # Advance to pre-wake start time
    freezer.move_to("2026-06-17 07:00:05+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    # State must NOT be pre_wake (no signals → guard in _maybe_schedule_prewake)
    assert hass.states.get("sensor.aurora_state").state != "pre_wake"


async def test_dismiss_after_early_ring_returns_to_idle(
    hass: HomeAssistant, freezer
) -> None:
    """After an early smart-wake ring, dismissing returns to idle state.

    This confirms the state machine completes the ring cycle correctly even when
    the ring was triggered early by signal fusion rather than the exact timer.
    BriefingFeature.enabled defaults to False so dismiss goes directly to idle
    (no post_wake phase).
    """
    freezer.move_to("2026-06-17 06:40:00+00:00")
    await _setup(hass)
    _set_signals(hass, stirring=False)
    await _add_smart_alarm(hass, "07:30")

    # Enter pre-wake window
    freezer.move_to("2026-06-17 07:00:05+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    # Trigger stirring → drive 3 eval ticks to fill SleepFusion window
    _set_signals(hass, stirring=True)
    for minute_offset in (5, 10, 15):
        freezer.move_to(f"2026-06-17 07:{minute_offset:02d}:05+00:00")
        async_fire_time_changed(hass)
        await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "ringing"

    # Dismiss the early ring
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "idle"
    assert hass.states.get("binary_sensor.aurora_ringing").state == "off"


async def test_pre_wake_with_inline_signal_on_alarm(
    hass: HomeAssistant, freezer
) -> None:
    """Per-alarm signals (SmartWindowFeature.signals) override global roles.

    Pass the signal entity_id directly in the alarm's features.smart_window.signals
    list. Even with no global role bindings the coordinator must use the per-alarm
    list and ring early when stirring.
    """
    freezer.move_to("2026-06-17 06:40:00+00:00")
    # Set up WITHOUT any global role bindings
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # Prime the per-alarm signal entity to stirring
    hass.states.async_set(_SLEEP_ENTITY, "on")

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {
            "time": "07:30",
            "label": "Per-Alarm Signal",
            "features": {
                "smart_window": {
                    "enabled": True,
                    "minutes": DEFAULT_SMART_WINDOW_MIN,
                    "signals": [_SLEEP_ENTITY],
                },
            },
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    # Enter the pre-wake window
    freezer.move_to("2026-06-17 07:00:05+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "pre_wake"

    # Drive 3 evaluation ticks with stirring signal.
    # First sample at _start_prewake: signals already "on" → score 1.0.
    # All 3 samples = 1.0, avg = 1.0 >= 0.6 → ring fires at tick 3.
    for minute_offset in (5, 10, 15):
        freezer.move_to(f"2026-06-17 07:{minute_offset:02d}:05+00:00")
        async_fire_time_changed(hass)
        await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "ringing"
