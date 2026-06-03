# Meta Memory OS Research Brief

This brief distills the attached report into repo-owned preparation guidance. It
is not an implementation spec and should not be treated as primary-source proof
for third-party provider claims.

## Executive Position

The report's strongest conclusion is that agent memory is not one problem. A
Hermes memory OS should expose one external provider to Hermes while keeping
separate internal planes for evidence, state, facts, context packing, and future
temporal reasoning.

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
| Always-visible memory | Hermes built-in memory, Letta, Memory-OS | Keep core memory explicit and high-authority. |
| Evidence capture | Memori, RetainDB, Graphiti episodes | Preserve append-only raw events. |
| Active task state | TencentDB-Agent-Memory | Plan a compact session-state projection before building it. |
| Typed facts and profiles | Mem0, RetainDB, Supermemory | Keep facts typed, cited, and separate from evidence. |
| Temporal graph | Graphiti, Hindsight | Keep validity windows and reflection in v2. |
| Workspace tree | OpenViking, ByteRover | Keep browseable project memory future-facing until v1 is stable. |
| Social memory | Honcho | Treat peer/identity modeling as optional future work. |

## V1 Preparation Priority

1. Prove the Hermes adapter contract for the target Hermes version.
2. Keep the local evidence ledger, facts, FTS, context packs, and verification
   records auditable.
3. Document CLI and data-model contracts before adding features.
4. Keep CI configured so future feature work is gated by the same local checks.

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
