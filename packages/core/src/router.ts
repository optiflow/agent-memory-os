import { createContextPack } from "./contextPacker.js";
import type {
  ContextPack,
  ContextRouter,
  ContextRouterPolicy,
  ContextRouterRequest,
  MemoryStore,
  SearchResult,
  SessionState,
} from "./types.js";

function includesTaskState(policy: ContextRouterPolicy): boolean {
  return policy === "auto" || policy === "task";
}

function includesWorkspaceResources(policy: ContextRouterPolicy): boolean {
  return policy === "auto" || policy === "workspace";
}

function sessionStateToResult(state: SessionState): SearchResult {
  return {
    id: state.id,
    kind: "session",
    content: `Current goal: ${state.currentGoal}\nStatus: ${state.status}\nSummary: ${
      state.summary
    }\nWorking set: ${state.workingSet.join(", ")}`,
    score: state.status === "active" ? 1.3 : 1.1,
    citation: `session:${state.id}`,
    timestamp: state.updatedAt,
    metadata: state.metadata,
  };
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of results) {
    const key = `${result.kind}:${result.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

export class DefaultContextRouter implements ContextRouter {
  constructor(private readonly store: MemoryStore) {}

  async pack(request: ContextRouterRequest): Promise<ContextPack> {
    const budgetTokens = request.budgetTokens ?? 1200;
    const policy = request.policy ?? "auto";
    const [coreBlocks, sessionStates, searchResults] = await Promise.all([
      this.store.getCoreBlocks(request.scope),
      includesTaskState(policy) ? this.store.getActiveSessionStates(request.scope) : [],
      this.store.search(request.query, includesWorkspaceResources(policy) ? 24 : 16, request.scope),
    ]);
    const routedResults = dedupeResults([
      ...sessionStates.map(sessionStateToResult),
      ...searchResults.filter(
        (result) =>
          (includesWorkspaceResources(policy) || result.kind !== "resource") &&
          (includesTaskState(policy) || result.kind !== "session"),
      ),
    ]);

    const draftPack = createContextPack(request.query, routedResults, coreBlocks, [], {
      budgetTokens,
      includeCore: true,
      maxResults: 16,
    });
    const verificationWarnings = await this.store.getVerificationWarnings(
      draftPack.items.map((item) => item.id),
    );

    return {
      ...draftPack,
      verificationWarnings,
    };
  }
}
