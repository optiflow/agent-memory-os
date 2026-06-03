import { describe, expect, it } from "vitest";
import type {
  CoreMemoryBlock,
  MemoryScope,
  MemoryStore,
  SearchResult,
  SessionState,
  VerificationRecord,
  WorkspaceResource,
} from "../src/index.js";
import { DefaultContextRouter } from "../src/index.js";

const scope: MemoryScope = { type: "workspace", id: "agent-memory-os" };

class FakeStore implements MemoryStore {
  seenScope: MemoryScope | undefined;
  seenSearchLimit = 0;
  seenWarningTargets: string[] = [];

  async addSemanticFact() {
    throw new Error("unused");
  }

  async appendEvidence() {
    throw new Error("unused");
  }

  async getCoreBlocks(requestScope?: MemoryScope): Promise<CoreMemoryBlock[]> {
    this.seenScope = requestScope;
    return [
      {
        id: "core_repo",
        label: "Repo",
        content: "Use local-first SQLite memory.",
        authority: 100,
        readOnly: false,
        updatedAt: "2026-06-03T00:00:00.000Z",
      },
    ];
  }

  async getActiveSessionStates(requestScope?: MemoryScope): Promise<SessionState[]> {
    this.seenScope = requestScope;
    return [
      {
        id: "session_active",
        scope,
        status: "active",
        currentGoal: "Implement V1.1",
        summary: "Session state should be compact and cited.",
        workingSet: ["packages/core"],
        updatedAt: "2026-06-03T00:00:00.000Z",
        sourceEventIds: ["event_state"],
      },
    ];
  }

  async getVerificationWarnings(targetIds: string[]): Promise<VerificationRecord[]> {
    this.seenWarningTargets = targetIds;
    return targetIds.includes("resource_docs")
      ? [
          {
            id: "verification_1",
            targetId: "resource_docs",
            status: "warning",
            checkedAt: "2026-06-03T00:00:00.000Z",
            message: "Resource may be stale.",
          },
        ]
      : [];
  }

  async listWorkspaceResources() {
    throw new Error("unused");
  }

  async recordVerification() {
    throw new Error("unused");
  }

  async search(
    _query: string,
    limit?: number,
    requestScope?: MemoryScope,
  ): Promise<SearchResult[]> {
    this.seenSearchLimit = limit ?? 0;
    this.seenScope = requestScope;
    return [
      {
        id: "resource_docs",
        kind: "resource",
        content: "Roadmap docs describe workspace resource memory.",
        score: 0.9,
        citation: "resource:repo://docs/v1-v2-roadmap.md",
      },
      {
        id: "fact_local",
        kind: "fact",
        content: "V1 stays local-first.",
        score: 0.8,
        citation: "fact:fact_local",
      },
    ];
  }

  async upsertCoreBlock() {
    throw new Error("unused");
  }

  async upsertSessionState() {
    throw new Error("unused");
  }

  async upsertWorkspaceResource(_resource: WorkspaceResource) {
    throw new Error("unused");
  }
}

describe("DefaultContextRouter", () => {
  it("routes auto policy through core, session state, resources, and warnings", async () => {
    const store = new FakeStore();
    const pack = await new DefaultContextRouter(store).pack({
      query: "roadmap resources",
      scope,
      budgetTokens: 300,
    });

    expect(store.seenScope).toEqual(scope);
    expect(store.seenSearchLimit).toBe(24);
    expect(pack.items.map((item) => item.id)).toContain("core_repo");
    expect(pack.items.map((item) => item.id)).toContain("session_active");
    expect(pack.items.map((item) => item.id)).toContain("resource_docs");
    expect(store.seenWarningTargets).toContain("resource_docs");
    expect(pack.verificationWarnings.map((warning) => warning.targetId)).toEqual(["resource_docs"]);
  });

  it("excludes resources from task policy", async () => {
    const pack = await new DefaultContextRouter(new FakeStore()).pack({
      query: "roadmap resources",
      scope,
      policy: "task",
    });

    expect(pack.items.map((item) => item.kind)).toContain("session");
    expect(pack.items.map((item) => item.kind)).not.toContain("resource");
  });

  it("excludes session state from workspace policy", async () => {
    const pack = await new DefaultContextRouter(new FakeStore()).pack({
      query: "roadmap resources",
      scope,
      policy: "workspace",
    });

    expect(pack.items.map((item) => item.kind)).toContain("resource");
    expect(pack.items.map((item) => item.kind)).not.toContain("session");
  });
});
