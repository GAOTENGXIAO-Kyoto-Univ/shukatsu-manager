import { backupCollectionNames, getUtf8ByteLength, MAX_BACKUP_JSON_BYTES, MAX_BACKUP_RECORDS, MAX_RESTORE_ESTIMATED_BYTES, MAX_RESTORE_TOTAL_RECORDS } from "./constants";
import { backupV2Schema, type BackupV2 } from "./format";
import {
  BackupEnvelopeValidationError,
  migrateBackupToCurrent,
} from "./migrations";
import { isPresetTypeCompatible } from "../selectionPresets";

export type BackupValidationErrorCode =
  | "parse"
  | "format"
  | "version"
  | "incomplete"
  | "relations"
  | "too_large";

export class BackupValidationError extends Error {
  readonly code: BackupValidationErrorCode;
  readonly detail?: string;

  constructor(
    code: BackupValidationErrorCode,
    detail?: string,
  ) {
    super(`BACKUP_${code.toUpperCase()}${detail ? `: ${detail}` : ""}`);
    this.code = code;
    this.detail = detail;
  }
}

function assertHttpUrl(value: string | undefined, path: string) {
  if (value === undefined) {
    return;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new BackupValidationError("incomplete", `${path} is not an HTTP(S) URL`);
  }
}

function assertOptionalText(value: string | undefined, path: string) {
  if (value !== undefined && value.trim().length === 0) {
    throw new BackupValidationError("incomplete", `${path} is empty`);
  }
}

function makeIdSet(
  collection: readonly { backupId: string }[],
  collectionName: string,
) {
  const ids = new Set<string>();

  for (const item of collection) {
    if (ids.has(item.backupId)) {
      throw new BackupValidationError(
        "incomplete",
        `${collectionName} contains duplicate backupId ${item.backupId}`,
      );
    }
    ids.add(item.backupId);
  }

  return ids;
}

function assertRef(ids: Set<string>, ref: string, path: string) {
  if (!ids.has(ref)) {
    throw new BackupValidationError("relations", `${path} references a missing record`);
  }
}

function normalizedBusinessKey(value: string) {
  return value.trim().toLowerCase();
}

function getBackupRecordCount(backup: BackupV2) {
  return backupCollectionNames.reduce(
    (total, collectionName) => total + backup.data[collectionName].length,
    0,
  );
}

export function assertBackupTransportCapacity(backupJson: string, backup: BackupV2) {
  if (
    getUtf8ByteLength(backupJson) > MAX_BACKUP_JSON_BYTES ||
    getBackupRecordCount(backup) > MAX_BACKUP_RECORDS
  ) {
    throw new BackupValidationError("too_large");
  }
}

export function assertRestoreCapacity(args: {
  backup: BackupV2;
  backupJson: string;
  currentEstimatedBytes: number;
  currentRecordCount: number;
}) {
  assertBackupTransportCapacity(args.backupJson, args.backup);

  if (
    args.currentRecordCount + getBackupRecordCount(args.backup) + 2 >
      MAX_RESTORE_TOTAL_RECORDS ||
    args.currentEstimatedBytes + getUtf8ByteLength(args.backupJson) >
      MAX_RESTORE_ESTIMATED_BYTES
  ) {
    throw new BackupValidationError("too_large");
  }
}

