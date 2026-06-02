# Agent Instructions

## Project Rules

- Keep the repo TypeScript-first. Use Python only for the thin Hermes adapter required by Hermes.
- Use Turborepo for package orchestration and Biome as the only linter/formatter.
- Keep v1 local-first and auditable: SQLite + FTS, no cloud memory provider, vector DB, graph DB, or LLM extraction dependency.
- Preserve the v1/v2 boundary. V1 implements evidence, facts, FTS retrieval, context packs, and verification records. V2 is graph/verification/reflection design only.
- Make surgical changes. Do not refactor adjacent files or add speculative abstractions.

## Current Documentation

- Context7 MCP is the preferred source for current framework and library docs in this repo.
- Before changing APIs, build config, tests, or adapter integration, use Context7 for current docs when the active session exposes the `context7` MCP tools.
- Relevant docs to resolve through Context7: Turborepo, Biome, Vitest, pnpm, TypeScript, Lefthook, Node.js `node:sqlite`, Model Context Protocol, and Hermes Agent when available.
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
- Full local gate: `pnpm run ci`
- Hermes adapter compile and unit tests: `pnpm adapter:check`
- Install git hooks: `pnpm hooks:install`

## Verification

For implementation changes, run the narrowest relevant checks first, then `pnpm run ci` before finalizing when dependencies are available.
