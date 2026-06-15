"""Config, options, reconfigure and alarm-subentry flows for Aurora.

Design notes:
- ``single_config_entry`` is true: there is exactly one Aurora installation. Per-
  person modelling is an ``owner`` field on each alarm (see docs/DECISIONS.md §0).
- The alarm **subentry flow is a thin "Add alarm" entry point that delegates to
  the collection** (the single source of truth), avoiding the dual-source risk
  (Risk #2). Per-alarm edit/remove happens via the card/services/collection.
- Optional fields use ``suggested_value`` (never ``default=``) and empties are
  stripped before persisting, so any role can be left unbound without an error.
"""

import logging
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryFlow,
    OptionsFlowWithReload,
    SubentryFlowResult,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_HOLIDAY_CALENDARS,
    CONF_OWNER,
    CONF_RING_MAX_DURATION,
    CONF_SKIP_CALENDARS,
    DEFAULT_RING_MAX_DURATION,
    DOMAIN,
    ROLE_AUDIO_SINK,
    ROLE_CONVERSATION,
    ROLE_DISPLAY_SURFACE,
    ROLE_NOTIFY_CHANNEL,
    ROLE_PRESENCE_SIGNAL,
    ROLE_SLEEP_SIGNAL,
    ROLE_TTS,
    ROLE_WAKE_LIGHT,
    SUBENTRY_TYPE_ALARM,
)
from .models import MissionType, RepeatMode
from .storage import AlarmStorageCollection

_LOGGER = logging.getLogger(__name__)

_WEEKDAY_OPTIONS = [
    selector.SelectOptionDict(value="0", label="Monday"),
    selector.SelectOptionDict(value="1", label="Tuesday"),
    selector.SelectOptionDict(value="2", label="Wednesday"),
    selector.SelectOptionDict(value="3", label="Thursday"),
    selector.SelectOptionDict(value="4", label="Friday"),
    selector.SelectOptionDict(value="5", label="Saturday"),
    selector.SelectOptionDict(value="6", label="Sunday"),
]


def _entity_binding(domains: list[str], *, multiple: bool = False) -> selector.Selector:
    """An optional EntitySelector filtered to ``domains``."""
    return selector.EntitySelector(
        selector.EntitySelectorConfig(domain=domains, multiple=multiple)
    )


def _role_binding_schema() -> vol.Schema:
    """The options schema binding abstract roles to optional entities."""
    return vol.Schema(
        {
            vol.Optional(ROLE_AUDIO_SINK): _entity_binding(["media_player"]),
            vol.Optional(ROLE_WAKE_LIGHT): _entity_binding(["light", "number"]),
            vol.Optional(ROLE_DISPLAY_SURFACE): _entity_binding(
                ["media_player", "switch", "light"]
            ),
            vol.Optional(ROLE_NOTIFY_CHANNEL): _entity_binding(
                ["notify"], multiple=True
            ),
            vol.Optional(ROLE_SLEEP_SIGNAL): _entity_binding(
                ["binary_sensor", "sensor"], multiple=True
            ),
            vol.Optional(ROLE_PRESENCE_SIGNAL): _entity_binding(
                ["binary_sensor", "sensor"], multiple=True
            ),
            vol.Optional(ROLE_CONVERSATION): _entity_binding(["conversation"]),
            vol.Optional(ROLE_TTS): _entity_binding(["tts"]),
            vol.Optional(CONF_SKIP_CALENDARS): _entity_binding(
                ["calendar"], multiple=True
            ),
            vol.Optional(CONF_HOLIDAY_CALENDARS): _entity_binding(
                ["calendar"], multiple=True
            ),
            vol.Optional(
                CONF_RING_MAX_DURATION, default=DEFAULT_RING_MAX_DURATION
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=60, max=3600, step=30, unit_of_measurement="s"
                )
            ),
        }
    )


def _strip_empty(data: dict[str, Any]) -> dict[str, Any]:
    """Drop keys whose value is empty so optional bindings can be cleared."""
    return {k: v for k, v in data.items() if v not in ("", None, [])}


class AuroraConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the single Aurora installation config entry."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """One-click install. All configuration happens in the Aurora app."""
        return self.async_create_entry(title="Aurora", data={})

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Reconfigure top-level installation data."""
        entry = self._get_reconfigure_entry()
        if user_input is not None:
            return self.async_update_reload_and_abort(
                entry, data_updates=_strip_empty(user_input)
            )
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self.add_suggested_values_to_schema(
                vol.Schema({vol.Optional(CONF_OWNER): selector.TextSelector()}),
                entry.data,
            ),
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: Any) -> "AuroraOptionsFlow":
        """Return the options flow (role bindings + globals)."""
        return AuroraOptionsFlow()

    @classmethod
    @callback
    def async_get_supported_subentry_types(
        cls, config_entry: Any
    ) -> dict[str, type[ConfigSubentryFlow]]:
        """Expose the alarm subentry flow as an 'Add alarm' entry point."""
        return {SUBENTRY_TYPE_ALARM: AuroraAlarmSubentryFlowHandler}


class AuroraOptionsFlow(OptionsFlowWithReload):
    """Bind abstract roles to (optional) entities; reloads on save."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show and persist the role bindings."""
        if user_input is not None:
            return self.async_create_entry(data=_strip_empty(user_input))
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                _role_binding_schema(), self.config_entry.options
            ),
        )


class AuroraAlarmSubentryFlowHandler(ConfigSubentryFlow):
    """Add an alarm. Delegates to the collection (the single source of truth)."""

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        """Collect alarm basics and create it in the alarm collection."""
        if user_input is not None:
            alarms: AlarmStorageCollection = self.hass.data[DOMAIN]
            await alarms.async_create_item(_build_alarm_payload(user_input))
            return self.async_abort(reason="alarm_created")

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("time"): selector.TimeSelector(),
                    vol.Optional("label", default=""): selector.TextSelector(),
                    vol.Optional(
                        "repeat_mode", default=RepeatMode.DAILY.value
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=[m.value for m in RepeatMode],
                            translation_key="repeat_mode",
                        )
                    ),
                    vol.Optional("weekdays", default=[]): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=_WEEKDAY_OPTIONS, multiple=True
                        )
                    ),
                    vol.Optional(
                        "mission", default=MissionType.TAP.value
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=[m.value for m in MissionType],
                            translation_key="mission",
                        )
                    ),
                }
            ),
        )


def _build_alarm_payload(user_input: dict[str, Any]) -> dict[str, Any]:
    """Translate the subentry form into a collection create payload."""
    return {
        "time": user_input["time"],
        "label": user_input.get("label", ""),
        "schedule": {
            "repeat_mode": user_input.get("repeat_mode", RepeatMode.DAILY.value),
            "weekdays": [int(d) for d in user_input.get("weekdays", [])],
        },
        "features": {"mission": {"type": user_input.get("mission", MissionType.TAP.value)}},
    }
