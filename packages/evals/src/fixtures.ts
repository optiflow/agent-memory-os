import type { BenchmarkCase, BenchmarkSeed } from "./types.js";

const timestamp = "2026-06-03T00:00:00.000Z";
const workspaceScope = { type: "workspace" as const, id: "agent-memory-os" };

const conversationSeed: BenchmarkSeed = {
  coreBlocks: [
    {
      id: "core_repo_rules",
      label: "Repo rules",
      content: "Use TypeScript, Turborepo, Biome, SQLite, and a thin Hermes adapter.",
      authority: 100,
      readOnly: false,
      updatedAt: timestamp,
    },
  ],
  evidenceEvents: [
    {
      id: "event_biome_preference",
      kind: "explicit_memory",
      actor: "user",
      content: "User prefers Biome as the only linter and formatter.",
      timestamp,
      scope: workspaceScope,
    },
    {
      id: "event_conversation_unrelated",
      kind: "user_message",
      actor: "user",
      content: "The local lunch note mentions a city guide and a cafe queue.",
      timestamp,
      scope: workspaceScope,
    },
  ],
  semanticFacts: [
    {
      id: "fact_biome_preference",
      subject: "user",
      predicate: "prefers",
      object: "Biome as the only linter and formatter",
      confidence: 0.95,
      sourceEventIds: ["event_biome_preference"],
    },
    {
      id: "fact_conversation_unrelated",
      subject: "workspace",
      predicate: "mentions",
      object: "local lunch planning",
      confidence: 0.8,
      sourceEventIds: ["event_conversation_unrelated"],
    },
  ],
};

const environmentSeed: BenchmarkSeed = {
  coreBlocks: [
    {
      id: "core_ci_gate",
      label: "CI gate",
      content: "Use pnpm run ci as the full local gate before finalizing implementation work.",
      authority: 95,
      readOnly: false,
      updatedAt: timestamp,
    },
  ],
  evidenceEvents: [
    {
      id: "event_ci_tool_result",
      kind: "tool_result",
      actor: "tool",
      content: "pnpm run ci executes lint, typecheck, tests, build, and adapter checks.",
      timestamp,
      scope: workspaceScope,
    },
    {
      id: "event_benchmark_file_edit",
      kind: "file_edit",
      actor: "assistant",
      content: "Benchmark automation should live in packages/evals and write reports locally.",
      timestamp,
      scope: workspaceScope,
    },
    {
      id: "event_environment_unrelated",
      kind: "system_event",
      actor: "system",
      content: "A scratch reminder recorded window placement for a notes app.",
      timestamp,
      scope: workspaceScope,
    },
  ],
  semanticFacts: [
    {
      id: "fact_ci_gate",
      subject: "repo",
      predicate: "verifies_with",
      object:
        "pnpm run ci for lint, typecheck, tests, build, adapter checks, evals, and benchmarks",
      confidence: 0.9,
      sourceEventIds: ["event_ci_tool_result", "event_benchmark_file_edit"],
    },
  ],
};

const writeReadSeed: BenchmarkSeed = {
  coreBlocks: [
    {
      id: "core_context7_rule",
      label: "Docs rule",
      content: "Use Context7 before changing Turborepo or Vitest configuration.",
      authority: 90,
      readOnly: false,
      updatedAt: timestamp,
    },
  ],
  evidenceEvents: [
    {
      id: "event_context7_docs",
      kind: "system_event",
      actor: "system",
      content:
        "Context7 is the preferred current documentation source for Turborepo and Vitest changes.",
      timestamp,
      scope: workspaceScope,
    },
    {
      id: "event_write_read_unrelated",
      kind: "assistant_message",
      actor: "assistant",
      content: "The draft handoff noted that social memory remains out of v1 scope.",
      timestamp,
      scope: workspaceScope,
    },
  ],
  semanticFacts: [
    {
      id: "fact_context7_docs",
      subject: "agent-memory-os",
      predicate: "uses_docs_source",
      object: "Context7 for current Turborepo and Vitest documentation",
      confidence: 0.95,
      sourceEventIds: ["event_context7_docs"],
    },
  ],
};

export const benchmarkCases: BenchmarkCase[] = [
  {
    id: "conversation-preferences",
    track: "conversation",
    title: "Conversation memory recalls stable user and repo preferences",
    query: "Biome formatter preference TypeScript repo rules",
    budgetTokens: 500,
    expectedItemIds: ["core_repo_rules", "event_biome_preference", "fact_biome_preference"],
    rejectedItemIds: ["event_conversation_unrelated", "fact_conversation_unrelated"],
    seed: conversationSeed,
  },
  {
    id: "environment-action-memory",
    track: "environment",
    title: "Environment memory recalls repo commands and action evidence",
    query: "pnpm run ci adapter checks benchmark reports",
    budgetTokens: 520,
    expectedItemIds: ["core_ci_gate", "event_ci_tool_result", "fact_ci_gate"],
    rejectedItemIds: ["event_environment_unrelated"],
    seed: environmentSeed,
  },
  {
    id: "write-read-diagnostic",
    track: "write_read",
    title: "Write/read diagnostics preserve fact evidence and citations",
    query: "Context7 Turborepo Vitest documentation source",
    budgetTokens: 480,
    expectedItemIds: ["core_context7_rule", "event_context7_docs", "fact_context7_docs"],
    rejectedItemIds: ["event_write_read_unrelated"],
    seed: writeReadSeed,
  },
];
