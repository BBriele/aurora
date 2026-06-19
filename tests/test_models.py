"""Unit tests for the alarm model serialisation (no Home Assistant needed)."""

from datetime import time

import pytest

from custom_components.aurora.models import (
    AlarmSchedule,
    AuroraAlarm,
    MissionType,
    RepeatMode,
    SmartWindowFeature,
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


def test_smart_window_sensitivity_round_trip_and_clamp() -> None:
    """Sensitivity round-trips and is clamped into [0, 1] on load."""
    sw = SmartWindowFeature(enabled=True, minutes=20, sensitivity=0.85)
    assert SmartWindowFeature.from_dict(sw.as_dict()) == sw
    # Out-of-range values are clamped; a missing key defaults to 0.5.
    assert SmartWindowFeature.from_dict({"sensitivity": 5}).sensitivity == 1.0
    assert SmartWindowFeature.from_dict({"sensitivity": -3}).sensitivity == 0.0
    assert SmartWindowFeature.from_dict({}).sensitivity == 0.5


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
