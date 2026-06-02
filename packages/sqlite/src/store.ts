import { DatabaseSync } from "node:sqlite";
import type {
  CoreMemoryBlock,
  EvidenceEvent,
  MemoryScope,
  MemoryStore,
  Metadata,
  SearchResult,
  SemanticFact,
  VerificationRecord,
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

function textValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];

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

function toFtsQuery(query: string): string {
  const tokens = query.match(/[A-Za-z0-9_]+/g) ?? [];
  return tokens.length > 0 ? tokens.join(" OR ") : "*";
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

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const ftsQuery = toFtsQuery(query);
    const evidenceRows = this.database
      .prepare(
        `SELECT evidence_events.id, evidence_events.kind, evidence_events.content,
          evidence_events.timestamp, evidence_events.metadata_json, bm25(evidence_fts) AS rank
         FROM evidence_fts
         JOIN evidence_events ON evidence_events.id = evidence_fts.id
         WHERE evidence_fts MATCH ?
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(ftsQuery, limit);
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
      .all(ftsQuery, limit);

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
    ]
      .toSorted((left, right) => right.score - left.score)
      .slice(0, limit);
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
}

function sqliteRankToScore(rank: number): number {
  return 1 / (1 + Math.abs(rank));
}
