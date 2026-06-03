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
from collections.abc import Callable
from pathlib import Path
from typing import Any

DEFAULT_DB_PATH = str(Path.home() / ".hermes" / "meta-memory.sqlite")
DEFAULT_TIMEOUT_SECONDS = 20.0
TOOLSET = "meta_memory"

try:
    from agent.memory_provider import MemoryProvider
except Exception:  # pragma: no cover - lets the adapter compile outside Hermes.

    class MemoryProvider:  # type: ignore[no-redef]
        pass


class MetaMemoryProvider(MemoryProvider):
    """Hermes MemoryProvider that delegates to the meta-memory CLI."""

    name = TOOLSET
    display_name = "Agent Memory OS"
    description = "Local-first meta memory provider backed by TypeScript and SQLite + FTS."

    def __init__(self) -> None:
        self._cli = _read_cli()
        self._db_path = _read_db_path()
        self._db_path_configured = _has_db_path_env()
        self._timeout_seconds = _read_timeout_seconds()
        self._session_id: str | None = None
        self._hermes_home: str | None = None
        self._agent_context = "primary"
        self._platform = ""

    def initialize(
        self,
        session_id: str | None = None,
        hermes_home: str | Path | None = None,
        platform: str = "",
        agent_context: str = "primary",
        **_: Any,
    ) -> None:
        self._session_id = session_id
        self._hermes_home = str(hermes_home) if hermes_home is not None else None
        self._platform = platform
        self._agent_context = agent_context
        if not self._db_path_configured:
            self._db_path = _read_db_path(hermes_home)
        self._ensure_db_parent()

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

    def prefetch(self, query: str, *, session_id: str = "", **_: Any) -> str:
        payload: dict[str, Any] = {
            "dbPath": self._db_path,
            "query": query,
            "budgetTokens": 1200,
        }
        scope = _session_scope(session_id or self._session_id)
        if scope is not None:
            payload["scope"] = scope

        result = self._run(
            "context-pack",
            payload,
        )
        return json.dumps(result.get("contextPack", result), ensure_ascii=False)

    def sync_turn(
        self,
        user_content: str,
        assistant_content: str,
        *,
        session_id: str = "",
        messages: list[dict[str, Any]] | None = None,
    ) -> None:
        if not self._should_write():
            return None

        def sync() -> None:
            metadata = {
                "session_id": session_id or self._session_id or "",
                "message_count": len(messages) if messages is not None else 0,
                "platform": self._platform,
            }
            if user_content:
                self._run(
                    "remember",
                    {
                        "dbPath": self._db_path,
                        "kind": "user_message",
                        "actor": "user",
                        "content": user_content,
                        "metadata": metadata,
                    },
                )
            if assistant_content:
                self._run(
                    "remember",
                    {
                        "dbPath": self._db_path,
                        "kind": "assistant_message",
                        "actor": "assistant",
                        "content": assistant_content,
                        "metadata": metadata,
                    },
                )

        thread = threading.Thread(target=sync, daemon=True)
        thread.start()

    def on_memory_write(
        self,
        action: str,
        target: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        if not self._should_write():
            return None

        self._run(
            "remember",
            {
                "dbPath": self._db_path,
                "kind": "explicit_memory",
                "content": content,
                "metadata": {
                    "action": action,
                    "target": target,
                    **(metadata or {}),
                },
            },
        )
        return None

    def on_session_end(self, messages: list[dict[str, Any]] | None = None, **_: Any) -> None:
        return None

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "context_pack",
                "description": "Build a bounded memory context pack for a query.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "minLength": 1},
                        "budgetTokens": {"type": "integer", "minimum": 1},
                        "policy": {"type": "string", "enum": ["auto", "task", "workspace"]},
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "remember",
                "description": "Append an explicit memory event.",
                "parameters": {
                    "type": "object",
                    "properties": {"content": {"type": "string", "minLength": 1}},
                    "required": ["content"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "search",
                "description": "Search local memory.",
                "parameters": {
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
                "name": "upsert_session_state",
                "description": "Update the compact active session-state projection.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "minLength": 1},
                        "currentGoal": {"type": "string", "minLength": 1},
                        "summary": {"type": "string", "minLength": 1},
                        "status": {"type": "string", "enum": ["active", "blocked", "complete"]},
                        "workingSet": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["id", "currentGoal", "summary"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "upsert_resource",
                "description": "Add or update a browseable workspace resource.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "uri": {"type": "string", "minLength": 1},
                        "title": {"type": "string", "minLength": 1},
                        "content": {"type": "string", "minLength": 1},
                        "kind": {
                            "type": "string",
                            "enum": ["doc", "file", "note", "other", "url"],
                        },
                        "parentUri": {"type": "string", "minLength": 1},
                    },
                    "required": ["uri", "title", "content"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "browse_resources",
                "description": "List workspace resources under an optional parent URI.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "parentUri": {"type": "string", "minLength": 1},
                        "limit": {"type": "integer", "minimum": 1},
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            },
            {
                "name": "verify",
                "description": "Record verification status for a memory item.",
                "parameters": {
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

    def handle_tool_call(self, name: str, arguments: dict[str, Any], **_: Any) -> str:
        command_by_tool = {
            "context_pack": "context-pack",
            "remember": "remember",
            "search": "search",
            "upsert_session_state": "upsert-session-state",
            "upsert_resource": "upsert-resource",
            "browse_resources": "browse-resources",
            "verify": "verify",
        }

        if name not in command_by_tool:
            raise ValueError(f"Unsupported meta memory tool: {name}")

        result = self._run(command_by_tool[name], {**arguments, "dbPath": self._db_path})
        return json.dumps(result, ensure_ascii=False)

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

    def _should_write(self) -> bool:
        return self._agent_context in ("", "primary")


def _read_cli() -> str:
    return os.environ.get("META_MEMORY_CLI", "").strip() or "meta-memory"


def _has_db_path_env() -> bool:
    return bool(os.environ.get("META_MEMORY_DB", "").strip())


def _read_db_path(hermes_home: str | Path | None = None) -> str:
    db_path = os.environ.get("META_MEMORY_DB", "").strip() or DEFAULT_DB_PATH
    if not _has_db_path_env() and hermes_home is not None:
        db_path = str(Path(hermes_home).expanduser() / "meta-memory.sqlite")

    if db_path == ":memory:":
        return db_path

    return str(Path(db_path).expanduser())


def _session_scope(session_id: str | None) -> dict[str, str] | None:
    if not session_id:
        return None

    return {"type": "session", "id": session_id}


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


_provider: MetaMemoryProvider | None = None


def initialize(*args: Any, **kwargs: Any) -> MetaMemoryProvider:
    """Create the Hermes memory provider at plugin startup."""

    global _provider
    provider = MetaMemoryProvider()
    provider.initialize(*args, **kwargs)
    _provider = provider
    return provider


def register(ctx: Any) -> MetaMemoryProvider:
    """Register the provider, tools, and session-end hook with Hermes."""

    provider = _active_provider()
    ctx.register_memory_provider(provider)

    for schema in provider.get_tool_schemas():
        tool_name = str(schema["name"])
        ctx.register_tool(
            name=tool_name,
            toolset=TOOLSET,
            schema=schema,
            handler=_tool_handler(provider, tool_name),
            description=str(schema["description"]),
        )

    ctx.register_hook("on_session_end", provider.on_session_end)
    return provider


def on_session_end(messages: list[dict[str, Any]] | None = None, **kwargs: Any) -> None:
    provider = _active_provider()
    provider.on_session_end(messages, **kwargs)


def _active_provider() -> MetaMemoryProvider:
    global _provider
    if _provider is None:
        _provider = MetaMemoryProvider()

    return _provider


def _tool_handler(
    provider: MetaMemoryProvider,
    name: str,
) -> Callable[[dict[str, Any] | None], str]:
    def handle(params: dict[str, Any] | None = None, **kwargs: Any) -> str:
        arguments: dict[str, Any] = {}
        if params:
            arguments.update(params)
        if kwargs:
            arguments.update(kwargs)

        return provider.handle_tool_call(name, arguments)

    return handle


Provider = MetaMemoryProvider
