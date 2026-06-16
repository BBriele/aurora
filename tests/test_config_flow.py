"""Config-flow tests for Aurora.

Aurora installs in one click and has nothing to configure in Home Assistant's
integration UI: all configuration lives in the Aurora app (over the WebSocket
API). So the config flow only needs to create the single entry and reject a
second installation (``single_config_entry``).
"""

from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import DOMAIN


async def test_user_flow_creates_entry(hass: HomeAssistant) -> None:
    """The one-click user flow immediately creates the single installation entry."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Aurora"
    assert result["data"] == {}


async def test_single_instance_only(hass: HomeAssistant) -> None:
    """A second config-flow attempt is aborted (single_config_entry)."""
    MockConfigEntry(domain=DOMAIN, title="Aurora").add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"
