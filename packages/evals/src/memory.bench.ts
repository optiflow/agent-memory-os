import { DefaultContextRouter } from "@agent-memory-os/core";
import { SQLiteMemoryStore } from "@agent-memory-os/sqlite";
import { afterAll, bench, describe } from "vitest";
import { benchmarkCases } from "./fixtures.js";
import { seedBenchmarkCase } from "./runner.js";
import type { BenchmarkCase } from "./types.js";

function requireBenchmarkCase(id: string): BenchmarkCase {
  const benchmarkCase = benchmarkCases.find((candidate) => candidate.id === id);

  if (!benchmarkCase) {
    throw new Error(`Missing benchmark case "${id}"`);
  }

  return benchmarkCase;
}

const conversationCase = requireBenchmarkCase("conversation-preferences");
const environmentCase = requireBenchmarkCase("environment-action-memory");
const searchStore = new SQLiteMemoryStore();
const packStore = new SQLiteMemoryStore();

await seedBenchmarkCase(searchStore, conversationCase);

for (const benchmarkCase of benchmarkCases) {
  await seedBenchmarkCase(packStore, benchmarkCase);
}

const router = new DefaultContextRouter(packStore);

afterAll(() => {
  searchStore.close();
  packStore.close();
});

describe("local memory benchmark timings", () => {
  bench(
    "seed benchmark fixture",
    async () => {
      const store = new SQLiteMemoryStore();

      try {
        await seedBenchmarkCase(store, conversationCase);
      } finally {
        store.close();
      }
    },
    { time: 300, warmupTime: 100 },
  );

  bench(
    "SQLite FTS search",
    async () => {
      await searchStore.search(conversationCase.query, 10);
    },
    { time: 300, warmupTime: 100 },
  );

  bench(
    "context pack generation",
    async () => {
      await router.pack({
        query: environmentCase.query,
        budgetTokens: environmentCase.budgetTokens,
      });
    },
    { time: 300, warmupTime: 100 },
  );
});
