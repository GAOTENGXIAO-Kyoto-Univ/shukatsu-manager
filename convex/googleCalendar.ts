import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import { getOwnedSelectionStep } from "./lib/authorization";
import { buildEventFields, normalizeIndependentEventTitle } from "./lib/eventData";
import {
  normalizeEventDateTime,
} from "./lib/eventTime";
import {
  buildGoogleCalendarEventPayload,
  isReadableCalendarRole,
  isWritableCalendarRole,
  normalizeGoogleCalendarEvent,
  type GoogleCalendarEventResource,
} from "./lib/googleCalendar";
import {
  resolveOwnedGoogleCalendarEvent,
  toGoogleCalendarExportCandidate,
} from "./lib/googleCalendarEvents";
import {
  getGoogleCalendarLinkByEvent,
  getGoogleCalendarLinkByGoogleEvent,
} from "./lib/googleCalendarLinks";
import {
  decryptRefreshToken,
  GoogleIntegrationError,
  hasGoogleCapability,
  refreshGoogleAccessToken,
} from "./lib/googleOAuth";
import { getCurrentUserOrThrow } from "./users";

const GOOGLE_CALENDAR_API_ROOT = "https://www.googleapis.com/calendar/v3";
const nullableString = v.union(v.null(), v.string());
const timingTypeValidator = v.union(v.literal("scheduled"), v.literal("deadline"));

async function requireAuthUserId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED" });
  return identity.subject;
}

