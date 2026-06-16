"""Assist (voice) intents for Aurora.

Registered at domain setup. With an LLM-based Assist pipeline these handlers are
exposed automatically (the ``description`` becomes the tool hint). Sentence-based
Assist users can map phrases to them via ``config/custom_sentences`` (see the
README). Responses are localized from the active Home Assistant language.
"""

import logging
from typing import ClassVar

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import intent
from homeassistant.util import dt as dt_util
import voluptuous as vol

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

INTENT_SNOOZE = "AuroraSnooze"
INTENT_DISMISS = "AuroraDismiss"
INTENT_SKIP_NEXT = "AuroraSkipNext"
INTENT_NEXT_ALARM = "AuroraNextAlarm"
INTENT_SET_ALARM = "AuroraSetAlarm"

# Localized spoken responses. English is the default/fallback.
_RESPONSES: dict[str, dict[str, str]] = {
    "en": {
        "snoozed": "Alarm snoozed.",
        "dismissed": "Alarm stopped.",
        "skipped": "Your next alarm will be skipped.",
        "no_alarm": "There is no alarm scheduled.",
        "next_alarm": "Your next alarm is at {time}.",
        "set_alarm": "Alarm set for {time}.",
        "bad_time": "Sorry, I didn't catch a valid time.",
        "not_ready": "Aurora is not ready yet.",
    },
    "it": {
        "snoozed": "Sveglia posticipata.",
        "dismissed": "Sveglia fermata.",
        "skipped": "La prossima sveglia verrà saltata.",
        "no_alarm": "Non c'è nessuna sveglia programmata.",
        "next_alarm": "La tua prossima sveglia è alle {time}.",
        "set_alarm": "Sveglia impostata per le {time}.",
        "bad_time": "Scusa, non ho capito un orario valido.",
        "not_ready": "Aurora non è ancora pronta.",
    },
}


def _say(hass: HomeAssistant, key: str, **vars: str) -> str:
    """Localized response text for the active HA language (English fallback)."""
    lang = (hass.config.language or "en").lower()
    pack = (
        _RESPONSES.get(lang) or _RESPONSES.get(lang.split("-")[0]) or _RESPONSES["en"]
    )
    return pack.get(key, _RESPONSES["en"][key]).format(**vars)


def _coordinator(hass: HomeAssistant):
    """Return the loaded installation's coordinator, or None."""
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data.coordinator
    return None


class _RingControlIntent(intent.IntentHandler):
    """Base for parameterless ring-control intents."""

    _response_key = ""

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Run the coordinator action and speak a confirmation."""
        hass = intent_obj.hass
        coordinator = _coordinator(hass)
        response = intent_obj.create_response()
        if coordinator is None:
            response.async_set_speech(_say(hass, "not_ready"))
            return response
        await self._run(coordinator)
        response.async_set_speech(_say(hass, self._response_key))
        return response

    async def _run(self, coordinator) -> None:
        raise NotImplementedError


class SnoozeIntent(_RingControlIntent):
    """Snooze the active ring."""

    intent_type = INTENT_SNOOZE
    description = "Snooze the currently ringing Aurora alarm"
    _response_key = "snoozed"

    async def _run(self, coordinator) -> None:
        await coordinator.async_snooze()


class DismissIntent(_RingControlIntent):
    """Stop the active ring."""

    intent_type = INTENT_DISMISS
    description = "Stop or dismiss the currently ringing Aurora alarm"
    _response_key = "dismissed"

    async def _run(self, coordinator) -> None:
        await coordinator.async_dismiss()


class SkipNextIntent(intent.IntentHandler):
    """Skip the next occurrence of the upcoming alarm."""

    intent_type = INTENT_SKIP_NEXT
    description = "Skip the next occurrence of the upcoming Aurora alarm"

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Mark the next alarm to skip once."""
        hass = intent_obj.hass
        coordinator = _coordinator(hass)
        response = intent_obj.create_response()
        nxt = coordinator.data.next_alarm if coordinator else None
        if nxt is None:
            response.async_set_speech(_say(hass, "no_alarm"))
            return response
        try:
            await hass.data[DOMAIN].async_update_item(nxt.alarm_id, {"skip_next": True})
            response.async_set_speech(_say(hass, "skipped"))
        except Exception:
            _LOGGER.warning("Aurora intent: skip_next failed", exc_info=True)
            response.async_set_speech(_say(hass, "not_ready"))
        return response


class NextAlarmIntent(intent.IntentHandler):
    """Answer when the next alarm is."""

    intent_type = INTENT_NEXT_ALARM
    description = "Tell the user when their next Aurora alarm is"

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Speak the next alarm's local time."""
        hass = intent_obj.hass
        coordinator = _coordinator(hass)
        response = intent_obj.create_response()
        nxt = coordinator.data.next_alarm if coordinator else None
        if nxt is None:
            response.async_set_speech(_say(hass, "no_alarm"))
            return response
        local = dt_util.as_local(nxt.fire_at_utc)
        response.async_set_speech(
            _say(hass, "next_alarm", time=local.strftime("%H:%M"))
        )
        return response


class SetAlarmIntent(intent.IntentHandler):
    """Create an alarm at a spoken time."""

    intent_type = INTENT_SET_ALARM
    description = "Create a new Aurora alarm at a given time"
    slot_schema: ClassVar[dict] = {vol.Required("time"): cv.string}

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Parse the time slot and create a daily alarm."""
        hass = intent_obj.hass
        response = intent_obj.create_response()
        slots = self.async_validate_slots(intent_obj.slots)
        parsed = dt_util.parse_time(slots["time"]["value"])
        if parsed is None:
            response.async_set_speech(_say(hass, "bad_time"))
            return response
        hhmm = parsed.strftime("%H:%M")
        try:
            await hass.data[DOMAIN].async_create_item({"time": hhmm})
            response.async_set_speech(_say(hass, "set_alarm", time=hhmm))
        except Exception:
            _LOGGER.warning("Aurora intent: set_alarm failed", exc_info=True)
            response.async_set_speech(_say(hass, "not_ready"))
        return response


@callback
def async_setup_intents(hass: HomeAssistant) -> None:
    """Register all Aurora Assist intents (idempotent at domain setup)."""
    for handler in (
        SnoozeIntent(),
        DismissIntent(),
        SkipNextIntent(),
        NextAlarmIntent(),
        SetAlarmIntent(),
    ):
        intent.async_register(hass, handler)
