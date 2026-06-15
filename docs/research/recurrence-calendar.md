# Aurora: Recurrence Model & Calendar Exposure/Skip — Research Notes

**Date:** 2026-06-15
**HA Target:** 2026.6.3 (current stable as of research date)
**Python Target:** 3.13 (HA shipped with Python 3.13.x in early 2026; supervisor 2026.05.1 moved to 3.14 but core still 3.13)
**Sources:** developers.home-assistant.io, github.com/home-assistant/core, www.home-assistant.io (primary), plus architecture discussion threads

---

## 0. Platform Baseline

| Item | Value |
|------|-------|
| Current stable HA | **2026.6.3** (released 2026-06-12) |
| Minimum target | **2026.1** (CalendarEntity stable, IQS Gold mature) |
| Python shipped | **3.13** (policy: single minor, latest upstream; supervisor 2026.05.1 updated to 3.14, but core still 3.13) |
| Relevant ADR | `architecture/adr/0020-minimum-supported-python-version.md` — HA supports one Python minor at a time, targeting latest upstream |

---

## 1. Recurrence Model: Internalize vs. Depend

### 1.1 scheduler-component (HACS, nielsfaber/scheduler-component) — Analysis

The third-party `scheduler-component` is the most popular HACS scheduler. Its data model (from `store.py`, using `attrs` frozen dataclasses):

```python
# store.py — actual field names from source
@attr.s(slots=True, frozen=True)
class ScheduleEntry:
    schedule_id: str
    weekdays: list          # e.g. ["mon","tue","wed","thu","fri"] or ["daily"] or ["workday"] or ["weekend"]
    start_date: str | None  # "yyyy-mm-dd"
    end_date: str | None    # "yyyy-mm-dd"
    timeslots: list[TimeslotEntry]
    repeat_type: str        # "repeat" | "single" | "pause"
    name: str
    enabled: bool = True

@attr.s(slots=True, frozen=True)
class TimeslotEntry:
    start: str              # "14:30" or "sunrise+01:00"
    stop: str               # optional end time
    conditions: list[ConditionEntry]
    condition_type: str     # "and" | "or"
    track_conditions: bool = False
    actions: list[ActionEntry]

@attr.s(slots=True, frozen=True)
class ConditionEntry:
    entity_id: str
    attribute: str | None
    value: str | None
    match_type: str | None  # "is" | "not" | "below" | "above"

@attr.s(slots=True, frozen=True)
class ActionEntry:
    service: str
    entity_id: str | None
    service_data: dict

@attr.s(slots=True, frozen=True)
class TagEntry:
    name: str
    schedules: list[str]    # schedule IDs
```

Persistence: `.storage/scheduler.storage`
Entity pattern: `switch.schedule_<6digit_token>`

**Weekday vocabulary:**
- Named days: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`
- Aliases: `daily`, `workday`, `weekend`
- No bitmask — plain string list

### 1.2 HA Native Schedule Helper

`homeassistant.components.schedule` — creates a `schedule.*` entity:
- Configured via UI (Settings > Helpers) or YAML
- Weekly time blocks with `from`/`to` per day
- Returns `on`/`off` state; supports optional `data` payload per block
- Supports `monday` through `sunday` keys
- No concept of holidays or one-shot (single-fire) entries
- Acts as a condition/trigger in automations

### 1.3 RFC 5545 RRULE (CalendarEntity native)

HA's `CalendarEvent` carries an `rrule: str | None` field holding a raw RFC 5545 RRULE string, e.g.:
```
FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261231
FREQ=DAILY
FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1
```

**Architectural decision (arch/discussion#797):** HA core intentionally does **not** interpret RRULE — it is a pass-through between clients and integrations. Each calendar integration must expand recurring events itself. Supported FREQ: `YEARLY`, `MONTHLY`, `WEEKLY`, `DAILY` only (more complex excluded as impractical).

### 1.4 Recommendation: INTERNALIZE Aurora's Recurrence Schema

**Verdict: Internalize.** Do not depend on scheduler-component.

Rationale:
1. **scheduler-component is a HACS community component** — not guaranteed to be installed, maintained, or API-stable. Depending on it would violate Gold/Platinum IQS requirements for self-contained integrations.
2. **HA native Schedule helper** is too simple (no holiday awareness, no one-shot, no per-alarm offsets).
3. Aurora needs richer semantics (weekday sets, one-shot, conditional skip, holiday-aware) that neither external component covers cleanly.
4. Internalizing keeps Aurora a pure HA integration — config via config_flow, persisted via `homeassistant.helpers.storage.Store`.

**Recommended Aurora recurrence schema** (Python dataclass / JSON storage):

```python
from __future__ import annotations
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Literal

