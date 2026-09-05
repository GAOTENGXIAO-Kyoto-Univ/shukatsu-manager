import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  knowledgeCategoryValidator,
  normalizeKnowledgeTitle,
  normalizeOptionalKnowledgeText,
} from "./lib/knowledge";
import { getCurrentUserOrThrow } from "./users";

const editableFields = {
  category: knowledgeCategoryValidator,
  title: v.string(),
  content: v.optional(v.union(v.null(), v.string())),
  note: v.optional(v.union(v.null(), v.string())),
};

async function getOwnedKnowledgeItem(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  knowledgeItemId: Doc<"knowledgeItems">["_id"],
) {
  const user = await getCurrentUserOrThrow(ctx);
  const item = await ctx.db.get(knowledgeItemId);
  return item && item.userId === user._id ? { item, user } : null;
}

async function toKnowledgeItemDto(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  item: Doc<"knowledgeItems">,
) {
  const sourceCompany = item.sourceCompanyId ? await ctx.db.get(item.sourceCompanyId) : null;
  let sourceInterview: {
    applicationId: Doc<"applications">["_id"];
    selectionStepId: Doc<"selectionSteps">["_id"];
  } | null = null;

  if (item.sourceInterviewQuestionId) {
    const question = await ctx.db.get(item.sourceInterviewQuestionId);
    const detail = question ? await ctx.db.get(question.interviewDetailId) : null;
    const step = detail ? await ctx.db.get(detail.selectionStepId) : null;
    const application = step ? await ctx.db.get(step.applicationId) : null;
    const company = application ? await ctx.db.get(application.companyId) : null;

    if (company?.userId === item.userId && application && step) {
      sourceInterview = {
        applicationId: application._id,
        selectionStepId: step._id,
      };
    }
  }

  return {
    knowledgeItemId: item._id,
    category: item.category,
    title: item.title,
    content: item.content,
    note: item.note,
    sourceCompany: sourceCompany?.userId === item.userId
      ? { companyId: sourceCompany._id, name: sourceCompany.name }
      : null,
    sourceInterview,
    createdAt: item._creationTime,
    updatedAt: item.updatedAt,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const items = await ctx.db
      .query("knowledgeItems")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const dtos = await Promise.all(items.map((item) => toKnowledgeItemDto(ctx, item)));
    return dtos.sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const create = mutation({
  args: editableFields,
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("knowledgeItems", {
      userId: user._id,
      category: args.category,
      title: normalizeKnowledgeTitle(args.title),
      content: normalizeOptionalKnowledgeText(args.content),
      note: normalizeOptionalKnowledgeText(args.note),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { knowledgeItemId: v.id("knowledgeItems"), ...editableFields },
  handler: async (ctx, args) => {
    const owned = await getOwnedKnowledgeItem(ctx, args.knowledgeItemId);

    if (!owned) {
      throw new Error("知识内容不存在");
    }

    await ctx.db.patch(owned.item._id, {
      category: args.category,
      title: normalizeKnowledgeTitle(args.title),
      content: normalizeOptionalKnowledgeText(args.content),
      note: normalizeOptionalKnowledgeText(args.note),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { knowledgeItemId: v.id("knowledgeItems") },
  handler: async (ctx, args) => {
    const owned = await getOwnedKnowledgeItem(ctx, args.knowledgeItemId);

    if (!owned) {
      throw new Error("知识内容不存在");
    }

    await ctx.db.delete(owned.item._id);
  },
});
