---
title: Agent Memory OS
description: Maintainer and developer guide for local-first Hermes agent memory.
---

Use these docs as the canonical maintainer/developer guide for Agent Memory OS.
The root README is the public confidence page; this site is where setup,
architecture, contracts, verification, and roadmap boundaries live in detail.

## Start Here

| If you need to... | Read |
| --- | --- |
| Run the repo from a fresh checkout | [Getting Started](./start/getting-started.md) |
| Confirm local runtime expectations | [Environment](./start/environment.md) |
| Understand the system shape | [Architecture](./architecture/architecture.md) |
| Inspect stored objects and projections | [Data Model](./architecture/data-model.md) |
| Call the JSON CLI bridge | [CLI Reference](./reference/cli-reference.md) |
| Verify quality gates and evals | [Evaluation](./reference/evaluation.md) |
| Install or inspect the Hermes boundary | [Hermes Install Notes](./integrations/hermes-install.md) |
| Check phase boundaries | [Roadmap](./roadmap/v1-v2-roadmap.md) |

## Current Shape

Agent Memory OS is a TypeScript-first V1/V1.1 implementation. TypeScript owns
the domain model, SQLite/FTS store, retrieval routing, context packing,
verification policy, CLI bridge, tests, evals, and package orchestration.

Python exists only at the Hermes plugin boundary. The adapter maps Hermes
lifecycle and tool calls to the TypeScript CLI; it must not own memory schema,
ranking, persistence, retrieval, verification policy, or product behavior.

## Implemented Locally

- Append-only evidence events.
- Typed semantic facts with source event citations.
- SQLite + FTS retrieval.
- Active session-state projection.
- Browseable workspace resources.
- Bounded context packs with citations and router policies.
- Verification records and latest non-passed warnings in context packs.
- JSON stdin/stdout `meta-memory` CLI bridge.
- Thin Hermes adapter with local smoke proof for the adapter boundary and CLI
  bridge.

## Deferred By Design

V1/V1.1 does not include vector search, graph databases, cloud memory
providers, LLM extraction, reflection, connector sync, social memory, branch
drift checks, citation validation against live code state, or a second Hermes
provider.

Those capabilities remain V2+ design until the local system is proven.

## Reader Boundaries

- Public project confidence belongs in `README.md`.
- Maintainer and developer details belong in this Starlight site.
- AI-agent operating instructions belong in `AGENTS.md` and bundled skills.
- DeepWiki steering belongs in `.devin/wiki.json`.
