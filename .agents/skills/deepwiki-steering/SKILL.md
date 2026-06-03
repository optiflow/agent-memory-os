---
name: deepwiki-steering
description: Maintain this repo's DeepWiki steering config and wiki focus without overstating implemented memory behavior.
---

# DeepWiki Steering

Use this skill when updating `.devin/wiki.json`, diagnosing missing or stale
DeepWiki pages, or preparing guidance for regenerating this repo's DeepWiki.

## Procedure

1. Read the current repo truth before editing.
   - `.devin/wiki.json`
   - `README.md`
   - `AGENTS.md`
   - `apps/docs/src/content/docs/**`

2. Keep `.devin/wiki.json` as the DeepWiki generation control file.
   - `repo_notes` describe repository-wide priorities and boundaries.
   - `pages` is exhaustive when present; do not add or remove pages casually.
   - `page_notes` should point at current files that DeepWiki should prioritize.

3. Preserve this repo's boundaries.
   - TypeScript owns memory behavior, storage, routing, context packing,
     verification policy, CLI behavior, tests, and orchestration.
   - Python is only the thin Hermes adapter boundary.
   - V1/V1.1 is local-first, evidence-first, SQLite/FTS-based, and auditable.
   - Do not imply vector DBs, graph DBs, cloud memory providers, LLM extraction,
     reflection, handoff packets, branch drift checks, or citation validation are
     implemented in V1/V1.1.

4. Use current documentation paths.
   - Prefer `apps/docs/src/content/docs/...` for Starlight docs.
   - Do not add references to deleted root `docs/*.md` files.
   - Treat `skills/agent-memory-os-setup/SKILL.md` as Hermes setup guidance, not
     DeepWiki steering.

5. Verify documentation-only changes.
   - Run `pnpm lint:repo`.
   - Run `pnpm docs:build` when Starlight paths or page guidance change.
   - Check the diff to confirm no runtime TypeScript, Python, CLI, schema,
     adapter, or public API behavior changed.
