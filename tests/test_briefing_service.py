"""Tests for Aurora's spoken wake-up briefing (coordinator + briefing.py).

Coverage targets:
- SERVICE_SPEAK_BRIEFING triggers tts.speak via the TTS + AudioSink roles.
- The spoken message contains English greeting and time block (default language).
- Weather block: a bound weather entity's condition + temperature appear in the text.
- Calendar block: events from the calendar.get_events response appear in the text.
- Todo block: items from todo.get_items response appear in the text.
- Post-wake briefing: async_dismiss on a briefing-enabled alarm → POST_WAKE state →
  tts.speak fires and state returns to idle.
- Degradation: no TTS entity → persistent_notification.async_create is called.
- Briefing disabled: dismiss does NOT trigger POST_WAKE and no tts call is made.
"""

import asyncio
from unittest.mock import patch

from homeassistant.core import HomeAssistant, SupportsResponse
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_mock_service,
)

from custom_components.aurora.const import (
    CONF_BRIEFING_CALENDARS,
    CONF_TODO_LISTS,
    CONF_WEATHER,
    DOMAIN,
    ROLE_AUDIO_SINK,
    ROLE_TTS,
    SERVICE_ADD_ALARM,
    SERVICE_DISMISS,
    SERVICE_SPEAK_BRIEFING,
    SERVICE_TRIGGER_NOW,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TTS_ENTITY = "tts.test_engine"
_MEDIA_PLAYER = "media_player.bedroom"
_WEATHER_ENTITY = "weather.home"
_CALENDAR_ENTITY = "calendar.work"
_TODO_ENTITY = "todo.tasks"


async def _setup(
    hass: HomeAssistant,
    *,
    options: dict | None = None,
) -> MockConfigEntry:
    """Load the Aurora integration and return the config entry.

    Binds ROLE_TTS and ROLE_AUDIO_SINK by default so briefing can speak.
    """
    base_options: dict = {
        ROLE_TTS: _TTS_ENTITY,
        ROLE_AUDIO_SINK: _MEDIA_PLAYER,
    }
    if options:
        base_options.update(options)
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options=base_options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _add_briefing_alarm(
    hass: HomeAssistant,
    *,
    blocks: list[str] | None = None,
    template: str | None = None,
) -> None:
    """Add an alarm with the briefing feature enabled via the service."""
    features: dict = {"briefing": {"enabled": True}}
    if blocks is not None:
        features["briefing"]["blocks"] = blocks
    if template is not None:
        features["briefing"]["template"] = template
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Briefing Test", "features": features},
        blocking=True,
    )
    await hass.async_block_till_done()


def _register_return_response_service(
    hass: HomeAssistant,
    domain: str,
    service: str,
    return_value: dict,
) -> None:
    """Register a fake service that supports return_response and returns a dict.

    The coordinator calls calendar.get_events and todo.get_items with
    return_response=True. HA requires the handler to be registered with
    supports_response=SupportsResponse.OPTIONAL (or ONLY); without it,
    the async_call raises an error. We supply an AsyncMock that returns
    the desired dict, registered with the correct SupportsResponse flag.
    """

    async def _handler(call):
        """Return the pre-configured fake response dict."""
        return return_value

    hass.services.async_register(
        domain,
        service,
        _handler,
        supports_response=SupportsResponse.OPTIONAL,
    )


# ---------------------------------------------------------------------------
# Basic TTS call
# ---------------------------------------------------------------------------


async def test_speak_briefing_calls_tts(hass: HomeAssistant) -> None:
    """SERVICE_SPEAK_BRIEFING fires tts.speak with the right data fields.

    Covers: coordinator.async_speak_briefing → _async_run_briefing →
    _async_speak (tts domain + speak service, media_player_entity_id + message).
    """
    await _setup(hass)
    await _add_briefing_alarm(hass, blocks=["time"])
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls, "Expected tts.speak to be called at least once"
    call = tts_calls[0]
    assert call.data["media_player_entity_id"] == _MEDIA_PLAYER
    assert call.data["message"]
    assert call.data.get("cache") is False


async def test_speak_briefing_english_time_block(hass: HomeAssistant) -> None:
    """The default language is English; the time block uses English phrases.

    Covers: _async_briefing_text → compose_briefing(language="en") →
    _block_time → "Good morning/afternoon/evening" + HH:MM pattern.
    """
    await _setup(hass)
    await _add_briefing_alarm(hass, blocks=["time"])
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls
    message: str = tts_calls[0].data["message"]
    # English greeting words expected
    greetings = ("Good morning", "Good afternoon", "Good evening", "Good night")
    assert any(g in message for g in greetings), (
        f"No English greeting in: {message!r}"
    )
    # Time digits pattern (at least one colon separating hours/minutes)
    assert ":" in message, f"No time separator in: {message!r}"


