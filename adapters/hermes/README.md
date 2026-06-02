# Hermes Adapter

This directory contains a thin Python adapter for Hermes Agent. Hermes memory providers are Python plugins, so this adapter delegates all storage and routing work to the TypeScript `meta-memory` CLI.

## Local Setup

```bash
pnpm install
pnpm --filter @agent-memory-os/cli build
pnpm --filter @agent-memory-os/cli link --global
export META_MEMORY_CLI=meta-memory
export META_MEMORY_DB="$HOME/.hermes/meta-memory.sqlite"
```

Then copy or symlink `adapters/hermes/plugins/memory/meta_memory` into the Hermes memory plugin directory and select `meta_memory` as the active provider.

## Adapter Boundary

The adapter exposes only four v1 tools:

- `context_pack`
- `remember`
- `search`
- `verify`

`handoff` and `reflect` are intentionally deferred to v2.
