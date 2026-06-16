"""Pure helpers for the AI-vision (selfie) anti-snooze mission.

No Home Assistant imports → unit-testable. The HA-coupled engine (provider
calls, file IO, timeouts) lives in the coordinator and uses these primitives:
a circuit breaker, a rolling latency window, and a verdict parser. Times are
passed in so everything here is deterministic.
"""

from collections import deque

# Default instruction sent to the vision model. Phrased to force a leading word
# we can parse, and to ask for the "awake + out of bed" signal.
DEFAULT_VISION_PROMPT = (
    "Look at this selfie. Answer with only YES or NO: is the person clearly "
    "awake, eyes open, and out of bed?"
)


def parse_verdict(text: str) -> bool:
    """Interpret a model's free-text answer as awake (True) / not awake (False).

    Conservative: only an explicit affirmative counts as awake, so a vague or
    empty answer keeps the alarm ringing.
    """
    head = (text or "").strip().lower()[:40]
    if not head:
        return False
    negatives = ("no", "not ", "asleep", "sleep", "closed", "non ", "addorment")
    if any(head.startswith(n) or f" {n}" in head for n in negatives):
        return False
    positives = ("yes", "awake", "up ", "eyes open", "true", "si", "sì", "sveglio")
    return any(p in head for p in positives)


class CircuitBreaker:
    """Open after ``threshold`` consecutive failures; stay open for ``recovery_s``."""

    def __init__(self, threshold: int, recovery_s: float) -> None:
        """Configure the failure threshold and recovery window (seconds)."""
        self.threshold = threshold
        self.recovery_s = recovery_s
        self._failures = 0
        self._open_until = 0.0

    def allow(self, now: float) -> bool:
        """Whether a call is allowed at ``now`` (monotonic seconds)."""
        return now >= self._open_until

    def record(self, ok: bool, now: float) -> None:
        """Record a call outcome, tripping/resetting the breaker."""
        if ok:
            self._failures = 0
            self._open_until = 0.0
        else:
            self._failures += 1
            if self._failures >= self.threshold:
                self._open_until = now + self.recovery_s

    @property
    def is_open(self) -> bool:
        """True if the breaker has tripped (independent of the recovery clock)."""
        return self._failures >= self.threshold


class LatencyWindow:
    """Rolling window of recent latencies (ms) with a simple average."""

    def __init__(self, size: int) -> None:
        """Keep at most ``size`` recent samples."""
        self._values: deque[float] = deque(maxlen=size)

    def add(self, ms: float) -> None:
        """Record a latency sample in milliseconds."""
        self._values.append(ms)

    def average(self) -> float | None:
        """Mean latency in ms, or None if no samples yet."""
        if not self._values:
            return None
        return round(sum(self._values) / len(self._values))

    def count(self) -> int:
        """Number of samples currently in the window."""
        return len(self._values)
