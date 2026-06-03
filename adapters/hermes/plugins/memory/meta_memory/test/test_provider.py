from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).resolve().parents[1] / "__init__.py"
SPEC = importlib.util.spec_from_file_location("meta_memory_provider", MODULE_PATH)
assert SPEC is not None
assert SPEC.loader is not None
meta_memory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(meta_memory)

PLUGIN_DIR = MODULE_PATH.parent
PLUGIN_YAML_PATH = PLUGIN_DIR / "plugin.yaml"
PLUGIN_JSON_PATH = PLUGIN_DIR / "plugin.json"


class FakeHermesContext:
    def __init__(self) -> None:
        self.providers: list[object] = []
        self.tools: list[dict[str, object]] = []
        self.hooks: dict[str, object] = {}

    def register_memory_provider(self, provider: object) -> None:
        self.providers.append(provider)

    def register_tool(self, **kwargs: object) -> None:
        self.tools.append(kwargs)

    def register_hook(self, name: str, handler: object) -> None:
        self.hooks[name] = handler


class ImmediateThread:
    def __init__(self, target: object, daemon: bool) -> None:
        self.target = target
        self.daemon = daemon

    def start(self) -> None:
        self.target()


def provider_env(**overrides: str) -> object:
    env = {
        "META_MEMORY_CLI": "meta-memory",
        "META_MEMORY_DB": ":memory:",
        "META_MEMORY_TIMEOUT_SECONDS": "20",
    }
    env.update(overrides)
    return patch.dict(os.environ, env)


def parse_plugin_yaml(path: Path) -> dict[str, object]:
    fields: dict[str, object] = {}
    current_list: str | None = None

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        if not line:
            continue

        if not raw_line.startswith(" ") and ":" in line:
            key, raw_value = line.split(":", 1)
            value = raw_value.strip()
            current_list = key if value == "" else None
            fields[key] = [] if value == "" else value
            continue

        if line.startswith("  - ") and current_list is not None:
            value = fields[current_list]
            assert isinstance(value, list)
            value.append(line[4:])

    return fields


