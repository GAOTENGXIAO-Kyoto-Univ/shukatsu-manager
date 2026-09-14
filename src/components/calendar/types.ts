import type { Id } from '../../../convex/_generated/dataModel';
import type { EventTimingType } from '@/components/applications/types';
import type { SelectionStepPresetKey, SelectionStepType } from '@/components/selection/selectionConstants';

type CalendarEventBase = {
  eventId: Id<'events'>;
  datetime: number;
  timingType: EventTimingType;
  hasExplicitTime: boolean;
  location?: string;
  meetingUrl?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type IndependentCalendarEvent = CalendarEventBase & {
  kind: 'independent';
  title: string;
};

export type SelectionCalendarEvent = CalendarEventBase & {
  kind: 'selection';
  selectionStepId: Id<'selectionSteps'>;
  selectionStepName: string;
  selectionStepPresetKey?: SelectionStepPresetKey;
  selectionStepType: SelectionStepType;
  applicationId: Id<'applications'>;
  jobTitle: string;
  companyName: string;
};

export type CalendarEvent = IndependentCalendarEvent | SelectionCalendarEvent;

export type SelectionStepTarget = {
  selectionStepId: Id<'selectionSteps'>;
  name: string;
  presetKey?: SelectionStepPresetKey;
  type: SelectionStepType;
  order: number;
  completed: boolean;
  result: 'passed' | 'failed' | null;
  hasEvent: boolean;
};

export type ApplicationEventTarget = {
  applicationId: Id<'applications'>;
  companyName: string;
  jobTitle: string;
  steps: SelectionStepTarget[];
};
