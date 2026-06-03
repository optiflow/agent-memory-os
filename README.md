# Agent Memory OS

Agent Memory OS is a local-first memory framework for Hermes coding agents. It
keeps one Hermes-facing provider at the boundary while using several auditable
internal memory views behind it: evidence, durable facts, search results,
context packs, and verification records.

The core idea is simple:

> event-sourced writes, multi-view storage, routed reads, verified injection

## What It Is

This repo is a TypeScript-first v1 scaffold for building a safer coding-agent
memory layer. It treats append-only evidence as the source of truth, then derives
searchable facts and bounded context packs from that evidence.

The Python code exists only where Hermes needs a Python memory provider. Storage,
ranking, routing, schemas, context packing, verification policy, tests, and the
CLI live in TypeScript packages.

## Status

The local scaffold is implemented and testable. It includes a real SQLite/FTS
store, TypeScript domain model, JSON stdin/stdout CLI, deterministic evals, and a
thin Hermes adapter scaffold.

The Hermes adapter is not yet proven against a specific production Hermes plugin
contract. Treat `adapters/hermes` as an integration scaffold until the target
Hermes version confirms its metadata, registration, lifecycle, and tool-call
shape.

## What Works Today

- Pinned core memory blocks for high-authority rules and durable facts.
- Append-only evidence events for messages, tool calls, outcomes, file edits,
  and explicit memory writes.
- Typed semantic facts with source event citations.
- SQLite + FTS retrieval for local-first search.
- Deterministic context packs with token budgets and citations.
- Verification records for `failed`, `passed`, `stale`, `unknown`, and
  `warning` statuses.
- A `meta-memory` CLI bridge with `seed-sample`, `remember`, `search`,
  `context-pack`, and `verify` commands.
- Adapter-boundary Python checks for the Hermes scaffold.

## What Is Out Of V1

V1 intentionally does not include a vector database, graph database, cloud memory
provider, LLM extraction dependency, reflection engine, connector sync, social
memory, or a second Hermes provider.

Those ideas stay behind the v2+ roadmap until the local evidence, retrieval,
context-pack, verification, CLI, and adapter boundary are stable.

## Quickstart

Prerequisites:

- Node.js 24.x. The repo uses Node's built-in `node:sqlite` module.
- pnpm through Corepack.
- Python 3 for the thin Hermes adapter checks.

Install dependencies and run the full local gate:

```bash
corepack enable pnpm
pnpm install
pnpm run ci
```

Run a local CLI smoke test:

```bash
pnpm --filter @agent-memory-os/cli build
tmp_dir="$(mktemp -d)"
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\"}" \
  | node packages/cli/dist/index.js seed-sample
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\",\"query\":\"Biome formatter\",\"budgetTokens\":400}" \
  | node packages/cli/dist/index.js context-pack
```

Expected result:

- `seed-sample` returns sample core, evidence, and fact records.
- `context-pack` returns a bounded `contextPack`.
- The returned context pack includes the seeded Biome memory with citations.

## Repository Layout

```text
packages/core      Domain types, context router, packer, verification policy
packages/sqlite    SQLite schema, migrations, FTS search, local store
packages/cli       JSON CLI bridge for Hermes and future adapters
adapters/hermes    Thin Python MemoryProvider plugin scaffold
docs               Architecture, roadmap, evaluation, and install notes
```

## CLI Surface

The CLI reads JSON from stdin and writes JSON to stdout:

```bash
echo '{"dbPath":":memory:","query":"formatter preference","budgetTokens":400}' \
  | node packages/cli/dist/index.js context-pack
```

Current commands:

- `seed-sample`: create sample core, evidence, and fact records.
- `remember`: append an evidence event.
- `search`: search core memory, evidence, and facts.
- `context-pack`: build a bounded context pack for injection or inspection.
- `verify`: record verification status for a memory item.

See [docs/cli-reference.md](docs/cli-reference.md) for request and response
contracts.

## Read Next

- Understand the design: [docs/architecture.md](docs/architecture.md) and
  [docs/data-model.md](docs/data-model.md).
- Set up the environment: [docs/environment.md](docs/environment.md).
- Use the CLI: [docs/cli-reference.md](docs/cli-reference.md).
- Inspect the Hermes boundary:
  [adapters/hermes/README.md](adapters/hermes/README.md) and
  [docs/hermes-install.md](docs/hermes-install.md).
- Review quality gates and evals: [docs/evaluation.md](docs/evaluation.md).
- Check roadmap boundaries: [docs/v1-v2-roadmap.md](docs/v1-v2-roadmap.md).
- Read the research basis:
  [docs/research/meta-memory-os-brief.md](docs/research/meta-memory-os-brief.md)
  and [docs/provider-comparison.md](docs/provider-comparison.md).

Coding-agent operating instructions live in [AGENTS.md](AGENTS.md).

## Roadmap Direction

Phase 0 proves the Hermes adapter contract. Phase 1 keeps the local evidence
ledger, facts, FTS retrieval, context packs, verification records, CLI, and
adapter auditable. Phase 1.1 may add active session state and workspace tree
projections without graph, vector, cloud, or LLM dependencies. Phase 2+ is where
temporal recall, contradiction handling, reflection, handoff packets, connector
sync, and shared memory belong after the local system is proven.