async function getCalendarAccessToken(
  ctx: ActionCtx,
  capability: "calendar_read" | "calendar_write",
) {
  const authUserId = await requireAuthUserId(ctx);
  const connection = await ctx.runQuery(internal.googleConnections.getSecretForAction, {
    authUserId,
  });
  if (!connection || !(connection.calendarEnabled ?? false)) {
    throw new ConvexError({ code: "GOOGLE_CALENDAR_NOT_CONNECTED" });
  }
  if (connection.credentialStatus !== "active") {
    throw new ConvexError({ code: "GOOGLE_REAUTH_REQUIRED" });
  }
  if (!hasGoogleCapability(connection.grantedScopes, capability)) {
    throw new ConvexError({
      code:
        capability === "calendar_write"
          ? "GOOGLE_CALENDAR_WRITE_SCOPE_MISSING"
          : "GOOGLE_CALENDAR_READ_SCOPE_MISSING",
    });
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

function calendarApiError(status: number, fallback: string) {
  if (status === 401) return new GoogleIntegrationError("GOOGLE_REAUTH_REQUIRED");
  if (status === 403) return new GoogleIntegrationError("GOOGLE_CALENDAR_ACCESS_DENIED");
  if (status === 404) return new GoogleIntegrationError("GOOGLE_CALENDAR_EVENT_NOT_FOUND");
  if (status === 429) return new GoogleIntegrationError("GOOGLE_CALENDAR_RATE_LIMITED");
  return new GoogleIntegrationError(fallback);
}

async function calendarFetch<T>(accessToken: string, path: string) {
  let response: Response;
  try {
    response = await fetch(`${GOOGLE_CALENDAR_API_ROOT}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new GoogleIntegrationError("GOOGLE_CALENDAR_API_FAILED");
  }
  if (!response.ok) throw calendarApiError(response.status, "GOOGLE_CALENDAR_API_FAILED");
  return (await response.json()) as T;
}

function rethrowCalendarError(error: unknown): never {
  if (error instanceof ConvexError) throw error;
  if (error instanceof GoogleIntegrationError) {
    throw new ConvexError({ code: error.code });
  }
  if (error instanceof Error && error.message.startsWith("GOOGLE_CALENDAR_")) {
    throw new ConvexError({ code: error.message });
  }
  throw new ConvexError({ code: "GOOGLE_CALENDAR_API_FAILED" });
}

async function handleCalendarError(ctx: ActionCtx, error: unknown): Promise<never> {
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
  return rethrowCalendarError(error);
}

function assertGoogleId(value: string) {
  if (!value.trim() || value.length > 1024) {
    throw new ConvexError({ code: "GOOGLE_CALENDAR_REQUEST_INVALID" });
  }
}

export const listCalendars = action({
  args: {},
  handler: async (ctx) => {
    try {
      const { accessToken } = await getCalendarAccessToken(ctx, "calendar_read");
      const calendars: Array<{
        id: string;
        summary: string;
        primary: boolean;
        accessRole: string;
        timeZone?: string;
        readable: boolean;
        writable: boolean;
      }> = [];
      let pageToken: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const params = new URLSearchParams({ maxResults: "250" });
        if (pageToken) params.set("pageToken", pageToken);
        const result = await calendarFetch<{
          items?: Array<{
            id?: string;
            summary?: string;
            primary?: boolean;
            accessRole?: string;
            timeZone?: string;
          }>;
          nextPageToken?: string;
        }>(accessToken, `/users/me/calendarList?${params.toString()}`);
        for (const calendar of result.items ?? []) {
          if (!calendar.id) continue;
          calendars.push({
            id: calendar.id,
            summary: calendar.summary?.trim() || calendar.id,
            primary: Boolean(calendar.primary),
            accessRole: calendar.accessRole ?? "none",
            timeZone: calendar.timeZone,
            readable: isReadableCalendarRole(calendar.accessRole),
            writable: isWritableCalendarRole(calendar.accessRole),
          });
        }
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }
      return calendars.sort(
        (left, right) => Number(right.primary) - Number(left.primary) || left.summary.localeCompare(right.summary),
      );
    } catch (error) {
      return await handleCalendarError(ctx, error);
    }
  },
});

export const listEvents = action({
  args: {
    calendarId: v.string(),
    timeMin: v.string(),
    timeMax: v.string(),
    pageToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      assertGoogleId(args.calendarId);
      const start = Date.parse(args.timeMin);
      const end = Date.parse(args.timeMax);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start >= end ||
        end - start > 370 * 24 * 60 * 60 * 1000 ||
        (args.pageToken?.length ?? 0) > 2048
      ) {
        throw new ConvexError({ code: "GOOGLE_CALENDAR_REQUEST_INVALID" });
      }
      const { accessToken } = await getCalendarAccessToken(ctx, "calendar_read");
      const params = new URLSearchParams({
        eventTypes: "default",
        maxResults: "50",
        orderBy: "startTime",
        showDeleted: "false",
        singleEvents: "true",
        timeMin: new Date(start).toISOString(),
        timeMax: new Date(end).toISOString(),
      });
      if (args.pageToken) params.set("pageToken", args.pageToken);
      const result = await calendarFetch<{
        items?: GoogleCalendarEventResource[];
        nextPageToken?: string;
      }>(
        accessToken,
        `/calendars/${encodeURIComponent(args.calendarId)}/events?${params.toString()}`,
      );
      return {
        events: (result.items ?? [])
          .map(normalizeGoogleCalendarEvent)
          .filter((event): event is NonNullable<typeof event> => event !== null),
        nextPageToken: result.nextPageToken,
      };
    } catch (error) {
      return await handleCalendarError(ctx, error);
    }
  },
});

export const getEventPreview = action({
  args: { calendarId: v.string(), googleEventId: v.string() },
  handler: async (ctx, args): Promise<
    NonNullable<ReturnType<typeof normalizeGoogleCalendarEvent>> & {
      linkedEventId: Id<"events"> | undefined;
    }
  > => {
    try {
      assertGoogleId(args.calendarId);
      assertGoogleId(args.googleEventId);
      const { accessToken, authUserId } = await getCalendarAccessToken(ctx, "calendar_read");
      const event = await calendarFetch<GoogleCalendarEventResource>(
        accessToken,
        `/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.googleEventId)}`,
      );
      const normalized = normalizeGoogleCalendarEvent(event);
      if (!normalized) {
        throw new ConvexError({ code: "GOOGLE_CALENDAR_EVENT_UNSUPPORTED" });
      }
      const link: { eventId: Id<"events"> } | null = await ctx.runQuery(internal.googleCalendarInternal.getImportLinkState, {
        authUserId,
        googleCalendarId: args.calendarId,
        googleEventId: args.googleEventId,
      });
      return { ...normalized, linkedEventId: link?.eventId };
    } catch (error) {
      return await handleCalendarError(ctx, error);
    }
  },
});

export const finalizeImport = mutation({
  args: {
    googleCalendarId: v.string(),
    googleEventId: v.string(),
    targetKind: v.union(v.literal("independent"), v.literal("selection_step")),
    title: v.string(),
    selectionStepId: v.optional(v.id("selectionSteps")),
    overwriteExisting: v.boolean(),
    timingType: timingTypeValidator,
    date: v.string(),
    time: nullableString,
    location: nullableString,
    meetingUrl: nullableString,
    note: nullableString,
  },
  handler: async (ctx, args) => {
    assertGoogleId(args.googleCalendarId);
    assertGoogleId(args.googleEventId);
    const user = await getCurrentUserOrThrow(ctx);
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (
      !connection ||
      !(connection.calendarEnabled ?? false) ||
      !hasGoogleCapability(connection.grantedScopes, "calendar_read")
    ) {
      throw new ConvexError({ code: "GOOGLE_CALENDAR_NOT_CONNECTED" });
    }
    const duplicate = await getGoogleCalendarLinkByGoogleEvent(
      ctx,
      user._id,
      args.googleCalendarId,
      args.googleEventId,
    );
    if (duplicate) throw new ConvexError({ code: "GOOGLE_CALENDAR_ALREADY_IMPORTED" });

    const fields = buildEventFields(args);
    let eventId: Id<"events">;
    if (args.targetKind === "independent") {
      eventId = await ctx.db.insert("events", {
        userId: user._id,
        title: normalizeIndependentEventTitle(args.title),
        ...fields,
      });
    } else {
      if (!args.selectionStepId) {
        throw new ConvexError({ code: "GOOGLE_CALENDAR_TARGET_REQUIRED" });
      }
      const owned = await getOwnedSelectionStep(ctx, args.selectionStepId);
      if (!owned) throw new ConvexError({ code: "GOOGLE_CALENDAR_TARGET_NOT_FOUND" });
      const existing = await ctx.db
        .query("events")
        .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", owned.selectionStep._id))
        .unique();
      if (existing) {
        if (!args.overwriteExisting) {
          throw new ConvexError({ code: "GOOGLE_CALENDAR_EVENT_CONFLICT" });
        }
        if (await getGoogleCalendarLinkByEvent(ctx, existing._id)) {
          throw new ConvexError({ code: "GOOGLE_CALENDAR_LOCAL_EVENT_ALREADY_LINKED" });
        }
        await ctx.db.replace(existing._id, {
          userId: user._id,
          selectionStepId: owned.selectionStep._id,
          ...fields,
        });
        eventId = existing._id;
      } else {
        eventId = await ctx.db.insert("events", {
          userId: user._id,
          selectionStepId: owned.selectionStep._id,
          ...fields,
        });
      }
    }
    const now = Date.now();
    await ctx.db.insert("googleCalendarEventLinks", {
      userId: user._id,
      eventId,
      googleCalendarId: args.googleCalendarId,
      googleEventId: args.googleEventId,
      createdAt: now,
      updatedAt: now,
    });
    return { eventId, targetKind: args.targetKind };
  },
});

export const getExportCandidate = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const source = await resolveOwnedGoogleCalendarEvent(ctx, user, args.eventId);
    if (!source) return null;
    const connection = await ctx.db
      .query("googleConnections")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    const link = await getGoogleCalendarLinkByEvent(ctx, source.event._id);
    return {
      ...toGoogleCalendarExportCandidate(source),
      linked: Boolean(link),
      calendarEnabled: connection?.calendarEnabled ?? false,
      credentialStatus: connection?.credentialStatus ?? null,
      hasCalendarReadScope: connection
        ? hasGoogleCapability(connection.grantedScopes, "calendar_read")
        : false,
      hasCalendarWriteScope: connection
        ? hasGoogleCapability(connection.grantedScopes, "calendar_write")
        : false,
    };
  },
});

export const addEventToGoogle = action({
  args: {
    eventId: v.id("events"),
    calendarId: v.string(),
    endDate: v.optional(v.string()),
    endTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      assertGoogleId(args.calendarId);
      const { accessToken, authUserId } = await getCalendarAccessToken(ctx, "calendar_write");
      const source = await ctx.runQuery(internal.googleCalendarInternal.getExportSourceForAction, {
        authUserId,
        eventId: args.eventId,
      });
      if (source.linked) {
        throw new ConvexError({ code: "GOOGLE_CALENDAR_LOCAL_EVENT_ALREADY_LINKED" });
      }
      const calendar = await calendarFetch<{ accessRole?: string }>(
        accessToken,
        `/users/me/calendarList/${encodeURIComponent(args.calendarId)}`,
      );
      if (!isWritableCalendarRole(calendar.accessRole)) {
        throw new ConvexError({ code: "GOOGLE_CALENDAR_NOT_WRITABLE" });
      }
      let endTimestamp: number | undefined;
      if (!source.allDay) {
        if (!args.endDate || !args.endTime) {
          throw new ConvexError({ code: "GOOGLE_CALENDAR_END_INVALID" });
        }
        endTimestamp = normalizeEventDateTime("scheduled", args.endDate, args.endTime).datetime;
        if (endTimestamp <= source.datetime || endTimestamp - source.datetime > 7 * 24 * 60 * 60 * 1000) {
          throw new ConvexError({ code: "GOOGLE_CALENDAR_END_INVALID" });
        }
      }
      const payload = buildGoogleCalendarEventPayload({
        summary: source.title,
        datetime: source.datetime,
        allDay: source.allDay,
        endTimestamp,
        location: source.location,
        note: source.note,
        meetingUrl: source.meetingUrl,
      });
      let response: Response;
      try {
        response = await fetch(
          `${GOOGLE_CALENDAR_API_ROOT}/calendars/${encodeURIComponent(args.calendarId)}/events?sendUpdates=none`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
      } catch {
        throw new ConvexError({ code: "GOOGLE_CALENDAR_EXPORT_RESULT_UNKNOWN" });
      }
      if (!response.ok) throw calendarApiError(response.status, "GOOGLE_CALENDAR_EXPORT_FAILED");
      const created = (await response.json()) as { id?: string };
      if (!created.id) {
        throw new ConvexError({ code: "GOOGLE_CALENDAR_EXPORT_RESULT_UNKNOWN" });
      }
      try {
        await ctx.runMutation(internal.googleCalendarInternal.recordExportLink, {
          authUserId,
          eventId: args.eventId,
          googleCalendarId: args.calendarId,
          googleEventId: created.id,
        });
      } catch (persistenceError) {
        let compensated = false;
        try {
          const deleteResponse = await fetch(
            `${GOOGLE_CALENDAR_API_ROOT}/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(created.id)}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
          );
          compensated = deleteResponse.ok || deleteResponse.status === 404;
        } catch {
          compensated = false;
        }
        if (!compensated) {
          throw new ConvexError({ code: "GOOGLE_CALENDAR_EXPORT_PARTIAL_FAILURE" });
        }
        if (persistenceError instanceof ConvexError) throw persistenceError;
        throw new ConvexError({ code: "GOOGLE_CALENDAR_EXPORT_LINK_FAILED" });
      }
      return { exported: true as const, googleEventId: created.id };
    } catch (error) {
      return await handleCalendarError(ctx, error);
    }
  },
});
