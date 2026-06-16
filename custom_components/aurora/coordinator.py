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
from datetime import date, datetime, timedelta
from enum import StrEnum

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_CORE_CONFIG_UPDATE
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import (
    async_call_later,
    async_track_point_in_utc_time,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import (
    CONF_HOLIDAY_CALENDARS,
    CONF_PROFILE_BINDINGS,
    CONF_PROFILES,
    CONF_RING_MAX_DURATION,
    CONF_SKIP_CALENDARS,
    DEFAULT_RING_MAX_DURATION,
    DEFAULT_SMART_WINDOW_MIN,
    DOMAIN,
    ROLE_PRESENCE_SIGNAL,
    ROLE_SLEEP_SIGNAL,
)
from .models import AuroraAlarm
from .ring import RingController
from .scheduler import next_occurrence
from .sleep import SleepFusion, fuse, interpret_signal
from .storage import AlarmStorageCollection

_PREWAKE_EVAL_INTERVAL = timedelta(minutes=5)
_SKIP_LOOKAHEAD_DAYS = 21

_LOGGER = logging.getLogger(__name__)


def _coerce_event_value(value: object) -> str | None:
    """Normalise a calendar event start/end to a string (handles dict forms)."""
    if isinstance(value, dict):
        value = value.get("dateTime") or value.get("date")
    return str(value) if value else None


def _to_date(text: str | None) -> date | None:
    """Parse an all-day (YYYY-MM-DD) or timed (ISO) value into a date."""
    if not text:
        return None
    try:
        if len(text) == 10:
            return date.fromisoformat(text)
        parsed = dt_util.parse_datetime(text)
        return parsed.date() if parsed else None
    except (ValueError, AttributeError):
        return None


def _event_dates(event: dict[str, object]) -> set[date]:
    """Return the set of local dates a calendar event covers (best-effort)."""
    start_raw = _coerce_event_value(event.get("start"))
    start = _to_date(start_raw)
    if start is None:
        return set()
    end = _to_date(_coerce_event_value(event.get("end"))) or start
    all_day = start_raw is not None and len(start_raw) == 10
    last = end - timedelta(days=1) if (all_day and end > start) else end
    if last < start:
        last = start
    days: set[date] = set()
    cur = start
    for _ in range(_SKIP_LOOKAHEAD_DAYS + 2):
        days.add(cur)
        if cur >= last:
            break
        cur += timedelta(days=1)
    return days


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
        self._unsub_prewake_start: CALLBACK_TYPE | None = None
        self._unsub_prewake_eval: CALLBACK_TYPE | None = None
        self._fusion: SleepFusion | None = None
        self._prewake_alarm_id: str | None = None
        self._skip_dates: set[date] = set()
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
        # Refresh calendar skip-dates daily (cheap, off the alarm critical path).
        self._unsub_listeners.append(
            async_track_time_change(
                self.hass, self._handle_daily_refresh, hour=3, minute=30, second=0
            )
        )
        self.config_entry.async_on_unload(self.async_shutdown_timer)
        # Initial skip-date load also performs the first arm.
        await self._async_refresh_skip_dates()

    @callback
    def _handle_daily_refresh(self, _now: datetime) -> None:
        """Daily: re-read calendars for skip/holiday dates."""
        self.config_entry.async_create_task(
            self.hass, self._async_refresh_skip_dates(), "aurora_skip_refresh"
        )

    async def _async_refresh_skip_dates(self) -> None:
        """Read configured skip/holiday calendars into a set of dates, then arm."""
        options = dict(self.config_entry.options)
        calendars = [
            *(options.get(CONF_SKIP_CALENDARS) or []),
            *(options.get(CONF_HOLIDAY_CALENDARS) or []),
        ]
        dates: set[date] = set()
        if calendars:
            now = dt_util.now()
            end = now + timedelta(days=_SKIP_LOOKAHEAD_DAYS)
            try:
                response = await self.hass.services.async_call(
                    "calendar",
                    "get_events",
                    {
                        "entity_id": calendars,
                        "start_date_time": now.isoformat(),
                        "end_date_time": end.isoformat(),
                    },
                    blocking=True,
                    return_response=True,
                )
            except Exception:  # noqa: BLE001 - calendars are best-effort
                _LOGGER.warning("Aurora: could not read skip calendars", exc_info=True)
                response = None
            for cal in (response or {}).values():
                if not isinstance(cal, dict):
                    continue
                for event in cal.get("events", []):
                    dates |= _event_dates(event)
        self._skip_dates = dates
        self._rearm()

    @callback
    def async_shutdown_timer(self) -> None:
        """Cancel the pending timer, ring timers and all listeners."""
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        self._cancel_ring_timers()
        self._cancel_prewake()
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
        self._cancel_prewake()

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
            self._maybe_schedule_prewake()
        self._publish()

    @callback
    def _handle_fire(self, _now: datetime) -> None:
        """Timer fired → start the ring for the due alarm, then re-arm the next."""
        self._cancel_prewake()
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
            fire_local = next_occurrence(alarm, now_local, tz, self._skip_dates)
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

    # --- Sleep-aware pre-wake -----------------------------------------------

    @callback
    def _cancel_prewake(self) -> None:
        """Cancel any pending pre-wake start timer and evaluation loop."""
        if self._unsub_prewake_start is not None:
            self._unsub_prewake_start()
            self._unsub_prewake_start = None
        if self._unsub_prewake_eval is not None:
            self._unsub_prewake_eval()
            self._unsub_prewake_eval = None
        self._fusion = None
        self._prewake_alarm_id = None

    @callback
    def _resolve_signals(self, alarm: AuroraAlarm) -> list[str]:
        """Signals to fuse: the alarm's own list, else the profile sleep/presence."""
        signals = list(alarm.features.smart_window.signals)
        if signals:
            return signals
        options = self._effective_options(alarm)
        for role in (ROLE_SLEEP_SIGNAL, ROLE_PRESENCE_SIGNAL):
            value = options.get(role)
            if isinstance(value, str):
                signals.append(value)
            elif isinstance(value, list):
                signals.extend(str(v) for v in value)
        return signals

    @callback
    def _maybe_schedule_prewake(self) -> None:
        """If the next alarm is sleep-aware, arm the early-wake evaluation."""
        if self._next is None:
            return
        alarm = self._get_alarm(self._next.alarm_id)
        if alarm is None or not alarm.features.smart_window.enabled:
            return
        if not self._resolve_signals(alarm):
            return
        minutes = alarm.features.smart_window.minutes or DEFAULT_SMART_WINDOW_MIN
        start_at = self._next.fire_at_utc - timedelta(minutes=minutes)
        self._prewake_alarm_id = alarm.id
        if start_at <= dt_util.utcnow():
            self._start_prewake()
        else:
            self._unsub_prewake_start = async_track_point_in_utc_time(
                self.hass, lambda _now: self._start_prewake(), start_at
            )

    @callback
    def _start_prewake(self) -> None:
        """Enter the pre-wake window and begin evaluating sleep signals."""
        self._unsub_prewake_start = None
        self._state = AuroraState.PRE_WAKE
        self._fusion = SleepFusion()
        self._publish()
        self._evaluate_prewake(None)
        self._unsub_prewake_eval = async_track_time_interval(
            self.hass, self._evaluate_prewake, _PREWAKE_EVAL_INTERVAL
        )

    @callback
    def _evaluate_prewake(self, _now: datetime | None) -> None:
        """Sample the signals; ring early once the fusion says you're stirring."""
        if self._fusion is None or self._prewake_alarm_id is None:
            return
        alarm = self._get_alarm(self._prewake_alarm_id)
        if alarm is None:
            self._cancel_prewake()
            return
        scores = []
        for entity_id in self._resolve_signals(alarm):
            state = self.hass.states.get(entity_id)
            if state is None:
                continue
            scores.append(
                interpret_signal(entity_id.partition(".")[0], state.state, state.attributes)
            )
        if self._fusion.add(fuse(scores)):
            _LOGGER.info("Aurora smart-wake: early wake for '%s'", alarm.id)
            if self._unsub_timer is not None:
                self._unsub_timer()
                self._unsub_timer = None
            self._cancel_prewake()
            self._snooze_count = 0
            self._begin_ring(alarm)
            self._rearm()

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
