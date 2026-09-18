import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { OwnedBackupData } from "./data";
import type { BackupV2 } from "./format";

function bySourceCreationTime<T extends { backupId: string; sourceCreationTime: number }>(
  left: T,
  right: T,
) {
  return (
    left.sourceCreationTime - right.sourceCreationTime ||
    left.backupId.localeCompare(right.backupId)
  );
}

function requireMappedId<TableName extends keyof import("../../_generated/dataModel").DataModel>(
  map: Map<string, Id<TableName>>,
  backupId: string,
) {
  const id = map.get(backupId);

  if (!id) {
    throw new Error(`Validated backup reference is missing: ${backupId}`);
  }

  return id;
}

export async function deleteOwnedBackupData(ctx: MutationCtx, data: OwnedBackupData) {
  const deletionGroups = [
    data.weaknessOccurrences,
    data.knowledgeItems,
    data.researchItems,
    data.selectionProgressHistory,
    data.events,
    data.interviewQuestions,
    data.interviewDetails,
    data.interviewQuestionGroups,
    data.weaknessGroups,
    data.selectionSteps,
    data.applications,
    data.companies,
  ] as const;

  for (const documents of deletionGroups) {
    for (const document of documents) {
      await ctx.db.delete(document._id);
    }
  }
}

export type RestoreResult = {
  interviewDetailIdsForWeaknessRebuild: Id<"interviewDetails">[];
  interviewQuestionIdsForGrouping: Id<"interviewQuestions">[];
};

