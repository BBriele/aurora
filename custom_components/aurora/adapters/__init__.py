"""Capability-first output adapters.

Each adapter hides a concrete Home Assistant domain/service behind a tiny role
contract (``async_start`` / ``async_stop``). The core resolves which adapter to
use at runtime from the config-entry role bindings (and per-alarm overrides);
it never imports a third-party integration directly.
"""
