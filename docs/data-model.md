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

V1 records warnings and status. It does not yet retrieve verification records
for context-pack population, validate citations against live workspace state, or
check branches.

## Context Packs

`ContextPack` is the injected retrieval output:

- `query`: user or adapter query.
- `budgetTokens`: requested budget.
- `estimatedTokens`: pack estimate.
- `items`: core, evidence, or fact items ranked by TypeScript store/router logic
  with citations.
- `verificationWarnings`: warning records when a future router populates them;
  the current router returns an empty list.

Context packs should be bounded, cited, and inspectable.

## SQLite Tables

The current SQLite projection stores:

- `core_blocks`
- `evidence_events` plus `evidence_fts`
- `semantic_facts` plus `fact_fts`
- `verification_records`

SQLite is the v1 storage boundary. Do not add a vector DB, graph DB, or cloud
memory provider during v1 prep.
