import { Filter, Plus, Search } from '@tamagui/lucide-icons-2';
import { useQuery_experimental as useQuery } from 'convex/react';
import { Href, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { XStack, YStack, Text, useMedia } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { ApplicationActionMenu } from '@/components/companies/ApplicationActionMenu';
import { ApplicationRow } from '@/components/companies/ApplicationRow';
import { CompanyFilterPanel } from '@/components/companies/CompanyFilterPanel';
import { CreateApplicationOverlay } from '@/components/companies/CreateApplicationOverlay';
import { DeleteApplicationDialog } from '@/components/companies/DeleteApplicationDialog';
import {
  activeFilterCount,
  AppliedFilters,
  filterApplications,
  getAvailableStageFilters,
  getStageFilterLabel,
} from '@/components/companies/filtering';
import { FilterChip } from '@/components/companies/FilterChip';
import type { ApplicationListItem } from '@/components/companies/types';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppToast } from '@/components/ui/AppToast';
import { ApplicationListSkeleton, EmptyState, MessageState } from '@/components/ui/States';
import { useRetainedQueryData } from '@/hooks/useRetainedQueryData';
import { useTimeBucket } from '@/hooks/useTimeBucket';
import {
  getStatusFilterLabel,
  statusFilterOptions,
  type StatusFilterValue,
} from '@/components/selection/selectionConstants';

