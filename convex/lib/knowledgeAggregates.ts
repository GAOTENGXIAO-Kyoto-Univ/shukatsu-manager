import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { findKnowledgeItemBySourceQuestion } from "./knowledge";

async function loadInterviewContext(
  ctx: QueryCtx,
  userId: Id<"users">,
  detail: Doc<"interviewDetails">,
) {
  const step = await ctx.db.get(detail.selectionStepId);
  const application = step ? await ctx.db.get(step.applicationId) : null;
  const company = application ? await ctx.db.get(application.companyId) : null;

  if (!step || !application || !company || company.userId !== userId) return null;

  const event = await ctx.db
    .query("events")
    .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", step._id))
    .unique();

  return { step, application, company, event };
}

export async function loadQuestionGroupAggregate(
  ctx: QueryCtx,
  userId: Id<"users">,
  group: Doc<"interviewQuestionGroups">,
) {
  if (group.userId !== userId) return null;

  const questions = await ctx.db
    .query("interviewQuestions")
    .withIndex("by_questionGroupId", (q) => q.eq("questionGroupId", group._id))
    .collect();
  const history = [];

  for (const question of questions) {
    const detail = await ctx.db.get(question.interviewDetailId);
    if (!detail) continue;
    const context = await loadInterviewContext(ctx, userId, detail);
    if (!context) continue;
    const knowledgeItem = await findKnowledgeItemBySourceQuestion(ctx, question._id);
    history.push({
      interviewQuestionId: question._id,
      question: question.question,
      answer: question.answer,
      evaluation: question.evaluation,
      note: question.note,
      occurrenceAt: context.event?.datetime ?? question._creationTime,
      company: { companyId: context.company._id, name: context.company.name },
      selectionStep: {
        selectionStepId: context.step._id,
        name: context.step.name,
        presetKey: context.step.presetKey,
      },
      applicationId: context.application._id,
      knowledgeItemId: knowledgeItem?.userId === userId ? knowledgeItem._id : undefined,
    });
  }

  history.sort((left, right) => right.occurrenceAt - left.occurrenceAt);
  if (history.length === 0) return null;

  const evaluated = history.filter((item) => item.evaluation !== undefined);
  const poor = evaluated.filter((item) => item.evaluation === "poor");
  const poorHistory = history.filter((item) => item.evaluation === "poor");
  const latest = history[0];
  const latestPoor = poorHistory[0];

  return {
    questionGroupId: group._id,
    title: group.title,
    questionCount: history.length,
    distinctCompanyCount: new Set(history.map((item) => item.company.companyId)).size,
    latestOccurrence: latest.occurrenceAt,
    latestCompanyName: latest.company.name,
    latestStepName: latest.selectionStep.name,
    latestStepPresetKey: latest.selectionStep.presetKey,
    poorCount: poor.length,
    evaluatedCount: evaluated.length,
    poorRate: evaluated.length === 0 ? 0 : poor.length / evaluated.length,
    latestPoorOccurrence: latestPoor?.occurrenceAt ?? 0,
    history,
  };
}

export async function listQuestionGroupAggregates(
  ctx: QueryCtx,
  userId: Id<"users">,
) {
  const groups = await ctx.db
    .query("interviewQuestionGroups")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const values = await Promise.all(
    groups.map((group) => loadQuestionGroupAggregate(ctx, userId, group)),
  );
  return values.filter((value): value is NonNullable<typeof value> => value !== null);
}

export async function loadWeaknessGroupAggregate(
  ctx: QueryCtx,
  userId: Id<"users">,
  group: Doc<"weaknessGroups">,
) {
  if (group.userId !== userId) return null;

  const occurrences = await ctx.db
    .query("weaknessOccurrences")
    .withIndex("by_weaknessGroupId", (q) => q.eq("weaknessGroupId", group._id))
    .collect();
  const history = [];

  for (const occurrence of occurrences) {
    const detail = await ctx.db.get(occurrence.interviewDetailId);
    if (!detail) continue;
    const context = await loadInterviewContext(ctx, userId, detail);
    if (!context) continue;
    history.push({
      weaknessOccurrenceId: occurrence._id,
      interviewDetailId: detail._id,
      extractedWeakness: occurrence.extractedWeakness,
      improvementAction: occurrence.improvementAction,
      occurrenceAt: context.event?.datetime ?? detail._creationTime,
      company: { companyId: context.company._id, name: context.company.name },
      selectionStep: {
        selectionStepId: context.step._id,
        name: context.step.name,
        presetKey: context.step.presetKey,
      },
      applicationId: context.application._id,
    });
  }

  history.sort((left, right) => right.occurrenceAt - left.occurrenceAt);
  if (history.length === 0) return null;

  return {
    weaknessGroupId: group._id,
    title: group.title,
    interviewCount: new Set(history.map((item) => item.interviewDetailId.toString())).size,
    latestOccurrence: history[0].occurrenceAt,
    latestCompanyName: history[0].company.name,
    latestStepName: history[0].selectionStep.name,
    latestStepPresetKey: history[0].selectionStep.presetKey,
    history,
  };
}

export async function listWeaknessGroupAggregates(
  ctx: QueryCtx,
  userId: Id<"users">,
) {
  const groups = await ctx.db
    .query("weaknessGroups")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const values = await Promise.all(
    groups.map((group) => loadWeaknessGroupAggregate(ctx, userId, group)),
  );
  return values.filter((value): value is NonNullable<typeof value> => value !== null);
}
