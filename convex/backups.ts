import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  estimateOwnedDataBytes,
  getCoreRecordCount,
  getOwnedRecordCount,
  loadOwnedBackupData,
} from "./lib/backup/data";
import { createBackupV2 } from "./lib/backup/export";
import { restoreValidatedBackup } from "./lib/backup/restore";
import {
  assertBackupTransportCapacity,
  assertRestoreCapacity,
  BackupValidationError,
  parseAndValidateBackupJson,
  validateBackupV2,
} from "./lib/backup/validation";
import { getCurrentUserOrThrow } from "./users";

function rethrowPublicBackupError(error: unknown): never {
  if (error instanceof BackupValidationError) {
    throw new ConvexError({ code: error.code });
  }

  throw error;
}

export const exportBackup = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await getCurrentUserOrThrow(ctx);
      const currentData = await loadOwnedBackupData(ctx, user._id);
      const backup = createBackupV2(user, currentData);
      const validated = validateBackupV2(backup);
      assertBackupTransportCapacity(JSON.stringify(validated), validated);
      return validated;
    } catch (error) {
      return rethrowPublicBackupError(error);
    }
  },
});

export const previewRestore = query({
  args: { backupJson: v.string() },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUserOrThrow(ctx);
      const backup = parseAndValidateBackupJson(args.backupJson);
      const currentData = await loadOwnedBackupData(ctx, user._id);
      assertRestoreCapacity({
        backup,
        backupJson: args.backupJson,
        currentEstimatedBytes: estimateOwnedDataBytes(currentData),
        currentRecordCount: getOwnedRecordCount(currentData),
      });

      return {
        exportedAt: backup.exportedAt,
        isCurrentAccountEmpty: getCoreRecordCount(currentData) === 0,
        counts: {
          companies: backup.counts.companies,
          applications: backup.counts.applications,
          selectionSteps: backup.counts.selectionSteps,
          events: backup.counts.events,
          interviewDetails: backup.counts.interviewDetails,
          interviewQuestions: backup.counts.interviewQuestions,
          knowledgeItems: backup.counts.knowledgeItems,
          researchItems: backup.counts.researchItems,
        },
      };
    } catch (error) {
      return rethrowPublicBackupError(error);
    }
  },
});

export const restoreBackup = mutation({
  args: { backupJson: v.string() },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUserOrThrow(ctx);
      const backup = parseAndValidateBackupJson(args.backupJson);
      const currentData = await loadOwnedBackupData(ctx, user._id);
      assertRestoreCapacity({
        backup,
        backupJson: args.backupJson,
        currentEstimatedBytes: estimateOwnedDataBytes(currentData),
        currentRecordCount: getOwnedRecordCount(currentData),
      });
      const rebuild = await restoreValidatedBackup(ctx, user, currentData, backup);

      await ctx.scheduler.runAfter(0, internal.backups.rebuildDerivedDataAfterRestore, {
        userId: user._id,
        ...rebuild,
      });

      return { restored: true as const };
    } catch (error) {
      return rethrowPublicBackupError(error);
    }
  },
});

export const rebuildDerivedDataAfterRestore = internalMutation({
  args: {
    userId: v.id("users"),
    interviewDetailIdsForWeaknessRebuild: v.array(v.id("interviewDetails")),
    interviewQuestionIdsForGrouping: v.array(v.id("interviewQuestions")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return { groupingScheduled: 0, weaknessAnalysisScheduled: 0 };
    }

    const currentData = await loadOwnedBackupData(ctx, user._id);
    const questionById = new Map(
      currentData.interviewQuestions.map((question) => [question._id.toString(), question]),
    );
    const detailById = new Map(
      currentData.interviewDetails.map((detail) => [detail._id.toString(), detail]),
    );
    let groupingScheduled = 0;
    let weaknessAnalysisScheduled = 0;

    for (const interviewQuestionId of args.interviewQuestionIdsForGrouping) {
      const question = questionById.get(interviewQuestionId.toString());

      if (!question) {
        continue;
      }

      await ctx.scheduler.runAfter(0, internal.knowledgeAi.groupQuestion, {
        interviewQuestionId: question._id,
        sourceQuestion: question.question,
        sourceUpdatedAt: question.updatedAt,
      });
      groupingScheduled += 1;
    }

    for (const interviewDetailId of args.interviewDetailIdsForWeaknessRebuild) {
      const detail = detailById.get(interviewDetailId.toString());

      if (!detail?.improvementPoints) {
        continue;
      }

      await ctx.scheduler.runAfter(0, internal.knowledgeAi.analyzeWeakness, {
        interviewDetailId: detail._id,
        sourceImprovementPoints: detail.improvementPoints,
        sourceNextImprovement: detail.nextImprovement,
        sourceUpdatedAt: detail.updatedAt,
      });
      weaknessAnalysisScheduled += 1;
    }

    return { groupingScheduled, weaknessAnalysisScheduled };
  },
});
