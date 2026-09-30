import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import {
  resolveOwnedGoogleCalendarEvent,
  toGoogleCalendarExportCandidate,
} from "./lib/googleCalendarEvents";
import {
  getGoogleCalendarLinkByEvent,
  getGoogleCalendarLinkByGoogleEvent,
} from "./lib/googleCalendarLinks";

async function getUserByAuthId(
  ctx: Parameters<typeof resolveOwnedGoogleCalendarEvent>[0],
  authUserId: string,
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
  return user;
}

export const getImportLinkState = internalQuery({
  args: {
    authUserId: v.string(),
    googleCalendarId: v.string(),
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    const link = await getGoogleCalendarLinkByGoogleEvent(
      ctx,
      user._id,
      args.googleCalendarId,
      args.googleEventId,
    );
    return link ? { eventId: link.eventId } : null;
  },
});

export const getExportSourceForAction = internalQuery({
  args: { authUserId: v.string(), eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    const source = await resolveOwnedGoogleCalendarEvent(ctx, user, args.eventId);
    if (!source) throw new ConvexError({ code: "GOOGLE_CALENDAR_EVENT_NOT_FOUND" });
    const link = await getGoogleCalendarLinkByEvent(ctx, args.eventId);
    return { ...toGoogleCalendarExportCandidate(source), linked: Boolean(link) };
  },
});

export const recordExportLink = internalMutation({
  args: {
    authUserId: v.string(),
    eventId: v.id("events"),
    googleCalendarId: v.string(),
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByAuthId(ctx, args.authUserId);
    const source = await resolveOwnedGoogleCalendarEvent(ctx, user, args.eventId);
    if (!source) throw new ConvexError({ code: "GOOGLE_CALENDAR_EVENT_NOT_FOUND" });
    if (await getGoogleCalendarLinkByEvent(ctx, args.eventId)) {
      throw new ConvexError({ code: "GOOGLE_CALENDAR_LOCAL_EVENT_ALREADY_LINKED" });
    }
    if (
      await getGoogleCalendarLinkByGoogleEvent(
        ctx,
        user._id,
        args.googleCalendarId,
        args.googleEventId,
      )
    ) {
      throw new ConvexError({ code: "GOOGLE_CALENDAR_ALREADY_IMPORTED" });
    }
    const now = Date.now();
    return await ctx.db.insert("googleCalendarEventLinks", {
      userId: user._id,
      eventId: args.eventId,
      googleCalendarId: args.googleCalendarId,
      googleEventId: args.googleEventId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
