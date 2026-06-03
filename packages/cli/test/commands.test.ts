import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCommandName, runCommand } from "../src/commands.js";

describe("runCommand", () => {
  it("seeds sample memory and returns a bounded context pack", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-memory-os-"));
    const dbPath = join(dir, "memory.sqlite");

    try {
      await runCommand("seed-sample", { dbPath });
      const output = await runCommand("context-pack", {
        dbPath,
        query: "Biome formatter",
        budgetTokens: 400,
      });

      expect(JSON.stringify(output)).toContain("Biome");
      expect(JSON.stringify(output)).toContain("contextPack");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects unknown commands", () => {
    expect(() => parseCommandName("missing")).toThrow('Unknown command "missing"');
  });

  it("rejects unsupported evidence kinds", async () => {
    await expect(
      runCommand("remember", {
        content: "Remember this.",
        kind: "unsupported",
      }),
    ).rejects.toThrow('Expected "kind" to be a supported evidence kind');
  });

  it("rejects non-positive limits", async () => {
    await expect(
      runCommand("search", {
        query: "Biome",
        limit: 0,
      }),
    ).rejects.toThrow('Expected "limit" to be a positive integer');
  });

  it("upserts session state through an audited CLI projection write", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-memory-os-"));
    const dbPath = join(dir, "memory.sqlite");

    try {
      const output = await runCommand("upsert-session-state", {
        dbPath,
        id: "session_1",
        currentGoal: "Implement V1.1",
        summary: "Active task state should be visible to context packs.",
        workingSet: ["packages/core", "packages/cli"],
      });
      const pack = await runCommand("context-pack", {
        dbPath,
        query: "active task state",
        policy: "task",
      });

      expect(JSON.stringify(output)).toContain("event_");
      expect(JSON.stringify(pack)).toContain("session_1");
      expect(JSON.stringify(pack)).toContain("Implement V1.1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("upserts and browses workspace resources through the CLI", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-memory-os-"));
    const dbPath = join(dir, "memory.sqlite");

    try {
      await runCommand("upsert-resource", {
        dbPath,
        uri: "repo://apps/docs/src/content/docs",
        title: "Docs",
        content: "Documentation root.",
        kind: "doc",
      });
      await runCommand("upsert-resource", {
        dbPath,
        uri: "repo://apps/docs/src/content/docs/roadmap/v1-v2-roadmap.md",
        parentUri: "repo://apps/docs/src/content/docs",
        title: "Roadmap",
        content: "Workspace resources are browseable and searchable.",
        kind: "doc",
      });

      const browse = await runCommand("browse-resources", {
        dbPath,
        parentUri: "repo://apps/docs/src/content/docs",
      });
      const pack = await runCommand("context-pack", {
        dbPath,
        query: "browseable searchable",
        policy: "workspace",
      });

      expect(JSON.stringify(browse)).toContain(
        "repo://apps/docs/src/content/docs/roadmap/v1-v2-roadmap.md",
      );
      expect(JSON.stringify(pack)).toContain(
        "resource:repo://apps/docs/src/content/docs/roadmap/v1-v2-roadmap.md",
      );
      expect(JSON.stringify(pack)).not.toContain("sessionState");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid context policies", async () => {
    await expect(
      runCommand("context-pack", {
        query: "Biome",
        policy: "graph",
      }),
    ).rejects.toThrow('Expected "policy" to be auto, task, or workspace');
  });
});
