import type {
  ContextPack,
  ContextPackOptions,
  CoreMemoryBlock,
  SearchResult,
  VerificationRecord,
} from "./types.js";

const DEFAULT_BUDGET_TOKENS = 1200;
const DEFAULT_MAX_RESULTS = 12;

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function createContextPack(
  query: string,
  searchResults: SearchResult[],
  coreBlocks: CoreMemoryBlock[],
  verificationWarnings: VerificationRecord[],
  options: Partial<ContextPackOptions> = {},
): ContextPack {
  const budgetTokens = normalizeNonNegativeInteger(options.budgetTokens ?? DEFAULT_BUDGET_TOKENS);
  const maxResults = normalizeNonNegativeInteger(options.maxResults ?? DEFAULT_MAX_RESULTS);
  const includeCore = options.includeCore ?? true;
  const candidates: SearchResult[] = [];

  if (includeCore) {
    for (const block of coreBlocks) {
      candidates.push({
        id: block.id,
        kind: "core",
        content: `${block.label}: ${block.content}`,
        score: 1 + block.authority / 100,
        citation: `core:${block.id}`,
        timestamp: block.updatedAt,
        metadata: block.metadata,
      });
    }
  }

  candidates.push(...searchResults);

  const ordered = candidates
    .slice()
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.id.localeCompare(right.id);
    })
    .slice(0, maxResults);

  let estimatedTokens = 0;
  const items: ContextPack["items"] = [];

  for (const item of ordered) {
    const tokenEstimate = estimateTokens(item.content);

    if (estimatedTokens + tokenEstimate > budgetTokens) {
      continue;
    }

    estimatedTokens += tokenEstimate;
    items.push({
      id: item.id,
      kind: item.kind,
      content: item.content,
      citation: item.citation,
      score: item.score,
      tokenEstimate,
    });
  }

  return {
    query,
    budgetTokens,
    estimatedTokens,
    generatedAt: new Date().toISOString(),
    items,
    verificationWarnings,
  };
}
