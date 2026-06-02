# Architecture

Agent Memory OS uses a seven-plane architecture, but v1 implements only the planes needed for a local-first Hermes scaffold.

## Operating Principle

Event-sourced writes, multi-view storage, routed reads, verified injection.

## V1 Planes

1. Pinned core memory: high-authority blocks that should not require retrieval.
2. Append-only evidence ledger: messages, tool events, outcomes, file edits, and explicit memory writes.
3. Typed semantic facts: distilled fact records with source event citations.
4. Local retrieval: SQLite + FTS over evidence and facts.
5. Context router: chooses the smallest useful retrieval path and emits bounded packs.
6. Verification records: tracks stale, failed, warning, unknown, and passed checks.

## V2 Planes

1. Temporal relation graph with validity windows.
2. Citation validation against current files, branches, and source documents.
3. Reflection service for slow-path synthesis.
4. Federation hooks for external providers once the local stack is stable.

## Why One Hermes Provider

Hermes can activate only one external memory provider at a time. This repo therefore exposes one provider, `meta_memory`, and hides internal storage and routing choices behind that provider.
