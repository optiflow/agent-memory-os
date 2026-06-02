# Agent Instructions

## Project Rules

- Keep the repo TypeScript-first. Use Python only for the thin Hermes adapter required by Hermes.
- Use Turborepo for package orchestration and Biome as the only linter/formatter.
- Keep v1 local-first and auditable: SQLite + FTS, no cloud memory provider, vector DB, graph DB, or LLM extraction dependency.
- Preserve the v1/v2 boundary. V1 implements evidence, facts, FTS retrieval, context packs, and verification records. V2 is graph/verification/reflection design only.
- Make surgical changes. Do not refactor adjacent files or add speculative abstractions.

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