class RepeatMode(StrEnum):
    ONCE    = "once"    # fire once then disable
    WEEKLY  = "weekly"  # repeat on weekday_mask every week
    DAILY   = "daily"   # repeat every day

WEEKDAY_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu",
               4: "fri", 5: "sat", 6: "sun"}

@dataclass
class AuroraAlarmSchedule:
    """Alarm recurrence definition stored by Aurora."""

    # Time
    hour: int                        # 0-23
    minute: int                      # 0-59

    # Recurrence
    repeat_mode: RepeatMode = RepeatMode.WEEKLY
    weekdays: frozenset[int] = field(
        default_factory=lambda: frozenset({0, 1, 2, 3, 4})  # Mon-Fri
    )  # Only used when repeat_mode == WEEKLY; integers 0=Mon..6=Sun

    # Date boundaries (ISO strings for JSON storage)
    start_date: str | None = None    # "YYYY-MM-DD" — ignore alarms before
    end_date: str | None = None      # "YYYY-MM-DD" — ignore alarms after

    # Skip logic
    skip_holidays: bool = False      # use Holiday/Workday entity to skip
    skip_entity_id: str | None = None  # workday binary_sensor or holiday calendar entity to consult
    skip_if_entity_state: str | None = None  # e.g. "off" for workday sensor

    # One-shot support
    next_occurrence_override: str | None = None  # ISO datetime; cleared after firing
    enabled: bool = True

    # Optional: per-alarm offset from trigger (e.g. snooze seed)
    pre_alarm_minutes: int = 0       # fire N minutes early (for pre-warm)
```

This schema can be serialized to JSON via `dataclasses.asdict()` and stored with `Store("aurora", 1, "aurora_schedules")`.

---

## 2. Calendar Integration: Exposing Alarms as CalendarEntity

### 2.1 CalendarEvent Dataclass (exact definition from core)

Source: `homeassistant/components/calendar/__init__.py`

```python
@dataclasses.dataclass
class CalendarEvent:
    """An event on a calendar."""
    start: datetime.date | datetime.datetime   # datetime must be tz-aware
    end: datetime.date | datetime.datetime     # exclusive boundary; same type as start
    summary: str
    description: str | None = None
    location: str | None = None
    uid: str | None = None                     # required for mutations
    recurrence_id: str | None = None           # instance ID within a recurring series
    rrule: str | None = None                   # RFC 5545 string, passed through uninterpreted

    @property
    def start_datetime_local(self) -> datetime.datetime: ...
    @property
    def end_datetime_local(self) -> datetime.datetime: ...
    @property
    def all_day(self) -> bool: ...             # True if start is date, not datetime
    def as_dict(self) -> dict[str, Any]: ...
