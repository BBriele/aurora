"""Unit tests for the pure scheduling logic (no Home Assistant needed)."""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from custom_components.aurora.models import AlarmSchedule, AuroraAlarm, RepeatMode
from custom_components.aurora.scheduler import next_occurrence

TZ = ZoneInfo("Europe/Rome")


def _alarm(t: str, **schedule_kwargs) -> AuroraAlarm:
    return AuroraAlarm(
        id="a",
        alarm_time=time.fromisoformat(t),
        schedule=AlarmSchedule(**schedule_kwargs),
    )


def test_daily_later_today() -> None:
    """Verify a daily alarm fires later today when the alarm time has not passed."""
    now = datetime(2026, 6, 15, 6, 0, tzinfo=TZ)
    nxt = next_occurrence(_alarm("07:00", repeat_mode=RepeatMode.DAILY), now, TZ)
    assert nxt == datetime(2026, 6, 15, 7, 0, tzinfo=TZ)


def test_daily_rolls_to_tomorrow() -> None:
    """Verify a daily alarm rolls to the next day when today's time has passed."""
    now = datetime(2026, 6, 15, 8, 0, tzinfo=TZ)
    nxt = next_occurrence(_alarm("07:00", repeat_mode=RepeatMode.DAILY), now, TZ)
    assert nxt == datetime(2026, 6, 16, 7, 0, tzinfo=TZ)


def test_weekly_picks_next_matching_weekday() -> None:
    """Verify a weekly alarm resolves to the next configured weekday after now."""
    now = datetime(2026, 6, 15, 8, 0, tzinfo=TZ)  # a Monday
    alarm = _alarm("07:00", repeat_mode=RepeatMode.WEEKLY, weekdays=frozenset({2}))
    nxt = next_occurrence(alarm, now, TZ)
    assert nxt is not None
    assert nxt.weekday() == 2  # Wednesday
    assert nxt.time() == time(7, 0)
    assert nxt > now


def test_skip_next_skips_first_occurrence() -> None:
    """Verify skip_next=True advances the alarm by one full repeat cycle."""
    now = datetime(2026, 6, 15, 6, 0, tzinfo=TZ)
    alarm = AuroraAlarm(
        id="a",
        alarm_time=time(7, 0),
        skip_next=True,
        schedule=AlarmSchedule(repeat_mode=RepeatMode.DAILY),
    )
    nxt = next_occurrence(alarm, now, TZ)
    assert nxt == datetime(2026, 6, 16, 7, 0, tzinfo=TZ)


def test_pinned_skip_date_is_stable_across_recompute() -> None:
    """A pinned skip_date skips exactly that day, even if 'now' moves past it.

    This is the fix for the boolean-skip drift: re-arming after the skipped
    occurrence has passed must NOT skip the following occurrence too.
    """
    alarm = AuroraAlarm(
        id="a",
        alarm_time=time(7, 0),
        skip_next=True,
        skip_date=date(2026, 6, 15),
        schedule=AlarmSchedule(repeat_mode=RepeatMode.DAILY),
    )
    expected = datetime(2026, 6, 16, 7, 0, tzinfo=TZ)
    # Before the skipped day: 15th is skipped → 16th.
    before = next_occurrence(alarm, datetime(2026, 6, 15, 6, 0, tzinfo=TZ), TZ)
    # After the skipped day has passed: the 16th must NOT be skipped.
    after = next_occurrence(alarm, datetime(2026, 6, 15, 8, 0, tzinfo=TZ), TZ)
    assert before == expected
    assert after == expected


def test_respect_skip_false_ignores_skip() -> None:
    """respect_skip=False finds the occurrence to pin, ignoring skip entirely."""
    alarm = AuroraAlarm(
        id="a",
        alarm_time=time(7, 0),
        skip_next=True,
        schedule=AlarmSchedule(repeat_mode=RepeatMode.DAILY),
    )
    now = datetime(2026, 6, 15, 6, 0, tzinfo=TZ)
    assert next_occurrence(alarm, now, TZ, respect_skip=False) == datetime(
        2026, 6, 15, 7, 0, tzinfo=TZ
    )


def test_once_on_specific_date() -> None:
    """Verify a ONCE alarm with an explicit on_date fires on that exact date."""
    now = datetime(2026, 6, 15, 6, 0, tzinfo=TZ)
    alarm = _alarm(
        "07:00", repeat_mode=RepeatMode.ONCE, on_date=date(2026, 6, 20)
    )
    nxt = next_occurrence(alarm, now, TZ)
    assert nxt == datetime(2026, 6, 20, 7, 0, tzinfo=TZ)


def test_skip_dates_are_skipped() -> None:
    """Verify that dates in skip_dates are excluded and the next valid date is used."""
    now = datetime(2026, 6, 15, 6, 0, tzinfo=TZ)
    alarm = _alarm("07:00", repeat_mode=RepeatMode.DAILY)
    # skip today -> next is tomorrow
    nxt = next_occurrence(alarm, now, TZ, skip_dates={date(2026, 6, 15)})
    assert nxt == datetime(2026, 6, 16, 7, 0, tzinfo=TZ)


def test_once_without_date_takes_next_available_day() -> None:
    """Verify a ONCE alarm without on_date rings on the next available day."""
    # ONCE with no explicit on_date should ring at the next available day.
    now = datetime(2026, 6, 15, 8, 0, tzinfo=TZ)
    nxt = next_occurrence(_alarm("07:00", repeat_mode=RepeatMode.ONCE), now, TZ)
    assert nxt == datetime(2026, 6, 16, 7, 0, tzinfo=TZ)


def test_no_matching_day_returns_none() -> None:
    """Verify a weekly alarm with no weekdays configured returns None."""
    # A weekly alarm with no weekdays selected never matches -> None.
    now = datetime(2026, 6, 15, 6, 0, tzinfo=TZ)
    alarm = _alarm("07:00", repeat_mode=RepeatMode.WEEKLY, weekdays=frozenset())
    assert next_occurrence(alarm, now, TZ) is None


def test_dst_spring_forward_does_not_lose_alarm() -> None:
    """Verify an alarm at 07:00 resolves correctly across a DST spring-forward."""
    # Europe/Rome springs forward 2026-03-29 (02:00 -> 03:00). 07:00 is unaffected
    # and must still resolve to a valid instant.
    now = datetime(2026, 3, 28, 23, 0, tzinfo=TZ)
    nxt = next_occurrence(_alarm("07:00", repeat_mode=RepeatMode.DAILY), now, TZ)
    assert nxt == datetime(2026, 3, 29, 7, 0, tzinfo=TZ)
