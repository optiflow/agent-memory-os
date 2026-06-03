import { DatabaseSync } from "node:sqlite";
import type {
  CoreMemoryBlock,
  EvidenceEvent,
  MemoryScope,
  MemoryStore,
  Metadata,
  SearchResult,
  SemanticFact,
  SessionState,
  VerificationRecord,
  WorkspaceResource,
} from "@agent-memory-os/core";
import { SCHEMA_SQL } from "./migrations.js";

function metadataToJson(metadata: Metadata | undefined): string {
  return JSON.stringify(metadata ?? {});
}

function metadataFromJson(value: unknown): Metadata {
  if (typeof value !== "string" || value.length === 0) {
    return {};
  }

  return JSON.parse(value) as Metadata;
}

function stringArrayFromJson(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is string => typeof item === "string");
}

function textValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];

  if (typeof value !== "string") {
    throw new TypeError(`Expected ${key} to be a string`);
  }

  return value;
}

function optionalTextValue(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];

  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new TypeError(`Expected ${key} to be a string`);
  }

  return value;
}

function numberValue(row: Record<string, unknown>, key: string): number {
  const value = row[key];

  if (typeof value !== "number") {
    throw new TypeError(`Expected ${key} to be a number`);
  }

  return value;
}

function toFtsQuery(query: string): string | undefined {
  const tokens = query.match(/[A-Za-z0-9_]+/g) ?? [];

  if (tokens.length === 0) {
    return undefined;
  }

  return tokens.map((token) => `"${token}"`).join(" OR ");
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }

  return Math.floor(limit);
}

function scopeClause(scope?: MemoryScope, tableAlias?: string): string {
  if (!scope) {
    return "";
  }

  const prefix = tableAlias ? `${tableAlias}.` : "";
  return ` AND ${prefix}scope_type = ? AND ${prefix}scope_id = ?`;
}

function scopeValues(scope?: MemoryScope): string[] {
  return scope ? [scope.type, scope.id] : [];
}

export class SQLiteMemoryStore implements MemoryStore {
  private readonly database: DatabaseSync;

  constructor(path = ":memory:") {
    this.database = new DatabaseSync(path);
    this.database.exec(SCHEMA_SQL);
  }

  close(): void {
    this.database.close();
  }

