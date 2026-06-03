from __future__ import annotations

import importlib.util
import json
import os
import shlex
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).resolve().parents[1] / "__init__.py"
ROOT_DIR = MODULE_PATH.parents[5]
ROOT_MODULE_PATH = ROOT_DIR / "__init__.py"
ROOT_PLUGIN_YAML_PATH = ROOT_DIR / "plugin.yaml"
SETUP_SKILL_PATH = ROOT_DIR / "skills" / "agent-memory-os-setup" / "SKILL.md"


def load_module(path: Path, name: str) -> object:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


meta_memory = load_module(MODULE_PATH, "meta_memory_provider")

PLUGIN_DIR = MODULE_PATH.parent
PLUGIN_YAML_PATH = PLUGIN_DIR / "plugin.yaml"
PLUGIN_JSON_PATH = PLUGIN_DIR / "plugin.json"


class FakeHermesContext:
    def __init__(self) -> None:
        self.providers: list[object] = []
        self.tools: list[dict[str, object]] = []
        self.hooks: dict[str, object] = {}
        self.skills: list[tuple[str, Path]] = []

    def register_memory_provider(self, provider: object) -> None:
        self.providers.append(provider)

    def register_tool(self, **kwargs: object) -> None:
        self.tools.append(kwargs)

    def register_hook(self, name: str, handler: object) -> None:
        self.hooks[name] = handler

    def register_skill(self, name: str, skill_path: Path) -> None:
        self.skills.append((name, skill_path))


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
        root_metadata = parse_plugin_yaml(ROOT_PLUGIN_YAML_PATH)
        expected_tools = [
            "status",
            "context_pack",
            "remember",
            "search",
            "upsert_session_state",
            "upsert_resource",
            "browse_resources",
            "verify",
        ]

        self.assertFalse(PLUGIN_JSON_PATH.exists())
        self.assertEqual("meta_memory", metadata["name"])
        self.assertEqual("0.1.0", metadata["version"])
        self.assertEqual("MetaMemoryProvider", metadata["provider_class"])
        self.assertEqual(expected_tools, metadata["provides_tools"])
        self.assertEqual(["on_session_end"], metadata["provides_hooks"])
        self.assertEqual("meta_memory", root_metadata["name"])
        self.assertEqual(expected_tools, root_metadata["provides_tools"])

    def test_root_plugin_shim_delegates_to_nested_adapter(self) -> None:
        root_meta_memory = load_module(ROOT_MODULE_PATH, "root_meta_memory_provider")

        with provider_env():
            provider = root_meta_memory.initialize(session_id="session-root")

        ctx = FakeHermesContext()
        registered = root_meta_memory.register(ctx)

        self.assertEqual("MetaMemoryProvider", provider.__class__.__name__)
        self.assertIs(provider, registered)
        self.assertEqual([provider], ctx.providers)
        self.assertEqual(
            [
                "status",
                "context_pack",
                "remember",
                "search",
                "upsert_session_state",
                "upsert_resource",
                "browse_resources",
                "verify",
            ],
            [tool["name"] for tool in ctx.tools],
        )
        self.assertEqual([("agent-memory-os-setup", SETUP_SKILL_PATH)], ctx.skills)

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

    def test_initialize_uses_hermes_home_db_path_when_db_env_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            hermes_home = Path(temp_dir) / "hermes-home"

            with patch.dict(
                os.environ,
                {
                    "META_MEMORY_CLI": "definitely-missing-meta-memory",
                    "META_MEMORY_TIMEOUT_SECONDS": "20",
                },
                clear=True,
            ):
                provider = meta_memory.initialize(
                    session_id="session-123",
                    hermes_home=hermes_home,
                )

            self.assertEqual(str(hermes_home / "meta-memory.sqlite"), provider._db_path)
            self.assertEqual("hermes_home", provider._db_path_source)
            self.assertTrue(hermes_home.exists())

    def test_register_wires_provider_tools_and_session_end_hook(self) -> None:
        with provider_env():
            provider = meta_memory.initialize(session_id="session-123")

        ctx = FakeHermesContext()
        registered = meta_memory.register(ctx)

        self.assertIs(provider, registered)
        self.assertEqual([provider], ctx.providers)
        self.assertEqual(
            [
                "status",
                "context_pack",
                "remember",
                "search",
                "upsert_session_state",
                "upsert_resource",
                "browse_resources",
                "verify",
            ],
            [tool["name"] for tool in ctx.tools],
        )
        self.assertEqual({"on_session_end"}, set(ctx.hooks))
        self.assertEqual(ctx.hooks["on_session_end"], provider.on_session_end)
        self.assertEqual([("agent-memory-os-setup", SETUP_SKILL_PATH)], ctx.skills)

        search_tool = next(tool for tool in ctx.tools if tool["name"] == "search")
        with patch.object(provider, "handle_tool_call", return_value='{"results": []}') as handle:
            result = search_tool["handler"]({"query": "Biome"})

        self.assertEqual('{"results": []}', result)
        handle.assert_called_once_with("search", {"query": "Biome"})

    def test_tool_schemas_use_hermes_parameters_shape(self) -> None:
        with provider_env():
            provider = meta_memory.MetaMemoryProvider()

        schemas = provider.get_tool_schemas()

        self.assertEqual(
            [
                "status",
                "context_pack",
                "remember",
                "search",
                "upsert_session_state",
                "upsert_resource",
                "browse_resources",
                "verify",
            ],
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

    def test_status_reports_missing_cli_without_running_subprocess(self) -> None:
        with provider_env(META_MEMORY_CLI="definitely-missing-meta-memory"):
            provider = meta_memory.MetaMemoryProvider()

        with patch.object(meta_memory.subprocess, "run") as run:
            result = json.loads(provider.handle_tool_call("status", {}))

        run.assert_not_called()
        self.assertFalse(provider.is_available())
        self.assertEqual("configuration_required", result["status"])
        self.assertFalse(result["cli"]["available"])
        self.assertEqual("environment", result["cli"]["source"])
        self.assertEqual(":memory:", result["database"]["path"])
        self.assertTrue(result["nextSetupCommands"])
        self.assertIn("not configured", provider.system_prompt_block())

    def test_status_reports_env_configured_cli(self) -> None:
        cli_path = "/tmp/agent-memory-os-cli.js"
        with provider_env(META_MEMORY_CLI=f"node {shlex.quote(cli_path)}"):
            provider = meta_memory.MetaMemoryProvider()

        result = provider.status()

        self.assertEqual("environment", result["cli"]["source"])
        self.assertEqual(f"node {shlex.quote(cli_path)}", result["cli"]["command"])
        self.assertEqual(cli_path, result["cli"]["targetPath"])
        self.assertFalse(result["cli"]["targetExists"])

    def test_repo_local_built_cli_is_used_when_env_cli_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_root = Path(temp_dir)
            cli_path = repo_root / "packages" / "cli" / "dist" / "index.js"
            cli_path.parent.mkdir(parents=True)
            cli_path.touch()

            with (
                patch.dict(os.environ, {"META_MEMORY_DB": ":memory:"}, clear=True),
                patch.object(meta_memory, "_repo_root", return_value=repo_root),
                patch.object(meta_memory, "_repo_cli_path", return_value=cli_path),
                patch.object(meta_memory.shutil, "which", return_value="/usr/bin/node"),
            ):
                provider = meta_memory.MetaMemoryProvider()
                result = provider.status()

        self.assertEqual("repo-local", result["cli"]["source"])
        self.assertEqual(f"node {shlex.quote(str(cli_path))}", result["cli"]["command"])
        self.assertTrue(result["cli"]["available"])
        self.assertEqual("ready", result["status"])
        self.assertEqual([], result["nextSetupCommands"])

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

            self.assertEqual({"results": []}, json.loads(result))
            self.assertTrue(db_path.parent.exists())
            self.assertEqual(["meta-memory", "search"], run.call_args.args[0])

            payload = json.loads(run.call_args.kwargs["input"])
            self.assertEqual(str(db_path), payload["dbPath"])
            self.assertEqual("Biome formatter", payload["query"])

    def test_on_memory_write_mirrors_builtin_memory_write_to_cli(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["meta-memory", "remember"],
            returncode=0,
            stdout=json.dumps({"event": {"id": "event_1"}}),
            stderr="",
        )
        with provider_env():
            provider = meta_memory.MetaMemoryProvider()

        with patch.object(meta_memory.subprocess, "run", return_value=completed) as run:
            result = provider.on_memory_write(
                "add",
                "memory",
                "Remember the adapter boundary.",
                metadata={"source": "hermes"},
            )

        self.assertIsNone(result)
        self.assertEqual(["meta-memory", "remember"], run.call_args.args[0])

        payload = json.loads(run.call_args.kwargs["input"])
        self.assertEqual(":memory:", payload["dbPath"])
        self.assertEqual("explicit_memory", payload["kind"])
        self.assertEqual("Remember the adapter boundary.", payload["content"])
        self.assertEqual(
            {"action": "add", "target": "memory", "source": "hermes"},
            payload["metadata"],
        )

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
            provider.sync_turn(
                "user text",
                "assistant text",
                session_id="session-1",
                messages=[],
            )

        self.assertEqual(2, run.call_count)
        payloads = [json.loads(call.kwargs["input"]) for call in run.call_args_list]
        self.assertEqual(
            [
                {
                    "dbPath": ":memory:",
                    "kind": "user_message",
                    "actor": "user",
                    "content": "user text",
                    "metadata": {
                        "session_id": "session-1",
                        "message_count": 0,
                        "platform": "",
                    },
                },
                {
                    "dbPath": ":memory:",
                    "kind": "assistant_message",
                    "actor": "assistant",
                    "content": "assistant text",
                    "metadata": {
                        "session_id": "session-1",
                        "message_count": 0,
                        "platform": "",
                    },
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
                self.assertIsNone(provider.on_session_end([{"role": "user", "content": "hi"}]))
                self.assertIsNone(
                    meta_memory.on_session_end([{"role": "user", "content": "hi"}])
                )

        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
