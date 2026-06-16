"""Pure sleep-aware signal fusion — no Home Assistant dependencies.

Combines noisy presence/sleep signals into a single "awake-ness" score with a
moving average + hysteresis, so a single jittery sample never triggers an early
wake. The exact alarm time always remains the guaranteed fallback (enforced by
the coordinator, not here).
"""

from dataclasses import dataclass, field
from typing import Any

_UNKNOWN_STATES = {"unknown", "unavailable", ""}
_AWAKE_WORDS = {"awake", "light", "light_sleep", "interactive", "not_sleeping"}
_ASLEEP_WORDS = {"deep", "deep_sleep", "rem", "asleep", "sleeping"}
_ON_WORDS = {"on", "true", "home", "detected", "open"}


def interpret_signal(
    domain: str, state: str | None, attributes: dict[str, Any]
) -> float | None:
    """Map one signal to an "awake-ness" score in [0, 1], or None if unusable.

    Capability-first heuristic: configure signals that read higher when you are
    awake/stirring (motion, presence, phone interactive, a low sleep-confidence
    %, an "awake"/"light" sleep phase). 1.0 = clearly awake, 0.0 = clearly asleep.
    """
    if state is None or str(state).strip().lower() in _UNKNOWN_STATES:
        return None
    s = str(state).strip().lower()
    if domain == "binary_sensor":
        return 1.0 if s in _ON_WORDS else 0.0
    if s in _AWAKE_WORDS:
        return 1.0
    if s in _ASLEEP_WORDS:
        return 0.0
    try:
        val = float(s)
    except ValueError:
        return None
    # Numeric sensor: treat a 0..100 value as a "sleep confidence" %, where high
    # confidence-of-sleep means low awake-ness.
    if 0.0 <= val <= 100.0:
        return max(0.0, min(1.0, 1.0 - val / 100.0))
    return None


def fuse(samples: list[float | None]) -> float | None:
    """Mean awake-ness of the current readings, ignoring unusable ones."""
    vals = [v for v in samples if v is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)


@dataclass
class SleepFusion:
    """Moving-average + hysteresis decision over successive fused scores."""

    window: int = 3
    high: float = 0.6  # average must reach this to declare "awake → wake now"
    low: float = 0.4  # hysteresis: must fall below this to un-declare
    _history: list[float] = field(default_factory=list)
    _ready: bool = False

    def add(self, score: float | None) -> bool:
        """Add the latest fused score; return True once it is time to wake.

        The decision only updates once a full ``window`` of samples is collected,
        so a single jittery reading never triggers (or cancels) an early wake.
        """
        if score is None:
            return self._ready
        self._history.append(score)
        if len(self._history) > self.window:
            self._history.pop(0)
        if len(self._history) < self.window:
            return self._ready
        avg = sum(self._history) / len(self._history)
        if not self._ready and avg >= self.high:
            self._ready = True
        elif self._ready and avg < self.low:
            self._ready = False
        return self._ready

    @property
    def ready(self) -> bool:
        """Whether the fusion currently says it is time to wake."""
        return self._ready
