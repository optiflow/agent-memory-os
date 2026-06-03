---
title: Evaluation
description: Local acceptance gates, smoke tests, deterministic evals, and benchmark tracks.
---

Evaluation starts with deterministic local gates. Memory benchmarks are useful
only after the adapter contract and V1 data paths are stable.

## Local Acceptance

The repo should pass:

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
pnpm run ci
```

`pnpm run ci` is the expected pull-request gate and runs lint, typecheck, tests,
build, adapter checks, deterministic memory evals, the documentation freshness
gate, and report-only benchmark timings.

Python checks are adapter-boundary checks only. TypeScript owns memory ranking,
schema, persistence, routing, verification policy, and product behavior.

## Documentation Freshness Gate

Run the docs guard before finalizing implementation changes:

```bash
pnpm docs:check
```

The guard fails when code, adapter, tooling, workflow, or policy changes land
without the matching documentation surface in the same diff. It checks changed
paths, validates `.devin/wiki.json`, and rejects stale canonical references to
deleted root `docs/*.md` files.

Expected behavior:

- core, SQLite, eval, router, context-pack, verification, schema, and memory
  behavior changes require Starlight docs under `apps/docs/src/content/docs/`;
- CLI surface changes require the CLI reference and a human-facing or
  agent-facing summary when user-visible behavior changes;
- Hermes adapter, root plugin shim, and setup-skill changes require Hermes
  adapter or install docs;
- tooling and docs-guard policy changes require `AGENTS.md`, environment docs,
  or this evaluation page;
- `.devin/wiki.json` must stay valid, use unique page titles, and reference
  existing priority files.

The guard does not update DeepWiki. DeepWiki is a generated external index: keep
`.devin/wiki.json` current, then audit the refreshed wiki after merge before
claiming the public DeepWiki page is current.

## CLI Smoke Test

```bash
pnpm --filter @agent-memory-os/cli build
tmp_dir="$(mktemp -d)"
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\"}" | node packages/cli/dist/index.js seed-sample
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

These commands are local adapter-boundary smoke proof. They cover the
root and nested `plugin.yaml` manifest fixtures, absence of stale JSON metadata,
root shim delegation, `initialize(...)` bridge setup, `register(ctx)` wiring,
setup-skill registration when available, the local `on_session_end` hook
fixture, Hermes `parameters` tool schemas, JSON-string tool results, progressive
configuration status, and CLI delegation.

Before real Hermes integration testing, verify the target Hermes plugin contract
against a live checkout. Local fixture coverage does not prove Hermes runtime
discovery, enablement, or hook execution.

## Current Coverage

Current local tests cover:

- FTS search returns evidence and facts;
- FTS search returns session state and workspace resources;
- context packing respects token budgets and `auto`/`task`/`workspace` policy
  boundaries;
- CLI seed and context-pack smoke behavior;
- Hermes adapter metadata uses `plugin.yaml`;
- adapter `initialize(...)` and `register(ctx)` wire the provider, V1/V1.1
  tools, setup skill, and `on_session_end` hook in a local fixture;
- adapter `status` reports missing CLI, env CLI, repo-local CLI fallback, and
  selected database path without calling the CLI;
- adapter tool schemas use the Hermes `parameters` shape;
- adapter tool handlers return JSON strings;
- adapter tool-call arguments cannot override configured `META_MEMORY_DB`;
- adapter CLI failure handling.

## Local Memory Benchmarks

The first benchmark track is deterministic and repo-owned. It is inspired by the
report's benchmark families, but it does not fetch external datasets, call LLMs,
or add non-local memory providers.

Run the quality eval:

```bash
pnpm eval
```

Expected result:

- Vitest runs the benchmark fixture assertions;
- `packages/evals/reports/eval.json` is written;
- all deterministic quality metrics stay at their expected values.

Run timing benchmarks:

```bash
pnpm bench
pnpm bench:ci
```

Expected result:

- Vitest runs the timing benchmarks for fixture seeding, SQLite FTS search, and
  context-pack generation;
- `packages/evals/reports/benchmarks.json` is written;
- `pnpm bench:ci` is report-only and should fail only when the benchmark harness
  itself fails.

Major memory additions must add or update at least one benchmark case when they
change retrieval, context packing, write preservation, verification policy, or
the local storage behavior that affects memory quality.

## Future Local Behavior Gaps

Future local feature work should add tests for:

- write path preserves evidence before derived facts;
- adapter subprocess timeouts fail clearly;
- real Hermes plugin discovery, hook execution, and tool schema registration for
  a target Hermes version.

## Quality Metrics

- Recall at K.
- Irrelevant injection rate.
- Context-pack citation coverage.
- Token budget compliance.
- Evidence coverage.
- Context-pack generation latency.
- Search latency and p95 prefetch latency.
- Verification record rate.
- Stale or unsupported memory rate.
- Contradiction resolution rate.
- Handoff recovery quality, once handoff packets exist.
- Wrong answers caused by write-side loss versus retrieval-side loss.

## Future Benchmark Tracks

Use conversational recall benchmarks for user and session memory, temporal
reasoning benchmarks for contradiction and validity-window behavior, and
environment-experience tests for coding-agent workflows.

The key acceptance criterion is not raw recall alone. The system must avoid
stale, irrelevant, unsupported, or branch-invalid injection, and it must
separate write-side preservation failures from retrieval failures.

External benchmarks from the report should stay future-facing until a target
Hermes runtime has stable, tested plugin discovery, hook execution, and tool
execution coverage.
