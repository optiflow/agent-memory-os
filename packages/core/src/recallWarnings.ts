import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { ContextPackItem, Metadata, RecallWarning, RecallWarningKind } from "./types.js";

function metadataString(metadata: Metadata | undefined, key: string): string | undefined {
  const value = metadata?.[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function warningId(input: {
  kind: RecallWarningKind;
  targetId: string;
  message: string;
  relatedIds?: string[];
}): string {
  const digest = createHash("sha256")
    .update(input.kind)
    .update("\0")
    .update(input.targetId)
    .update("\0")
    .update(input.message)
    .update("\0")
    .update((input.relatedIds ?? []).join("\0"))
    .digest("hex")
    .slice(0, 16);

  return `recall_warning_${digest}`;
}

export function createRecallWarning(input: {
  kind: RecallWarningKind;
  targetId: string;
  severity?: RecallWarning["severity"];
  message: string;
  relatedIds?: string[];
  metadata?: Metadata;
}): RecallWarning {
  return {
    id: warningId(input),
    kind: input.kind,
    targetId: input.targetId,
    severity: input.severity ?? "warning",
    message: input.message,
    generatedAt: new Date().toISOString(),
    relatedIds: input.relatedIds,
    metadata: input.metadata,
  };
}

function runGit(workspacePath: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", ["-C", workspacePath, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function resolveFilePath(workspacePath: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : join(workspacePath, filePath);
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function createDriftWarnings(
  items: ContextPackItem[],
  workspacePath?: string,
): RecallWarning[] {
  const warnings: RecallWarning[] = [];

  for (const item of items) {
    const itemWorkspacePath = metadataString(item.metadata, "workspacePath") ?? workspacePath;

    if (!itemWorkspacePath) {
      continue;
    }

    const expectedBranch = metadataString(item.metadata, "gitBranch");
    if (expectedBranch) {
      const actualBranch = runGit(itemWorkspacePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
      if (actualBranch && actualBranch !== expectedBranch) {
        warnings.push(
          createRecallWarning({
            kind: "branch_drift",
            targetId: item.id,
            message: `Memory item was captured on branch ${expectedBranch}, but the workspace is on ${actualBranch}.`,
            metadata: { expectedBranch, actualBranch, workspacePath: itemWorkspacePath },
          }),
        );
      }
    }

    const expectedCommit = metadataString(item.metadata, "gitCommit");
    if (expectedCommit) {
      const actualCommit = runGit(itemWorkspacePath, ["rev-parse", "HEAD"]);
      if (actualCommit && actualCommit !== expectedCommit) {
        warnings.push(
          createRecallWarning({
            kind: "commit_drift",
            targetId: item.id,
            message: `Memory item was captured at commit ${expectedCommit}, but the workspace is at ${actualCommit}.`,
            metadata: { expectedCommit, actualCommit, workspacePath: itemWorkspacePath },
          }),
        );
      }
    }

    const filePath = metadataString(item.metadata, "filePath");
    if (!filePath) {
      continue;
    }

    const resolvedFilePath = resolveFilePath(itemWorkspacePath, filePath);
    if (!existsSync(resolvedFilePath)) {
      warnings.push(
        createRecallWarning({
          kind: "file_missing",
          targetId: item.id,
          message: `Memory item references missing file ${filePath}.`,
          metadata: { filePath, workspacePath: itemWorkspacePath },
        }),
      );
      continue;
    }

    const expectedHash = metadataString(item.metadata, "contentSha256");
    if (!expectedHash) {
      continue;
    }

    const actualHash = sha256File(resolvedFilePath);
    if (actualHash !== expectedHash) {
      warnings.push(
        createRecallWarning({
          kind: "file_hash_mismatch",
          targetId: item.id,
          message: `Memory item references ${filePath}, but its content hash has changed.`,
          metadata: {
            actualHash,
            expectedHash,
            filePath,
            workspacePath: itemWorkspacePath,
          },
        }),
      );
    }
  }

  return warnings;
}
