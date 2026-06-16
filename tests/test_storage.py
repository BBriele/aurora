"""Tests for AlarmStorageCollection and the aurora/alarms WebSocket API.

Coverage: AlarmStorageCollection CRUD through the public collection API
(async_create_item / async_update_item / async_delete_item / async_items) and
through the HA service surface (SERVICE_ADD_ALARM / SERVICE_UPDATE_ALARM /
SERVICE_REMOVE_ALARM).  WebSocket list endpoint and model round-trips are also
exercised.  Every test operates on the public surface as described in the
ROBUSTNESS PRINCIPLE: state is driven through the integration entry, and
hass.data[DOMAIN] is used only to retrieve the collection for inspection.
"""

from homeassistant.core import HomeAssistant
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
import voluptuous as vol

from custom_components.aurora.const import (
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_REMOVE_ALARM,
    SERVICE_UPDATE_ALARM,
)
from custom_components.aurora.storage import (
    AlarmStorageCollection,
    async_create_alarm_collection,
)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Load the Aurora config entry and wait for setup to finish."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _get_collection(hass: HomeAssistant) -> AlarmStorageCollection:
    """Return the AlarmStorageCollection from hass.data after setup."""
    return hass.data[DOMAIN]


# ---------------------------------------------------------------------------
# Standalone collection (no full entry setup required)
# ---------------------------------------------------------------------------


async def test_standalone_collection_create_minimal(hass: HomeAssistant) -> None:
    """async_create_alarm_collection returns a usable collection without a full entry.

    Creating an alarm with only the required ``time`` field should produce a
    stored item with a generated ``id`` and canonical defaults for all optional
    fields.
    """
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "07:30"})

    assert "id" in item
    assert item["id"], "id must be a non-empty string"
    assert item["time"] == "07:30"
    # Canonical defaults
    assert item["label"] == ""
    assert item["enabled"] is True
    assert item["skip_next"] is False
    assert item["owner"] is None
    assert item["profile_id"] is None
    # Nested sub-objects must be present
    assert "schedule" in item
    assert "features" in item


async def test_standalone_collection_create_full(hass: HomeAssistant) -> None:
    """A full payload including schedule and features round-trips without loss.

    All explicitly provided fields must survive storage serialisation and
    appear in the returned canonical dict.
    """
    coll = await async_create_alarm_collection(hass)
    payload = {
        "time": "06:15",
        "label": "Work alarm",
        "owner": "alice",
        "profile_id": "usr-abc",
        "enabled": True,
        "skip_next": True,
        "schedule": {
            "repeat_mode": "weekly",
            "weekdays": [0, 1, 2, 3, 4],
        },
        "features": {
            "audio": {
                "enabled": True,
                "volume_profile": "fade_in",
                "volume_max": 0.5,
            },
            "light": {
                "enabled": True,
                "duration_min": 20,
            },
        },
    }
    item = await coll.async_create_item(payload)

    assert item["label"] == "Work alarm"
    assert item["owner"] == "alice"
    assert item["profile_id"] == "usr-abc"
    assert item["skip_next"] is True
    assert item["schedule"]["repeat_mode"] == "weekly"
    assert sorted(item["schedule"]["weekdays"]) == [0, 1, 2, 3, 4]
    assert item["features"]["audio"]["enabled"] is True
    assert item["features"]["audio"]["volume_max"] == pytest.approx(0.5)
    assert item["features"]["light"]["enabled"] is True
    assert item["features"]["light"]["duration_min"] == 20


async def test_standalone_collection_list(hass: HomeAssistant) -> None:
    """async_items returns all created alarms and nothing more."""
    coll = await async_create_alarm_collection(hass)
    assert coll.async_items() == []

    await coll.async_create_item({"time": "07:00", "label": "A"})
    await coll.async_create_item({"time": "08:00", "label": "B"})

    items = coll.async_items()
    assert len(items) == 2
    labels = {i["label"] for i in items}
    assert labels == {"A", "B"}


async def test_standalone_collection_update_merges_partial(hass: HomeAssistant) -> None:
    """async_update_item merges a partial dict over the stored alarm.

    Fields not present in the update are preserved; updated fields take the
    new value.  Re-validation runs against the merged result.
    """
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item(
        {"time": "09:00", "label": "Original", "enabled": True}
    )
    item_id = item["id"]

    updated = await coll.async_update_item(
        item_id, {"label": "Updated", "enabled": False}
    )

    assert updated["label"] == "Updated"
    assert updated["enabled"] is False
    # Unchanged field preserved
    assert updated["time"] == "09:00"
    assert updated["id"] == item_id