```

### 2.2 CalendarEntity Base Class (exact signatures)

```python
class CalendarEntity(Entity):
    entity_description: CalendarEntityDescription

    # MUST implement — return current/next event or None
    @property
    def event(self) -> CalendarEvent | None:
        raise NotImplementedError

    # MUST implement for agenda views — return events in [start_date, end_date)
    async def async_get_events(
        self,
        hass: HomeAssistant,
        start_date: datetime.datetime,
        end_date: datetime.datetime,
    ) -> list[CalendarEvent]:
        raise NotImplementedError

    # Optional mutation methods (need CalendarEntityFeature flags)
    async def async_create_event(self, **kwargs: Any) -> None: ...
    async def async_delete_event(
        self, uid: str,
        recurrence_id: str | None = None,
        recurrence_range: str | None = None,
    ) -> None: ...
    async def async_update_event(
        self, uid: str, event: dict[str, Any],
        recurrence_id: str | None = None,
        recurrence_range: str | None = None,
    ) -> None: ...

    # State management (both @final — do NOT override)
    @final @property def state(self) -> str: ...           # "on" or "off"
    @final @property def state_attributes(self) -> dict: ...

    # Subscription for WebSocket live updates (internal use)
    @final @callback
    def async_subscribe_events(self, start_date, end_date, event_listener) -> CALLBACK_TYPE: ...
    @final @callback
    def async_update_event_listeners(self) -> None: ...    # call after CRUD ops
```

**CalendarEntityFeature flags:**
```python
from homeassistant.components.calendar import CalendarEntityFeature

CalendarEntityFeature.CREATE_EVENT   # enables async_create_event
CalendarEntityFeature.DELETE_EVENT   # enables async_delete_event
CalendarEntityFeature.UPDATE_EVENT   # enables async_update_event
```

### 2.3 Aurora CalendarEntity Implementation Template

```python
# aurora/calendar.py
from __future__ import annotations

import datetime
import uuid
from typing import Any

from homeassistant.components.calendar import (
    CalendarEntity,
    CalendarEntityFeature,
    CalendarEvent,
)
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .coordinator import AuroraCoordinator
from .models import AuroraAlarmSchedule, RepeatMode


class AuroraCalendarEntity(CalendarEntity):
    """Exposes Aurora alarms as a HA calendar for agenda views."""

    _attr_has_entity_name = True
    _attr_name = "Alarms"
    _attr_supported_features = (
        CalendarEntityFeature.CREATE_EVENT
        | CalendarEntityFeature.DELETE_EVENT
        | CalendarEntityFeature.UPDATE_EVENT
    )

    def __init__(self, coordinator: AuroraCoordinator) -> None:
        self._coordinator = coordinator
        self._attr_unique_id = f"{DOMAIN}_calendar"

    @property
    def event(self) -> CalendarEvent | None:
        """Return the next upcoming alarm as a CalendarEvent."""
        now = dt_util.now()
        upcoming = self._coordinator.get_next_alarm_after(now)
        if upcoming is None:
            return None
        return self._schedule_to_event(upcoming)

    async def async_get_events(
        self,
        hass: HomeAssistant,
        start_date: datetime.datetime,
        end_date: datetime.datetime,
    ) -> list[CalendarEvent]:
        """Return all alarm occurrences within [start_date, end_date).

        IMPORTANT: start_date and end_date arrive as UTC; convert to local
        before comparison. Return expanded individual occurrences (no RRULE
        expansion delegated to core — we must expand ourselves).
        """
        # Convert UTC range to local for schedule math
        local_tz = dt_util.get_default_time_zone()
        local_start = start_date.astimezone(local_tz)
        local_end = end_date.astimezone(local_tz)

        events: list[CalendarEvent] = []
        for schedule in self._coordinator.get_all_schedules():
            if not schedule.enabled:
                continue
            occurrences = self._expand_schedule(schedule, local_start, local_end)
            events.extend(occurrences)
        return events

    def _expand_schedule(
        self,
        schedule: AuroraAlarmSchedule,
        local_start: datetime.datetime,
        local_end: datetime.datetime,
    ) -> list[CalendarEvent]:
        """Expand a schedule into CalendarEvent instances within the range."""
        events = []
        # Walk day-by-day between local_start and local_end
        # For WEEKLY: only emit days matching schedule.weekdays
        # For DAILY: emit every day
        # For ONCE: emit only the override date if in range
        current = local_start.date()
        end_date = local_end.date()
        while current <= end_date:
            should_include = False
            if schedule.repeat_mode == RepeatMode.ONCE:
                if schedule.next_occurrence_override:
                    override_dt = datetime.datetime.fromisoformat(
                        schedule.next_occurrence_override
                    )
                    if override_dt.date() == current:
                        should_include = True
            elif schedule.repeat_mode == RepeatMode.WEEKLY:
                if current.weekday() in schedule.weekdays:
                    should_include = True
            elif schedule.repeat_mode == RepeatMode.DAILY:
                should_include = True

            if should_include:
                tz = dt_util.get_default_time_zone()
                alarm_dt = datetime.datetime(
                    current.year, current.month, current.day,
                    schedule.hour, schedule.minute, tzinfo=tz
                )
                if local_start <= alarm_dt < local_end:
                    events.append(self._make_event(schedule, alarm_dt))
            current += datetime.timedelta(days=1)
        return events

    def _make_event(
        self, schedule: AuroraAlarmSchedule, alarm_dt: datetime.datetime
    ) -> CalendarEvent:
        return CalendarEvent(
            start=alarm_dt,
            end=alarm_dt + datetime.timedelta(minutes=30),  # nominal duration
            summary=f"Aurora Alarm — {schedule.hour:02d}:{schedule.minute:02d}",
            description=f"Aurora alarm (repeat={schedule.repeat_mode})",
            uid=f"{DOMAIN}_{schedule.hour}_{schedule.minute}_{alarm_dt.date().isoformat()}",
        )

    def _schedule_to_event(self, schedule: AuroraAlarmSchedule) -> CalendarEvent:
        now = dt_util.now()
        tz = dt_util.get_default_time_zone()
        today = now.date()
        alarm_dt = datetime.datetime(
            today.year, today.month, today.day,
            schedule.hour, schedule.minute, tzinfo=tz
        )
        if alarm_dt < now:
            alarm_dt += datetime.timedelta(days=1)
        return self._make_event(schedule, alarm_dt)
