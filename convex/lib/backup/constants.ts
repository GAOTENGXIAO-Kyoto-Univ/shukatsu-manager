export const BACKUP_FORMAT = "shukatsu-manager-backup" as const;
export const CURRENT_BACKUP_VERSION = 2 as const;

// Current Convex limits are 16 MiB for function arguments, return values,
// transaction reads, and transaction writes. Backup V2 keeps 75% headroom for
// serialization and database overhead, and bounds write operations well below
// the 1,000 concurrent-I/O ceiling.
export const MAX_BACKUP_JSON_BYTES = 4 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 400;
export const MAX_RESTORE_TOTAL_RECORDS = 700;
export const MAX_RESTORE_ESTIMATED_BYTES = 8 * 1024 * 1024;

export const backupCollectionNames = [
  "companies",
  "applications",
  "selectionSteps",
  "selectionProgressHistory",
  "events",
  "interviewDetails",
  "interviewQuestions",
  "knowledgeItems",
  "researchItems",
] as const;

export type BackupCollectionName = (typeof backupCollectionNames)[number];

export function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}
