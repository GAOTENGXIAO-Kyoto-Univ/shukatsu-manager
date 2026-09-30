import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  buildGoogleAuthorizationUrl,
  createOAuthState,
  encryptRefreshToken,
  exchangeAuthorizationCode,
  getGoogleAccountIdentity,
  hasGoogleCapability,
  type GoogleOAuthCapability,
  GoogleIntegrationError,
  hashOAuthState,
} from "./lib/googleOAuth";

async function requireAuthUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED" });
  return identity.subject;
}
function rethrowGoogleError(error: unknown): never {
  if (error instanceof ConvexError) throw error;
  if (error instanceof GoogleIntegrationError) {
    throw new ConvexError({ code: error.code });
  }
  throw new ConvexError({ code: "GOOGLE_CONNECTION_FAILED" });
}

export const beginGmailAuthorization = action({
  args: {},
  handler: async (ctx) => {
    try {
      const authUserId = await requireAuthUserId(ctx);
      const state = createOAuthState();
      await ctx.runMutation(internal.googleConnections.createOAuthState, {
        authUserId,
        stateHash: await hashOAuthState(state),
        expiresAt: Date.now() + 10 * 60 * 1000,
        requestedCapability: "gmail",
      });
      return { authorizationUrl: buildGoogleAuthorizationUrl(state, "gmail") };
    } catch (error) {
      return rethrowGoogleError(error);
    }
  },
});

export const beginCalendarAuthorization = action({
  args: { access: v.union(v.literal("read"), v.literal("write")) },
  handler: async (ctx, args) => {
    try {
      const authUserId = await requireAuthUserId(ctx);
      const state = createOAuthState();
      const requestedCapability: GoogleOAuthCapability =
        args.access === "write" ? "calendar_write" : "calendar_read";
      await ctx.runMutation(internal.googleConnections.createOAuthState, {
        authUserId,
        stateHash: await hashOAuthState(state),
        expiresAt: Date.now() + 10 * 60 * 1000,
        requestedCapability,
      });
      return {
        authorizationUrl: buildGoogleAuthorizationUrl(state, requestedCapability),
      };
    } catch (error) {
      return rethrowGoogleError(error);
    }
  },
});

export const completeGmailAuthorization = action({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, args): Promise<{
    connected: true;
    email: string | undefined;
    capability: GoogleOAuthCapability;
  }> => {
    try {
      if (!args.code.trim() || args.code.length > 4096 || !args.state.trim() || args.state.length > 1024) {
        throw new ConvexError({ code: "GOOGLE_OAUTH_CALLBACK_INVALID" });
      }
      const authUserId = await requireAuthUserId(ctx);
      const stateHash = await hashOAuthState(args.state);
      const oauthState: { requestedCapability: GoogleOAuthCapability } = await ctx.runQuery(internal.googleConnections.inspectOAuthState, {
        authUserId,
        stateHash,
      });
      const tokens = await exchangeAuthorizationCode(args.code);
      const identity = await getGoogleAccountIdentity(tokens.access_token!);
      const grantedScopes = Array.from(
        new Set((tokens.scope ?? "").split(/\s+/u).filter(Boolean)),
      );
      if (!hasGoogleCapability(grantedScopes, oauthState.requestedCapability)) {
        const code = oauthState.requestedCapability === "gmail"
          ? "GOOGLE_GMAIL_SCOPE_MISSING"
          : oauthState.requestedCapability === "calendar_write"
            ? "GOOGLE_CALENDAR_WRITE_SCOPE_MISSING"
            : "GOOGLE_CALENDAR_READ_SCOPE_MISSING";
        throw new ConvexError({ code });
      }
      const encrypted = tokens.refresh_token
        ? await encryptRefreshToken(tokens.refresh_token)
        : null;
      await ctx.runMutation(internal.googleConnections.saveAuthorization, {
        authUserId,
        googleAccountId: identity.googleAccountId,
        email: identity.email,
        grantedScopes,
        requestedCapability: oauthState.requestedCapability,
        stateHash,
        ...(encrypted
          ? {
              refreshTokenCiphertext: encrypted.ciphertext,
              refreshTokenIv: encrypted.iv,
              tokenKeyVersion: encrypted.keyVersion,
            }
          : {}),
      });
      return {
        connected: true as const,
        email: identity.email,
        capability: oauthState.requestedCapability,
      };
    } catch (error) {
      return rethrowGoogleError(error);
    }
  },
});
