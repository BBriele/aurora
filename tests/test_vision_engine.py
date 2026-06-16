"""Tests for the Aurora AI-vision engine.

Covers coordinator.async_vision_check, coordinator._async_vision_infer (via
async_vision_check), coordinator.async_vision_benchmark, and
coordinator.vision_latency_ms.  All external provider calls are mocked; no real
AI or file-system access is required.

Provider branches tested:
- ``ai_task.generate_data`` structured output (ROLE_VISION_PROVIDER = "ai_task.*")
- ``llmvision.image_analyzer`` free-text output (ROLE_VISION_PROVIDER absent,
  an llmvision config entry is present via a coordinator-level patch)

Circuit-breaker behaviour, latency tracking, and benchmark stats are also covered.
"""

import contextlib
import time
from typing import Any
from unittest.mock import MagicMock, patch

from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    CIRCUIT_FAILURE_THRESHOLD,
    DOMAIN,
    ROLE_VISION_PROVIDER,
    SERVICE_ADD_ALARM,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# A minimal valid JPEG in base64 — 1x1 red pixel.
_TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U"
    "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN"
    "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA"
    "AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA"
    "/9oADAMBAAIRAxEAPwCwABmX/9k="
)

# A well-formed data-URI form of the same image.
_TINY_JPEG_DATA_URI = f"data:image/jpeg;base64,{_TINY_JPEG_B64}"