const scrollStorageKey = 'shukatsu:companies:scrollY';
const emptyApplications: ApplicationListItem[] = [];
const statusFilterValues = new Set(statusFilterOptions.map((option) => option.value));

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function readParamList(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function readStatusParams(value: string | string[] | undefined): StatusFilterValue[] {
  return readParamList(value).filter((item): item is StatusFilterValue =>
    statusFilterValues.has(item as StatusFilterValue),
  );
}

function companiesHref(params: AppliedFilters & { q: string }) {
  const search = new URLSearchParams();
  const trimmedQ = params.q.trim();
  const trimmedIndustry = params.industry.trim();
  const trimmedJob = params.job.trim();

  if (trimmedQ) {
    search.set('q', trimmedQ);
  }

  if (trimmedIndustry) {
    search.set('industry', trimmedIndustry);
  }

  if (trimmedJob) {
    search.set('job', trimmedJob);
  }

  for (const stage of params.stages) {
    const trimmedStage = stage.trim();

    if (trimmedStage) {
      search.append('stage', trimmedStage);
    }
  }

  for (const status of params.statuses) {
    search.append('status', status);
  }

  if (params.upcoming) {
    search.set('upcoming', params.upcoming);
  }

  if (params.eventType) {
    search.set('eventType', params.eventType);
  }

  const query = search.toString();
  return (query ? `/companies?${query}` : '/companies') as Href;
}

export default function CompaniesScreen() {
  const { t } = useTranslation(['companies', 'selection', 'common']);
  const media = useMedia();
  const isDesktop = Boolean(media.md);
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const timeBucket = useTimeBucket();
  const applicationsState = useQuery({ query: api.applications.list, args: { timeBucket } });
  const retainedApplications = useRetainedQueryData(applicationsState, 'applications-list');
  const scrollRef = useRef<ScrollView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuApplication, setMenuApplication] = useState<ApplicationListItem | null>(null);
  const [deleteApplication, setDeleteApplication] = useState<ApplicationListItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const urlKeyword = readParam(params.q);
  const appliedFilters = useMemo<AppliedFilters>(
    () => ({
      industry: readParam(params.industry),
      job: readParam(params.job),
      stages: readParamList(params.stage),
      statuses: readStatusParams(params.status),
      upcoming: ['3d', '7d', '14d'].includes(readParam(params.upcoming))
        ? (readParam(params.upcoming) as AppliedFilters['upcoming'])
        : null,
      eventType: readParam(params.eventType) === 'deadline' ? 'deadline' : null,
    }),
    [params.eventType, params.industry, params.job, params.stage, params.status, params.upcoming],
  );
  const [searchDraft, setSearchDraft] = useState({ urlKeyword, value: urlKeyword });
  const searchValue = searchDraft.urlKeyword === urlKeyword ? searchDraft.value : urlKeyword;

  useEffect(() => {
    if (pathname !== '/companies') {
      return undefined;
    }

    const nextHref = companiesHref({
      q: searchValue,
      industry: appliedFilters.industry,
      job: appliedFilters.job,
      stages: appliedFilters.stages,
      statuses: appliedFilters.statuses,
      upcoming: appliedFilters.upcoming,
      eventType: appliedFilters.eventType,
    });
    const currentHref = companiesHref({
      q: urlKeyword,
      industry: appliedFilters.industry,
      job: appliedFilters.job,
      stages: appliedFilters.stages,
      statuses: appliedFilters.statuses,
      upcoming: appliedFilters.upcoming,
      eventType: appliedFilters.eventType,
    });
    const browserHref =
      typeof window === 'undefined'
        ? currentHref
        : `${window.location.pathname}${window.location.search}`;

    if (String(nextHref) === browserHref) {
      return undefined;
    }

    const handle = setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', String(nextHref));
        return;
      }

      router.replace(nextHref);
    }, 300);

    return () => clearTimeout(handle);
  }, [
    appliedFilters.industry,
    appliedFilters.job,
    appliedFilters.stages,
    appliedFilters.statuses,
    appliedFilters.upcoming,
    appliedFilters.eventType,
    pathname,
    router,
    searchValue,
    urlKeyword,
  ]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const handle = setTimeout(() => setToastMessage(null), 2400);
    return () => clearTimeout(handle);
  }, [toastMessage]);

  useEffect(() => {
    if (!retainedApplications.hasData || typeof window === 'undefined') {
      return;
    }

    const savedScroll = Number(window.sessionStorage.getItem(scrollStorageKey) ?? 0);
    if (!Number.isFinite(savedScroll) || savedScroll <= 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: savedScroll, animated: false });
    });
  }, [retainedApplications.hasData]);

  const applications = retainedApplications.hasData ? retainedApplications.data : emptyApplications;
  const filteredApplications = useMemo(
    () => filterApplications(applications, searchValue, appliedFilters),
    [applications, appliedFilters, searchValue],
  );
  const availableStages = useMemo(() => getAvailableStageFilters(applications), [applications]);
  const filterCount = activeFilterCount(appliedFilters);
  const hasSearchOrFilter = Boolean(searchValue.trim()) || filterCount > 0;

  function applyFilters(filters: AppliedFilters) {
    router.replace(companiesHref({ q: searchValue, ...filters }));
    setFilterOpen(false);
  }

  function removeFilter(name: 'industry' | 'job' | 'upcoming' | 'eventType') {
    const nextFilters = { ...appliedFilters };

    if (name === 'industry' || name === 'job') {
      nextFilters[name] = '';
    } else {
      nextFilters[name] = null;
    }

    router.replace(companiesHref({ q: searchValue, ...nextFilters }));
  }

  function removeStageFilter(stage: string) {
    router.replace(
      companiesHref({
        q: searchValue,
        industry: appliedFilters.industry,
        job: appliedFilters.job,
        stages: appliedFilters.stages.filter((item) => item !== stage),
        statuses: appliedFilters.statuses,
        upcoming: appliedFilters.upcoming,
        eventType: appliedFilters.eventType,
      }),
    );
  }

  function removeStatusFilter(status: StatusFilterValue) {
    router.replace(
      companiesHref({
        q: searchValue,
        industry: appliedFilters.industry,
        job: appliedFilters.job,
        stages: appliedFilters.stages,
        statuses: appliedFilters.statuses.filter((item) => item !== status),
        upcoming: appliedFilters.upcoming,
        eventType: appliedFilters.eventType,
      }),
    );
  }

  function openApplication(application: ApplicationListItem) {
    router.push(`/applications/${application.applicationId}` as Href);
  }

  function saveScrollPosition(y: number) {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(scrollStorageKey, String(y));
    }
  }

  return (
    <YStack flex={1} bg="$background">
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => saveScrollPosition(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={160}
        style={{ flex: 1 }}
      >
        <YStack
          width="100%"
          maxW={1040}
          p={isDesktop ? '$xl' : '$base'}
          pb="$xl"
        >
          <XStack
            gap="$base"
            py={isDesktop ? '$md' : '$lg'}
            style={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text color="$text" fontSize={28} fontWeight="600">
              {t('companies:title')}
            </Text>
            <AppButton variant="primary" icon={<Plus size={18} />} onPress={() => setCreateOpen(true)}>
              {t('common:actions.add')}
            </AppButton>
          </XStack>

          <XStack gap="$sm" style={{ alignItems: 'center' }}>
            <XStack flex={1} style={{ alignItems: 'center', position: 'relative' }}>
              <YStack style={{ left: 12, position: 'absolute', zIndex: 1 }}>
                <Search color="$textMuted" size={18} />
              </YStack>
              <AppInput
                pl="$xl"
                placeholder={t('companies:searchPlaceholder')}
                value={searchValue}
                onChangeText={(value) => setSearchDraft({ urlKeyword, value })}
              />
            </XStack>
            <AppButton
              variant="secondary"
              icon={<Filter size={18} />}
              onPress={() => setFilterOpen(true)}
            >
              {filterCount > 0 ? t('companies:filterCount', { count: filterCount }) : t('companies:filter')}
            </AppButton>
          </XStack>

          {filterCount > 0 ? (
            <XStack flexWrap="wrap" gap="$sm" pt="$md">
              {appliedFilters.industry.trim() ? (
                <FilterChip
                  label={`${t('companies:industry')}：${appliedFilters.industry.trim()}`}
                  onRemove={() => removeFilter('industry')}
                />
              ) : null}
              {appliedFilters.job.trim() ? (
                <FilterChip
                  label={`${t('companies:job')}：${appliedFilters.job.trim()}`}
                  onRemove={() => removeFilter('job')}
                />
              ) : null}
              {appliedFilters.statuses.map((status) => (
                <FilterChip
                  key={status}
                  label={getStatusFilterLabel(t, status)}
                  onRemove={() => removeStatusFilter(status)}
                />
              ))}
              {appliedFilters.stages.map((stage) => (
                <FilterChip
                  key={stage}
                  label={getStageFilterLabel(t, stage)}
                  onRemove={() => removeStageFilter(stage)}
                />
              ))}
              {appliedFilters.upcoming ? (
                <FilterChip
                  label={t('companies:daysWithin', { count: appliedFilters.upcoming.replace('d', '') })}
                  onRemove={() => removeFilter('upcoming')}
                />
              ) : null}
              {appliedFilters.eventType === 'deadline' ? (
                <FilterChip label={t('companies:deadline')} onRemove={() => removeFilter('eventType')} />
              ) : null}
            </XStack>
          ) : null}

          {applicationsState.status === 'pending' && !retainedApplications.hasData ? (
            <ApplicationListSkeleton />
          ) : null}

          {applicationsState.status === 'error' && !retainedApplications.hasData ? (
            <MessageState
              message={t('companies:listLoadFailed')}
              actionLabel={t('companies:reload')}
              onAction={() => router.replace('/companies' as Href)}
            />
          ) : null}

          {retainedApplications.hasData && applications.length === 0 ? (
            <EmptyState onAdd={() => setCreateOpen(true)} />
          ) : null}

          {retainedApplications.hasData &&
          applications.length > 0 &&
          filteredApplications.length === 0 ? (
            <MessageState
              message={hasSearchOrFilter ? t('companies:noMatches') : t('companies:noApplications')}
              actionLabel={hasSearchOrFilter ? t('companies:clearFilters') : t('common:actions.add')}
              onAction={() => {
                if (hasSearchOrFilter) {
                  setSearchDraft({ urlKeyword: '', value: '' });
                  router.replace('/companies' as Href);
                  return;
                }

                setCreateOpen(true);
              }}
            />
          ) : null}

          {retainedApplications.hasData && filteredApplications.length > 0 ? (
            <YStack pt="$md">
              {filteredApplications.map((application) => (
                <ApplicationRow
                  key={application.applicationId}
                  application={application}
                  onOpen={openApplication}
                  onOpenMenu={setMenuApplication}
                />
              ))}
            </YStack>
          ) : null}
        </YStack>
      </ScrollView>

      {filterOpen ? (
        <CompanyFilterPanel
          applications={applications}
          availableStages={availableStages}
          filters={appliedFilters}
          keyword={searchValue}
          open
          onApply={applyFilters}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
      <CreateApplicationOverlay open={createOpen} onClose={() => setCreateOpen(false)} />
      <ApplicationActionMenu
        application={menuApplication}
        onClose={() => setMenuApplication(null)}
        onRequestDelete={(application) => {
          setMenuApplication(null);
          setDeleteApplication(application);
        }}
      />
      <DeleteApplicationDialog
        application={deleteApplication}
        onClose={() => setDeleteApplication(null)}
        onDeleted={() => {
          setDeleteApplication(null);
          setToastMessage(t('companies:deleted'));
        }}
      />
      <AppToast message={toastMessage} />
    </YStack>
  );
}