  async appendEvidence(event: EvidenceEvent): Promise<EvidenceEvent> {
    this.database
      .prepare(
        `INSERT INTO evidence_events (
          id, kind, scope_type, scope_id, actor, content, timestamp, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.kind,
        event.scope.type,
        event.scope.id,
        event.actor,
        event.content,
        event.timestamp,
        metadataToJson(event.metadata),
      );
    this.database
      .prepare("INSERT INTO evidence_fts (id, content, metadata) VALUES (?, ?, ?)")
      .run(event.id, event.content, metadataToJson(event.metadata));

    return event;
  }

  async addSemanticFact(fact: SemanticFact): Promise<SemanticFact> {
    this.database
      .prepare(
        `INSERT INTO semantic_facts (
          id, subject, predicate, object, confidence, valid_from, valid_until,
          source_event_ids_json, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fact.id,
        fact.subject,
        fact.predicate,
        fact.object,
        fact.confidence,
        fact.validFrom ?? null,
        fact.validUntil ?? null,
        JSON.stringify(fact.sourceEventIds),
        metadataToJson(fact.metadata),
      );
    this.database
      .prepare("INSERT INTO fact_fts (id, content, metadata) VALUES (?, ?, ?)")
      .run(
        fact.id,
        `${fact.subject} ${fact.predicate} ${fact.object}`,
        metadataToJson(fact.metadata),
      );

    return fact;
  }

  async upsertCoreBlock(block: CoreMemoryBlock): Promise<CoreMemoryBlock> {
    this.database
      .prepare(
        `INSERT INTO core_blocks (
          id, label, content, authority, read_only, updated_at, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          content = excluded.content,
          authority = excluded.authority,
          read_only = excluded.read_only,
          updated_at = excluded.updated_at,
          metadata_json = excluded.metadata_json`,
      )
      .run(
        block.id,
        block.label,
        block.content,
        block.authority,
        block.readOnly ? 1 : 0,
        block.updatedAt,
        metadataToJson(block.metadata),
      );

    return block;
  }

  async getCoreBlocks(_scope?: MemoryScope): Promise<CoreMemoryBlock[]> {
    const rows = this.database
      .prepare(
        `SELECT id, label, content, authority, read_only, updated_at, metadata_json
         FROM core_blocks
         ORDER BY authority DESC, id ASC`,
      )
      .all();

    return rows.map((row) => ({
      id: textValue(row, "id"),
      label: textValue(row, "label"),
      content: textValue(row, "content"),
      authority: numberValue(row, "authority"),
      readOnly: numberValue(row, "read_only") === 1,
      updatedAt: textValue(row, "updated_at"),
      metadata: metadataFromJson(row.metadata_json),
    }));
  }

  async upsertSessionState(state: SessionState): Promise<SessionState> {
    this.database
      .prepare(
        `INSERT INTO session_states (
          id, scope_type, scope_id, status, current_goal, summary,
          working_set_json, updated_at, source_event_ids_json, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(scope_type, scope_id, id) DO UPDATE SET
          status = excluded.status,
          current_goal = excluded.current_goal,
          summary = excluded.summary,
          working_set_json = excluded.working_set_json,
          updated_at = excluded.updated_at,
          source_event_ids_json = excluded.source_event_ids_json,
          metadata_json = excluded.metadata_json`,
      )
      .run(
        state.id,
        state.scope.type,
        state.scope.id,
        state.status,
        state.currentGoal,
        state.summary,
        JSON.stringify(state.workingSet),
        state.updatedAt,
        JSON.stringify(state.sourceEventIds),
        metadataToJson(state.metadata),
      );
    this.database
      .prepare("DELETE FROM session_state_fts WHERE id = ? AND scope_type = ? AND scope_id = ?")
      .run(state.id, state.scope.type, state.scope.id);
    this.database
      .prepare(
        "INSERT INTO session_state_fts (id, scope_type, scope_id, content, metadata) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        state.id,
        state.scope.type,
        state.scope.id,
        `${state.currentGoal} ${state.status} ${state.summary} ${state.workingSet.join(" ")}`,
        metadataToJson(state.metadata),
      );

    return state;
  }

  async getActiveSessionStates(scope?: MemoryScope): Promise<SessionState[]> {
    const rows = this.database
      .prepare(
        `SELECT id, scope_type, scope_id, status, current_goal, summary, working_set_json,
          updated_at, source_event_ids_json, metadata_json
         FROM session_states
         WHERE status = 'active'${scopeClause(scope)}
         ORDER BY updated_at DESC, id ASC`,
      )
      .all(...scopeValues(scope));

    return rows.map(sessionStateFromRow);
  }

  async upsertWorkspaceResource(resource: WorkspaceResource): Promise<WorkspaceResource> {
    this.database
      .prepare(
        `INSERT INTO workspace_resources (
          uri, scope_type, scope_id, kind, title, content, parent_uri,
          updated_at, source_event_ids_json, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(scope_type, scope_id, uri) DO UPDATE SET
          kind = excluded.kind,
          title = excluded.title,
          content = excluded.content,
          parent_uri = excluded.parent_uri,
          updated_at = excluded.updated_at,
          source_event_ids_json = excluded.source_event_ids_json,
          metadata_json = excluded.metadata_json`,
      )
      .run(
        resource.uri,
        resource.scope.type,
        resource.scope.id,
        resource.kind,
        resource.title,
        resource.content,
        resource.parentUri ?? null,
        resource.updatedAt,
        JSON.stringify(resource.sourceEventIds),
        metadataToJson(resource.metadata),
      );
    this.database
      .prepare(
        "DELETE FROM workspace_resource_fts WHERE uri = ? AND scope_type = ? AND scope_id = ?",
      )
      .run(resource.uri, resource.scope.type, resource.scope.id);
    this.database
      .prepare(
        "INSERT INTO workspace_resource_fts (uri, scope_type, scope_id, content, metadata) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        resource.uri,
        resource.scope.type,
        resource.scope.id,
        `${resource.uri} ${resource.kind} ${resource.title} ${resource.content}`,
        metadataToJson(resource.metadata),
      );

    return resource;
  }

  async listWorkspaceResources(
    options: { scope?: MemoryScope; parentUri?: string; limit?: number } = {},
  ): Promise<WorkspaceResource[]> {
    const normalizedLimit = normalizeLimit(options.limit ?? 50);

    if (normalizedLimit === 0) {
      return [];
    }

    const parentClause = options.parentUri === undefined ? "parent_uri IS NULL" : "parent_uri = ?";
    const parentValues = options.parentUri === undefined ? [] : [options.parentUri];
    const rows = this.database
      .prepare(
        `SELECT uri, scope_type, scope_id, kind, title, content, parent_uri,
          updated_at, source_event_ids_json, metadata_json
         FROM workspace_resources
         WHERE ${parentClause}${scopeClause(options.scope)}
         ORDER BY title ASC, uri ASC
         LIMIT ?`,
      )
      .all(...parentValues, ...scopeValues(options.scope), normalizedLimit);

    return rows.map(workspaceResourceFromRow);
  }

  async search(query: string, limit = 10, scope?: MemoryScope): Promise<SearchResult[]> {
    const normalizedLimit = normalizeLimit(limit);

    if (normalizedLimit === 0) {
      return [];
    }

    const ftsQuery = toFtsQuery(query);

    if (!ftsQuery) {
      return [];
    }

    const evidenceRows = this.database
      .prepare(
        `SELECT evidence_events.id, evidence_events.kind, evidence_events.content,
          evidence_events.timestamp, evidence_events.metadata_json, bm25(evidence_fts) AS rank
         FROM evidence_fts
         JOIN evidence_events ON evidence_events.id = evidence_fts.id
         WHERE evidence_fts MATCH ?${scopeClause(scope, "evidence_events")}
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(ftsQuery, ...scopeValues(scope), normalizedLimit);
    const factRows = this.database
      .prepare(
        `SELECT semantic_facts.id, semantic_facts.subject, semantic_facts.predicate,
          semantic_facts.object, semantic_facts.confidence, semantic_facts.metadata_json,
          bm25(fact_fts) AS rank
         FROM fact_fts
         JOIN semantic_facts ON semantic_facts.id = fact_fts.id
         WHERE fact_fts MATCH ?
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(ftsQuery, normalizedLimit);
    const sessionRows = this.database
      .prepare(
        `SELECT session_states.id, session_states.status, session_states.current_goal,
          session_states.summary, session_states.working_set_json, session_states.updated_at,
          session_states.metadata_json, bm25(session_state_fts) AS rank
         FROM session_state_fts
         JOIN session_states ON session_states.id = session_state_fts.id
          AND session_states.scope_type = session_state_fts.scope_type
          AND session_states.scope_id = session_state_fts.scope_id
         WHERE session_state_fts MATCH ?${scopeClause(scope, "session_states")}
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(ftsQuery, ...scopeValues(scope), normalizedLimit);
    const resourceRows = this.database
      .prepare(
        `SELECT workspace_resources.uri, workspace_resources.kind, workspace_resources.title,
          workspace_resources.content, workspace_resources.updated_at,
          workspace_resources.metadata_json, bm25(workspace_resource_fts) AS rank
         FROM workspace_resource_fts
         JOIN workspace_resources ON workspace_resources.uri = workspace_resource_fts.uri
          AND workspace_resources.scope_type = workspace_resource_fts.scope_type
          AND workspace_resources.scope_id = workspace_resource_fts.scope_id
         WHERE workspace_resource_fts MATCH ?${scopeClause(scope, "workspace_resources")}
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(ftsQuery, ...scopeValues(scope), normalizedLimit);

    return [
      ...evidenceRows.map((row) => ({
        id: textValue(row, "id"),
        kind: "evidence" as const,
        content: textValue(row, "content"),
        score: sqliteRankToScore(numberValue(row, "rank")),
        citation: `event:${textValue(row, "id")}`,
        timestamp: textValue(row, "timestamp"),
        metadata: metadataFromJson(row.metadata_json),
      })),
      ...factRows.map((row) => {
        const id = textValue(row, "id");

        return {
          id,
          kind: "fact" as const,
          content: `${textValue(row, "subject")} ${textValue(row, "predicate")} ${textValue(row, "object")}`,
          score: sqliteRankToScore(numberValue(row, "rank")) * numberValue(row, "confidence"),
          citation: `fact:${id}`,
          metadata: metadataFromJson(row.metadata_json),
        };
      }),
      ...sessionRows.map((row) => ({
        id: textValue(row, "id"),
        kind: "session" as const,
        content: `Current goal: ${textValue(row, "current_goal")}\nStatus: ${textValue(
          row,
          "status",
        )}\nSummary: ${textValue(row, "summary")}\nWorking set: ${stringArrayFromJson(
          row.working_set_json,
        ).join(", ")}`,
        score: sqliteRankToScore(numberValue(row, "rank")),
        citation: `session:${textValue(row, "id")}`,
        timestamp: textValue(row, "updated_at"),
        metadata: metadataFromJson(row.metadata_json),
      })),
      ...resourceRows.map((row) => ({
        id: textValue(row, "uri"),
        kind: "resource" as const,
        content: `${textValue(row, "title")} (${textValue(row, "kind")}): ${textValue(
          row,
          "content",
        )}`,
        score: sqliteRankToScore(numberValue(row, "rank")),
        citation: `resource:${textValue(row, "uri")}`,
        timestamp: textValue(row, "updated_at"),
        metadata: metadataFromJson(row.metadata_json),
      })),
    ]
      .slice()
      .sort((left, right) => right.score - left.score)
      .slice(0, normalizedLimit);
  }

  async recordVerification(record: VerificationRecord): Promise<VerificationRecord> {
    this.database
      .prepare(
        `INSERT INTO verification_records (
          id, target_id, status, checked_at, message, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.targetId,
        record.status,
        record.checkedAt,
        record.message,
        metadataToJson(record.metadata),
      );

    return record;
  }

  async getVerificationWarnings(targetIds: string[]): Promise<VerificationRecord[]> {
    if (targetIds.length === 0) {
      return [];
    }

    const placeholders = targetIds.map(() => "?").join(", ");
    const rows = this.database
      .prepare(
        `SELECT records.id, records.target_id, records.status, records.checked_at,
          records.message, records.metadata_json
         FROM verification_records records
         JOIN (
           SELECT target_id, MAX(checked_at) AS checked_at
           FROM verification_records
           WHERE target_id IN (${placeholders})
           GROUP BY target_id
         ) latest ON latest.target_id = records.target_id
          AND latest.checked_at = records.checked_at
         WHERE records.status IN ('failed', 'stale', 'unknown', 'warning')
         ORDER BY records.checked_at DESC, records.id ASC`,
      )
      .all(...targetIds);

    return rows.map((row) => ({
      id: textValue(row, "id"),
      targetId: textValue(row, "target_id"),
      status: textValue(row, "status") as VerificationRecord["status"],
      checkedAt: textValue(row, "checked_at"),
      message: textValue(row, "message"),
      metadata: metadataFromJson(row.metadata_json),
    }));
  }
}

function sqliteRankToScore(rank: number): number {
  return 1 / (1 + Math.abs(rank));
}

function sessionStateFromRow(row: Record<string, unknown>): SessionState {
  return {
    id: textValue(row, "id"),
    scope: {
      type: textValue(row, "scope_type") as SessionState["scope"]["type"],
      id: textValue(row, "scope_id"),
    },
    status: textValue(row, "status") as SessionState["status"],
    currentGoal: textValue(row, "current_goal"),
    summary: textValue(row, "summary"),
    workingSet: stringArrayFromJson(row.working_set_json),
    updatedAt: textValue(row, "updated_at"),
    sourceEventIds: stringArrayFromJson(row.source_event_ids_json),
    metadata: metadataFromJson(row.metadata_json),
  };
}

function workspaceResourceFromRow(row: Record<string, unknown>): WorkspaceResource {
  return {
    uri: textValue(row, "uri"),
    scope: {
      type: textValue(row, "scope_type") as WorkspaceResource["scope"]["type"],
      id: textValue(row, "scope_id"),
    },
    kind: textValue(row, "kind") as WorkspaceResource["kind"],
    title: textValue(row, "title"),
    content: textValue(row, "content"),
    parentUri: optionalTextValue(row, "parent_uri"),
    updatedAt: textValue(row, "updated_at"),
    sourceEventIds: stringArrayFromJson(row.source_event_ids_json),
    metadata: metadataFromJson(row.metadata_json),
  };
}
