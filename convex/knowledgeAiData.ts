import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  cleanupQuestionGroupIfEmpty,
  cleanupWeaknessGroupIfEmpty,
  deleteWeaknessOccurrencesForInterview,
  normalizeOptionalKnowledgeText,
} from "./lib/knowledge";
import { getCurrentUserOrThrow } from "./users";

async function resolveQuestionOwner(ctx: Parameters<typeof getCurrentUserOrThrow>[0], questionId: Id<"interviewQuestions">) {
  const question = await ctx.db.get(questionId);
  const detail = question ? await ctx.db.get(question.interviewDetailId) : null;
  const step = detail ? await ctx.db.get(detail.selectionStepId) : null;
  const application = step ? await ctx.db.get(step.applicationId) : null;
  const company = application ? await ctx.db.get(application.companyId) : null;
  const user = company ? await ctx.db.get(company.userId) : null;
  return question && detail && step && application && company && user
    ? { question, detail, step, application, company, user }
    : null;
}

async function resolveInterviewOwner(ctx: Parameters<typeof getCurrentUserOrThrow>[0], interviewDetailId: Id<"interviewDetails">) {
  const detail = await ctx.db.get(interviewDetailId);
  const step = detail ? await ctx.db.get(detail.selectionStepId) : null;
  const application = step ? await ctx.db.get(step.applicationId) : null;
  const company = application ? await ctx.db.get(application.companyId) : null;
  const user = company ? await ctx.db.get(company.userId) : null;
  return detail && step && application && company && user
    ? { detail, step, application, company, user }
    : null;
}

export const getQuestionContext = internalQuery({
  args: { interviewQuestionId: v.id("interviewQuestions") },
  handler: async (ctx, args) => {
    const owned = await resolveQuestionOwner(ctx, args.interviewQuestionId);

    if (!owned) return null;

    const groups = await ctx.db
      .query("interviewQuestionGroups")
      .withIndex("by_userId", (q) => q.eq("userId", owned.user._id))
      .collect();

    return {
      question: {
        interviewQuestionId: owned.question._id,
        question: owned.question.question,
        updatedAt: owned.question.updatedAt,
      },
      groups: groups.map((group) => ({ groupId: group._id, title: group.title })),
    };
  },
});

export const applyQuestionGrouping = internalMutation({
  args: {
    interviewQuestionId: v.id("interviewQuestions"),
    sourceQuestion: v.string(),
    sourceUpdatedAt: v.number(),
    matchingGroupId: v.optional(v.id("interviewQuestionGroups")),
    newTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owned = await resolveQuestionOwner(ctx, args.interviewQuestionId);

    if (
      !owned ||
      owned.question.updatedAt !== args.sourceUpdatedAt ||
      owned.question.question !== args.sourceQuestion
    ) {
      return null;
    }

    let targetGroupId = args.matchingGroupId;

    if (targetGroupId) {
      const target = await ctx.db.get(targetGroupId);
      if (!target || target.userId !== owned.user._id) return null;
    } else {
      const title = args.newTitle?.trim() || owned.question.question;
      targetGroupId = await ctx.db.insert("interviewQuestionGroups", {
        userId: owned.user._id,
        title,
        updatedAt: Date.now(),
      });
    }

    const oldGroupId = owned.question.questionGroupId;
    await ctx.db.patch(owned.question._id, { questionGroupId: targetGroupId });

    if (oldGroupId && oldGroupId !== targetGroupId) {
      await cleanupQuestionGroupIfEmpty(ctx, oldGroupId);
    }

    const members = await ctx.db
      .query("interviewQuestions")
      .withIndex("by_questionGroupId", (q) => q.eq("questionGroupId", targetGroupId))
      .collect();

    return {
      groupId: targetGroupId,
      memberCount: members.length,
      memberQuestions: members.map((item) => item.question),
    };
  },
});

