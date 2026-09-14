import type { Id } from '../../../convex/_generated/dataModel';
import type {
  ApplicationSelectionStatus,
  SelectionStepStatus,
  SelectionStepPresetKey,
  SelectionStepType,
} from '@/components/selection/selectionConstants';
import type { CurrentStageSummary } from '@/components/companies/types';

export type EventTimingType = 'scheduled' | 'deadline';

export type EventDetail = {
  eventId: Id<'events'>;
  selectionStepId: Id<'selectionSteps'>;
  datetime: number;
  timingType: EventTimingType;
  hasExplicitTime: boolean;
  location?: string;
  meetingUrl?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type NextEvent = Omit<EventDetail, 'createdAt' | 'updatedAt'> & {
  stepName: string;
  stepPresetKey?: SelectionStepPresetKey;
  stepType: SelectionStepType;
  stepOrder: number;
  isOverdue: boolean;
};

export type SelectionStepDetail = {
  selectionStepId: Id<'selectionSteps'>;
  applicationId: Id<'applications'>;
  name: string;
  presetKey?: SelectionStepPresetKey;
  type: SelectionStepType;
  order: number;
  completed: boolean;
  result: 'passed' | 'failed' | null;
  status: SelectionStepStatus;
  event: EventDetail | null;
  hasInterviewDetail: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ApplicationDetailData = {
  applicationId: Id<'applications'>;
  companyId: Id<'companies'>;
  jobTitle: string;
  preferenceLevel?: number;
  location?: string;
  applicationUrl?: string;
  mypageUrl?: string;
  memo?: string;
  createdAt: number;
  updatedAt: number;
  company: {
    companyId: Id<'companies'>;
    name: string;
    industry?: string;
    websiteUrl?: string;
  };
  selectionSteps: SelectionStepDetail[];
  currentStage: CurrentStageSummary | null;
  currentStatus: ApplicationSelectionStatus;
  nextEvent: NextEvent | null;
};
