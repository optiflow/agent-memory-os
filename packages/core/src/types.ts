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

export type SearchResultKind = "core" | "evidence" | "fact";

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

export interface ContextPackItem {
  id: string;
  kind: SearchResultKind;
  content: string;
  citation: string;
  score: number;
  tokenEstimate: number;
}

export interface ContextPack {
  query: string;
  budgetTokens: number;
  estimatedTokens: number;
  generatedAt: string;
  items: ContextPackItem[];
  verificationWarnings: VerificationRecord[];
}

export interface ContextPackOptions {
  budgetTokens: number;
  includeCore?: boolean;
  maxResults?: number;
}

export interface ContextRouterRequest {
  query: string;
  scope?: MemoryScope;
  budgetTokens?: number;
}

export interface MemoryStore {
  addSemanticFact(fact: SemanticFact): Promise<SemanticFact>;
  appendEvidence(event: EvidenceEvent): Promise<EvidenceEvent>;
  getCoreBlocks(scope?: MemoryScope): Promise<CoreMemoryBlock[]>;
  recordVerification(record: VerificationRecord): Promise<VerificationRecord>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  upsertCoreBlock(block: CoreMemoryBlock): Promise<CoreMemoryBlock>;
}

export interface ContextRouter {
  pack(request: ContextRouterRequest): Promise<ContextPack>;
}

export interface TemporalRelation {
  id: string;
  fromId: string;
  toId: string;
  relation: "contradicts" | "derives" | "extends" | "supports" | "supersedes";
  validFrom?: string;
  validUntil?: string;
  sourceEventIds: string[];
  metadata?: Metadata;
}
