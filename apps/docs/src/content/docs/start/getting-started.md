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

## Install

```bash
corepack enable pnpm
pnpm install
```

The committed `pnpm-lock.yaml` is the dependency source of truth. Do not switch
repo orchestration to npm, Yarn, or Bun.

## Run The Local Gate

```bash
pnpm run ci
```

The full gate runs documentation freshness checks, linting, typechecking,
tests, builds, adapter-boundary checks, deterministic evals, and report-only
benchmarks.

For narrower checks, see [Evaluation](../../reference/evaluation/).

## CLI Smoke Test

Build the CLI, seed a temporary SQLite database, and request a context pack:

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
- The context pack includes the seeded Biome memory with citations.
- The context pack includes `verificationWarnings` and `recallWarnings` arrays,
  even when they are empty.
- V1.1 projections, such as session state and workspace resources, are present
  in the seeded local data.

## Repository Layout

```text
packages/core      Domain types, context router, packer, warning policy
packages/sqlite    SQLite schema, migrations, FTS search, local store
packages/cli       JSON CLI bridge for Hermes and future adapters
packages/evals     Deterministic eval and benchmark fixtures
adapters/hermes    Thin Python Hermes plugin contract bridge
apps/docs          Astro Starlight documentation site
plugin.yaml        Root Hermes plugin shim for Git-based installs
skills             Bundled Hermes setup runbook
```

## Next Reads

- [CLI Reference](../../reference/cli-reference/) for command contracts.
- [Architecture](../../architecture/architecture/) for memory planes and routing.
- [Hermes Install Notes](../../integrations/hermes-install/) for adapter setup.
- [Evaluation](../../reference/evaluation/) for local acceptance gates.