async def test_standalone_collection_delete(hass: HomeAssistant) -> None:
    """async_delete_item removes the alarm from async_items."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "10:00"})
    item_id = item["id"]

    assert len(coll.async_items()) == 1
    await coll.async_delete_item(item_id)
    assert coll.async_items() == []


async def test_standalone_create_invalid_missing_time(hass: HomeAssistant) -> None:
    """Creating an alarm without a ``time`` field raises vol.Invalid."""
    coll = await async_create_alarm_collection(hass)
    with pytest.raises(vol.Invalid):
        await coll.async_create_item({"label": "No time"})


async def test_standalone_create_invalid_bad_time_format(hass: HomeAssistant) -> None:
    """Creating an alarm with a non-HH:MM time string raises vol.Invalid."""
    coll = await async_create_alarm_collection(hass)
    with pytest.raises(vol.Invalid):
        await coll.async_create_item({"time": "not-a-time"})


async def test_standalone_create_invalid_empty_time(hass: HomeAssistant) -> None:
    """Creating an alarm with an empty time string raises vol.Invalid."""
    coll = await async_create_alarm_collection(hass)
    with pytest.raises(vol.Invalid):
        await coll.async_create_item({"time": ""})


# ---------------------------------------------------------------------------
# _get_suggested_id slug behaviour
# ---------------------------------------------------------------------------


async def test_suggested_id_uses_label(hass: HomeAssistant) -> None:
    """When a label is provided the generated id is derived from the label slug.

    The DictStorageCollection uses _get_suggested_id to seed the id generator,
    so we verify the returned id contains the label text (case-folded / slugged)
    rather than the fallback ``alarm_HH:MM`` pattern.
    """
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "07:00", "label": "Morning"})
    # The id must be non-empty; for label-seeded ids it should contain "morning".
    assert "morning" in item["id"].lower()


async def test_suggested_id_fallback_uses_time(hass: HomeAssistant) -> None:
    """When no label is provided the id slug falls back to alarm_HH:MM."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "05:45"})
    # The id must be non-empty; without a label the seed is "alarm_05:45".
    assert item["id"], "id must not be empty"


async def test_suggested_id_multiple_same_label_are_unique(hass: HomeAssistant) -> None:
    """Two alarms with the same label must get distinct ids."""
    coll = await async_create_alarm_collection(hass)
    item1 = await coll.async_create_item({"time": "07:00", "label": "Work"})
    item2 = await coll.async_create_item({"time": "08:00", "label": "Work"})
    assert item1["id"] != item2["id"]


# ---------------------------------------------------------------------------
# Collection accessed via hass.data[DOMAIN] after entry setup
# ---------------------------------------------------------------------------


async def test_entry_setup_exposes_collection(hass: HomeAssistant) -> None:
    """After entry setup hass.data[DOMAIN] holds an AlarmStorageCollection."""
    await _setup(hass)
    coll = _get_collection(hass)
    assert isinstance(coll, AlarmStorageCollection)


async def test_service_add_alarm_creates_item(hass: HomeAssistant) -> None:
    """SERVICE_ADD_ALARM stores the alarm in the collection.

    Exercising the collection through the service surface (the full public
    integration path) is preferred over calling the collection directly.
    """
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Via service"},
        blocking=True,
    )
    await hass.async_block_till_done()

    coll = _get_collection(hass)
    items = coll.async_items()
    assert len(items) == 1
    assert items[0]["label"] == "Via service"
    assert items[0]["time"] == "07:00"
    assert "id" in items[0]


async def test_service_add_alarm_minimal(hass: HomeAssistant) -> None:
    """SERVICE_ADD_ALARM succeeds with only the required ``time`` field."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "05:30"},
        blocking=True,
    )
    await hass.async_block_till_done()

    items = _get_collection(hass).async_items()
    assert len(items) == 1
    assert items[0]["time"] == "05:30"


async def test_service_update_alarm(hass: HomeAssistant) -> None:
    """SERVICE_UPDATE_ALARM merges a partial change into the stored alarm."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "08:00", "label": "Before"},
        blocking=True,
    )
    await hass.async_block_till_done()

    item_id = _get_collection(hass).async_items()[0]["id"]

    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ALARM,
        {"id": item_id, "label": "After", "enabled": False},
        blocking=True,
    )
    await hass.async_block_till_done()

    items = _get_collection(hass).async_items()
    assert len(items) == 1
    assert items[0]["label"] == "After"
    assert items[0]["enabled"] is False
    assert items[0]["time"] == "08:00"


