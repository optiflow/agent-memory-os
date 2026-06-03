"""Root Hermes plugin shim for Agent Memory OS.

Hermes Git plugin installs discover `plugin.yaml` and `__init__.py` at the
installed plugin root. The implementation stays in the nested adapter so
maintainers can still inspect or vendor that boundary directly.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

_ADAPTER_PATH = (
    Path(__file__).resolve().parent
    / "adapters"
    / "hermes"
    / "plugins"
    / "memory"
    / "meta_memory"
    / "__init__.py"
)
_SPEC = importlib.util.spec_from_file_location("_agent_memory_os_meta_memory", _ADAPTER_PATH)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError(f"Cannot load Agent Memory OS adapter from {_ADAPTER_PATH}")

_adapter = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_adapter)

MetaMemoryProvider = _adapter.MetaMemoryProvider
Provider = _adapter.Provider


def initialize(*args: Any, **kwargs: Any) -> MetaMemoryProvider:
    return _adapter.initialize(*args, **kwargs)


def register(ctx: Any) -> MetaMemoryProvider:
    return _adapter.register(ctx)


def on_session_end(messages: list[dict[str, Any]] | None = None, **kwargs: Any) -> None:
    return _adapter.on_session_end(messages, **kwargs)
