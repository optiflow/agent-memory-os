# Data Model

The v1 model separates raw evidence, durable facts, injected context, and
verification. Do not collapse these into one memory table.

TypeScript domain types and SQLite migrations are the source of truth for schema
and persistence. Python must not define memory schema, ranking, validation, or
memory behavior.

## Scope

Every stored object that can be workspace-bound uses a `MemoryScope`:

| Field | Values |
| --- | --- |
| `type` | `global`, `user`, `workspace`, `project`, `session` |
| `id` | Non-empty scope identifier |

The CLI defaults to `{ "type": "workspace", "id": "default" }`.

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

The write policy is conservative: never mutate evidence, rarely delete facts,
usually supersede beliefs, and often expire temporary state.

## Core Memory Blocks

`CoreMemoryBlock` stores always-visible, high-authority memory such as standing
rules, stable preferences, and project invariants.

Important fields:

- `authority`: higher values should be favored by the context router.
- `readOnly`: marks blocks that tooling should avoid mutating automatically.
- `metadata`: optional JSON for source or ownership hints.

Hermes built-in `MEMORY.md` and `USER.md` remain separate from this store, but
the adapter can mirror explicit memory writes into the v1 ledger.

Hermes plugin tool schemas are boundary input schemas only. TypeScript domain
types and SQLite migrations remain the source of truth for persisted memory.

## Semantic Facts

`SemanticFact` stores typed, reusable claims:

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

`VerificationRecord` tracks checks against memory items. Supported statuses are:

- `failed`
- `passed`
- `stale`
- `unknown`
- `warning`

V1.1 retrieves the latest record for packed item IDs and includes non-passed
statuses in `ContextPack.verificationWarnings`. It does not validate citations
against live workspace state or check branches.

## Session State

`SessionState` is the compact current-task projection. It stores:

- `status`: `active`, `blocked`, or `complete`.
- `currentGoal`: the immediate task.
- `summary`: bounded task state.
- `workingSet`: relevant files, modules, or resources.
- `sourceEventIds`: evidence that supports the projection.

The CLI creates an audit evidence event before session-state projection writes.
Only `active` session states are automatically considered by the context router.

## Workspace Resources

`WorkspaceResource` is the browseable workspace/resource projection. It stores
URI-addressed resources with a title, kind, content, optional `parentUri`, scope,
source event IDs, and metadata.

Resources are keyed by scope plus URI so similarly named project and workspace
resources do not collide. The resource tree is local SQLite + FTS only; it does
not introduce connector sync, a vector database, graph database, or cloud
provider.

## Context Packs

`ContextPack` is the injected retrieval output:

- `query`: user or adapter query.
- `budgetTokens`: requested budget.
- `estimatedTokens`: pack estimate.
- `items`: core, evidence, fact, session, or resource items ranked by TypeScript
  store/router logic with citations.
- `verificationWarnings`: latest failed, stale, unknown, or warning records for
  items included in the pack.

Context packs should be bounded, cited, and inspectable.

The router supports three local policies:

- `auto`: include core memory, active session state, search results, and
  workspace resources.
- `task`: include core memory and active session state while excluding resource
  search results.
- `workspace`: include core memory and resource search results while excluding
  active session state.

## SQLite Tables

The current SQLite projection stores:

- `core_blocks`
- `evidence_events` plus `evidence_fts`
- `semantic_facts` plus `fact_fts`
- `verification_records`
- `session_states` plus `session_state_fts`
- `workspace_resources` plus `workspace_resource_fts`

SQLite is the v1 storage boundary. Do not add a vector DB, graph DB, or cloud
memory provider during v1 prep.
