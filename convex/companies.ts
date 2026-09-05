import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getOwnedCompany } from "./lib/authorization";
import { getCurrentUserOrThrow } from "./users";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function validateOptionalUrl(value: string | null | undefined) {
  const trimmed = normalizeOptionalString(value);

  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new Error("官网格式不正确");
  }

  return trimmed;
}

export const listForPicker = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);

    const companies = await ctx.db
      .query("companies")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return companies.map((company) => ({
      companyId: company._id,
      name: company.name,
      industry: company.industry,
    }));
  },
});

export const update = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    industry: v.union(v.null(), v.string()),
    websiteUrl: v.union(v.null(), v.string()),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedCompany(ctx, args.companyId);

    if (!owned) {
      throw new Error("企业不存在");
    }

    const name = args.name.trim();

    if (!name) {
      throw new Error("企业名称不能为空");
    }

    const companies = await ctx.db
      .query("companies")
      .withIndex("by_userId", (q) => q.eq("userId", owned.user._id))
      .collect();
    const collision = companies.some(
      (company) => company._id !== owned.company._id && normalize(company.name) === normalize(name),
    );

    if (collision) {
      throw new Error("已存在同名企业");
    }

    const industry = normalizeOptionalString(args.industry);
    const websiteUrl = validateOptionalUrl(args.websiteUrl);

    await ctx.db.replace(owned.company._id, {
      userId: owned.company.userId,
      name,
      ...(industry !== undefined ? { industry } : {}),
      ...(websiteUrl !== undefined ? { websiteUrl } : {}),
      ...(owned.company.logoUrl !== undefined ? { logoUrl: owned.company.logoUrl } : {}),
      updatedAt: Date.now(),
    });
  },
});
