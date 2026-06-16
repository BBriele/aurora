"""Unit tests for the pure sleep-aware fusion (no Home Assistant needed)."""

from custom_components.aurora.sleep import SleepFusion, fuse, interpret_signal


def test_interpret_binary_sensor() -> None:
    """Verify binary_sensor 'on'/'off' maps to 1.0/0.0 awake confidence."""
    assert interpret_signal("binary_sensor", "on", {}) == 1.0
    assert interpret_signal("binary_sensor", "off", {}) == 0.0


def test_interpret_unknown_is_none() -> None:
    """Verify unavailable/unknown states return None from interpret_signal."""
    assert interpret_signal("binary_sensor", "unavailable", {}) is None
    assert interpret_signal("sensor", "unknown", {}) is None


def test_interpret_sleep_phase_words() -> None:
    """Verify named sleep-phase words map to correct awake confidence values."""
    assert interpret_signal("sensor", "awake", {}) == 1.0
    assert interpret_signal("sensor", "deep_sleep", {}) == 0.0


def test_interpret_confidence_percent() -> None:
    """Verify percentage sleep-confidence values are inverted to awake confidence."""
    # high sleep-confidence => low awake-ness
    high = interpret_signal("sensor", "90", {"unit_of_measurement": "%"})
    low = interpret_signal("sensor", "10", {"unit_of_measurement": "%"})
    assert high is not None and round(high, 2) == 0.1
    assert low is not None and round(low, 2) == 0.9


def test_fuse_ignores_none() -> None:
    """Verify fuse() skips None values and returns None when all inputs are None."""
    assert fuse([1.0, None, 0.0]) == 0.5
    assert fuse([None, None]) is None


def test_fusion_needs_full_window_then_triggers() -> None:
    """Verify SleepFusion only triggers after the sliding window is fully populated."""
    f = SleepFusion(window=3, high=0.6, low=0.4)
    assert f.add(1.0) is False  # only 1 sample, window not full
    assert f.add(1.0) is False  # 2 samples
    assert f.add(1.0) is True  # 3 samples, avg 1.0 >= high -> ready


def test_fusion_single_spike_does_not_trigger() -> None:
    """Verify a single high spike among low values does not trigger the fusion."""
    f = SleepFusion(window=3, high=0.6, low=0.4)
    f.add(0.0)
    f.add(1.0)  # a spike
    assert f.add(0.0) is False  # avg ~0.33 < high


def test_fusion_hysteresis() -> None:
    """Verify SleepFusion hysteresis keeps state until average drops below low."""
    f = SleepFusion(window=2, high=0.6, low=0.4)
    f.add(0.7)
    assert f.add(0.7) is True  # window full, avg 0.7 -> ready
    assert f.add(0.5) is True  # avg (0.7+0.5)/2=0.6 >= low -> stays
    assert f.add(0.1) is False  # avg (0.5+0.1)/2=0.3 < low -> drops


def test_fusion_none_keeps_state() -> None:
    """Verify adding None to SleepFusion does not change the current ready state."""
    f = SleepFusion(window=2)
    f.add(0.9)
    f.add(0.9)  # ready
    assert f.add(None) is True


def test_interpret_non_numeric_word_state_is_none() -> None:
    """Verify an unrecognised non-numeric sensor state returns None."""
    # A non-binary domain whose state is neither a known phase word nor numeric.
    assert interpret_signal("sensor", "garbage", {}) is None


def test_interpret_numeric_out_of_range_is_none() -> None:
    """Verify numeric states outside 0-100 sleep-confidence range return None."""
    # A numeric reading outside the 0..100 sleep-confidence band is unusable.
    assert interpret_signal("sensor", "150", {}) is None
    assert interpret_signal("sensor", "-5", {}) is None


def test_fusion_ready_property_reflects_state() -> None:
    """Verify the ready property is False before the window fills and True after."""
    f = SleepFusion(window=2, high=0.6, low=0.4)
    assert f.ready is False
    f.add(0.9)
    f.add(0.9)  # window full, avg 0.9 -> ready
    assert f.ready is True
