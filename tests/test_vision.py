"""Unit tests for the pure AI-vision helpers (no Home Assistant needed)."""

from custom_components.aurora.vision import (
    CircuitBreaker,
    LatencyWindow,
    parse_verdict,
)


def test_parse_verdict_affirmative() -> None:
    """Verify parse_verdict returns True for affirmative AI responses."""
    assert parse_verdict("YES") is True
    assert parse_verdict("Yes, the person is awake and out of bed.") is True
    assert parse_verdict("The person is clearly awake.") is True
    assert parse_verdict("Sì, è sveglio") is True


def test_parse_verdict_negative_or_vague() -> None:
    """Verify parse_verdict returns False for negative, vague, or empty responses."""
    assert parse_verdict("NO") is False
    assert parse_verdict("No, they appear asleep.") is False
    assert parse_verdict("The eyes are closed.") is False
    assert parse_verdict("") is False
    assert parse_verdict("I'm not sure") is False  # "not" → negative


def test_circuit_breaker_trips_and_recovers() -> None:
    """Verify CircuitBreaker opens after threshold failures and recovers after wait."""
    cb = CircuitBreaker(threshold=3, recovery_s=60)
    assert cb.allow(0) is True
    cb.record(False, 0)
    cb.record(False, 1)
    assert cb.is_open is False
    cb.record(False, 2)  # 3rd failure trips it
    assert cb.is_open is True
    assert cb.allow(2) is False  # open
    assert cb.allow(61) is False  # still within recovery (opened at 2 + 60 = 62)
    assert cb.allow(62) is True  # recovery elapsed


def test_circuit_breaker_success_resets() -> None:
    """Verify a successful record resets the CircuitBreaker failure counter."""
    cb = CircuitBreaker(threshold=2, recovery_s=30)
    cb.record(False, 0)
    cb.record(True, 1)  # success resets the counter
    cb.record(False, 2)
    assert cb.is_open is False  # only 1 failure since reset


def test_latency_window_average_and_cap() -> None:
    """Verify LatencyWindow tracks a rolling average and evicts oldest entries."""
    w = LatencyWindow(size=3)
    assert w.average() is None
    w.add(100)
    w.add(200)
    assert w.average() == 150
    assert w.count() == 2
    w.add(300)
    w.add(600)  # evicts the 100
    assert w.count() == 3
    assert w.average() == round((200 + 300 + 600) / 3)
