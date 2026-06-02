import { describe, expect, it } from "vitest";
import { createContextPack, estimateTokens } from "../src/index.js";

describe("createContextPack", () => {
  it("prioritizes core memory and respects the token budget", () => {
    const pack = createContextPack(
      "formatter preference",
      [
        {
          id: "fact_1",
          kind: "fact",
          content: "The user prefers Biome as the only formatter and linter.",
          score: 0.8,
          citation: "fact:fact_1",
        },
        {
          id: "evidence_1",
          kind: "evidence",
          content: "A long low-value event should be skipped when the budget is tight.".repeat(20),
          score: 0.1,
          citation: "event:evidence_1",
        },
      ],
      [
        {
          id: "core_1",
          label: "Repo rule",
          content: "Use Biome only.",
          authority: 100,
          readOnly: false,
          updatedAt: "2026-06-02T00:00:00.000Z",
        },
      ],
      [],
      { budgetTokens: 60 },
    );

    expect(pack.items.map((item) => item.id)).toEqual(["core_1", "fact_1"]);
    expect(pack.estimatedTokens).toBeLessThanOrEqual(60);
    expect(pack.items[0]?.citation).toBe("core:core_1");
  });

  it("returns a positive token estimate for empty strings", () => {
    expect(estimateTokens("")).toBe(1);
  });

  it("treats invalid result bounds as an empty pack", () => {
    const pack = createContextPack(
      "bounds",
      [
        {
          id: "fact_1",
          kind: "fact",
          content: "A result that should be excluded by maxResults.",
          score: 1,
          citation: "fact:fact_1",
        },
      ],
      [],
      [],
      { budgetTokens: 100, maxResults: -1 },
    );

    expect(pack.items).toEqual([]);
    expect(pack.estimatedTokens).toBe(0);
  });
});
