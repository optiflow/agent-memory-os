# Agent Memory OS

Agent Memory OS is a TypeScript-first meta memory framework for Hermes Agent. It packages a local-first v1 memory provider scaffold behind one Hermes-compatible adapter while leaving room for v2 temporal graph and verification features.

The design follows one operating principle:

> event-sourced writes, multi-view storage, routed reads, verified injection

## What V1 Includes

- Pinned core memory blocks for always-visible rules and high-authority facts.
- Append-only evidence events for messages, tool calls, outcomes, and explicit memory writes.
- Typed semantic facts with source event citations.
- SQLite + FTS retrieval for local-first search.
- Deterministic context packs with budgeted injection.
- Verification records for stale or unsupported memory warnings.
- A JSON stdin/stdout CLI bridge named `meta-memory`.
- A thin Python Hermes adapter that delegates to the CLI.

## Monorepo

```text
packages/core      Domain types, context router, packer, verification policy
packages/sqlite    SQLite schema, migrations, FTS search, local store
packages/cli       JSON CLI bridge for Hermes and future adapters
adapters/hermes    Thin Python MemoryProvider plugin scaffold
docs               Architecture, roadmap, evaluation, and install notes
```

## Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm run ci
```

Lefthook runs the pre-commit git gate. Install hooks with:

```bash
pnpm hooks:install
```

## Example

```bash
pnpm --filter @agent-memory-os/cli build
echo '{"dbPath":"./memory.sqlite","content":"User prefers Biome over ESLint.","kind":"explicit_memory"}' \
  | node packages/cli/dist/index.js remember
echo '{"dbPath":"./memory.sqlite","query":"formatter preference","budgetTokens":400}' \
  | node packages/cli/dist/index.js context-pack
```

## V2 Direction

V2 adds temporal relation graph projections, validity windows, citation validation against current workspace state, branch-drift checks, and optional slow-path reflection. V1 intentionally avoids these production dependencies so the first scaffold remains inspectable and testable.
