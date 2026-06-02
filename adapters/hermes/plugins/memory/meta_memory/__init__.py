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

DEFAULT_DB_PATH = str(Path.home() / ".hermes" / "meta-memory.sqlite")
DEFAULT_TIMEOUT_SECONDS = 20.0

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
        self._cli = _read_cli()
        self._db_path = _read_db_path()
        self._timeout_seconds = _read_timeout_seconds()

    def is_available(self) -> bool:
        try:
            executable = self._command_parts()[0]
        except RuntimeError:
            return False

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
            if user:
                self._run(
                    "remember",
                    {
                        "dbPath": self._db_path,
                        "kind": "user_message",
                        "actor": "user",
                        "content": user,
                    },
                )
            if assistant:
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
                    "properties": {
                        "query": {"type": "string", "minLength": 1},
                        "budgetTokens": {"type": "integer", "minimum": 1},
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "remember",
                "description": "Append an explicit memory event.",
                "input_schema": {
                    "type": "object",
                    "properties": {"content": {"type": "string", "minLength": 1}},
                    "required": ["content"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "search",
                "description": "Search local memory.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "minLength": 1},
                        "limit": {"type": "integer", "minimum": 1},
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "verify",
                "description": "Record verification status for a memory item.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "targetId": {"type": "string"},
                        "status": {
                            "type": "string",
                            "enum": ["failed", "passed", "stale", "unknown", "warning"],
                        },
                        "message": {"type": "string"},
                    },
                    "required": ["targetId", "message"],
                    "additionalProperties": False,
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

        return self._run(command_by_tool[name], {**arguments, "dbPath": self._db_path})

    def _run(self, command: str, payload: dict[str, Any]) -> dict[str, Any]:
        command_parts = self._command_parts()
        self._ensure_db_parent()

        try:
            process = subprocess.run(
                [*command_parts, command],
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                timeout=self._timeout_seconds,
                check=False,
            )
        except FileNotFoundError as error:
            raise RuntimeError(f"meta-memory CLI executable not found: {command_parts[0]}") from error
        except subprocess.TimeoutExpired as error:
            raise RuntimeError(
                f"meta-memory CLI timed out after {self._timeout_seconds:g}s running {command}"
            ) from error

        if process.returncode != 0:
            raise RuntimeError(f"meta-memory CLI failed for {command}: {_process_error(process)}")

        stdout = process.stdout.strip()
        if not stdout:
            raise RuntimeError(f"meta-memory CLI returned no JSON for {command}")

        try:
            result = json.loads(stdout)
        except json.JSONDecodeError as error:
            raise RuntimeError(f"meta-memory CLI returned invalid JSON for {command}") from error

        if not isinstance(result, dict):
            raise RuntimeError(f"meta-memory CLI returned non-object JSON for {command}")

        return result

    def _command_parts(self) -> list[str]:
        parts = shlex.split(self._cli)
        if not parts:
            raise RuntimeError("META_MEMORY_CLI must not be empty")

        return parts

    def _ensure_db_parent(self) -> None:
        if self._db_path == ":memory:":
            return

        parent = Path(self._db_path).parent
        if parent != Path("."):
            parent.mkdir(parents=True, exist_ok=True)


def _read_cli() -> str:
    return os.environ.get("META_MEMORY_CLI", "").strip() or "meta-memory"


def _read_db_path() -> str:
    db_path = os.environ.get("META_MEMORY_DB", "").strip() or DEFAULT_DB_PATH
    if db_path == ":memory:":
        return db_path

    return str(Path(db_path).expanduser())


def _read_timeout_seconds() -> float:
    raw_timeout = os.environ.get("META_MEMORY_TIMEOUT_SECONDS", "").strip()
    if not raw_timeout:
        return DEFAULT_TIMEOUT_SECONDS

    try:
        timeout_seconds = float(raw_timeout)
    except ValueError as error:
        raise ValueError("META_MEMORY_TIMEOUT_SECONDS must be a positive number") from error

    if timeout_seconds <= 0:
        raise ValueError("META_MEMORY_TIMEOUT_SECONDS must be greater than zero")

    return timeout_seconds


def _process_error(process: subprocess.CompletedProcess[str]) -> str:
    raw_error = process.stderr.strip() or process.stdout.strip() or f"exit code {process.returncode}"

    try:
        parsed = json.loads(raw_error)
    except json.JSONDecodeError:
        return raw_error

    if isinstance(parsed, dict) and isinstance(parsed.get("error"), str):
        return parsed["error"]

    return raw_error


Provider = MetaMemoryProvider