async def test_speak_briefing_tts_target_entity(hass: HomeAssistant) -> None:
    """The tts.speak call carries the TTS entity in the service target.

    Covers: _async_speak — target={"entity_id": tts_entity} (coordinator.py
    line ~903). async_mock_service captures ServiceCall.target.
    """
    await _setup(hass)
    await _add_briefing_alarm(hass, blocks=["time"])
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls
    # The service target should reference the TTS entity.
    # ServiceCall.target is a dict with optional entity_id/area_id/device_id.
    target = tts_calls[0].target or {}
    assert target.get("entity_id") == _TTS_ENTITY


# ---------------------------------------------------------------------------
# Weather block
# ---------------------------------------------------------------------------


async def test_speak_briefing_weather_block(hass: HomeAssistant) -> None:
    """Weather entity state and temperature appear in the briefing text.

    Covers: coordinator._gather_weather → reads hass.states.get(weather_entity)
    → WeatherFact → briefing._block_weather → compose_briefing.
    """
    await _setup(
        hass,
        options={CONF_WEATHER: _WEATHER_ENTITY},
    )
    await _add_briefing_alarm(hass, blocks=["weather"])
    hass.states.async_set(
        _WEATHER_ENTITY,
        "sunny",
        {"temperature": 22.5, "temperature_unit": "°C"},
    )
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls
    message: str = tts_calls[0].data["message"]
    # briefing.py maps "sunny" → "sunny" in English _WEATHER table
    assert "sunny" in message.lower(), f"Expected weather info in: {message!r}"
    # Temperature rounded to integer: 22.5 → 23 (Python round half-to-even)
    assert "23" in message or "22" in message, (
        f"Expected temperature in: {message!r}"
    )


async def test_speak_briefing_weather_unavailable_skipped(
    hass: HomeAssistant,
) -> None:
    """Unavailable weather entity skips the weather block (no crash).

    Covers: _gather_weather returns None when state is 'unavailable'.
    With only the weather block and no data, compose_briefing returns "".
    The coordinator short-circuits on empty text (logs debug, no tts call).
    """
    await _setup(
        hass,
        options={CONF_WEATHER: _WEATHER_ENTITY},
    )
    await _add_briefing_alarm(hass, blocks=["weather"])
    hass.states.async_set(_WEATHER_ENTITY, "unavailable", {})
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    # Nothing to say → tts.speak must NOT be called
    assert not tts_calls, "tts.speak should not fire when briefing text is empty"


# ---------------------------------------------------------------------------
# Calendar block
# ---------------------------------------------------------------------------


async def test_speak_briefing_calendar_events(hass: HomeAssistant) -> None:
    """Calendar events fetched via calendar.get_events appear in the briefing.

    Covers: coordinator._gather_events → hass.services.async_call("calendar",
    "get_events", return_response=True) → rows sorted by start →
    compose_briefing calendar block.

    The fake handler is registered with SupportsResponse.OPTIONAL so that
    calling it with return_response=True does not raise a ServiceNotSupported
    error (HA enforces this at call time).
    """
    await _setup(
        hass,
        options={CONF_BRIEFING_CALENDARS: [_CALENDAR_ENTITY]},
    )
    await _add_briefing_alarm(hass, blocks=["calendar"])

    fake_event_response = {
        _CALENDAR_ENTITY: {
            "events": [
                {
                    "summary": "Team standup",
                    "start": "2026-06-17T09:00:00",
                    "end": "2026-06-17T09:30:00",
                }
            ]
        }
    }
    _register_return_response_service(
        hass, "calendar", "get_events", fake_event_response
    )
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls
    message: str = tts_calls[0].data["message"]
    assert "Team standup" in message, f"Calendar event not in: {message!r}"


async def test_speak_briefing_no_events_phrase(hass: HomeAssistant) -> None:
    """Empty calendar → 'Nothing on your calendar today' in English.

    Covers: _block_calendar with empty ctx.events returns the no_events phrase
    (briefing.py _PHRASES["en"]["no_events"]).
    """
    await _setup(
        hass,
        options={CONF_BRIEFING_CALENDARS: [_CALENDAR_ENTITY]},
    )
    await _add_briefing_alarm(hass, blocks=["calendar"])

    _register_return_response_service(
        hass,
        "calendar",
        "get_events",
        {_CALENDAR_ENTITY: {"events": []}},
    )
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls
    message: str = tts_calls[0].data["message"]
    assert "Nothing on your calendar" in message, (
        f"Expected no-events phrase in: {message!r}"
    )


# ---------------------------------------------------------------------------
# Todo block
# ---------------------------------------------------------------------------


