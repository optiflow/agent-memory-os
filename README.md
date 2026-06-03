# Agent Memory OS

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/optiflow/agent-memory-os)

Agent Memory OS is a local-first, evidence-led memory framework for Hermes
coding agents. It gives Hermes one external memory boundary while keeping the
actual memory system auditable: evidence, facts, active session state,
workspace resources, context packs, and verification records stay as separate
internal views.

Core principle:

> event-sourced writes, multi-view storage, routed reads, verified injection

## Confidence Snapshot

| Area | Current state |
| --- | --- |
| Local memory store | SQLite + FTS with evidence, facts, projections, and verification. |
| Recall safety | V2 Core warnings for citations, temporal relations, and local drift. |
| Context injection | Bounded context packs with citations, budgets, policies, and verification/recall warnings. |
| CLI bridge | JSON stdin/stdout commands for smoke tests and adapter delegation. |
| Evaluation | Lint, types, tests, evals, benchmarks, docs guard, and adapter checks. |
| Hermes adapter | Local adapter/CLI smoke proof only, not production Hermes validation. |

## What It Does

Agent Memory OS is built for safer coding-agent memory, not generic RAG. It:

- records raw evidence before deriving summaries or facts;
- keeps stable rules, facts, task state, workspace resources, and retrieved
  context as distinct memory views;
- searches local SQLite/FTS data instead of depending on a vector database,
  graph database, cloud provider, or LLM extraction step;
- builds cited context packs with explicit token budgets, verification warnings,
  and V2 Core recall warnings;
- keeps Python limited to the thin Hermes plugin boundary while TypeScript owns
  memory behavior.

## What Works Today

V1, V1.1, and V2 Core recall safety are implemented as a local-first
foundation:

| Surface | Implemented behavior |
| --- | --- |
| Evidence | Append-only events for messages, tool calls, outcomes, edits, and writes. |
| Facts | Typed semantic facts with source event IDs. |
| Retrieval | SQLite + FTS over evidence, facts, active session state, and workspace resources. |
| Context packs | Bounded, cited memory packs with `auto`, `task`, and `workspace` router policies. |
| Verification | Status records with latest warnings included in context packs. |
| Workspace memory | Browseable resources keyed by scope and URI. |
| Temporal relations | Scoped relation records for contradiction and supersession warnings. |
| Drift checks | Optional local git/file warnings when context packs receive workspace provenance. |
| CLI | Ten JSON commands for seeding, writing, search, packing, projections, browsing, verification, and relation probing. |
| Hermes boundary | A root plugin shim and nested Python adapter that delegate memory work to the TypeScript CLI. |

## What It Does Not Claim

V1/V1.1 intentionally does not include:

- a production-tested Hermes installation for a specific Hermes release;
- a vector database, graph database, or cloud memory provider;
- LLM-based fact extraction or reflection;
- connector sync, social memory, or shared/federated memory;
- automatic filtering of risky memory from context packs;
- production-grade temporal graph reasoning beyond scoped local relations;
- a second Hermes memory provider.

Those ideas stay behind the V2+ roadmap until the local evidence, retrieval,
context-pack, verification, recall-safety, CLI, projection, and adapter
foundations are stable.

## Try It Locally

Prerequisites:

- Node.js 24.x.
- pnpm through Corepack.
- Python 3 for adapter-boundary checks.

Run the local gate:

```bash
corepack enable pnpm
pnpm install
pnpm run ci
```

For a CLI smoke test and expected output, use
[Getting Started](apps/docs/src/content/docs/start/getting-started.md). For
request and response contracts, use the
[CLI reference](apps/docs/src/content/docs/reference/cli-reference.md).

## Documentation Map

- Published docs:
  [https://optiflow.github.io/agent-memory-os/](https://optiflow.github.io/agent-memory-os/).
- Maintainer/developer setup:
  [Getting Started](apps/docs/src/content/docs/start/getting-started.md) and
  [Environment](apps/docs/src/content/docs/start/environment.md).
- System design:
  [Architecture](apps/docs/src/content/docs/architecture/architecture.md) and
  [Data Model](apps/docs/src/content/docs/architecture/data-model.md).
- CLI and quality gates:
  [CLI Reference](apps/docs/src/content/docs/reference/cli-reference.md) and
  [Evaluation](apps/docs/src/content/docs/reference/evaluation.md).
- Hermes adapter:
  [Hermes Install Notes](apps/docs/src/content/docs/integrations/hermes-install.md)
  and [adapters/hermes/README.md](adapters/hermes/README.md).
- Roadmap and research:
  [Roadmap](apps/docs/src/content/docs/roadmap/v1-v2-roadmap.md),
  [Meta Memory OS Research Brief](apps/docs/src/content/docs/research/meta-memory-os-brief.md),
  and
  [Provider Comparison](apps/docs/src/content/docs/research/provider-comparison.md).
- AI-agent operating instructions:
  [AGENTS.md](AGENTS.md).

## Roadmap

| Phase | Status | Boundary |
| --- | --- | --- |
| Phase 0 | Local adapter alignment | Plugin shim, registration, tool schemas, hook fixture, and smoke proof. |
| Phase 1 | Implemented V1 foundation | Evidence, facts, FTS retrieval, context packs, verification, CLI, tests, and adapter. |
| Phase 1.1 | Implemented hardening | Session state, workspace resources, router policies, and verification warnings. |
| Phase 2 Core | Implemented recall safety | Temporal relations, citation validation, drift warnings, and recall warnings. |
| Phase 2+ | Deferred design | Reflection, handoff, sync, social memory, and federation. |
