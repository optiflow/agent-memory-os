import type {
  CoreMemoryBlock,
  EvidenceEvent,
  EvidenceKind,
  MemoryScope,
  Metadata,
  SemanticFact,
  VerificationStatus,
} from "@agent-memory-os/core";
import { createVerificationRecord, DefaultContextRouter } from "@agent-memory-os/core";
import { SQLiteMemoryStore } from "@agent-memory-os/sqlite";

export type CommandName = "context-pack" | "remember" | "search" | "seed-sample" | "verify";

export interface CommandInput {
  dbPath?: string;
  [key: string]: unknown;
}

function requireString(input: CommandInput, key: string): string {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected "${key}" to be a non-empty string`);
  }

  return value;
}

function optionalNumber(input: CommandInput, key: string, fallback: number): number {
  const value = input[key];

  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected "${key}" to be a number`);
  }

  return value;
}

function defaultScope(input: CommandInput): MemoryScope {
  const scope = input.scope;

  if (
    typeof scope === "object" &&
    scope !== null &&
    "type" in scope &&
    "id" in scope &&
    typeof scope.type === "string" &&
    typeof scope.id === "string"
  ) {
    return { type: scope.type as MemoryScope["type"], id: scope.id };
  }

  return { type: "workspace", id: "default" };
}

function optionalMetadata(input: CommandInput): Metadata | undefined {
  if (
    typeof input.metadata !== "object" ||
    input.metadata === null ||
    Array.isArray(input.metadata)
  ) {
    return undefined;
  }

  return input.metadata as Metadata;
}

function openStore(input: CommandInput): SQLiteMemoryStore {
  return new SQLiteMemoryStore(input.dbPath ?? process.env.META_MEMORY_DB ?? ":memory:");
}

export async function runCommand(command: CommandName, input: CommandInput): Promise<unknown> {
  const store = openStore(input);

  try {
    if (command === "remember") {
      const event: EvidenceEvent = {
        id: `event_${crypto.randomUUID()}`,
        kind: (input.kind as EvidenceKind | undefined) ?? "explicit_memory",
        actor: "actor" in input && input.actor === "assistant" ? "assistant" : "user",
        content: requireString(input, "content"),
        timestamp: new Date().toISOString(),
        scope: defaultScope(input),
        metadata: optionalMetadata(input),
      };

      return { event: await store.appendEvidence(event) };
    }

    if (command === "search") {
      return {
        results: await store.search(
          requireString(input, "query"),
          optionalNumber(input, "limit", 10),
        ),
      };
    }

    if (command === "context-pack") {
      const router = new DefaultContextRouter(store);

      return {
        contextPack: await router.pack({
          query: requireString(input, "query"),
          scope: defaultScope(input),
          budgetTokens: optionalNumber(input, "budgetTokens", 1200),
        }),
      };
    }

    if (command === "verify") {
      const record = createVerificationRecord({
        targetId: requireString(input, "targetId"),
        status: (input.status as VerificationStatus | undefined) ?? "unknown",
        message: requireString(input, "message"),
      });

      return { verification: await store.recordVerification(record) };
    }

    if (command === "seed-sample") {
      const coreBlock: CoreMemoryBlock = {
        id: "core_repo_rules",
        label: "Repo rules",
        content: "Use TypeScript, Turborepo, Biome, SQLite, and a thin Hermes adapter.",
        authority: 100,
        readOnly: false,
        updatedAt: new Date().toISOString(),
      };
      const event: EvidenceEvent = {
        id: "event_sample_biome",
        kind: "explicit_memory",
        actor: "user",
        content: "User prefers Biome as the only linter and formatter.",
        timestamp: new Date().toISOString(),
        scope: defaultScope(input),
      };
      const fact: SemanticFact = {
        id: "fact_sample_biome",
        subject: "user",
        predicate: "prefers",
        object: "Biome as the only linter and formatter",
        confidence: 0.95,
        sourceEventIds: [event.id],
      };

      await store.upsertCoreBlock(coreBlock);
      await store.appendEvidence(event);
      await store.addSemanticFact(fact);

      return { coreBlock, event, fact };
    }
  } finally {
    store.close();
  }
}
