import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { formatJapanEventDate, formatJapanEventTime } from "./eventTime";

type DatabaseCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export async function resolveOwnedGoogleCalendarEvent(
  ctx: DatabaseCtx,
  user: Doc<"users">,
  eventId: Id<"events">,
) {
  const event = await ctx.db.get(eventId);
  if (!event || event.userId !== user._id) return null;
  if (!event.selectionStepId) {
    if (!event.title?.trim()) return null;
    return { event, title: event.title.trim(), kind: "independent" as const };
  }
  const step = await ctx.db.get(event.selectionStepId);
  const application = step ? await ctx.db.get(step.applicationId) : null;
  const company = application ? await ctx.db.get(application.companyId) : null;
  if (!step || !application || !company || company.userId !== user._id) return null;
  return {
    event,
    title: `${company.name.trim()}｜${application.jobTitle.trim()}｜${step.name.trim()}`,
    kind: "selection" as const,
  };
}

export function toGoogleCalendarExportCandidate(
  source: NonNullable<Awaited<ReturnType<typeof resolveOwnedGoogleCalendarEvent>>>,
) {
  const allDay = source.event.timingType === "deadline" && !source.event.hasExplicitTime;
  return {
    eventId: source.event._id,
    kind: source.kind,
    title: source.title,
    datetime: source.event.datetime,
    timingType: source.event.timingType,
    hasExplicitTime: source.event.hasExplicitTime,
    allDay,
    date: formatJapanEventDate(source.event.datetime),
    time: formatJapanEventTime(source.event.datetime),
    endDate: formatJapanEventDate(source.event.datetime + 60 * 60 * 1000),
    endTime: formatJapanEventTime(source.event.datetime + 60 * 60 * 1000),
    location: source.event.location,
    meetingUrl: source.event.meetingUrl,
    note: source.event.note,
  };
}