```

**Key timezone gotcha:** `async_get_events` receives UTC `datetime` objects. You must convert them to local time before doing weekday or date arithmetic. Use `dt_util.get_default_time_zone()` (returns HA configured timezone) and `.astimezone()`. Do not use `datetime.date.today()` directly.

### 2.4 State and Attributes

- `state = "on"` when `self.event` is not None and the event's start <= now < end
- `state_attributes` includes `message`, `start_time`, `end_time`, `all_day`, `description`, `location` — all from the current `event`
- These are `@final` — do not override

### 2.5 WebSocket Subscription (for Lovelace card)

The frontend Lovelace calendar card uses `calendar/event/subscribe` WebSocket command (implemented in base class). After any CRUD mutation, call:
```python
self.async_update_event_listeners()
```
This pushes updated event lists to all active subscribers without needing extra code.

---

## 3. Reading External Calendars for Skip/Holiday Logic

### 3.1 `calendar.get_events` Service Action

This is the standard user-facing way to read events from any CalendarEntity.

**Service ID:** `calendar.get_events`
**Supports response:** `SupportsResponse.ONLY` — must use `response_variable` in scripts/automations.

**Schema:**
```python
SERVICE_GET_EVENTS_SCHEMA = vol.All(
    cv.has_at_least_one_key(EVENT_END_DATETIME, EVENT_DURATION),
    cv.has_at_most_one_key(EVENT_END_DATETIME, EVENT_DURATION),
    cv.make_entity_service_schema({
        vol.Optional("start_date_time"): cv.datetime,
        vol.Optional("end_date_time"): cv.datetime,
        vol.Optional("duration"): vol.All(cv.time_period, cv.positive_timedelta),
    }),
)
```

**Automation YAML example:**
```yaml
action: calendar.get_events
data:
  start_date_time: "{{ now().strftime('%Y-%m-%d 00:00:00') }}"
  end_date_time: "{{ (now() + timedelta(days=1)).strftime('%Y-%m-%d 00:00:00') }}"
response_variable: agenda
target:
  entity_id: calendar.holidays_italy
