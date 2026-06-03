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

CREATE TABLE IF NOT EXISTS session_states (
  id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_goal TEXT NOT NULL,
  summary TEXT NOT NULL,
  working_set_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source_event_ids_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  PRIMARY KEY (scope_type, scope_id, id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS session_state_fts
USING fts5(id UNINDEXED, scope_type UNINDEXED, scope_id UNINDEXED, content, metadata);

CREATE TABLE IF NOT EXISTS workspace_resources (
  uri TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_uri TEXT,
  updated_at TEXT NOT NULL,
  source_event_ids_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  PRIMARY KEY (scope_type, scope_id, uri)
);

CREATE VIRTUAL TABLE IF NOT EXISTS workspace_resource_fts
USING fts5(uri UNINDEXED, scope_type UNINDEXED, scope_id UNINDEXED, content, metadata);

CREATE TABLE IF NOT EXISTS temporal_relations (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  valid_from TEXT,
  valid_until TEXT,
  source_event_ids_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS temporal_relations_scope_from_idx
ON temporal_relations(scope_type, scope_id, from_id, relation);

CREATE INDEX IF NOT EXISTS temporal_relations_scope_to_idx
ON temporal_relations(scope_type, scope_id, to_id, relation);
`;
