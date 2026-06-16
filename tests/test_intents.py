"""Tests for Aurora Assist (voice) intents.

Covers all five intent handlers registered by
``custom_components.aurora.intents.async_setup_intents``:
AuroraNextAlarm, AuroraSetAlarm, AuroraSnooze, AuroraDismiss, AuroraSkipNext.

Every test drives behavior exclusively through the public surface:
  setup entry → set state / call service → invoke intent → assert speech.
The ``_say`` helper in intents.py is exercised by switching
``hass.config.language`` before the intent call.
"""

from homeassistant.core import HomeAssistant
from homeassistant.helpers import intent
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_TRIGGER_NOW,
)
from custom_components.aurora.intents import (
    _RESPONSES,
    INTENT_DISMISS,
    INTENT_NEXT_ALARM,
    INTENT_SET_ALARM,
    INTENT_SKIP_NEXT,
    INTENT_SNOOZE,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Load a minimal Aurora config entry and wait for setup to complete."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _handle(
    hass: HomeAssistant,
    intent_type: str,
    slots: dict | None = None,
) -> intent.IntentResponse:
    """Invoke an Aurora intent and return the response."""
    return await intent.async_handle(hass, DOMAIN, intent_type, slots or {})


def _speech(resp: intent.IntentResponse) -> str:
    """Extract the plain-text speech from an IntentResponse."""
    return resp.speech["plain"]["speech"]


# ---------------------------------------------------------------------------
# AuroraNextAlarm
# ---------------------------------------------------------------------------


async def test_next_alarm_no_alarm(hass: HomeAssistant) -> None:
    """AuroraNextAlarm with no alarms scheduled returns the 'no_alarm' speech."""
    await _setup(hass)
    resp = await _handle(hass, INTENT_NEXT_ALARM)
    assert _speech(resp) == _RESPONSES["en"]["no_alarm"]


async def test_next_alarm_with_alarm(hass: HomeAssistant) -> None:
    """AuroraNextAlarm with a scheduled alarm speaks its local time (HH:MM)."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:30", "label": "Morning"}, blocking=True
    )
    await hass.async_block_till_done()

    resp = await _handle(hass, INTENT_NEXT_ALARM)
    speech = _speech(resp)
    # The response must use the "next_alarm" template and contain "07:30".
    assert "07:30" in speech
    assert speech != _RESPONSES["en"]["no_alarm"]


async def test_next_alarm_no_alarm_italian(hass: HomeAssistant) -> None:
    """AuroraNextAlarm with no alarm uses the Italian 'no_alarm' string when lang=it."""
    await _setup(hass)
    hass.config.language = "it"
    resp = await _handle(hass, INTENT_NEXT_ALARM)
    assert _speech(resp) == _RESPONSES["it"]["no_alarm"]


async def test_next_alarm_with_alarm_italian(hass: HomeAssistant) -> None:
    """AuroraNextAlarm with an alarm produces Italian speech and contains the time."""
    await _setup(hass)
    hass.config.language = "it"
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "08:00", "label": "Mattina"}, blocking=True
    )
    await hass.async_block_till_done()

    resp = await _handle(hass, INTENT_NEXT_ALARM)
    speech = _speech(resp)
    assert "08:00" in speech
    assert speech != _RESPONSES["it"]["no_alarm"]
    # Italian template contains "alle"
    assert "alle" in speech


# ---------------------------------------------------------------------------
# AuroraNextAlarm — not_ready (no loaded entry)
# ---------------------------------------------------------------------------


async def test_next_alarm_not_ready(hass: HomeAssistant) -> None:
    """AuroraNextAlarm with no loaded entry returns the 'not_ready' path.

    SkipNextIntent and NextAlarmIntent both guard with ``coordinator is None``
    (via _coordinator helper); with no entry loaded that path fires.
    Note: intents are registered at domain (async_setup) level, so we must
    trigger async_setup without adding an entry, or rely on no entry being
    present. The simplest approach is to not call _setup at all — intents
    registered in a prior test are idempotent, so we call async_setup
    manually via the domain only.
    """
    # Manually trigger domain-level setup (registers intents + storage) without
    # creating a config entry, so _coordinator() returns None.
    from homeassistant.helpers.typing import ConfigType

    from custom_components.aurora import async_setup

    await async_setup(hass, ConfigType())
    await hass.async_block_till_done()

    resp = await _handle(hass, INTENT_NEXT_ALARM)
    # coordinator is None -> next_alarm is None -> "no_alarm" response
    assert _speech(resp) == _RESPONSES["en"]["no_alarm"]


# ---------------------------------------------------------------------------
# AuroraSetAlarm
# ---------------------------------------------------------------------------


async def test_set_alarm_creates_alarm(hass: HomeAssistant) -> None:
    """AuroraSetAlarm with a valid time creates an alarm and confirms."""
    await _setup(hass)
    resp = await _handle(hass, INTENT_SET_ALARM, {"time": {"value": "07:30"}})
    speech = _speech(resp)
    assert "07:30" in speech
    assert speech != _RESPONSES["en"]["bad_time"]

    # Let the coordinator rearm and entities publish before asserting state.
    await hass.async_block_till_done()

    # Confirm the alarm was actually created: next_alarm sensor leaves "unknown".
    state = hass.states.get("sensor.aurora_next_alarm")
    assert state is not None
    assert state.state not in ("unknown", "unavailable")


async def test_set_alarm_bad_time(hass: HomeAssistant) -> None:
    """AuroraSetAlarm with an unparseable time slot returns 'bad_time' speech."""
    await _setup(hass)
    resp = await _handle(hass, INTENT_SET_ALARM, {"time": {"value": "not-a-time"}})
    assert _speech(resp) == _RESPONSES["en"]["bad_time"]


async def test_set_alarm_italian_confirmation(hass: HomeAssistant) -> None:
    """AuroraSetAlarm returns Italian confirmation when lang=it."""
    await _setup(hass)
    hass.config.language = "it"
    resp = await _handle(hass, INTENT_SET_ALARM, {"time": {"value": "06:45"}})
    speech = _speech(resp)
    assert "06:45" in speech
    # Italian template: "Sveglia impostata per le {time}."
    assert "Sveglia" in speech


async def test_set_alarm_bad_time_italian(hass: HomeAssistant) -> None:
    """AuroraSetAlarm with bad time returns Italian 'bad_time' when lang=it."""
    await _setup(hass)
    hass.config.language = "it"
    resp = await _handle(hass, INTENT_SET_ALARM, {"time": {"value": "xyz"}})
    assert _speech(resp) == _RESPONSES["it"]["bad_time"]


# ---------------------------------------------------------------------------
# AuroraSnooze / AuroraDismiss — while ringing
# ---------------------------------------------------------------------------


async def test_snooze_while_ringing(hass: HomeAssistant) -> None:
    """AuroraSnooze while an alarm is ringing returns the 'snoozed' speech."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:00", "label": "Test"}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()

    assert hass.states.get("binary_sensor.aurora_ringing").state == "on"

    resp = await _handle(hass, INTENT_SNOOZE)
    assert _speech(resp) == _RESPONSES["en"]["snoozed"]

    # State machine moves to snoozed.
    await hass.async_block_till_done()
    assert hass.states.get("sensor.aurora_state").state == "snoozed"


