import { DatabaseSync } from "node:sqlite";
import type {
  CoreMemoryBlock,
  EvidenceEvent,
  MemoryScope,
  MemoryStore,
  Metadata,
  RecallWarning,
  SearchResult,
  SemanticFact,
  SessionState,
  TemporalRelation,
  VerificationRecord,
  WorkspaceResource,
} from "@agent-memory-os/core";
import { createRecallWarning } from "@agent-memory-os/core";
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

function metadataWithSourceEventIds(
  metadata: Metadata | undefined,
  sourceEventIds: string[],
): Metadata {
  return { ...(metadata ?? {}), sourceEventIds };
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

  async addTemporalRelation(relation: TemporalRelation): Promise<TemporalRelation> {
    this.database
      .prepare(
        `INSERT INTO temporal_relations (
          id, scope_type, scope_id, from_id, to_id, relation, valid_from, valid_until,
          source_event_ids_json, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        relation.id,
        relation.scope.type,
        relation.scope.id,
        relation.fromId,
        relation.toId,
        relation.relation,
        relation.validFrom ?? null,
        relation.validUntil ?? null,
        JSON.stringify(relation.sourceEventIds),
        metadataToJson(relation.metadata),
      );

    return relation;
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
          semantic_facts.object, semantic_facts.confidence,
          semantic_facts.source_event_ids_json, semantic_facts.metadata_json, bm25(fact_fts) AS rank
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
          session_states.source_event_ids_json, session_states.metadata_json,
          bm25(session_state_fts) AS rank
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
          workspace_resources.source_event_ids_json, workspace_resources.metadata_json,
          bm25(workspace_resource_fts) AS rank
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
          metadata: metadataWithSourceEventIds(
            metadataFromJson(row.metadata_json),
            stringArrayFromJson(row.source_event_ids_json),
          ),
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
        metadata: metadataWithSourceEventIds(
          metadataFromJson(row.metadata_json),
          stringArrayFromJson(row.source_event_ids_json),
        ),
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
        metadata: metadataWithSourceEventIds(
          metadataFromJson(row.metadata_json),
          stringArrayFromJson(row.source_event_ids_json),
        ),
      })),
    ]
      .slice()
      .sort((left, right) => right.score - left.score)
      .slice(0, normalizedLimit);
  }

  async getTemporalRelationsForTarget(
    targetId: string,
    options: {
      relation?: TemporalRelation["relation"];
      scope?: MemoryScope;
      limit?: number;
    } = {},
  ): Promise<TemporalRelation[]> {
    const normalizedLimit = normalizeLimit(options.limit ?? 20);

    if (normalizedLimit === 0) {
      return [];
    }

    const relationClause = options.relation ? " AND relation = ?" : "";
    const relationValues = options.relation ? [options.relation] : [];
    const rows = this.database
      .prepare(
        `SELECT id, scope_type, scope_id, from_id, to_id, relation, valid_from, valid_until,
          source_event_ids_json, metadata_json
         FROM temporal_relations
         WHERE (from_id = ? OR to_id = ?)${scopeClause(options.scope)}${relationClause}
         ORDER BY id ASC
         LIMIT ?`,
      )
      .all(targetId, targetId, ...scopeValues(options.scope), ...relationValues, normalizedLimit);

    return rows.map(temporalRelationFromRow);
  }

  async getRecallWarnings(targetIds: string[], scope?: MemoryScope): Promise<RecallWarning[]> {
    const uniqueTargetIds = uniqueStrings(targetIds);

    if (uniqueTargetIds.length === 0) {
      return [];
    }

    return [
      ...this.getSourceCitationWarnings(uniqueTargetIds, scope),
      ...this.getTemporalRecallWarnings(uniqueTargetIds, scope),
    ];
  }

  private getSourceCitationWarnings(targetIds: string[], scope?: MemoryScope): RecallWarning[] {
    const placeholders = targetIds.map(() => "?").join(", ");
    const sourceRefs: Array<{ sourceEventIds: string[]; targetId: string }> = [];
    const factRows = this.database
      .prepare(
        `SELECT id, source_event_ids_json
         FROM semantic_facts
         WHERE id IN (${placeholders})`,
      )
      .all(...targetIds);
    const sessionRows = this.database
      .prepare(
        `SELECT id, source_event_ids_json
         FROM session_states
         WHERE id IN (${placeholders})${scopeClause(scope)}`,
      )
      .all(...targetIds, ...scopeValues(scope));
    const resourceRows = this.database
      .prepare(
        `SELECT uri, source_event_ids_json
         FROM workspace_resources
         WHERE uri IN (${placeholders})${scopeClause(scope)}`,
      )
      .all(...targetIds, ...scopeValues(scope));

    for (const row of factRows) {
      sourceRefs.push({
        targetId: textValue(row, "id"),
        sourceEventIds: stringArrayFromJson(row.source_event_ids_json),
      });
    }

    for (const row of sessionRows) {
      sourceRefs.push({
        targetId: textValue(row, "id"),
        sourceEventIds: stringArrayFromJson(row.source_event_ids_json),
      });
    }

    for (const row of resourceRows) {
      sourceRefs.push({
        targetId: textValue(row, "uri"),
        sourceEventIds: stringArrayFromJson(row.source_event_ids_json),
      });
    }

    const sourceEventIds = uniqueStrings(
      sourceRefs.flatMap((sourceRef) => sourceRef.sourceEventIds),
    );
    const existingSourceEventIds = new Set<string>();
    if (sourceEventIds.length > 0) {
      const sourcePlaceholders = sourceEventIds.map(() => "?").join(", ");
      const sourceRows = this.database
        .prepare(`SELECT id FROM evidence_events WHERE id IN (${sourcePlaceholders})`)
        .all(...sourceEventIds);

      for (const row of sourceRows) {
        existingSourceEventIds.add(textValue(row, "id"));
      }
    }

    const warnings: RecallWarning[] = [];
    for (const sourceRef of sourceRefs) {
      if (sourceRef.sourceEventIds.length === 0) {
        warnings.push(
          createRecallWarning({
            kind: "citation_missing",
            targetId: sourceRef.targetId,
            message: "Memory item has no source event IDs.",
            metadata: { sourceEventIds: [] },
          }),
        );
        continue;
      }

      for (const sourceEventId of sourceRef.sourceEventIds) {
        if (existingSourceEventIds.has(sourceEventId)) {
          continue;
        }

        warnings.push(
          createRecallWarning({
            kind: "citation_missing",
            targetId: sourceRef.targetId,
            message: `Memory item references missing source event ${sourceEventId}.`,
            metadata: { missingSourceEventId: sourceEventId },
          }),
        );
      }
    }

    return warnings;
  }

  private getTemporalRecallWarnings(targetIds: string[], scope?: MemoryScope): RecallWarning[] {
    const targetIdSet = new Set(targetIds);
    const warnings: RecallWarning[] = [];

    for (const targetId of targetIds) {
      for (const relation of this.getTemporalRelationsForTargetSync(targetId, scope)) {
        if (!isActiveTemporalRelation(relation)) {
          continue;
        }

        if (relation.relation === "contradicts") {
          const relatedId = relation.fromId === targetId ? relation.toId : relation.fromId;
          warnings.push(
            createRecallWarning({
              kind: "temporal_contradiction",
              targetId,
              message: `Memory item ${targetId} has an active contradiction with ${relatedId}.`,
              relatedIds: [relatedId],
              metadata: { relationId: relation.id },
            }),
          );
          continue;
        }

        if (relation.relation === "supersedes" && relation.toId === targetId) {
          warnings.push(
            createRecallWarning({
              kind: "temporal_supersession",
              targetId,
              message: `Memory item ${targetId} has been superseded by ${relation.fromId}.`,
              relatedIds: [relation.fromId],
              metadata: { relationId: relation.id },
            }),
          );
        }
      }
    }

    return dedupeWarnings(warnings).filter((warning) => targetIdSet.has(warning.targetId));
  }

  private getTemporalRelationsForTargetSync(
    targetId: string,
    scope?: MemoryScope,
  ): TemporalRelation[] {
    const rows = this.database
      .prepare(
        `SELECT id, scope_type, scope_id, from_id, to_id, relation, valid_from, valid_until,
          source_event_ids_json, metadata_json
         FROM temporal_relations
         WHERE (from_id = ? OR to_id = ?)
          AND relation IN ('contradicts', 'supersedes')${scopeClause(scope)}
         ORDER BY id ASC`,
      )
      .all(targetId, targetId, ...scopeValues(scope));

    return rows.map(temporalRelationFromRow);
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function timestampIsBeforeOrEqual(timestamp: string, nowMs: number): boolean {
  const parsed = Date.parse(timestamp);

  return Number.isNaN(parsed) || parsed <= nowMs;
}

function timestampIsAfterOrEqual(timestamp: string, nowMs: number): boolean {
  const parsed = Date.parse(timestamp);

  return Number.isNaN(parsed) || parsed >= nowMs;
}

function isActiveTemporalRelation(relation: TemporalRelation): boolean {
  const nowMs = Date.now();

  return (
    (relation.validFrom === undefined || timestampIsBeforeOrEqual(relation.validFrom, nowMs)) &&
    (relation.validUntil === undefined || timestampIsAfterOrEqual(relation.validUntil, nowMs))
  );
}

function dedupeWarnings(warnings: RecallWarning[]): RecallWarning[] {
  const seen = new Set<string>();
  const deduped: RecallWarning[] = [];

  for (const warning of warnings) {
    if (seen.has(warning.id)) {
      continue;
    }

    seen.add(warning.id);
    deduped.push(warning);
  }

  return deduped;
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

function temporalRelationFromRow(row: Record<string, unknown>): TemporalRelation {
  return {
    id: textValue(row, "id"),
    scope: {
      type: textValue(row, "scope_type") as TemporalRelation["scope"]["type"],
      id: textValue(row, "scope_id"),
    },
    fromId: textValue(row, "from_id"),
    toId: textValue(row, "to_id"),
    relation: textValue(row, "relation") as TemporalRelation["relation"],
    validFrom: optionalTextValue(row, "valid_from"),
    validUntil: optionalTextValue(row, "valid_until"),
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
