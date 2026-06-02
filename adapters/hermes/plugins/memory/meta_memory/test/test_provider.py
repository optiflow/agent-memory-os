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


class MetaMemoryProviderTest(unittest.TestCase):
    def test_run_uses_configured_db_path_and_creates_parent(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "nested" / "memory.sqlite"
            completed = subprocess.CompletedProcess(
                args=["meta-memory", "search"],
                returncode=0,
                stdout=json.dumps({"results": []}),
                stderr="",
            )

            with patch.dict(
                os.environ,
                {"META_MEMORY_CLI": "meta-memory", "META_MEMORY_DB": str(db_path)},
            ):
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

    def test_run_reports_cli_json_errors(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["meta-memory", "context-pack"],
            returncode=1,
            stdout="",
            stderr=json.dumps({"error": "Expected query"}),
        )
        with patch.dict(os.environ, {"META_MEMORY_DB": ":memory:"}):
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
        with patch.dict(os.environ, {"META_MEMORY_DB": ":memory:"}):
            provider = meta_memory.MetaMemoryProvider()

        with patch.object(meta_memory.subprocess, "run", return_value=completed):
            with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
                provider._run("search", {"dbPath": ":memory:", "query": "Biome"})


if __name__ == "__main__":
    unittest.main()
