import { v } from "convex/values";

import { query } from "./_generated/server";
import {
  listWeaknessGroupAggregates,
  loadWeaknessGroupAggregate,
} from "./lib/knowledgeAggregates";
import { getCurrentUserOrThrow } from "./users";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const groups = await listWeaknessGroupAggregates(ctx, user._id);
    return groups
      .sort((left, right) =>
        right.interviewCount - left.interviewCount ||
        right.latestOccurrence - left.latestOccurrence,
      )
      .map(({ history: _history, ...summary }) => summary);
  },
});

export const getDetail = query({
  args: { weaknessGroupId: v.id("weaknessGroups") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const group = await ctx.db.get(args.weaknessGroupId);
    if (!group || group.userId !== user._id) return null;
    return await loadWeaknessGroupAggregate(ctx, user._id, group);
  },
});
