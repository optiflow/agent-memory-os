import { describe, expect, it } from "vitest";
import { benchmarkCases } from "./fixtures.js";
import { runBenchmarkCases, writeBenchmarkReport } from "./runner.js";

describe("local memory benchmark evaluation", () => {
  it("meets deterministic local memory benchmark expectations", async () => {
    const report = await runBenchmarkCases(benchmarkCases);

    writeBenchmarkReport(report);

    expect(report.caseCount).toBe(benchmarkCases.length);
    expect(report.metrics.recallAtK).toBe(1);
    expect(report.metrics.irrelevantInjectionRate).toBe(0);
    expect(report.metrics.citationCoverage).toBe(1);
    expect(report.metrics.budgetCompliance).toBe(1);
    expect(report.metrics.evidenceCoverage).toBe(1);
    expect(report.metrics.overallScore).toBe(1);
  });
});
