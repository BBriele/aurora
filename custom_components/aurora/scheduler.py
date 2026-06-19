"""Pure scheduling math — no Home Assistant dependencies.

Kept free of ``homeassistant`` imports so the recurrence/next-occurrence logic
(the highest-stakes part of an alarm clock) can be unit-tested in isolation,
including DST edges. The coordinator wraps these with HA's timezone + UTC timer.
"""

from datetime import date, datetime, timedelta, tzinfo

from .models import AuroraAlarm, RepeatMode

# Never search further than this for the next matching day.
SEARCH_HORIZON_DAYS = 366


def day_matches(alarm: AuroraAlarm, day: date) -> bool:
    """Whether ``alarm`` should ring on ``day`` per its recurrence."""
    schedule = alarm.schedule
    if schedule.repeat_mode is RepeatMode.DAILY:
        return True
    if schedule.repeat_mode is RepeatMode.WEEKLY:
        return day.weekday() in schedule.weekdays
    # ONCE: a specific date if given, otherwise the next available day.
    if schedule.on_date is not None:
        return day == schedule.on_date
    return True


def next_occurrence(
    alarm: AuroraAlarm,
    now_local: datetime,
    tz: tzinfo,
    skip_dates: frozenset[date] | set[date] | None = None,
    respect_skip: bool = True,
) -> datetime | None:
    """Return the next local wall-clock datetime for ``alarm`` strictly after now.

    Honours ``skip_next`` and any ``skip_dates`` (holidays / busy days). The skip
    is *pinned* to ``alarm.skip_date`` when set, so recomputing never re-skips a
    different occurrence; if ``skip_next`` is set without a pinned date (not yet
    normalised), the first matching occurrence is skipped as a fallback. Pass
    ``respect_skip=False`` to ignore ``skip_next`` entirely (used to find the date
    to pin). The result is timezone-aware in ``tz``; the caller converts to UTC
    once. Returns None if no occurrence falls within the search horizon.
    """
    target = alarm.alarm_time
    # Unpinned skip falls back to "skip the first matching occurrence".
    fallback_skip = respect_skip and alarm.skip_next and alarm.skip_date is None
    start_day = now_local.date()

    for offset in range(SEARCH_HORIZON_DAYS):
        day = start_day + timedelta(days=offset)
        if not day_matches(alarm, day):
            continue
        candidate = datetime(
            day.year, day.month, day.day, target.hour, target.minute, tzinfo=tz
        )
        if candidate <= now_local:
            continue
        if skip_dates and day in skip_dates:
            continue
        if respect_skip and alarm.skip_next and alarm.skip_date == day:
            continue
        if fallback_skip:
            fallback_skip = False
            continue
        return candidate
    return None
