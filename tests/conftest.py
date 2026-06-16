"""Common fixtures for Aurora tests.

In CI (Python 3.14 with Home Assistant installed) the real ``custom_components``
package is imported and every test runs. On a developer machine without Home
Assistant the package ``__init__`` cannot import, so the pure (HA-free) modules
are made importable as ``custom_components.aurora.<module>`` via a lightweight
namespace shim that skips the package ``__init__``. The HA-dependent test files
import ``homeassistant`` at module scope and are simply not collected there.
"""

import importlib.util
from pathlib import Path
import sys
import types

import pytest

_HA_AVAILABLE = importlib.util.find_spec("homeassistant") is not None

if not _HA_AVAILABLE:
    _ROOT = Path(__file__).resolve().parent.parent
    for _name, _path in (
        ("custom_components", _ROOT / "custom_components"),
        ("custom_components.aurora", _ROOT / "custom_components" / "aurora"),
    ):
        if _name not in sys.modules:
            _module = types.ModuleType(_name)
            _module.__path__ = [str(_path)]
            sys.modules[_name] = _module


if _HA_AVAILABLE:

    @pytest.fixture(autouse=True)
    def auto_enable_custom_integrations(enable_custom_integrations):
        """Enable loading of the Aurora custom integration in every test."""
        yield
