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
    with pytest.raises(ValueError):
        AuroraAlarm.from_dict({"id": "x"})


def test_from_dict_requires_id() -> None:
    with pytest.raises(ValueError):
        AuroraAlarm.from_dict({"time": "07:00"})


def test_defaults_are_sane() -> None:
    alarm = AuroraAlarm(id="x", alarm_time=time(6, 0))
    assert alarm.enabled is True
    assert alarm.schedule.repeat_mode is RepeatMode.DAILY
    assert alarm.features.audio.enabled is True
    assert alarm.features.light.enabled is False
