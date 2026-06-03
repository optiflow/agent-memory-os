export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type Metadata = Record<string, JsonValue>;

export type MemoryScopeType = "global" | "user" | "workspace" | "project" | "session";

export interface MemoryScope {
  type: MemoryScopeType;
  id: string;
}

export type EvidenceKind =
  | "assistant_message"
  | "explicit_memory"
  | "file_edit"
  | "system_event"
  | "tool_call"
  | "tool_result"
  | "user_message";

export interface EvidenceEvent {
  id: string;
  kind: EvidenceKind;
  scope: MemoryScope;
  actor: "assistant" | "system" | "tool" | "user";
  content: string;
  timestamp: string;
  metadata?: Metadata;
}

export interface CoreMemoryBlock {
  id: string;
  label: string;
  content: string;
  authority: number;
  readOnly: boolean;
  updatedAt: string;
  metadata?: Metadata;
}

export interface SemanticFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  sourceEventIds: string[];
  validFrom?: string;
  validUntil?: string;
  metadata?: Metadata;
}

export type SessionStateStatus = "active" | "blocked" | "complete";

export interface SessionState {
  id: string;
  scope: MemoryScope;
  status: SessionStateStatus;
  currentGoal: string;
  summary: string;
  workingSet: string[];
  updatedAt: string;
  sourceEventIds: string[];
  metadata?: Metadata;
}

export type WorkspaceResourceKind = "doc" | "file" | "note" | "other" | "url";

export interface WorkspaceResource {
  uri: string;
  scope: MemoryScope;
  kind: WorkspaceResourceKind;
  title: string;
  content: string;
  parentUri?: string;
  updatedAt: string;
  sourceEventIds: string[];
  metadata?: Metadata;
}

export type SearchResultKind = "core" | "evidence" | "fact" | "resource" | "session";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  content: string;
  score: number;
  citation: string;
  timestamp?: string;
  metadata?: Metadata;
}

export type VerificationStatus = "failed" | "passed" | "stale" | "unknown" | "warning";

export interface VerificationRecord {
  id: string;
  targetId: string;
  status: VerificationStatus;
  checkedAt: string;
  message: string;
  metadata?: Metadata;
}

export type RecallWarningKind =
  | "branch_drift"
  | "citation_missing"
  | "commit_drift"
  | "file_hash_mismatch"
  | "file_missing"
  | "temporal_contradiction"
  | "temporal_supersession";

export interface RecallWarning {
  id: string;
  kind: RecallWarningKind;
  targetId: string;
  severity: "info" | "warning";
  message: string;
  generatedAt: string;
  relatedIds?: string[];
  metadata?: Metadata;
}

export interface ContextPackItem {
  id: string;
  kind: SearchResultKind;
  content: string;
  citation: string;
  score: number;
  tokenEstimate: number;
  metadata?: Metadata;
}

export interface ContextPack {
  query: string;
  budgetTokens: number;
  estimatedTokens: number;
  generatedAt: string;
  items: ContextPackItem[];
  recallWarnings: RecallWarning[];
  verificationWarnings: VerificationRecord[];
}

export interface ContextPackOptions {
  budgetTokens: number;
  includeCore?: boolean;
  maxResults?: number;
}

export type ContextRouterPolicy = "auto" | "task" | "workspace";

export interface ContextRouterRequest {
  query: string;
  scope?: MemoryScope;
  budgetTokens?: number;
  policy?: ContextRouterPolicy;
  workspacePath?: string;
}

export interface MemoryStore {
  addSemanticFact(fact: SemanticFact): Promise<SemanticFact>;
  addTemporalRelation(relation: TemporalRelation): Promise<TemporalRelation>;
  appendEvidence(event: EvidenceEvent): Promise<EvidenceEvent>;
  getActiveSessionStates(scope?: MemoryScope): Promise<SessionState[]>;
  getCoreBlocks(scope?: MemoryScope): Promise<CoreMemoryBlock[]>;
  getRecallWarnings(targetIds: string[], scope?: MemoryScope): Promise<RecallWarning[]>;
  getTemporalRelationsForTarget(
    targetId: string,
    options?: {
      relation?: TemporalRelation["relation"];
      scope?: MemoryScope;
      limit?: number;
    },
  ): Promise<TemporalRelation[]>;
  getVerificationWarnings(targetIds: string[]): Promise<VerificationRecord[]>;
  listWorkspaceResources(options?: {
    scope?: MemoryScope;
    parentUri?: string;
    limit?: number;
  }): Promise<WorkspaceResource[]>;
  recordVerification(record: VerificationRecord): Promise<VerificationRecord>;
  search(query: string, limit?: number, scope?: MemoryScope): Promise<SearchResult[]>;
  upsertCoreBlock(block: CoreMemoryBlock): Promise<CoreMemoryBlock>;
  upsertSessionState(state: SessionState): Promise<SessionState>;
  upsertWorkspaceResource(resource: WorkspaceResource): Promise<WorkspaceResource>;
}

export interface ContextRouter {
  pack(request: ContextRouterRequest): Promise<ContextPack>;
}

export interface TemporalRelation {
  id: string;
  scope: MemoryScope;
  fromId: string;
  toId: string;
  relation: "contradicts" | "derives" | "extends" | "supports" | "supersedes";
  validFrom?: string;
  validUntil?: string;
  sourceEventIds: string[];
  metadata?: Metadata;
}
