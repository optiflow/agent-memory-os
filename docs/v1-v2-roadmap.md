# V1 and V2 Roadmap

This roadmap preserves the local-first v1 boundary while keeping the report's
larger Meta Memory OS direction visible.

## V1: Local-First Scaffold

V1 is the minimum auditable Hermes memory provider:

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

## V1 Prep Before Feature Work

Before adding runtime features:

1. Verify the target Hermes plugin contract, including metadata filename,
   `register(ctx)`, `initialize`, lifecycle hooks, and provider tool discovery.
2. Document the CLI and data model as stable working contracts.
3. Keep CI configured so pull requests run the full local gate.
4. Keep environment setup reproducible with pnpm, Node, Python, and adapter
   environment variables.

## Future V1 Design Candidates

These may be designed after the adapter contract is proven, but they are not
implemented by this prep pass:

- active session-state projection for compact current-task memory;
- browseable workspace/resource tree;
- richer context-router policy;
- explicit adapter smoke fixture against a known Hermes version.

Any future v1 additions must stay local-first and auditable.

## V2: Safer Recall

V2 should add:

- temporal relation graph projection;
- `validFrom` and `validUntil` conflict handling;
- source citation validation;
- current-branch and workspace-drift checks;
- retrieval-time contradiction warnings;
- optional reflection for synthesis-heavy prompts;
- handoff packets if multi-agent workflows need them.

V2 should remain routed. Graph and reflection work should run only when the query
needs temporal, relational, or inferential reasoning.

## V2+ Optional Work

Social and peer memory, external connector sync, shared memory blocks, and
federation hooks belong after v1 is stable and v2 recall safety is proven.
