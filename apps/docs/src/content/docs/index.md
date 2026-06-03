---
title: Agent Memory OS
description: Local-first, evidence-led memory for Hermes coding agents.
---

Agent Memory OS is a local-first memory framework for Hermes coding agents. It
keeps one Hermes-facing provider at the boundary while using several auditable
internal memory views behind it: evidence, durable facts, search results, active
task state, workspace resources, context packs, and verification records.

The core idea is:

> event-sourced writes, multi-view storage, routed reads, verified injection

## What It Is

This repo is a TypeScript-first V1/V1.1 implementation for building a safer
coding-agent memory layer. It treats append-only evidence as the source of
truth, then derives searchable facts, compact session state, workspace
resources, and bounded context packs from that evidence.

Python exists only where Hermes needs a Python memory provider. Storage,
ranking, routing, schemas, context packing, verification policy, tests, and the
CLI live in TypeScript packages.

## Status

The local implementation is testable. It includes a real SQLite/FTS store,
TypeScript domain model, JSON stdin/stdout CLI, deterministic evals, and a thin
Hermes adapter.

The Hermes boundary is aligned to the current local plugin contract described by
Hermes docs: `plugin.yaml` metadata, `register(ctx)` registration,
`initialize(...)` bridge setup, lifecycle hook wiring, and JSON-style tool
schemas with JSON-string tool results. This repo has local smoke proof for the
adapter boundary and CLI bridge only. It does not claim that a live production
Hermes installation has been tested.

## What Works Today

- Pinned core memory blocks for high-authority rules and durable facts.
- Append-only evidence events for messages, tool calls, outcomes, file edits,
  and explicit memory writes.
- Typed semantic facts with source event citations.
- SQLite + FTS retrieval for local-first search.
- Active session-state projection for compact current-task memory.
- Browseable workspace resources with URI and parent links.
- Deterministic context packs with token budgets and citations.
- Verification records for `failed`, `passed`, `stale`, `unknown`, and
  `warning` statuses, including latest warnings in context packs.
- A `meta-memory` CLI bridge with `seed-sample`, `remember`, `search`,
  `context-pack`, `upsert-session-state`, `upsert-resource`,
  `browse-resources`, and `verify` commands.
- Adapter-boundary Python checks and local smoke proof for the Hermes contract.

## What Is Out Of V1/V1.1

V1/V1.1 intentionally does not include a vector database, graph database, cloud
memory provider, LLM extraction dependency, reflection engine, connector sync,
social memory, or a second Hermes provider.

Those ideas stay behind the V2+ roadmap until the local evidence, retrieval,
context-pack, verification, session/resource projections, CLI, and adapter
boundary are stable.

## Read Next

- [Getting Started](./start/getting-started.md)
- [Architecture](./architecture/architecture.md)
- [Data Model](./architecture/data-model.md)
- [CLI Reference](./reference/cli-reference.md)
- [Hermes Install Notes](./integrations/hermes-install.md)
- [Roadmap](./roadmap/v1-v2-roadmap.md)
