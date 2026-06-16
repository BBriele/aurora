"""Constants for the Aurora integration.

Aurora is a capability-first, provider-agnostic smart alarm clock. Nothing here
references a concrete entity, integration or brand: the core reasons in terms of
abstract *roles* (see :mod:`.capabilities`). Concrete bindings live in the config
entry, never in code.
"""

from typing import Final

DOMAIN: Final = "aurora"

# --- Versioning -------------------------------------------------------------
# Config-entry schema version (drives async_migrate_entry).
CONFIG_VERSION: Final = 1
CONFIG_MINOR_VERSION: Final = 1
# Persistent Store schema versions (drive Store migration).
STORAGE_VERSION: Final = 1
STORAGE_MINOR_VERSION: Final = 1

# --- Storage keys -----------------------------------------------------------
STORAGE_KEY_CONFIG: Final = f"{DOMAIN}.config"
STORAGE_KEY_ALARMS: Final = f"{DOMAIN}.alarms"

# --- Config-entry subentries ------------------------------------------------
SUBENTRY_TYPE_ALARM: Final = "alarm"

# --- Capability roles (abstract; bound to entities in the config entry) -----
ROLE_AUDIO_SINK: Final = "audio_sink"
ROLE_WAKE_LIGHT: Final = "wake_light"
ROLE_DISPLAY_SURFACE: Final = "display_surface"
ROLE_NOTIFY_CHANNEL: Final = "notify_channel"
ROLE_VISION_PROVIDER: Final = "vision_provider"
ROLE_SLEEP_SIGNAL: Final = "sleep_signal"
ROLE_PRESENCE_SIGNAL: Final = "presence_signal"
ROLE_CONVERSATION: Final = "conversation"
ROLE_TTS: Final = "tts"

ALL_ROLES: Final = (
    ROLE_AUDIO_SINK,
    ROLE_WAKE_LIGHT,
    ROLE_DISPLAY_SURFACE,
    ROLE_NOTIFY_CHANNEL,
    ROLE_VISION_PROVIDER,
    ROLE_SLEEP_SIGNAL,
    ROLE_PRESENCE_SIGNAL,
    ROLE_CONVERSATION,
    ROLE_TTS,
)

# --- Config-entry option keys (role bindings + globals) ---------------------
CONF_OWNER: Final = "owner"
CONF_ROLE_BINDINGS: Final = "role_bindings"
# Per-user profiles live under options["profiles"][ha_user_id] = {name, bindings}.
CONF_PROFILES: Final = "profiles"
CONF_PROFILE_BINDINGS: Final = "bindings"
CONF_PROFILE_NAME: Final = "name"
CONF_SKIP_CALENDARS: Final = "skip_calendars"
CONF_HOLIDAY_CALENDARS: Final = "holiday_calendars"
CONF_RING_MAX_DURATION: Final = "ring_max_duration"
# Briefing data sources (globals; the briefing speaks via the TTS role).
CONF_WEATHER: Final = "weather"
CONF_BRIEFING_CALENDARS: Final = "briefing_calendars"
CONF_TODO_LISTS: Final = "todo_lists"

# --- Service names ----------------------------------------------------------
SERVICE_ADD_ALARM: Final = "add_alarm"
SERVICE_UPDATE_ALARM: Final = "update_alarm"
SERVICE_REMOVE_ALARM: Final = "remove_alarm"
SERVICE_SKIP_NEXT: Final = "skip_next"
SERVICE_SNOOZE: Final = "snooze"
SERVICE_DISMISS: Final = "dismiss"
SERVICE_TRIGGER_NOW: Final = "trigger_now"
SERVICE_SPEAK_BRIEFING: Final = "speak_briefing"
SERVICE_BENCHMARK_VISION: Final = "benchmark_vision"

# --- Defaults ---------------------------------------------------------------
DEFAULT_RING_MAX_DURATION: Final = 600  # seconds; safety auto-stop watchdog
DEFAULT_SNOOZE_DURATION: Final = 540  # seconds (9 min)
DEFAULT_SNOOZE_MAX: Final = 3
DEFAULT_LIGHT_DURATION_MIN: Final = 30
DEFAULT_SMART_WINDOW_MIN: Final = 30

# --- Vision robustness defaults (tunable; confirmed via benchmark_vision) ----
VISION_TIMEOUT_S: Final = 25
VISION_MAX_ATTEMPTS: Final = 2
VISION_BACKOFF_BASE_S: Final = 2
VISION_BACKOFF_CAP_S: Final = 10
CIRCUIT_FAILURE_THRESHOLD: Final = 3
CIRCUIT_RECOVERY_S: Final = 60
LATENCY_WINDOW: Final = 20

# --- Frontend card ----------------------------------------------------------
CARD_FILENAME: Final = "aurora-card.js"
CARD_URL_BASE: Final = f"/{DOMAIN}_static"
CARD_URL: Final = f"{CARD_URL_BASE}/{CARD_FILENAME}"

# --- Known third-party domains (probed if present; never hard dependencies) --
# These are used ONLY by capability probes / known-adapter detection. The core
# works without any of them via generic adapters.
DOMAIN_LLM_VISION: Final = "llmvision"
DOMAIN_FULLY_KIOSK: Final = "fully_kiosk"
DOMAIN_BROWSER_MOD: Final = "browser_mod"
