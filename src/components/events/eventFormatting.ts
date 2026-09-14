import type { EventTimingType } from '@/components/applications/types';
import { getCurrentAppLocale, i18n } from '@/i18n';
import {
  eventTimeZone,
  eventToFormValuesInJapan,
  formatEventDateForLocale,
  formatEventMonthDayForLocale,
  formatEventTimeForLocale,
} from './eventFormattingCore';

export { eventTimeZone };

type DisplayEvent = {
  datetime: number;
  timingType: EventTimingType;
  hasExplicitTime: boolean;
};

export function formatEventDate(event: DisplayEvent, context: 'compact' | 'detail' = 'compact') {
  return formatEventDateForLocale(event, getCurrentAppLocale(), context);
}

export function formatEventTime(datetime: number) {
  return formatEventTimeForLocale(datetime, getCurrentAppLocale());
}

export function formatEventMonthDay(datetime: number) {
  return formatEventMonthDayForLocale(datetime, getCurrentAppLocale());
}

export function formatEventSummary(event: DisplayEvent) {
  const prefix = event.timingType === 'scheduled'
    ? i18n.t('common:eventTiming.scheduledPrefix')
    : i18n.t('common:eventTiming.deadlinePrefix');
  return `${prefix} ${formatEventDate(event)}`;
}

export function getEventLabel(stepName: string, timingType: EventTimingType) {
  return timingType === 'deadline'
    ? `${stepName} ${i18n.t('common:eventTiming.deadlineSuffix')}`
    : stepName;
}

export function eventToFormValues(event: DisplayEvent) {
  return eventToFormValuesInJapan(event);
}
