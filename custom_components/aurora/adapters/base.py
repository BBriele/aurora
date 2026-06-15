"""Output adapter contract."""

from typing import Protocol, runtime_checkable


@runtime_checkable
class OutputAdapter(Protocol):
    """Something that can be turned on while an alarm rings, then off."""

    async def async_start(self) -> None:
        """Begin the output (play audio, ramp light, send notification…)."""
        ...

    async def async_stop(self) -> None:
        """Stop the output and release any resources."""
        ...
