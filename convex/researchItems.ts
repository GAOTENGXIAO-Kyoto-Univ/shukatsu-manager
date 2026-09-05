import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getOwnedApplication, getOwnedCompany } from "./lib/authorization";

const researchCategoryValidator = v.union(
  v.literal("business"),
  v.literal("culture"),
  v.literal("strength"),
  v.literal("weakness"),
  v.literal("motivation"),
  v.literal("reverse_question"),
  v.literal("recruiting"),
  v.literal("other"),
);

const researchScopeValidator = v.union(v.literal("company"), v.literal("application"));

function normalizeTitle(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeContent(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("请输入研究内容");
  }

  return trimmed;
}

function normalizeSourceUrls(values: string[] | undefined) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values ?? []) {
    const value = rawValue.trim();

    if (!value || seen.has(value)) {
      continue;
    }

    try {
      const parsed = new URL(value);

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Invalid source protocol");
      }
    } catch {
      throw new Error("来源链接格式不正确");
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized.length > 0 ? normalized : undefined;
}

function sameOptionalStrings(left: string[] | undefined, right: string[] | undefined) {
  const leftValues = left ?? [];
  const rightValues = right ?? [];

  return (
    leftValues.length === rightValues.length &&
    leftValues.every((value, index) => value === rightValues[index])
  );
}

function sortResearchItems(items: Doc<"researchItems">[]) {
  return items.sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    return right.updatedAt - left.updatedAt;
  });
}

export const listForApplication = query({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedApplication(ctx, args.applicationId);

    if (!owned) {
      throw new Error("应聘记录不存在");
    }

    const companyItems = await ctx.db
      .query("researchItems")
      .withIndex("by_company_id", (q) => q.eq("companyId", owned.company._id))
      .collect();
    const applicationItems = await ctx.db
      .query("researchItems")
      .withIndex("by_application_id", (q) => q.eq("applicationId", owned.application._id))
      .collect();
    const commonItems = companyItems.filter((item) => item.applicationId === undefined);

    return sortResearchItems([...commonItems, ...applicationItems]).map((item) => ({
      researchItemId: item._id,
      companyId: item.companyId,
      applicationId: item.applicationId,
      category: item.category,
      title: item.title,
      content: item.content,
      sourceUrls: item.sourceUrls,
      isPinned: item.isPinned,
      createdAt: item._creationTime,
      updatedAt: item.updatedAt,
    }));
  },
});

export const create = mutation({
  args: {
    applicationId: v.id("applications"),
    scope: researchScopeValidator,
    category: researchCategoryValidator,
    title: v.optional(v.string()),
    content: v.string(),
    sourceUrls: v.optional(v.array(v.string())),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedApplication(ctx, args.applicationId);

    if (!owned) {
      throw new Error("应聘记录不存在");
    }

    const now = Date.now();
    const title = normalizeTitle(args.title);
    const content = normalizeContent(args.content);
    const sourceUrls = normalizeSourceUrls(args.sourceUrls);

    return await ctx.db.insert("researchItems", {
      companyId: owned.company._id,
      ...(args.scope === "application" ? { applicationId: owned.application._id } : {}),
      category: args.category,
      ...(title ? { title } : {}),
      content,
      ...(sourceUrls ? { sourceUrls } : {}),
      isPinned: args.isPinned,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    researchItemId: v.id("researchItems"),
    applicationId: v.id("applications"),
    scope: researchScopeValidator,
    category: researchCategoryValidator,
    title: v.optional(v.string()),
    content: v.string(),
    sourceUrls: v.optional(v.array(v.string())),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const researchItem = await ctx.db.get(args.researchItemId);

    if (!researchItem) {
      throw new Error("企业研究不存在");
    }

    const ownedCompany = await getOwnedCompany(ctx, researchItem.companyId);

    if (!ownedCompany) {
      throw new Error("企业研究不存在");
    }

    const application = await ctx.db.get(args.applicationId);

    if (!application || application.companyId !== ownedCompany.company._id) {
      throw new Error("应聘记录与企业不匹配");
    }

    const applicationId = args.scope === "application" ? application._id : undefined;
    const title = normalizeTitle(args.title);
    const content = normalizeContent(args.content);
    const sourceUrls = normalizeSourceUrls(args.sourceUrls);
    const contentChanged =
      researchItem.applicationId !== applicationId ||
      researchItem.category !== args.category ||
      researchItem.title !== title ||
      researchItem.content !== content ||
      !sameOptionalStrings(researchItem.sourceUrls, sourceUrls);

    await ctx.db.patch(researchItem._id, {
      applicationId,
      category: args.category,
      title,
      content,
      sourceUrls,
      isPinned: args.isPinned,
      ...(contentChanged ? { updatedAt: Date.now() } : {}),
    });
  },
});

export const setPinned = mutation({
  args: {
    researchItemId: v.id("researchItems"),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const researchItem = await ctx.db.get(args.researchItemId);

    if (!researchItem) {
      throw new Error("企业研究不存在");
    }

    const owned = await getOwnedCompany(ctx, researchItem.companyId);

    if (!owned) {
      throw new Error("企业研究不存在");
    }

    await ctx.db.patch(researchItem._id, { isPinned: args.isPinned });
  },
});

export const remove = mutation({
  args: {
    researchItemId: v.id("researchItems"),
  },
  handler: async (ctx, args) => {
    const researchItem = await ctx.db.get(args.researchItemId);

    if (!researchItem) {
      throw new Error("企业研究不存在");
    }

    const owned = await getOwnedCompany(ctx, researchItem.companyId);

    if (!owned) {
      throw new Error("企业研究不存在");
    }

    await ctx.db.delete(researchItem._id);
  },
});
