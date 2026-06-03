import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { DefaultContextRouter } from "@agent-memory-os/core";
import { SQLiteMemoryStore } from "@agent-memory-os/sqlite";
import type {
  BenchmarkCase,
  BenchmarkCaseMetrics,
  BenchmarkCaseResult,
  BenchmarkReport,
} from "./types.js";

const CITATION_PATTERN = /^(core|event|fact|resource|session):\S+$/;
const DEFAULT_REPORT_PATH = fileURLToPath(new URL("../reports/eval.json", import.meta.url));

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 1;
  }

  return numerator / denominator;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

export async function seedBenchmarkCase(
  store: SQLiteMemoryStore,
  benchmarkCase: BenchmarkCase,
): Promise<void> {
  for (const block of benchmarkCase.seed.coreBlocks) {
    await store.upsertCoreBlock(block);
  }

  for (const event of benchmarkCase.seed.evidenceEvents) {
    await store.appendEvidence(event);
  }

  for (const fact of benchmarkCase.seed.semanticFacts) {
    await store.addSemanticFact(fact);
  }

  for (const state of benchmarkCase.seed.sessionStates ?? []) {
    await store.upsertSessionState(state);
  }

  for (const relation of benchmarkCase.seed.temporalRelations ?? []) {
    await store.addTemporalRelation(relation);
  }

  for (const resource of benchmarkCase.seed.workspaceResources ?? []) {
    await store.upsertWorkspaceResource(resource);
  }
}

function scoreBenchmarkCase(
  benchmarkCase: BenchmarkCase,
  contextPack: BenchmarkCaseResult["contextPack"],
  contextPackLatencyMs: number,
): BenchmarkCaseResult {
  const includedItemIds = contextPack.items.map((item) => item.id);
  const includedIdSet = new Set(includedItemIds);
  const missingExpectedItemIds = benchmarkCase.expectedItemIds.filter(
    (itemId) => !includedIdSet.has(itemId),
  );
  const rejectedItemIdsFound = benchmarkCase.rejectedItemIds.filter((itemId) =>
    includedIdSet.has(itemId),
  );
  const factById = new Map(
    benchmarkCase.seed.semanticFacts.map((fact) => [fact.id, fact] as const),
  );
  const evidenceIds = new Set(benchmarkCase.seed.evidenceEvents.map((event) => event.id));
  const includedFacts = includedItemIds
    .map((itemId) => factById.get(itemId))
    .filter((fact) => fact !== undefined);
  const coveredFacts = includedFacts.filter((fact) =>
    fact.sourceEventIds.every((eventId) => evidenceIds.has(eventId)),
  );
  const citationCoverage = ratio(
    contextPack.items.filter((item) => CITATION_PATTERN.test(item.citation)).length,
    contextPack.items.length,
  );
  const budgetCompliance =
    contextPack.estimatedTokens <= benchmarkCase.budgetTokens &&
    contextPack.items.reduce((total, item) => total + item.tokenEstimate, 0) <=
      benchmarkCase.budgetTokens
      ? 1
      : 0;
  const recallAtK = ratio(
    benchmarkCase.expectedItemIds.length - missingExpectedItemIds.length,
    benchmarkCase.expectedItemIds.length,
  );
  const irrelevantInjectionRate = ratio(rejectedItemIdsFound.length, contextPack.items.length);
  const evidenceCoverage = ratio(coveredFacts.length, includedFacts.length);
  const overallScore = average([
    recallAtK,
    1 - irrelevantInjectionRate,
    citationCoverage,
    budgetCompliance,
    evidenceCoverage,
  ]);

  return {
    id: benchmarkCase.id,
    track: benchmarkCase.track,
    title: benchmarkCase.title,
    recallAtK: roundMetric(recallAtK),
    irrelevantInjectionRate: roundMetric(irrelevantInjectionRate),
    citationCoverage: roundMetric(citationCoverage),
    budgetCompliance: roundMetric(budgetCompliance),
    evidenceCoverage: roundMetric(evidenceCoverage),
    contextPackLatencyMs: roundMetric(contextPackLatencyMs),
    overallScore: roundMetric(overallScore),
    includedItemIds,
    missingExpectedItemIds,
    rejectedItemIdsFound,
    contextPack,
  };
}

export async function runBenchmarkCase(benchmarkCase: BenchmarkCase): Promise<BenchmarkCaseResult> {
  const store = new SQLiteMemoryStore();

  try {
    await seedBenchmarkCase(store, benchmarkCase);

    const router = new DefaultContextRouter(store);
    const startedAt = performance.now();
    const contextPack = await router.pack({
      query: benchmarkCase.query,
      budgetTokens: benchmarkCase.budgetTokens,
      policy: benchmarkCase.policy,
    });
    const contextPackLatencyMs = performance.now() - startedAt;

    return scoreBenchmarkCase(benchmarkCase, contextPack, contextPackLatencyMs);
  } finally {
    store.close();
  }
}

function aggregateMetrics(cases: BenchmarkCaseResult[]): BenchmarkCaseMetrics {
  return {
    recallAtK: roundMetric(average(cases.map((result) => result.recallAtK))),
    irrelevantInjectionRate: roundMetric(
      average(cases.map((result) => result.irrelevantInjectionRate)),
    ),
    citationCoverage: roundMetric(average(cases.map((result) => result.citationCoverage))),
    budgetCompliance: roundMetric(average(cases.map((result) => result.budgetCompliance))),
    evidenceCoverage: roundMetric(average(cases.map((result) => result.evidenceCoverage))),
    contextPackLatencyMs: roundMetric(average(cases.map((result) => result.contextPackLatencyMs))),
    overallScore: roundMetric(average(cases.map((result) => result.overallScore))),
  };
}

export async function runBenchmarkCases(benchmarkCases: BenchmarkCase[]): Promise<BenchmarkReport> {
  const results: BenchmarkCaseResult[] = [];

  for (const benchmarkCase of benchmarkCases) {
    results.push(await runBenchmarkCase(benchmarkCase));
  }

  return {
    generatedAt: new Date().toISOString(),
    caseCount: results.length,
    metrics: aggregateMetrics(results),
    cases: results,
  };
}

export function writeBenchmarkReport(
  report: BenchmarkReport,
  outputPath = DEFAULT_REPORT_PATH,
): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}
