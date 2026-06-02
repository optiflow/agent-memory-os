# Provider Comparison

The framework recombines provider strengths rather than adopting any single provider wholesale.

| Source pattern | Useful component | Role in Agent Memory OS |
| --- | --- | --- |
| Letta | Always-visible memory blocks | Pinned core memory |
| Mem0 | Add-only fact distillation and entity-linked retrieval | Semantic fact plane |
| Graphiti/Zep | Temporal graph with provenance | V2 relation graph |
| RetainDB | Context routing and delta packs | Context router |
| TencentDB Agent Memory | Short-term compression of tool-heavy sessions | Future symbolic session state |
| Memori | Tool-aware execution memory | Evidence ledger design |
| OpenViking/ByteRover | Hierarchical workspace memory | Future browsable project tree |
| GitHub Copilot memory | Citation-backed verification | V2 verification plane |

The first implementation keeps the local evidence ledger and context router simple. Graphs, vectors, and reflection are valuable, but they are not v1 dependencies.
