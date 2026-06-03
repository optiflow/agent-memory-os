# CLI Reference

`meta-memory` is a JSON stdin/stdout bridge for Hermes and local smoke tests.

Build it before invoking the generated CLI directly:

```bash
pnpm --filter @agent-memory-os/cli build
```

Then call:

```bash
echo '{"dbPath":":memory:","query":"Biome","budgetTokens":400}' \
  | node packages/cli/dist/index.js context-pack
```

## Shared Inputs

| Field | Default | Notes |
| --- | --- | --- |
| `dbPath` | `META_MEMORY_DB`, then `:memory:` | SQLite path. |
| `scope` | `{ "type": "workspace", "id": "default" }` | Optional scope object. |
| `metadata` | omitted | Optional JSON object where supported. |

If neither `dbPath` nor `META_MEMORY_DB` is set, direct CLI calls use `:memory:`.
Those calls are ephemeral and are not equivalent to the Hermes adapter's
file-backed default database.

## `remember`

Append an evidence event.

Required:

- `content`: non-empty string.

Optional:

- `kind`: evidence kind, defaults to `explicit_memory`.
- `actor`: `assistant`, `system`, `tool`, or `user`; defaults to `user`.
- `scope`
- `metadata`

Returns:

- `{ "event": EvidenceEvent }`

## `search`

Search local core memory, evidence, and facts.

Required:

- `query`: non-empty string.

Optional:

- `limit`: positive integer, defaults to `10`.

Returns:

- `{ "results": SearchResult[] }`

## `context-pack`

Build a bounded context pack for injection or inspection.

Required:

- `query`: non-empty string.

Optional:

- `budgetTokens`: positive integer, defaults to `1200`.
- `scope`

Returns:

- `{ "contextPack": ContextPack }`

## `verify`

Record verification status for a memory item.

Required:

- `targetId`: non-empty string.
- `message`: non-empty string.

Optional:

- `status`: `failed`, `passed`, `stale`, `unknown`, or `warning`; defaults to
  `unknown`.

Returns:

- `{ "verification": VerificationRecord }`

## `seed-sample`

Create sample core, evidence, and fact records for smoke testing.

Optional:

- `dbPath`
- `scope`

Returns:

- `{ "coreBlock": CoreMemoryBlock, "event": EvidenceEvent, "fact": SemanticFact }`

## Error Contract

The CLI exits non-zero and writes an error object to stderr when input is invalid
or the command is unknown. The Hermes adapter treats non-zero exits, empty
stdout, and invalid JSON as adapter failures.
