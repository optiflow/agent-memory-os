import type {
  ContextPack,
  CoreMemoryBlock,
  EvidenceEvent,
  SemanticFact,
} from "@agent-memory-os/core";

export type BenchmarkTrack = "conversation" | "environment" | "write_read";

export interface BenchmarkSeed {
  coreBlocks: CoreMemoryBlock[];
  evidenceEvents: EvidenceEvent[];
  semanticFacts: SemanticFact[];
}

export interface BenchmarkCase {
  id: string;
  track: BenchmarkTrack;
  title: string;
  query: string;
  budgetTokens: number;
  expectedItemIds: string[];
  rejectedItemIds: string[];
  seed: BenchmarkSeed;
}

export interface BenchmarkCaseMetrics {
  recallAtK: number;
  irrelevantInjectionRate: number;
  citationCoverage: number;
  budgetCompliance: number;
  evidenceCoverage: number;
  contextPackLatencyMs: number;
  overallScore: number;
}

export interface BenchmarkCaseResult extends BenchmarkCaseMetrics {
  id: string;
  track: BenchmarkTrack;
  title: string;
  includedItemIds: string[];
  missingExpectedItemIds: string[];
  rejectedItemIdsFound: string[];
  contextPack: ContextPack;
}

export interface BenchmarkReport {
  generatedAt: string;
  caseCount: number;
  metrics: BenchmarkCaseMetrics;
  cases: BenchmarkCaseResult[];
}
