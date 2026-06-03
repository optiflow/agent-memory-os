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

  it("stores active session state by scope and returns cited search results", async () => {
    const store = new SQLiteMemoryStore();

    try {
      await store.upsertSessionState({
        id: "session_1",
        scope: { type: "workspace", id: "agent-memory-os" },
        status: "active",
        currentGoal: "Implement V1.1 session state.",
        summary: "Session state keeps compact current-task memory.",
        workingSet: ["packages/core", "packages/sqlite"],
        updatedAt: "2026-06-03T00:00:00.000Z",
        sourceEventIds: ["event_1"],
      });
      await store.upsertSessionState({
        id: "session_1",
        scope: { type: "workspace", id: "other" },
        status: "active",
        currentGoal: "Other workspace task.",
        summary: "This must not leak across scopes.",
        workingSet: [],
        updatedAt: "2026-06-03T00:00:00.000Z",
        sourceEventIds: ["event_2"],
      });

      const states = await store.getActiveSessionStates({
        type: "workspace",
        id: "agent-memory-os",
      });
      const results = await store.search("compact current task", 5, {
        type: "workspace",
        id: "agent-memory-os",
      });

      expect(states.map((state) => state.currentGoal)).toEqual(["Implement V1.1 session state."]);
      expect(results.map((result) => result.citation)).toContain("session:session_1");
      expect(JSON.stringify(results)).not.toContain("Other workspace task");
    } finally {
      store.close();
    }
  });

  it("stores workspace resources by scope, parent, and FTS content", async () => {
    const store = new SQLiteMemoryStore();

    try {
      await store.upsertWorkspaceResource({
        uri: "repo://docs",
        scope: { type: "workspace", id: "agent-memory-os" },
        kind: "doc",
        title: "Docs root",
        content: "Root documentation resource.",
        updatedAt: "2026-06-03T00:00:00.000Z",
        sourceEventIds: ["event_1"],
      });
      await store.upsertWorkspaceResource({
        uri: "repo://docs/v1-v2-roadmap.md",
        parentUri: "repo://docs",
        scope: { type: "workspace", id: "agent-memory-os" },
        kind: "doc",
        title: "Roadmap",
        content: "The roadmap describes browseable workspace resources.",
        updatedAt: "2026-06-03T00:00:00.000Z",
        sourceEventIds: ["event_1"],
      });
      await store.upsertWorkspaceResource({
        uri: "repo://docs/v1-v2-roadmap.md",
        scope: { type: "workspace", id: "other" },
        kind: "doc",
        title: "Other roadmap",
        content: "This scoped resource should not leak.",
        updatedAt: "2026-06-03T00:00:00.000Z",
        sourceEventIds: ["event_2"],
      });

      const children = await store.listWorkspaceResources({
        scope: { type: "workspace", id: "agent-memory-os" },
        parentUri: "repo://docs",
      });
      const results = await store.search("browseable workspace resources", 5, {
        type: "workspace",
        id: "agent-memory-os",
      });

      expect(children.map((resource) => resource.uri)).toEqual(["repo://docs/v1-v2-roadmap.md"]);
      expect(results.map((result) => result.citation)).toContain(
        "resource:repo://docs/v1-v2-roadmap.md",
      );
      expect(JSON.stringify(results)).not.toContain("Other roadmap");
    } finally {
      store.close();
    }
  });

  it("returns latest non-passed verification warnings for requested targets", async () => {
    const store = new SQLiteMemoryStore();

    try {
      await store.recordVerification({
        id: "verification_old",
        targetId: "fact_1",
        status: "warning",
        checkedAt: "2026-06-03T00:00:00.000Z",
        message: "Old warning.",
      });
      await store.recordVerification({
        id: "verification_new",
        targetId: "fact_1",
        status: "passed",
        checkedAt: "2026-06-03T01:00:00.000Z",
        message: "Now verified.",
      });
      await store.recordVerification({
        id: "verification_stale",
        targetId: "resource_1",
        status: "stale",
        checkedAt: "2026-06-03T01:00:00.000Z",
        message: "Resource changed.",
      });

      const warnings = await store.getVerificationWarnings(["fact_1", "resource_1"]);

      expect(warnings.map((warning) => warning.id)).toEqual(["verification_stale"]);
    } finally {
      store.close();
    }
  });
});