async def _setup(
    hass: HomeAssistant,
    *,
    options: dict | None = None,
) -> MockConfigEntry:
    """Set up Aurora and return the loaded config entry."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options=options or {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _b64_image() -> str:
    """Return a plain base64 string (no data-URI prefix) for a tiny JPEG."""
    return _TINY_JPEG_B64


def _data_uri_image() -> str:
    """Return a data-URI-prefixed base64 JPEG."""
    return _TINY_JPEG_DATA_URI


def _patch_file_io() -> contextlib.AbstractContextManager:
    """Patch os.makedirs, open, os.path.exists, and os.remove to avoid real FS."""

    @contextlib.contextmanager
    def _ctx():
        """Inner context manager that stacks all file-IO patches."""
        with (
            patch("os.makedirs"),
            patch("builtins.open", MagicMock()),
            patch("os.path.exists", return_value=True),
            patch("os.remove"),
        ):
            yield

    return _ctx()


def _register_response_service(
    hass: HomeAssistant,
    domain: str,
    service: str,
    response: dict[str, Any],
) -> list[ServiceCall]:
    """Register a mock HA service that returns *response* from blocking calls.

    Unlike async_mock_service (which returns None), the handler here returns the
    response dict so coordinator code using ``return_response=True`` receives it.
    Returns the call-recording list for inspection.
    """
    calls: list[ServiceCall] = []

    async def _handler(call: ServiceCall) -> dict[str, Any]:
        """Record the call and return the canned response."""
        calls.append(call)
        return response

    hass.services.async_register(
        domain,
        service,
        _handler,
        supports_response=SupportsResponse.OPTIONAL,
    )
    return calls


# ---------------------------------------------------------------------------
# parse_verdict unit tests (pure, no HA)
# ---------------------------------------------------------------------------


def test_parse_verdict_yes() -> None:
    """parse_verdict returns True for leading affirmative answers."""
    from custom_components.aurora.vision import parse_verdict

    assert parse_verdict("YES, the person is awake") is True
    assert parse_verdict("yes") is True
    assert parse_verdict("awake and out of bed") is True
    assert parse_verdict("True") is True
    assert parse_verdict("si, è sveglio") is True
    assert parse_verdict("sì") is True
    assert parse_verdict("sveglio") is True


def test_parse_verdict_no() -> None:
    """parse_verdict returns False for negative answers and empty strings."""
    from custom_components.aurora.vision import parse_verdict

    assert parse_verdict("NO") is False
    assert parse_verdict("no") is False
    assert parse_verdict("not awake") is False
    assert parse_verdict("asleep") is False
    assert parse_verdict("") is False
    assert parse_verdict("   ") is False
    assert parse_verdict("non sveglio") is False


def test_parse_verdict_vague() -> None:
    """parse_verdict defaults to False when the answer contains no clear affirmative."""
    from custom_components.aurora.vision import parse_verdict

    assert parse_verdict("maybe") is False
    assert parse_verdict("I cannot tell") is False
    assert parse_verdict("unknown") is False


# ---------------------------------------------------------------------------
# CircuitBreaker unit tests (pure, no HA)
# ---------------------------------------------------------------------------


def test_circuit_breaker_starts_closed() -> None:
    """A fresh CircuitBreaker allows calls immediately."""
    from custom_components.aurora.vision import CircuitBreaker

    cb = CircuitBreaker(threshold=3, recovery_s=60.0)
    assert cb.allow(now=1000.0) is True
    assert cb.is_open is False


def test_circuit_breaker_opens_after_threshold() -> None:
    """CircuitBreaker trips after threshold consecutive failures."""
    from custom_components.aurora.vision import CircuitBreaker

    cb = CircuitBreaker(threshold=3, recovery_s=60.0)
    for _ in range(3):
        cb.record(ok=False, now=1000.0)
    assert cb.is_open is True
    assert cb.allow(now=1000.0) is False


def test_circuit_breaker_resets_on_success() -> None:
    """A single success after failures resets the CircuitBreaker."""
    from custom_components.aurora.vision import CircuitBreaker

    cb = CircuitBreaker(threshold=3, recovery_s=60.0)
    for _ in range(2):
        cb.record(ok=False, now=1000.0)
    cb.record(ok=True, now=1001.0)
    assert cb.is_open is False
    assert cb.allow(now=1001.0) is True


def test_circuit_breaker_recovers_after_window() -> None:
    """CircuitBreaker re-allows calls after the recovery window elapses."""
    from custom_components.aurora.vision import CircuitBreaker

    cb = CircuitBreaker(threshold=3, recovery_s=60.0)
    for _ in range(3):
        cb.record(ok=False, now=1000.0)
    # Still open inside the window.
    assert cb.allow(now=1059.0) is False
    # Open after the recovery window.
    assert cb.allow(now=1061.0) is True


# ---------------------------------------------------------------------------
# LatencyWindow unit tests (pure, no HA)
# ---------------------------------------------------------------------------


def test_latency_window_average_empty() -> None:
    """LatencyWindow.average returns None before any samples."""
    from custom_components.aurora.vision import LatencyWindow

    lw = LatencyWindow(size=5)
    assert lw.average() is None
    assert lw.count() == 0


def test_latency_window_average_and_eviction() -> None:
    """LatencyWindow computes average and evicts oldest when full."""
    from custom_components.aurora.vision import LatencyWindow

    lw = LatencyWindow(size=3)
    lw.add(100.0)
    lw.add(200.0)
    lw.add(300.0)
    assert lw.average() == 200
    assert lw.count() == 3
    # Adding a 4th value evicts 100, leaving [200, 300, 400] -> avg 300.
    lw.add(400.0)
    assert lw.average() == 300
    assert lw.count() == 3


# ---------------------------------------------------------------------------
# async_vision_check - ai_task provider branch (HA integration tests)
# ---------------------------------------------------------------------------


async def test_vision_check_ai_task_awake(hass: HomeAssistant) -> None:
    """async_vision_check returns awake=True when ai_task returns awake=True."""
    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    calls = _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": True}},
    )

    with _patch_file_io():
        result = await coordinator.async_vision_check(_b64_image(), None)

    assert result.get("awake") is True
    assert "error" not in result
    assert result.get("latency_ms") is not None
    assert calls, "ai_task.generate_data should have been called"


async def test_vision_check_ai_task_not_awake(hass: HomeAssistant) -> None:
    """async_vision_check returns awake=False when ai_task reports awake=False."""
    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": False}},
    )

    with _patch_file_io():
        result = await coordinator.async_vision_check(_b64_image(), None)

    assert result.get("awake") is False
    assert "error" not in result


async def test_vision_check_data_uri_stripped(hass: HomeAssistant) -> None:
    """async_vision_check strips the data-URI prefix before decoding."""
    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": True}},
    )

    with _patch_file_io():
        result = await coordinator.async_vision_check(_data_uri_image(), None)

    # No error from bad_image -- the prefix was stripped correctly.
    assert result.get("error") != "bad_image"
    assert result.get("awake") is True


async def test_vision_check_bad_image(hass: HomeAssistant) -> None:
    """async_vision_check returns error='bad_image' for invalid base64."""
    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    result = await coordinator.async_vision_check("not-valid-base64!!!", None)

    assert result.get("awake") is False
    assert result.get("error") == "bad_image"


async def test_vision_check_latency_populated(hass: HomeAssistant) -> None:
    """vision_latency_ms is populated after a successful async_vision_check."""
    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    assert coordinator.vision_latency_ms is None

    _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": True}},
    )

    with _patch_file_io():
        await coordinator.async_vision_check(_b64_image(), None)

    assert coordinator.vision_latency_ms is not None
    assert coordinator.vision_latency_ms >= 0


# ---------------------------------------------------------------------------
# async_vision_check - llmvision provider branch
# ---------------------------------------------------------------------------


async def test_vision_check_llmvision_awake(hass: HomeAssistant) -> None:
    """async_vision_check uses llmvision when no ai_task provider is bound."""
    # No ROLE_VISION_PROVIDER bound -> coordinator will look for llmvision entries.
    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    calls = _register_response_service(
        hass,
        "llmvision",
        "image_analyzer",
        {"response_text": "YES, awake"},
    )

    with (
        patch(
            "custom_components.aurora.coordinator.get_llm_vision_providers",
            return_value=[("entry_abc", "My Vision Provider")],
        ),
        _patch_file_io(),
    ):
        result = await coordinator.async_vision_check(_b64_image(), None)

    assert result.get("awake") is True
    assert "error" not in result
    assert calls, "llmvision.image_analyzer should have been called"


async def test_vision_check_llmvision_not_awake(hass: HomeAssistant) -> None:
    """async_vision_check returns awake=False when llmvision answer is negative."""
    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    _register_response_service(
        hass,
        "llmvision",
        "image_analyzer",
        {"response_text": "NO, the person is asleep"},
    )

    with (
        patch(
            "custom_components.aurora.coordinator.get_llm_vision_providers",
            return_value=[("entry_abc", "VisionPro")],
        ),
        _patch_file_io(),
    ):
        result = await coordinator.async_vision_check(_b64_image(), None)

    assert result.get("awake") is False
    assert "error" not in result


async def test_vision_check_no_provider_raises(hass: HomeAssistant) -> None:
    """async_vision_check returns error='inference_failed' when no provider exists."""
    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    with (
        patch(
            "custom_components.aurora.coordinator.get_llm_vision_providers",
            return_value=[],
        ),
        patch("asyncio.sleep"),
        _patch_file_io(),
    ):
        result = await coordinator.async_vision_check(_b64_image(), None)

    # All VISION_MAX_ATTEMPTS fail -> inference_failed, awake=False.
    assert result.get("awake") is False
    assert result.get("error") == "inference_failed"


# ---------------------------------------------------------------------------
# Circuit-breaker integration through async_vision_check
# ---------------------------------------------------------------------------


async def test_vision_check_circuit_opens_after_threshold(
    hass: HomeAssistant,
) -> None:
    """After CIRCUIT_FAILURE_THRESHOLD failures the breaker opens and short-circuits."""
    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    with (
        patch(
            "custom_components.aurora.coordinator.get_llm_vision_providers",
            return_value=[],  # forces all attempts to fail
        ),
        patch("asyncio.sleep"),
        _patch_file_io(),
    ):
        for _ in range(CIRCUIT_FAILURE_THRESHOLD):
            await coordinator.async_vision_check(_b64_image(), None)

        # Now the breaker should be open -> next call short-circuits.
        result = await coordinator.async_vision_check(_b64_image(), None)

    assert result.get("error") == "circuit_open"
    assert result.get("awake") is False


async def test_vision_check_circuit_short_circuits_immediately(
    hass: HomeAssistant,
) -> None:
    """A tripped circuit returns circuit_open without touching the provider."""
    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    # Manually trip the breaker via its public record() API.
    breaker = coordinator._vision_breaker
    for _ in range(CIRCUIT_FAILURE_THRESHOLD):
        breaker.record(ok=False, now=time.monotonic())

    # No provider mock needed -- the breaker must short-circuit before any call.
    result = await coordinator.async_vision_check(_b64_image(), None)

    assert result.get("error") == "circuit_open"
    assert result.get("awake") is False


# ---------------------------------------------------------------------------
# async_vision_benchmark
# ---------------------------------------------------------------------------


async def test_vision_benchmark_success(hass: HomeAssistant) -> None:
    """async_vision_benchmark returns correct stat keys when all samples succeed."""
    pytest.importorskip("PIL", reason="Pillow required for benchmark")

    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": True}},
    )

    with _patch_file_io():
        result = await coordinator.async_vision_benchmark(samples=3)

    assert result["samples"] == 3
    assert result["succeeded"] == 3
    assert result["failed"] == 0
    assert isinstance(result["latency_ms"], dict)
    assert result["latency_ms"]["min"] is not None
    assert result["latency_ms"]["avg"] is not None
    assert result["latency_ms"]["max"] is not None


async def test_vision_benchmark_all_fail(hass: HomeAssistant) -> None:
    """async_vision_benchmark tracks failures correctly when provider always fails."""
    pytest.importorskip("PIL", reason="Pillow required for benchmark")

    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    with (
        patch(
            "custom_components.aurora.coordinator.get_llm_vision_providers",
            return_value=[],
        ),
        patch("asyncio.sleep"),
        _patch_file_io(),
    ):
        result = await coordinator.async_vision_benchmark(samples=2)

    assert result["samples"] == 2
    assert result["failed"] > 0
    # latency_ms dict must always be present.
    assert "latency_ms" in result


async def test_vision_benchmark_missing_pillow(hass: HomeAssistant) -> None:
    """async_vision_benchmark raises HomeAssistantError when Pillow is missing."""
    from homeassistant.exceptions import HomeAssistantError

    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    with (
        patch.dict("sys.modules", {"PIL": None, "PIL.Image": None}),
        pytest.raises(HomeAssistantError, match="Pillow"),
    ):
        await coordinator.async_vision_benchmark(samples=1)


# ---------------------------------------------------------------------------
# vision_latency_ms property
# ---------------------------------------------------------------------------


async def test_vision_latency_ms_reflects_successful_checks(
    hass: HomeAssistant,
) -> None:
    """vision_latency_ms rolls an average over recent successful checks."""
    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": True}},
    )

    with _patch_file_io():
        await coordinator.async_vision_check(_b64_image(), None)
        await coordinator.async_vision_check(_b64_image(), None)

    avg = coordinator.vision_latency_ms
    assert avg is not None
    assert isinstance(avg, (int, float))
    assert avg >= 0


async def test_vision_latency_ms_not_updated_on_failure(
    hass: HomeAssistant,
) -> None:
    """vision_latency_ms stays None when every check fails (latency not recorded)."""
    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    with (
        patch(
            "custom_components.aurora.coordinator.get_llm_vision_providers",
            return_value=[],
        ),
        patch("asyncio.sleep"),
        _patch_file_io(),
    ):
        await coordinator.async_vision_check(_b64_image(), None)

    # Failed inference_failed result must NOT update the latency window.
    assert coordinator.vision_latency_ms is None


# ---------------------------------------------------------------------------
# async_vision_check with a specific alarm_id
# ---------------------------------------------------------------------------


async def test_vision_check_with_alarm_id(hass: HomeAssistant) -> None:
    """async_vision_check accepts an explicit alarm_id and resolves its options."""
    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    # Create an alarm so a real alarm_id is available.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:30", "label": "Vision test"},
        blocking=True,
    )
    await hass.async_block_till_done()

    items = coordinator.alarms.async_items()
    assert items, "Expected at least one alarm to exist"
    alarm_id = items[0]["id"]

    _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": True}},
    )

    with _patch_file_io():
        result = await coordinator.async_vision_check(_b64_image(), alarm_id)

    assert result.get("awake") is True
    assert "error" not in result


# ---------------------------------------------------------------------------
# Diagnostic sensor reflects latency
# ---------------------------------------------------------------------------


async def test_diagnostic_sensor_entity_disabled_by_default(
    hass: HomeAssistant,
) -> None:
    """The vision_latency diagnostic sensor is disabled by default."""
    await _setup(hass)
    # The entity is registered with entity_registry_enabled_default=False so its
    # state is not available until explicitly enabled.
    state = hass.states.get("sensor.aurora_vision_latency")
    assert state is None, (
        "sensor.aurora_vision_latency should be disabled by default"
        " and absent from states"
    )
