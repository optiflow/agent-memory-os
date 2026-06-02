import type { VerificationRecord, VerificationStatus } from "./types.js";

export function createVerificationRecord(input: {
  targetId: string;
  status: VerificationStatus;
  message: string;
  metadata?: VerificationRecord["metadata"];
}): VerificationRecord {
  return {
    id: `verification_${crypto.randomUUID()}`,
    targetId: input.targetId,
    status: input.status,
    checkedAt: new Date().toISOString(),
    message: input.message,
    metadata: input.metadata,
  };
}

export function needsVerification(status: VerificationStatus): boolean {
  return status === "failed" || status === "stale" || status === "unknown" || status === "warning";
}
