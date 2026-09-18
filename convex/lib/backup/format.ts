import { z } from "zod";

import { BACKUP_FORMAT, CURRENT_BACKUP_VERSION } from "./constants";

const timestampSchema = z.number().finite().nonnegative();
const backupIdSchema = z.string().trim().min(1).max(256);
const requiredTextSchema = z.string().refine((value) => value.trim().length > 0);
const optionalTextSchema = z.string();
const sourceRecordFields = {
  backupId: backupIdSchema,
  sourceCreationTime: timestampSchema,
};

const companyBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  name: requiredTextSchema,
  industry: optionalTextSchema.optional(),
  websiteUrl: optionalTextSchema.optional(),
  logoUrl: optionalTextSchema.optional(),
  updatedAt: timestampSchema,
});

const applicationBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  companyRef: backupIdSchema,
  jobTitle: requiredTextSchema,
  preferenceLevel: z.number().int().min(1).max(5).optional(),
  location: optionalTextSchema.optional(),
  applicationUrl: optionalTextSchema.optional(),
  mypageUrl: optionalTextSchema.optional(),
  memo: optionalTextSchema.optional(),
  updatedAt: timestampSchema,
});

export const selectionStepTypeSchema = z.enum([
  "es",
  "web_test",
  "interview",
  "briefing",
  "group_discussion",
  "offer_meeting",
  "other",
]);

export const selectionStepPresetKeySchema = z.enum([
  "briefing",
  "es",
  "web_test",
  "coding_test",
  "group_discussion",
  "first_interview",
  "second_interview",
  "third_interview",
  "final_interview",
  "offer_meeting",
]);

const selectionStepBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  applicationRef: backupIdSchema,
  name: requiredTextSchema,
  presetKey: selectionStepPresetKeySchema.optional(),
  type: selectionStepTypeSchema,
  order: z.number().int().nonnegative(),
  result: z.enum(["passed", "failed"]).nullable(),
  completed: z.boolean(),
  updatedAt: timestampSchema,
});

const selectionProgressHistoryBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  selectionStepRef: backupIdSchema,
  type: z.enum(["completed", "passed", "failed"]),
  occurredAt: timestampSchema,
  invalidatedAt: timestampSchema.optional(),
  createdAt: timestampSchema,
});

const eventBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  selectionStepRef: backupIdSchema.optional(),
  title: optionalTextSchema.optional(),
  datetime: timestampSchema,
  timingType: z.enum(["scheduled", "deadline"]),
  hasExplicitTime: z.boolean(),
  location: optionalTextSchema.optional(),
  meetingUrl: optionalTextSchema.optional(),
  note: optionalTextSchema.optional(),
  updatedAt: timestampSchema,
});

const interviewDetailBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  selectionStepRef: backupIdSchema,
  interviewFormat: z.enum(["online", "offline", "phone", "other"]).optional(),
  interviewerCount: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
  interviewerInfo: optionalTextSchema.optional(),
  goodPoints: optionalTextSchema.optional(),
  improvementPoints: optionalTextSchema.optional(),
  nextImprovement: optionalTextSchema.optional(),
  overallNote: optionalTextSchema.optional(),
  updatedAt: timestampSchema,
});

const interviewQuestionBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  interviewDetailRef: backupIdSchema,
  question: requiredTextSchema,
  answer: optionalTextSchema.optional(),
  evaluation: z.enum(["good", "neutral", "poor"]).optional(),
  note: optionalTextSchema.optional(),
  updatedAt: timestampSchema,
});

const knowledgeItemBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  title: requiredTextSchema,
  content: optionalTextSchema.optional(),
  category: z.enum(["qa", "reverse_question", "material"]),
  sourceInterviewQuestionRef: backupIdSchema.optional(),
  sourceCompanyRef: backupIdSchema.optional(),
  note: optionalTextSchema.optional(),
  updatedAt: timestampSchema,
});

const researchItemBackupV2Schema = z.strictObject({
  ...sourceRecordFields,
  companyRef: backupIdSchema,
  applicationRef: backupIdSchema.optional(),
  category: z.enum([
    "business",
    "culture",
    "strength",
    "weakness",
    "motivation",
    "reverse_question",
    "recruiting",
    "other",
  ]),
  title: optionalTextSchema.optional(),
  content: requiredTextSchema,
  sourceUrls: z.array(z.string()).optional(),
  isPinned: z.boolean(),
  updatedAt: timestampSchema,
});

export const backupV2Schema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  backupVersion: z.literal(CURRENT_BACKUP_VERSION),
  exportedAt: timestampSchema,
  counts: z.strictObject({
    companies: z.number().int().nonnegative(),
    applications: z.number().int().nonnegative(),
    selectionSteps: z.number().int().nonnegative(),
    selectionProgressHistory: z.number().int().nonnegative(),
    events: z.number().int().nonnegative(),
    interviewDetails: z.number().int().nonnegative(),
    interviewQuestions: z.number().int().nonnegative(),
    knowledgeItems: z.number().int().nonnegative(),
    researchItems: z.number().int().nonnegative(),
  }),
  profile: z.strictObject({
    displayName: z.string().max(50).optional(),
    locale: z.enum(["zh-CN", "ja-JP", "en-US"]).optional(),
    timezone: z.string().trim().min(1).optional(),
    updatedAt: timestampSchema,
  }),
  data: z.strictObject({
    companies: z.array(companyBackupV2Schema),
    applications: z.array(applicationBackupV2Schema),
    selectionSteps: z.array(selectionStepBackupV2Schema),
    selectionProgressHistory: z.array(selectionProgressHistoryBackupV2Schema),
    events: z.array(eventBackupV2Schema),
    interviewDetails: z.array(interviewDetailBackupV2Schema),
    interviewQuestions: z.array(interviewQuestionBackupV2Schema),
    knowledgeItems: z.array(knowledgeItemBackupV2Schema),
    researchItems: z.array(researchItemBackupV2Schema),
  }),
});

export type BackupV2 = z.infer<typeof backupV2Schema>;
export type BackupV2Data = BackupV2["data"];
