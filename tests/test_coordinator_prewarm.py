"""Tests for the Aurora vision pre-warm feature.

CI-only: imports homeassistant at module scope; not collected on dev machines
that lack the HA package (the conftest shim skips such imports gracefully).

Spec: docs/superpowers/specs/2026-06-18-vision-mission-tuning-design.md
      Piece 3 — Pre-warm + the record_stats locked decision.

Test matrix:
- warms once when mission=vision + provider bound (async_vision_check called
  with record_stats=False);
- no-op when mission != vision;
- no-op when no vision provider bound;
- the _warmed_alarm_id guard prevents a second warm in the same cycle;
- benchmark and pre-warm do NOT change vision_latency_ms (record_stats=False
  path);
"""

import contextlib
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    DOMAIN,
    ROLE_VISION_PROVIDER,
    SERVICE_ADD_ALARM,
)
from custom_components.aurora.models import MissionType

# ---------------------------------------------------------------------------
# Helpers shared with test_vision_engine.py
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


def _patch_file_io() -> contextlib.AbstractContextManager:
    """Patch os.makedirs, open, os.path.exists, and os.remove to avoid real FS."""

    @contextlib.contextmanager
    def _ctx():
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
    """Register a mock HA service that returns *response* from blocking calls."""
    calls: list[ServiceCall] = []

    async def _handler(call: ServiceCall) -> dict[str, Any]:
        calls.append(call)
        return response

    hass.services.async_register(
        domain,
        service,
        _handler,
        supports_response=SupportsResponse.OPTIONAL,
    )
    return calls


async def _add_vision_alarm(hass: HomeAssistant, coordinator) -> str:
    """Add a VISION-mission alarm and return its id."""
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {
            "time": "07:30",
            "label": "Vision alarm",
            "features": {
                "mission": {"type": MissionType.VISION},
            },
        },
        blocking=True,
    )
    await hass.async_block_till_done()
    items = coordinator.alarms.async_items()
    assert items, "Expected at least one alarm to exist"
    return items[-1]["id"]


async def _add_math_alarm(hass: HomeAssistant, coordinator) -> str:
    """Add a MATH-mission alarm and return its id."""
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {
            "time": "08:00",
            "label": "Math alarm",
            "features": {
                "mission": {"type": MissionType.MATH},
            },
        },
        blocking=True,
    )
    await hass.async_block_till_done()
    items = coordinator.alarms.async_items()
    assert items, "Expected at least one alarm to exist"
    return items[-1]["id"]


# ---------------------------------------------------------------------------
# record_stats=False: benchmark and pre-warm leave vision_latency_ms unchanged
# ---------------------------------------------------------------------------


async def test_vision_check_record_stats_false_does_not_update_latency(
    hass: HomeAssistant,
) -> None:
    """async_vision_check(record_stats=False) must NOT update the latency window."""
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
        result = await coordinator.async_vision_check(
            _TINY_JPEG_B64, None, record_stats=False
        )

    # Inference succeeded but record_stats=False → latency window untouched.
    assert result.get("awake") is True
    assert coordinator.vision_latency_ms is None


async def test_vision_check_record_stats_false_does_not_trip_breaker(
    hass: HomeAssistant,
) -> None:
    """async_vision_check(record_stats=False) failures must NOT trip the breaker."""
    entry = await _setup(hass)
    coordinator = entry.runtime_data.coordinator

    # Trip-count threshold; with record_stats=True each failure records a loss.
    # With record_stats=False the breaker should stay closed even after N failures.
    with (
        patch(
            "custom_components.aurora.coordinator.get_llm_vision_providers",
            return_value=[],
        ),
        patch("asyncio.sleep"),
        _patch_file_io(),
    ):
        for _ in range(10):
            await coordinator.async_vision_check(
                _TINY_JPEG_B64, None, record_stats=False
            )

    # Breaker must still be closed — no stats were recorded.
    assert coordinator._vision_breaker.is_open is False


async def test_benchmark_does_not_update_latency(hass: HomeAssistant) -> None:
    """async_vision_benchmark must not change vision_latency_ms."""
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

    latency_before = coordinator.vision_latency_ms  # None at this point

    with _patch_file_io():
        await coordinator.async_vision_benchmark(samples=3)

    # Benchmark used record_stats=False → latency sensor unchanged.
    assert coordinator.vision_latency_ms == latency_before


# ---------------------------------------------------------------------------
# _async_vision_prewarm: mission guard
# ---------------------------------------------------------------------------


async def test_prewarm_noop_when_mission_not_vision(hass: HomeAssistant) -> None:
    """_async_vision_prewarm must be a no-op when mission != VISION."""
    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    alarm_id = await _add_math_alarm(hass, coordinator)
    alarm = coordinator._get_alarm(alarm_id)
    assert alarm is not None

    with patch.object(
        coordinator, "async_vision_check", new_callable=AsyncMock
    ) as mock_check:
        await coordinator._async_vision_prewarm(alarm)

    mock_check.assert_not_called()
    assert coordinator._warmed_alarm_id is None


# ---------------------------------------------------------------------------
# _async_vision_prewarm: provider guard
# ---------------------------------------------------------------------------


