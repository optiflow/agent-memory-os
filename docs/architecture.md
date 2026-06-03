# Architecture

Agent Memory OS is a compiler-style memory framework for Hermes Agent. Hermes
sees one external provider; the provider keeps many internal memory planes. The
append-only evidence ledger is the source of truth, and downstream planes are
derived projections optimized for different retrieval and injection jobs.

## Operating Principle

Event-sourced writes, multi-view storage, routed reads, verified injection.

## Language Boundary

This repo is TypeScript-first, not TypeScript-only. TypeScript owns the domain
model, SQLite/FTS schema and store, retrieval routing, context packing,
verification policy, CLI bridge, tests, and pnpm/Turborepo orchestration.

Python exists only at the Hermes plugin boundary. It should translate Hermes
lifecycle and tool calls to the TypeScript CLI; it should not own memory schema,
ranking, persistence, retrieval, verification policy, or product behavior.

## Why One Hermes Provider

Hermes can activate only one external memory provider at a time, while built-in
Hermes memory remains active. This repo therefore prepares one provider,
`meta_memory`, and keeps internal storage choices behind that provider.

The provider should stay small at the Hermes boundary:

- automatic bounded context packing;
- explicit memory writes;
- local search;
- active session-state updates;
- browseable workspace resource updates and listing;
- verification recording;
- future graph, reflection, and handoff tools only after v1/v1.1 are stable.

Future tools such as probe, handoff, and reflect should remain behind the same
provider boundary. They should not become separate Hermes providers.

## Planes

| Plane | Current status | Purpose |
| --- | --- | --- |
| Pinned core memory | V1 implemented | High-authority rules and durable facts that should not require retrieval. |
| Evidence ledger | V1 implemented | Append-only events for messages, tool calls, outcomes, file edits, and explicit memory writes. |
| Typed semantic facts | V1 implemented | Cited fact records separated from raw evidence. |
| Local retrieval | V1.1 implemented | SQLite + FTS over evidence, facts, session state, and workspace resources. |
| Context router | V1.1 implemented | Bounded context packs with `auto`, `task`, and `workspace` policies. |
| Verification records | V1.1 implemented | Writable statuses plus latest non-passed warnings in context packs. |
| Active session state | V1.1 implemented | Compact current-task state without LLM extraction. |
| Workspace tree | V1.1 implemented | Browseable project/resource memory without a graph or cloud dependency. |
| Temporal graph | V2 design | Validity windows, supersession, and relation-aware recall. |
| Reflection | V2 design | Slow-path synthesis over evidence, facts, and temporal projections. |
| Handoff and social memory | V2+ design | Multi-agent transfer packets and peer/identity memory. |

## Write Path

All memory writes should preserve raw evidence first. Facts, context packs,
verification records, session state, workspace resources, and future
projections derive from that evidence.

This avoids the main memory-system failure mode identified in the report:
throwing away the wrong information at write time and trying to recover it later
with search.

The write policy is:

- never mutate evidence;
- rarely delete facts;
- usually supersede beliefs;
- often expire temporary state.

## Read Path

The read path is routed:

1. Prefer pinned core memory for standing rules and stable preferences.
2. Use FTS retrieval for explicit facts and evidence.
3. Include active session state for `auto` and `task` policies.
4. Include workspace resources for `auto` and `workspace` policies.
5. Build bounded context packs with citations and latest verification warnings.
6. Defer graph and reflection work until v2.

## Trust Boundary

Injected memory should be inspectable and cited. The adapter prompt block should
tell Hermes to use injected memory only when relevant and cite memory
identifiers when relying on them. Context packs now include latest non-passed
verification records for packed item IDs.

## Adapter Compatibility Risk

Current repo code aligns the local adapter to `plugin.yaml`,
`register(ctx)`, `initialize(...)`, provider tool schemas, and lifecycle hook
wiring. This is local contract proof only. Before claiming production Hermes
compatibility, verify a target Hermes checkout loads the plugin and exercises
the registered tools and hooks.
