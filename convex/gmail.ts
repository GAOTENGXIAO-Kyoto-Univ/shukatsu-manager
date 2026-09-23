import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import {
  extractGmailBody,
  getGmailHeader,
  type GmailMessageResource,
} from "./lib/gmailMessage";
import {
  decryptRefreshToken,
  GMAIL_READONLY_SCOPE,
  GoogleIntegrationError,
  refreshGoogleAccessToken,
} from "./lib/googleOAuth";
import { parseRecruitingMail } from "./lib/gmailParser";

const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";

async function requireAuthUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED" });
  return identity.subject;
}

async function getAccessToken(
  ctx: ActionCtx,
) {
  const authUserId = await requireAuthUserId(ctx);
  const connection = await ctx.runQuery(internal.googleConnections.getSecretForAction, {
    authUserId,
  });
  if (!connection || !connection.gmailEnabled) {
    throw new ConvexError({ code: "GMAIL_NOT_CONNECTED" });
  }
  if (connection.credentialStatus !== "active") {
    throw new ConvexError({ code: "GOOGLE_REAUTH_REQUIRED" });
  }
  if (!connection.grantedScopes.includes(GMAIL_READONLY_SCOPE)) {
    throw new ConvexError({ code: "GOOGLE_GMAIL_SCOPE_MISSING" });
  }
  try {
    const refreshToken = await decryptRefreshToken(
      connection.refreshTokenCiphertext,
      connection.refreshTokenIv,
    );
    return {
      accessToken: await refreshGoogleAccessToken(refreshToken),
      authUserId,
    };
  } catch (error) {
    if (
      error instanceof GoogleIntegrationError &&
      error.code === "GOOGLE_REAUTH_REQUIRED"
    ) {
      await ctx.runMutation(internal.googleConnections.markReauthRequired, {
        authUserId,
      });
    }
    throw error;
  }
}

async function gmailFetch<T>(accessToken: string, path: string) {
  const response = await fetch(`${GMAIL_API_ROOT}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GoogleIntegrationError("GOOGLE_REAUTH_REQUIRED");
    }
    throw new GoogleIntegrationError("GMAIL_API_FAILED");
  }
  return (await response.json()) as T;
}

function rethrowGmailError(error: unknown): never {
  if (error instanceof ConvexError) throw error;
  if (error instanceof GoogleIntegrationError) {
    throw new ConvexError({ code: error.code });
  }
  if (error instanceof Error && error.message.startsWith("GMAIL_")) {
    throw new ConvexError({ code: error.message });
  }
  throw new ConvexError({ code: "GMAIL_API_FAILED" });
}

async function handleGmailError(ctx: ActionCtx, error: unknown): Promise<never> {
  if (
    error instanceof GoogleIntegrationError &&
    error.code === "GOOGLE_REAUTH_REQUIRED"
  ) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      await ctx.runMutation(internal.googleConnections.markReauthRequired, {
        authUserId: identity.subject,
      });
    }
  }
  return rethrowGmailError(error);
}

async function fetchMessageMetadata(accessToken: string, messageId: string) {
  const params = new URLSearchParams({ format: "metadata" });
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "Subject");
  const message = await gmailFetch<GmailMessageResource>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
  );
  return {
    messageId,
    threadId: message.threadId ?? "",
    from: getGmailHeader(message.payload, "From"),
    subject: getGmailHeader(message.payload, "Subject"),
    internalDate: Number(message.internalDate ?? 0),
    snippet: message.snippet ?? "",
  };
}

async function fetchFullMessage(accessToken: string, messageId: string) {
  const message = await gmailFetch<GmailMessageResource>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=full`,
  );
  const body = await extractGmailBody(message, async (attachmentId) => {
    const attachment = await gmailFetch<{ data?: string }>(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    if (!attachment.data) throw new Error("GMAIL_BODY_DECODE_FAILED");
    return attachment.data;
  });
  return {
    messageId,
    threadId: message.threadId ?? "",
    internalDate: Number(message.internalDate ?? 0),
    subject: getGmailHeader(message.payload, "Subject"),
    from: getGmailHeader(message.payload, "From"),
    replyTo: getGmailHeader(message.payload, "Reply-To") || undefined,
    snippet: message.snippet ?? "",
    ...body,
  };
}

export const listMessages = action({
  args: {
    query: v.optional(v.string()),
    pageToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const query = args.query?.trim();
      if ((query?.length ?? 0) > 500 || (args.pageToken?.length ?? 0) > 2048) {
        throw new ConvexError({ code: "GMAIL_REQUEST_INVALID" });
      }
      const { accessToken } = await getAccessToken(ctx);
      const params = new URLSearchParams({ maxResults: "12" });
      if (query) params.set("q", query);
      if (args.pageToken) params.set("pageToken", args.pageToken);
      const result = await gmailFetch<{
        messages?: { id?: string }[];
        nextPageToken?: string;
      }>(accessToken, `/messages?${params.toString()}`);
      const messageIds = (result.messages ?? [])
        .map((message) => message.id)
        .filter((id): id is string => Boolean(id));
      const messages = await Promise.all(
        messageIds.map((messageId) => fetchMessageMetadata(accessToken, messageId)),
      );
      return { messages, nextPageToken: result.nextPageToken };
    } catch (error) {
      return await handleGmailError(ctx, error);
    }
  },
});

export const getMessagePreview = action({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    try {
      if (!args.messageId.trim() || args.messageId.length > 256) {
        throw new ConvexError({ code: "GMAIL_REQUEST_INVALID" });
      }
      const { accessToken } = await getAccessToken(ctx);
      return await fetchFullMessage(accessToken, args.messageId);
    } catch (error) {
      return await handleGmailError(ctx, error);
    }
  },
});

export const parseSelectedMessage = action({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    try {
      if (!args.messageId.trim() || args.messageId.length > 256) {
        throw new ConvexError({ code: "GMAIL_REQUEST_INVALID" });
      }
      const { accessToken } = await getAccessToken(ctx);
      const message = await fetchFullMessage(accessToken, args.messageId);
      return { message, parsed: parseRecruitingMail(message) };
    } catch (error) {
      return await handleGmailError(ctx, error);
    }
  },
});
