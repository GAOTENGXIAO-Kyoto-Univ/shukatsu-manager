import {
  BACKUP_FORMAT,
  CURRENT_BACKUP_VERSION,
  MAX_BACKUP_JSON_BYTES,
} from '../../convex/lib/backup/constants';

export type BackupClientErrorCode =
  | 'parse'
  | 'format'
  | 'version'
  | 'incomplete'
  | 'relations'
  | 'too_large'
  | 'read'
  | 'unknown';

export class BackupClientError extends Error {
  constructor(readonly code: BackupClientErrorCode) {
    super(`BACKUP_${code.toUpperCase()}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getBackupErrorCode(error: unknown): BackupClientErrorCode | null {
  if (error instanceof BackupClientError) {
    return error.code;
  }

  if (!isRecord(error) || !isRecord(error.data)) {
    return null;
  }

  const code = error.data.code;
  return code === 'parse' ||
    code === 'format' ||
    code === 'version' ||
    code === 'incomplete' ||
    code === 'relations' ||
    code === 'too_large'
    ? code
    : null;
}

export function pickBackupJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.multiple = false;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function readAndPreflightBackupFile(file: File) {
  const extensionIsJson = file.name.toLocaleLowerCase().endsWith('.json');
  const typeIsJson = file.type === '' || file.type === 'application/json';

  if (!extensionIsJson || !typeIsJson) {
    throw new BackupClientError('format');
  }

  if (file.size > MAX_BACKUP_JSON_BYTES) {
    throw new BackupClientError('too_large');
  }

  let backupJson: string;

  try {
    backupJson = await file.text();
  } catch {
    throw new BackupClientError('read');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(backupJson) as unknown;
  } catch {
    throw new BackupClientError('parse');
  }

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new BackupClientError('format');
  }

  if (parsed.backupVersion !== CURRENT_BACKUP_VERSION) {
    throw new BackupClientError('version');
  }

  if (!isRecord(parsed.counts) || !isRecord(parsed.profile) || !isRecord(parsed.data)) {
    throw new BackupClientError('incomplete');
  }

  return backupJson;
}

export function downloadBackupJson(backup: unknown, exportedAt: number) {
  const contents = JSON.stringify(backup, null, 2);
  const blob = new Blob([contents], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `shukatsu-manager-backup-${new Date(exportedAt)
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function formatBackupTimestamp(
  timestamp: number,
  locale: string,
  timezone?: string,
) {
  if (!timezone) {
    return new Date(timestamp).toISOString();
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
    timeZoneName: 'short',
  }).format(new Date(timestamp));
}
