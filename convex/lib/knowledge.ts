import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const knowledgeCategoryValidator = v.union(
  v.literal("qa"),
  v.literal("reverse_question"),
  v.literal("material"),
);

export function normalizeOptionalKnowledgeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeKnowledgeTitle(value: string) {
  const title = value.trim();

  if (!title) {
    throw new Error("标题不能为空");
  }

  return title;
}

export async function findKnowledgeItemBySourceQuestion(
  ctx: QueryCtx | MutationCtx,
  interviewQuestionId: Id<"interviewQuestions">,
) {
  return await ctx.db
    .query("knowledgeItems")
    .withIndex("by_sourceInterviewQuestionId", (q) =>
      q.eq("sourceInterviewQuestionId", interviewQuestionId),
    )
    .unique();
}

export async function autoDepositKnowledgeItem(
  ctx: MutationCtx,
  args: {
    companyId: Id<"companies">;
    interviewQuestion: Doc<"interviewQuestions">;
    userId: Id<"users">;
  },
) {
  const existing = await findKnowledgeItemBySourceQuestion(
    ctx,
    args.interviewQuestion._id,
  );

  if (existing) {
    return { created: false as const, knowledgeItemId: existing._id };
  }

  const knowledgeItemId = await ctx.db.insert("knowledgeItems", {
    userId: args.userId,
    category: "qa",
    title: args.interviewQuestion.question,
    content: args.interviewQuestion.answer,
    sourceInterviewQuestionId: args.interviewQuestion._id,
    sourceCompanyId: args.companyId,
    updatedAt: Date.now(),
  });

  return { created: true as const, knowledgeItemId };
}

export async function detachKnowledgeItemSource(
  ctx: MutationCtx,
  interviewQuestionId: Id<"interviewQuestions">,
) {
  const knowledgeItem = await findKnowledgeItemBySourceQuestion(ctx, interviewQuestionId);

  if (knowledgeItem) {
    await ctx.db.patch(knowledgeItem._id, {
      sourceInterviewQuestionId: undefined,
      updatedAt: Date.now(),
    });
  }
}

export async function cleanupQuestionGroupIfEmpty(
  ctx: MutationCtx,
  questionGroupId: Id<"interviewQuestionGroups"> | undefined,
) {
  if (!questionGroupId) {
    return;
  }

  const remaining = await ctx.db
    .query("interviewQuestions")
    .withIndex("by_questionGroupId", (q) => q.eq("questionGroupId", questionGroupId))
    .first();

  if (!remaining) {
    await ctx.db.delete(questionGroupId);
  }
}

export async function cleanupWeaknessGroupIfEmpty(
  ctx: MutationCtx,
  weaknessGroupId: Id<"weaknessGroups">,
) {
  const remaining = await ctx.db
    .query("weaknessOccurrences")
    .withIndex("by_weaknessGroupId", (q) => q.eq("weaknessGroupId", weaknessGroupId))
    .first();

  if (!remaining) {
    await ctx.db.delete(weaknessGroupId);
  }
}

export async function deleteWeaknessOccurrencesForInterview(
  ctx: MutationCtx,
  interviewDetailId: Id<"interviewDetails">,
) {
  const occurrences = await ctx.db
    .query("weaknessOccurrences")
    .withIndex("by_interviewDetailId", (q) => q.eq("interviewDetailId", interviewDetailId))
    .collect();
  const groupIds = new Set(occurrences.map((item) => item.weaknessGroupId));

  for (const occurrence of occurrences) {
    await ctx.db.delete(occurrence._id);
  }

  for (const groupId of groupIds) {
    await cleanupWeaknessGroupIfEmpty(ctx, groupId);
  }
}