```

**Response format:**
```json
{
  "calendar.holidays_italy": {
    "events": [
      {
        "start": "2026-06-02",
        "end": "2026-06-02",
        "summary": "Festa della Repubblica",
        "description": null,
        "location": null
      }
    ]
  }
}
```

Each event only includes fields with non-null values. All-day events use date strings (no time component). The `uid` field may be missing depending on the provider (known issue with CalDAV — see github.com/home-assistant/core/issues/170761).

**Known issues:**
- Scripts without `return_response` support may fail — use automations or `script` blocks with proper `response_variable`
- Issue #153320: Some script contexts don't support response_variable for this service — fixed in recent releases but verify on target version
- Start/end date filtering is exclusive on end: events overlapping the range boundary may or may not appear consistently

### 3.2 Programmatic Service Call from Integration Code

To call `calendar.get_events` from within Aurora's Python code (not a user automation):

```python
from homeassistant.core import HomeAssistant

async def check_holiday_on_date(
    hass: HomeAssistant,
    calendar_entity_id: str,
    check_date: datetime.date,
) -> bool:
    """Return True if check_date has any event in the target calendar."""
    import datetime
    from homeassistant.util import dt as dt_util

    tz = dt_util.get_default_time_zone()
    start_dt = datetime.datetime(
        check_date.year, check_date.month, check_date.day, 0, 0, 0, tzinfo=tz
    )
    end_dt = start_dt + datetime.timedelta(days=1)

    response = await hass.services.async_call(
        domain="calendar",
        service="get_events",
        service_data={
            "start_date_time": start_dt.isoformat(),
            "end_date_time": end_dt.isoformat(),
        },
        target={"entity_id": calendar_entity_id},
        blocking=True,
        return_response=True,
    )
    # response is dict[str, dict] keyed by entity_id
    events = (response or {}).get(calendar_entity_id, {}).get("events", [])
    return len(events) > 0
```

**Important:** `return_response=True` requires `blocking=True`. This works from integration coordinator code (running in event loop). Do not call from synchronous context.

Alternatively — and more efficiently — for integrations that own their calendar check:

```python
from homeassistant.components.calendar import CalendarEntity

async def is_holiday_on(
    hass: HomeAssistant,
    calendar_entity_id: str,
    check_date: datetime.date,
) -> bool:
    """Directly call async_get_events on the entity without service overhead."""
    from homeassistant.helpers import entity_registry as er
    from homeassistant.util import dt as dt_util

    tz = dt_util.get_default_time_zone()
    start_dt = datetime.datetime(
        check_date.year, check_date.month, check_date.day, 0, 0, 0, tzinfo=tz
    )
    end_dt = start_dt + datetime.timedelta(days=1)

    # Get entity from platform
    entity_registry = er.async_get(hass)
    entity_entry = entity_registry.async_get(calendar_entity_id)
    if entity_entry is None:
        return False

    # Get live entity object from entity component
    platform_entities = hass.data.get("calendar_entities", {})
    entity: CalendarEntity | None = platform_entities.get(calendar_entity_id)
    if entity is None:
        # Fallback: use service call approach above
        return await check_holiday_on_date(hass, calendar_entity_id, check_date)

    events = await entity.async_get_events(hass, start_dt, end_dt)
    return len(events) > 0
```

**Recommendation for Aurora:** use the `hass.services.async_call(..., return_response=True)` approach. It is provider-agnostic (works with any CalendarEntity — holiday, CalDAV, local_calendar) and avoids coupling to internal entity storage.

### 3.3 Calendar Trigger for Skip (Automation Approach)

If Aurora exposes a skip mechanism as a blueprint or user automation:
```yaml
triggers:
  - trigger: calendar
    event: start
    entity_id: calendar.holidays_italy
actions:
  - action: aurora.skip_next_alarm
    data:
      alarm_id: "{{ trigger.calendar_event.uid }}"
