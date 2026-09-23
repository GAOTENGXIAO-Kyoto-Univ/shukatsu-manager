import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  buildGmailAuthorizationUrl,
  createOAuthState,
  encryptRefreshToken,
  exchangeAuthorizationCode,
  getGoogleAccountIdentity,
  GMAIL_READONLY_SCOPE,
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
      });
      return { authorizationUrl: buildGmailAuthorizationUrl(state) };
    } catch (error) {
      return rethrowGoogleError(error);
    }
  },
});

export const completeGmailAuthorization = action({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, args) => {
    try {
      if (!args.code.trim() || args.code.length > 4096 || !args.state.trim() || args.state.length > 1024) {
        throw new ConvexError({ code: "GOOGLE_OAUTH_CALLBACK_INVALID" });
      }
      const authUserId = await requireAuthUserId(ctx);
      await ctx.runMutation(internal.googleConnections.consumeOAuthState, {
        authUserId,
        stateHash: await hashOAuthState(args.state),
      });
      const tokens = await exchangeAuthorizationCode(args.code);
      const identity = await getGoogleAccountIdentity(tokens.access_token!);
      const grantedScopes = Array.from(
        new Set((tokens.scope ?? "").split(/\s+/u).filter(Boolean)),
      );
      if (!grantedScopes.includes(GMAIL_READONLY_SCOPE)) {
        throw new ConvexError({ code: "GOOGLE_GMAIL_SCOPE_MISSING" });
      }
      const encrypted = tokens.refresh_token
        ? await encryptRefreshToken(tokens.refresh_token)
        : null;
      await ctx.runMutation(internal.googleConnections.saveAuthorization, {
        authUserId,
        googleAccountId: identity.googleAccountId,
        email: identity.email,
        grantedScopes,
        ...(encrypted
          ? {
              refreshTokenCiphertext: encrypted.ciphertext,
              refreshTokenIv: encrypted.iv,
              tokenKeyVersion: encrypted.keyVersion,
            }
          : {}),
      });
      return { connected: true as const, email: identity.email };
    } catch (error) {
      return rethrowGoogleError(error);
    }
  },
});
