# Hermes Adapter

This directory contains a thin Python adapter for Hermes Agent. Hermes memory providers are Python plugins, so this adapter delegates all storage and routing work to the TypeScript `meta-memory` CLI.

## Local Setup

```bash
pnpm install
pnpm --filter @agent-memory-os/cli build
export META_MEMORY_CLI="node '$PWD/packages/cli/dist/index.js'"
export META_MEMORY_DB="$HOME/.hermes/meta-memory.sqlite"
export META_MEMORY_TIMEOUT_SECONDS=20
```

You can also link the CLI globally and use the bin name:

```bash
pnpm --filter @agent-memory-os/cli link --global
export META_MEMORY_CLI=meta-memory
```

Then copy or symlink `adapters/hermes/plugins/memory/meta_memory` into the Hermes memory plugin directory and select `meta_memory` as the active provider.

## Configuration

- `META_MEMORY_CLI` is the command Hermes runs. It can be a bin name like `meta-memory` or a command with arguments like `node '/absolute/path/packages/cli/dist/index.js'`.
- `META_MEMORY_DB` is the SQLite file used by the TypeScript CLI. The adapter creates the parent directory when it is missing.
- `META_MEMORY_TIMEOUT_SECONDS` defaults to `20` and must be a positive number.

The adapter always sends its configured `META_MEMORY_DB` to the CLI. Tool-call arguments cannot override the database path.

## Adapter Boundary

The adapter exposes only four v1 tools:

- `context_pack`
- `remember`
- `search`
- `verify`

`handoff` and `reflect` are intentionally deferred to v2.

## Smoke Checks

```bash
python3 -m py_compile adapters/hermes/plugins/memory/meta_memory/__init__.py
python3 -m unittest discover adapters/hermes/plugins/memory/meta_memory/test
pnpm adapter:check
```

For an end-to-end CLI check, build the CLI first and run:

```bash
tmp_dir="$(mktemp -d)"
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\"}" | node packages/cli/dist/index.js seed-sample
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\",\"query\":\"Biome formatter\",\"budgetTokens\":400}" \
  | node packages/cli/dist/index.js context-pack
```
