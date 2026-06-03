# Agent Instructions

## Project Rules

- Keep the repo TypeScript-first. Use Python only for the thin Hermes adapter
  required by Hermes.
- TypeScript owns domain types, SQLite/FTS schema and storage, routing, context
  packing, verification policy, the CLI bridge, tests, and pnpm/Turborepo
  orchestration. Python must not own memory behavior, ranking, schema,
  persistence, retrieval, or product policy.
- Use Turborepo for package orchestration and Biome as the only
  linter/formatter.
- Keep v1 local-first and auditable: SQLite + FTS, no cloud memory provider,
  vector DB, graph DB, or LLM extraction dependency.
- Preserve the v1/v2 boundary. V1 implements evidence, facts, FTS retrieval,
  context packs, and verification records. V1.1 implements active session state,
  workspace resources, `auto`/`task`/`workspace` router policies, and latest
  non-passed verification warnings in context packs. V2 Core implements
  local-first temporal relations, source citation validation, branch/workspace
  drift warnings, and recall warnings in context packs. V2 reflection and
  handoff work stays design only until explicitly requested.
- Derived projections must preserve evidence first. Session-state and
  workspace-resource and temporal-relation writes should keep source event IDs
  or create audit evidence before updating projection tables.
- Make surgical changes. Do not refactor adjacent files or add speculative
  abstractions.

## Documentation Map

- Keep `README.md` human-facing: purpose, status, quickstart, current CLI
  surface, and roadmap boundaries.
- Keep `AGENTS.md` agent-facing: project rules, documentation/source rules,
  command list, and verification workflow.
- Keep detailed behavior in `apps/docs/src/content/docs/`: architecture, data
  model, CLI contracts, environment, evaluation, Hermes install notes, roadmap,
  and research/provider context.
- Keep the published docs as an Astro Starlight site under `apps/docs`; do not
  recreate a second canonical root `docs/` tree.
- When changing memory behavior, update Starlight docs and deterministic eval
  fixtures in the same change. Avoid letting `README.md`, `AGENTS.md`, and
  `apps/docs/src/content/docs/` disagree about implemented phases or commands.

## Documentation Audience Map

- `README.md` is public-facing. Use it to establish product identity, current
  proof, deliberate non-goals, the shortest local gate, documentation links, and
  roadmap boundaries.
- `apps/docs/src/content/docs/` is human maintainer/developer-facing. Put setup,
  architecture, data model, CLI contracts, evaluation, Hermes install notes,
  roadmap, and research context there.
- `AGENTS.md` and `skills/agent-memory-os-setup/SKILL.md` are AI-agent-facing.
  Keep them operational, terse, and explicit about boundaries.
- `adapters/hermes/README.md` is maintainer-facing adapter internals. Keep
  install-user guidance in Starlight Hermes install notes.
- `.devin/wiki.json` steers DeepWiki. Keep page titles unique and priority
  files valid.

## Documentation Freshness Gate

- Run `pnpm docs:check` before finalizing code, tooling, adapter, or repo-policy
  changes.
- The docs guard is strict: code and policy changes fail until the matching
  documentation surface changes in the same diff.
- Core, SQLite, eval, router, context-pack, verification, schema, and
  memory-behavior changes require matching Starlight docs under
  `apps/docs/src/content/docs/`.
- CLI surface changes require
  `apps/docs/src/content/docs/reference/cli-reference.md` and `README.md` or
  `AGENTS.md` when the change is user-facing.
- Hermes adapter, root plugin shim, or setup-skill changes require
  `adapters/hermes/README.md` or
  `apps/docs/src/content/docs/integrations/hermes-install.md`.
- Tooling, workflow, package, Node/pnpm/Turbo/Biome/Lefthook, and docs-guard
  policy changes require `AGENTS.md`,
  `apps/docs/src/content/docs/start/environment.md`, or
  `apps/docs/src/content/docs/reference/evaluation.md`.
- `.devin/wiki.json` must remain valid, use unique page titles, and point
  `page_notes` priority files at existing paths.
