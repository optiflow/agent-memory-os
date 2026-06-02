"""Hermes adapter for Agent Memory OS.

This adapter intentionally stays thin. The TypeScript CLI owns storage, routing,
and context packing; Hermes only needs a Python MemoryProvider-compatible bridge.
"""

from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any

try:
    from agent.memory_provider import MemoryProvider
except Exception:  # pragma: no cover - lets the adapter compile outside Hermes.

    class MemoryProvider:  # type: ignore[no-redef]
        pass


class MetaMemoryProvider(MemoryProvider):
    """Hermes MemoryProvider that delegates to the meta-memory CLI."""

    name = "meta_memory"
    display_name = "Agent Memory OS"
    description = "Local-first meta memory provider backed by TypeScript and SQLite + FTS."

    def __init__(self) -> None:
        self._cli = os.environ.get("META_MEMORY_CLI", "meta-memory")
        self._db_path = os.environ.get("META_MEMORY_DB", str(Path.home() / ".hermes" / "meta-memory.sqlite"))
        self._timeout_seconds = float(os.environ.get("META_MEMORY_TIMEOUT_SECONDS", "20"))

    def is_available(self) -> bool:
        executable = self._command_parts()[0]
        return bool(shutil.which(executable) or Path(executable).exists())

    def system_prompt_block(self) -> str:
        return (
            "Agent Memory OS is available. Use injected memory only when it is relevant, "
            "cite memory identifiers when relying on them, and treat verification warnings as higher priority."
        )

    def prefetch(self, query: str, **_: Any) -> str:
        result = self._run(
            "context-pack",
            {
                "dbPath": self._db_path,
                "query": query,
                "budgetTokens": 1200,
            },
        )
        return json.dumps(result.get("contextPack", result), ensure_ascii=False)

    def sync_turn(self, user: str, assistant: str, **_: Any) -> None:
        def sync() -> None:
            self._run(
                "remember",
                {
                    "dbPath": self._db_path,
                    "kind": "user_message",
                    "actor": "user",
                    "content": user,
                },
            )
            self._run(
                "remember",
                {
                    "dbPath": self._db_path,
                    "kind": "assistant_message",
                    "actor": "assistant",
                    "content": assistant,
                },
            )

        thread = threading.Thread(target=sync, daemon=True)
        thread.start()

    def on_memory_write(self, content: str, **kwargs: Any) -> dict[str, Any]:
        return self._run(
            "remember",
            {
                "dbPath": self._db_path,
                "kind": "explicit_memory",
                "content": content,
                "metadata": kwargs,
            },
        )

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "context_pack",
                "description": "Build a bounded memory context pack for a query.",
                "input_schema": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}, "budgetTokens": {"type": "number"}},
                    "required": ["query"],
                },
            },
            {
                "name": "remember",
                "description": "Append an explicit memory event.",
                "input_schema": {
                    "type": "object",
                    "properties": {"content": {"type": "string"}},
                    "required": ["content"],
                },
            },
            {
                "name": "search",
                "description": "Search local memory.",
                "input_schema": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}, "limit": {"type": "number"}},
                    "required": ["query"],
                },
            },
            {
                "name": "verify",
                "description": "Record verification status for a memory item.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "targetId": {"type": "string"},
                        "status": {"type": "string"},
                        "message": {"type": "string"},
                    },
                    "required": ["targetId", "message"],
                },
            },
        ]

    def handle_tool_call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        command_by_tool = {
            "context_pack": "context-pack",
            "remember": "remember",
            "search": "search",
            "verify": "verify",
        }

        if name not in command_by_tool:
            raise ValueError(f"Unsupported meta memory tool: {name}")

        return self._run(command_by_tool[name], {"dbPath": self._db_path, **arguments})

    def _run(self, command: str, payload: dict[str, Any]) -> dict[str, Any]:
        process = subprocess.run(
            [*self._command_parts(), command],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            timeout=self._timeout_seconds,
            check=False,
        )

        if process.returncode != 0:
            raise RuntimeError(process.stderr.strip() or process.stdout.strip())

        return json.loads(process.stdout)

    def _command_parts(self) -> list[str]:
        return shlex.split(self._cli)


Provider = MetaMemoryProvider
