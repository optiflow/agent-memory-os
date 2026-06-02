# Hermes Install Notes

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

Copy or symlink:

```text
adapters/hermes/plugins/memory/meta_memory
```

into the Hermes memory plugin directory, then select `meta_memory` as the active memory provider.

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

## Notes

- Hermes can use one external provider at a time, so this plugin acts as the meta-provider.
- The adapter returns JSON context packs with citations.
- `META_MEMORY_DB` controls the local SQLite database path.
- The adapter creates the parent directory for file-backed `META_MEMORY_DB` paths.
- Tool-call arguments cannot override the configured database path.
- `META_MEMORY_TIMEOUT_SECONDS` controls adapter subprocess timeouts and must be positive.
