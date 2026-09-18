import type { Doc } from "../../_generated/dataModel";
import { BACKUP_FORMAT, CURRENT_BACKUP_VERSION } from "./constants";
import type { OwnedBackupData } from "./data";
import type { BackupV2 } from "./format";

function sourceFields(document: { _id: { toString(): string }; _creationTime: number }) {
  return {
    backupId: document._id.toString(),
    sourceCreationTime: document._creationTime,
  };
}

export function createBackupV2(
  user: Doc<"users">,
  data: OwnedBackupData,
  exportedAt = Date.now(),
): BackupV2 {
  const backupData: BackupV2["data"] = {
    companies: data.companies.map((company) => ({
      ...sourceFields(company),
      name: company.name,
      ...(company.industry !== undefined ? { industry: company.industry } : {}),
      ...(company.websiteUrl !== undefined ? { websiteUrl: company.websiteUrl } : {}),
      ...(company.logoUrl !== undefined ? { logoUrl: company.logoUrl } : {}),
      updatedAt: company.updatedAt,
    })),
    applications: data.applications.map((application) => ({
      ...sourceFields(application),
      companyRef: application.companyId.toString(),
      jobTitle: application.jobTitle,
      ...(application.preferenceLevel !== undefined
        ? { preferenceLevel: application.preferenceLevel }
        : {}),
      ...(application.location !== undefined ? { location: application.location } : {}),
      ...(application.applicationUrl !== undefined
        ? { applicationUrl: application.applicationUrl }
        : {}),
      ...(application.mypageUrl !== undefined ? { mypageUrl: application.mypageUrl } : {}),
      ...(application.memo !== undefined ? { memo: application.memo } : {}),
      updatedAt: application.updatedAt,
    })),
    selectionSteps: data.selectionSteps.map((step) => ({
      ...sourceFields(step),
      applicationRef: step.applicationId.toString(),
      name: step.name,
      ...(step.presetKey !== undefined ? { presetKey: step.presetKey } : {}),
      type: step.type,
      order: step.order,
      result: step.result,
      completed: step.completed,
      updatedAt: step.updatedAt,
    })),
    selectionProgressHistory: data.selectionProgressHistory.map((history) => ({
      ...sourceFields(history),
      selectionStepRef: history.selectionStepId.toString(),
      type: history.type,
      occurredAt: history.occurredAt,
      ...(history.invalidatedAt !== undefined
        ? { invalidatedAt: history.invalidatedAt }
        : {}),
      createdAt: history.createdAt,
    })),
    events: data.events.map((event) => ({
      ...sourceFields(event),
      ...(event.selectionStepId !== undefined
        ? { selectionStepRef: event.selectionStepId.toString() }
        : {}),
      ...(event.title !== undefined ? { title: event.title } : {}),
      datetime: event.datetime,
      timingType: event.timingType,
      hasExplicitTime: event.hasExplicitTime,
      ...(event.location !== undefined ? { location: event.location } : {}),
      ...(event.meetingUrl !== undefined ? { meetingUrl: event.meetingUrl } : {}),
      ...(event.note !== undefined ? { note: event.note } : {}),
      updatedAt: event.updatedAt,
    })),
    interviewDetails: data.interviewDetails.map((detail) => ({
      ...sourceFields(detail),
      selectionStepRef: detail.selectionStepId.toString(),
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
    })),
    interviewQuestions: data.interviewQuestions.map((question) => ({
      ...sourceFields(question),
      interviewDetailRef: question.interviewDetailId.toString(),
      question: question.question,
      ...(question.answer !== undefined ? { answer: question.answer } : {}),
      ...(question.evaluation !== undefined ? { evaluation: question.evaluation } : {}),
      ...(question.note !== undefined ? { note: question.note } : {}),
      updatedAt: question.updatedAt,
    })),
    knowledgeItems: data.knowledgeItems.map((item) => ({
      ...sourceFields(item),
      title: item.title,
      ...(item.content !== undefined ? { content: item.content } : {}),
      category: item.category,
      ...(item.sourceInterviewQuestionId !== undefined
        ? { sourceInterviewQuestionRef: item.sourceInterviewQuestionId.toString() }
        : {}),
      ...(item.sourceCompanyId !== undefined
        ? { sourceCompanyRef: item.sourceCompanyId.toString() }
        : {}),
      ...(item.note !== undefined ? { note: item.note } : {}),
      updatedAt: item.updatedAt,
    })),
    researchItems: data.researchItems.map((item) => ({
      ...sourceFields(item),
      companyRef: item.companyId.toString(),
      ...(item.applicationId !== undefined
        ? { applicationRef: item.applicationId.toString() }
        : {}),
      category: item.category,
      ...(item.title !== undefined ? { title: item.title } : {}),
      content: item.content,
      ...(item.sourceUrls !== undefined ? { sourceUrls: item.sourceUrls } : {}),
      isPinned: item.isPinned,
      updatedAt: item.updatedAt,
    })),
  };

  return {
    format: BACKUP_FORMAT,
    backupVersion: CURRENT_BACKUP_VERSION,
    exportedAt,
    counts: {
      companies: backupData.companies.length,
      applications: backupData.applications.length,
      selectionSteps: backupData.selectionSteps.length,
      selectionProgressHistory: backupData.selectionProgressHistory.length,
      events: backupData.events.length,
      interviewDetails: backupData.interviewDetails.length,
      interviewQuestions: backupData.interviewQuestions.length,
      knowledgeItems: backupData.knowledgeItems.length,
      researchItems: backupData.researchItems.length,
    },
    profile: {
      ...(user.displayName !== undefined ? { displayName: user.displayName } : {}),
      ...(user.locale !== undefined ? { locale: user.locale } : {}),
      ...(user.timezone !== undefined ? { timezone: user.timezone } : {}),
      updatedAt: user.updatedAt,
    },
    data: backupData,
  };
}
