"""WebSocket API tests for the Aurora integration.

Covers the custom WS commands registered by ``websocket.py``:

* ``aurora/settings/get``   — read entry data + options
* ``aurora/settings/set``   — shallow-merge options update
* ``aurora/options/entities`` — per-role entity discovery + calendars/weather/todo
* ``aurora/vision/check``   — AI vision selfie route (mocked inference)

The ``aurora/alarms/*`` commands (list/create/update/delete) come from
``DictStorageCollectionWebsocket`` and are exercised in the storage CRUD
section (see ``test_ws_alarms_*`` below).

All tests drive behavior through the public surface: setup the entry, send
a JSON message over the WS client, assert the response. Private coordinator
attributes are only accessed in the three vision tests that patch
``_async_vision_infer``; see each test's comment for why a fully black-box
approach is not possible for those cases.
"""

import base64

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    DOMAIN,
    ROLE_AUDIO_SINK,
    ROLE_CONVERSATION,
    ROLE_DISPLAY_SURFACE,
    ROLE_NOTIFY_CHANNEL,
    ROLE_PRESENCE_SIGNAL,
    ROLE_SLEEP_SIGNAL,
    ROLE_TTS,
    ROLE_VISION_PROVIDER,
    ROLE_WAKE_LIGHT,
    SERVICE_ADD_ALARM,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MSG_ID = 1  # reused across tests that only send one message


async def _setup(
    hass: HomeAssistant, *, options: dict | None = None
) -> MockConfigEntry:
    """Create and load an Aurora config entry, returning it."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options=options or {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _b64_jpeg() -> str:
    """Return a minimal valid base-64-encoded JPEG byte-string."""
    # A 1x1 white JPEG (valid enough for base64 decode; actual bytes don't matter
    # because the vision infer call is mocked in every vision test).
    raw = bytes(
        [
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
            0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
            0xFF, 0xD9,
        ]
    )
    return base64.b64encode(raw).decode()


# ---------------------------------------------------------------------------
# aurora/settings/get
# ---------------------------------------------------------------------------


async def test_ws_settings_get_no_entry(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """settings/get returns null entry_id + empty dicts when Aurora is not set up."""
    # Aurora domain must still be loaded so the WS commands are registered;
    # we achieve this by setting up then immediately unloading+removing the entry.
    # async_setup (domain-level) registers WS commands permanently; removing the
    # config entry only makes _entry() return None without unregistering commands.
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/settings/get"})
    msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]
    assert result["entry_id"] is None
    assert result["data"] == {}
    assert result["options"] == {}


async def test_ws_settings_get_with_entry(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """settings/get returns the loaded entry's id, data and options."""
    entry = await _setup(hass, options={ROLE_TTS: "tts.test_engine"})
    assert entry.state is ConfigEntryState.LOADED

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/settings/get"})
    msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]
    assert result["entry_id"] == entry.entry_id
    assert isinstance(result["data"], dict)
    assert isinstance(result["options"], dict)
    assert result["options"].get(ROLE_TTS) == "tts.test_engine"


# ---------------------------------------------------------------------------
# aurora/settings/set
# ---------------------------------------------------------------------------


async def test_ws_settings_set_merges_options(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """settings/set shallow-merges new keys into existing options without wiping."""
    await _setup(hass, options={ROLE_TTS: "tts.original"})

    client = await hass_ws_client(hass)
    await client.send_json(
        {
            "id": _MSG_ID,
            "type": "aurora/settings/set",
            "options": {ROLE_AUDIO_SINK: "media_player.bedroom"},
        }
    )
    msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]
    # The pre-existing TTS binding must still be present.
    assert result["options"][ROLE_TTS] == "tts.original"
    # The new audio sink binding must have been added.
    assert result["options"][ROLE_AUDIO_SINK] == "media_player.bedroom"


async def test_ws_settings_set_strips_empty_values(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """settings/set removes keys whose value is an empty string from merged options.

    Source: ``websocket.py`` line 68:
    ``options = {k: v for k, v in merged.items() if v not in ("", None, [])}``.
    """
    await _setup(
        hass,
        options={ROLE_TTS: "tts.original", ROLE_AUDIO_SINK: "media_player.old"},
    )

    client = await hass_ws_client(hass)
    # Sending an empty string for audio_sink must cause that key to be stripped.
    await client.send_json(
        {
            "id": _MSG_ID,
            "type": "aurora/settings/set",
            "options": {ROLE_AUDIO_SINK: ""},
        }
    )
    msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]
    # Empty-string value is filtered out — the key must be absent entirely.
    assert ROLE_AUDIO_SINK not in result["options"]
    # Unrelated existing option preserved.
    assert result["options"].get(ROLE_TTS) == "tts.original"


