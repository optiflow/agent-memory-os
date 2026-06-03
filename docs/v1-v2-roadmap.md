# V1, V2, and V3 Roadmap

This roadmap preserves the local-first v1 boundary while keeping the report's
larger Meta Memory OS direction visible. The product shape is one Hermes
provider with many internal planes, not several competing providers.

## Phase 0: Adapter Contract

Before adding runtime features, prove the target Hermes plugin contract:

- metadata filename and required fields;
- `register(ctx)` or class discovery shape;
- `initialize` behavior;
- prefetch and turn-sync lifecycle hook signatures;
- provider tool schema and handler registration;
- session-end extraction and built-in memory write mirroring behavior.

Until this is verified against a target Hermes version, adapter work remains a
local scaffold and smoke-test target.

## Phase 1: Local-First V1 Scaffold

V1 is the minimum auditable Hermes meta-provider:

- TypeScript domain model.
- SQLite schema and FTS indexes.
- Append-only evidence events.
- Core memory blocks.
- Semantic facts with source event IDs.
- Context packs with token estimates and citations.
- Verification records.
- CLI bridge for JSON stdin/stdout.
- TypeScript/Vitest tests for core, SQLite, and CLI behavior.
- pnpm and Turborepo orchestration.
- Thin Hermes Python adapter that maps Hermes calls to the TypeScript CLI only.

V1 does not include vector search, graph databases, cloud providers, LLM
extraction, reflection, connector sync, social memory, or a second Hermes
provider.

## Phase 1.1: Future V1 Product Hardening

These may be designed after the adapter contract is proven, but they are not
implemented by the current scaffold:

- active session-state projection for compact current-task memory;
- browseable workspace/resource tree;
- richer context-router policy;
- explicit adapter smoke fixture against a known Hermes version.

Any future v1 additions must stay local-first, auditable, and dependency-light.
Session state and workspace tree work should not introduce a vector DB, graph DB,
cloud memory provider, connector sync, or LLM extraction dependency.

## Phase 2: Safer Recall

V2 should add projections and policies that improve recall safety:

- temporal relation graph projection;
- `validFrom` and `validUntil` conflict handling;
- source citation validation;
- current-branch and workspace-drift checks;
- retrieval-time contradiction warnings;
- optional reflection for synthesis-heavy prompts;
- handoff packets if multi-agent workflows need them.

V2 should remain routed. Graph and reflection work should run only when the query
needs temporal, relational, or inferential reasoning.

## Phase 3: Shared and Federated Memory

Social and peer memory, external connector sync, shared memory blocks, and
federation hooks belong after v1 is stable and v2 recall safety is proven.

## Operating Guardrails

- Evidence stays append-only.
- Facts stay typed, cited, and updateable.
- Context packs stay bounded and inspectable.
- Project and workspace memory stay separate from personal profile memory.
- Provider-landscape claims from the report remain roadmap guidance until they
  are rechecked against primary docs.
