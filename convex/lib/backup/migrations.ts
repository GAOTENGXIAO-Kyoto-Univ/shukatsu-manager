import { BACKUP_FORMAT, CURRENT_BACKUP_VERSION } from "./constants";

export type BackupEnvelopeError = "format" | "version";

export class BackupEnvelopeValidationError extends Error {
  readonly reason: BackupEnvelopeError;

  constructor(reason: BackupEnvelopeError) {
    super(`BACKUP_${reason.toUpperCase()}`);
    this.reason = reason;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrateBackupToCurrent(value: unknown): unknown {
  if (!isRecord(value) || value.format !== BACKUP_FORMAT) {
    throw new BackupEnvelopeValidationError("format");
  }

  if (value.backupVersion !== CURRENT_BACKUP_VERSION) {
    throw new BackupEnvelopeValidationError("version");
  }

  // Backup V2 is the first backup protocol. This is intentionally an identity
  // migration. The first future sequential migration must be v2ToV3.
  return value;
}
