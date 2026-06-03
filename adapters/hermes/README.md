# Hermes Adapter

This directory contains a thin Python adapter for Hermes Agent. Hermes plugins
are Python modules, so this adapter delegates all storage and routing work to
the TypeScript `meta-memory` CLI.

The repository root also contains a Hermes plugin shim for Git-based installs.
That shim exists only for discovery; this directory remains the implementation
boundary.

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

The plugin can be installed before the TypeScript CLI is ready. In that state,
call the `meta_memory.status` tool to get CLI availability, database path, and
next setup commands.

```bash
pnpm install
pnpm --filter @agent-memory-os/cli build
export META_MEMORY_CLI="node '$PWD/packages/cli/dist/index.js'"
```

You can also link the CLI globally and leave `META_MEMORY_CLI` unset:

```bash
pnpm --filter @agent-memory-os/cli link --global
```

For maintainer review or vendoring, use the adapter directory in this repo. For
ordinary Git-based Hermes installs, point Hermes at the repository root so it
can discover the root `plugin.yaml` and shim. For a real Hermes checkout, still
verify that `plugin.yaml`, `register(ctx)`, `initialize(...)` behavior, hooks,
setup-skill registration when available, and tool schemas are discovered.

## Configuration

- `META_MEMORY_CLI` is optional when `meta-memory` is on `PATH` or the built repo-local CLI exists at `packages/cli/dist/index.js`. It can be a bin name like `meta-memory` or a command with arguments like `node '/absolute/path/packages/cli/dist/index.js'`.
- `META_MEMORY_DB` is optional. If unset, the adapter uses Hermes home when available, otherwise `~/.hermes/meta-memory.sqlite`. The adapter creates the parent directory when it is missing.
- `META_MEMORY_TIMEOUT_SECONDS` defaults to `20` and must be a positive number.

The adapter always sends its configured `META_MEMORY_DB` to the CLI. Tool-call arguments cannot override the database path.

## Adapter Boundary

The adapter currently exposes the v1/v1.1 tools:

- `status`
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
| `handle_tool_call("status")` | none | Reports adapter configuration without calling the CLI. |
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
python3 -m py_compile __init__.py
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

These checks prove the local adapter, root shim, manifests, `initialize(...)`,
`register(ctx)`, setup-skill registration fixture, tool schemas, hook
registration fixture, progressive status diagnostics, and CLI bridge. They do
not prove live Hermes plugin discovery, enablement, lifecycle hook execution, or
production installation for a specific Hermes release.
