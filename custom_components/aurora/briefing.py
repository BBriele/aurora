"""Pure wake-up briefing composer (no Home Assistant imports → unit-testable).

The coordinator gathers the raw facts (current time, weather, today's calendar
events, open to-dos) from whatever entities are bound, then hands them here as a
plain :class:`BriefingContext`. This module only *formats* those facts into a
short spoken paragraph, so it can be tested without a running Home Assistant.

Everything degrades: a block with no data is simply dropped, and a briefing with
no usable blocks composes to an empty string (the caller then skips speaking).
"""

from dataclasses import dataclass, field
from datetime import datetime

# Order used when an alarm specifies no explicit block list.
DEFAULT_BLOCKS: tuple[str, ...] = ("time", "weather", "calendar", "todo")

# Italian phrasing for Home Assistant's canonical weather conditions.
_WEATHER_IT: dict[str, str] = {
    "clear-night": "cielo sereno",
    "cloudy": "nuvoloso",
    "fog": "nebbia",
    "hail": "grandine",
    "lightning": "temporali",
    "lightning-rainy": "temporali con pioggia",
    "partlycloudy": "parzialmente nuvoloso",
    "pouring": "pioggia intensa",
    "rainy": "pioggia",
    "snowy": "neve",
    "snowy-rainy": "nevischio",
    "sunny": "soleggiato",
    "windy": "ventoso",
    "windy-variant": "ventoso",
    "exceptional": "condizioni eccezionali",
}


@dataclass(slots=True)
class WeatherFact:
    """Resolved weather snapshot for the briefing."""

    condition: str | None = None
    temperature: float | None = None
    unit: str = "°"


@dataclass(slots=True)
class BriefingContext:
    """Everything the composer needs, already resolved from entities."""

    now: datetime
    name: str = ""
    weather: WeatherFact | None = None
    events: list[str] = field(default_factory=list)
    todos: list[str] = field(default_factory=list)


def _greeting(hour: int) -> str:
    """Time-of-day greeting (Italian)."""
    if hour < 5:
        return "Buonanotte"
    if hour < 12:
        return "Buongiorno"
    if hour < 18:
        return "Buon pomeriggio"
    return "Buonasera"


def _block_time(ctx: BriefingContext) -> str | None:
    """Greeting + current wall-clock time."""
    who = f" {ctx.name}" if ctx.name else ""
    return f"{_greeting(ctx.now.hour)}{who}. Sono le {ctx.now.hour:02d}:{ctx.now.minute:02d}."


def _block_weather(ctx: BriefingContext) -> str | None:
    """Current condition and temperature, if any."""
    w = ctx.weather
    if w is None or (w.condition is None and w.temperature is None):
        return None
    parts: list[str] = []
    if w.condition:
        parts.append(_WEATHER_IT.get(w.condition, w.condition.replace("-", " ")))
    if w.temperature is not None:
        parts.append(f"{round(w.temperature)}{w.unit}")
    return "Meteo: " + ", ".join(parts) + "."


def _block_calendar(ctx: BriefingContext) -> str | None:
    """A count + the first few of today's events."""
    if not ctx.events:
        return "Nessun impegno in calendario oggi."
    count = len(ctx.events)
    head = "; ".join(ctx.events[:3])
    more = f" e altri {count - 3}" if count > 3 else ""
    noun = "impegno" if count == 1 else "impegni"
    return f"Hai {count} {noun} oggi: {head}{more}."


def _block_todo(ctx: BriefingContext) -> str | None:
    """The first few open to-do items, if any."""
    if not ctx.todos:
        return None
    count = len(ctx.todos)
    head = "; ".join(ctx.todos[:3])
    more = f" e altre {count - 3}" if count > 3 else ""
    return f"Da fare: {head}{more}."


_BLOCKS = {
    "time": _block_time,
    "weather": _block_weather,
    "calendar": _block_calendar,
    "todo": _block_todo,
}


def compose_briefing(
    ctx: BriefingContext, blocks: list[str] | None = None
) -> str:
    """Render the selected blocks into one spoken paragraph.

    Unknown block keys and blocks with no data are skipped. Returns an empty
    string if nothing could be said (the caller should then not speak).
    """
    chosen = blocks if blocks else list(DEFAULT_BLOCKS)
    out: list[str] = []
    for key in chosen:
        fn = _BLOCKS.get(key)
        if fn is None:
            continue
        text = fn(ctx)
        if text:
            out.append(text)
    return " ".join(out)
