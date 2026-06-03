# Hermes Adapter

This directory contains a thin Python adapter for Hermes Agent. Hermes plugins
are Python modules, so this adapter delegates all storage and routing work to
the TypeScript `meta-memory` CLI.

Python must only map Hermes lifecycle and tool calls to the TypeScript CLI. It
must not own memory schema, ranking, persistence, retrieval, verification
policy, or product behavior.

## Contract Shape

Current Hermes documentation describes local plugins with:

- `plugin.yaml` metadata, including the plugin name, version, description,
  provided tools, and provided hooks;
- a Python `register(ctx)` entrypoint that calls `ctx.register_tool(...)` and
  `ctx.register_hook(...)`;
- lifecycle hook names such as `pre_tool_call`, `post_tool_call`,
  `pre_llm_call`, `post_llm_call`, `on_session_start`, and `on_session_end`;
- OpenAI-style tool schemas with `parameters` paired with Python handlers that
  return JSON strings.

This adapter exposes `initialize(...)` as bridge setup only: read environment,
prepare CLI and SQLite path configuration, and avoid owning memory schema,
ranking, persistence, or retrieval there. The current registration wires the v1
tools and the `on_session_end` hook; additional lifecycle hooks should be added
only when their Hermes signatures and local behavior are proven.

The repo-level proof today is local contract alignment and smoke testing. Do not
describe it as a live production Hermes installation unless a real target Hermes
checkout has loaded the plugin and exercised the registered hooks and tools.

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

For local smoke testing, use the adapter directory in this repo. For a real
Hermes checkout, install the plugin according to that target release's plugin
directory and enablement rules, then verify that `plugin.yaml`, `register(ctx)`,
`initialize(...)` behavior, hooks, and tool schemas are discovered.

## Configuration

- `META_MEMORY_CLI` is the command Hermes runs. It can be a bin name like `meta-memory` or a command with arguments like `node '/absolute/path/packages/cli/dist/index.js'`.
- `META_MEMORY_DB` is the SQLite file used by the TypeScript CLI. The adapter creates the parent directory when it is missing.
- `META_MEMORY_TIMEOUT_SECONDS` defaults to `20` and must be a positive number.

The adapter always sends its configured `META_MEMORY_DB` to the CLI. Tool-call arguments cannot override the database path.

## Adapter Boundary

The adapter currently exposes the v1/v1.1 tools:

- `context_pack`
- `remember`
- `search`
- `upsert_session_state`
- `upsert_resource`
- `browse_resources`
- `verify`

`handoff` and `reflect` are intentionally deferred to v2.

Hermes tool schemas are intentionally narrower than the CLI contracts. For
example, the `remember` tool exposes only `content`; the adapter supplies the
configured database path and TypeScript defaults handle the rest. Each registered
tool schema must point to a Python handler that delegates to the matching CLI
command.

## Lifecycle Mapping

The current adapter maps Hermes-facing behavior to CLI commands. In the
`register(ctx)` integration, tool methods become registered handlers, while
provider callbacks and hooks stay thin bridges to the same CLI behavior:

| Adapter method | CLI command | Purpose |
| --- | --- | --- |
| `system_prompt_block` | none | Describes memory trust and warning policy. |
| `prefetch` | `context-pack` | Builds a bounded context pack before a turn. |
| `sync_turn` | `remember` | Appends user and assistant messages asynchronously. |
| `on_memory_write` | `remember` | Mirrors explicit memory writes. |
| `handle_tool_call("context_pack")` | `context-pack` | Manual context-pack inspection. |
| `handle_tool_call("remember")` | `remember` | Explicit memory event append. |
| `handle_tool_call("search")` | `search` | Local memory search. |
| `handle_tool_call("upsert_session_state")` | `upsert-session-state` | Compact active task-state update. |
| `handle_tool_call("upsert_resource")` | `upsert-resource` | Workspace resource update. |
| `handle_tool_call("browse_resources")` | `browse-resources` | Workspace resource listing. |
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

These checks prove the local adapter, manifest, `initialize(...)`,
`register(ctx)`, tool schemas, hook registration fixture, and CLI bridge. They
do not prove live Hermes plugin discovery, enablement, lifecycle hook execution,
or production installation for a specific Hermes release.
