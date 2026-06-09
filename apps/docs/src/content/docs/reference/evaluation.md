---
title: Evaluation
description: Local acceptance gates, smoke tests, deterministic evals, and benchmark tracks.
---

Evaluation starts with deterministic local gates. Memory benchmarks are useful
only after the adapter contract and V1 data paths are stable.

## Full Gate

Run the full local gate before finalizing broad implementation work:

```bash
pnpm run ci
```

`pnpm run ci` runs the documentation freshness gate, linting, typechecking,
tests, builds, adapter-boundary checks, deterministic memory evals, and
report-only benchmark timings.

Python checks are adapter-boundary checks only. TypeScript owns memory ranking,
schema, persistence, routing, verification policy, and product behavior.

## Narrow Checks

| Change area | First check |
| --- | --- |
| Core/router behavior | `pnpm --filter @agent-memory-os/core test` |
| SQLite/schema behavior | `pnpm --filter @agent-memory-os/sqlite test` |
| CLI contracts | `pnpm --filter @agent-memory-os/cli test` |
| Eval or retrieval policy | `pnpm eval` and `pnpm bench:ci` |
| Hermes adapter | `pnpm adapter:check` |
| Documentation only | `pnpm lint:repo`; add `pnpm docs:build` for Starlight content, config, navigation, or rendered Mermaid diagram changes. |

The standalone commands remain available when you need to isolate failures:

```bash
pnpm lint
pnpm lint:packages
pnpm lint:repo
pnpm typecheck
pnpm test
pnpm eval
pnpm bench:ci
pnpm build
pnpm adapter:check
pnpm docs:check
pnpm docs:build
pnpm release:check
```

## Documentation Freshness

Run the docs guard before finalizing implementation changes:

```bash
pnpm docs:check
```

The guard fails when code, adapter, tooling, workflow, or policy changes land
without the matching documentation surface in the same diff. It checks changed
paths, validates `.devin/wiki.json`, and rejects stale canonical references to
deleted root `docs/*.md` files or Starlight links to source-file URLs.

Expected behavior:

- core, SQLite, eval, router, context-pack, verification, schema, and memory
  behavior changes require Starlight docs under `apps/docs/src/content/docs/`;
- CLI surface changes require the CLI reference and a human-facing or
  agent-facing summary when user-visible behavior changes;
- Hermes adapter, root plugin shim, and setup-skill changes require Hermes
  adapter or install docs;
- tooling and docs-guard policy changes require `AGENTS.md`, environment docs,
  or this evaluation page;
- Starlight content links must use published route paths, not `.md` source-file
  URLs or related typo variants;
- `.devin/wiki.json` must stay valid, use unique page titles, and reference
  existing priority files.

The guard does not update DeepWiki. DeepWiki is a generated external index: keep
`.devin/wiki.json` current, then audit the refreshed wiki after merge before
claiming the public DeepWiki page is current.

## Release Automation

Releases are Changesets-gated repository releases. Feature, fix, docs, adapter,
or tooling improvements that should appear in release notes need a changeset for
the root `agent-memory-os` package:

```bash
pnpm changeset
```

Use patch for fixes and docs/tooling polish, minor for new capabilities, and
major only for breaking public behavior. PRs that intentionally should not
produce a release can use `[no release]` in the PR title or body.

The `Release Metadata` workflow runs `pnpm release:check` on pull requests. It
emits warnings for release-relevant changes without a changeset, but it does not
fail CI.

After the `CI` workflow succeeds on `main`, the `Release` workflow runs
`changesets/action`. Pending changesets create or update the `Version Agent
Memory OS` PR. When that version PR merges, `pnpm release:github` reads the root
`CHANGELOG.md`, uses the current root `package.json` version, and creates a
single GitHub Release titled `Agent Memory OS vX.Y.Z`. The repo does not publish
packages to npm.

## CLI Smoke Test

