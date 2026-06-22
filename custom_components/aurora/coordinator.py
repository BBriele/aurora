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

import asyncio
import base64
import contextlib
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import StrEnum
import logging
import os
import time
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_CORE_CONFIG_UPDATE
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, TemplateError
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.event import (
    async_call_later,
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.helpers.storage import Store
from homeassistant.helpers.template import Template
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .briefing import (
    DEFAULT_BLOCKS,
    BriefingContext,
    WeatherFact,
    compose_briefing,
)
from .capabilities import get_llm_vision_providers
from .const import (
    ACTIVITY_MAX,
    CIRCUIT_FAILURE_THRESHOLD,
    CIRCUIT_RECOVERY_S,
    CONF_BRIEFING_CALENDARS,
    CONF_HOLIDAY_CALENDARS,
    CONF_POST_WAKE_ACTION,
    CONF_PROFILE_BINDINGS,
    CONF_PROFILE_NAME,
    CONF_PROFILES,
    CONF_RING_MAX_DURATION,
    CONF_SKIP_CALENDARS,
    CONF_TODO_LISTS,
    CONF_WEATHER,
    DEFAULT_RING_MAX_DURATION,
    DEFAULT_SMART_WINDOW_MIN,
    DOMAIN,
    LATENCY_WINDOW,
    PREWARM_LEAD_S,
    ROLE_AUDIO_SINK,
    ROLE_CONVERSATION,
    ROLE_PRESENCE_SIGNAL,
    ROLE_SLEEP_SIGNAL,
    ROLE_TTS,
    ROLE_VISION_PROVIDER,
    VISION_BACKOFF_BASE_S,
    VISION_BACKOFF_CAP_S,
    VISION_MAX_ATTEMPTS,
    VISION_TIMEOUT_S,
)
from .models import AuroraAlarm, MissionType
from .ring import RingController
from .scheduler import next_occurrence
from .sleep import SleepFusion, fuse, interpret_signal
from .storage import AlarmStorageCollection
from .vision import (
    DEFAULT_VISION_PROMPT,
    CircuitBreaker,
    LatencyWindow,
    parse_verdict,
)

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


def _first_entity(value: object) -> str | None:
    """Coerce a role binding (str | list | None) to a single entity_id."""
    if isinstance(value, str) and value:
        return value
    if isinstance(value, list) and value:
        first = value[0]
        return str(first) if first else None
    return None


def _as_entity_list(value: object) -> list[str]:
    """Coerce a binding (str | list | None) to a list of entity_ids."""
    if isinstance(value, str) and value:
        return [value]
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return []


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
    active_mission: dict[str, object] | None = None
    active_label: str | None = None
    active_color_temp_kelvin: int | None = None


@dataclass(slots=True)
class AuroraRuntimeData:
    """Per-entry runtime data, stored on ``entry.runtime_data``."""

    coordinator: AuroraCoordinator


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
        self._snooze_end_utc: datetime | None = None
        self._next: NextAlarm | None = None
        self._unsub_timer: CALLBACK_TYPE | None = None
        self._unsub_watchdog: CALLBACK_TYPE | None = None
        self._unsub_snooze: CALLBACK_TYPE | None = None
        self._unsub_mission: CALLBACK_TYPE | None = None
        self._unsub_prewake_start: CALLBACK_TYPE | None = None
        self._unsub_prewake_eval: CALLBACK_TYPE | None = None
        self._fusion: SleepFusion | None = None
        self._prewake_alarm_id: str | None = None
        self._warmed_alarm_id: str | None = None
        self._unsub_prewarm: CALLBACK_TYPE | None = None
        self._skip_dates: set[date] = set()
        self._unsub_listeners: list[CALLBACK_TYPE] = []
        self._ring = RingController(hass)
        self._briefing_lock = asyncio.Lock()
        self._vision_breaker = CircuitBreaker(
            CIRCUIT_FAILURE_THRESHOLD, CIRCUIT_RECOVERY_S
        )
        self._vision_latency = LatencyWindow(LATENCY_WINDOW)
        # Guards against re-entrant skip normalisation (each persist re-fires the
        # collection-change listener).
        self._normalizing = False
        # Crash-safe ring state so an HA restart mid-ring resumes the ring.
        self._ring_store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.ring_state")
        # Rolling human-readable activity log (how each alarm behaved) so even a
        # non-admin can see what happened — fed to the panel's Activity view.
        self._activity_store: Store[list[dict[str, Any]]] = Store(
            hass, 1, f"{DOMAIN}.activity"
        )
        self._activity: list[dict[str, Any]] = []

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
        # Initial skip-date load normalises skips and performs the first arm.
        await self._async_refresh_skip_dates()
        # Resume a ring that was interrupted by an HA restart.
        await self._async_restore_ring()
        # Load the persisted activity log (best effort).
        self._activity = await self._activity_store.async_load() or []
        self._async_check_issues()

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
            except Exception:
                _LOGGER.warning("Aurora: could not read skip calendars", exc_info=True)
                response = None
            for cal in (response or {}).values():
                if not isinstance(cal, dict):
                    continue
                for event in cal.get("events", []):
                    dates |= _event_dates(event)
        self._skip_dates = dates
        await self._async_normalize_skips()
        self._rearm()

    @callback
    def async_shutdown_timer(self) -> None:
        """Cancel the pending timer, ring timers and all listeners."""
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        self._cancel_ring_timers()
        self._cancel_mission_watch()
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

    # --- Physical (sensor) anti-snooze mission ------------------------------

    @callback
    def _cancel_mission_watch(self) -> None:
        """Stop watching the active alarm's physical mission sensor (if any)."""
        if self._unsub_mission is not None:
            self._unsub_mission()
            self._unsub_mission = None

    @callback
    def _setup_mission_watch(self, alarm: AuroraAlarm) -> None:
        """Watch a sensor-based mission so the physical act dismisses the alarm.

        The ``open_door`` mission is satisfied by opening the bound binary_sensor
        (an off→on transition) — no screen required. Screen-based missions
        (math/QR/shake/selfie) still need a DisplaySurface and are handled by the
        card overlay.
        """
        self._cancel_mission_watch()
        mission = alarm.features.mission
        if mission.type is not MissionType.OPEN_DOOR:
            return
        entity_id = mission.params.get("entity_id")
        if not isinstance(entity_id, str) or not entity_id:
            return
        self._unsub_mission = async_track_state_change_event(
            self.hass, [entity_id], self._on_mission_event
        )

    @callback
    def _on_mission_event(self, event: Event) -> None:
        """Dismiss the alarm on a fresh off→on transition of the door sensor."""
        if self._active_alarm is None:
            return
        new_state = event.data.get("new_state")
        old_state = event.data.get("old_state")
        if new_state is None or new_state.state != "on":
            return
        if old_state is not None and old_state.state == "on":
            return  # already open before the ring — require a real transition
        _LOGGER.info("Aurora: open-door mission satisfied; dismissing")
        self.config_entry.async_create_task(
            self.hass, self.async_dismiss(), "aurora_mission_dismiss"
        )

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

    @callback
    def _active_mission(self) -> dict[str, object] | None:
        """Return the ringing alarm's mission config (for the card overlay), if any."""
        if self._active_alarm is None:
            return None
        return self._active_alarm.features.mission.as_dict()

    @callback
    def _active_overlay(self) -> tuple[str | None, int | None]:
        """Return the ringing alarm's label + light colour for the display overlay."""
        if self._active_alarm is None:
            return (None, None)
        return (
            self._active_alarm.label or None,
            self._active_alarm.features.light.color_temp_kelvin,
        )

    async def _async_update_data(self) -> AuroraCoordinatorData:
        """Return the current snapshot (push coordinator: no I/O)."""
        active_label, active_color_temp_kelvin = self._active_overlay()
        return AuroraCoordinatorData(
            state=self._state,
            next_alarm=self._next,
            active_alarm_id=self._active_alarm_id,
            active_mission=self._active_mission(),
            active_label=active_label,
            active_color_temp_kelvin=active_color_temp_kelvin,
        )

    @callback
    def _publish(self) -> None:
        """Push the latest snapshot to listeners/entities."""
        active_label, active_color_temp_kelvin = self._active_overlay()
        self.async_set_updated_data(
            AuroraCoordinatorData(
                state=self._state,
                next_alarm=self._next,
                active_alarm_id=self._active_alarm_id,
                active_mission=self._active_mission(),
                active_label=active_label,
                active_color_temp_kelvin=active_color_temp_kelvin,
            )
        )

    # --- Event handlers -----------------------------------------------------

    async def _handle_collection_change(self, change_set: object) -> None:
        """Alarm definitions changed → recompute the next timer + repair issues."""
        await self._async_normalize_skips()
        self._rearm()
        self._async_check_issues()

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
            self._maybe_schedule_prewarm()
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
            if self._condition_passes(alarm):
                self._snooze_count = 0
                self._begin_ring(alarm)
            else:
                _LOGGER.info("Aurora: condition skipped alarm '%s'", alarm.id)
        self._rearm()  # arm the following occurrence

    @callback
    def _condition_passes(self, alarm: AuroraAlarm) -> bool:
        """Whether the alarm's optional fire-time condition allows ringing now.

        Renders the schedule's ``condition_template``; a falsey result skips this
        occurrence. An empty template or a render error fails open (rings) so a
        broken condition can never silently swallow an alarm.
        """
        template = alarm.schedule.condition_template
        if not template:
            return True
        try:
            result = Template(template, self.hass).async_render(parse_result=True)
        except (TemplateError, ValueError):
            _LOGGER.warning(
                "Aurora: condition template for '%s' failed; ringing anyway",
                alarm.id,
                exc_info=True,
            )
            return True
        if isinstance(result, str):
            return result.strip().lower() not in ("", "false", "none", "no", "off", "0")
        return bool(result)

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

    async def _async_normalize_skips(self) -> None:
        """Pin/clear each alarm's skip target so re-arms never double-skip.

        - skip_next set but no pinned date -> pin the next occurrence's date.
        - pinned date already in the past   -> the skip is consumed; clear both.
        - skip_next cleared but date lingers -> drop the stale pinned date.
        """
        if self._normalizing:
            return
        self._normalizing = True
        try:
            today = dt_util.now().date()
            tz = dt_util.get_default_time_zone()
            now_local = dt_util.now()
            for raw in list(self.alarms.async_items()):
                try:
                    alarm = AuroraAlarm.from_dict(raw)
                except ValueError:
                    continue
                updates: dict[str, Any] = {}
                if not alarm.skip_next:
                    if alarm.skip_date is not None:
                        updates["skip_date"] = None
                elif alarm.skip_date is None:
                    fire = next_occurrence(
                        alarm, now_local, tz, self._skip_dates, respect_skip=False
                    )
                    if fire is not None:
                        updates["skip_date"] = fire.date().isoformat()
                elif alarm.skip_date < today:
                    updates["skip_next"] = False
                    updates["skip_date"] = None
                if updates:
                    await self.alarms.async_update_item(alarm.id, updates)
        finally:
            self._normalizing = False

    # --- Activity log (how each alarm behaved) ------------------------------

    def activity_events(self) -> list[dict[str, Any]]:
        """Return the rolling activity log, newest first."""
        return list(reversed(self._activity))

    @callback
    def _record_activity(
        self, alarm: AuroraAlarm | None, kind: str, detail: dict[str, Any] | None = None
    ) -> None:
        """Append one human-readable activity event and persist (best effort)."""
        event: dict[str, Any] = {
            "ts": dt_util.utcnow().isoformat(),
            "kind": kind,
            "alarm_id": alarm.id if alarm else None,
            "label": alarm.label if alarm else None,
            "profile_id": alarm.profile_id if alarm else None,
        }
        if detail:
            event["detail"] = detail
        self._activity.append(event)
        if len(self._activity) > ACTIVITY_MAX:
            self._activity = self._activity[-ACTIVITY_MAX:]
        self.config_entry.async_create_task(
            self.hass,
            self._activity_store.async_save(self._activity),
            "aurora_activity_persist",
        )

    # --- Ring-state persistence (resume across restart) ---------------------

    @callback
    def _persist_ring(self) -> None:
        """Schedule a crash-safe save of the current ring state (best effort)."""
        snooze_end: str | None = None
        if self._state is AuroraState.SNOOZED and self._snooze_end_utc is not None:
            snooze_end = self._snooze_end_utc.isoformat()
        data: dict[str, Any] = {
            "state": self._state.value,
            "active_alarm_id": self._active_alarm_id,
            "snooze_count": self._snooze_count,
            "snooze_end": snooze_end,
        }
        # Save immediately (not delayed): ring transitions are rare and a crash
        # within a delay window would lose the resume state.
        self.config_entry.async_create_task(
            self.hass, self._ring_store.async_save(data), "aurora_ring_persist"
        )

    async def _async_restore_ring(self) -> None:
        """Re-enter a ring/snooze that an HA restart interrupted."""
        try:
            data = await self._ring_store.async_load()
        except Exception:  # never block setup on a corrupt/unreadable store
            data = None
        if not data:
            return
        # A clean shutdown clears the store, so any persisted active state means
        # the restart happened mid-ring.
        state = data.get("state")
        alarm_id = data.get("active_alarm_id")
        if not alarm_id or state not in (
            AuroraState.RINGING.value,
            AuroraState.MISSION.value,
            AuroraState.SNOOZED.value,
        ):
            await self._ring_store.async_remove()
            return
        alarm = self._get_alarm(alarm_id)
        if alarm is None:
            await self._ring_store.async_remove()
            return
        self._snooze_count = int(data.get("snooze_count", 0))
        if state == AuroraState.SNOOZED.value:
            end = dt_util.parse_datetime(data.get("snooze_end") or "")
            remaining = (end - dt_util.utcnow()).total_seconds() if end else 0
            self._active_alarm = alarm
            self._active_alarm_id = alarm.id
            if remaining > 1:
                self._state = AuroraState.SNOOZED
                self._snooze_end_utc = end
                self._unsub_snooze = async_call_later(
                    self.hass, remaining, self._on_snooze_end
                )
                self._publish()
                _LOGGER.info("Aurora: resumed snooze for '%s' after restart", alarm.id)
                return
        _LOGGER.info("Aurora: resumed ring for '%s' after restart", alarm_id)
        self._begin_ring(alarm)

    # --- Ring lifecycle / state machine -------------------------------------

    @callback
    def _effective_options(self, alarm: AuroraAlarm) -> dict[str, object]:
        """Role bindings for ``alarm``: its owner-profile bindings over globals."""
        options: dict[str, object] = dict(self.config_entry.options)
        profiles = options.get(CONF_PROFILES) or {}
        profile = (
            profiles.get(alarm.profile_id or "") if isinstance(profiles, dict) else None
        )
        if isinstance(profile, dict):
            bindings = profile.get(CONF_PROFILE_BINDINGS)
            if isinstance(bindings, dict):
                options.update(bindings)
        return options

    # --- Repair issues ------------------------------------------------------

    @callback
    def _has_audio_sink(self) -> bool:
        """Whether any AudioSink is bound (global, per-profile, or per-alarm)."""
        options = self.config_entry.options
        if _first_entity(options.get(ROLE_AUDIO_SINK)):
            return True
        profiles = options.get(CONF_PROFILES) or {}
        if isinstance(profiles, dict):
            for profile in profiles.values():
                if isinstance(profile, dict):
                    bindings = profile.get(CONF_PROFILE_BINDINGS)
                    if isinstance(bindings, dict) and _first_entity(
                        bindings.get(ROLE_AUDIO_SINK)
                    ):
                        return True
        for raw in self.alarms.async_items():
            try:
                if AuroraAlarm.from_dict(raw).features.audio.target:
                    return True
            except ValueError:
                continue
        return False

    @callback
    def _async_check_issues(self) -> None:
        """Raise/clear a repair issue: enabled alarms but no speaker bound.

        Without an AudioSink a ring is silent except the persistent notification,
        which is easy to miss — nudge the user to bind a speaker.
        """
        has_enabled = False
        for raw in self.alarms.async_items():
            try:
                if AuroraAlarm.from_dict(raw).enabled:
                    has_enabled = True
                    break
            except ValueError:
                continue
        if has_enabled and not self._has_audio_sink():
            ir.async_create_issue(
                self.hass,
                DOMAIN,
                "no_audio_sink",
                is_fixable=False,
                severity=ir.IssueSeverity.WARNING,
                translation_key="no_audio_sink",
            )
        else:
            ir.async_delete_issue(self.hass, DOMAIN, "no_audio_sink")

    # --- Sleep-aware pre-wake -----------------------------------------------

    @callback
    def _cancel_prewake(self) -> None:
        """Cancel any pending pre-wake start timer, evaluation loop, and prewarm."""
        if self._unsub_prewake_start is not None:
            self._unsub_prewake_start()
            self._unsub_prewake_start = None
        if self._unsub_prewake_eval is not None:
            self._unsub_prewake_eval()
            self._unsub_prewake_eval = None
        if self._unsub_prewarm is not None:
            self._unsub_prewarm()
            self._unsub_prewarm = None
        self._fusion = None
        self._prewake_alarm_id = None
        self._warmed_alarm_id = None

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
        # Hook A: fire a best-effort prewarm for the pre-wake alarm so the model
        # is loaded before the first real selfie check.
        sensitivity = 0.5
        if self._prewake_alarm_id is not None:
            alarm = self._get_alarm(self._prewake_alarm_id)
            if alarm is not None:
                sensitivity = alarm.features.smart_window.sensitivity
                self.config_entry.async_create_task(
                    self.hass,
                    self._async_vision_prewarm(alarm),
                    "aurora_vision_prewarm_prewake",
                )
        self._state = AuroraState.PRE_WAKE
        # Map sensitivity (0-1, higher = wake earlier) to the fusion's awake-ness
        # threshold; keep a 0.2 hysteresis band below it. sensitivity 0.5 -> 0.6.
        high = 0.8 - 0.4 * max(0.0, min(1.0, sensitivity))
        self._fusion = SleepFusion(high=high, low=max(0.15, high - 0.2))
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
                interpret_signal(
                    entity_id.partition(".")[0], state.state, state.attributes
                )
            )
        if self._fusion.add(fuse(scores)):
            if not self._condition_passes(alarm):
                _LOGGER.info("Aurora smart-wake: condition skipped '%s'", alarm.id)
                self._cancel_prewake()
                return
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
        self._setup_mission_watch(alarm)
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
        self._snooze_end_utc = None
        self._persist_ring()
        _LOGGER.info("Aurora alarm '%s' is ringing", alarm.id)
        self._record_activity(
            alarm, "ringing", {"mission": alarm.features.mission.type}
        )
        self._publish()

    @callback
    def _on_watchdog(self, _now: datetime) -> None:
        """Safety auto-stop if a ring runs past its maximum duration."""
        self._unsub_watchdog = None
        self.config_entry.async_create_task(
            self.hass, self.async_dismiss(reason="timeout"), "aurora_watchdog_dismiss"
        )

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

    async def async_dismiss(self, reason: str = "dismissed") -> None:
        """Stop the current ring; speak the wake-up briefing if enabled, then idle.

        ``reason`` records how the ring ended for the activity log: ``"dismissed"``
        (user/mission stopped it) or ``"timeout"`` (rang out the max duration).
        """
        # Once we're in the post-wake (briefing) phase nothing is ringing, so a
        # repeat dismiss is a no-op — and it must not clobber the running task.
        if self._state is AuroraState.POST_WAKE:
            return
        self._cancel_ring_timers()
        self._cancel_mission_watch()
        await self._ring.async_stop()
        alarm = self._active_alarm
        if alarm is not None:
            self._record_activity(alarm, reason)
        self._active_alarm = None
        self._active_alarm_id = None
        self._snooze_count = 0
        self._snooze_end_utc = None
        # The ring is over: persist a non-resumable state so a later restart does
        # not re-ring (set the final state first so the snapshot is accurate).
        has_action = alarm is not None and bool(
            _first_entity(self._effective_options(alarm).get(CONF_POST_WAKE_ACTION))
        )
        if alarm is not None and (alarm.features.briefing.enabled or has_action):
            self._state = AuroraState.POST_WAKE
            self._persist_ring()
            self._publish()
            self.config_entry.async_create_task(
                self.hass, self._async_post_wake(alarm), "aurora_post_wake"
            )
            return
        self._state = AuroraState.IDLE
        self._persist_ring()
        self._publish()

    async def _async_post_wake(self, alarm: AuroraAlarm) -> None:
        """Run the post-wake routine (briefing + optional action), then go idle."""
        try:
            if alarm.features.briefing.enabled:
                await self._async_run_briefing(alarm)
            await self._async_run_post_wake_action(alarm)
        except Exception:
            _LOGGER.exception("Aurora: wake-up briefing failed")
        finally:
            # Only fall back to idle if nothing newer took over (e.g. a fresh
            # ring started during the briefing); never overwrite a live state.
            if self._state is AuroraState.POST_WAKE:
                self._state = AuroraState.IDLE
                self._publish()

    async def _async_run_post_wake_action(self, alarm: AuroraAlarm) -> None:
        """Run the configured post-wake entity (script/scene/automation/...).

        An automation is *triggered* (``automation.trigger``) rather than merely
        enabled; everything else goes through the generic ``homeassistant.turn_on``
        which runs a script, applies a scene or turns on a light/switch alike.
        Best-effort - a failure is logged, never raised into the cycle.
        """
        options = self._effective_options(alarm)
        entity_id = _first_entity(options.get(CONF_POST_WAKE_ACTION))
        if not entity_id:
            return
        if entity_id.startswith("automation."):
            domain, service = "automation", "trigger"
        else:
            domain, service = "homeassistant", "turn_on"
        try:
            await self.hass.services.async_call(
                domain,
                service,
                {"entity_id": entity_id},
                blocking=False,
            )
        except Exception:
            _LOGGER.warning(
                "Aurora: post-wake action '%s' failed", entity_id, exc_info=True
            )

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
        duration = float(alarm.features.snooze.duration)
        self._snooze_end_utc = dt_util.utcnow() + timedelta(seconds=duration)
        self._unsub_snooze = async_call_later(
            self.hass, duration, self._on_snooze_end
        )
        self._persist_ring()
        self._record_activity(alarm, "snoozed", {"count": self._snooze_count})
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
            raise HomeAssistantError(
                translation_domain=DOMAIN, translation_key="no_alarm_to_trigger"
            )
        self._snooze_count = 0
        self._begin_ring(alarm)

    # --- Wake-up briefing ---------------------------------------------------

    async def async_speak_briefing(self, alarm_id: str | None = None) -> None:
        """Compose and speak the briefing for the given / active / first alarm.

        Exposed for the ``trigger_now``-style service so a briefing can be
        previewed without a full ring cycle.
        """
        alarm: AuroraAlarm | None = None
        if alarm_id is not None:
            alarm = self._get_alarm(alarm_id)
        elif self._active_alarm is not None:
            alarm = self._active_alarm
        elif self._next is not None:
            alarm = self._get_alarm(self._next.alarm_id)
        if alarm is None:
            alarm = self._first_enabled_alarm()
        if alarm is None:
            raise HomeAssistantError(
                translation_domain=DOMAIN, translation_key="no_alarm_for_briefing"
            )
        await self._async_run_briefing(alarm)

    async def _async_run_briefing(self, alarm: AuroraAlarm) -> None:
        """Resolve the briefing text and speak it (or notify on degradation).

        Serialised with a lock so a manual ``speak_briefing`` preview can never
        talk over a post-wake briefing already in flight.
        """
        async with self._briefing_lock:
            options = self._effective_options(alarm)
            text = await self._async_briefing_text(alarm, options)
            if not text:
                _LOGGER.debug("Aurora briefing: nothing to say for '%s'", alarm.id)
                return
            await self._async_speak(text, alarm, options)

    async def _async_briefing_text(
        self, alarm: AuroraAlarm, options: dict[str, object]
    ) -> str:
        """Render a custom template, else compose the selected blocks."""
        briefing = alarm.features.briefing
        if briefing.template:
            try:
                rendered = Template(briefing.template, self.hass).async_render(
                    parse_result=False
                )
            except (TemplateError, ValueError):
                _LOGGER.warning(
                    "Aurora briefing: template render failed", exc_info=True
                )
            else:
                if rendered not in (None, ""):
                    return str(rendered)
        blocks = briefing.blocks or list(DEFAULT_BLOCKS)
        ctx = BriefingContext(
            now=dt_util.now(),
            name=self._profile_name(alarm),
            weather=self._gather_weather(options) if "weather" in blocks else None,
            events=await self._gather_events(options) if "calendar" in blocks else [],
            todos=await self._gather_todos(options) if "todo" in blocks else [],
        )
        facts = compose_briefing(ctx, blocks, self.hass.config.language)
        # Optionally let the bound Conversation agent phrase the facts naturally;
        # fall back to the plain composed briefing if there is no agent / it fails.
        if briefing.use_agent:
            spoken = await self._async_agent_briefing(facts, ctx.name, options)
            if spoken:
                return spoken
        return facts

    async def _async_agent_briefing(
        self, facts: str, name: str, options: dict[str, object]
    ) -> str | None:
        """Have the bound Conversation agent voice the briefing from ``facts``.

        Returns the agent's spoken text, or None if no agent is bound or the call
        fails / yields nothing (the caller then speaks the plain ``facts``).
        """
        agent = _first_entity(options.get(ROLE_CONVERSATION))
        if not agent:
            return None
        greeting = f" for {name}" if name else ""
        prompt = (
            f"Give a brief, warm spoken wake-up greeting{greeting} in "
            f"{self.hass.config.language}. Two short sentences at most. Base it "
            "only on these facts and do not invent anything: "
            f"{facts or 'no additional information today'}"
        )
        try:
            resp = await self.hass.services.async_call(
                "conversation",
                "process",
                {
                    "text": prompt,
                    "agent_id": agent,
                    "language": self.hass.config.language,
                },
                blocking=True,
                return_response=True,
            )
        except Exception:
            _LOGGER.warning(
                "Aurora briefing: conversation agent '%s' failed", agent, exc_info=True
            )
            return None
        speech = (
            ((resp or {}).get("response") or {}).get("speech") or {}
        ).get("plain") or {}
        text = speech.get("speech")
        return str(text) if text else None

    @callback
    def _profile_name(self, alarm: AuroraAlarm) -> str:
        """Owner profile display name for the greeting (empty if none)."""
        profiles = self.config_entry.options.get(CONF_PROFILES) or {}
        if isinstance(profiles, dict):
            profile = profiles.get(alarm.profile_id or "")
            if isinstance(profile, dict):
                return str(profile.get(CONF_PROFILE_NAME) or "")
        return ""

    @callback
    def _gather_weather(self, options: dict[str, object]) -> WeatherFact | None:
        """Read the bound (or first available) weather entity into a WeatherFact."""
        entity_id = _first_entity(options.get(CONF_WEATHER))
        if entity_id is None:
            states = self.hass.states.async_all("weather")
            entity_id = states[0].entity_id if states else None
        if entity_id is None:
            return None
        state = self.hass.states.get(entity_id)
        if state is None or state.state in ("unavailable", "unknown"):
            return None
        raw_temp = state.attributes.get("temperature")
        try:
            temperature = float(raw_temp) if raw_temp is not None else None
        except (TypeError, ValueError):
            temperature = None
        unit = str(state.attributes.get("temperature_unit") or "°")
        return WeatherFact(
            condition=state.state or None, temperature=temperature, unit=unit
        )

    async def _gather_events(self, options: dict[str, object]) -> list[str]:
        """Today's remaining calendar events (summaries), ordered by start."""
        calendars = _as_entity_list(options.get(CONF_BRIEFING_CALENDARS))
        if not calendars:
            calendars = [s.entity_id for s in self.hass.states.async_all("calendar")]
        if not calendars:
            return []
        now = dt_util.now()
        end = now.replace(hour=23, minute=59, second=59, microsecond=0)
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
        except Exception:
            _LOGGER.warning("Aurora briefing: could not read calendars", exc_info=True)
            return []
        rows: list[tuple[str, str]] = []
        for cal in (response or {}).values():
            if not isinstance(cal, dict):
                continue
            for event in cal.get("events", []):
                summary = event.get("summary") or event.get("message") or "Evento"
                start_key = _coerce_event_value(event.get("start")) or ""
                rows.append((start_key, str(summary)))
        rows.sort(key=lambda row: row[0])
        return [summary for _, summary in rows]

    async def _gather_todos(self, options: dict[str, object]) -> list[str]:
        """Open (needs-action) to-do item summaries across the bound lists."""
        lists = _as_entity_list(options.get(CONF_TODO_LISTS))
        if not lists:
            lists = [s.entity_id for s in self.hass.states.async_all("todo")]
        if not lists:
            return []
        try:
            response = await self.hass.services.async_call(
                "todo",
                "get_items",
                {"entity_id": lists, "status": ["needs_action"]},
                blocking=True,
                return_response=True,
            )
        except Exception:
            _LOGGER.warning(
                "Aurora briefing: could not read to-do lists", exc_info=True
            )
            return []
        todos: list[str] = []
        for data in (response or {}).values():
            if not isinstance(data, dict):
                continue
            for item in data.get("items", []):
                summary = item.get("summary")
                if summary:
                    todos.append(str(summary))
        return todos

    async def _async_speak(
        self, text: str, alarm: AuroraAlarm, options: dict[str, object]
    ) -> None:
        """Speak ``text`` via the TTS role onto the audio sink; notify if degraded."""
        tts_entity = _first_entity(options.get(ROLE_TTS))
        media_target = alarm.features.audio.target or _first_entity(
            options.get(ROLE_AUDIO_SINK)
        )
        if tts_entity and media_target:
            try:
                # blocking=True so a runtime TTS failure (bad media player, engine
                # error) actually raises here and we can fall back to a notification.
                # We're already inside a fire-and-forget task, so this never stalls
                # an event-loop callback. The TTS entity goes in the target.
                await self.hass.services.async_call(
                    "tts",
                    "speak",
                    {
                        "media_player_entity_id": media_target,
                        "message": text,
                        "cache": False,
                    },
                    blocking=True,
                    target={"entity_id": tts_entity},
                )
                return
            except Exception:
                _LOGGER.warning("Aurora briefing: tts.speak failed", exc_info=True)
        persistent_notification.async_create(
            self.hass,
            text,
            title="Aurora — Briefing",
            notification_id=f"aurora_briefing_{alarm.id}",
        )

    # --- AI vision (selfie) mission -----------------------------------------

    @property
    def vision_latency_ms(self) -> float | None:
        """Rolling average AI-vision latency in ms (for the diagnostic sensor)."""
        return self._vision_latency.average()

    def _resolve_vision(self, alarm: AuroraAlarm | None) -> dict:
        """Effective vision params: per-alarm → per-user profile → global → default."""
        options = dict(self.config_entry.options)
        profiles = options.get(CONF_PROFILES) or {}
        profile = (
            profiles.get(alarm.profile_id or "")
            if (alarm and isinstance(profiles, dict))
            else None
        )
        profile = profile if isinstance(profile, dict) else {}

        def pick(key: str, default: object) -> object:
            v = profile.get(key)
            if v not in (None, ""):
                return v
            v = options.get(key)
            return v if v not in (None, "") else default

        prompt = (
            alarm.features.mission.vision_prompt
            if alarm and alarm.features.mission.vision_prompt
            else pick("vision_prompt", DEFAULT_VISION_PROMPT)
        )
        try:
            timeout_s = float(pick("vision_timeout_s", VISION_TIMEOUT_S))
        except (TypeError, ValueError):
            timeout_s = float(VISION_TIMEOUT_S)
        try:
            retries = int(pick("vision_retries", VISION_MAX_ATTEMPTS))
        except (TypeError, ValueError):
            retries = int(VISION_MAX_ATTEMPTS)
        model_raw = pick("vision_model", None)
        return {
            "prompt": prompt,
            "model": model_raw if model_raw not in (None, "") else None,
            "timeout_s": timeout_s,
            "retries": retries,
        }

    async def _async_vision_infer(
        self,
        image_path: str,
        media_uri: str,
        prompt: str,
        options: dict[str, object],
        *,
        model: str | None = None,
    ) -> str:
        """Run the bound vision provider on the saved selfie, return its answer.

        Prefers a bound ai_task entity (structured yes/no), else the first LLM
        Vision provider (free-text). Raises on no provider / provider error.
        When *model* is set, it is forwarded to the llmvision.image_analyzer call
        (ai_task branch uses its own configured model and ignores this param).
        """
        ai_entity = _first_entity(options.get(ROLE_VISION_PROVIDER))
        if ai_entity and ai_entity.startswith("ai_task."):
            resp = await self.hass.services.async_call(
                "ai_task",
                "generate_data",
                {
                    "entity_id": ai_entity,
                    "task_name": "Aurora wake check",
                    "instructions": prompt,
                    "structure": {
                        "awake": {
                            "description": "person is awake and out of bed",
                            "selector": {"boolean": {}},
                        }
                    },
                    "attachments": {
                        "media_content_id": media_uri,
                        "media_content_type": "image/jpeg",
                    },
                },
                blocking=True,
                return_response=True,
            )
            data = (resp or {}).get("data")
            if isinstance(data, dict) and "awake" in data:
                return "yes" if data.get("awake") else "no"
            return str(data or "")
        providers = get_llm_vision_providers(self.hass)
        if providers:
            service_data: dict[str, object] = {
                "provider": providers[0][0],
                "message": prompt,
                "image_file": image_path,
                "max_tokens": 10,
                "temperature": 0.1,
            }
            if model is not None:
                service_data["model"] = model
            resp = await self.hass.services.async_call(
                "llmvision",
                "image_analyzer",
                service_data,
                blocking=True,
                return_response=True,
            )
            return str((resp or {}).get("response_text") or "")
        raise HomeAssistantError("No vision provider configured")

    async def async_vision_check(
        self,
        image_b64: str,
        alarm_id: str | None = None,
        *,
        record_stats: bool = True,
    ) -> dict[str, object]:
        """Verify a selfie shows the user awake. Returns {awake, latency_ms, error?}.

        Resilient: a circuit breaker skips calls while the provider is failing,
        each call is time-boxed and retried with backoff, and the temp image is
        always cleaned up. A failure returns ``awake: False`` so the alarm keeps
        ringing (and the card degrades to a simpler mission).

        Pass ``record_stats=False`` for synthetic calls (benchmark, pre-warm) so
        they do not pollute the rolling latency sensor or the circuit breaker.
        """
        if not self._vision_breaker.allow(time.monotonic()):
            return {"awake": False, "error": "circuit_open"}
        alarm = self._get_alarm(alarm_id) if alarm_id else self._active_alarm
        options = (
            self._effective_options(alarm)
            if alarm
            else dict(self.config_entry.options)
        )
        v = self._resolve_vision(alarm)
        try:
            raw = base64.b64decode(image_b64.split(",")[-1])
        except (ValueError, TypeError):
            return {"awake": False, "error": "bad_image"}

        rel = f"aurora/selfie_{alarm_id or 'now'}.jpg"
        path = self.hass.config.path("media", rel)
        media_uri = f"media-source://media_source/local/{rel}"

        def _write() -> None:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as handle:
                handle.write(raw)

        try:
            await self.hass.async_add_executor_job(_write)
        except OSError:
            return {"awake": False, "error": "write_failed"}

        text = ""
        ok = False
        start = time.monotonic()
        for attempt in range(v["retries"]):
            try:
                async with asyncio.timeout(v["timeout_s"]):
                    text = await self._async_vision_infer(
                        path, media_uri, v["prompt"], options, model=v["model"]
                    )
                ok = True
                break
            except Exception:
                _LOGGER.warning(
                    "Aurora vision: inference attempt %s failed",
                    attempt + 1,
                    exc_info=True,
                )
                if attempt + 1 < v["retries"]:
                    backoff = min(
                        VISION_BACKOFF_BASE_S * (2**attempt), VISION_BACKOFF_CAP_S
                    )
                    await asyncio.sleep(backoff)
        latency_ms = round((time.monotonic() - start) * 1000)
        if record_stats:
            self._vision_breaker.record(ok, time.monotonic())
        if record_stats and ok:
            self._vision_latency.add(latency_ms)
            self._publish()  # refresh the latency sensor

        def _cleanup() -> None:
            if os.path.exists(path):
                os.remove(path)

        with contextlib.suppress(OSError):
            await self.hass.async_add_executor_job(_cleanup)

        if not ok:
            return {
                "awake": False,
                "error": "inference_failed",
                "latency_ms": latency_ms,
            }
        return {"awake": parse_verdict(text), "latency_ms": latency_ms}

    def _sample_image_b64(self) -> str:
        """Generate a small solid-colour JPEG and return it as a base64 string.

        Pillow-backed.  Shared by the benchmark and the vision pre-warm so both
        send a syntactically valid image without hitting a real camera.
        """
        import io

        try:
            from PIL import Image
        except ImportError as err:
            raise HomeAssistantError(
                "Pillow is required for vision benchmark / pre-warm"
            ) from err

        buf = io.BytesIO()
        Image.new("RGB", (320, 320), (96, 96, 120)).save(buf, format="JPEG")
        return base64.b64encode(buf.getvalue()).decode()

    async def async_vision_benchmark(self, samples: int) -> dict[str, object]:
        """Run ``samples`` timed inferences on a generated image; report stats.

        Uses ``record_stats=False`` so benchmark runs do not pollute the rolling
        latency sensor or the circuit breaker.
        """
        image_b64 = await self.hass.async_add_executor_job(self._sample_image_b64)
        latencies: list[float] = []
        succeeded = 0
        for _ in range(samples):
            result = await self.async_vision_check(image_b64, None, record_stats=False)
            if result.get("error") is None:
                succeeded += 1
            lat = result.get("latency_ms")
            if isinstance(lat, (int, float)) and result.get("error") in (
                None,
                "inference_failed",
            ):
                latencies.append(float(lat))
        return {
            "samples": samples,
            "succeeded": succeeded,
            "failed": samples - succeeded,
            "latency_ms": {
                "min": round(min(latencies)) if latencies else None,
                "avg": round(sum(latencies) / len(latencies)) if latencies else None,
                "max": round(max(latencies)) if latencies else None,
            },
        }

    async def _async_vision_prewarm(self, alarm: AuroraAlarm) -> None:
        """Best-effort warm-up so the first real selfie check is not cold.

        Guards:
        - mission must be VISION;
        - at most one warm-up per schedule cycle (_warmed_alarm_id guard);
        - a vision provider must be resolvable for this alarm;
        - the circuit breaker must allow a call.

        Uses ``record_stats=False`` so the warm-up does not pollute the latency
        sensor or the breaker.  All errors are suppressed — this is fire-and-forget.
        """
        if alarm.features.mission.type != MissionType.VISION:
            return
        if self._warmed_alarm_id == alarm.id:
            return
        options = self._effective_options(alarm)
        if not _first_entity(options.get(ROLE_VISION_PROVIDER)):
            return
        if not self._vision_breaker.allow(time.monotonic()):
            return
        # Stamp the guard only once we have an image in hand: if sample
        # generation fails (e.g. Pillow missing) the cycle stays un-warmed so
        # the other trigger can still try, rather than being silently skipped.
        with contextlib.suppress(Exception):
            image = await self.hass.async_add_executor_job(self._sample_image_b64)
            self._warmed_alarm_id = alarm.id
            await self.async_vision_check(image, alarm.id, record_stats=False)

    @callback
    def _maybe_schedule_prewarm(self) -> None:
        """Arm a pre-warm timer at PREWARM_LEAD_S before the next vision alarm.

        Mirrors ``_maybe_schedule_prewake``.  If the alarm's mission is not VISION
        or no vision provider is configured the method is a no-op.  The warm-up
        task is fire-and-forget via ``config_entry.async_create_task``; it never
        blocks or raises into the state machine.
        """
        if self._next is None:
            return
        alarm = self._get_alarm(self._next.alarm_id)
        if alarm is None:
            return
        if alarm.features.mission.type != MissionType.VISION:
            return
        options = self._effective_options(alarm)
        if not _first_entity(options.get(ROLE_VISION_PROVIDER)):
            return
        prewarm_at = self._next.fire_at_utc - timedelta(seconds=PREWARM_LEAD_S)
        if prewarm_at <= dt_util.utcnow():
            # Already past the lead time — fire immediately.
            self.config_entry.async_create_task(
                self.hass,
                self._async_vision_prewarm(alarm),
                "aurora_vision_prewarm_immediate",
            )
        else:
            def _fire(_now: datetime) -> None:
                self._unsub_prewarm = None
                self.config_entry.async_create_task(
                    self.hass,
                    self._async_vision_prewarm(alarm),
                    "aurora_vision_prewarm_scheduled",
                )

            self._unsub_prewarm = async_track_point_in_utc_time(
                self.hass, _fire, prewarm_at
            )
