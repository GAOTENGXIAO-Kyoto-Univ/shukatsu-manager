import type { Id } from '../../../convex/_generated/dataModel';
import type {
  ApplicationSelectionStatus,
  SelectionStepPresetKey,
  SelectionStepType,
} from '@/components/selection/selectionConstants';
import type { NextEvent } from '@/components/applications/types';

export type CurrentStageSummary = {
  selectionStepId: Id<'selectionSteps'>;
  name: string;
  presetKey?: SelectionStepPresetKey;
  type: SelectionStepType;
  order: number;
};

export type ApplicationListItem = {
  applicationId: Id<'applications'>;
  companyId: Id<'companies'>;
  companyName: string;
  companyIndustry?: string;
  jobTitle: string;
  createdAt: number;
  updatedAt: number;
  currentStage: CurrentStageSummary | null;
  currentStatus: ApplicationSelectionStatus;
  nextEvent: Pick<
    NextEvent,
    | 'eventId'
    | 'selectionStepId'
    | 'stepName'
    | 'stepPresetKey'
    | 'stepType'
    | 'stepOrder'
    | 'timingType'
    | 'datetime'
    | 'hasExplicitTime'
    | 'isOverdue'
  > | null;
};

export type CompanyPickerItem = {
  companyId: Id<'companies'>;
  name: string;
  industry?: string;
};

export type ApplicationSummary = {
  applicationId: Id<'applications'>;
  companyId: Id<'companies'>;
  companyName: string;
  jobTitle: string;
};