```bash
pnpm --filter @agent-memory-os/cli build
tmp_dir="$(mktemp -d)"
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\"}" \
  | node packages/cli/dist/index.js seed-sample
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\",\"query\":\"Biome formatter\",\"budgetTokens\":400}" \
  | node packages/cli/dist/index.js context-pack
```

Expected result:

- the first command returns sample core, event, fact, session-state, and
  workspace-resource records;
- the second command returns `contextPack`;
- the context pack includes the seeded Biome memory and V1.1 projections;
- citations are present on included items.

## Adapter Smoke Test

```bash
python3 -m py_compile __init__.py
python3 -m py_compile adapters/hermes/plugins/memory/meta_memory/__init__.py
python3 -m unittest discover adapters/hermes/plugins/memory/meta_memory/test
pnpm adapter:check
```

These commands are local adapter-boundary smoke proof. They cover root and
nested `plugin.yaml` manifest fixtures, absence of stale JSON metadata, root
shim delegation, `initialize(...)` bridge setup, `register(ctx)` wiring,
setup-skill registration when available, local `pre_tool_call`,
`post_tool_call`, and `on_session_end` hook fixtures, Hermes `parameters` tool
schemas, JSON-string tool results, progressive configuration status, and CLI
delegation.

Before real Hermes integration testing, verify the target Hermes plugin contract
against a live checkout. Local fixture coverage does not prove Hermes runtime
discovery, enablement, or hook execution.

## Evals And Benchmarks

Run the quality eval:

```bash
pnpm eval
```

Expected result:

- Vitest runs the benchmark fixture assertions.
- `packages/evals/reports/eval.json` is written.
- All deterministic quality metrics stay at their expected values.

Run timing benchmarks:

```bash
pnpm bench
pnpm bench:ci
```

Expected result:

- Vitest runs timing benchmarks for fixture seeding, SQLite FTS search, and
  context-pack generation.
- `packages/evals/reports/benchmarks.json` is written.
- `pnpm bench:ci` is report-only and should fail only when the benchmark
  harness itself fails.

Major memory additions must add or update at least one benchmark case when they
change retrieval, context packing, write preservation, verification policy, or
local storage behavior that affects memory quality. V2 Core additions should
include a deterministic recall-safety case for citation, temporal relation, or
drift warnings.

## Current Coverage

Current local tests cover:

- FTS search returns evidence and facts.
- FTS search returns session state and workspace resources.
- Context packing respects token budgets and `auto`/`task`/`workspace` policy
  boundaries.
- Context packs preserve risky items while adding V2 Core recall warnings.
- SQLite stores and probes scoped temporal relations.
- SQLite emits missing-source citation warnings.
- CLI `add-relation`, `probe-relations`, and workspace drift warnings.
- CLI seed and context-pack smoke behavior.
- Hermes adapter metadata uses `plugin.yaml`.
- Adapter `initialize(...)` and `register(ctx)` wire the provider, V1/V1.1/V2
  Core tools, setup skill, and lifecycle hooks in a local fixture.
- Adapter `pre_tool_call` and `post_tool_call` record tool-call and tool-result
  evidence without blocking Hermes tool execution when hook writes cannot run.
- Adapter `status` reports missing CLI, env CLI, repo-local CLI fallback, and
  selected database path without calling the CLI.
- Adapter tool schemas use the Hermes `parameters` shape.
- Adapter tool handlers return JSON strings.
- Adapter tool-call arguments cannot override configured `META_MEMORY_DB`.
- Adapter passes `workspacePath` through to `context_pack`.
- Adapter CLI failure handling.

## Future Gaps

Future local feature work should add tests for:

- broader write path coverage for derived facts beyond current projection
  writes;
- adapter subprocess timeouts fail clearly;
- real Hermes plugin discovery, hook execution, and tool schema registration for
  a target Hermes version.

Future benchmark tracks should cover conversational recall, temporal reasoning,
validity-window conflict handling, reflection, handoff recovery, and richer
coding-agent environment experience.

The key acceptance criterion is not raw recall alone. The system must avoid
stale, irrelevant, unsupported, or branch-invalid injection, and it must
separate write-side preservation failures from retrieval failures.