class MetaMemoryProviderTest(unittest.TestCase):
    def setUp(self) -> None:
        meta_memory._provider = None

    def test_plugin_metadata_uses_yaml_manifest(self) -> None:
        metadata = parse_plugin_yaml(PLUGIN_YAML_PATH)

        self.assertFalse(PLUGIN_JSON_PATH.exists())
        self.assertEqual("meta_memory", metadata["name"])
        self.assertEqual("0.1.0", metadata["version"])
        self.assertEqual("MetaMemoryProvider", metadata["provider_class"])
        self.assertEqual(
            ["context_pack", "remember", "search", "verify"],
            metadata["provides_tools"],
        )
        self.assertEqual(["on_session_end"], metadata["provides_hooks"])

    def test_initialize_creates_provider_and_records_startup_context(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "nested" / "memory.sqlite"

            with provider_env(META_MEMORY_DB=str(db_path)):
                provider = meta_memory.initialize(
                    session_id="session-123",
                    hermes_home=Path(temp_dir) / "hermes",
                )

            self.assertIsInstance(provider, meta_memory.MetaMemoryProvider)
            self.assertIs(provider, meta_memory._provider)
            self.assertEqual("session-123", provider._session_id)
            self.assertEqual(str(Path(temp_dir) / "hermes"), provider._hermes_home)
            self.assertTrue(db_path.parent.exists())

    def test_register_wires_provider_tools_and_session_end_hook(self) -> None:
        with provider_env():
            provider = meta_memory.initialize(session_id="session-123")

        ctx = FakeHermesContext()
        registered = meta_memory.register(ctx)

        self.assertIs(provider, registered)
        self.assertEqual([provider], ctx.providers)
        self.assertEqual(
            ["context_pack", "remember", "search", "verify"],
            [tool["name"] for tool in ctx.tools],
        )
        self.assertEqual({"on_session_end"}, set(ctx.hooks))
        self.assertEqual(ctx.hooks["on_session_end"], provider.on_session_end)

        search_tool = next(tool for tool in ctx.tools if tool["name"] == "search")
        with patch.object(provider, "handle_tool_call", return_value={"results": []}) as handle:
            result = search_tool["handler"]({"query": "Biome"})

        self.assertEqual({"results": []}, result)
        handle.assert_called_once_with("search", {"query": "Biome"})

    def test_tool_schemas_use_hermes_parameters_shape(self) -> None:
        with provider_env():
            provider = meta_memory.MetaMemoryProvider()

        schemas = provider.get_tool_schemas()

        self.assertEqual(
            ["context_pack", "remember", "search", "verify"],
            [schema["name"] for schema in schemas],
        )
        for schema in schemas:
            self.assertIn("description", schema)
            self.assertIn("parameters", schema)
            self.assertNotIn("input_schema", schema)
            self.assertEqual("object", schema["parameters"]["type"])
            self.assertFalse(schema["parameters"]["additionalProperties"])

        verify_schema = next(schema for schema in schemas if schema["name"] == "verify")
        self.assertEqual(["targetId", "message"], verify_schema["parameters"]["required"])

    def test_run_uses_configured_db_path_and_creates_parent(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "nested" / "memory.sqlite"
            completed = subprocess.CompletedProcess(
                args=["meta-memory", "search"],
                returncode=0,
                stdout=json.dumps({"results": []}),
                stderr="",
            )

            with provider_env(META_MEMORY_DB=str(db_path)):
                provider = meta_memory.MetaMemoryProvider()

            with patch.object(meta_memory.subprocess, "run", return_value=completed) as run:
                result = provider.handle_tool_call(
                    "search",
                    {"query": "Biome formatter", "dbPath": "/tmp/ignored.sqlite"},
                )

            self.assertEqual({"results": []}, result)
            self.assertTrue(db_path.parent.exists())
            self.assertEqual(["meta-memory", "search"], run.call_args.args[0])

            payload = json.loads(run.call_args.kwargs["input"])
            self.assertEqual(str(db_path), payload["dbPath"])
            self.assertEqual("Biome formatter", payload["query"])

    def test_on_memory_write_mirrors_explicit_memory_to_cli(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["meta-memory", "remember"],
            returncode=0,
            stdout=json.dumps({"event": {"id": "event_1"}}),
            stderr="",
        )
        with provider_env():
            provider = meta_memory.MetaMemoryProvider()

        with patch.object(meta_memory.subprocess, "run", return_value=completed) as run:
            result = provider.on_memory_write("Remember the adapter boundary.", source="hermes")

        self.assertEqual({"event": {"id": "event_1"}}, result)
        self.assertEqual(["meta-memory", "remember"], run.call_args.args[0])

        payload = json.loads(run.call_args.kwargs["input"])
        self.assertEqual(":memory:", payload["dbPath"])
        self.assertEqual("explicit_memory", payload["kind"])
        self.assertEqual("Remember the adapter boundary.", payload["content"])
        self.assertEqual({"source": "hermes"}, payload["metadata"])

    def test_prefetch_delegates_to_context_pack(self) -> None:
        context_pack = {"query": "Biome", "items": []}
        completed = subprocess.CompletedProcess(
            args=["meta-memory", "context-pack"],
            returncode=0,
            stdout=json.dumps({"contextPack": context_pack}),
            stderr="",
        )
        with provider_env():
            provider = meta_memory.MetaMemoryProvider()

        with patch.object(meta_memory.subprocess, "run", return_value=completed) as run:
            result = provider.prefetch("Biome")

        self.assertEqual(context_pack, json.loads(result))
        self.assertEqual(["meta-memory", "context-pack"], run.call_args.args[0])

        payload = json.loads(run.call_args.kwargs["input"])
        self.assertEqual(":memory:", payload["dbPath"])
        self.assertEqual("Biome", payload["query"])
        self.assertEqual(1200, payload["budgetTokens"])

    def test_sync_turn_delegates_user_and_assistant_messages_to_cli(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["meta-memory", "remember"],
            returncode=0,
            stdout=json.dumps({"event": {"id": "event_1"}}),
            stderr="",
        )
        with provider_env():
            provider = meta_memory.MetaMemoryProvider()

        with (
            patch.object(meta_memory.threading, "Thread", ImmediateThread),
            patch.object(meta_memory.subprocess, "run", return_value=completed) as run,
        ):
            provider.sync_turn("user text", "assistant text")

        self.assertEqual(2, run.call_count)
        payloads = [json.loads(call.kwargs["input"]) for call in run.call_args_list]
        self.assertEqual(
            [
                {
                    "dbPath": ":memory:",
                    "kind": "user_message",
                    "actor": "user",
                    "content": "user text",
                },
                {
                    "dbPath": ":memory:",
                    "kind": "assistant_message",
                    "actor": "assistant",
                    "content": "assistant text",
                },
            ],
            payloads,
        )

    def test_run_reports_cli_json_errors(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["meta-memory", "context-pack"],
            returncode=1,
            stdout="",
            stderr=json.dumps({"error": "Expected query"}),
        )
        with provider_env():
            provider = meta_memory.MetaMemoryProvider()

        with patch.object(meta_memory.subprocess, "run", return_value=completed):
            with self.assertRaisesRegex(RuntimeError, "context-pack: Expected query"):
                provider._run("context-pack", {"dbPath": ":memory:"})

    def test_run_rejects_invalid_json_output(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["meta-memory", "search"],
            returncode=0,
            stdout="not json",
            stderr="",
        )
        with provider_env():
            provider = meta_memory.MetaMemoryProvider()

        with patch.object(meta_memory.subprocess, "run", return_value=completed):
            with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
                provider._run("search", {"dbPath": ":memory:", "query": "Biome"})

    def test_run_reports_timeout(self) -> None:
        with provider_env(META_MEMORY_TIMEOUT_SECONDS="0.25"):
            provider = meta_memory.MetaMemoryProvider()

        timeout = subprocess.TimeoutExpired(cmd=["meta-memory", "search"], timeout=0.25)
        with patch.object(meta_memory.subprocess, "run", side_effect=timeout):
            with self.assertRaisesRegex(RuntimeError, "timed out after 0.25s"):
                provider._run("search", {"dbPath": ":memory:", "query": "Biome"})

    def test_on_session_end_is_noop(self) -> None:
        with provider_env():
            provider = meta_memory.initialize(session_id="session-123")

            with patch.object(meta_memory.subprocess, "run") as run:
                self.assertIsNone(provider.on_session_end(session_id="session-123"))
                self.assertIsNone(meta_memory.on_session_end(session_id="session-123"))

        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
