"""NotifyChannel adapter — ring via notify entities, with a universal fallback.

``persistent_notification`` is always created so a ring is visible even on the
barest setup (Tier 0). Any bound ``notify.*`` entities are additionally notified.
"""

import contextlib
import logging

from homeassistant.components import persistent_notification
from homeassistant.components.notify import (
    ATTR_MESSAGE,
    ATTR_TITLE,
    DOMAIN as NOTIFY_DOMAIN,
    SERVICE_SEND_MESSAGE,
)
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)


class NotifyChannelAdapter:
    """Send a ring notification to bound channels + a persistent notification."""

    def __init__(
        self,
        hass: HomeAssistant,
        targets: list[str],
        *,
        title: str,
        message: str,
        notification_id: str,
    ) -> None:
        """Store the channels and message."""
        self._hass = hass
        self._targets = targets
        self._title = title
        self._message = message
        self._notification_id = notification_id

    async def async_start(self) -> None:
        """Create the persistent notification and notify bound channels."""
        persistent_notification.async_create(
            self._hass,
            self._message,
            title=self._title,
            notification_id=self._notification_id,
        )
        for target in self._targets:
            try:
                await self._hass.services.async_call(
                    NOTIFY_DOMAIN,
                    SERVICE_SEND_MESSAGE,
                    {
                        ATTR_ENTITY_ID: target,
                        ATTR_MESSAGE: self._message,
                        ATTR_TITLE: self._title,
                    },
                    blocking=False,
                )
            except HomeAssistantError as err:
                _LOGGER.warning("Aurora notify: failed on %s: %s", target, err)

    async def async_stop(self) -> None:
        """Dismiss the persistent notification."""
        with contextlib.suppress(Exception):
            persistent_notification.async_dismiss(self._hass, self._notification_id)
