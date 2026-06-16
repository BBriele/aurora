"""Unit tests for the pure sleep-aware fusion (no Home Assistant needed)."""

from custom_components.aurora.sleep import SleepFusion, fuse, interpret_signal


def test_interpret_binary_sensor() -> None:
    assert interpret_signal("binary_sensor", "on", {}) == 1.0
    assert interpret_signal("binary_sensor", "off", {}) == 0.0


def test_interpret_unknown_is_none() -> None:
    assert interpret_signal("binary_sensor", "unavailable", {}) is None
    assert interpret_signal("sensor", "unknown", {}) is None


def test_interpret_sleep_phase_words() -> None:
    assert interpret_signal("sensor", "awake", {}) == 1.0
    assert interpret_signal("sensor", "deep_sleep", {}) == 0.0


def test_interpret_confidence_percent() -> None:
    # high sleep-confidence => low awake-ness
    high = interpret_signal("sensor", "90", {"unit_of_measurement": "%"})
    low = interpret_signal("sensor", "10", {"unit_of_measurement": "%"})
    assert high is not None and round(high, 2) == 0.1
    assert low is not None and round(low, 2) == 0.9


def test_fuse_ignores_none() -> None:
    assert fuse([1.0, None, 0.0]) == 0.5
    assert fuse([None, None]) is None


def test_fusion_needs_full_window_then_triggers() -> None:
    f = SleepFusion(window=3, high=0.6, low=0.4)
    assert f.add(1.0) is False  # only 1 sample, window not full
    assert f.add(1.0) is False  # 2 samples
    assert f.add(1.0) is True  # 3 samples, avg 1.0 >= high -> ready


def test_fusion_single_spike_does_not_trigger() -> None:
    f = SleepFusion(window=3, high=0.6, low=0.4)
    f.add(0.0)
    f.add(1.0)  # a spike
    assert f.add(0.0) is False  # avg ~0.33 < high


def test_fusion_hysteresis() -> None:
    f = SleepFusion(window=2, high=0.6, low=0.4)
    f.add(0.7)
    assert f.add(0.7) is True  # window full, avg 0.7 -> ready
    assert f.add(0.5) is True  # avg (0.7+0.5)/2=0.6 >= low -> stays
    assert f.add(0.1) is False  # avg (0.5+0.1)/2=0.3 < low -> drops


def test_fusion_none_keeps_state() -> None:
    f = SleepFusion(window=2)
    f.add(0.9)
    f.add(0.9)  # ready
    assert f.add(None) is True
