# Hermes Install Notes

## Contract Check

Before installing this adapter into a real Hermes checkout, verify the target
Hermes version and plugin contract. Current Hermes documentation describes
`plugin.yaml` metadata, a Python `register(ctx)` entrypoint, lifecycle hooks, and
tool schemas registered with handlers.

Treat the steps below as local contract alignment and smoke proof. They do not
claim a live production Hermes installation.

Python is only the Hermes boundary. It maps Hermes calls to the TypeScript CLI
and must not own memory schema, ranking, persistence, retrieval, verification
policy, or product behavior.

## Prerequisites

- Node.js and pnpm that satisfy the repo `engines`.
- Python 3 for the Hermes provider shim.
- A built `@agent-memory-os/cli` package.

## Build the CLI

```bash
pnpm install
pnpm --filter @agent-memory-os/cli build
```

For local development, point Hermes at the built CLI:

```bash
export META_MEMORY_CLI="node '$PWD/packages/cli/dist/index.js'"
export META_MEMORY_DB="$HOME/.hermes/meta-memory.sqlite"
export META_MEMORY_TIMEOUT_SECONDS=20
```

If Hermes expects an executable command, install or link the `meta-memory` bin:

```bash
pnpm --filter @agent-memory-os/cli link --global
export META_MEMORY_CLI=meta-memory
```

## Install the Plugin

For local smoke testing, use the adapter directory in this repo:

```text
adapters/hermes/plugins/memory/meta_memory
```

For a real Hermes checkout, follow that release's plugin installation path and
enablement rules. Confirm that Hermes discovers `plugin.yaml`, imports the Python
module, calls `register(ctx)`, runs any required `initialize(...)` bridge setup,
and registers the expected lifecycle hooks and tool schemas.

Do not treat local smoke output as proof of a live Hermes install.

## Smoke Check Before Hermes

Compile the adapter and run its stdlib tests:

```bash
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

The context-pack output should include `contextPack` and the seeded Biome memory.

This proves the adapter can compile, call the TypeScript CLI, and use the
configured SQLite path locally. It does not prove Hermes plugin discovery or
runtime hook execution.

## Notes

- This repo is designed to act as the single Hermes-facing meta-memory boundary.
- The adapter returns JSON context packs with citations.
- `META_MEMORY_DB` controls the local SQLite database path.
- The adapter creates the parent directory for file-backed `META_MEMORY_DB` paths.
- Tool-call arguments cannot override the configured database path.
- `META_MEMORY_TIMEOUT_SECONDS` controls adapter subprocess timeouts and must be positive.