export async function restoreValidatedBackup(
  ctx: MutationCtx,
  user: Doc<"users">,
  currentData: OwnedBackupData,
  backup: BackupV2,
): Promise<RestoreResult> {
  await deleteOwnedBackupData(ctx, currentData);

  await ctx.db.replace(user._id, {
    authUserId: user.authUserId,
    ...(backup.profile.displayName !== undefined
      ? { displayName: backup.profile.displayName }
      : {}),
    ...(backup.profile.locale !== undefined ? { locale: backup.profile.locale } : {}),
    ...(backup.profile.timezone !== undefined
      ? { timezone: backup.profile.timezone }
      : {}),
    updatedAt: backup.profile.updatedAt,
  });

  const companyMap = new Map<string, Id<"companies">>();
  for (const company of [...backup.data.companies].sort(bySourceCreationTime)) {
    const companyId = await ctx.db.insert("companies", {
      userId: user._id,
      name: company.name,
      ...(company.industry !== undefined ? { industry: company.industry } : {}),
      ...(company.websiteUrl !== undefined ? { websiteUrl: company.websiteUrl } : {}),
      ...(company.logoUrl !== undefined ? { logoUrl: company.logoUrl } : {}),
      updatedAt: company.updatedAt,
    });
    companyMap.set(company.backupId, companyId);
  }

  const applicationMap = new Map<string, Id<"applications">>();
  for (const application of [...backup.data.applications].sort(bySourceCreationTime)) {
    const applicationId = await ctx.db.insert("applications", {
      companyId: requireMappedId(companyMap, application.companyRef),
      jobTitle: application.jobTitle,
      ...(application.preferenceLevel !== undefined
        ? { preferenceLevel: application.preferenceLevel }
        : {}),
      ...(application.location !== undefined ? { location: application.location } : {}),
      ...(application.applicationUrl !== undefined
        ? { applicationUrl: application.applicationUrl }
        : {}),
      ...(application.mypageUrl !== undefined
        ? { mypageUrl: application.mypageUrl }
        : {}),
      ...(application.memo !== undefined ? { memo: application.memo } : {}),
      updatedAt: application.updatedAt,
    });
    applicationMap.set(application.backupId, applicationId);
  }

  const selectionStepMap = new Map<string, Id<"selectionSteps">>();
  for (const step of [...backup.data.selectionSteps].sort(bySourceCreationTime)) {
    const selectionStepId = await ctx.db.insert("selectionSteps", {
      applicationId: requireMappedId(applicationMap, step.applicationRef),
      name: step.name,
      ...(step.presetKey !== undefined ? { presetKey: step.presetKey } : {}),
      type: step.type,
      order: step.order,
      result: step.result,
      completed: step.completed,
      updatedAt: step.updatedAt,
    });
    selectionStepMap.set(step.backupId, selectionStepId);
  }

  for (const event of [...backup.data.events].sort(bySourceCreationTime)) {
    await ctx.db.insert("events", {
      userId: user._id,
      ...(event.selectionStepRef !== undefined
        ? { selectionStepId: requireMappedId(selectionStepMap, event.selectionStepRef) }
        : {}),
      ...(event.title !== undefined ? { title: event.title } : {}),
      datetime: event.datetime,
      timingType: event.timingType,
      hasExplicitTime: event.hasExplicitTime,
      ...(event.location !== undefined ? { location: event.location } : {}),
      ...(event.meetingUrl !== undefined ? { meetingUrl: event.meetingUrl } : {}),
      ...(event.note !== undefined ? { note: event.note } : {}),
      updatedAt: event.updatedAt,
    });
  }

  const interviewDetailMap = new Map<string, Id<"interviewDetails">>();
  const interviewDetailIdsForWeaknessRebuild: Id<"interviewDetails">[] = [];
  for (const detail of [...backup.data.interviewDetails].sort(bySourceCreationTime)) {
    const interviewDetailId = await ctx.db.insert("interviewDetails", {
      selectionStepId: requireMappedId(selectionStepMap, detail.selectionStepRef),
      ...(detail.interviewFormat !== undefined
        ? { interviewFormat: detail.interviewFormat }
        : {}),
      ...(detail.interviewerCount !== undefined
        ? { interviewerCount: detail.interviewerCount }
        : {}),
      ...(detail.durationMinutes !== undefined
        ? { durationMinutes: detail.durationMinutes }
        : {}),
      ...(detail.interviewerInfo !== undefined
        ? { interviewerInfo: detail.interviewerInfo }
        : {}),
      ...(detail.goodPoints !== undefined ? { goodPoints: detail.goodPoints } : {}),
      ...(detail.improvementPoints !== undefined
        ? { improvementPoints: detail.improvementPoints }
        : {}),
      ...(detail.nextImprovement !== undefined
        ? { nextImprovement: detail.nextImprovement }
        : {}),
      ...(detail.overallNote !== undefined ? { overallNote: detail.overallNote } : {}),
      updatedAt: detail.updatedAt,
    });
    interviewDetailMap.set(detail.backupId, interviewDetailId);

    if (detail.improvementPoints) {
      interviewDetailIdsForWeaknessRebuild.push(interviewDetailId);
    }
  }

  const interviewQuestionMap = new Map<string, Id<"interviewQuestions">>();
  const interviewQuestionIdsForGrouping: Id<"interviewQuestions">[] = [];
  for (const question of [...backup.data.interviewQuestions].sort(bySourceCreationTime)) {
    const interviewQuestionId = await ctx.db.insert("interviewQuestions", {
      interviewDetailId: requireMappedId(
        interviewDetailMap,
        question.interviewDetailRef,
      ),
      question: question.question,
      ...(question.answer !== undefined ? { answer: question.answer } : {}),
      ...(question.evaluation !== undefined
        ? { evaluation: question.evaluation }
        : {}),
      ...(question.note !== undefined ? { note: question.note } : {}),
      updatedAt: question.updatedAt,
    });
    interviewQuestionMap.set(question.backupId, interviewQuestionId);
    interviewQuestionIdsForGrouping.push(interviewQuestionId);
  }

  for (const item of [...backup.data.researchItems].sort(bySourceCreationTime)) {
    await ctx.db.insert("researchItems", {
      companyId: requireMappedId(companyMap, item.companyRef),
      ...(item.applicationRef !== undefined
        ? { applicationId: requireMappedId(applicationMap, item.applicationRef) }
        : {}),
      category: item.category,
      ...(item.title !== undefined ? { title: item.title } : {}),
      content: item.content,
      ...(item.sourceUrls !== undefined ? { sourceUrls: item.sourceUrls } : {}),
      isPinned: item.isPinned,
      updatedAt: item.updatedAt,
    });
  }

  for (const item of [...backup.data.knowledgeItems].sort(bySourceCreationTime)) {
    await ctx.db.insert("knowledgeItems", {
      userId: user._id,
      title: item.title,
      ...(item.content !== undefined ? { content: item.content } : {}),
      category: item.category,
      ...(item.sourceInterviewQuestionRef !== undefined
        ? {
            sourceInterviewQuestionId: requireMappedId(
              interviewQuestionMap,
              item.sourceInterviewQuestionRef,
            ),
          }
        : {}),
      ...(item.sourceCompanyRef !== undefined
        ? { sourceCompanyId: requireMappedId(companyMap, item.sourceCompanyRef) }
        : {}),
      ...(item.note !== undefined ? { note: item.note } : {}),
      updatedAt: item.updatedAt,
    });
  }

  for (const history of [...backup.data.selectionProgressHistory].sort(
    bySourceCreationTime,
  )) {
    await ctx.db.insert("selectionProgressHistory", {
      userId: user._id,
      selectionStepId: requireMappedId(selectionStepMap, history.selectionStepRef),
      type: history.type,
      occurredAt: history.occurredAt,
      ...(history.invalidatedAt !== undefined
        ? { invalidatedAt: history.invalidatedAt }
        : {}),
      createdAt: history.createdAt,
    });
  }

  return {
    interviewDetailIdsForWeaknessRebuild,
    interviewQuestionIdsForGrouping,
  };
}

export function sortBackupRecordsForTest<
  T extends { backupId: string; sourceCreationTime: number },
>(records: readonly T[]) {
  return [...records].sort(bySourceCreationTime);
}
