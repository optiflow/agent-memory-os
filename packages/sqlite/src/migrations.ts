export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS core_blocks (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  authority INTEGER NOT NULL,
  read_only INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS evidence_fts
USING fts5(id UNINDEXED, content, metadata);

CREATE TABLE IF NOT EXISTS semantic_facts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  confidence REAL NOT NULL,
  valid_from TEXT,
  valid_until TEXT,
  source_event_ids_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS fact_fts
USING fts5(id UNINDEXED, content, metadata);

CREATE TABLE IF NOT EXISTS verification_records (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);
`;
