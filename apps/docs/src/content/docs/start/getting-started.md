---
title: Getting Started
description: Install dependencies, run the local gate, and exercise the CLI bridge.
---

Use this page for the shortest path from a fresh checkout to a verified local
memory smoke test.

## Prerequisites

- Node.js 24.x. The repo uses Node's built-in `node:sqlite` module.
- pnpm through Corepack.
- Python 3 for the thin Hermes adapter checks.

## Install And Verify

Install dependencies and run the full local gate:

```bash
corepack enable pnpm
pnpm install
pnpm run ci
```

`pnpm run ci` runs linting, typechecking, tests, builds, adapter checks,
deterministic evals, and the report-only benchmark harness.

## CLI Smoke Test

Build the CLI, seed a temporary database, and request a context pack:

```bash
pnpm --filter @agent-memory-os/cli build
tmp_dir="$(mktemp -d)"
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\"}" \
  | node packages/cli/dist/index.js seed-sample
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\",\"query\":\"Biome formatter\",\"budgetTokens\":400}" \
  | node packages/cli/dist/index.js context-pack
```

Expected result:

- `seed-sample` returns sample core, evidence, fact, session-state, and
  workspace-resource records.
- `context-pack` returns a bounded `contextPack`.
- The returned context pack includes the seeded Biome memory with citations.

## Repository Layout

```text
packages/core      Domain types, context router, packer, verification policy
packages/sqlite    SQLite schema, migrations, FTS search, local store
packages/cli       JSON CLI bridge for Hermes and future adapters
packages/evals     Deterministic eval and benchmark fixtures
adapters/hermes    Thin Python Hermes plugin contract bridge
apps/docs          Astro Starlight documentation site
```

## CLI Surface

The CLI reads JSON from stdin and writes JSON to stdout:

```bash
echo '{"dbPath":":memory:","query":"formatter preference","budgetTokens":400}' \
  | node packages/cli/dist/index.js context-pack
```

Current commands:

- `seed-sample`: create sample core, evidence, fact, session-state, and
  workspace-resource records.
- `remember`: append an evidence event.
- `search`: search evidence, facts, session state, and resources with SQLite
  FTS.
- `context-pack`: build a bounded context pack for injection or inspection.
- `upsert-session-state`: update compact current-task memory.
- `upsert-resource`: add or update a workspace resource.
- `browse-resources`: list workspace resources under an optional parent URI.
- `verify`: record verification status for a memory item.

See the [CLI reference](../reference/cli-reference.md) for request and response
contracts.
