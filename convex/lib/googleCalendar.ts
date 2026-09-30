import { addCalendarDays, formatJapanEventDate } from "./eventTime";

export type GoogleCalendarEventResource = {
  id?: string;
  status?: string;
  eventType?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

export function isReadableCalendarRole(role: string | undefined) {
  return role === "reader" || role === "writer" || role === "owner" ||
    role === "writerWithoutPrivateAccess";
}

export function isWritableCalendarRole(role: string | undefined) {
  return role === "writer" || role === "owner" || role === "writerWithoutPrivateAccess";
}

export function extractGoogleMeetingUrl(event: GoogleCalendarEventResource) {
  if (event.hangoutLink?.startsWith("https://")) return event.hangoutLink;
  return event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri?.startsWith("https://"),
  )?.uri;
}

export function normalizeGoogleCalendarEvent(event: GoogleCalendarEventResource) {
  if (!event.id || event.status === "cancelled" || (event.eventType && event.eventType !== "default")) {
    return null;
  }
  if (event.start?.date && event.end?.date) {
    return {
      googleEventId: event.id,
      summary: event.summary?.trim() ?? "",
      description: event.description?.trim() || undefined,
      location: event.location?.trim() || undefined,
      meetingUrl: extractGoogleMeetingUrl(event),
      allDay: true as const,
      startDate: event.start.date,
      endDate: event.end.date,
    };
  }
  if (event.start?.dateTime && event.end?.dateTime) {
    const startTimestamp = Date.parse(event.start.dateTime);
    const endTimestamp = Date.parse(event.end.dateTime);
    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) return null;
    return {
      googleEventId: event.id,
      summary: event.summary?.trim() ?? "",
      description: event.description?.trim() || undefined,
      location: event.location?.trim() || undefined,
      meetingUrl: extractGoogleMeetingUrl(event),
      allDay: false as const,
      startTimestamp,
      endTimestamp,
    };
  }
  return null;
}

export function buildGoogleEventDescription(note?: string, meetingUrl?: string) {
  const parts = [note?.trim(), meetingUrl?.trim() ? `Meeting: ${meetingUrl.trim()}` : undefined]
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export function buildGoogleCalendarEventPayload(args: {
  summary: string;
  datetime: number;
  allDay: boolean;
  endTimestamp?: number;
  location?: string;
  note?: string;
  meetingUrl?: string;
}) {
  const description = buildGoogleEventDescription(args.note, args.meetingUrl);
  const common = {
    summary: args.summary,
    ...(args.location ? { location: args.location } : {}),
    ...(description ? { description } : {}),
  };
  if (args.allDay) {
    const startDate = formatJapanEventDate(args.datetime);
    return {
      ...common,
      start: { date: startDate },
      end: { date: addCalendarDays(startDate, 1) },
    };
  }
  if (!args.endTimestamp || args.endTimestamp <= args.datetime) {
    throw new Error("GOOGLE_CALENDAR_END_INVALID");
  }
  return {
    ...common,
    start: { dateTime: new Date(args.datetime).toISOString() },
    end: { dateTime: new Date(args.endTimestamp).toISOString() },
  };
}