async def test_prewarm_noop_when_no_provider(hass: HomeAssistant) -> None:
    """_async_vision_prewarm must be a no-op when no vision provider is configured."""
    # No ROLE_VISION_PROVIDER in options.
    entry = await _setup(hass, options={})
    coordinator = entry.runtime_data.coordinator

    alarm_id = await _add_vision_alarm(hass, coordinator)
    alarm = coordinator._get_alarm(alarm_id)
    assert alarm is not None

    with patch.object(
        coordinator, "async_vision_check", new_callable=AsyncMock
    ) as mock_check:
        await coordinator._async_vision_prewarm(alarm)

    mock_check.assert_not_called()
    assert coordinator._warmed_alarm_id is None


# ---------------------------------------------------------------------------
# _async_vision_prewarm: warms once with record_stats=False
# ---------------------------------------------------------------------------


async def test_prewarm_calls_vision_check_with_record_stats_false(
    hass: HomeAssistant,
) -> None:
    """_async_vision_prewarm calls async_vision_check with record_stats=False."""
    pytest.importorskip("PIL", reason="Pillow required for prewarm")

    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    alarm_id = await _add_vision_alarm(hass, coordinator)
    alarm = coordinator._get_alarm(alarm_id)
    assert alarm is not None

    _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": True}},
    )

    # Capture calls to async_vision_check via a spy that also executes the real method.
    original_check = coordinator.async_vision_check
    check_calls: list[dict] = []

    async def _spy(image_b64, alarm_id_arg=None, *, record_stats=True):
        check_calls.append({"alarm_id": alarm_id_arg, "record_stats": record_stats})
        return await original_check(image_b64, alarm_id_arg, record_stats=record_stats)

    with (
        patch.object(coordinator, "async_vision_check", side_effect=_spy),
        _patch_file_io(),
    ):
        await coordinator._async_vision_prewarm(alarm)

    assert len(check_calls) == 1, "Expected exactly one vision_check call"
    assert check_calls[0]["record_stats"] is False
    assert coordinator._warmed_alarm_id == alarm.id

    # Latency must not have been updated.
    assert coordinator.vision_latency_ms is None


# ---------------------------------------------------------------------------
# _async_vision_prewarm: the guard prevents a second warm in the same cycle
# ---------------------------------------------------------------------------


async def test_prewarm_guard_prevents_second_warm(hass: HomeAssistant) -> None:
    """_warmed_alarm_id guard: a second prewarm call for the same alarm is a no-op."""
    pytest.importorskip("PIL", reason="Pillow required for prewarm")

    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    alarm_id = await _add_vision_alarm(hass, coordinator)
    alarm = coordinator._get_alarm(alarm_id)
    assert alarm is not None

    _register_response_service(
        hass,
        "ai_task",
        "generate_data",
        {"data": {"awake": False}},
    )

    with (
        patch.object(
            coordinator, "async_vision_check", new_callable=AsyncMock
        ) as mock_check,
        patch.object(
            coordinator,
            "_sample_image_b64",
            return_value=_TINY_JPEG_B64,
        ),
    ):
        mock_check.return_value = {"awake": False}

        # First call: should warm.
        await coordinator._async_vision_prewarm(alarm)
        assert mock_check.call_count == 1

        # Second call for the same alarm: guard should prevent another warm.
        await coordinator._async_vision_prewarm(alarm)
        assert mock_check.call_count == 1, (
            "_warmed_alarm_id guard should prevent a second call for the same alarm"
        )


# ---------------------------------------------------------------------------
# _cancel_prewake resets _warmed_alarm_id
# ---------------------------------------------------------------------------


async def test_cancel_prewake_resets_warmed_alarm_id(hass: HomeAssistant) -> None:
    """_cancel_prewake must reset _warmed_alarm_id so the next cycle can prewarm."""
    entry = await _setup(
        hass,
        options={ROLE_VISION_PROVIDER: "ai_task.aurora_vision"},
    )
    coordinator = entry.runtime_data.coordinator

    # Simulate a previous warm having occurred.
    coordinator._warmed_alarm_id = "some-alarm-id"

    coordinator._cancel_prewake()

    assert coordinator._warmed_alarm_id is None


# ---------------------------------------------------------------------------
# _sample_image_b64 is reused by prewarm and benchmark (Pillow-backed)
# ---------------------------------------------------------------------------


def test_sample_image_b64_returns_valid_jpeg() -> None:
    """_sample_image_b64 returns a non-empty base64 string (pure, no HA needed)."""
    import base64
    import sys

    if "homeassistant" not in sys.modules:
        pytest.skip("HA not available")

    pytest.importorskip("PIL", reason="Pillow required")

    from unittest.mock import MagicMock

    # Build the coordinator with minimal mocks so we can call _sample_image_b64.
    coord = MagicMock()
    # Borrow the real unbound method.
    from custom_components.aurora.coordinator import AuroraCoordinator

    result = AuroraCoordinator._sample_image_b64(coord)

    assert isinstance(result, str)
    assert len(result) > 0
    # Must be valid base64.
    decoded = base64.b64decode(result)
    assert decoded[:2] == b"\xff\xd8", "Expected a JPEG magic number"
