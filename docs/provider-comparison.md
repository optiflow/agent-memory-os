# Provider Comparison

The attached report supports a compositional design rather than adopting one
provider wholesale. This page records donor patterns only; it does not add these
systems as dependencies.

## Donor Patterns

| Source pattern | Useful component | Roadmap role |
| --- | --- | --- |
| Hermes built-in memory | `MEMORY.md` and `USER.md` remain active | Current v1 L0 core memory alongside the external provider. |
| Letta | Always-visible memory blocks | Current v1 discipline for pinned core memory. |
| Memory-OS | Trust and injection policy | Current v1/v1.1 discipline for cited, bounded injection and verification warnings. |
| Memori | Attributed background capture | Current v1 evidence-ledger and event-attribution pattern. |
| RetainDB | Scoped context and agent events | Current v1 context-routing pattern; V2 handoff pattern. |
| Mem0 | Typed fact modeling and retrieval patterns | Current v1 semantic fact plane design. |
| Supermemory | Profile and hybrid memory/RAG surfaces | Future profile-serving pattern. |
| TencentDB-Agent-Memory | Compact symbolic session state | Current V1.1 active task-state projection pattern. |
| OpenViking | URI-like browseable memory/resource model | Current V1.1 workspace resource tree pattern. |
| ByteRover | Local, versionable context tree | Current V1.1 inspectable project-memory pattern. |
| Graphiti/Zep | Temporal graph with provenance | V2 relation graph and validity-window pattern. |
| Hindsight | Reflection over stored evidence | V2 slow-path synthesis pattern. |
| Honcho | Peer and identity reasoning | V3 social-memory sidecar pattern. |

## V1 Decision

V1 keeps the implementation simple:

- one Hermes provider;
- TypeScript-owned memory behavior and persistence;
- Python only at the Hermes adapter boundary;
- SQLite + FTS;
- append-only evidence;
- typed facts;
- active session state;
- workspace resources;
- context packs;
- verification records;
- no graph, vector, cloud, or LLM extraction dependency.

The provider landscape should be rechecked against primary docs before any donor
pattern becomes an implementation requirement.

## Future Mapping

- Future v1 additions must stay local-first and dependency-light.
- V2 may add temporal graph, contradiction handling, reflection, and handoff
  packets when recall safety requires them.
- V3 may add social memory, connector sync, shared memory blocks, and federation
  after the local system is proven.

## Anti-Pattern To Avoid

Do not collapse evidence, summaries, facts, profiles, and beliefs into one store.
Evidence should be append-only. Facts should be cited and updateable. Context
packs should be generated views. Temporal and reflective reasoning belongs in
later projections.
