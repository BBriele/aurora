"""Pure wake-up briefing composer (no Home Assistant imports → unit-testable).

**English is the default/source language.** An Italian pack is bundled and any
other language falls back to English. The coordinator passes the active Home
Assistant language; users can fully override the spoken text with a per-alarm
template (rendered in the coordinator), so this module only formats the built-in
blocks from already-resolved facts.

Nothing is hardcoded to a single locale: phrasing lives in the per-language
``_PHRASES``/``_WEATHER`` tables below.
"""

from dataclasses import dataclass, field
from datetime import datetime

# Order used when an alarm specifies no explicit block list.
DEFAULT_BLOCKS: tuple[str, ...] = ("time", "weather", "calendar", "todo")

# Home Assistant's canonical weather conditions, phrased per language.
_WEATHER: dict[str, dict[str, str]] = {
    "en": {
        "clear-night": "clear sky",
        "cloudy": "cloudy",
        "fog": "fog",
        "hail": "hail",
        "lightning": "thunderstorms",
        "lightning-rainy": "thunderstorms with rain",
        "partlycloudy": "partly cloudy",
        "pouring": "heavy rain",
        "rainy": "rain",
        "snowy": "snow",
        "snowy-rainy": "sleet",
        "sunny": "sunny",
        "windy": "windy",
        "windy-variant": "windy",
        "exceptional": "exceptional conditions",
    },
    "it": {
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
    },
}

# Phrase packs. Only the TEMPLATE strings are interpolated (via str.format), so
# user data passed as arguments is inserted verbatim even if it contains braces.
_PHRASES: dict[str, dict[str, str]] = {
    "en": {
        "night": "Good night",
        "morning": "Good morning",
        "afternoon": "Good afternoon",
        "evening": "Good evening",
        "time": "{greet}{who}. It's {hh}:{mm}.",
        "weather": "Weather: {body}.",
        "no_events": "Nothing on your calendar today.",
        "events": "You have {n} {noun} today: {body}{more}.",
        "event_one": "event",
        "event_many": "events",
        "events_more": " and {k} more",
        "todo": "To do: {body}{more}.",
        "todo_more": " and {k} more",
    },
    "it": {
        "night": "Buonanotte",
        "morning": "Buongiorno",
        "afternoon": "Buon pomeriggio",
        "evening": "Buonasera",
        "time": "{greet}{who}. Sono le {hh}:{mm}.",
        "weather": "Meteo: {body}.",
        "no_events": "Nessun impegno in calendario oggi.",
        "events": "Hai {n} {noun} oggi: {body}{more}.",
        "event_one": "impegno",
        "event_many": "impegni",
        "events_more": " e altri {k}",
        "todo": "Da fare: {body}{more}.",
        "todo_more": " e altre {k}",
    },
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


def _norm_lang(language: str | None) -> str:
    """Resolve a language code to a supported pack (English fallback)."""
    if not language:
        return "en"
    lower = language.lower()
    if lower in _PHRASES:
        return lower
    base = lower.split("-")[0]
    return base if base in _PHRASES else "en"


def _greeting(hour: int, p: dict[str, str]) -> str:
    """Time-of-day greeting."""
    if hour < 5:
        return p["night"]
    if hour < 12:
        return p["morning"]
    if hour < 18:
        return p["afternoon"]
    return p["evening"]


def _block_time(ctx: BriefingContext, lang: str, p: dict[str, str]) -> str | None:
    """Greeting + current wall-clock time."""
    who = f" {ctx.name}" if ctx.name else ""
    return p["time"].format(
        greet=_greeting(ctx.now.hour, p),
        who=who,
        hh=f"{ctx.now.hour:02d}",
        mm=f"{ctx.now.minute:02d}",
    )


def _block_weather(ctx: BriefingContext, lang: str, p: dict[str, str]) -> str | None:
    """Current condition and temperature, if any."""
    w = ctx.weather
    if w is None or (w.condition is None and w.temperature is None):
        return None
    conditions = _WEATHER.get(lang, _WEATHER["en"])
    parts: list[str] = []
    if w.condition:
        parts.append(conditions.get(w.condition, w.condition.replace("-", " ")))
    if w.temperature is not None:
        parts.append(f"{round(w.temperature)}{w.unit}")
    return p["weather"].format(body=", ".join(parts))


def _block_calendar(ctx: BriefingContext, lang: str, p: dict[str, str]) -> str | None:
    """A count + the first few of today's events."""
    if not ctx.events:
        return p["no_events"]
    count = len(ctx.events)
    body = "; ".join(ctx.events[:3])
    more = p["events_more"].format(k=count - 3) if count > 3 else ""
    noun = p["event_one"] if count == 1 else p["event_many"]
    return p["events"].format(n=count, noun=noun, body=body, more=more)


def _block_todo(ctx: BriefingContext, lang: str, p: dict[str, str]) -> str | None:
    """The first few open to-do items, if any."""
    if not ctx.todos:
        return None
    count = len(ctx.todos)
    body = "; ".join(ctx.todos[:3])
    more = p["todo_more"].format(k=count - 3) if count > 3 else ""
    return p["todo"].format(body=body, more=more)


_BLOCKS = {
    "time": _block_time,
    "weather": _block_weather,
    "calendar": _block_calendar,
    "todo": _block_todo,
}


def compose_briefing(
    ctx: BriefingContext,
    blocks: list[str] | None = None,
    language: str | None = None,
) -> str:
    """Render the selected blocks into one spoken paragraph.

    English is the default; ``language`` selects a bundled pack (currently en/it)
    and falls back to English. Unknown blocks and blocks with no data are skipped;
    returns an empty string if nothing could be said.
    """
    lang = _norm_lang(language)
    phrases = _PHRASES[lang]
    chosen = blocks if blocks else list(DEFAULT_BLOCKS)
    out: list[str] = []
    for key in chosen:
        fn = _BLOCKS.get(key)
        if fn is None:
            continue
        text = fn(ctx, lang, phrases)
        if text:
            out.append(text)
    return " ".join(out)