async def test_ws_settings_set_no_entry_returns_error(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """settings/set returns an error when Aurora is not configured."""
    # Set up the domain (to register WS commands) then remove the entry.
    entry = await _setup(hass)
    await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json(
        {
            "id": _MSG_ID,
            "type": "aurora/settings/set",
            "options": {ROLE_TTS: "tts.x"},
        }
    )
    msg = await client.receive_json()

    assert msg["success"] is False
    assert msg["error"]["code"] == "not_found"


# ---------------------------------------------------------------------------
# aurora/options/entities
# ---------------------------------------------------------------------------


async def test_ws_options_entities_structure(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """options/entities response has all required top-level keys with correct types."""
    await _setup(hass)

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/options/entities"})
    msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]

    # All top-level sections must be present.
    assert "roles" in result
    assert "calendars" in result
    assert "weather" in result
    assert "todo" in result
    assert "vision_providers" in result

    # roles must contain every known role key.
    roles = result["roles"]
    for role in (
        ROLE_AUDIO_SINK,
        ROLE_WAKE_LIGHT,
        ROLE_DISPLAY_SURFACE,
        ROLE_NOTIFY_CHANNEL,
        ROLE_VISION_PROVIDER,
        ROLE_SLEEP_SIGNAL,
        ROLE_PRESENCE_SIGNAL,
        ROLE_CONVERSATION,
        ROLE_TTS,
    ):
        assert role in roles, f"Role {role!r} missing from options/entities result"
        assert isinstance(roles[role], list)

    # Supplementary sections must be lists.
    assert isinstance(result["calendars"], list)
    assert isinstance(result["weather"], list)
    assert isinstance(result["todo"], list)
    assert isinstance(result["vision_providers"], list)


async def test_ws_options_entities_includes_media_player_audio_sink(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """A media_player with PLAY_MEDIA support appears in audio_sink candidates."""
    from homeassistant.components.media_player import MediaPlayerEntityFeature

    await _setup(hass)
    # Register a fake media_player entity that supports PLAY_MEDIA.
    hass.states.async_set(
        "media_player.bedroom_speaker",
        "idle",
        {
            "supported_features": MediaPlayerEntityFeature.PLAY_MEDIA,
            "friendly_name": "Bedroom Speaker",
        },
    )

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/options/entities"})
    msg = await client.receive_json()

    assert msg["success"] is True
    assert "media_player.bedroom_speaker" in msg["result"]["roles"][ROLE_AUDIO_SINK]


async def test_ws_options_entities_includes_tts_entity(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """A tts entity appears in the tts role candidates."""
    await _setup(hass)
    hass.states.async_set("tts.piper", "ready", {})

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/options/entities"})
    msg = await client.receive_json()

    assert msg["success"] is True
    assert "tts.piper" in msg["result"]["roles"][ROLE_TTS]


async def test_ws_options_entities_includes_weather_and_todo(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """Weather and todo entities appear in the dedicated supplementary lists."""
    await _setup(hass)
    hass.states.async_set("weather.home", "sunny", {})
    hass.states.async_set("todo.shopping", "0", {})

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/options/entities"})
    msg = await client.receive_json()

    assert msg["success"] is True
    assert "weather.home" in msg["result"]["weather"]
    assert "todo.shopping" in msg["result"]["todo"]


async def test_ws_options_entities_includes_calendar(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """Calendar entities appear in the calendars list."""
    await _setup(hass)
    hass.states.async_set("calendar.work", "off", {})

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/options/entities"})
    msg = await client.receive_json()

    assert msg["success"] is True
    assert "calendar.work" in msg["result"]["calendars"]


async def test_ws_options_entities_lists_are_sorted(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """The weather, todo, and calendars lists are sorted alphabetically."""
    await _setup(hass)
    hass.states.async_set("weather.z_last", "sunny", {})
    hass.states.async_set("weather.a_first", "cloudy", {})

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/options/entities"})
    msg = await client.receive_json()

    assert msg["success"] is True
    weather = msg["result"]["weather"]
    assert weather == sorted(weather)


# ---------------------------------------------------------------------------
# aurora/vision/check
# ---------------------------------------------------------------------------


async def test_ws_vision_check_no_coordinator_returns_error(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """vision/check returns not_found when the entry is not loaded.

    Only the entry is unloaded (not removed) so _coordinator() returns None
    because entry.state is NOT_LOADED, while the WS command stays registered.
    """
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json(
        {"id": _MSG_ID, "type": "aurora/vision/check", "image": _b64_jpeg()}
    )
    msg = await client.receive_json()

    assert msg["success"] is False
    assert msg["error"]["code"] == "not_found"


async def test_ws_vision_check_bad_image_returns_awake_false(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """vision/check with a non-decodable image returns awake=False and error=bad_image.

    Source: ``coordinator.py`` async_vision_check catches (ValueError, TypeError) from
    base64.b64decode and returns {"awake": False, "error": "bad_image"} immediately,
    before any file I/O or inference occurs.
    """
    await _setup(hass)

    client = await hass_ws_client(hass)
    await client.send_json(
        {
            "id": _MSG_ID,
            "type": "aurora/vision/check",
            "image": "!!!not-base64!!!",
        }
    )
    msg = await client.receive_json()

    # Coordinator handles the bad image gracefully — sends a result, not a WS error.
    assert msg["success"] is True
    assert msg["result"]["awake"] is False
    assert msg["result"].get("error") == "bad_image"


async def test_ws_vision_check_with_ai_task_provider(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """vision/check resolves awake=True when the ai_task provider returns awake=true.

    ``_async_vision_infer`` is patched because async_mock_service cannot return
    the structured {data:{awake:True}} dict the coordinator expects. This is the
    only way to test the awake=True path without a live AI provider. The file
    write that happens BEFORE the infer call runs against the real (temp) hass
    config dir — pytest-hacc provides a valid writable path.
    """
    from unittest.mock import AsyncMock, patch

    # Bind an ai_task entity as the vision provider.
    entry = await _setup(hass, options={ROLE_VISION_PROVIDER: "ai_task.vision"})
    hass.states.async_set("ai_task.vision", "ready", {})

    coordinator = entry.runtime_data.coordinator
    with patch.object(
        coordinator,
        "_async_vision_infer",
        new=AsyncMock(return_value="yes"),
    ):
        client = await hass_ws_client(hass)
        await client.send_json(
            {"id": _MSG_ID, "type": "aurora/vision/check", "image": _b64_jpeg()}
        )
        msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]
    assert result["awake"] is True
    assert "latency_ms" in result


async def test_ws_vision_check_with_alarm_id(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """vision/check accepts an optional alarm_id and still returns a valid result.

    ``_async_vision_infer`` is patched for the same reason as
    ``test_ws_vision_check_with_ai_task_provider``. The alarm is created via the
    public service so a real alarm_id exists in the collection.
    """
    from unittest.mock import AsyncMock, patch

    entry = await _setup(hass, options={ROLE_VISION_PROVIDER: "ai_task.vision"})
    hass.states.async_set("ai_task.vision", "ready", {})

    # Create an alarm so there is a real alarm_id to pass.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:30", "label": "Vision test"},
        blocking=True,
    )
    await hass.async_block_till_done()

    collection = hass.data[DOMAIN]
    items = collection.async_items()
    assert items, "Expected at least one alarm to be created"
    alarm_id = items[0]["id"]

    coordinator = entry.runtime_data.coordinator
    with patch.object(
        coordinator,
        "_async_vision_infer",
        new=AsyncMock(return_value="no"),
    ):
        client = await hass_ws_client(hass)
        await client.send_json(
            {
                "id": _MSG_ID,
                "type": "aurora/vision/check",
                "image": _b64_jpeg(),
                "alarm_id": alarm_id,
            }
        )
        msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]
    assert "awake" in result
    assert "latency_ms" in result


async def test_ws_vision_check_inference_failure_returns_awake_false(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """vision/check degrades to awake=False when inference raises an exception.

    Source: coordinator.py lines 1046-1047 — after all attempts fail ``ok`` is
    False and the method returns
    ``{"awake": False, "error": "inference_failed", "latency_ms": <ms>}``.
    ``_async_vision_infer`` is patched because async_mock_service cannot raise.
    """
    from unittest.mock import AsyncMock, patch

    entry = await _setup(hass, options={ROLE_VISION_PROVIDER: "ai_task.vision"})
    hass.states.async_set("ai_task.vision", "ready", {})

    coordinator = entry.runtime_data.coordinator
    with patch.object(
        coordinator,
        "_async_vision_infer",
        new=AsyncMock(side_effect=Exception("provider down")),
    ):
        client = await hass_ws_client(hass)
        await client.send_json(
            {"id": _MSG_ID, "type": "aurora/vision/check", "image": _b64_jpeg()}
        )
        msg = await client.receive_json()

    assert msg["success"] is True
    result = msg["result"]
    assert result["awake"] is False
    assert result.get("error") == "inference_failed"


# ---------------------------------------------------------------------------
# aurora/alarms/* (DictStorageCollectionWebsocket CRUD)
# ---------------------------------------------------------------------------


async def test_ws_alarms_list_empty(hass: HomeAssistant, hass_ws_client) -> None:
    """aurora/alarms/list returns an empty list when no alarms exist."""
    await _setup(hass)

    client = await hass_ws_client(hass)
    await client.send_json({"id": _MSG_ID, "type": "aurora/alarms/list"})
    msg = await client.receive_json()

    assert msg["success"] is True
    # DictStorageCollectionWebsocket.ws_list_item sends the raw list directly.
    result = msg["result"]
    assert isinstance(result, list)
    assert len(result) == 0


async def test_ws_alarms_create_and_list(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """Creating an alarm via aurora/alarms/create makes it appear in alarms/list."""
    await _setup(hass)

    client = await hass_ws_client(hass)

    # Create an alarm.
    await client.send_json(
        {
            "id": 1,
            "type": "aurora/alarms/create",
            "time": "06:30",
            "label": "WS Test Alarm",
            "enabled": True,
        }
    )
    create_msg = await client.receive_json()
    assert create_msg["success"] is True
    created = create_msg["result"]
    # AuroraAlarm.as_dict() serialises alarm_time as "HH:MM" under key "time".
    assert created.get("time") == "06:30"
    assert created.get("label") == "WS Test Alarm"
    alarm_id = created["id"]

    # List alarms — DictStorageCollectionWebsocket returns the list directly.
    await client.send_json({"id": 2, "type": "aurora/alarms/list"})
    list_msg = await client.receive_json()
    assert list_msg["success"] is True
    items = list_msg["result"]
    assert isinstance(items, list)
    ids = [item["id"] for item in items]
    assert alarm_id in ids


async def test_ws_alarms_update(hass: HomeAssistant, hass_ws_client) -> None:
    """aurora/alarms/update merges partial fields into an existing alarm."""
    await _setup(hass)

    client = await hass_ws_client(hass)

    # Create.
    await client.send_json(
        {
            "id": 1,
            "type": "aurora/alarms/create",
            "time": "07:00",
            "label": "Before",
        }
    )
    create_msg = await client.receive_json()
    assert create_msg["success"] is True
    alarm_id = create_msg["result"]["id"]

    # Update the label.  The id parameter key is "{model_name}_id" = "alarm_id"
    # (DictStorageCollectionWebsocket uses the model name "alarm" as the prefix).
    await client.send_json(
        {
            "id": 2,
            "type": "aurora/alarms/update",
            "alarm_id": alarm_id,
            "label": "After",
        }
    )
    update_msg = await client.receive_json()
    assert update_msg["success"] is True
    assert update_msg["result"]["label"] == "After"
    assert update_msg["result"]["time"] == "07:00"  # unchanged


async def test_ws_alarms_delete(hass: HomeAssistant, hass_ws_client) -> None:
    """aurora/alarms/delete removes the alarm from the collection."""
    await _setup(hass)

    client = await hass_ws_client(hass)

    # Create.
    await client.send_json(
        {
            "id": 1,
            "type": "aurora/alarms/create",
            "time": "08:00",
            "label": "Delete me",
        }
    )
    create_msg = await client.receive_json()
    assert create_msg["success"] is True
    alarm_id = create_msg["result"]["id"]

    # Delete.  The id parameter key is "{model_name}_id" = "alarm_id".
    await client.send_json(
        {"id": 2, "type": "aurora/alarms/delete", "alarm_id": alarm_id}
    )
    delete_msg = await client.receive_json()
    assert delete_msg["success"] is True

    # Verify it is gone.
    await client.send_json({"id": 3, "type": "aurora/alarms/list"})
    list_msg = await client.receive_json()
    assert list_msg["success"] is True
    items = list_msg["result"]
    assert isinstance(items, list)
    ids = [item["id"] for item in items]
    assert alarm_id not in ids


async def test_ws_alarms_create_invalid_time_fails(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """aurora/alarms/create rejects a malformed time string.

    CREATE_FIELDS requires time: str; AlarmStorageCollection._process_create_data
    runs it through AuroraAlarm.from_dict which calls time.fromisoformat and raises
    ValueError, which is re-raised as vol.Invalid -> WS error response.
    """
    await _setup(hass)

    client = await hass_ws_client(hass)
    await client.send_json(
        {"id": _MSG_ID, "type": "aurora/alarms/create", "time": "not-a-time"}
    )
    msg = await client.receive_json()

    # The collection's validation must reject this.
    assert msg["success"] is False
