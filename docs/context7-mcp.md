# Context7 MCP

Context7 is the documentation MCP for this repo. Use it when implementation depends on current framework or library behavior rather than model memory.

## Installed Codex MCP

The MCP server is registered globally for Codex:

```bash
codex mcp get context7
```

Expected shape:

```text
context7
  enabled: true
  transport: stdio
  command: npx
  args: -y @upstash/context7-mcp@latest
```

New MCP servers may not appear in an already-running Codex session. Restart the session if the `context7` tools are not visible.

## Documentation Targets

Resolve these through Context7 before changing related code:

- Turborepo: `turbo.json`, package task graph, caching, filters.
- Biome: `biome.json`, formatting, lint rules, VCS ignore behavior.
- Vitest: unit tests and package-local test discovery.
- pnpm: workspace settings, install/build approval behavior, lockfile behavior.
- TypeScript: `NodeNext`, project references, composite builds.
- Lefthook: git hook config and pre-commit behavior.
- Node.js `node:sqlite`: `DatabaseSync`, statement APIs, SQLite runtime constraints.
- Model Context Protocol: MCP server/client configuration and tool contracts.
- Hermes Agent: memory provider and MCP integration behavior, when indexed.

## API Key Policy

Do not commit API keys. Context7 supports `CONTEXT7_API_KEY` for higher rate limits; configure it outside the repo if needed.
