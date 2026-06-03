# Agent Memory OS Setup

Use this skill when the user asks Hermes to install, enable, configure, or debug
the Agent Memory OS memory provider.

## Procedure

1. Check the plugin status first.
   - Call the `meta_memory.status` tool.
   - If it returns `ready`, use the memory tools normally.
   - If it returns `configuration_required`, follow its `nextSetupCommands`.

2. Build or link the TypeScript CLI when needed.
   - Run `pnpm install`.
   - Run `pnpm --filter @agent-memory-os/cli build`.
   - Either set `META_MEMORY_CLI` to `node /absolute/path/to/packages/cli/dist/index.js`
     or link the `meta-memory` bin globally.

3. Keep memory local and explicit.
   - Use `META_MEMORY_DB` only when the user wants a specific SQLite file.
   - Otherwise allow the adapter to use the Hermes home default.
   - Do not configure cloud memory, vector DBs, graph DBs, or LLM extraction for
     this v1 provider.

4. Verify before claiming the provider works.
   - Run `pnpm adapter:check` from the repository.
   - Call `meta_memory.status` again.
   - Use `meta_memory.context_pack` with a small test query only after status is
     ready.

## Boundaries

- `SKILL.md` is setup guidance, not the install contract.
- Hermes discovers this plugin through `plugin.yaml` and `register(ctx)`.
- Python is only the Hermes adapter boundary; TypeScript owns memory behavior.
