---
title: Hermes Install Notes
description: Local adapter contract checks and cautious Hermes installation guidance.
---

## Contract Check

Before installing this adapter into a real Hermes checkout, verify the target
Hermes version and plugin contract. Current Hermes documentation describes
`plugin.yaml` metadata, a Python `register(ctx)` entrypoint, lifecycle hooks,
and tool schemas registered with handlers.

Treat the steps below as local contract alignment and smoke proof. They do not
claim a live production Hermes installation.

Python is only the Hermes boundary. It maps Hermes calls to the TypeScript CLI
and must not own memory schema, ranking, persistence, retrieval, verification
policy, or product behavior.

## Prerequisites

- Node.js and pnpm that satisfy the repo `engines`.
- Python 3 for the Hermes provider shim.
- A built `@agent-memory-os/cli` package before memory tools are ready.

The plugin can be installed before the CLI is configured. In that state, use the
Hermes `meta_memory.status` tool to see the missing command, the selected
SQLite path, and the next setup commands.

## Build The CLI

```bash
pnpm install
pnpm --filter @agent-memory-os/cli build
```

For local development, point Hermes at the built CLI when you do not want to
link a global bin:

```bash
export META_MEMORY_CLI="node '$PWD/packages/cli/dist/index.js'"
```

If Hermes expects an executable command, install or link the `meta-memory` bin
and leave `META_MEMORY_CLI` unset:

```bash
pnpm --filter @agent-memory-os/cli link --global
```

`META_MEMORY_DB` is optional. If unset, the adapter uses the Hermes home path
when Hermes provides it, otherwise `~/.hermes/meta-memory.sqlite`.
`META_MEMORY_TIMEOUT_SECONDS` is optional and defaults to `20`.

## Install The Plugin

For Hermes maintainers, inspect or vendor the implementation boundary here:

```text
adapters/hermes/plugins/memory/meta_memory
```

For user-facing Git installs, point Hermes at the repository root. The root
`plugin.yaml` and `__init__.py` are a shim that delegates to the adapter above:

```bash
hermes plugins install optiflow/agent-memory-os --enable
```

After install, call `meta_memory.status`. If the CLI is not ready, run the
reported setup commands, then call `meta_memory.status` again before using
memory tools.

For a real Hermes checkout, still follow that release's plugin installation path
and enablement rules. Confirm that Hermes discovers `plugin.yaml`, imports the
Python module, calls `register(ctx)`, runs any required `initialize(...)` bridge
setup, registers the setup skill when `register_skill(...)` is available, and
registers the expected lifecycle hooks and tool schemas.

Do not treat local smoke output as proof of a live Hermes install.

## Smoke Check Before Hermes

Compile the adapter and run its stdlib tests:

```bash
python3 -m py_compile __init__.py
python3 -m py_compile adapters/hermes/plugins/memory/meta_memory/__init__.py
python3 -m unittest discover adapters/hermes/plugins/memory/meta_memory/test
pnpm adapter:check
```

Then verify the CLI path and SQLite path together:

```bash
tmp_dir="$(mktemp -d)"
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\"}" | node packages/cli/dist/index.js seed-sample
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\",\"query\":\"Biome formatter\",\"budgetTokens\":400}" \
  | node packages/cli/dist/index.js context-pack
```

The context-pack output should include `contextPack`, the seeded Biome memory,
sample session state, and sample workspace resource records.

This proves the adapter can compile, call the TypeScript CLI, and use the
configured SQLite path locally. It does not prove Hermes plugin discovery or
runtime hook execution.

## Notes

- This repo is designed to act as the single Hermes-facing meta-memory boundary.
- The root plugin shim is for Git-based Hermes plugin discovery only; memory
  behavior stays in the nested adapter and TypeScript packages.
- The adapter returns JSON context packs and tool results with citations where
  relevant.
- `meta_memory.status` does not call the TypeScript CLI and can diagnose missing
  CLI setup.
- `META_MEMORY_CLI` is optional when `meta-memory` is on `PATH` or the built
  repo-local CLI is present.
- `META_MEMORY_DB` optionally controls the local SQLite database path.
- The adapter creates the parent directory for file-backed `META_MEMORY_DB`
  paths.
- Tool-call arguments cannot override the configured database path.
- `META_MEMORY_TIMEOUT_SECONDS` controls adapter subprocess timeouts and must be
  positive.
