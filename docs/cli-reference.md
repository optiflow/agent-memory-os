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

`scope` partitions local memory. The default workspace scope is suitable for
smoke tests, but real workspace, project, and session callers should pass a
stable `type` plus `id` so unrelated memories do not collide.

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

Search local evidence, facts, active session state, and workspace resources with
SQLite FTS. Core memory blocks are included through `context-pack`, not raw
`search`.

Required:

- `query`: non-empty string.

Optional:

- `limit`: positive integer, defaults to `10`.
- `scope`: narrows FTS search to a memory scope.

Returns:

- `{ "results": SearchResult[] }`

## `context-pack`

Build a bounded context pack for injection or inspection.

Required:

- `query`: non-empty string.

Optional:

- `budgetTokens`: positive integer, defaults to `1200`.
- `policy`: `auto`, `task`, or `workspace`; defaults to `auto`. `auto`
  includes active session state and workspace resources, `task` excludes
  workspace resource search, and `workspace` excludes active session state.
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

## `upsert-session-state`

Create or update compact active task state. This is a projection write: the CLI
appends an audit evidence event before updating the projection table.

Required:

- `id`: non-empty session-state identifier.
- `currentGoal`: non-empty current goal.
- `summary`: non-empty bounded task summary.

Optional:

- `status`: `active`, `blocked`, or `complete`; defaults to `active`.
- `workingSet`: array of strings.
- `scope`
- `sourceEventIds`
- `metadata`

Returns:

- `{ "event": EvidenceEvent, "sessionState": SessionState }`

## `upsert-resource`

Create or update a browseable workspace resource. This is a projection write:
the CLI appends an audit evidence event before updating the projection table.

Required:

- `uri`: non-empty resource URI.
- `title`: non-empty display title.
- `content`: non-empty searchable content.

Optional:

- `kind`: `doc`, `file`, `note`, `other`, or `url`; defaults to `file`.
- `parentUri`: non-empty parent resource URI.
- `scope`
- `sourceEventIds`
- `metadata`

Returns:

- `{ "event": EvidenceEvent, "resource": WorkspaceResource }`

## `browse-resources`

List workspace resources under an optional parent URI.

Optional:

- `parentUri`: parent resource URI; omitted lists root resources.
- `limit`: positive integer, defaults to `50`.
- `scope`

Returns:

- `{ "resources": WorkspaceResource[] }`

## `seed-sample`

Create sample core, evidence, fact, session-state, and workspace-resource
records for smoke testing.

Optional:

- `dbPath`
- `scope`

Returns:

- `{ "coreBlock": CoreMemoryBlock, "event": EvidenceEvent, "fact": SemanticFact, "sessionState": SessionState, "resource": WorkspaceResource }`

## Error Contract

The CLI exits non-zero and writes an error object to stderr when input is invalid
or the command is unknown. The Hermes adapter treats non-zero exits, empty
stdout, and invalid JSON as adapter failures.
