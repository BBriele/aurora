"""Unit tests for the alarm model serialisation (no Home Assistant needed)."""

from datetime import time

import pytest

from custom_components.aurora.models import (
    AlarmSchedule,
    AuroraAlarm,
    MissionType,
    RepeatMode,
)


def test_round_trip_serialisation() -> None:
    """Verify AuroraAlarm serialises to dict and restores to an equal object."""
    alarm = AuroraAlarm(
        id="x",
        alarm_time=time(7, 30),
        label="Morning",
        owner="gabriel",
        schedule=AlarmSchedule(
            repeat_mode=RepeatMode.WEEKLY, weekdays=frozenset({0, 1, 2, 3, 4})
        ),
    )
    alarm.features.mission.type = MissionType.MATH
    restored = AuroraAlarm.from_dict(alarm.as_dict())
    assert restored == alarm


def test_from_dict_requires_time() -> None:
    """Verify from_dict raises ValueError when 'time' key is missing."""
    with pytest.raises(ValueError):
        AuroraAlarm.from_dict({"id": "x"})


def test_from_dict_requires_id() -> None:
    """Verify from_dict raises ValueError when 'id' key is missing."""
    with pytest.raises(ValueError):
        AuroraAlarm.from_dict({"time": "07:00"})


def test_once_with_on_date_round_trips() -> None:
    """Verify a ONCE alarm with on_date round-trips through serialisation correctly."""
    from datetime import date

    alarm = AuroraAlarm(
        id="once",
        alarm_time=time(6, 0),
        schedule=AlarmSchedule(
            repeat_mode=RepeatMode.ONCE, on_date=date(2026, 12, 25)
        ),
    )
    restored = AuroraAlarm.from_dict(alarm.as_dict())
    assert restored.schedule.on_date == date(2026, 12, 25)
    assert restored == alarm


def test_defaults_are_sane() -> None:
    """Verify AuroraAlarm default field values are sensible for a new alarm."""
    alarm = AuroraAlarm(id="x", alarm_time=time(6, 0))
    assert alarm.enabled is True
    assert alarm.schedule.repeat_mode is RepeatMode.DAILY
    assert alarm.features.audio.enabled is True
    assert alarm.features.light.enabled is False