async def test_dismiss_while_ringing(hass: HomeAssistant) -> None:
    """AuroraDismiss while an alarm is ringing returns the 'dismissed' speech."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:00", "label": "Test"}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()

    assert hass.states.get("binary_sensor.aurora_ringing").state == "on"

    resp = await _handle(hass, INTENT_DISMISS)
    assert _speech(resp) == _RESPONSES["en"]["dismissed"]

    await hass.async_block_till_done()
    assert hass.states.get("binary_sensor.aurora_ringing").state == "off"
    assert hass.states.get("sensor.aurora_state").state == "idle"


async def test_snooze_italian(hass: HomeAssistant) -> None:
    """AuroraSnooze returns Italian speech when lang=it."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:00", "label": "Test"}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()

    hass.config.language = "it"
    resp = await _handle(hass, INTENT_SNOOZE)
    assert _speech(resp) == _RESPONSES["it"]["snoozed"]


async def test_dismiss_italian(hass: HomeAssistant) -> None:
    """AuroraDismiss returns Italian speech when lang=it."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:00", "label": "Test"}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()

    hass.config.language = "it"
    resp = await _handle(hass, INTENT_DISMISS)
    assert _speech(resp) == _RESPONSES["it"]["dismissed"]


async def test_snooze_not_ready(hass: HomeAssistant) -> None:
    """AuroraSnooze with no loaded entry uses the 'not_ready' response path."""
    from homeassistant.helpers.typing import ConfigType

    from custom_components.aurora import async_setup

    await async_setup(hass, ConfigType())
    await hass.async_block_till_done()

    resp = await _handle(hass, INTENT_SNOOZE)
    assert _speech(resp) == _RESPONSES["en"]["not_ready"]


async def test_dismiss_not_ready(hass: HomeAssistant) -> None:
    """AuroraDismiss with no loaded entry uses the 'not_ready' response path."""
    from homeassistant.helpers.typing import ConfigType

    from custom_components.aurora import async_setup

    await async_setup(hass, ConfigType())
    await hass.async_block_till_done()

    resp = await _handle(hass, INTENT_DISMISS)
    assert _speech(resp) == _RESPONSES["en"]["not_ready"]


# ---------------------------------------------------------------------------
# AuroraSkipNext
# ---------------------------------------------------------------------------


async def test_skip_next_with_alarm(hass: HomeAssistant) -> None:
    """AuroraSkipNext with a scheduled alarm sets skip_next and confirms."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:00", "label": "Test"}, blocking=True
    )
    await hass.async_block_till_done()

    resp = await _handle(hass, INTENT_SKIP_NEXT)
    assert _speech(resp) == _RESPONSES["en"]["skipped"]


async def test_skip_next_no_alarm(hass: HomeAssistant) -> None:
    """AuroraSkipNext with no alarm returns the 'no_alarm' speech."""
    await _setup(hass)
    resp = await _handle(hass, INTENT_SKIP_NEXT)
    assert _speech(resp) == _RESPONSES["en"]["no_alarm"]


async def test_skip_next_italian(hass: HomeAssistant) -> None:
    """AuroraSkipNext returns Italian 'skipped' speech when lang=it."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_ALARM, {"time": "07:00", "label": "Test"}, blocking=True
    )
    await hass.async_block_till_done()

    hass.config.language = "it"
    resp = await _handle(hass, INTENT_SKIP_NEXT)
    assert _speech(resp) == _RESPONSES["it"]["skipped"]


async def test_skip_next_no_alarm_italian(hass: HomeAssistant) -> None:
    """AuroraSkipNext with no alarm returns Italian 'no_alarm' when lang=it."""
    await _setup(hass)
    hass.config.language = "it"
    resp = await _handle(hass, INTENT_SKIP_NEXT)
    assert _speech(resp) == _RESPONSES["it"]["no_alarm"]
