# Agent Memory OS

Agent Memory OS is a TypeScript-first meta memory framework for Hermes coding
agents. It packages a local-first v1 scaffold behind one Hermes-facing provider:
one provider at the Hermes boundary, many auditable internal memory planes.

The product direction is a compiler-style memory OS. Append-only evidence is
the source of truth; facts, context packs, and future session, workspace, graph,
handoff, and connector views are derived projections.

Operating principle:

> event-sourced writes, multi-view storage, routed reads, verified injection

## Current Scope

V1 currently prepares and tests these surfaces:

- Pinned core memory blocks for always-visible rules and high-authority facts.
- Append-only evidence events for messages, tool calls, outcomes, and explicit
  memory writes.
- Typed semantic facts with source event citations.
- SQLite + FTS retrieval for local-first search.
- Deterministic context packs with budgeted injection.
- Verification records that can mark memory as stale, unsupported, unknown,
  failed, passed, or warning.
- A JSON stdin/stdout CLI bridge named `meta-memory`.
- A thin Python Hermes adapter that delegates to the CLI.

All memory behavior lives in the TypeScript packages. Python only maps Hermes
calls to the `meta-memory` CLI.

The repo intentionally does not add a vector database, graph database, cloud
memory provider, LLM extraction dependency, reflection engine, or second Hermes
provider in v1.

## Monorepo Layout

```text
packages/core      Domain types, context router, packer, verification policy
packages/sqlite    SQLite schema, migrations, FTS search, local store
packages/cli       JSON CLI bridge for Hermes and future adapters
adapters/hermes    Thin Python MemoryProvider plugin scaffold
docs               Architecture, roadmap, evaluation, and install notes
```

## Docs Map

- [Architecture](docs/architecture.md): canonical one-provider, multi-plane
  design.
- [Roadmap](docs/v1-v2-roadmap.md): phased product roadmap, v1/v2/v3 boundary,
  and non-goals.
- [Environment](docs/environment.md): runtime, pnpm, and adapter environment
  setup.
- [Data model](docs/data-model.md): current domain objects and SQLite
  projection.
- [CLI reference](docs/cli-reference.md): JSON command contract.
- [Provider comparison](docs/provider-comparison.md): report-derived design
  rationale, not dependency selection.
- [Evaluation](docs/evaluation.md): local gates, future benchmark tracks, and
  memory-quality metrics.
- [Hermes install notes](docs/hermes-install.md): adapter setup and compatibility
  cautions.
- [Research brief](docs/research/meta-memory-os-brief.md): distilled report
  guidance.

## Commands

```bash
pnpm install
pnpm lint
pnpm lint:packages
pnpm lint:repo
pnpm typecheck
pnpm test
pnpm build
pnpm run ci
```

Lefthook runs the pre-commit git gate. Install hooks with:

```bash
pnpm hooks:install
```

## Documentation Access

Context7 MCP is registered globally for Codex as `context7` so coding agents can fetch current framework/library documentation. See [docs/context7-mcp.md](docs/context7-mcp.md) for the repo-specific usage policy and relevant documentation targets.

## Example

```bash
pnpm --filter @agent-memory-os/cli build
echo '{"dbPath":"./memory.sqlite","content":"User prefers Biome over ESLint.","kind":"explicit_memory"}' \
  | node packages/cli/dist/index.js remember
echo '{"dbPath":"./memory.sqlite","query":"formatter preference","budgetTokens":400}' \
  | node packages/cli/dist/index.js context-pack
```

## Roadmap Direction

Phase 0 proves the Hermes adapter contract. Phase 1 keeps the local ledger,
facts, FTS retrieval, context packs, verification records, CLI, and adapter
auditable. Phase 1.1 designs active session state and workspace tree projections
without adding graph, vector, cloud, or LLM dependencies. Phase 2 adds temporal
recall, contradiction handling, reflection, and handoff packets. Phase 3 keeps
social memory, shared blocks, connector sync, and federation after the local
system is proven.
