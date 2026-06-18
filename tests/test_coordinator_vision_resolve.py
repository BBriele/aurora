"""Tests for AuroraCoordinator._resolve_vision precedence chain.

CI-only: imports homeassistant at module scope; not collected on dev machines
that lack the HA package (the conftest shim skips such imports gracefully).

Spec: docs/superpowers/specs/2026-06-18-vision-layered-defaults-design.md
      Backend section — _resolve_vision resolver.

Precedence matrix tested:
- prompt:  per-alarm > profile > global > DEFAULT_VISION_PROMPT
- model:   profile > global > None
- timeout: profile > global > VISION_TIMEOUT_S
- retries: profile > global > VISION_MAX_ATTEMPTS
- blank string counts as "unset" at every level
- bad stored numbers fall back to the constant
"""

from unittest.mock import MagicMock

from custom_components.aurora.const import (
    CONF_PROFILES,
    VISION_MAX_ATTEMPTS,
    VISION_TIMEOUT_S,
)
from custom_components.aurora.coordinator import AuroraCoordinator
from custom_components.aurora.vision import DEFAULT_VISION_PROMPT

# ---------------------------------------------------------------------------
# Minimal fake alarm helpers
# ---------------------------------------------------------------------------


def _make_alarm(
    *,
    profile_id: str | None = None,
    vision_prompt: str | None = None,
) -> MagicMock:
    """Return a lightweight mock that satisfies _resolve_vision's attribute access."""
    alarm = MagicMock()
    alarm.profile_id = profile_id
    alarm.features.mission.vision_prompt = vision_prompt
    return alarm


def _make_coordinator(options: dict) -> AuroraCoordinator:
    """Return a coordinator whose config_entry.options is set to *options*.

    We only need _resolve_vision here; we don't call async_setup, so all the
    other coordinator machinery is left as MagicMock stubs.
    """
    coord = MagicMock(spec=AuroraCoordinator)
    coord.config_entry.options = options
    # Bind the real method to the mock instance.
    coord._resolve_vision = AuroraCoordinator._resolve_vision.__get__(coord)
    return coord


# ---------------------------------------------------------------------------
# 1. Built-in defaults (no options at all)
# ---------------------------------------------------------------------------


def test_resolve_vision_all_defaults() -> None:
    """With no options and no per-alarm prompt, every field is the built-in default."""
    coord = _make_coordinator({})
    alarm = _make_alarm()

    result = coord._resolve_vision(alarm)

    assert result["prompt"] == DEFAULT_VISION_PROMPT
    assert result["model"] is None
    assert result["timeout_s"] == float(VISION_TIMEOUT_S)
    assert result["retries"] == int(VISION_MAX_ATTEMPTS)


def test_resolve_vision_alarm_is_none() -> None:
    """_resolve_vision(None) must not raise and must return built-in defaults."""
    coord = _make_coordinator({})

    result = coord._resolve_vision(None)

    assert result["prompt"] == DEFAULT_VISION_PROMPT
    assert result["model"] is None
    assert result["timeout_s"] == float(VISION_TIMEOUT_S)
    assert result["retries"] == int(VISION_MAX_ATTEMPTS)


# ---------------------------------------------------------------------------
# 2. Global options layer
# ---------------------------------------------------------------------------


def test_resolve_vision_global_options_applied() -> None:
    """Global options override the built-in defaults."""
    coord = _make_coordinator(
        {
            "vision_prompt": "global prompt",
            "vision_model": "gemma3",
            "vision_timeout_s": 42,
            "vision_retries": 5,
        }
    )
    alarm = _make_alarm()

    result = coord._resolve_vision(alarm)

    assert result["prompt"] == "global prompt"
    assert result["model"] == "gemma3"
    assert result["timeout_s"] == 42.0
    assert result["retries"] == 5


# ---------------------------------------------------------------------------
# 3. Per-user profile layer overrides global
# ---------------------------------------------------------------------------


def test_resolve_vision_profile_beats_global() -> None:
    """Per-user profile values win over global options."""
    coord = _make_coordinator(
        {
            "vision_prompt": "global prompt",
            "vision_model": "global-model",
            "vision_timeout_s": 10,
            "vision_retries": 2,
            CONF_PROFILES: {
                "user-1": {
                    "vision_prompt": "profile prompt",
                    "vision_model": "profile-model",
                    "vision_timeout_s": 99,
                    "vision_retries": 7,
                }
            },
        }
    )
    alarm = _make_alarm(profile_id="user-1")

    result = coord._resolve_vision(alarm)

    assert result["prompt"] == "profile prompt"
    assert result["model"] == "profile-model"
    assert result["timeout_s"] == 99.0
    assert result["retries"] == 7


