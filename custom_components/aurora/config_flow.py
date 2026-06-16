"""Config flow for Aurora.

There is exactly one Aurora installation (``single_config_entry``), and setup is
a single click with nothing to configure here. All configuration — role/device
bindings, shared settings and alarms — lives in the **Aurora app** (the sidebar
panel and the dashboard card), which reads and writes the config entry over the
Aurora WebSocket API. The Home Assistant integration page therefore only
installs Aurora; it deliberately does not duplicate that configuration UI.
"""

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class AuroraConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the single, one-click Aurora installation config entry."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """One-click install. All configuration happens in the Aurora app."""
        return self.async_create_entry(title="Aurora", data={})
