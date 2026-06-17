"""RingController wires display adapters under the right conditions (CI)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.aurora.models import AuroraAlarm
from custom_components.aurora.ring import RingController


def _alarm(display_enabled, targets):
    return AuroraAlarm.from_dict({
        "id": "a1", "time": "07:00",
        "features": {"display": {"enabled": display_enabled, "targets": targets}},
    })


@pytest.mark.asyncio
async def test_display_adapter_added_when_enabled_with_target():
    rc = RingController(MagicMock())
    with patch("custom_components.aurora.ring.DisplaySurfaceAdapter") as Adapter:
        Adapter.return_value.async_start = AsyncMock(return_value=None)
        Adapter.return_value.async_stop = AsyncMock(return_value=None)
        await rc.async_start(_alarm(True, ["media_player.smartclock"]), {})
    Adapter.assert_called_once()
    assert Adapter.call_args.args[1] == "media_player.smartclock"


@pytest.mark.asyncio
async def test_no_display_adapter_when_disabled():
    rc = RingController(MagicMock())
    with patch("custom_components.aurora.ring.DisplaySurfaceAdapter") as Adapter:
        Adapter.return_value.async_start = AsyncMock(return_value=None)
        Adapter.return_value.async_stop = AsyncMock(return_value=None)
        await rc.async_start(_alarm(False, ["media_player.smartclock"]), {})
    Adapter.assert_not_called()


@pytest.mark.asyncio
async def test_display_targets_fall_back_to_role_binding():
    rc = RingController(MagicMock())
    with patch("custom_components.aurora.ring.DisplaySurfaceAdapter") as Adapter:
        Adapter.return_value.async_start = AsyncMock(return_value=None)
        Adapter.return_value.async_stop = AsyncMock(return_value=None)
        await rc.async_start(_alarm(True, []), {"display_surface": "media_player.sc"})
    Adapter.assert_called_once()
    assert Adapter.call_args.args[1] == "media_player.sc"
