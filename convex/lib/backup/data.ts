import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { getUtf8ByteLength } from "./constants";

type BackupDataCtx = QueryCtx | MutationCtx;

export type OwnedBackupData = {
  companies: Doc<"companies">[];
  applications: Doc<"applications">[];
  selectionSteps: Doc<"selectionSteps">[];
  selectionProgressHistory: Doc<"selectionProgressHistory">[];
  events: Doc<"events">[];
  interviewDetails: Doc<"interviewDetails">[];
  interviewQuestions: Doc<"interviewQuestions">[];
  knowledgeItems: Doc<"knowledgeItems">[];
  researchItems: Doc<"researchItems">[];
  interviewQuestionGroups: Doc<"interviewQuestionGroups">[];
  weaknessGroups: Doc<"weaknessGroups">[];
  weaknessOccurrences: Doc<"weaknessOccurrences">[];
};

async function collectByCompany<T>(
  companies: Doc<"companies">[],
  load: (companyId: Id<"companies">) => Promise<T[]>,
) {
  return (await Promise.all(companies.map((company) => load(company._id)))).flat();
}

export async function loadOwnedBackupData(
  ctx: BackupDataCtx,
  userId: Id<"users">,
): Promise<OwnedBackupData> {
  const [companies, selectionProgressHistory, events, knowledgeItems, interviewQuestionGroups, weaknessGroups] =
    await Promise.all([
      ctx.db
        .query("companies")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("selectionProgressHistory")
        .withIndex("by_user_id_occurred_at", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("events")
        .withIndex("by_userId_datetime", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("knowledgeItems")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("interviewQuestionGroups")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("weaknessGroups")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    ]);

  const [applications, researchItems, weaknessOccurrences] = await Promise.all([
    collectByCompany(companies, (companyId) =>
      ctx.db
        .query("applications")
        .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
        .collect(),
    ),
    collectByCompany(companies, (companyId) =>
      ctx.db
        .query("researchItems")
        .withIndex("by_company_id", (q) => q.eq("companyId", companyId))
        .collect(),
    ),
    (
      await Promise.all(
        weaknessGroups.map((group) =>
          ctx.db
            .query("weaknessOccurrences")
            .withIndex("by_weaknessGroupId", (q) => q.eq("weaknessGroupId", group._id))
            .collect(),
        ),
      )
    ).flat(),
  ]);

  const selectionSteps = (
    await Promise.all(
      applications.map((application) =>
        ctx.db
          .query("selectionSteps")
          .withIndex("by_applicationId_order", (q) =>
            q.eq("applicationId", application._id),
          )
          .collect(),
      ),
    )
  ).flat();

  const interviewDetails = (
    await Promise.all(
      selectionSteps.map((step) =>
        ctx.db
          .query("interviewDetails")
          .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", step._id))
          .collect(),
      ),
    )
  ).flat();

  const interviewQuestions = (
    await Promise.all(
      interviewDetails.map((detail) =>
        ctx.db
          .query("interviewQuestions")
          .withIndex("by_interviewDetailId", (q) =>
            q.eq("interviewDetailId", detail._id),
          )
          .collect(),
      ),
    )
  ).flat();

  return {
    companies,
    applications,
    selectionSteps,
    selectionProgressHistory,
    events,
    interviewDetails,
    interviewQuestions,
    knowledgeItems,
    researchItems,
    interviewQuestionGroups,
    weaknessGroups,
    weaknessOccurrences,
  };
}

export function getCoreRecordCount(data: OwnedBackupData) {
  return (
    data.companies.length +
    data.applications.length +
    data.selectionSteps.length +
    data.selectionProgressHistory.length +
    data.events.length +
    data.interviewDetails.length +
    data.interviewQuestions.length +
    data.knowledgeItems.length +
    data.researchItems.length
  );
}

export function getOwnedRecordCount(data: OwnedBackupData) {
  return (
    getCoreRecordCount(data) +
    data.interviewQuestionGroups.length +
    data.weaknessGroups.length +
    data.weaknessOccurrences.length
  );
}

export function estimateOwnedDataBytes(data: OwnedBackupData) {
  return getUtf8ByteLength(JSON.stringify(data));
}
