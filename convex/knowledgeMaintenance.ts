import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { autoDepositKnowledgeItem } from "./lib/knowledge";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;

function normalizeLimit(value: number | undefined) {
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(value ?? DEFAULT_BATCH_SIZE)));
}

export const backfillBatch = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = normalizeLimit(args.limit);
    const questions = await ctx.db.query("interviewQuestions").collect();
    const questionCandidates = [];

    for (const question of questions) {
      const detail = await ctx.db.get(question.interviewDetailId);
      const step = detail ? await ctx.db.get(detail.selectionStepId) : null;
      const application = step ? await ctx.db.get(step.applicationId) : null;
      const company = application ? await ctx.db.get(application.companyId) : null;
      const user = company ? await ctx.db.get(company.userId) : null;
      if (!detail || !step || !application || !company || !user) continue;

      const sourceItem = await ctx.db
        .query("knowledgeItems")
        .withIndex("by_sourceInterviewQuestionId", (q) =>
          q.eq("sourceInterviewQuestionId", question._id),
        )
        .unique();
      if (!sourceItem || !question.questionGroupId) {
        questionCandidates.push({ question, company, user, needsDeposit: !sourceItem });
      }
    }

    let deposited = 0;
    let groupingScheduled = 0;
    for (const candidate of questionCandidates.slice(0, limit)) {
      if (candidate.needsDeposit) {
        const result = await autoDepositKnowledgeItem(ctx, {
          userId: candidate.user._id,
          companyId: candidate.company._id,
          interviewQuestion: candidate.question,
        });
        if (result.created) deposited += 1;
      }
      if (!candidate.question.questionGroupId) {
        await ctx.scheduler.runAfter(0, internal.knowledgeAi.groupQuestion, {
          interviewQuestionId: candidate.question._id,
          sourceQuestion: candidate.question.question,
          sourceUpdatedAt: candidate.question.updatedAt,
        });
        groupingScheduled += 1;
      }
    }

    const details = await ctx.db.query("interviewDetails").collect();
    const weaknessCandidates = [];
    for (const detail of details) {
      if (!detail.improvementPoints) continue;
      const existing = await ctx.db
        .query("weaknessOccurrences")
        .withIndex("by_interviewDetailId", (q) => q.eq("interviewDetailId", detail._id))
        .first();
      if (!existing) weaknessCandidates.push(detail);
    }
    for (const detail of weaknessCandidates.slice(0, limit)) {
      await ctx.scheduler.runAfter(0, internal.knowledgeAi.analyzeWeakness, {
        interviewDetailId: detail._id,
        sourceImprovementPoints: detail.improvementPoints!,
        sourceNextImprovement: detail.nextImprovement,
        sourceUpdatedAt: detail.updatedAt,
      });
    }

    return {
      deposited,
      groupingScheduled,
      weaknessAnalysisScheduled: Math.min(weaknessCandidates.length, limit),
      remainingQuestionCandidates: Math.max(0, questionCandidates.length - limit),
      remainingWeaknessCandidates: Math.max(0, weaknessCandidates.length - limit),
    };
  },
});

export const retryWeaknessBatch = internalMutation({
  args: {
    interviewDetailIds: v.optional(v.array(v.id("interviewDetails"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const details = args.interviewDetailIds
      ? (await Promise.all(args.interviewDetailIds.map((id) => ctx.db.get(id))))
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : await ctx.db.query("interviewDetails").collect();
    const candidates = details
      .filter((detail) => Boolean(detail.improvementPoints))
      .slice(0, normalizeLimit(args.limit));
    for (const detail of candidates) {
      await ctx.scheduler.runAfter(0, internal.knowledgeAi.analyzeWeakness, {
        interviewDetailId: detail._id,
        sourceImprovementPoints: detail.improvementPoints!,
        sourceNextImprovement: detail.nextImprovement,
        sourceUpdatedAt: detail.updatedAt,
      });
    }
    return { scheduled: candidates.length };
  },
});

export const refreshAllTitles = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = normalizeLimit(args.limit);
    const [questionGroups, weaknessGroups] = await Promise.all([
      ctx.db.query("interviewQuestionGroups").take(limit),
      ctx.db.query("weaknessGroups").take(limit),
    ]);
    for (const group of questionGroups) {
      await ctx.scheduler.runAfter(0, internal.knowledgeAi.refreshQuestionGroupTitle, {
        groupId: group._id,
      });
    }
    for (const group of weaknessGroups) {
      await ctx.scheduler.runAfter(0, internal.knowledgeAi.refreshWeaknessGroupTitle, {
        groupId: group._id,
      });
    }
    return {
      questionTitlesScheduled: questionGroups.length,
      weaknessTitlesScheduled: weaknessGroups.length,
    };
  },
});