export function validateBackupV2(value: unknown): BackupV2 {
  const parsed = backupV2Schema.safeParse(value);

  if (!parsed.success) {
    throw new BackupValidationError(
      "incomplete",
      parsed.error.issues[0]?.path.join(".") ?? "schema",
    );
  }

  const backup = parsed.data;

  for (const collectionName of backupCollectionNames) {
    if (backup.counts[collectionName] !== backup.data[collectionName].length) {
      throw new BackupValidationError(
        "incomplete",
        `counts.${collectionName} does not match data`,
      );
    }
  }

  const companyIds = makeIdSet(backup.data.companies, "companies");
  const applicationIds = makeIdSet(backup.data.applications, "applications");
  const selectionStepIds = makeIdSet(backup.data.selectionSteps, "selectionSteps");
  makeIdSet(backup.data.selectionProgressHistory, "selectionProgressHistory");
  makeIdSet(backup.data.events, "events");
  const interviewDetailIds = makeIdSet(backup.data.interviewDetails, "interviewDetails");
  const interviewQuestionIds = makeIdSet(
    backup.data.interviewQuestions,
    "interviewQuestions",
  );
  makeIdSet(backup.data.knowledgeItems, "knowledgeItems");
  makeIdSet(backup.data.researchItems, "researchItems");

  const applicationCompanyById = new Map<string, string>();
  const applicationKeys = new Set<string>();
  for (const [index, application] of backup.data.applications.entries()) {
    assertRef(companyIds, application.companyRef, `applications[${index}].companyRef`);
    assertOptionalText(application.location, `applications[${index}].location`);
    assertOptionalText(application.memo, `applications[${index}].memo`);
    assertHttpUrl(application.applicationUrl, `applications[${index}].applicationUrl`);
    assertHttpUrl(application.mypageUrl, `applications[${index}].mypageUrl`);
    const applicationKey = `${application.companyRef}\u0000${normalizedBusinessKey(application.jobTitle)}`;
    if (applicationKeys.has(applicationKey)) {
      throw new BackupValidationError(
        "incomplete",
        `applications[${index}] duplicates a job title for its company`,
      );
    }
    applicationKeys.add(applicationKey);
    applicationCompanyById.set(application.backupId, application.companyRef);
  }

  const companyNames = new Set<string>();
  for (const [index, company] of backup.data.companies.entries()) {
    assertOptionalText(company.industry, `companies[${index}].industry`);
    assertHttpUrl(company.websiteUrl, `companies[${index}].websiteUrl`);
    const companyName = normalizedBusinessKey(company.name);
    if (companyNames.has(companyName)) {
      throw new BackupValidationError(
        "incomplete",
        `companies[${index}] duplicates a company name`,
      );
    }
    companyNames.add(companyName);
  }

  const selectionStepById = new Map(
    backup.data.selectionSteps.map((step) => [step.backupId, step]),
  );
  const ordersByApplication = new Map<string, number[]>();
  for (const [index, step] of backup.data.selectionSteps.entries()) {
    assertRef(applicationIds, step.applicationRef, `selectionSteps[${index}].applicationRef`);

    if (step.result !== null && !step.completed) {
      throw new BackupValidationError(
        "incomplete",
        `selectionSteps[${index}] has a result but is not completed`,
      );
    }

    if (step.presetKey && !isPresetTypeCompatible(step.presetKey, step.type)) {
      throw new BackupValidationError(
        "incomplete",
        `selectionSteps[${index}].presetKey does not match type`,
      );
    }

    const orders = ordersByApplication.get(step.applicationRef) ?? [];
    orders.push(step.order);
    ordersByApplication.set(step.applicationRef, orders);
  }

  for (const [applicationRef, orders] of ordersByApplication) {
    const ordered = [...orders].sort((left, right) => left - right);

    if (ordered.some((order, index) => order !== index)) {
      throw new BackupValidationError(
        "incomplete",
        `selection step order is invalid for application ${applicationRef}`,
      );
    }
  }

  for (const [index, history] of backup.data.selectionProgressHistory.entries()) {
    assertRef(
      selectionStepIds,
      history.selectionStepRef,
      `selectionProgressHistory[${index}].selectionStepRef`,
    );

    if (history.invalidatedAt !== undefined && history.invalidatedAt < history.occurredAt) {
      throw new BackupValidationError(
        "incomplete",
        `selectionProgressHistory[${index}].invalidatedAt is too early`,
      );
    }
  }

  const eventStepRefs = new Set<string>();
  for (const [index, event] of backup.data.events.entries()) {
    assertOptionalText(event.location, `events[${index}].location`);
    assertOptionalText(event.note, `events[${index}].note`);
    assertHttpUrl(event.meetingUrl, `events[${index}].meetingUrl`);

    if (event.timingType === "scheduled" && !event.hasExplicitTime) {
      throw new BackupValidationError(
        "incomplete",
        `events[${index}] scheduled event has no explicit time`,
      );
    }

    if (event.selectionStepRef !== undefined) {
      assertRef(selectionStepIds, event.selectionStepRef, `events[${index}].selectionStepRef`);

      if (event.title !== undefined || eventStepRefs.has(event.selectionStepRef)) {
        throw new BackupValidationError(
          "incomplete",
          `events[${index}] is not a valid selection-step event`,
        );
      }
      eventStepRefs.add(event.selectionStepRef);
    } else if (event.title === undefined || event.title.trim().length === 0) {
      throw new BackupValidationError(
        "incomplete",
        `events[${index}] is not a valid independent event`,
      );
    }
  }

  const detailStepRefs = new Set<string>();
  for (const [index, detail] of backup.data.interviewDetails.entries()) {
    assertRef(
      selectionStepIds,
      detail.selectionStepRef,
      `interviewDetails[${index}].selectionStepRef`,
    );
    const step = selectionStepById.get(detail.selectionStepRef);

    if (step?.type !== "interview" || detailStepRefs.has(detail.selectionStepRef)) {
      throw new BackupValidationError(
        "incomplete",
        `interviewDetails[${index}] has an invalid parent`,
      );
    }
    detailStepRefs.add(detail.selectionStepRef);
  }

  for (const [index, question] of backup.data.interviewQuestions.entries()) {
    assertRef(
      interviewDetailIds,
      question.interviewDetailRef,
      `interviewQuestions[${index}].interviewDetailRef`,
    );
  }

  for (const [index, item] of backup.data.knowledgeItems.entries()) {
    if (item.sourceCompanyRef !== undefined) {
      assertRef(companyIds, item.sourceCompanyRef, `knowledgeItems[${index}].sourceCompanyRef`);
    }
    if (item.sourceInterviewQuestionRef !== undefined) {
      assertRef(
        interviewQuestionIds,
        item.sourceInterviewQuestionRef,
        `knowledgeItems[${index}].sourceInterviewQuestionRef`,
      );
    }
  }

  for (const [index, item] of backup.data.researchItems.entries()) {
    assertRef(companyIds, item.companyRef, `researchItems[${index}].companyRef`);

    if (item.applicationRef !== undefined) {
      assertRef(applicationIds, item.applicationRef, `researchItems[${index}].applicationRef`);

      if (applicationCompanyById.get(item.applicationRef) !== item.companyRef) {
        throw new BackupValidationError(
          "relations",
          `researchItems[${index}] application does not belong to company`,
        );
      }
    }

    for (const [urlIndex, url] of (item.sourceUrls ?? []).entries()) {
      assertHttpUrl(url, `researchItems[${index}].sourceUrls[${urlIndex}]`);
    }
    if (item.sourceUrls && new Set(item.sourceUrls).size !== item.sourceUrls.length) {
      throw new BackupValidationError(
        "incomplete",
        `researchItems[${index}].sourceUrls contains duplicates`,
      );
    }
  }

  return backup;
}

export function parseAndValidateBackupJson(backupJson: string) {
  if (getUtf8ByteLength(backupJson) > MAX_BACKUP_JSON_BYTES) {
    throw new BackupValidationError("too_large");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(backupJson) as unknown;
  } catch {
    throw new BackupValidationError("parse");
  }

  let migrated: unknown;

  try {
    migrated = migrateBackupToCurrent(parsed);
  } catch (error) {
    if (error instanceof BackupEnvelopeValidationError) {
      throw new BackupValidationError(error.reason);
    }
    throw error;
  }

  const backup = validateBackupV2(migrated);
  assertBackupTransportCapacity(backupJson, backup);
  return backup;
}

export function getBackupRecordCountForTest(backup: BackupV2) {
  return getBackupRecordCount(backup);
}
