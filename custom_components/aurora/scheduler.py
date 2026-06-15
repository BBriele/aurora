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
    alarm: AuroraAlarm, now_local: datetime, tz: tzinfo
) -> datetime | None:
    """Return the next local wall-clock datetime for ``alarm`` strictly after now.

    Honours ``skip_next`` (skips the first otherwise-matching occurrence). The
    returned datetime is timezone-aware in ``tz``; the caller converts to UTC
    once. Returns None if no occurrence falls within the search horizon.
    """
    target = alarm.alarm_time
    skip = alarm.skip_next
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
        if skip:
            skip = False
            continue
        return candidate
    return None
