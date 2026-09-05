import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  cleanupQuestionGroupIfEmpty,
  deleteWeaknessOccurrencesForInterview,
  detachKnowledgeItemSource,
} from "./knowledge";

type InterviewCtx = QueryCtx | MutationCtx;

export async function findInterviewDetailBySelectionStep(
  ctx: InterviewCtx,
  selectionStepId: Id<"selectionSteps">,
) {
  return await ctx.db
    .query("interviewDetails")
    .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", selectionStepId))
    .unique();
}

export async function listInterviewQuestions(
  ctx: InterviewCtx,
  interviewDetailId: Id<"interviewDetails">,
) {
  const questions = await ctx.db
    .query("interviewQuestions")
    .withIndex("by_interviewDetailId", (q) => q.eq("interviewDetailId", interviewDetailId))
    .collect();

  return questions.sort((left, right) => left._creationTime - right._creationTime);
}

export async function deleteInterviewDetailCascade(
  ctx: MutationCtx,
  interviewDetail: Doc<"interviewDetails">,
) {
  const questions = await listInterviewQuestions(ctx, interviewDetail._id);
  const questionGroupIds = new Set(questions.map((question) => question.questionGroupId));

  for (const question of questions) {
    await detachKnowledgeItemSource(ctx, question._id);
    await ctx.db.delete(question._id);
  }

  await deleteWeaknessOccurrencesForInterview(ctx, interviewDetail._id);

  await ctx.db.delete(interviewDetail._id);

  for (const questionGroupId of questionGroupIds) {
    await cleanupQuestionGroupIfEmpty(ctx, questionGroupId);
  }
}
