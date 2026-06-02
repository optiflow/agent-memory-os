import { createContextPack } from "./contextPacker.js";
import type { ContextPack, ContextRouter, ContextRouterRequest, MemoryStore } from "./types.js";

export class DefaultContextRouter implements ContextRouter {
  constructor(private readonly store: MemoryStore) {}

  async pack(request: ContextRouterRequest): Promise<ContextPack> {
    const budgetTokens = request.budgetTokens ?? 1200;
    const [coreBlocks, searchResults] = await Promise.all([
      this.store.getCoreBlocks(request.scope),
      this.store.search(request.query, 24),
    ]);

    return createContextPack(request.query, searchResults, coreBlocks, [], {
      budgetTokens,
      includeCore: true,
      maxResults: 16,
    });
  }
}
