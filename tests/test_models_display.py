"""Pure-logic tests for DisplayFeature (no homeassistant import → runs locally)."""

from custom_components.aurora.models import AlarmFeatures, DisplayFeature


def test_display_defaults():
    d = DisplayFeature()
    assert d.enabled is False
    assert d.targets == []


def test_display_roundtrip():
    d = DisplayFeature(enabled=True, targets=["media_player.smartclock"])
    assert DisplayFeature.from_dict(d.as_dict()) == d


def test_display_from_dict_guards_bad_targets():
    d = DisplayFeature.from_dict({"enabled": True, "targets": ["a", "", None, 7]})
    assert d.targets == ["a", "7"]  # falsy dropped, others coerced to str


def test_alarm_features_includes_display():
    feats = AlarmFeatures.from_dict({"display": {"enabled": True, "targets": ["x"]}})
    assert feats.display.enabled is True
    assert feats.display.targets == ["x"]
    assert "display" in feats.as_dict()
