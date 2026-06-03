# Agent Instructions

## Project Rules

- Keep the repo TypeScript-first. Use Python only for the thin Hermes adapter required by Hermes.
- TypeScript owns domain types, SQLite/FTS schema and storage, routing, context packing, verification policy, the CLI bridge, tests, and pnpm/Turborepo orchestration. Python must not own memory behavior, ranking, schema, persistence, retrieval, or product policy.
- Use Turborepo for package orchestration and Biome as the only linter/formatter.
- Keep v1 local-first and auditable: SQLite + FTS, no cloud memory provider, vector DB, graph DB, or LLM extraction dependency.
- Preserve the v1/v2 boundary. V1 implements evidence, facts, FTS retrieval, context packs, and verification records. V1.1 implements active session state, workspace resources, `auto`/`task`/`workspace` router policies, and latest non-passed verification warnings in context packs. V2 is graph, branch/workspace drift checks, citation validation, reflection, and handoff design only until explicitly requested.
- Derived projections must preserve evidence first. Session-state and workspace-resource writes should keep source event IDs or create audit evidence before updating projection tables.
- Make surgical changes. Do not refactor adjacent files or add speculative abstractions.

## Documentation Map

- Keep `README.md` human-facing: purpose, status, quickstart, current CLI surface, and roadmap boundaries.
- Keep `AGENTS.md` agent-facing: project rules, documentation/source rules, command list, and verification workflow.
- Keep detailed behavior in `apps/docs/src/content/docs/`: architecture, data model, CLI contracts, environment, evaluation, Hermes install notes, roadmap, and research/provider context.
- Keep the published docs as an Astro Starlight site under `apps/docs`; do not recreate a second canonical root `docs/` tree.
- When changing memory behavior, update Starlight docs and deterministic eval fixtures in the same change. Avoid letting `README.md`, `AGENTS.md`, and `apps/docs/src/content/docs/` disagree about implemented phases or commands.

## Current Documentation

- Context7 MCP is the preferred source for current framework and library docs in this repo.
- Before changing APIs, build config, tests, adapter integration, or Hermes memory-provider behavior, use Context7 for current docs when the active session exposes the `context7` MCP tools.
- Relevant docs to resolve through Context7: Astro Starlight, Turborepo, Biome, Vitest, pnpm, TypeScript, Lefthook, Node.js `node:sqlite`, Model Context Protocol, and Hermes Agent when available.
- Context7 is configured globally through Codex as `context7` with `npx -y @upstash/context7-mcp@latest`. New MCP registrations may require a fresh Codex session before tools appear.
- Do not commit Context7 API keys. If higher rate limits are needed, set `CONTEXT7_API_KEY` in the user environment or Codex MCP config outside this repo.

## Commands

- Install: `pnpm install`
- Lint: `pnpm lint`
- Package lint: `pnpm lint:packages`
- Repo-wide lint: `pnpm lint:repo`
- Format: `pnpm format`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`
- Docs dev server: `pnpm docs:dev`
- Docs build: `pnpm docs:build`
- Docs preview: `pnpm docs:preview`
- Eval: `pnpm eval`
- Benchmark: `pnpm bench`
- CI benchmark: `pnpm bench:ci`
- Full local gate: `pnpm run ci`
- Hermes adapter compile and unit tests: `pnpm adapter:check`
- Install git hooks: `pnpm hooks:install`

## Verification

For implementation changes, run the narrowest relevant checks first, then `pnpm run ci` before finalizing when dependencies are available.

- Core/router changes: run `pnpm --filter @agent-memory-os/core test`.
- SQLite/schema changes: run `pnpm --filter @agent-memory-os/sqlite test`.
- CLI changes: run `pnpm --filter @agent-memory-os/cli test`.
- Eval or retrieval-policy changes: run `pnpm eval` and `pnpm bench:ci`.
- Hermes adapter changes: run `pnpm adapter:check`.
- Documentation-only changes: run `pnpm lint:repo`; run `pnpm docs:build` when Starlight content, config, or navigation changes; run `pnpm run ci` when docs/config examples affect the repo gate or when a full confidence check is appropriate.
