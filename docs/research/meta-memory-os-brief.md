# Meta Memory OS Research Brief

This brief distills the attached report into repo-owned preparation guidance. It
is not an implementation spec and should not be treated as primary-source proof
for third-party provider claims.

## Executive Position

The report's strongest conclusion is that agent memory is not one problem. A
Hermes memory OS should expose one external provider to Hermes while keeping
separate internal planes for evidence, state, facts, context packing, workspace
resources, and future temporal reasoning.

The product direction is compiler-style memory: write raw evidence once, then
derive task state, facts, profiles, context packs, workspace views, graph views,
and handoff packets from that ledger as the roadmap matures.

The repo already follows the right outer shape:

- one Hermes provider, `meta_memory`;
- TypeScript-owned memory model, SQLite/FTS store, routing, context packing,
  verification, CLI bridge, tests, and package orchestration;
- a thin Python adapter that maps Hermes calls to TypeScript only;
- SQLite + FTS as the local-first v1 store;
- graph, reflection, and handoff work deferred.

## Donor Patterns

Use these as design patterns, not dependencies:

| Pattern | Donor examples | Repo implication |
| --- | --- | --- |
| Always-visible memory | Hermes built-in memory, Letta, Memory-OS | Current v1 discipline: keep core memory explicit and high-authority. |
| Evidence capture | Memori, RetainDB, Graphiti episodes | Current v1 discipline: preserve append-only raw events. |
| Typed facts and profiles | Mem0, RetainDB, Supermemory | Current v1 discipline: keep facts typed, cited, and separate from evidence. |
| Active task state | TencentDB-Agent-Memory | Future v1 design: compact current-task projection. |
| Workspace tree | OpenViking, ByteRover | Future v1 design: browseable project memory without graph/cloud dependencies. |
| Temporal graph | Graphiti, Hindsight | V2 design: validity windows, supersession, contradiction handling, and reflection. |
| Social memory | Honcho | V3 design: optional peer and identity modeling. |

## Product Sequencing

1. Phase 0 proves the Hermes adapter contract for the target Hermes version.
2. Phase 1 keeps the local evidence ledger, facts, FTS, context packs,
   verification records, CLI, and adapter auditable.
3. Phase 1.1 designs active session state and workspace tree projections without
   adding graph, vector, cloud, connector, or LLM dependencies.
4. Phase 2 adds temporal recall, contradiction handling, optional reflection,
   and handoff packets.
5. Phase 3 leaves social memory, connector sync, shared blocks, and federation
   until the local system is proven.

## Explicit Non-Goals For This Prep Pass

- No vector database.
- No graph database.
- No cloud memory provider.
- No connector sync.
- No LLM extraction dependency.
- No reflection engine.
- No handoff bus.
- No social or peer memory implementation.
- No additional Hermes provider.

## Verification Principle

Provider landscape claims from the report should be rechecked against primary
docs before they become implementation requirements. The repo can use the report
for architecture framing, but the source of truth for code remains local tests,
current Hermes documentation, and explicit project decisions.
