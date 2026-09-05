export type EventTimingType = "scheduled" | "deadline";

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{2}):(\d{2})$/;
const japanOffsetMilliseconds = 9 * 60 * 60 * 1000;

export function getJapanDayStart(timestamp: number) {
  const shifted = new Date(timestamp + japanOffsetMilliseconds);
  return (
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
    japanOffsetMilliseconds
  );
}

export function getJapanDayStartAfter(timestamp: number, days: number) {
  return getJapanDayStart(timestamp) + days * 24 * 60 * 60 * 1000;
}

export function normalizeEventDateTime(
  timingType: EventTimingType,
  date: string,
  time: string | null | undefined,
) {
  const dateMatch = datePattern.exec(date.trim());

  if (!dateMatch) {
    throw new Error("日期格式不正确");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));

  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) {
    throw new Error("日期格式不正确");
  }

  const normalizedTime = time?.trim() || null;

  if (timingType === "scheduled" && !normalizedTime) {
    throw new Error("预定时间必须填写时间");
  }

  let hour = 23;
  let minute = 59;
  let second = 59;
  let millisecond = 999;

  if (normalizedTime) {
    const timeMatch = timePattern.exec(normalizedTime);

    if (!timeMatch) {
      throw new Error("时间格式不正确");
    }

    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    second = 0;
    millisecond = 0;

    if (hour > 23 || minute > 59) {
      throw new Error("时间格式不正确");
    }
  }

  return {
    datetime:
      Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
      japanOffsetMilliseconds,
    hasExplicitTime: normalizedTime !== null,
  };
}

export function normalizeOptionalEventText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeMeetingUrl(value: string | null | undefined) {
  const trimmed = normalizeOptionalEventText(value);

  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new Error("会议链接格式不正确");
  }

  return trimmed;
}
