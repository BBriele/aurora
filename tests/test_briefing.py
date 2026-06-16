"""Unit tests for the pure wake-up briefing composer (no Home Assistant needed)."""

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
    assert "Buongiorno Gabriel" in text
    assert "07:05" in text


def test_greeting_varies_by_hour() -> None:
    assert "Buonanotte" in compose_briefing(
        _ctx(now=datetime(2026, 6, 16, 3, 0)), blocks=["time"]
    )
    assert "Buon pomeriggio" in compose_briefing(
        _ctx(now=datetime(2026, 6, 16, 15, 0)), blocks=["time"]
    )
    assert "Buonasera" in compose_briefing(
        _ctx(now=datetime(2026, 6, 16, 20, 0)), blocks=["time"]
    )


def test_weather_block_translates_and_rounds() -> None:
    ctx = _ctx(weather=WeatherFact(condition="rainy", temperature=18.6, unit="°C"))
    text = compose_briefing(ctx, blocks=["weather"])
    assert "pioggia" in text
    assert "19°C" in text  # rounded


def test_weather_block_dropped_when_empty() -> None:
    assert compose_briefing(_ctx(weather=WeatherFact()), blocks=["weather"]) == ""
    assert compose_briefing(_ctx(), blocks=["weather"]) == ""


def test_calendar_block_counts_and_truncates() -> None:
    ctx = _ctx(events=["Riunione", "Dentista", "Palestra", "Cena"])
    text = compose_briefing(ctx, blocks=["calendar"])
    assert "Hai 4 impegni" in text
    assert "Riunione" in text and "Palestra" in text
    assert "Cena" not in text  # only first 3 are spoken
    assert "e altri 1" in text


def test_calendar_block_singular_and_empty() -> None:
    assert "1 impegno oggi" in compose_briefing(_ctx(events=["Solo uno"]), blocks=["calendar"])
    assert "Nessun impegno" in compose_briefing(_ctx(), blocks=["calendar"])


def test_todo_block_dropped_when_empty() -> None:
    assert compose_briefing(_ctx(), blocks=["todo"]) == ""
    assert "Da fare: Latte" in compose_briefing(_ctx(todos=["Latte"]), blocks=["todo"])


def test_default_blocks_when_none() -> None:
    ctx = _ctx(
        name="Aurora",
        weather=WeatherFact(condition="sunny", temperature=25, unit="°C"),
        events=["Standup"],
        todos=["Spesa"],
    )
    text = compose_briefing(ctx)
    # All four default blocks should appear, in order.
    assert text.index("Buongiorno") < text.index("Meteo")
    assert text.index("Meteo") < text.index("Standup")
    assert text.index("Standup") < text.index("Da fare")


def test_unknown_block_skipped() -> None:
    assert compose_briefing(_ctx(), blocks=["bogus"]) == ""
