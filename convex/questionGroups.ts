import { v } from "convex/values";

import { query } from "./_generated/server";
import {
  listQuestionGroupAggregates,
  loadQuestionGroupAggregate,
} from "./lib/knowledgeAggregates";
import { getCurrentUserOrThrow } from "./users";

export const listFrequent = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const groups = await listQuestionGroupAggregates(ctx, user._id);
    return groups
      .filter((group) => group.questionCount >= 2)
      .sort((left, right) =>
        right.questionCount - left.questionCount ||
        right.latestOccurrence - left.latestOccurrence,
      )
      .map(({ history: _history, ...summary }) => summary);
  },
});

export const listWeakAnswers = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const groups = await listQuestionGroupAggregates(ctx, user._id);
    return groups
      .filter((group) => group.poorCount >= 2)
      .sort((left, right) =>
        right.poorCount - left.poorCount ||
        right.poorRate - left.poorRate ||
        right.latestPoorOccurrence - left.latestPoorOccurrence,
      )
      .map(({ history: _history, ...summary }) => summary);
  },
});

export const getFrequentDetail = query({
  args: { questionGroupId: v.id("interviewQuestionGroups") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const group = await ctx.db.get(args.questionGroupId);
    if (!group || group.userId !== user._id) return null;
    const aggregate = await loadQuestionGroupAggregate(ctx, user._id, group);
    return aggregate && aggregate.questionCount >= 2 ? aggregate : null;
  },
});

export const getWeakAnswerDetail = query({
  args: { questionGroupId: v.id("interviewQuestionGroups") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const group = await ctx.db.get(args.questionGroupId);
    if (!group || group.userId !== user._id) return null;
    const aggregate = await loadQuestionGroupAggregate(ctx, user._id, group);
    if (!aggregate || aggregate.poorCount < 2) return null;
    return {
      ...aggregate,
      history: aggregate.history.filter((item) => item.evaluation !== undefined),
    };
  },
});
