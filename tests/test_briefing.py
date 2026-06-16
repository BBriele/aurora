"""Unit tests for the pure wake-up briefing composer (no Home Assistant needed).

English is the default language; an Italian pack is bundled and selectable.
"""

from datetime import datetime

from custom_components.aurora.briefing import (
    BriefingContext,
    WeatherFact,
    compose_briefing,
)


def _ctx(**kwargs) -> BriefingContext:
    base = {"now": datetime(2026, 6, 16, 7, 5)}
    base.update(kwargs)
    return BriefingContext(**base)


def test_time_block_greeting_and_clock() -> None:
    text = compose_briefing(_ctx(name="Gabriel"), blocks=["time"])
    assert "Good morning Gabriel" in text
    assert "07:05" in text


def test_greeting_varies_by_hour() -> None:
    assert "Good night" in compose_briefing(
        _ctx(now=datetime(2026, 6, 16, 3, 0)), blocks=["time"]
    )
    assert "Good afternoon" in compose_briefing(
        _ctx(now=datetime(2026, 6, 16, 15, 0)), blocks=["time"]
    )
    assert "Good evening" in compose_briefing(
        _ctx(now=datetime(2026, 6, 16, 20, 0)), blocks=["time"]
    )


def test_weather_block_translates_and_rounds() -> None:
    ctx = _ctx(weather=WeatherFact(condition="rainy", temperature=18.6, unit="°C"))
    text = compose_briefing(ctx, blocks=["weather"])
    assert "rain" in text
    assert "19°C" in text  # rounded


def test_weather_block_dropped_when_empty() -> None:
    assert compose_briefing(_ctx(weather=WeatherFact()), blocks=["weather"]) == ""
    assert compose_briefing(_ctx(), blocks=["weather"]) == ""


def test_calendar_block_counts_and_truncates() -> None:
    ctx = _ctx(events=["Meeting", "Dentist", "Gym", "Dinner"])
    text = compose_briefing(ctx, blocks=["calendar"])
    assert "You have 4 events today" in text
    assert "Meeting" in text and "Gym" in text
    assert "Dinner" not in text  # only first 3 are spoken
    assert "and 1 more" in text


def test_calendar_block_singular_and_empty() -> None:
    assert "1 event today" in compose_briefing(_ctx(events=["Only one"]), blocks=["calendar"])
    assert "Nothing on your calendar" in compose_briefing(_ctx(), blocks=["calendar"])


def test_todo_block_dropped_when_empty() -> None:
    assert compose_briefing(_ctx(), blocks=["todo"]) == ""
    assert "To do: Milk" in compose_briefing(_ctx(todos=["Milk"]), blocks=["todo"])


def test_default_blocks_when_none() -> None:
    ctx = _ctx(
        name="Aurora",
        weather=WeatherFact(condition="sunny", temperature=25, unit="°C"),
        events=["Standup"],
        todos=["Groceries"],
    )
    text = compose_briefing(ctx)
    # All four default blocks should appear, in order.
    assert text.index("Good morning") < text.index("Weather")
    assert text.index("Weather") < text.index("Standup")
    assert text.index("Standup") < text.index("To do")


def test_unknown_block_skipped() -> None:
    assert compose_briefing(_ctx(), blocks=["bogus"]) == ""


def test_italian_pack_selected_by_language() -> None:
    ctx = _ctx(
        name="Gabriel",
        weather=WeatherFact(condition="rainy", temperature=18, unit="°C"),
        events=["Riunione"],
    )
    text = compose_briefing(ctx, language="it")
    assert "Buongiorno Gabriel" in text
    assert "Meteo: pioggia" in text
    assert "Hai 1 impegno oggi" in text


def test_unknown_language_falls_back_to_english() -> None:
    text = compose_briefing(_ctx(name="X"), blocks=["time"], language="de")
    assert "Good morning X" in text


def test_base_language_match() -> None:
    # "it-IT" should resolve to the Italian pack.
    text = compose_briefing(_ctx(), blocks=["calendar"], language="it-IT")
    assert "Nessun impegno" in text
