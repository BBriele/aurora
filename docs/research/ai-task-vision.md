# AI Task, LLM Vision & Robust Async AI — Implementation Research Notes

**Project:** Aurora (HA alarm clock integration)
**Target platform:** Home Assistant 2026.6.x (stable as of June 2026)
**Python version:** 3.14.5 (shipped with HA 2026.6 base image; minimum sensible target: 3.13)
**Research date:** 2026-06-15
**Sources:** developers.home-assistant.io, github.com/home-assistant/core (dev branch), github.com/valentinfrlch/ha-llmvision

---

## 1. Platform Context

| Item | Value |
|------|-------|
| Current stable | HA 2026.6.3 (released 2026-06-12) |
| Python shipped | 3.14.5 (base image bumped 2026.06 cycle) |
| Min Python (HA requirement) | >=3.14.2 |
| Recommended target for Aurora | 3.13+ (syntax), test on 3.14 |

**HA 2026.6 AI-relevant changelog items:**
- `Fix ai_task camera snapshot mime type` (PR #172682) — affects multimodal attachments
- `Sort aliases in LLM prompts for stable prefix caching` (PR #173558) — important for cost
- `Reorder device location context towards the end of the Assist LLM instructions` (PR #172152)
- `Update AI instructions for Python 3.14 forward references` (PR #169524)

---

## 2. `ai_task` Integration — Complete API Reference

### 2.1 Source Locations (HA Core dev branch)

```
homeassistant/components/ai_task/__init__.py   — service registration, AITaskPreferences
homeassistant/components/ai_task/entity.py     — AITaskEntity base class
homeassistant/components/ai_task/task.py       — GenDataTask, GenDataTaskResult, async_generate_data
homeassistant/components/ai_task/const.py      — AITaskEntityFeature, DOMAIN, constants
homeassistant/components/ai_task/http.py       — WebSocket API for preferences
```

### 2.2 Constants (const.py)

```python
from homeassistant.components.ai_task.const import (
    DOMAIN,                  # "ai_task"
    AITaskEntityFeature,
    SERVICE_GENERATE_DATA,   # "generate_data"
    SERVICE_GENERATE_IMAGE,  # "generate_image"
    ATTR_INSTRUCTIONS,       # "instructions"
    ATTR_TASK_NAME,          # "task_name"
    ATTR_STRUCTURE,          # "structure"
    ATTR_REQUIRED,           # "required"
    ATTR_ATTACHMENTS,        # "attachments"
    DATA_COMPONENT,          # HassKey for EntityComponent
    DATA_PREFERENCES,        # HassKey for AITaskPreferences
)

class AITaskEntityFeature(IntFlag):
    GENERATE_DATA      = 1   # Generate data from instructions
    SUPPORT_ATTACHMENTS = 2  # Accept attachments (images/media) with generate_data
    GENERATE_IMAGE     = 4   # Generate images from instructions
```

### 2.3 Public Module-Level Function — `async_generate_data`

The **correct import** for calling from a custom integration:

```python
from homeassistant.components.ai_task import async_generate_data
# or equivalently:
from homeassistant.components.ai_task.task import async_generate_data
```

**Full signature (from task.py, dev branch):**

```python
async def async_generate_data(
    hass: HomeAssistant,
    *,
    task_name: str,
    entity_id: str | None = None,    # Uses AITaskPreferences.gen_data_entity_id if None
    instructions: str,
    structure: vol.Schema | None = None,   # Pre-validated voluptuous Schema
    attachments: list[dict] | None = None, # [{media_content_id, media_content_type?}]
    llm_api: llm.API | None = None,
) -> GenDataTaskResult:
```

**What it does internally:**
1. Resolves `entity_id` from `hass.data[DATA_PREFERENCES].gen_data_entity_id` if `None`
2. Looks up the `AITaskEntity` via `hass.data[DATA_COMPONENT].get_entity(entity_id)`
3. Checks `AITaskEntityFeature.GENERATE_DATA` and `SUPPORT_ATTACHMENTS` on the entity
4. Creates a `ChatSession` via `async_get_chat_session(hass)`
5. Resolves attachments (camera entities via `media-source://camera/<entity_id>` URIs)
6. Calls `entity.internal_async_generate_data(session, GenDataTask(...))`

**Result type:**

```python
@dataclass(slots=True)
class GenDataTaskResult:
    conversation_id: str   # UUID string — for tracking only, not for follow-up
    data: Any              # str if no structure; dict matching structure schema if structured

    def as_dict(self) -> dict[str, Any]:
        return {"conversation_id": self.conversation_id, "data": self.data}
```

### 2.4 `GenDataTask` Dataclass (task.py)

```python
@dataclass(slots=True)
class GenDataTask:
    name: str                                    # task_name
    instructions: str
    structure: vol.Schema | None = None          # Optional voluptuous Schema
    attachments: list[conversation.Attachment] | None = None  # Already-resolved
    llm_api: llm.API | None = None
```

### 2.5 Structured Output — Schema Format

The `structure` parameter in the **service call** (YAML/action) uses the selector dict format, which `__init__.py` validates and converts to a `vol.Schema` before calling `async_generate_data`.

**YAML/action call format:**

```yaml
action: ai_task.generate_data
data:
  task_name: "alarm_context_analysis"
  instructions: |
    Analyze the alarm trigger context and classify the event.
    Camera: {{ states('camera.front_door') }}
    Time: {{ now().strftime('%H:%M') }}
  structure:
    event_type:
      description: "Type of event detected"
      required: true
      selector:
        select:
          options: ["person", "vehicle", "animal", "motion", "unknown"]
    confidence:
      description: "Confidence level 0-100"
      required: true
      selector:
        number:
          min: 0
          max: 100
    should_trigger_alarm:
      description: "Whether this warrants alarm activation"
      required: true
      selector:
        boolean:
    summary:
      description: "Brief human-readable description"
      required: false
      selector:
        text:
  attachments:
    - media_content_id: "media-source://camera/camera.front_door"
      media_content_type: "image/jpeg"
response_variable: ai_result
```

**Result access:**
```yaml
# ai_result.data.event_type, ai_result.data.confidence, etc.
# ai_result.conversation_id  (UUID string)
```

**Python code calling the function directly:**

```python
import voluptuous as vol
from homeassistant.helpers import selector
from homeassistant.components.ai_task import async_generate_data, GenDataTaskResult

# Build the structure schema the same way __init__.py does it
def build_structure_schema(fields: dict) -> vol.Schema:
    """Build a vol.Schema from selector-format field dicts."""
    schema_fields = {}
    for key, field_def in fields.items():
        field_class = vol.Required if field_def.get("required", False) else vol.Optional
        schema_fields[field_class(key, description=field_def.get("description"))] = (
            selector.selector(field_def["selector"])
        )
    return vol.Schema(schema_fields, extra=vol.PREVENT_EXTRA)

# Call from within a coroutine:
result: GenDataTaskResult = await async_generate_data(
    hass,
    task_name="aurora_alarm_analysis",
    entity_id="ai_task.google_generative_ai",  # or None for preferred
    instructions="Classify this alarm event...",
    structure=build_structure_schema({
        "threat_level": {
            "description": "Threat level 1-5",
            "required": True,
            "selector": {"number": {"min": 1, "max": 5}},
        }
    }),
    attachments=[
        {"media_content_id": "media-source://camera/camera.front_door"}
    ],
)
# result.data["threat_level"]  -> int
```

### 2.6 `AITaskEntity` Base Class (entity.py)

```python
from homeassistant.components.ai_task import AITaskEntity
from homeassistant.components.ai_task.const import AITaskEntityFeature
from homeassistant.components.ai_task.task import GenDataTask, GenDataTaskResult
from homeassistant.components.conversation import ChatLog

class MyAITaskEntity(AITaskEntity):
    """Custom AI Task entity (e.g. wrapping a local model)."""

    _attr_supported_features = (
        AITaskEntityFeature.GENERATE_DATA | AITaskEntityFeature.SUPPORT_ATTACHMENTS
    )
    _attr_name = "My Local AI"
    _attr_unique_id = "my_local_ai_task"

    async def _async_generate_data(
        self,
        task: GenDataTask,
        chat_log: ChatLog,          # Already populated with system prompt + user content
    ) -> GenDataTaskResult:
        """Implement the actual AI call here."""
        # chat_log already has:
        #   - system prompt (DEFAULT_SYSTEM_PROMPT from const.py)
        #   - UserContent with task.instructions + task.attachments
        # You call your LLM, then return:
        return GenDataTaskResult(
            conversation_id=chat_log.conversation_id,
            data={"result": "..."},   # Must match task.structure if set
        )
```

**Key implementation notes:**
- The `internal_async_generate_data` (final) method sets `__last_activity`, writes HA state, then calls `_async_generate_data`. Never override `internal_async_generate_data`.
- `ChatLog` is provided already containing system prompt + `UserContent(task.instructions, attachments=task.attachments)`. The entity just needs to forward to the LLM.
- Default system prompt: `"You are a Home Assistant expert and help users with their tasks."`

### 2.7 `AITaskPreferences` — Default Entity Selection

The user sets their preferred ai_task entity via Settings > Voice assistants > AI Task in the UI (websocket: `ai_task/preferences/set`). This stores `gen_data_entity_id` in `.storage/ai_task`.

**Reading from Python:**
```python
prefs = hass.data[DATA_PREFERENCES]
default_entity_id = prefs.gen_data_entity_id  # str | None
```

**Programmatic entity enumeration:**
```python
from homeassistant.components.ai_task.const import DATA_COMPONENT, AITaskEntityFeature

component = hass.data[DATA_COMPONENT]
available_entities = [
    entity
    for entity in component.entities
    if AITaskEntityFeature.GENERATE_DATA in entity.supported_features
]
# For multimodal (camera images):
vision_capable = [
    e for e in available_entities
    if AITaskEntityFeature.SUPPORT_ATTACHMENTS in e.supported_features
]
```

### 2.8 Supported AI Providers (as of 2026.6)

Integrations that register `AITaskEntity` with `GENERATE_DATA`:
- `google_generative_ai` — Gemini models
- `openai` — GPT-4o, etc.
- `ollama` — local Ollama models (structured output issues with some models)
- `anthropic` — Claude models
- Azure OpenAI

**Known issues:**
- Ollama with `gpt-oss` model: `ai_task.generate_data` fails when `structure` is set (Issue #152337)
- Google Generative AI: structured output fails with `gemma-3-27b-it` (Issue #151841)
- Both indicate the entity validates the model's JSON schema capability

---

## 3. LLM Vision Integration

**Domain:** `llmvision`
**Type:** HACS custom integration (not a built-in HA integration)
**Source:** github.com/valentinfrlch/ha-llmvision
**Last major version:** v1.5.2 (October 2025)

### 3.1 Services

All services are registered via `hass.services.register()` in `setup()` (not `async_setup`):

| Service | Purpose |
|---------|---------|
| `llmvision.image_analyzer` | Analyze static images from camera/image entities or file paths |
| `llmvision.video_analyzer` | Analyze video files (frames extracted sequentially) |
| `llmvision.stream_analyzer` | Capture and analyze frames from live camera feeds |
| `llmvision.data_analyzer` | Analyze visual data, update HA sensor entities |
| `llmvision.create_event` | Manually create a timeline event |
| `llmvision.get_events` | Retrieve filtered timeline events |

All return `SupportsResponse.ONLY`.

### 3.2 `llmvision.image_analyzer` — Full Parameters

```yaml
action: llmvision.image_analyzer
data:
  provider: "01JAAFDSVEJEBMESBP62QP156T"   # REQUIRED: config entry ID (ULID string)
  message: "Describe what you see"          # REQUIRED: prompt text (truncated to 2000 chars)
  image_entity:                             # One of image_entity OR image_file required
    - camera.front_door
    - image.garage_snapshot
  image_file: |                             # Newline-separated file paths (alternative)
    /config/www/tmp/front.jpg
    /config/www/tmp/back.jpg
  model: "gpt-4o-mini"                     # Optional; defaults to config entry default
  max_tokens: 1000                         # Default: 3000
  include_filename: false                  # Default: false
  target_width: 1280                       # Default: 3840 (px; set lower for speed/cost)
  store_in_timeline: false                 # Default: false
  use_memory: false                        # Default: false
  generate_title: false                    # Default: false
  expose_images: false                     # Default: false (saves to /media/llmvision/snapshots)
  response_format: "text"                  # "text" or "json"
  structure:                               # JSON schema for structured responses (when json)
    event_type: {type: string}
  title_field: "title"                     # JSON field name for title (when generate_title)
  description_field: "description"         # JSON field name for description
response_variable: vision_result
# vision_result contains: {response_text, title?, structured_response?, key_frame?}
```

### 3.3 Provider Parameter — Config Entry ID

**Critical detail:** The `provider` field takes the **config entry ID** (a ULID string like `01JAAFDSVEJEBMESBP62QP156T`), NOT a human-readable provider name string.

The services.yaml selector for `provider`:
```yaml
provider:
  selector:
    config_entry:
      integration: llmvision
```

This uses HA's built-in `ConfigEntrySelector` which returns the `entry.entry_id` string. The UI displays the entry title/name but passes the ID.

**How LLM Vision looks up the provider from the ID:**

```python
# In providers.py - Request class:
@staticmethod
def get_provider(hass, provider_uid):
    """Translate UID of the config entry into provider name"""
    if DOMAIN not in hass.data:
        return None
    entry_data = hass.data[DOMAIN].get(provider_uid)
    if not entry_data:
        return None
    return entry_data.get(CONF_PROVIDER)  # Returns "OpenAI", "Anthropic", etc.

# In async_setup_entry, each entry is stored as:
hass.data[DOMAIN][entry.entry_id] = {
    CONF_PROVIDER: entry.data.get(CONF_PROVIDER),  # "OpenAI"|"Anthropic"|"Settings"|etc.
    CONF_API_KEY: ...,
    CONF_DEFAULT_MODEL: ...,
    # ... provider-specific fields
}
```

**The "Settings" entry** (provider name == `"Settings"`) is the timeline/retention config, NOT a vision provider. It must be excluded when enumerating vision providers.

### 3.4 Enumerating LLM Vision Providers Programmatically

To populate a config flow selector or option with all available LLM Vision providers:

```python
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

LLMVISION_DOMAIN = "llmvision"

def get_llmvision_providers(hass: HomeAssistant) -> list[dict[str, str]]:
    """
    Return list of dicts suitable for a vol.In() or selector.
    Each dict: {"entry_id": <ulid>, "title": <human name>, "provider": <provider type>}
    """
    providers = []
    for entry in hass.config_entries.async_entries(LLMVISION_DOMAIN):
        if entry.data.get("provider") == "Settings":
            continue   # Skip the Settings/timeline entry
        providers.append({
            "entry_id": entry.entry_id,
            "title": entry.title,
            "provider": entry.data.get("provider", "Unknown"),
        })
    return providers


def is_llmvision_installed(hass: HomeAssistant) -> bool:
    """Check if LLM Vision is installed and has at least one vision provider."""
    return len(get_llmvision_providers(hass)) > 0


# For a config_flow options selector:
def build_llmvision_selector(hass: HomeAssistant) -> dict:
    """Build a selector dict for LLM Vision provider choice."""
    providers = get_llmvision_providers(hass)
    if not providers:
        return {}
    return {
        "select": {
            "options": [
                {"value": p["entry_id"], "label": f"{p['title']} ({p['provider']})"}
                for p in providers
            ]
        }
    }
```

**Degrade gracefully if not installed:**

```python
async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Aurora."""
    vision_provider = entry.options.get("vision_provider")  # entry_id or None

    if vision_provider:
        # Verify the chosen entry still exists
        vision_entry = hass.config_entries.async_get_entry(vision_provider)
        if vision_entry is None or vision_entry.domain != LLMVISION_DOMAIN:
            _LOGGER.warning(
                "Configured LLM Vision provider %s not found; "
                "vision features will be disabled",
                vision_provider,
            )
            vision_provider = None

    hass.data[DOMAIN]["vision_provider"] = vision_provider
    # ... rest of setup
```

### 3.5 Calling LLM Vision Service Programmatically from Python

```python
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

async def analyze_camera_image(
    hass: HomeAssistant,
    provider_entry_id: str,
    camera_entity_id: str,
    prompt: str,
    max_tokens: int = 500,
) -> dict | None:
    """Call llmvision.image_analyzer and return result dict or None on failure."""
    try:
        result = await hass.services.async_call(
            "llmvision",
            "image_analyzer",
            {
                "provider": provider_entry_id,
                "message": prompt,
                "image_entity": [camera_entity_id],
                "max_tokens": max_tokens,
                "include_filename": False,
                "target_width": 1280,
            },
            blocking=True,
            return_response=True,
        )
        return result  # dict with "response_text" key
    except (HomeAssistantError, ServiceValidationError) as err:
        _LOGGER.error("LLM Vision call failed: %s", err)
        return None
```

### 3.6 Supported Providers (as of v1.5.2)

- OpenAI, OpenRouter, Anthropic, Google Gemini
- AWS Bedrock, Azure OpenAI
- Groq (no multiple images/video)
- Ollama, Open WebUI, LocalAI
- Any OpenAI-compatible endpoint (Custom OpenAI)

**Fallback provider:** Configured in the "Settings" entry as `fallback_provider`. LLM Vision automatically retries with fallback on provider failure.

---

## 4. Multimodal Conversation as VisionProvider Alternative

### 4.1 Pattern

Instead of using LLM Vision (a HACS dependency), Aurora can use HA's native `ai_task.generate_data` with `SUPPORT_ATTACHMENTS` for multimodal analysis. This requires the selected `AITaskEntity` to support `SUPPORT_ATTACHMENTS`.

**Attachment format for `ai_task.generate_data`:**

```python
attachments = [
    {
        "media_content_id": f"media-source://camera/{camera_entity_id}",
        # media_content_type is optional; defaults to entity's content type
    }
]
```

The `_resolve_attachments` function in `task.py` handles:
- `media-source://camera/<entity_id>` → calls `camera.async_get_image()`
- `media-source://image/<entity_id>` → calls `image.async_get_image()`
- Other media sources → `media_source.async_resolve_media()` (local files only)

### 4.2 Checking Vision Capability

```python
from homeassistant.components.ai_task.const import DATA_COMPONENT, AITaskEntityFeature

def get_vision_capable_ai_task_entities(hass: HomeAssistant) -> list:
    """Return ai_task entities that support both data generation and attachments."""
    component = hass.data.get(DATA_COMPONENT)
    if component is None:
        return []
    return [
        entity
        for entity in component.entities
        if (
            AITaskEntityFeature.GENERATE_DATA in entity.supported_features
            and AITaskEntityFeature.SUPPORT_ATTACHMENTS in entity.supported_features
        )
    ]
```

### 4.3 Direct `async_converse` for Vision (Legacy Pattern)

The `conversation.async_converse()` API can also be used, but it does NOT natively support image attachments through the standard action/service layer. Multimodal content must go through `ai_task.generate_data` with attachments. The `conversation` domain's `ChatLog` does support `Attachment` objects but they are assembled by `ai_task.task._resolve_attachments`, not by the conversation layer directly.

**Data classes (homeassistant.components.conversation.chat_log):**

```python
@dataclass(frozen=True)
class Attachment:
    media_content_id: str
    mime_type: str
    path: Path            # Local disk path (resolved from media-source)

@dataclass(frozen=True)
class UserContent:
    role: Literal["user"]         # set by field(init=False)
    content: str
    attachments: list[Attachment] | None = field(default=None)
    created: datetime             # set by field(init=False)
```

---

## 5. Idiomatic Async Patterns for Non-Blocking AI Calls

### 5.1 Current Timeout Pattern (Python 3.11+, used in HA 2024+)

The `async_timeout` library is **deprecated** in HA 2024+. Use `asyncio.timeout` (stdlib, Python 3.11+):

```python
import asyncio
from homeassistant.exceptions import HomeAssistantError

async def call_ai_with_timeout(hass, entity_id: str, instructions: str, timeout: float = 30.0):
    """Call ai_task with timeout."""
    try:
        async with asyncio.timeout(timeout):
            return await async_generate_data(
                hass,
                task_name="aurora_analysis",
                entity_id=entity_id,
                instructions=instructions,
            )
    except TimeoutError:
        raise HomeAssistantError(f"AI task timed out after {timeout}s")
    except HomeAssistantError:
        raise
    except Exception as err:
        raise HomeAssistantError(f"AI task failed: {err}") from err
```

**Important:** `asyncio.timeout` MUST be used inside a running asyncio task. HA calls integrations from within tasks, so this is always safe in service handlers and entity methods.

**Known issue (HA 2026.2.4+):** `RuntimeError: Timeout should be used inside a task` can appear if timeout is used at module-load time or in synchronous contexts. Always wrap in an `async def`.

### 5.2 Retry with Exponential Backoff

```python
import asyncio
import logging
from collections.abc import Callable, Coroutine
from typing import Any, TypeVar

_LOGGER = logging.getLogger(__name__)
T = TypeVar("T")

async def async_retry(
    coro_factory: Callable[[], Coroutine[Any, Any, T]],
    *,
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 10.0,
    timeout_per_attempt: float = 30.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
) -> T:
    """Retry a coroutine with exponential backoff."""
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            async with asyncio.timeout(timeout_per_attempt):
                return await coro_factory()
        except TimeoutError as exc:
            last_exc = exc
            _LOGGER.warning("Attempt %d timed out after %ss", attempt + 1, timeout_per_attempt)
        except exceptions as exc:
            last_exc = exc
            _LOGGER.warning("Attempt %d failed: %s", attempt + 1, exc)

        if attempt < max_attempts - 1:
            delay = min(base_delay * (2 ** attempt), max_delay)
            await asyncio.sleep(delay)

    raise RuntimeError(f"All {max_attempts} attempts failed") from last_exc


# Usage in Aurora:
result = await async_retry(
    lambda: async_generate_data(
        hass,
        task_name="alarm_classify",
        entity_id=entity_id,
        instructions=instructions,
    ),
    max_attempts=2,
    timeout_per_attempt=25.0,
    base_delay=2.0,
)
```

### 5.3 Circuit Breaker Pattern

```python
import time
from dataclasses import dataclass, field
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject calls immediately
    HALF_OPEN = "half_open"  # Testing if service recovered

@dataclass
class CircuitBreaker:
    """Simple circuit breaker for AI service calls."""

    failure_threshold: int = 3        # Failures before opening
    recovery_timeout: float = 60.0    # Seconds to wait before half-open
    success_threshold: int = 1        # Successes in half-open before closing

    _state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    _failure_count: int = field(default=0, init=False)
    _success_count: int = field(default=0, init=False)
    _last_failure_time: float = field(default=0.0, init=False)

    def is_call_permitted(self) -> bool:
        """Check if a call should be attempted."""
        if self._state == CircuitState.CLOSED:
            return True
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._success_count = 0
                return True
            return False
        return True  # HALF_OPEN: allow one test call

    def on_success(self) -> None:
        """Record a successful call."""
        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self.success_threshold:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
        elif self._state == CircuitState.CLOSED:
            self._failure_count = 0

    def on_failure(self) -> None:
        """Record a failed call."""
        self._failure_count += 1
        self._last_failure_time = time.monotonic()
        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
        elif self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN

    @property
    def state(self) -> CircuitState:
        return self._state


async def protected_ai_call(
    circuit: CircuitBreaker,
    coro_factory,
    fallback=None,
):
    """Call AI with circuit breaker protection."""
    if not circuit.is_call_permitted():
        _LOGGER.info("Circuit breaker OPEN, using fallback")
        return fallback
    try:
        result = await coro_factory()
        circuit.on_success()
        return result
    except Exception:
        circuit.on_failure()
        raise
```

### 5.4 Rolling Latency Stats

```python
from collections import deque
import time

class LatencyTracker:
    """Track rolling AI call latency statistics."""

    def __init__(self, window: int = 20) -> None:
        self._samples: deque[float] = deque(maxlen=window)

    def record(self, latency_ms: float) -> None:
        self._samples.append(latency_ms)

    @property
    def avg_ms(self) -> float | None:
        if not self._samples:
            return None
        return sum(self._samples) / len(self._samples)

    @property
    def p95_ms(self) -> float | None:
        if not self._samples:
            return None
        sorted_samples = sorted(self._samples)
        idx = int(len(sorted_samples) * 0.95)
        return sorted_samples[min(idx, len(sorted_samples) - 1)]

    def as_dict(self) -> dict:
        return {
            "samples": len(self._samples),
            "avg_ms": self.avg_ms,
            "p95_ms": self.p95_ms,
        }


# Usage wrapper:
async def timed_ai_call(tracker: LatencyTracker, coro_factory):
    start = time.monotonic()
    try:
        result = await coro_factory()
        tracker.record((time.monotonic() - start) * 1000)
        return result
    except Exception:
        tracker.record((time.monotonic() - start) * 1000)  # record even on failure
        raise
```

### 5.5 Fire-and-Forget AI Call (Non-blocking)

For Aurora's "analyze and update" pattern where we don't need to block the alarm pipeline:

```python
async def async_trigger_background_vision_analysis(
    hass: HomeAssistant,
    camera_entity_id: str,
    callback_fn,  # async callable(result: dict | None) -> None
) -> None:
    """Schedule vision analysis without blocking the caller."""

    async def _do_analysis() -> None:
        result = None
        try:
            async with asyncio.timeout(30):
                result = await hass.services.async_call(
                    "llmvision",
                    "image_analyzer",
                    {"provider": ..., "image_entity": [camera_entity_id], ...},
                    blocking=True,
                    return_response=True,
                )
        except Exception as err:
            _LOGGER.error("Background vision analysis failed: %s", err)
        finally:
            await callback_fn(result)

    hass.async_create_task(_do_analysis(), eager_start=True)
```

---

## 6. Aurora Integration Design — VisionProvider Abstraction

Aurora should define an abstract `VisionProvider` protocol so either `ai_task` (built-in) or `llmvision` (HACS) can be used:

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class VisionProvider(Protocol):
    """Protocol for vision analysis providers."""

    async def analyze_image(
        self,
        camera_entity_id: str,
        prompt: str,
        structure: dict | None = None,
    ) -> dict | None:
        """Analyze image and return structured result or None."""
        ...

    @property
    def is_available(self) -> bool:
        """Return True if the provider is currently available."""
        ...


class AiTaskVisionProvider:
    """Vision via HA built-in ai_task (SUPPORT_ATTACHMENTS required)."""

    def __init__(self, hass: HomeAssistant, entity_id: str) -> None:
        self._hass = hass
        self._entity_id = entity_id
        self._circuit = CircuitBreaker()
        self._latency = LatencyTracker()

    @property
    def is_available(self) -> bool:
        from homeassistant.components.ai_task.const import DATA_COMPONENT, AITaskEntityFeature
        component = self._hass.data.get(DATA_COMPONENT)
        if not component:
            return False
        entity = component.get_entity(self._entity_id)
        return (
            entity is not None
            and AITaskEntityFeature.SUPPORT_ATTACHMENTS in entity.supported_features
        )

    async def analyze_image(self, camera_entity_id, prompt, structure=None):
        if not self._circuit.is_call_permitted():
            return None
        try:
            result = await timed_ai_call(
                self._latency,
                lambda: async_generate_data(
                    self._hass,
                    task_name="aurora_vision",
                    entity_id=self._entity_id,
                    instructions=prompt,
                    structure=build_structure_schema(structure) if structure else None,
                    attachments=[{
                        "media_content_id": f"media-source://camera/{camera_entity_id}"
                    }],
                )
            )
            self._circuit.on_success()
            return result.data
        except Exception as err:
            self._circuit.on_failure()
            _LOGGER.error("AiTask vision failed: %s", err)
            return None


class LlmVisionProvider:
    """Vision via HACS LLM Vision integration."""

    def __init__(self, hass: HomeAssistant, provider_entry_id: str) -> None:
        self._hass = hass
        self._entry_id = provider_entry_id
        self._circuit = CircuitBreaker()
        self._latency = LatencyTracker()

    @property
    def is_available(self) -> bool:
        entry = self._hass.config_entries.async_get_entry(self._entry_id)
        return (
            entry is not None
            and entry.domain == "llmvision"
            and entry.data.get("provider") != "Settings"
        )

    async def analyze_image(self, camera_entity_id, prompt, structure=None):
        if not self._circuit.is_call_permitted():
            return None
        try:
            result = await timed_ai_call(
                self._latency,
                lambda: self._hass.services.async_call(
                    "llmvision", "image_analyzer",
                    {
                        "provider": self._entry_id,
                        "message": prompt,
                        "image_entity": [camera_entity_id],
                        "max_tokens": 500,
                        "include_filename": False,
                        "target_width": 1280,
                    },
                    blocking=True,
                    return_response=True,
                )
            )
            self._circuit.on_success()
            return result
        except Exception as err:
            self._circuit.on_failure()
            _LOGGER.error("LLM Vision failed: %s", err)
            return None
```

---

## 7. Config Flow — Provider Selection Pattern

In `config_flow.py` options flow, detect available providers dynamically:

```python
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector

class AuroraOptionsFlow(config_entries.OptionsFlow):

    async def async_step_ai_providers(self, user_input=None):
        """Step to configure AI/Vision providers."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        # Build ai_task entity options
        ai_task_options = self._get_ai_task_options()
        llmvision_options = self._get_llmvision_options()

        # Combined provider list with source tags
        all_options = ai_task_options + llmvision_options

        schema = vol.Schema({
            vol.Optional("vision_provider_type"): selector.selector({
                "select": {
                    "options": ["ai_task", "llmvision", "disabled"],
                }
            }),
            vol.Optional("ai_task_entity_id"): selector.selector({
                "entity": {"domain": "ai_task"}
            }) if ai_task_options else vol.Optional("ai_task_entity_id"),
            vol.Optional("llmvision_entry_id"): selector.selector({
                "config_entry": {"integration": "llmvision"}
            }) if llmvision_options else vol.Optional("llmvision_entry_id"),
        })

        return self.async_show_form(
            step_id="ai_providers",
            data_schema=schema,
            description_placeholders={
                "ai_task_count": str(len(ai_task_options)),
                "llmvision_count": str(len(llmvision_options)),
            },
        )

    def _get_ai_task_options(self) -> list[dict]:
        from homeassistant.components.ai_task.const import DATA_COMPONENT, AITaskEntityFeature
        component = self.hass.data.get(DATA_COMPONENT)
        if not component:
            return []
        return [
            {"value": e.entity_id, "label": e.name or e.entity_id}
            for e in component.entities
            if AITaskEntityFeature.SUPPORT_ATTACHMENTS in e.supported_features
        ]

    def _get_llmvision_options(self) -> list[dict]:
        return [
            {"value": e.entry_id, "label": e.title}
            for e in self.hass.config_entries.async_entries("llmvision")
            if e.data.get("provider") != "Settings"
        ]
```

---

## 8. Key Gotchas and Deprecations

### 8.1 `async_timeout` is GONE — use `asyncio.timeout`

```python
# WRONG (deprecated since HA 2022, removed 2024):
import async_timeout
async with async_timeout.timeout(30):
    ...

# CORRECT (Python 3.11+, HA 2024+):
import asyncio
async with asyncio.timeout(30):
    ...
```

### 8.2 LLM Vision `provider` parameter is a ULID entry ID, not a name

```yaml
# WRONG:
provider: "OpenAI"

# CORRECT (use config_entry selector in UI, which returns the ULID):
provider: "01JAAFDSVEJEBMESBP62QP156T"
```

### 8.3 ai_task structured output via service vs. Python

- Via **YAML/service**: Pass `structure` as a dict of `{field: {description, required, selector}}` — HA converts to `vol.Schema` internally.
- Via **Python** (`async_generate_data`): The `structure` param expects an already-built `vol.Schema`. Build it yourself using `selector.selector()`.

### 8.4 LLM Vision "Settings" entry must be excluded

When enumerating providers via `hass.config_entries.async_entries("llmvision")`, always filter out the entry where `entry.data.get("provider") == "Settings"`. This is the timeline/retention config, not a vision model.

### 8.5 ai_task requires `SUPPORT_ATTACHMENTS` for camera images

Not all ai_task entities support attachments. Check before calling:
```python
if AITaskEntityFeature.SUPPORT_ATTACHMENTS not in entity.supported_features:
    # Fall back to text-only or LLM Vision
```

### 8.6 LLM Vision uses `setup()` not `async_setup()`

LLM Vision registers services in the synchronous `setup()` hook. This is unusual but valid for HA integrations (HA runs synchronous setups in the executor). Custom integrations should use `async_setup()`.

### 8.7 Known Structured Output Failures (as of 2025.8-2026.6)

- Ollama + `gpt-oss` model → structured output fails (Issue #152337)
- Google + `gemma-3-27b-it` → structured output fails (Issue #151841)
- Mitigation: catch `HomeAssistantError` and retry without `structure`, then parse text response manually.

### 8.8 ai_task conversation_id is NOT for follow-up

The `GenDataTaskResult.conversation_id` is system-generated and used only for history tracking. You cannot use it to continue a conversation thread. Each `async_generate_data` call is independent.

---

## 9. Quick-Reference Import Cheatsheet

```python
# Core ai_task
from homeassistant.components.ai_task import (
    DOMAIN,
    AITaskEntity,
    AITaskEntityFeature,
    GenDataTask,
    GenDataTaskResult,
    async_generate_data,
    async_generate_image,
)
from homeassistant.components.ai_task.const import DATA_COMPONENT, DATA_PREFERENCES

# Conversation / Chat internals
from homeassistant.components.conversation.chat_log import (
    ChatLog,
    UserContent,
    AssistantContent,
    Attachment,
    async_get_chat_log,
)
from homeassistant.helpers.chat_session import async_get_chat_session

# Selector for config_entry (LLM Vision provider)
from homeassistant.helpers.selector import ConfigEntrySelector

# Timeout (use stdlib only)
import asyncio
# async with asyncio.timeout(30.0): ...
```

---

## 10. Source URLs

- HA ai_task `__init__.py`: https://github.com/home-assistant/core/blob/dev/homeassistant/components/ai_task/__init__.py
- HA ai_task `entity.py`: https://github.com/home-assistant/core/blob/dev/homeassistant/components/ai_task/entity.py
- HA ai_task `task.py`: https://github.com/home-assistant/core/blob/dev/homeassistant/components/ai_task/task.py
- HA ai_task `const.py`: https://github.com/home-assistant/core/blob/dev/homeassistant/components/ai_task/const.py
- HA ai_task developer docs: https://developers.home-assistant.io/docs/core/entity/ai-task/
- HA ai_task user docs: https://www.home-assistant.io/integrations/ai_task/
- Architecture discussion #1216 (structured data): https://github.com/home-assistant/architecture/discussions/1216
- Architecture discussion #1237 (AI Task integration): https://github.com/home-assistant/architecture/discussions/1237
- LLM Vision GitHub: https://github.com/valentinfrlch/ha-llmvision
- LLM Vision docs: https://llmvision.gitbook.io/getting-started/usage/image-analyzer
- HA conversation chat_log: https://github.com/home-assistant/core/blob/dev/homeassistant/components/conversation/chat_log.py
- HA 2026.6 changelog: https://www.home-assistant.io/changelogs/core-2026.6/
- HA async docs: https://developers.home-assistant.io/docs/asyncio_working_with_async/