```

The calendar trigger polls every 15 minutes — acceptable for holiday detection (holidays are all-day, known well in advance). Not suitable for real-time sub-minute skip decisions.

---

## 4. Holiday & Workday Integration for Auto-Skip

### 4.1 Workday Binary Sensor (`workday` integration)

**Entity type:** `binary_sensor`
**State:** `on` = today is a workday; `off` = today is not a workday (holiday or weekend)

**Service: `workday.check_date`**
```yaml
action: workday.check_date
data:
  check_date: "2026-12-25"
target:
  entity_id: binary_sensor.workday_sensor
response_variable: result
# result = {"workday": false}
```

Internally, the `date_is_workday` logic:
```python
# entity.py — BaseWorkdayEntity (simplified)
def date_is_workday(self, now: datetime.datetime) -> bool:
    adjusted = now + timedelta(days=self._days_offset)
    weekday_name = WEEKDAY_MAP[adjusted.weekday()]  # "mon" etc.
    is_workday = False
    # Check includes
    if weekday_name in self._workdays:
        is_workday = True
    if "holiday" in self._workdays and adjusted.date() in self._obj_holidays:
        is_workday = True
    # Check excludes (override includes)
    if weekday_name in self._excludes:
        is_workday = False
    if "holiday" in self._excludes and adjusted.date() in self._obj_holidays:
        is_workday = False
    return is_workday
```

Where `self._obj_holidays` is a `holidays.HolidayBase` instance loaded from `vacanza/python-holidays`.

**Using workday sensor for Aurora skip:**
```python
async def should_skip_alarm(hass: HomeAssistant, workday_entity_id: str) -> bool:
    """Return True if today is NOT a workday (holiday/weekend) — so alarm should skip."""
    state = hass.states.get(workday_entity_id)
    if state is None:
        return False  # entity missing — fail open (don't skip)
    return state.state == "off"
```

For checking a future date (tomorrow's alarm decision):
```python
async def is_workday_on_date(
    hass: HomeAssistant, workday_entity_id: str, check_date: datetime.date
) -> bool:
    """Call workday.check_date service for a specific date."""
    response = await hass.services.async_call(
        domain="workday",
        service="check_date",
        service_data={"check_date": check_date.isoformat()},
        target={"entity_id": workday_entity_id},
        blocking=True,
        return_response=True,
    )
    return (response or {}).get("workday", True)  # default True = don't skip
```

### 4.2 Holiday Calendar (`holiday` integration)

**Entity type:** `calendar` (CalendarEntity)
**State:** `on` when a holiday is currently active (all-day events)

The Holiday calendar's `async_get_events` (from `homeassistant/components/holiday/calendar.py`):
```python
async def async_get_events(
    self, hass: HomeAssistant, start_date: datetime, end_date: datetime
) -> list[CalendarEvent]:
    obj_holidays = country_holidays(
        self._country,
        subdiv=self._province,
        years=list({start_date.year, end_date.year}),
        language=self._language,
        categories=self._categories,  # PUBLIC always included
    )
    return [
        CalendarEvent(
            summary=name,
            start=date,       # datetime.date — all-day event
            end=date,
            location=self._location,
        )
        for date, name in obj_holidays.items()
        if start_date.date() <= date <= end_date.date()
    ]
```

Using Holiday calendar for Aurora skip via `hass.states.get`:
```python
def is_holiday_today(hass: HomeAssistant, holiday_calendar_entity_id: str) -> bool:
    """Check if a holiday is active today using entity state."""
    state = hass.states.get(holiday_calendar_entity_id)
    if state is None:
        return False
    return state.state == "on"
```

### 4.3 bruxy70/Holidays (HACS Community Integration)

Source: github.com/bruxy70/Holidays

A third-party HACS integration that creates sensor entities for public holidays and can move scheduled events landing on public holidays (via automation blueprint). More feature-rich than the built-in Holiday integration but requires HACS install.

**Recommendation:** Do NOT depend on this for Aurora. Use built-in `holiday` integration (or `workday`) as the user-configurable skip source.

### 4.4 vacanza/python-holidays Library

The workday and holiday integrations both use `from holidays import HolidayBase, country_holidays, PUBLIC`.

Aurora can optionally use this library **directly** (it is bundled with HA) to build its own holiday awareness without requiring the user to install the workday/holiday integration. However, this creates a maintenance coupling to HA's library version.

**Direct use pattern (if needed):**
```python
from holidays import country_holidays

