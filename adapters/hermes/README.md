# Hermes Adapter

This directory contains a thin Python adapter for Hermes Agent. Hermes memory providers are Python plugins, so this adapter delegates all storage and routing work to the TypeScript `meta-memory` CLI.

Python must only map Hermes lifecycle and tool calls to the TypeScript CLI. It
must not own memory schema, ranking, persistence, retrieval, verification
policy, or product behavior.

## Compatibility Audit First

Before feature development, verify the target Hermes version and plugin contract.
Current Hermes documentation describes memory plugins with `plugin.yaml`,
`register(ctx)`, and lifecycle hooks. This repo currently contains a
`plugin.json` scaffold and a `MetaMemoryProvider` class.

The current scaffold does not yet prove production Hermes activation through
`plugin.yaml`, `register(ctx)`, or `initialize(...)`.

Do not assume the adapter is production-compatible until the target Hermes
version confirms:

- metadata filename and fields;
- provider registration function or class discovery;
- required `initialize` behavior;
- prefetch and turn-sync hook signatures;
- provider tool schema and handler registration;
- session-end and built-in memory write mirroring behavior.

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

The adapter currently exposes only four v1 tools:

- `context_pack`
- `remember`
- `search`
- `verify`

`handoff` and `reflect` are intentionally deferred to v2.

Hermes tool schemas are intentionally narrower than the CLI contracts. For
example, the `remember` tool exposes only `content`; the adapter supplies the
configured database path and TypeScript defaults handle the rest.

## Lifecycle Mapping

The current scaffold maps Hermes-facing behavior to CLI commands:

| Adapter method | CLI command | Purpose |
| --- | --- | --- |
| `system_prompt_block` | none | Describes memory trust and warning policy. |
| `prefetch` | `context-pack` | Builds a bounded context pack before a turn. |
| `sync_turn` | `remember` | Appends user and assistant messages asynchronously. |
| `on_memory_write` | `remember` | Mirrors explicit memory writes. |
| `handle_tool_call("context_pack")` | `context-pack` | Manual context-pack inspection. |
| `handle_tool_call("remember")` | `remember` | Explicit memory event append. |
| `handle_tool_call("search")` | `search` | Local memory search. |
| `handle_tool_call("verify")` | `verify` | Verification record append. |

Tool-call arguments cannot override the configured database path.

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

These checks prove the local adapter and CLI scaffold. They do not prove Hermes
plugin discovery for a specific Hermes release.
