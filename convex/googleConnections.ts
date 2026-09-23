import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

async function getUserByAuthId(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  authUserId: string,
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  if (!user) throw new Error("Unauthenticated or user is not initialized");
  return user;
}
export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!connection) return null;
    return {
      email: connection.email,
      gmailEnabled: connection.gmailEnabled,
      grantedScopes: connection.grantedScopes,
      credentialStatus: connection.credentialStatus,
      updatedAt: connection.updatedAt,
    };
  },
});

export const createOAuthState = internalMutation({
  args: {
    authUserId: v.string(),
    stateHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    const existing = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    for (const state of existing) await ctx.db.delete(state._id);
    await ctx.db.insert("googleOAuthStates", {
      userId: user._id,
      stateHash: args.stateHash,
      requestedCapability: "gmail",
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const consumeOAuthState = internalMutation({
  args: { authUserId: v.string(), stateHash: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    const state = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_state_hash", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!state || state.userId !== user._id || state.expiresAt < Date.now()) {
      if (state) await ctx.db.delete(state._id);
      throw new ConvexError({ code: "GOOGLE_OAUTH_STATE_INVALID" });
    }
    await ctx.db.delete(state._id);
    return { existingConnection: await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique() };
  },
});

export const saveAuthorization = internalMutation({
  args: {
    authUserId: v.string(),
    googleAccountId: v.string(),
    email: v.optional(v.string()),
    grantedScopes: v.array(v.string()),
    refreshTokenCiphertext: v.optional(v.string()),
    refreshTokenIv: v.optional(v.string()),
    tokenKeyVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (connection && connection.googleAccountId !== args.googleAccountId) {
      throw new ConvexError({ code: "GOOGLE_ACCOUNT_MISMATCH" });
    }
    const now = Date.now();
    if (connection) {
      await ctx.db.patch(connection._id, {
        email: args.email,
        grantedScopes: args.grantedScopes,
        gmailEnabled: true,
        credentialStatus: "active",
        ...(args.refreshTokenCiphertext
          ? {
              refreshTokenCiphertext: args.refreshTokenCiphertext,
              refreshTokenIv: args.refreshTokenIv,
              tokenKeyVersion: args.tokenKeyVersion,
            }
          : {}),
        updatedAt: now,
      });
      return connection._id;
    }
    if (!args.refreshTokenCiphertext || !args.refreshTokenIv) {
      throw new ConvexError({ code: "GOOGLE_REFRESH_TOKEN_REQUIRED" });
    }
    return await ctx.db.insert("googleConnections", {
      userId: user._id,
      googleAccountId: args.googleAccountId,
      email: args.email,
      grantedScopes: args.grantedScopes,
      gmailEnabled: true,
      credentialStatus: "active",
      refreshTokenCiphertext: args.refreshTokenCiphertext,
      refreshTokenIv: args.refreshTokenIv,
      tokenKeyVersion: args.tokenKeyVersion,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getSecretForAction = internalQuery({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    return await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const markReauthRequired = internalMutation({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (connection) {
      await ctx.db.patch(connection._id, {
        credentialStatus: "reauth_required",
        updatedAt: Date.now(),
      });
    }
  },
});

export const disableGmail = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (connection) {
      await ctx.db.patch(connection._id, {
        gmailEnabled: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const disconnectGoogle = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (connection) await ctx.db.delete(connection._id);
    const states = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    for (const state of states) await ctx.db.delete(state._id);
  },
});
