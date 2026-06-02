# V1 and V2 Roadmap

## V1: Local-First Scaffold

V1 is the minimum useful memory OS:

- TypeScript domain model.
- SQLite schema and FTS indexes.
- Append-only evidence events.
- Core memory blocks.
- Semantic facts with source event IDs.
- Context packs with token estimates and citations.
- CLI bridge for JSON stdin/stdout.
- Thin Hermes Python adapter.

V1 does not include vector search, graph databases, cloud providers, LLM extraction, or reflection.

## V2: Safer Recall

V2 should add:

- temporal relation graph projection,
- `validFrom` and `validUntil` conflict handling,
- source citation validation,
- current-branch and workspace-drift checks,
- retrieval-time contradiction warnings,
- optional reflection for synthesis-heavy prompts.

V2 should remain routed. Graph and reflection work should run only when the query needs temporal, relational, or inferential reasoning.
