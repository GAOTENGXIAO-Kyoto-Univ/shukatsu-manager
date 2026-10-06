import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { hasGoogleCapability, hasLegacyGmailScope } from "./lib/googleOAuth";

const capabilityValidator = v.union(
  v.literal("gmail"),
  v.literal("calendar_read"),
  v.literal("calendar_write"),
);

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
    const legacyGmailScopePresent = hasLegacyGmailScope(connection.grantedScopes);
    return {
      email: connection.email,
      calendarEnabled: connection.calendarEnabled ?? false,
      hasCalendarReadScope:
        !legacyGmailScopePresent &&
        hasGoogleCapability(connection.grantedScopes, "calendar_read"),
      hasCalendarWriteScope:
        !legacyGmailScopePresent &&
        hasGoogleCapability(connection.grantedScopes, "calendar_write"),
      hasLegacyGmailScope: legacyGmailScopePresent,
      credentialStatus: legacyGmailScopePresent
        ? "reauth_required" as const
        : connection.credentialStatus,
      updatedAt: connection.updatedAt,
    };
  },
});

export const createOAuthState = internalMutation({
  args: {
    authUserId: v.string(),
    stateHash: v.string(),
    expiresAt: v.number(),
    requestedCapability: capabilityValidator,
  },
  handler: async (ctx, args) => {
    if (args.requestedCapability === "gmail") {
      throw new ConvexError({ code: "GOOGLE_OAUTH_STATE_INVALID" });
    }
    const user = await getUserByAuthId(ctx, args.authUserId);
    const existing = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    for (const state of existing) await ctx.db.delete(state._id);
    await ctx.db.insert("googleOAuthStates", {
      userId: user._id,
      stateHash: args.stateHash,
      requestedCapability: args.requestedCapability,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const inspectOAuthState = internalQuery({
  args: { authUserId: v.string(), stateHash: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    const state = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_state_hash", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!state || state.userId !== user._id || state.expiresAt < Date.now()) {
      throw new ConvexError({ code: "GOOGLE_OAUTH_STATE_INVALID" });
    }
    return { requestedCapability: state.requestedCapability };
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
    requestedCapability: capabilityValidator,
    stateHash: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.requestedCapability === "gmail") {
      throw new ConvexError({ code: "GOOGLE_OAUTH_STATE_INVALID" });
    }
    const user = await getUserByAuthId(ctx, args.authUserId);
    const state = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_state_hash", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (
      !state ||
      state.userId !== user._id ||
      state.expiresAt < Date.now() ||
      state.requestedCapability !== args.requestedCapability
    ) {
      throw new ConvexError({ code: "GOOGLE_OAUTH_STATE_INVALID" });
    }
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (connection && connection.googleAccountId !== args.googleAccountId) {
      throw new ConvexError({ code: "GOOGLE_ACCOUNT_MISMATCH" });
    }
    await ctx.db.delete(state._id);
    const now = Date.now();
    if (connection) {
      await ctx.db.patch(connection._id, {
        email: args.email,
        grantedScopes: args.grantedScopes,
        gmailEnabled: false,
        calendarEnabled: hasGoogleCapability(
          args.grantedScopes,
          args.requestedCapability,
        ),
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
      gmailEnabled: false,
      calendarEnabled: hasGoogleCapability(
        args.grantedScopes,
        args.requestedCapability,
      ),
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

export const disableCalendar = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (connection) {
      await ctx.db.patch(connection._id, {
        calendarEnabled: false,
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
    const links = await ctx.db
      .query("googleCalendarEventLinks")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    for (const link of links) await ctx.db.delete(link._id);
    const states = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    for (const state of states) await ctx.db.delete(state._id);
  },
});
