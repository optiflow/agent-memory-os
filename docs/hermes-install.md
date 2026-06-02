# Hermes Install Notes

## Build the CLI

```bash
pnpm install
pnpm --filter @agent-memory-os/cli build
```

For local development, point Hermes at the built CLI:

```bash
export META_MEMORY_CLI="node $PWD/packages/cli/dist/index.js"
export META_MEMORY_DB="$HOME/.hermes/meta-memory.sqlite"
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

## Notes

- Hermes can use one external provider at a time, so this plugin acts as the meta-provider.
- The adapter returns JSON context packs with citations.
- `META_MEMORY_DB` controls the local SQLite database path.
- `META_MEMORY_TIMEOUT_SECONDS` controls adapter subprocess timeouts.
