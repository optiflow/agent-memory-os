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

const COMMAND_NAMES = ["context-pack", "remember", "search", "seed-sample", "verify"] as const;
const EVIDENCE_KINDS = [
  "assistant_message",
  "explicit_memory",
  "file_edit",
  "system_event",
  "tool_call",
  "tool_result",
  "user_message",
] as const satisfies readonly EvidenceKind[];
const MEMORY_SCOPE_TYPES = [
  "global",
  "project",
  "session",
  "user",
  "workspace",
] as const satisfies readonly MemoryScope["type"][];
const VERIFICATION_STATUSES = [
  "failed",
  "passed",
  "stale",
  "unknown",
  "warning",
] as const satisfies readonly VerificationStatus[];
const EVIDENCE_ACTORS = [
  "assistant",
  "system",
  "tool",
  "user",
] as const satisfies readonly EvidenceEvent["actor"][];

export type CommandName = (typeof COMMAND_NAMES)[number];

export interface CommandInput {
  dbPath?: string;
  [key: string]: unknown;
}

function isOneOf<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

export function parseCommandName(value: string | undefined): CommandName {
  if (isOneOf(COMMAND_NAMES, value)) {
    return value;
  }

  if (value) {
    throw new Error(`Unknown command "${value}"`);
  }

  throw new Error(`Usage: meta-memory <${COMMAND_NAMES.join("|")}>`);
}

function requireString(input: CommandInput, key: string): string {
  const value = input[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Expected "${key}" to be a non-empty string`);
  }

  return value;
}

function optionalPositiveInteger(input: CommandInput, key: string, fallback: number): number {
  const value = input[key];

  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Expected "${key}" to be a positive integer`);
  }

  return value;
}

function optionalEvidenceKind(input: CommandInput): EvidenceKind {
  const value = input.kind;

  if (value === undefined) {
    return "explicit_memory";
  }

  if (isOneOf(EVIDENCE_KINDS, value)) {
    return value;
  }

  throw new Error('Expected "kind" to be a supported evidence kind');
}

function optionalActor(input: CommandInput): EvidenceEvent["actor"] {
  const value = input.actor;

  if (value === undefined) {
    return "user";
  }

  if (isOneOf(EVIDENCE_ACTORS, value)) {
    return value;
  }

  throw new Error('Expected "actor" to be assistant, system, tool, or user');
}

function optionalVerificationStatus(input: CommandInput): VerificationStatus {
  const value = input.status;

  if (value === undefined) {
    return "unknown";
  }

  if (isOneOf(VERIFICATION_STATUSES, value)) {
    return value;
  }

  throw new Error('Expected "status" to be a supported verification status');
}

function defaultScope(input: CommandInput): MemoryScope {
  const scope = input.scope;

  if (scope === undefined) {
    return { type: "workspace", id: "default" };
  }

  if (
    typeof scope === "object" &&
    scope !== null &&
    "type" in scope &&
    "id" in scope &&
    typeof scope.type === "string" &&
    typeof scope.id === "string"
  ) {
    if (!isOneOf(MEMORY_SCOPE_TYPES, scope.type)) {
      throw new Error('Expected "scope.type" to be a supported memory scope type');
    }

    if (scope.id.trim().length === 0) {
      throw new Error('Expected "scope.id" to be a non-empty string');
    }

    return { type: scope.type, id: scope.id };
  }

  throw new Error('Expected "scope" to include string "type" and "id" fields');
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
        kind: optionalEvidenceKind(input),
        actor: optionalActor(input),
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
          optionalPositiveInteger(input, "limit", 10),
        ),
      };
    }

    if (command === "context-pack") {
      const router = new DefaultContextRouter(store);

      return {
        contextPack: await router.pack({
          query: requireString(input, "query"),
          scope: defaultScope(input),
          budgetTokens: optionalPositiveInteger(input, "budgetTokens", 1200),
        }),
      };
    }

    if (command === "verify") {
      const record = createVerificationRecord({
        targetId: requireString(input, "targetId"),
        status: optionalVerificationStatus(input),
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

  return assertNever(command);
}

function assertNever(value: never): never {
  throw new Error(`Unknown command "${String(value)}"`);
}