- Do not use deleted root `docs/*.md` files as canonical docs. Canonical docs
  live under `apps/docs/src/content/docs/`; retained `docs/research/*.md` source
  material must only be referenced when the file exists.
- DeepWiki is generated outside CI. Steer it with `.devin/wiki.json`, then audit
  the refreshed wiki after merge with DeepWiki MCP before claiming the public
  index is current.

## Current Documentation

- Context7 MCP is the preferred source for current framework and library docs in
  this repo.
- Before changing APIs, build config, tests, adapter integration, or Hermes
  memory-provider behavior, use Context7 for current docs when the active
  session exposes the `context7` MCP tools.
- Relevant docs to resolve through Context7: Astro Starlight, Turborepo, Biome,
  Vitest, pnpm, TypeScript, Lefthook, Node.js `node:sqlite`, Model Context
  Protocol, and Hermes Agent when available.
- Context7 is configured globally through Codex as `context7` with
  `npx -y @upstash/context7-mcp@latest`. New MCP registrations may require a
  fresh Codex session before tools appear.
- Do not commit Context7 API keys. If higher rate limits are needed, set
  `CONTEXT7_API_KEY` in the user environment or Codex MCP config outside this
  repo.

## Commands

- Install: `pnpm install`
- Create a changeset: `pnpm changeset`
- Apply pending changesets to versions and changelogs:
  `pnpm changeset:version`
- Lint: `pnpm lint`
- Package lint: `pnpm lint:packages`
- Repo-wide lint: `pnpm lint:repo`
- Format: `pnpm format`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`
- Docs dev server: `pnpm docs:dev`
- Docs freshness gate: `pnpm docs:check`
- Docs build: `pnpm docs:build`
- Docs preview: `pnpm docs:preview`
- Eval: `pnpm eval`
- Benchmark: `pnpm bench`
- CI benchmark: `pnpm bench:ci`
- Full local gate: `pnpm run ci`
- Hermes adapter compile and unit tests: `pnpm adapter:check`
- Install git hooks: `pnpm hooks:install`
- Release metadata warning check: `pnpm release:check`
- Create GitHub release from `CHANGELOG.md`: `pnpm release:github`

## Release Workflow

- Releases are repository-level GitHub Releases only. Do not add npm publishing
  or `NPM_TOKEN` requirements unless explicitly requested.
- Significant changes or improvements require a changeset targeting
  `agent-memory-os`. Use `pnpm changeset`, then choose the smallest valid semver
  bump: patch for fixes and docs/tooling polish, minor for new capabilities, and
  major only for breaking public behavior.
- Non-release PRs should include `[no release]` in the PR title or body. Use it
  for chore-only changes, CI experiments, or edits that should not become release
  notes.
- The release metadata workflow is warning-only. Treat warnings as review input,
  not a failing gate.
- The release workflow runs after the `CI` workflow succeeds on `main`.
  `changesets/action` opens or updates the `Version Agent Memory OS` PR while
  changesets are pending. After that version PR merges, the workflow runs
  `pnpm release:github` and creates `Agent Memory OS vX.Y.Z` from the matching
  root `CHANGELOG.md` section.
- Do not manually edit generated version PR contents unless fixing the release
  metadata itself. Prefer adding or amending changesets in feature PRs.

## Verification

For implementation changes, run the narrowest relevant checks first, then
`pnpm run ci` before finalizing when dependencies are available.

- Core/router changes: run `pnpm --filter @agent-memory-os/core test`.
- SQLite/schema changes: run `pnpm --filter @agent-memory-os/sqlite test`.
- CLI changes: run `pnpm --filter @agent-memory-os/cli test`.
- Eval or retrieval-policy changes: run `pnpm eval` and `pnpm bench:ci`.
- Hermes adapter changes: run `pnpm adapter:check`.
- Documentation-only changes: run `pnpm lint:repo`; run `pnpm docs:build` when
  Starlight content, config, or navigation changes; run `pnpm run ci` when
  docs/config examples affect the repo gate or when a full confidence check is
  appropriate.
