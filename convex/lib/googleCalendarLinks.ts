import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReadCtx = Pick<QueryCtx, "db">;
type WriteCtx = Pick<MutationCtx, "db">;

export async function getGoogleCalendarLinkByEvent(
  ctx: ReadCtx,
  eventId: Id<"events">,
) {
  return await ctx.db
    .query("googleCalendarEventLinks")
    .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
    .unique();
}

export async function getGoogleCalendarLinkByGoogleEvent(
  ctx: ReadCtx,
  userId: Id<"users">,
  googleCalendarId: string,
  googleEventId: string,
) {
  return await ctx.db
    .query("googleCalendarEventLinks")
    .withIndex("by_user_calendar_event", (q) =>
      q
        .eq("userId", userId)
        .eq("googleCalendarId", googleCalendarId)
        .eq("googleEventId", googleEventId),
    )
    .unique();
}

export async function deleteGoogleCalendarLinkForEvent(
  ctx: WriteCtx,
  eventId: Id<"events">,
  userId: Id<"users">,
) {
  const link = await getGoogleCalendarLinkByEvent(ctx, eventId);
  if (link?.userId === userId) await ctx.db.delete(link._id);
}

export async function deleteGoogleCalendarLinksForUser(
  ctx: WriteCtx,
  userId: Id<"users">,
) {
  const links = await ctx.db
    .query("googleCalendarEventLinks")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const link of links) await ctx.db.delete(link._id);
}