def _build_holidays_obj(country: str, subdiv: str | None, year: int):
    return country_holidays(country, subdiv=subdiv, years=year)

def is_public_holiday(date: datetime.date, country: str, subdiv: str | None) -> bool:
    obj = _build_holidays_obj(country, subdiv, date.year)
    return date in obj
```

**Recommendation:** Prefer delegating to an existing `workday` or `holiday` entity (user-configured), not direct library use. This respects HA's provider-agnostic design principle and is more user-configurable.

---

## 5. Aurora Skip Logic Architecture — Recommended Design

```
AuroraAlarmSchedule.skip_holidays = True
    └── AuroraAlarmSchedule.skip_entity_id = "binary_sensor.workday_sensor"
            OR "calendar.holidays_italy"
```

At alarm-fire time (or the night before during pre-compute):

```python
async def should_skip_alarm_on_date(
    hass: HomeAssistant,
    schedule: AuroraAlarmSchedule,
    check_date: datetime.date,
) -> bool:
    """Return True if the alarm should be suppressed on check_date."""
    if not schedule.skip_holidays or schedule.skip_entity_id is None:
        return False

    entity_id = schedule.skip_entity_id
    domain, _ = entity_id.split(".", 1)

    if domain == "binary_sensor":
        # Assume workday sensor — check tomorrow's workday status
        if check_date == datetime.date.today():
            # Use current state for today
            state = hass.states.get(entity_id)
            return state is not None and state.state == "off"
        else:
            # Use check_date service for future dates
            result = await hass.services.async_call(
                "workday", "check_date",
                {"check_date": check_date.isoformat()},
                target={"entity_id": entity_id},
                blocking=True, return_response=True,
            )
            return not (result or {}).get("workday", True)

    elif domain == "calendar":
        # Holiday calendar — get events for the day
        result = await hass.services.async_call(
            "calendar", "get_events",
            {
                "start_date_time": datetime.datetime.combine(
                    check_date, datetime.time.min,
                    tzinfo=dt_util.get_default_time_zone()
                ).isoformat(),
                "end_date_time": datetime.datetime.combine(
                    check_date + datetime.timedelta(days=1), datetime.time.min,
                    tzinfo=dt_util.get_default_time_zone()
                ).isoformat(),
            },
            target={"entity_id": entity_id},
            blocking=True, return_response=True,
        )
        events = (result or {}).get(entity_id, {}).get("events", [])
        return len(events) > 0

    return False