async def test_speak_briefing_todo_items(hass: HomeAssistant) -> None:
    """Open to-do items fetched via todo.get_items appear in the briefing.

    Covers: coordinator._gather_todos → hass.services.async_call("todo",
    "get_items", return_response=True) → compose_briefing todo block.

    The fake handler is registered with SupportsResponse.OPTIONAL so that
    calling it with return_response=True does not raise a ServiceNotSupported
    error.
    """
    await _setup(
        hass,
        options={CONF_TODO_LISTS: [_TODO_ENTITY]},
    )
    await _add_briefing_alarm(hass, blocks=["todo"])

    fake_todo_response = {
        _TODO_ENTITY: {
            "items": [
                {"summary": "Buy milk", "status": "needs_action"},
                {"summary": "Call doctor", "status": "needs_action"},
            ]
        }
    }
    _register_return_response_service(
        hass, "todo", "get_items", fake_todo_response
    )
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls
    message: str = tts_calls[0].data["message"]
    assert "Buy milk" in message, f"Todo item not in: {message!r}"
    assert "Call doctor" in message, f"Second todo item not in: {message!r}"


async def test_speak_briefing_empty_todo_omits_block(hass: HomeAssistant) -> None:
    """Empty to-do list → the todo block is omitted (returns None → skipped).

    Covers: _block_todo returns None when ctx.todos is empty → compose_briefing
    silently drops the block. Time block still produces output so tts is called.
    """
    await _setup(
        hass,
        options={CONF_TODO_LISTS: [_TODO_ENTITY]},
    )
    await _add_briefing_alarm(hass, blocks=["time", "todo"])

    _register_return_response_service(
        hass, "todo", "get_items", {_TODO_ENTITY: {"items": []}}
    )
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls, "Should still call tts (time block present)"
    message: str = tts_calls[0].data["message"]
    # The "To do:" prefix from _PHRASES["en"]["todo"] must not appear
    assert "To do" not in message, f"Unexpected todo block in: {message!r}"


# ---------------------------------------------------------------------------
# Custom template
# ---------------------------------------------------------------------------


async def test_speak_briefing_custom_template(hass: HomeAssistant) -> None:
    """A per-alarm briefing template overrides the standard blocks.

    Covers: _async_briefing_text → briefing.template branch →
    Template(briefing.template, hass).async_render → returned text spoken
    verbatim, standard blocks not used.
    """
    await _setup(hass)
    await _add_briefing_alarm(hass, template="Rise and shine!")
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls
    assert tts_calls[0].data["message"] == "Rise and shine!"


# ---------------------------------------------------------------------------
# Degradation: no TTS entity → persistent_notification
# ---------------------------------------------------------------------------


async def test_speak_briefing_degraded_to_notification(
    hass: HomeAssistant,
) -> None:
    """When no TTS entity is bound, the text lands in a persistent_notification.

    Covers: _async_speak fallback path (coordinator.py ~line 908):
    persistent_notification.async_create(hass, text, title=..., notification_id=...).

    The patch target must be the name as bound in coordinator.py, which imports
    'from homeassistant.components import persistent_notification' and then calls
    persistent_notification.async_create(). We patch the module attribute on the
    coordinator module so the already-bound name is intercepted.
    """
    # Bind audio sink but NO TTS role
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Aurora",
        options={ROLE_AUDIO_SINK: _MEDIA_PLAYER},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    await _add_briefing_alarm(hass, blocks=["time"])
    tts_calls = async_mock_service(hass, "tts", "speak")

    with patch(
        "custom_components.aurora.coordinator.persistent_notification.async_create"
    ) as mock_create:
        await hass.services.async_call(
            DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
        )
        await hass.async_block_till_done()

    assert not tts_calls, "tts.speak must NOT fire without TTS entity"
    assert mock_create.called, "Expected persistent_notification.async_create"
    # Signature: async_create(hass, message, title=..., notification_id=...)
    # hass is positional [0], message is positional [1]
    text_arg = mock_create.call_args[0][1]
    assert text_arg, "Notification text must be non-empty"


# ---------------------------------------------------------------------------
# Post-wake briefing triggered by dismiss
# ---------------------------------------------------------------------------


async def test_dismiss_triggers_post_wake_briefing(hass: HomeAssistant) -> None:
    """Dismissing a briefing-enabled alarm puts coordinator into POST_WAKE.

    After briefing completes the state returns to idle. A tts.speak is fired.
    Covers: async_dismiss → _async_post_wake (async task) → _async_run_briefing
    → coordinator._state transitions POST_WAKE → IDLE.
    """
    await _setup(hass)
    await _add_briefing_alarm(hass, blocks=["time"])

    tts_calls = async_mock_service(hass, "tts", "speak")

    # Trigger a ring first so there is an active alarm
    await hass.services.async_call(
        DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "ringing"

    # Dismiss → creates an async task for _async_post_wake
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()

    # After the post-wake task resolves we expect idle
    state = hass.states.get("sensor.aurora_state").state
    assert state == "idle", f"Expected idle after post-wake, got {state!r}"
    assert tts_calls, "Expected tts.speak during post-wake briefing"


async def test_dismiss_no_briefing_stays_idle(hass: HomeAssistant) -> None:
    """Dismissing an alarm with briefing disabled goes directly to idle.

    Covers: async_dismiss → briefing.enabled is False (BriefingFeature default)
    → _state = IDLE immediately, no POST_WAKE transition and no tts.speak.
    """
    # Add alarm WITHOUT briefing enabled (default is disabled per BriefingFeature)
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "No briefing"},
        blocking=True,
    )
    await hass.async_block_till_done()
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get("sensor.aurora_state").state == "ringing"

    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()

    assert hass.states.get("sensor.aurora_state").state == "idle"
    assert not tts_calls, "tts.speak must not fire when briefing is disabled"


