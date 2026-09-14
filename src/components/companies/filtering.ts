import type { ApplicationListItem } from './types';
import type { TFunction } from 'i18next';
import { getStoredStageDisplayName, sortStageNames, type StatusFilterValue } from '@/components/selection/selectionConstants';

export type AppliedFilters = {
  industry: string;
  job: string;
  stages: string[];
  statuses: StatusFilterValue[];
  upcoming: '3d' | '7d' | '14d' | null;
  eventType: 'deadline' | null;
};

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function filterApplications(
  applications: ApplicationListItem[],
  keyword: string,
  filters: AppliedFilters,
  now = Date.now(),
) {
  const q = normalizeSearch(keyword);
  const industry = normalizeSearch(filters.industry);
  const job = normalizeSearch(filters.job);
  const stages = filters.stages.map(normalizeSearch).filter(Boolean);

  return applications.filter((application) => {
    const companyName = normalizeSearch(application.companyName);
    const jobTitle = normalizeSearch(application.jobTitle);
    const companyIndustry = normalizeSearch(application.companyIndustry ?? '');
    const currentStageName = normalizeSearch(application.currentStage?.name ?? '');
    const statusFilterValue = application.currentStatus ?? 'no_steps';

    const keywordMatches = !q || companyName.includes(q) || jobTitle.includes(q);
    const industryMatches = !industry || companyIndustry.includes(industry);
    const jobMatches = !job || jobTitle.includes(job);
    const stageMatches =
      stages.length === 0 ||
      stages.some((stage) =>
        stage === 'interview'
          ? application.currentStage?.type === 'interview' && application.currentStatus !== 'failed'
          : stage === currentStageName,
      );
    const statusMatches =
      filters.statuses.length === 0 ||
      filters.statuses.some((status) =>
        status === 'active'
          ? application.currentStage !== null && application.currentStatus !== 'failed'
          : status === statusFilterValue,
      );
    const upcomingDays = filters.upcoming ? Number.parseInt(filters.upcoming, 10) : null;
    const upcomingMatches =
      upcomingDays === null ||
      Boolean(
        application.nextEvent &&
          application.nextEvent.datetime > now &&
          application.nextEvent.datetime <= now + upcomingDays * 24 * 60 * 60 * 1000,
      );
    const eventTypeMatches =
      filters.eventType === null || application.nextEvent?.timingType === filters.eventType;

    return keywordMatches && industryMatches && jobMatches && stageMatches && statusMatches &&
      upcomingMatches && eventTypeMatches;
  });
}

export function activeFilterCount(filters: AppliedFilters) {
  return (
    [filters.industry, filters.job].filter((value) => value.trim()).length +
    filters.stages.length +
    filters.statuses.length +
    (filters.upcoming ? 1 : 0) +
    (filters.eventType ? 1 : 0)
  );
}

export function getAvailableStageFilters(applications: ApplicationListItem[]) {
  const stageNames = new Set<string>();

  for (const application of applications) {
    const stageName = application.currentStage?.name.trim();

    if (stageName) {
      stageNames.add(stageName);
    }
  }

  return ['interview', ...sortStageNames([...stageNames].filter((stage) => stage !== 'interview'))];
}

export function getStageFilterLabel(t: TFunction, stage: string) {
  return stage === 'interview' ? t('companies:interviewStage') : getStoredStageDisplayName(t, stage);
}