```

---

## 6. Integration Quality Scale: Gold/Platinum Requirements

Source: developers.home-assistant.io/docs/core/integration-quality-scale/

### Gold Requirements (relevant to Aurora):
- Config flow (UI-based setup, no YAML required)
- Code owners maintained
- Automatic recovery from errors
- Re-authentication handling
- Entity names are logically translatable (i18n via `strings.json`)
- Entities properly categorized and enabled for long-term statistics
- Extensive end-user documentation with examples, entities list, compatible devices
- Diagnostic downloading and reconfiguration via UI
- **Full automated test coverage** (this is non-negotiable for Gold)
- Works with Home Assistant badge compliance

### Platinum Requirements (additional):
- Full type annotations on all code
- Fully async code base (no blocking calls on event loop)
- Efficient data handling (minimize network/CPU, use coordinators with proper update intervals)
- All coding and HA integration standards followed

### Implications for Aurora:
1. Use `DataUpdateCoordinator` for all data fetching
2. Use `config_flow.py` for all setup
3. Implement `async_setup_entry` / `async_unload_entry`
4. All entities use `_attr_*` pattern (not method overrides)
5. `strings.json` + `translations/en.json` for all strings
6. `diagnostics.py` for `async_get_config_entry_diagnostics`
7. Test coverage: `tests/components/aurora/` with pytest-homeassistant-custom-component

---

## 7. Key Gotchas & Deprecations

### 7.1 async_get_events Timezone
- Receives UTC `datetime` objects — always convert to local before date arithmetic
- Use `homeassistant.util.dt.now()` not `datetime.datetime.now()`
- Use `homeassistant.util.dt.get_default_time_zone()` not `datetime.timezone.utc`
- All-day CalendarEvent: use `datetime.date` (not `datetime.datetime`) for start/end

### 7.2 calendar.get_events Response Variable
- Known issues with `response_variable` in script contexts (issue #153320, #140316)
- Use `blocking=True, return_response=True` for programmatic calls
- Response keyed by entity_id string: `response["calendar.my_cal"]["events"]`

### 7.3 CalendarEvent uid Missing from CalDAV
- CalDAV integration does not always populate `uid` (issue #170761, still open as of 2026)
- Do not rely on `uid` being non-None for read-only holiday checks

### 7.4 HA Core Does Not Expand RRULE
- Aurora's CalendarEntity **must** expand recurring alarms itself in `async_get_events`
- Do not set `rrule` on CalendarEvent and expect HA to expand it
- Core passes `rrule` through as a string for client display only

### 7.5 Calendar Poll Interval
- Calendar triggers fire based on polling (every ~15 minutes)
- Do not use calendar trigger for real-time alarm decisions
- Use coordinator-based next-alarm calculation instead

### 7.6 scheduler-component Entity Pattern
- scheduler-component entities are `switch.schedule_*` — not calendar entities
- No official HA API to read scheduler-component schedules from another integration
- Do not depend on it; internalize schedule storage

### 7.7 Python 3.13 Compatibility
- HA ships Python 3.13 in 2026 (supervisor 2026.05.1 moved to 3.14 but core remains 3.13 as of 2026.6)
- `from __future__ import annotations` required for all files (deferred evaluation)
- Use `X | Y` union types (not `Union[X, Y]`)
- `StrEnum` available from stdlib `enum` (Python 3.11+)

---

## 8. Sources

- HA 2026.6 release: https://www.home-assistant.io/blog/2026/06/03/release-20266/
- CalendarEntity developer docs: https://developers.home-assistant.io/docs/core/entity/calendar/
- Calendar component source: https://github.com/home-assistant/core/blob/dev/homeassistant/components/calendar/__init__.py
- local_calendar implementation: https://github.com/home-assistant/core/blob/dev/homeassistant/components/local_calendar/calendar.py
- Holiday calendar implementation: https://github.com/home-assistant/core/blob/dev/homeassistant/components/holiday/calendar.py
- Workday binary sensor: https://github.com/home-assistant/core/blob/dev/homeassistant/components/workday/binary_sensor.py
- Workday entity (BaseWorkdayEntity): https://github.com/home-assistant/core/blob/dev/homeassistant/components/workday/entity.py
- Calendar integration user docs: https://www.home-assistant.io/integrations/calendar/
- Workday integration user docs: https://www.home-assistant.io/integrations/workday/
- Holiday integration user docs: https://www.home-assistant.io/integrations/holiday/
- Recurring events architecture: https://github.com/home-assistant/architecture/discussions/797
- Calendar event subscription API: https://github.com/home-assistant/architecture/discussions/1306
- get_events merge discussion: https://github.com/home-assistant/architecture/discussions/1045
- IQS documentation: https://developers.home-assistant.io/docs/core/integration-quality-scale/
- Python version ADR: https://github.com/home-assistant/architecture/blob/master/adr/0020-minimum-supported-python-version.md
- scheduler-component HACS: https://github.com/nielsfaber/scheduler-component
- vacanza/python-holidays: https://github.com/vacanza/holidays
- CalDAV uid issue: https://github.com/home-assistant/core/issues/170761
- calendar.get_events response_variable issue: https://github.com/home-assistant/core/issues/153320
