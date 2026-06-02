import { describe, expect, it } from "vitest";
import { SQLiteMemoryStore } from "../src/index.js";

describe("SQLiteMemoryStore", () => {
  it("appends evidence, stores facts, and searches with FTS", async () => {
    const store = new SQLiteMemoryStore();

    await store.appendEvidence({
      id: "event_1",
      kind: "explicit_memory",
      actor: "user",
      content: "The user prefers Biome over ESLint and Prettier.",
      timestamp: "2026-06-02T00:00:00.000Z",
      scope: { type: "workspace", id: "agent-memory-os" },
    });
    await store.addSemanticFact({
      id: "fact_1",
      subject: "user",
      predicate: "prefers",
      object: "Biome as the only linter and formatter",
      confidence: 0.95,
      sourceEventIds: ["event_1"],
    });

    const results = await store.search("Biome formatter", 5);

    expect(results.map((result) => result.id)).toContain("event_1");
    expect(results.map((result) => result.id)).toContain("fact_1");

    store.close();
  });

  it("upserts core memory blocks by authority", async () => {
    const store = new SQLiteMemoryStore();

    await store.upsertCoreBlock({
      id: "repo_rule",
      label: "Repo rule",
      content: "Use SQLite + FTS for v1.",
      authority: 90,
      readOnly: false,
      updatedAt: "2026-06-02T00:00:00.000Z",
    });
    await store.upsertCoreBlock({
      id: "safety_rule",
      label: "Safety rule",
      content: "Do not inject unverifiable stale memory.",
      authority: 100,
      readOnly: true,
      updatedAt: "2026-06-02T00:00:00.000Z",
    });

    const blocks = await store.getCoreBlocks();

    expect(blocks.map((block) => block.id)).toEqual(["safety_rule", "repo_rule"]);

    store.close();
  });

  it("returns no search results for empty FTS input or non-positive limits", async () => {
    const store = new SQLiteMemoryStore();

    try {
      await store.appendEvidence({
        id: "event_1",
        kind: "explicit_memory",
        actor: "user",
        content: "The user prefers Biome over ESLint and Prettier.",
        timestamp: "2026-06-02T00:00:00.000Z",
        scope: { type: "workspace", id: "agent-memory-os" },
      });

      await expect(store.search("?!?", 5)).resolves.toEqual([]);
      await expect(store.search("Biome", 0)).resolves.toEqual([]);
    } finally {
      store.close();
    }
  });
});
