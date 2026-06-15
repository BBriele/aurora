"""Aurora runtime: the scheduler + alarm state machine.

The coordinator is **push-driven** (no polling): it arms a single timer for the
nearest upcoming alarm across the whole collection, fires the state machine, and
re-arms. Times are computed in local wall-clock, converted **once** to UTC and
scheduled with ``async_track_point_in_utc_time`` so DST transitions and HA
timezone changes never drop an alarm (see docs/DECISIONS.md §B.7).

Phase 0 scope: real next-occurrence computation + DST-safe arming + state
transitions. Output roles (audio/light/notify) are wired in Phase 1; here the
fire handler only advances the state machine and logs.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_CORE_CONFIG_UPDATE
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_call_later, async_track_point_in_utc_time
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import (
    CONF_PROFILE_BINDINGS,
    CONF_PROFILES,
    CONF_RING_MAX_DURATION,
    DEFAULT_RING_MAX_DURATION,
    DOMAIN,
)
from .models import AuroraAlarm
from .ring import RingController
from .scheduler import next_occurrence
from .storage import AlarmStorageCollection

_LOGGER = logging.getLogger(__name__)


class AuroraState(StrEnum):
    """The alarm lifecycle state machine."""

    IDLE = "idle"
    PRE_WAKE = "pre_wake"
    RINGING = "ringing"
    SNOOZED = "snoozed"
    MISSION = "mission"
    DISMISSED = "dismissed"
    POST_WAKE = "post_wake"


@dataclass(slots=True)
class NextAlarm:
    """The computed nearest upcoming alarm."""

    alarm_id: str
    label: str
    owner: str | None
    fire_at_utc: datetime

    def as_dict(self) -> dict[str, object]:
        """Serialise for entity attributes / the card."""
        return {
            "alarm_id": self.alarm_id,
            "label": self.label,
            "owner": self.owner,
            "fire_at": self.fire_at_utc.isoformat(),
        }


@dataclass(slots=True)
class AuroraCoordinatorData:
    """Read-model snapshot consumed by entities and the card."""

    state: AuroraState
    next_alarm: NextAlarm | None
    active_alarm_id: str | None = None


@dataclass(slots=True)
class AuroraRuntimeData:
    """Per-entry runtime data, stored on ``entry.runtime_data``."""

    coordinator: "AuroraCoordinator"


type AuroraConfigEntry = ConfigEntry[AuroraRuntimeData]


class AuroraCoordinator(DataUpdateCoordinator[AuroraCoordinatorData]):
    """Owns the alarm timer and the state machine for one installation."""

    config_entry: AuroraConfigEntry

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: AuroraConfigEntry,
        alarms: AlarmStorageCollection,
    ) -> None:
        """Initialise the push coordinator (no polling interval)."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            config_entry=config_entry,
            update_interval=None,
            always_update=False,
        )
        self.alarms = alarms
        self._state: AuroraState = AuroraState.IDLE
        self._active_alarm_id: str | None = None
        self._active_alarm: AuroraAlarm | None = None
        self._snooze_count: int = 0
        self._next: NextAlarm | None = None
        self._unsub_timer: CALLBACK_TYPE | None = None
        self._unsub_watchdog: CALLBACK_TYPE | None = None
        self._unsub_snooze: CALLBACK_TYPE | None = None
        self._unsub_listeners: list[CALLBACK_TYPE] = []
        self._ring = RingController(hass)

    # --- Lifecycle ----------------------------------------------------------

    async def async_setup(self) -> None:
        """Wire listeners and arm the first timer. Call from async_setup_entry."""
        # Re-arm whenever the alarm collection changes.
        self._unsub_listeners.append(
            self.alarms.async_add_change_set_listener(self._handle_collection_change)
        )
        # Re-arm on HA timezone / core config changes.
        self._unsub_listeners.append(
            self.hass.bus.async_listen(
                EVENT_CORE_CONFIG_UPDATE, self._handle_core_config_update
            )
        )
        self.config_entry.async_on_unload(self.async_shutdown_timer)
        self._rearm()

    @callback
    def async_shutdown_timer(self) -> None:
        """Cancel the pending timer, ring timers and all listeners."""
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        self._cancel_ring_timers()
        while self._unsub_listeners:
            self._unsub_listeners.pop()()

    @callback
    def _cancel_ring_timers(self) -> None:
        """Cancel the ring watchdog and any pending snooze re-ring."""
        if self._unsub_watchdog is not None:
            self._unsub_watchdog()
            self._unsub_watchdog = None
        if self._unsub_snooze is not None:
            self._unsub_snooze()
            self._unsub_snooze = None

    @callback
    def _get_alarm(self, alarm_id: str) -> AuroraAlarm | None:
        """Return the typed alarm with ``alarm_id``, or None if absent/invalid."""
        raw = self.alarms.data.get(alarm_id)
        if raw is None:
            return None
        try:
            return AuroraAlarm.from_dict(raw)
        except ValueError:
            return None

    async def _async_update_data(self) -> AuroraCoordinatorData:
        """Return the current snapshot (push coordinator: no I/O)."""
        return AuroraCoordinatorData(
            state=self._state,
            next_alarm=self._next,
            active_alarm_id=self._active_alarm_id,
        )

    @callback
    def _publish(self) -> None:
        """Push the latest snapshot to listeners/entities."""
        self.async_set_updated_data(
            AuroraCoordinatorData(
                state=self._state,
                next_alarm=self._next,
                active_alarm_id=self._active_alarm_id,
            )
        )

    # --- Event handlers -----------------------------------------------------

    async def _handle_collection_change(self, change_set: object) -> None:
        """Alarm definitions changed → recompute the next timer."""
        self._rearm()

    @callback
    def _handle_core_config_update(self, event: Event) -> None:
        """HA timezone (or other core config) changed → recompute in new tz."""
        self._rearm()

    # --- Scheduler ----------------------------------------------------------

    @callback
    def _rearm(self) -> None:
        """Compute the nearest alarm and (re)arm a single UTC timer."""
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None

        self._next = self._compute_next_alarm()
        if self._next is not None:
            self._unsub_timer = async_track_point_in_utc_time(
                self.hass, self._handle_fire, self._next.fire_at_utc
            )
            _LOGGER.debug(
                "Next Aurora alarm %s at %s (UTC)",
                self._next.alarm_id,
                self._next.fire_at_utc.isoformat(),
            )
        self._publish()

    @callback
    def _handle_fire(self, _now: datetime) -> None:
        """Timer fired → start the ring for the due alarm, then re-arm the next."""
        fired = self._next
        if fired is None:
            self._rearm()
            return
        alarm = self._get_alarm(fired.alarm_id)
        if alarm is not None:
            self._snooze_count = 0
            self._begin_ring(alarm)
        self._rearm()  # arm the following occurrence

    @callback
    def _compute_next_alarm(self) -> NextAlarm | None:
        """Find the soonest upcoming occurrence across all enabled alarms."""
        now_local = dt_util.now()
        tz = dt_util.get_default_time_zone()
        best: NextAlarm | None = None
        for raw in self.alarms.async_items():
            try:
                alarm = AuroraAlarm.from_dict(raw)
            except ValueError:
                _LOGGER.warning("Skipping malformed alarm: %s", raw.get("id"))
                continue
            if not alarm.enabled:
                continue
            fire_local = next_occurrence(alarm, now_local, tz)
            if fire_local is None:
                continue
            fire_utc = dt_util.as_utc(fire_local)
            if best is None or fire_utc < best.fire_at_utc:
                best = NextAlarm(
                    alarm_id=alarm.id,
                    label=alarm.label,
                    owner=alarm.owner,
                    fire_at_utc=fire_utc,
                )
        return best

    # --- Ring lifecycle / state machine -------------------------------------

    @callback
    def _effective_options(self, alarm: AuroraAlarm) -> dict[str, object]:
        """Role bindings for ``alarm``: its owner-profile bindings over globals."""
        options: dict[str, object] = dict(self.config_entry.options)
        profiles = options.get(CONF_PROFILES) or {}
        profile = profiles.get(alarm.profile_id or "") if isinstance(profiles, dict) else None
        if isinstance(profile, dict):
            bindings = profile.get(CONF_PROFILE_BINDINGS)
            if isinstance(bindings, dict):
                options.update(bindings)
        return options

    @callback
    def _begin_ring(self, alarm: AuroraAlarm) -> None:
        """Enter RINGING for ``alarm``, start its outputs and arm the watchdog."""
        self._cancel_ring_timers()
        self._active_alarm = alarm
        self._active_alarm_id = alarm.id
        self._state = AuroraState.RINGING
        options = self._effective_options(alarm)
        self.config_entry.async_create_task(
            self.hass,
            self._ring.async_start(alarm, options),
            "aurora_ring_start",
        )
        max_duration = float(
            self.config_entry.options.get(
                CONF_RING_MAX_DURATION, DEFAULT_RING_MAX_DURATION
            )
        )
        self._unsub_watchdog = async_call_later(
            self.hass, max_duration, self._on_watchdog
        )
        _LOGGER.info("Aurora alarm '%s' is ringing", alarm.id)
        self._publish()

    @callback
    def _on_watchdog(self, _now: datetime) -> None:
        """Safety auto-stop if a ring runs past its maximum duration."""
        self._unsub_watchdog = None
        self.hass.async_create_task(self.async_dismiss())

    @callback
    def _on_snooze_end(self, _now: datetime) -> None:
        """Re-ring after the snooze window elapses."""
        self._unsub_snooze = None
        if self._active_alarm is not None:
            self._begin_ring(self._active_alarm)

    @callback
    def _first_enabled_alarm(self) -> AuroraAlarm | None:
        """Return the first enabled alarm, or None."""
        for raw in self.alarms.async_items():
            try:
                candidate = AuroraAlarm.from_dict(raw)
            except ValueError:
                continue
            if candidate.enabled:
                return candidate
        return None

    async def async_dismiss(self) -> None:
        """Stop the current ring and return to idle."""
        self._cancel_ring_timers()
        await self._ring.async_stop()
        self._active_alarm = None
        self._active_alarm_id = None
        self._snooze_count = 0
        self._state = AuroraState.IDLE
        self._publish()

    async def async_snooze(self) -> None:
        """Snooze the current ring and schedule a re-ring (respects the max)."""
        if self._state not in (AuroraState.RINGING, AuroraState.MISSION):
            return
        alarm = self._active_alarm
        if alarm is None:
            return
        if self._snooze_count >= alarm.features.snooze.max:
            _LOGGER.debug("Aurora: snooze limit reached for '%s'", alarm.id)
            return
        self._snooze_count += 1
        self._cancel_ring_timers()
        await self._ring.async_stop()
        self._state = AuroraState.SNOOZED
        self._unsub_snooze = async_call_later(
            self.hass, float(alarm.features.snooze.duration), self._on_snooze_end
        )
        self._publish()

    async def async_trigger_now(self, alarm_id: str | None = None) -> None:
        """Force a ring immediately for the given / next / first enabled alarm."""
        alarm: AuroraAlarm | None = None
        if alarm_id is not None:
            alarm = self._get_alarm(alarm_id)
        elif self._next is not None:
            alarm = self._get_alarm(self._next.alarm_id)
        if alarm is None:
            alarm = self._first_enabled_alarm()
        if alarm is None:
            raise HomeAssistantError("No alarm available to trigger")
        self._snooze_count = 0
        self._begin_ring(alarm)