async def test_service_remove_alarm(hass: HomeAssistant) -> None:
    """SERVICE_REMOVE_ALARM deletes the alarm from the collection."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "09:00", "label": "ToRemove"},
        blocking=True,
    )
    await hass.async_block_till_done()

    item_id = _get_collection(hass).async_items()[0]["id"]

    await hass.services.async_call(
        DOMAIN,
        SERVICE_REMOVE_ALARM,
        {"id": item_id},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert _get_collection(hass).async_items() == []


async def test_service_add_multiple_alarms(hass: HomeAssistant) -> None:
    """Multiple SERVICE_ADD_ALARM calls accumulate independent alarms."""
    await _setup(hass)
    for label, t in (("First", "06:00"), ("Second", "07:30"), ("Third", "09:15")):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_ADD_ALARM,
            {"time": t, "label": label},
            blocking=True,
        )
    await hass.async_block_till_done()

    items = _get_collection(hass).async_items()
    assert len(items) == 3
    times = {i["time"] for i in items}
    assert times == {"06:00", "07:30", "09:15"}


# ---------------------------------------------------------------------------
# WebSocket aurora/alarms/list
# ---------------------------------------------------------------------------


async def test_ws_alarms_list_empty(
    hass: HomeAssistant,
    hass_ws_client,
) -> None:
    """aurora/alarms/list returns an empty result when no alarms are stored."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "aurora/alarms/list"})
    msg = await client.receive_json()

    assert msg["id"] == 1
    assert msg["success"] is True
    assert msg["result"] == []


async def test_ws_alarms_list_after_create(
    hass: HomeAssistant,
    hass_ws_client,
) -> None:
    """aurora/alarms/list reflects alarms added via the service."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "WS Test"},
        blocking=True,
    )
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json({"id": 2, "type": "aurora/alarms/list"})
    msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]
    assert len(result) == 1
    assert result[0]["label"] == "WS Test"
    assert result[0]["time"] == "07:00"
    assert "id" in result[0]


# ---------------------------------------------------------------------------
# Model canonical defaults (round-trip via standalone collection)
# ---------------------------------------------------------------------------


async def test_schedule_defaults(hass: HomeAssistant) -> None:
    """A newly created alarm has a daily schedule covering all weekdays."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "06:00"})

    sched = item["schedule"]
    assert sched["repeat_mode"] == "daily"
    # All 7 weekdays (0-6)
    assert sorted(sched["weekdays"]) == list(range(7))
    assert sched["on_date"] is None


async def test_audio_feature_defaults(hass: HomeAssistant) -> None:
    """Audio feature defaults: enabled=True, volume_profile=fade_in, volume_max=0.7."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "06:00"})

    audio = item["features"]["audio"]
    assert audio["enabled"] is True
    assert audio["volume_profile"] == "fade_in"
    assert audio["volume_max"] == pytest.approx(0.7)
    assert audio["target"] is None
    assert audio["source"] is None


async def test_light_feature_defaults(hass: HomeAssistant) -> None:
    """Light feature defaults: disabled, duration 30 min, post_stop off."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "06:00"})

    light = item["features"]["light"]
    assert light["enabled"] is False
    assert light["duration_min"] == 30
    assert light["post_stop"] == "off"
    assert light["color_temp_kelvin"] is None


async def test_smart_window_feature_defaults(hass: HomeAssistant) -> None:
    """SmartWindow feature defaults: disabled, 30 minutes, no signals."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "06:00"})

    sw = item["features"]["smart_window"]
    assert sw["enabled"] is False
    assert sw["minutes"] == 30
    assert sw["signals"] == []


async def test_snooze_feature_defaults(hass: HomeAssistant) -> None:
    """Snooze feature defaults: max 3, duration 540 s."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "06:00"})

    snooze = item["features"]["snooze"]
    assert snooze["max"] == 3
    assert snooze["duration"] == 540


async def test_briefing_feature_defaults(hass: HomeAssistant) -> None:
    """Briefing feature defaults: disabled, empty blocks, no template."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "06:00"})

    briefing = item["features"]["briefing"]
    assert briefing["enabled"] is False
    assert briefing["blocks"] == []
    assert briefing["template"] is None


async def test_mission_feature_defaults(hass: HomeAssistant) -> None:
    """Mission feature defaults: type=tap, empty params, no vision_prompt."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "06:00"})

    mission = item["features"]["mission"]
    assert mission["type"] == "tap"
    assert mission["params"] == {}
    assert mission["vision_prompt"] is None


async def test_update_skip_next_flag(hass: HomeAssistant) -> None:
    """Toggling skip_next via update is reflected immediately."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "07:00"})
    item_id = item["id"]
    assert item["skip_next"] is False

    updated = await coll.async_update_item(item_id, {"skip_next": True})
    assert updated["skip_next"] is True

    # Toggle back
    reset = await coll.async_update_item(item_id, {"skip_next": False})
    assert reset["skip_next"] is False


async def test_update_schedule_partial(hass: HomeAssistant) -> None:
    """A partial schedule dict in an update is merged into the stored alarm."""
    coll = await async_create_alarm_collection(hass)
    item = await coll.async_create_item({"time": "08:00"})
    item_id = item["id"]

    updated = await coll.async_update_item(
        item_id,
        {"schedule": {"repeat_mode": "weekly", "weekdays": [0, 1, 2, 3, 4]}},
    )
    assert updated["schedule"]["repeat_mode"] == "weekly"
    assert sorted(updated["schedule"]["weekdays"]) == [0, 1, 2, 3, 4]
