# Provider Comparison

The attached report supports a compositional design rather than adopting one
provider wholesale. This page records donor patterns only; it does not add these
systems as dependencies.

## Donor Patterns

| Source pattern | Useful component | Role in Agent Memory OS |
| --- | --- | --- |
| Hermes built-in memory | `MEMORY.md` and `USER.md` remain active | L0 core memory alongside the external provider. |
| Letta | Always-visible memory blocks | Pinned core memory discipline. |
| Memory-OS | Trust and injection policy | Treat injected memory as cited, bounded, and warning-aware. |
| Memori | Attributed background capture | Evidence ledger and event attribution. |
| RetainDB | Scoped context and agent events | Context routing and future handoff patterns. |
| TencentDB-Agent-Memory | Compact symbolic session state | Future active task-state projection. |
| Mem0 | Typed fact modeling and retrieval patterns | Semantic fact plane design. |
| Supermemory | Profile and hybrid memory/RAG surfaces | Future profile-serving pattern. |
| Graphiti/Zep | Temporal graph with provenance | V2 relation graph. |
| Hindsight | Reflection over stored evidence | V2 slow-path synthesis. |
| OpenViking | URI-like browseable memory/resource model | Future workspace tree. |
| ByteRover | Local, versionable context tree | Future inspectable project memory. |
| Honcho | Peer and identity reasoning | Optional V2+ social-memory sidecar. |

## V1 Decision

V1 keeps the implementation simple:

- one Hermes provider;
- TypeScript-owned memory behavior and persistence;
- Python only at the Hermes adapter boundary;
- SQLite + FTS;
- append-only evidence;
- typed facts;
- context packs;
- verification records;
- no graph, vector, cloud, or LLM extraction dependency.

The provider landscape should be rechecked against primary docs before any donor
pattern becomes an implementation requirement.

## Anti-Pattern To Avoid

Do not collapse evidence, summaries, facts, profiles, and beliefs into one store.
Evidence should be append-only. Facts should be cited and updateable. Context
packs should be generated views. Temporal and reflective reasoning belongs in
later projections.
