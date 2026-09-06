import { v } from "convex/values";

import type { QueryCtx, MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

type CurrentUserCtx = QueryCtx | MutationCtx;

export async function getCurrentUser(ctx: CurrentUserCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique();
}

export async function getCurrentUserOrThrow(ctx: CurrentUserCtx) {
  const user = await getCurrentUser(ctx);

  if (!user) {
    throw new Error("Unauthenticated or user is not initialized");
  }

  return user;
}

export const current = query({
  args: {
    retryToken: v.optional(v.number()),
  },
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const updateCurrent = mutation({
  args: {
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const normalizedDisplayName = args.displayName?.trim() || undefined;

    if (normalizedDisplayName && normalizedDisplayName.length > 50) {
      throw new Error("显示名称不能超过 50 个字符");
    }

    if (user.displayName === normalizedDisplayName) {
      return user._id;
    }

    await ctx.db.patch(user._id, {
      displayName: normalizedDisplayName,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});

export const ensureCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique();

    if (existingUser) {
      return { userId: existingUser._id, wasCreated: false };
    }

    const userId = await ctx.db.insert("users", {
      authUserId: identity.subject,
      displayName: identity.name ?? undefined,
      updatedAt: Date.now(),
    });

    return { userId, wasCreated: true };
  },
});
