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
- verification recording;
- future tools only after the v1 contract is stable.

Future tools such as browse, probe, handoff, and reflect should remain behind
the same provider boundary. They should not become separate Hermes providers.

## Planes

| Plane | Current status | Purpose |
| --- | --- | --- |
| Pinned core memory | V1 scaffold | High-authority rules and durable facts that should not require retrieval. |
| Evidence ledger | V1 scaffold | Append-only events for messages, tool calls, outcomes, file edits, and explicit memory writes. |
| Typed semantic facts | V1 scaffold | Cited fact records separated from raw evidence. |
| Local retrieval | V1 scaffold | SQLite + FTS over evidence and facts. |
| Context router | V1 scaffold | Smallest useful retrieval path with bounded context packs. |
| Verification records | V1 scaffold | Writable warning, stale, failed, unknown, and passed records for memory items. |
| Active session state | Future v1 design | Compact current-task state once the adapter contract is proven. |
| Workspace tree | Future v1 design | Browseable project/resource memory without a graph or cloud dependency. |
| Temporal graph | V2 design | Validity windows, supersession, and relation-aware recall. |
| Reflection | V2 design | Slow-path synthesis over evidence, facts, and temporal projections. |
| Handoff and social memory | V2+ design | Multi-agent transfer packets and peer/identity memory. |

## Write Path

All memory writes should preserve raw evidence first. Facts, context packs,
verification records, and future projections derive from that evidence.

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
3. Build bounded context packs with citations.
4. Keep verification records available for future warning-aware packing.
5. Defer graph and reflection work until v2.

## Trust Boundary

Injected memory should be inspectable and cited. The adapter prompt block should
tell Hermes to use injected memory only when relevant and cite memory
identifiers when relying on them. Warning-aware injection is a roadmap item until
verification records are read and populated into context packs.

## Adapter Compatibility Risk

Current repo code has a `plugin.json` metadata file and a `MetaMemoryProvider`
class scaffold. Some Hermes versions or docs describe `plugin.yaml`,
`register(ctx)`, and lifecycle hooks instead. Before feature development,
verify the target Hermes version and update the adapter metadata or registration
shape if needed.
