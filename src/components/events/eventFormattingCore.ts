import type { AppLocale } from '../../i18n/locale';

export const eventTimeZone = 'Asia/Tokyo';

export type LocalizedDisplayEvent = {
  datetime: number;
  timingType: 'scheduled' | 'deadline';
  hasExplicitTime: boolean;
};

const formFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: eventTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function shouldShowEventTime(event: LocalizedDisplayEvent) {
  return event.timingType === 'scheduled' || event.hasExplicitTime;
}

export function formatEventTimeForLocale(datetime: number, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: eventTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(datetime));
}

export function formatEventDateForLocale(
  event: LocalizedDisplayEvent,
  locale: AppLocale,
  context: 'compact' | 'detail' = 'compact',
) {
  const dateText = new Intl.DateTimeFormat(locale, {
    timeZone: eventTimeZone,
    month: context === 'detail' ? 'long' : 'numeric',
    day: 'numeric',
  }).format(new Date(event.datetime));

  return shouldShowEventTime(event)
    ? `${dateText} ${formatEventTimeForLocale(event.datetime, locale)}`
    : dateText;
}

export function formatEventMonthDayForLocale(datetime: number, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: eventTimeZone,
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(datetime));
}

export function eventToFormValuesInJapan(event: LocalizedDisplayEvent) {
  const parts = Object.fromEntries(
    formFormatter.formatToParts(new Date(event.datetime)).map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: shouldShowEventTime(event) ? `${parts.hour}:${parts.minute}` : '',
  };
}