export const updateQuestionGroupTitle = internalMutation({
  args: {
    groupId: v.id("interviewQuestionGroups"),
    expectedMemberCount: v.number(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return;
    const members = await ctx.db
      .query("interviewQuestions")
      .withIndex("by_questionGroupId", (q) => q.eq("questionGroupId", group._id))
      .collect();
    const title = args.title.trim();
    if (members.length === args.expectedMemberCount && title) {
      await ctx.db.patch(group._id, { title, updatedAt: Date.now() });
    }
  },
});

export const getWeaknessContext = internalQuery({
  args: { interviewDetailId: v.id("interviewDetails") },
  handler: async (ctx, args) => {
    const owned = await resolveInterviewOwner(ctx, args.interviewDetailId);
    if (!owned || !owned.detail.improvementPoints) return null;
    const groups = await ctx.db
      .query("weaknessGroups")
      .withIndex("by_userId", (q) => q.eq("userId", owned.user._id))
      .collect();
    return {
      detail: {
        interviewDetailId: owned.detail._id,
        improvementPoints: owned.detail.improvementPoints,
        nextImprovement: owned.detail.nextImprovement,
        updatedAt: owned.detail.updatedAt,
      },
      groups: groups.map((group) => ({ groupId: group._id, title: group.title })),
    };
  },
});

export const applyWeaknessAnalysis = internalMutation({
  args: {
    interviewDetailId: v.id("interviewDetails"),
    sourceImprovementPoints: v.string(),
    sourceNextImprovement: v.optional(v.string()),
    sourceUpdatedAt: v.number(),
    weaknesses: v.array(v.object({
      weakness: v.string(),
      matchingGroupId: v.optional(v.union(v.null(), v.id("weaknessGroups"))),
      improvementAction: v.optional(v.union(v.null(), v.string())),
    })),
  },
  handler: async (ctx, args) => {
    const owned = await resolveInterviewOwner(ctx, args.interviewDetailId);
    if (
      !owned ||
      owned.detail.updatedAt !== args.sourceUpdatedAt ||
      owned.detail.improvementPoints !== args.sourceImprovementPoints ||
      owned.detail.nextImprovement !== args.sourceNextImprovement
    ) return [];

    const oldOccurrences = await ctx.db
      .query("weaknessOccurrences")
      .withIndex("by_interviewDetailId", (q) => q.eq("interviewDetailId", owned.detail._id))
      .collect();
    const oldGroupIds = new Set(oldOccurrences.map((item) => item.weaknessGroupId));

    for (const occurrence of oldOccurrences) await ctx.db.delete(occurrence._id);

    const usedGroupIds = new Set<string>();
    const newGroupsByTitle = new Map<string, Id<"weaknessGroups">>();
    const affectedGroupIds = new Set<Id<"weaknessGroups">>();

    for (const result of args.weaknesses) {
      const weakness = result.weakness.trim();
      if (!weakness) continue;
      let groupId = result.matchingGroupId ?? undefined;

      if (groupId) {
        const group = await ctx.db.get(groupId);
        if (!group || group.userId !== owned.user._id) continue;
      } else {
        const key = weakness.toLocaleLowerCase();
        groupId = newGroupsByTitle.get(key);
        if (!groupId) {
          groupId = await ctx.db.insert("weaknessGroups", {
            userId: owned.user._id,
            title: weakness,
            updatedAt: Date.now(),
          });
          newGroupsByTitle.set(key, groupId);
        }
      }

      if (usedGroupIds.has(groupId.toString())) continue;
      usedGroupIds.add(groupId.toString());
      affectedGroupIds.add(groupId);
      await ctx.db.insert("weaknessOccurrences", {
        interviewDetailId: owned.detail._id,
        weaknessGroupId: groupId,
        extractedWeakness: weakness,
        improvementAction: normalizeOptionalKnowledgeText(result.improvementAction),
      });
    }

    for (const groupId of oldGroupIds) await cleanupWeaknessGroupIfEmpty(ctx, groupId);

    const refreshCandidates = [];
    for (const groupId of affectedGroupIds) {
      const occurrences = await ctx.db
        .query("weaknessOccurrences")
        .withIndex("by_weaknessGroupId", (q) => q.eq("weaknessGroupId", groupId))
        .collect();
      if (occurrences.length >= 3 && occurrences.length % 3 === 0) {
        refreshCandidates.push({
          groupId,
          occurrenceCount: occurrences.length,
          weaknesses: occurrences.map((item) => item.extractedWeakness),
        });
      }
    }
    return refreshCandidates;
  },
});

export const updateWeaknessGroupTitle = internalMutation({
  args: {
    groupId: v.id("weaknessGroups"),
    expectedOccurrenceCount: v.number(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return;
    const occurrences = await ctx.db
      .query("weaknessOccurrences")
      .withIndex("by_weaknessGroupId", (q) => q.eq("weaknessGroupId", group._id))
      .collect();
    const title = args.title.trim();
    if (occurrences.length === args.expectedOccurrenceCount && title) {
      await ctx.db.patch(group._id, { title, updatedAt: Date.now() });
    }
  },
});

export const loadAnswerCandidates = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const items = await ctx.db
      .query("knowledgeItems")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    return items.filter((item) => item.category === "qa").map((item) => ({
      knowledgeItemId: item._id,
      title: item.title,
    }));
  },
});

export const loadAnswerMaterials = internalQuery({
  args: { knowledgeItemIds: v.array(v.id("knowledgeItems")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const materials = [];
    for (const knowledgeItemId of args.knowledgeItemIds.slice(0, 5)) {
      const item = await ctx.db.get(knowledgeItemId);
      if (!item || item.userId !== user._id || item.category !== "qa" || !item.content?.trim()) continue;
      const company = item.sourceCompanyId ? await ctx.db.get(item.sourceCompanyId) : null;
      materials.push({
        knowledgeItemId: item._id,
        title: item.title,
        content: item.content,
        sourceCompanyName: company?.userId === user._id ? company.name : undefined,
      });
    }
    return materials;
  },
});

export const clearWeaknessesForInterview = internalMutation({
  args: { interviewDetailId: v.id("interviewDetails") },
  handler: async (ctx, args) => {
    await deleteWeaknessOccurrencesForInterview(ctx, args.interviewDetailId);
  },
});

export const getQuestionGroupTitleContext = internalQuery({
  args: { groupId: v.id("interviewQuestionGroups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    const members = await ctx.db
      .query("interviewQuestions")
      .withIndex("by_questionGroupId", (q) => q.eq("questionGroupId", group._id))
      .collect();
    return members.length === 0
      ? null
      : { memberCount: members.length, values: members.map((item) => item.question) };
  },
});

export const getWeaknessGroupTitleContext = internalQuery({
  args: { groupId: v.id("weaknessGroups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    const occurrences = await ctx.db
      .query("weaknessOccurrences")
      .withIndex("by_weaknessGroupId", (q) => q.eq("weaknessGroupId", group._id))
      .collect();
    return occurrences.length === 0
      ? null
      : {
          occurrenceCount: occurrences.length,
          values: occurrences.map((item) => item.extractedWeakness),
        };
  },
});