# ---------------------------------------------------------------------------
# 4. Per-alarm prompt beats profile and global (prompt only)
# ---------------------------------------------------------------------------


def test_resolve_vision_per_alarm_prompt_beats_profile() -> None:
    """Per-alarm vision_prompt wins over profile and global."""
    coord = _make_coordinator(
        {
            "vision_prompt": "global prompt",
            CONF_PROFILES: {
                "user-1": {"vision_prompt": "profile prompt"}
            },
        }
    )
    alarm = _make_alarm(profile_id="user-1", vision_prompt="alarm prompt")

    result = coord._resolve_vision(alarm)

    assert result["prompt"] == "alarm prompt"


def test_resolve_vision_per_alarm_prompt_beats_global_no_profile() -> None:
    """Per-alarm prompt wins even when there is no profile set."""
    coord = _make_coordinator({"vision_prompt": "global prompt"})
    alarm = _make_alarm(vision_prompt="alarm prompt")

    result = coord._resolve_vision(alarm)

    assert result["prompt"] == "alarm prompt"


# ---------------------------------------------------------------------------
# 5. Blank strings are treated as "unset" at every layer
# ---------------------------------------------------------------------------


def test_resolve_vision_blank_alarm_prompt_skips_to_profile() -> None:
    """Blank per-alarm vision_prompt must fall through to the profile value."""
    coord = _make_coordinator(
        {
            CONF_PROFILES: {"user-1": {"vision_prompt": "profile prompt"}},
        }
    )
    alarm = _make_alarm(profile_id="user-1", vision_prompt="")

    result = coord._resolve_vision(alarm)

    assert result["prompt"] == "profile prompt"


def test_resolve_vision_blank_profile_model_skips_to_global() -> None:
    """Blank profile model must fall through to the global model."""
    coord = _make_coordinator(
        {
            "vision_model": "global-model",
            CONF_PROFILES: {"user-1": {"vision_model": ""}},
        }
    )
    alarm = _make_alarm(profile_id="user-1")

    result = coord._resolve_vision(alarm)

    assert result["model"] == "global-model"


def test_resolve_vision_blank_global_model_returns_none() -> None:
    """Blank global model must resolve to None (provider default)."""
    coord = _make_coordinator({"vision_model": ""})
    alarm = _make_alarm()

    result = coord._resolve_vision(alarm)

    assert result["model"] is None


def test_resolve_vision_blank_profile_timeout_skips_to_global() -> None:
    """Blank profile timeout must fall through to the global setting."""
    coord = _make_coordinator(
        {
            "vision_timeout_s": 55,
            CONF_PROFILES: {"user-1": {"vision_timeout_s": ""}},
        }
    )
    alarm = _make_alarm(profile_id="user-1")

    result = coord._resolve_vision(alarm)

    assert result["timeout_s"] == 55.0


# ---------------------------------------------------------------------------
# 6. Bad stored numbers fall back to the built-in constant
# ---------------------------------------------------------------------------


def test_resolve_vision_bad_timeout_falls_back_to_constant() -> None:
    """Non-numeric timeout_s stored in options must fall back to VISION_TIMEOUT_S."""
    coord = _make_coordinator({"vision_timeout_s": "not-a-number"})
    alarm = _make_alarm()

    result = coord._resolve_vision(alarm)

    assert result["timeout_s"] == float(VISION_TIMEOUT_S)


def test_resolve_vision_bad_retries_falls_back_to_constant() -> None:
    """Non-numeric retries stored in options must fall back to VISION_MAX_ATTEMPTS."""
    coord = _make_coordinator({"vision_retries": "oops"})
    alarm = _make_alarm()

    result = coord._resolve_vision(alarm)

    assert result["retries"] == int(VISION_MAX_ATTEMPTS)


def test_resolve_vision_bad_profile_timeout_falls_back_to_constant() -> None:
    """Bad profile-level timeout_s must fall back to the built-in constant."""
    coord = _make_coordinator(
        {
            CONF_PROFILES: {"user-1": {"vision_timeout_s": object()}},
        }
    )
    alarm = _make_alarm(profile_id="user-1")

    result = coord._resolve_vision(alarm)

    assert result["timeout_s"] == float(VISION_TIMEOUT_S)


# ---------------------------------------------------------------------------
# 7. Profile not found / wrong type is handled gracefully
# ---------------------------------------------------------------------------


def test_resolve_vision_unknown_profile_id_falls_to_global() -> None:
    """An alarm with a profile_id that does not exist falls through to global."""
    coord = _make_coordinator(
        {
            "vision_model": "global-model",
            CONF_PROFILES: {"other-user": {"vision_model": "other-model"}},
        }
    )
    alarm = _make_alarm(profile_id="nonexistent-user")

    result = coord._resolve_vision(alarm)

    assert result["model"] == "global-model"


