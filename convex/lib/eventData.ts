import {
  normalizeEventDateTime,
  normalizeMeetingUrl,
  normalizeOptionalEventText,
  type EventTimingType,
} from "./eventTime";

export function buildEventFields(args: {
  timingType: EventTimingType;
  date: string;
  time: string | null | undefined;
  location: string | null | undefined;
  meetingUrl: string | null | undefined;
  note: string | null | undefined;
}) {
  const normalized = normalizeEventDateTime(args.timingType, args.date, args.time);
  const location = normalizeOptionalEventText(args.location);
  const meetingUrl = normalizeMeetingUrl(args.meetingUrl);
  const note = normalizeOptionalEventText(args.note);

  return {
    ...normalized,
    timingType: args.timingType,
    ...(location ? { location } : {}),
    ...(meetingUrl ? { meetingUrl } : {}),
    ...(note ? { note } : {}),
    updatedAt: Date.now(),
  };
}

export function normalizeIndependentEventTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) throw new Error("标题不能为空");
  return normalized;
}