async def test_dismiss_while_post_wake_is_noop(hass: HomeAssistant) -> None:
    """A second dismiss while already in POST_WAKE is a no-op (guard clause).

    Covers: async_dismiss early-return when _state is AuroraState.POST_WAKE
    (coordinator.py line 655-656). A second dismiss after the first must not
    clobber the running post-wake task or corrupt the final idle state.

    NOTE: This test accesses coordinator._async_post_wake (a private method)
    to slow down the task so the guard clause is exercisable. Justified here
    because the guard clause cannot be tested black-box without a race.
    """
    entry = await _setup(hass)
    await _add_briefing_alarm(hass, blocks=["time"])

    async_mock_service(hass, "tts", "speak")

    coordinator = entry.runtime_data.coordinator
    original_run = coordinator._async_post_wake

    ran_count = 0

    async def _slow_post_wake(alarm):
        """Slow post-wake that yields once before delegating to the real impl."""
        nonlocal ran_count
        ran_count += 1
        await asyncio.sleep(0)
        await original_run(alarm)

    coordinator._async_post_wake = _slow_post_wake

    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()

    # First dismiss → POST_WAKE
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()

    # Second dismiss: guard clause must make this a no-op (state must not
    # be clobbered even if the post-wake task is still in flight).
    await hass.services.async_call(DOMAIN, SERVICE_DISMISS, {}, blocking=True)
    await hass.async_block_till_done()

    final_state = hass.states.get("sensor.aurora_state").state
    assert final_state == "idle", (
        f"State must settle to idle after all dismisses, got {final_state!r}"
    )


# ---------------------------------------------------------------------------
# All default blocks: full integration pass
# ---------------------------------------------------------------------------


async def test_speak_briefing_all_default_blocks(hass: HomeAssistant) -> None:
    """With all DEFAULT_BLOCKS the briefing includes time, weather, calendar, todo.

    Covers: compose_briefing with the full block list ("time","weather",
    "calendar","todo"), all data sources present.

    blocks=None in _add_briefing_alarm → briefing.blocks=[] → falsy → falls
    back to DEFAULT_BLOCKS tuple in _async_briefing_text line 775.
    """
    await _setup(
        hass,
        options={
            CONF_WEATHER: _WEATHER_ENTITY,
            CONF_BRIEFING_CALENDARS: [_CALENDAR_ENTITY],
            CONF_TODO_LISTS: [_TODO_ENTITY],
        },
    )
    await _add_briefing_alarm(hass)  # blocks=None → uses DEFAULT_BLOCKS

    hass.states.async_set(
        _WEATHER_ENTITY,
        "rainy",
        {"temperature": 15.0, "temperature_unit": "°C"},
    )
    _register_return_response_service(
        hass,
        "calendar",
        "get_events",
        {
            _CALENDAR_ENTITY: {
                "events": [
                    {
                        "summary": "Sprint review",
                        "start": "2026-06-17T10:00:00",
                        "end": "2026-06-17T11:00:00",
                    }
                ]
            }
        },
    )
    _register_return_response_service(
        hass,
        "todo",
        "get_items",
        {
            _TODO_ENTITY: {
                "items": [
                    {"summary": "Prepare slides", "status": "needs_action"}
                ]
            }
        },
    )
    tts_calls = async_mock_service(hass, "tts", "speak")

    await hass.services.async_call(
        DOMAIN, SERVICE_SPEAK_BRIEFING, {}, blocking=True
    )
    await hass.async_block_till_done()

    assert tts_calls
    message: str = tts_calls[0].data["message"]
    greetings = ("Good morning", "Good afternoon", "Good evening", "Good night")
    assert any(g in message for g in greetings), f"No greeting in: {message!r}"
    # briefing.py maps "rainy" → "rain" in English _WEATHER table
    assert "rain" in message.lower(), f"Weather missing: {message!r}"
    assert "Sprint review" in message, f"Calendar event missing: {message!r}"
    assert "Prepare slides" in message, f"Todo item missing: {message!r}"
