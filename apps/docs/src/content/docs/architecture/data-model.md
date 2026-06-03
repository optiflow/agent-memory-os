---
title: Data Model
description: Evidence events, facts, projections, verification records, and context packs.
---

The V1/V1.1 model separates raw evidence, durable facts, projections,
verification records, and injected context. Do not collapse these into one
memory table.

TypeScript domain types and SQLite migrations are the source of truth for schema
and persistence. Python must not define memory schema, ranking, validation, or
memory behavior.

## Scope

Stored objects that can be workspace-bound use `MemoryScope`.

| Field | Values |
| --- | --- |
| `type` | `global`, `user`, `workspace`, `project`, `session` |
| `id` | Non-empty scope identifier |

The CLI defaults to `{ "type": "workspace", "id": "default" }`.

## Source And Projection Model

| Layer | Status | Contract |
| --- | --- | --- |
| Evidence events | V1 implemented | Append-only source of truth. |
| Core memory blocks | V1 implemented | Always-visible high-authority rules and facts. |
| Semantic facts | V1 implemented | Typed, cited claims derived through explicit code paths or fixtures. |
| Verification records | V1.1 implemented | Latest non-passed records are included as context-pack warnings. |
| Session state | V1.1 implemented | Compact current-task projection, backed by audit evidence. |
| Workspace resources | V1.1 implemented | URI-addressed resource tree, backed by audit evidence. |
| Context packs | V1/V1.1 implemented | Generated, bounded injection views with citations and warnings. |

## Evidence Events

`EvidenceEvent` is the append-only ledger entry. It stores messages, tool use,
file edits, system events, and explicit memory writes.

Supported kinds:

- `assistant_message`
- `explicit_memory`
- `file_edit`
- `system_event`
- `tool_call`
- `tool_result`
- `user_message`

Evidence is the source of truth. Future projections can be rebuilt from it; they
must not replace it.

## Core Memory Blocks

`CoreMemoryBlock` stores always-visible, high-authority memory such as standing
rules, stable preferences, and project invariants.

Important fields:

- `authority`: higher values should be favored by the context router.
- `readOnly`: marks blocks that tooling should avoid mutating automatically.
- `metadata`: optional JSON for source or ownership hints.

Hermes built-in `MEMORY.md` and `USER.md` remain separate from this store, but
the adapter can mirror explicit memory writes into the V1 ledger.

Hermes plugin tool schemas are boundary input schemas only. TypeScript domain
types and SQLite migrations remain the source of truth for persisted memory.

## Semantic Facts

`SemanticFact` stores typed, reusable claims.

| Field | Meaning |
| --- | --- |
| `subject` | Entity the fact is about. |
| `predicate` | Relationship or property. |
| `object` | Fact value. |
| `confidence` | Numeric confidence from `0` to `1`. |
| `sourceEventIds` | Evidence event IDs supporting the fact. |
| `validFrom` / `validUntil` | Optional temporal boundaries reserved for future use. |

V1 does not include LLM extraction. Facts are added by explicit code paths or
fixtures only.

## Verification Records

`VerificationRecord` tracks checks against memory items.

Supported statuses:

- `failed`
- `passed`
- `stale`
- `unknown`
- `warning`

V1.1 retrieves the latest record for packed item IDs and includes non-passed
statuses in `ContextPack.verificationWarnings`. It does not validate citations
against live workspace state or check branches.

## Session State

`SessionState` is the compact current-task projection.

Important fields:

- `status`: `active`, `blocked`, or `complete`.
- `currentGoal`: immediate task.
- `summary`: bounded task state.
- `workingSet`: relevant files, modules, or resources.
- `sourceEventIds`: evidence that supports the projection.

The CLI creates an audit evidence event before session-state projection writes.
Only `active` session states are automatically considered by the context router.

## Workspace Resources

`WorkspaceResource` is the browseable workspace/resource projection. It stores
URI-addressed resources with title, kind, content, optional `parentUri`, scope,
source event IDs, and metadata.

Resources are keyed by scope plus URI so similarly named project and workspace
resources do not collide. The resource tree is local SQLite + FTS only; it does
not introduce connector sync, vector storage, graph storage, or a cloud
provider.

## Context Packs

`ContextPack` is the injected retrieval output.

Important fields:

- `query`: user or adapter query.
- `budgetTokens`: requested budget.
- `estimatedTokens`: pack estimate.
- `items`: core, evidence, fact, session, or resource items ranked by
  TypeScript store/router logic with citations.
- `verificationWarnings`: latest failed, stale, unknown, or warning records for
  items included in the pack.

Router policies:

| Policy | Includes | Excludes |
| --- | --- | --- |
| `auto` | Core memory, active session state, search results, workspace resources | Deferred V2 graph/reflection work |
| `task` | Core memory and active session state | Workspace resource search |
| `workspace` | Core memory and resource search results | Active session state |

Context packs should remain bounded, cited, and inspectable.

## SQLite Tables

The current SQLite projection stores:

- `core_blocks`
- `evidence_events` plus `evidence_fts`
- `semantic_facts` plus `fact_fts`
- `verification_records`
- `session_states` plus `session_state_fts`
- `workspace_resources` plus `workspace_resource_fts`

SQLite is the V1/V1.1 storage boundary. Do not add a vector DB, graph DB, or
cloud memory provider during local-first work.