def test_resolve_vision_profiles_not_a_dict_falls_to_global() -> None:
    """If options[CONF_PROFILES] is not a dict, fall through to global gracefully."""
    coord = _make_coordinator(
        {
            "vision_model": "global-model",
            CONF_PROFILES: "bad-value",
        }
    )
    alarm = _make_alarm(profile_id="user-1")

    result = coord._resolve_vision(alarm)

    assert result["model"] == "global-model"


def test_resolve_vision_profile_value_not_a_dict_falls_to_global() -> None:
    """If the profile entry is not a dict, fall through to global gracefully."""
    coord = _make_coordinator(
        {
            "vision_model": "global-model",
            CONF_PROFILES: {"user-1": "not-a-dict"},
        }
    )
    alarm = _make_alarm(profile_id="user-1")

    result = coord._resolve_vision(alarm)

    assert result["model"] == "global-model"


# ---------------------------------------------------------------------------
# 8. Full precedence chain for each field (all four levels active at once)
# ---------------------------------------------------------------------------


def test_resolve_vision_full_chain_prompt() -> None:
    """Full four-level chain: per-alarm prompt wins over all."""
    coord = _make_coordinator(
        {
            "vision_prompt": "global",
            CONF_PROFILES: {"u": {"vision_prompt": "profile"}},
        }
    )
    # Level 1: per-alarm wins.
    r = coord._resolve_vision(_make_alarm(profile_id="u", vision_prompt="alarm"))
    assert r["prompt"] == "alarm"
    # Level 2: profile wins when no per-alarm.
    r = coord._resolve_vision(_make_alarm(profile_id="u", vision_prompt=""))
    assert r["prompt"] == "profile"
    # Level 3: global wins when profile blank.
    coord2 = _make_coordinator(
        {
            "vision_prompt": "global",
            CONF_PROFILES: {"u": {"vision_prompt": ""}},
        }
    )
    r = coord2._resolve_vision(_make_alarm(profile_id="u", vision_prompt=""))
    assert r["prompt"] == "global"
    # Level 4: built-in default when all blank.
    coord3 = _make_coordinator(
        {
            "vision_prompt": "",
            CONF_PROFILES: {"u": {"vision_prompt": ""}},
        }
    )
    r = coord3._resolve_vision(_make_alarm(profile_id="u", vision_prompt=""))
    assert r["prompt"] == DEFAULT_VISION_PROMPT


def test_resolve_vision_full_chain_model() -> None:
    """Full three-level chain for model (no per-alarm level)."""
    # Profile beats global.
    coord = _make_coordinator(
        {
            "vision_model": "global-model",
            CONF_PROFILES: {"u": {"vision_model": "profile-model"}},
        }
    )
    r = coord._resolve_vision(_make_alarm(profile_id="u"))
    assert r["model"] == "profile-model"
    # Global beats built-in.
    coord2 = _make_coordinator({"vision_model": "global-model"})
    assert coord2._resolve_vision(_make_alarm())["model"] == "global-model"
    # Built-in = None.
    coord3 = _make_coordinator({})
    assert coord3._resolve_vision(_make_alarm())["model"] is None


def test_resolve_vision_full_chain_timeout() -> None:
    """Full three-level chain for timeout_s."""
    coord = _make_coordinator(
        {
            "vision_timeout_s": 30,
            CONF_PROFILES: {"u": {"vision_timeout_s": 60}},
        }
    )
    assert coord._resolve_vision(_make_alarm(profile_id="u"))["timeout_s"] == 60.0

    coord2 = _make_coordinator({"vision_timeout_s": 30})
    assert coord2._resolve_vision(_make_alarm())["timeout_s"] == 30.0

    coord3 = _make_coordinator({})
    assert coord3._resolve_vision(_make_alarm())["timeout_s"] == float(VISION_TIMEOUT_S)


def test_resolve_vision_full_chain_retries() -> None:
    """Full three-level chain for retries."""
    coord = _make_coordinator(
        {
            "vision_retries": 3,
            CONF_PROFILES: {"u": {"vision_retries": 9}},
        }
    )
    assert coord._resolve_vision(_make_alarm(profile_id="u"))["retries"] == 9

    coord2 = _make_coordinator({"vision_retries": 3})
    assert coord2._resolve_vision(_make_alarm())["retries"] == 3

    coord3 = _make_coordinator({})
    assert coord3._resolve_vision(_make_alarm())["retries"] == int(VISION_MAX_ATTEMPTS)
