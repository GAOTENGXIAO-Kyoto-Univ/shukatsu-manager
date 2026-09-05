import type { EventTimingType } from '@/components/applications/types';

export const eventTimeZone = 'Asia/Tokyo';

type DisplayEvent = {
  datetime: number;
  timingType: EventTimingType;
  hasExplicitTime: boolean;
};

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: eventTimeZone,
  month: 'numeric',
  day: 'numeric',
});
const longDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: eventTimeZone,
  month: 'long',
  day: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: eventTimeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const formFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: eventTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function shouldShowTime(event: DisplayEvent) {
  return event.timingType === 'scheduled' || event.hasExplicitTime;
}

export function formatEventDate(event: DisplayEvent, context: 'compact' | 'detail' = 'compact') {
  const date = new Date(event.datetime);
  const dateText = context === 'detail' ? longDateFormatter.format(date) : dateFormatter.format(date);
  return shouldShowTime(event) ? `${dateText} ${timeFormatter.format(date)}` : dateText;
}

export function formatEventTime(datetime: number) {
  return timeFormatter.format(new Date(datetime));
}

export function formatEventMonthDay(datetime: number) {
  return dateFormatter.format(new Date(datetime));
}

export function formatEventSummary(event: DisplayEvent) {
  return `${event.timingType === 'scheduled' ? '预定于' : '截止于'} ${formatEventDate(event)}`;
}

export function getEventLabel(stepName: string, timingType: EventTimingType) {
  return timingType === 'deadline' ? `${stepName} 截止` : stepName;
}

export function eventToFormValues(event: DisplayEvent) {
  const parts = Object.fromEntries(
    formFormatter.formatToParts(new Date(event.datetime)).map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: shouldShowTime(event) ? `${parts.hour}:${parts.minute}` : '',
  };
}
