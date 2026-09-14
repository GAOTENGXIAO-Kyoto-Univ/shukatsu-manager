import {
  BarChart3,
  BriefcaseBusiness,
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Hourglass,
  MessageSquareText,
  TrendingUp,
} from '@tamagui/lucide-icons-2';
import { useQuery_experimental as useQuery } from 'convex/react';
import { Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, TooltipSimple, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { warmPaperColors } from '../../../tamagui.config';
import {
  eventTimeZone,
  formatEventMonthDay,
  formatEventTime,
} from '@/components/events/eventFormatting';
import { AppButton } from '@/components/ui/AppButton';
import { useRetainedQueryData } from '@/hooks/useRetainedQueryData';
import { getCurrentAppLocale } from '@/i18n';
import { getSelectionStepDisplayName, type SelectionStepPresetKey } from '@/components/selection/selectionConstants';

type UpcomingItem = {
  eventId: Id<'events'>;
  kind: 'selection' | 'independent';
  group: 'today' | 'tomorrow' | 'future';
  datetime: number;
  timingType: 'scheduled' | 'deadline';
  hasExplicitTime: boolean;
  title?: string;
  companyName?: string;
  jobTitle?: string;
  selectionStepName?: string;
  selectionStepPresetKey?: SelectionStepPresetKey;
  applicationId?: Id<'applications'>;
  selectionStepId?: Id<'selectionSteps'>;
};

const groupOrder = ['today', 'tomorrow', 'future'] as const;
export function UpcomingItemsSection({ timeBucket }: { timeBucket: number }) {
  const { t } = useTranslation(['dashboard', 'common', 'selection']);
  const router = useRouter();
  const [retryToken, setRetryToken] = useState(0);
  const state = useQuery({
    query: api.dashboard.listUpcomingItems,
    args: { timeBucket, retryToken },
  });
  const retained = useRetainedQueryData(state, 'dashboard-upcoming');
  const showAllAction =
    retained.hasData && retained.data.hasMore ? (
      <AppButton
        aria-label={t('dashboard:viewAllUpcoming')}
        iconAfter={<ChevronRight size={16} />}
        variant="ghost"
        onPress={() => router.push('/calendar' as Href)}
      >
        {t('dashboard:viewAll')}
      </AppButton>
    ) : null;

  return (
    <DashboardSection
      action={showAllAction}
      description={t('dashboard:upcomingDescription')}
      icon={<CalendarDays color="$text" size={22} />}
      title={t('dashboard:upcoming')}
    >
      {state.status === 'error' ? (
        <ModuleRetry
          compact={retained.hasData}
          onRetry={() => setRetryToken((value) => value + 1)}
        />
      ) : null}
      {state.status === 'pending' && !retained.hasData ? <UpcomingSkeleton /> : null}
      {retained.hasData && retained.data.items.length === 0 ? (
        <InlineEmpty message={t('dashboard:noUpcoming')} />
      ) : null}
      {retained.hasData && retained.data.items.length > 0 ? (
        <YStack gap="$md">
          {groupOrder.map((group) => {
            const items = retained.data.items.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <YStack key={group} gap="$sm">
                <Text color="$textMuted" fontSize={13} fontWeight="600">
                  {t(`dashboard:groups.${group}`)}
                </Text>
                <YStack gap="$sm">
                  {items.map((item) => (
                    <UpcomingRow
                      key={item.eventId}
                      item={item}
                      onOpenSelection={() => {
                        if (
                          item.kind === 'selection' &&
                          item.applicationId &&
                          item.selectionStepId
                        ) {
                          router.push(
                            `/applications/${item.applicationId}?step=${item.selectionStepId}` as Href,
                          );
                        }
                      }}
                    />
                  ))}
                </YStack>
              </YStack>
            );
          })}
        </YStack>
      ) : null}
    </DashboardSection>
  );
}

function UpcomingRow({
  item,
  onOpenSelection,
}: {
  item: UpcomingItem;
  onOpenSelection: () => void;
}) {
  const { t } = useTranslation(['dashboard', 'common', 'selection']);
  const media = useMedia();
  const isDesktop = Boolean(media.md);
  const isSelection =
    item.kind === 'selection' &&
    item.companyName !== undefined &&
    item.jobTitle !== undefined &&
    item.selectionStepName !== undefined;
  const iconSize = isDesktop ? 19 : 17;

  return (
    <XStack
      bg="$background"
      borderColor="$border"
      borderWidth={1}
      gap={isDesktop ? '$md' : '$sm'}
      minH={isDesktop ? 68 : 64}
      px={isDesktop ? '$md' : '$sm'}
      py="$sm"
      style={{ alignItems: 'center', borderRadius: 12 }}
    >
      <YStack
        bg="$surfaceMuted"
        borderColor="$border"
        borderWidth={1}
        height={isDesktop ? 56 : 48}
        width={isDesktop ? 56 : 48}
        style={{ alignItems: 'center', borderRadius: 11, justifyContent: 'center' }}
      >
        <Text color="$text" fontSize={isDesktop ? 15 : 13} fontWeight="600">
          {formatEventMonthDay(item.datetime)}
        </Text>
        <Text color="$textMuted" fontSize={11}>
          {new Intl.DateTimeFormat(getCurrentAppLocale(), { timeZone: eventTimeZone, weekday: 'short' }).format(new Date(item.datetime))}
        </Text>
      </YStack>
      <YStack
        bg={
          item.kind === 'independent'
            ? '$accentSoft'
            : item.timingType === 'deadline'
              ? '$warningSoft'
              : '$infoSoft'
        }
        height={isDesktop ? 40 : 34}
        width={isDesktop ? 40 : 34}
        style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
      >
        {item.kind === 'independent' ? (
          <Calendar color="$accentStrong" size={iconSize} />
        ) : item.timingType === 'deadline' ? (
          <Hourglass color="$warningStrong" size={iconSize} />
        ) : (
          <CalendarClock color="$infoStrong" size={iconSize} />
        )}
      </YStack>
      <YStack flex={1} gap="$xs" style={{ minWidth: 0 }}>
        <Text color="$text" fontSize={isDesktop ? 16 : 14} fontWeight="600" numberOfLines={1}>
          {isSelection ? `${item.companyName} · ${item.jobTitle}` : item.title}
        </Text>
        {isSelection ? (
          <Text color="$textSecondary" fontSize={isDesktop ? 14 : 12} numberOfLines={1}>
            {getSelectionStepDisplayName({ name: item.selectionStepName ?? '', presetKey: item.selectionStepPresetKey }, t)}
            {item.timingType === 'deadline' ? ` ${t('common:eventTiming.deadlineSuffix')}` : ''}
          </Text>
        ) : null}
      </YStack>
      <Text color="$textSecondary" fontSize={isDesktop ? 13 : 12} fontWeight="600">
        {formatUpcomingTime(item, t('common:eventTiming.deadlinePrefix'))}
      </Text>
      {isSelection ? (
        <TooltipSimple label={t('dashboard:openSelection')}>
          <AppButton
            aria-label={t('dashboard:openSelection')}
            icon={<ChevronRight size={18} />}
            variant="ghost"
            onPress={onOpenSelection}
          />
        </TooltipSimple>
      ) : null}
    </XStack>
  );
}

function formatUpcomingTime(item: UpcomingItem, deadlineLabel: string) {
  if (item.timingType === 'scheduled') {
    return formatEventTime(item.datetime);
  }
  if (item.hasExplicitTime) {
    return `${deadlineLabel} ${formatEventTime(item.datetime)}`;
  }
  return deadlineLabel;
}

export function SelectionSummarySection({ timeBucket }: { timeBucket: number }) {
  const { t } = useTranslation('dashboard');
  const router = useRouter();
  const media = useMedia();
  const isDesktop = Boolean(media.md);
  const [retryToken, setRetryToken] = useState(0);
  const state = useQuery({
    query: api.dashboard.getSelectionSummary,
    args: { timeBucket, retryToken },
  });
  const retained = useRetainedQueryData(state, 'dashboard-selection-summary');
  const metrics = retained.hasData
    ? [
        {
          label: t('metrics.active.label'),
          helper: t('metrics.active.helper'),
          count: retained.data.activeCount,
          tooltip: t('metrics.active.tooltip'),
          href: '/companies?status=active',
          background: '$infoSoft' as const,
          accent: '$infoStrong' as const,
          border: warmPaperColors.info,
          icon: <BriefcaseBusiness color="$infoStrong" size={isDesktop ? 22 : 18} />,
        },
        {
          label: t('metrics.interview.label'),
          helper: t('metrics.interview.helper'),
          count: retained.data.interviewCount,
          tooltip: t('metrics.interview.tooltip'),
          href: '/companies?stage=interview',
          background: '$accentSoft' as const,
          accent: '$accentStrong' as const,
          border: warmPaperColors.accent,
          icon: <MessageSquareText color="$accentStrong" size={isDesktop ? 22 : 18} />,
        },
        {
          label: t('metrics.waiting.label'),
          helper: t('metrics.waiting.helper'),
          count: retained.data.waitingCount,
          tooltip: t('metrics.waiting.tooltip'),
          href: '/companies?status=waiting_result',
          background: '$warningSoft' as const,
          accent: '$warningStrong' as const,
          border: warmPaperColors.warning,
          icon: <Hourglass color="$warningStrong" size={isDesktop ? 22 : 18} />,
        },
      ]
    : [];

  return (
    <DashboardSection
      description={t('summaryDescription')}
      icon={<BarChart3 color="$text" size={22} />}
      title={t('summary')}
    >
      {state.status === 'error' ? (
        <ModuleRetry
          compact={retained.hasData}
          onRetry={() => setRetryToken((value) => value + 1)}
        />
      ) : null}
      {state.status === 'pending' && !retained.hasData ? <SelectionSummarySkeleton /> : null}
      {retained.hasData ? (
        <XStack gap={isDesktop ? '$md' : '$xs'} width="100%">
          {metrics.map((metric) => (
            <TooltipSimple key={metric.label} label={metric.tooltip}>
              <Button
                unstyled
                aria-label={`${metric.label} ${metric.count}`}
                bg={metric.background}
                borderColor={warmPaperColors.border}
                borderWidth={1}
                cursor="pointer"
                flex={1}
                minH={isDesktop ? 112 : 104}
                onPress={() => router.push(metric.href as Href)}
                pressStyle={{ opacity: 0.76 }}
                hoverStyle={{ borderColor: metric.border, opacity: 0.9 }}
                focusStyle={{
                  outlineColor: warmPaperColors.focusRing,
                  outlineStyle: 'solid',
                  outlineWidth: 2,
                }}
                style={{ borderRadius: 13 }}
              >
                <YStack
                  gap={isDesktop ? '$sm' : '$xs'}
                  p={isDesktop ? '$base' : '$sm'}
                  style={{ alignItems: isDesktop ? 'flex-start' : 'center' }}
                >
                  <YStack
                    bg="$surface"
                    height={isDesktop ? 38 : 30}
                    width={isDesktop ? 38 : 30}
                    style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
                  >
                    {metric.icon}
                  </YStack>
                  {isDesktop ? (
                    <XStack gap="$sm" style={{ alignItems: 'baseline' }}>
                      <MetricCount count={metric.count} />
                      <MetricLabel accent={metric.accent} label={metric.label} />
                    </XStack>
                  ) : (
                    <YStack gap={0} style={{ alignItems: 'center' }}>
                      <MetricCount count={metric.count} />
                      <MetricLabel accent={metric.accent} label={metric.label} />
                    </YStack>
                  )}
                  {isDesktop ? (
                    <Text color="$textSecondary" fontSize={12}>
                      {metric.helper}
                    </Text>
                  ) : null}
                </YStack>
              </Button>
            </TooltipSimple>
          ))}
        </XStack>
      ) : null}
    </DashboardSection>
  );
}

function MetricCount({ count }: { count: number }) {
  const media = useMedia();

  return (
    <Text
      color="$text"
      fontSize={media.md ? 34 : 28}
      fontWeight="600"
      lineHeight={media.md ? 38 : 32}
    >
      {count}
    </Text>
  );
}

function MetricLabel({ accent, label }: { accent: '$accentStrong' | '$infoStrong' | '$warningStrong'; label: string }) {
  const media = useMedia();

  return (
    <Text color={accent} fontSize={media.md ? 15 : 13} fontWeight="600" numberOfLines={1}>
      {label}
    </Text>
  );
}

export function RecentProgressSection({ timeBucket }: { timeBucket: number }) {
  const { t } = useTranslation(['dashboard', 'selection']);
  const [retryToken, setRetryToken] = useState(0);
  const state = useQuery({
    query: api.dashboard.listRecentProgress,
    args: { timeBucket, retryToken },
  });
  const retained = useRetainedQueryData(state, 'dashboard-recent-progress');
  const description =
    retained.hasData && retained.data.length > 0
      ? t('dashboard:recentDescription', { count: retained.data.length })
      : undefined;

  return (
    <DashboardSection
      description={description}
      icon={<TrendingUp color="$text" size={22} />}
      title={t('dashboard:recent')}
    >
      {state.status === 'error' ? (
        <ModuleRetry
          compact={retained.hasData}
          onRetry={() => setRetryToken((value) => value + 1)}
        />
      ) : null}
      {state.status === 'pending' && !retained.hasData ? <RecentProgressSkeleton /> : null}
      {retained.hasData && retained.data.length === 0 ? (
        <InlineEmpty message={t('dashboard:noRecent')} />
      ) : null}
      {retained.hasData && retained.data.length > 0 ? (
        <YStack borderColor="$border" borderWidth={1} style={{ borderRadius: 12, overflow: 'hidden' }}>
          {retained.data.map((item, index) => {
            const passed = item.type === 'passed';
            return (
              <XStack
                key={item.progressHistoryId}
                borderBottomColor="$border"
                borderBottomWidth={index === retained.data.length - 1 ? 0 : 1}
                gap="$md"
                px="$md"
                py="$md"
                style={{ alignItems: 'center' }}
              >
                <YStack
                  bg={passed ? '$success' : '$info'}
                  height={36}
                  width={36}
                  style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
                >
                  <Check color="$surface" size={20} />
                </YStack>
                <YStack flex={1} gap="$xs" style={{ minWidth: 0 }}>
                  <Text color="$textSecondary" fontSize={14} fontWeight="600" numberOfLines={1}>
                    {item.companyName} · {item.jobTitle}
                  </Text>
                  <XStack gap="$sm" style={{ alignItems: 'center' }}>
                    <Text
                      color="$text"
                      fontSize={16}
                      fontWeight="600"
                      numberOfLines={1}
                      style={{ flexShrink: 1 }}
                    >
                      {getSelectionStepDisplayName({ name: item.selectionStepName, presetKey: item.selectionStepPresetKey }, t)}
                    </Text>
                    <YStack
                      bg={passed ? '$successSoft' : '$infoSoft'}
                      px="$sm"
                      py="$xs"
                      style={{ borderRadius: 9999 }}
                    >
                      <Text
                        color={passed ? '$successStrong' : '$infoStrong'}
                        fontSize={12}
                        fontWeight="600"
                      >
                        {passed ? t('dashboard:passed') : t('dashboard:completed')}
                      </Text>
                    </YStack>
                  </XStack>
                </YStack>
              </XStack>
            );
          })}
        </YStack>
      ) : null}
    </DashboardSection>
  );
}

function DashboardSection({
  action,
  children,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: string;
  icon: React.ReactNode;
  title: string;
}) {
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      gap="$base"
      p={isDesktop ? '$lg' : '$base'}
      style={{ borderRadius: 16 }}
    >
      <XStack gap="$base" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <XStack flex={1} gap="$md" style={{ alignItems: 'flex-start', minWidth: 0 }}>
          <YStack pt={2}>{icon}</YStack>
          <YStack flex={1} gap="$xs" style={{ minWidth: 0 }}>
            <Text color="$text" fontSize={isDesktop ? 22 : 20} fontWeight="600" lineHeight={28}>
              {title}
            </Text>
            {description ? (
              <Text color="$textSecondary" fontSize={isDesktop ? 14 : 13} lineHeight={19}>
                {description}
              </Text>
            ) : null}
          </YStack>
        </XStack>
        {action}
      </XStack>
      {children}
    </YStack>
  );
}

function UpcomingSkeleton() {
  return (
    <YStack gap="$sm">
      {[0, 1, 2].map((item) => (
        <XStack
          key={item}
          borderColor="$border"
          borderWidth={1}
          gap="$md"
          minH={64}
          p="$sm"
          style={{ alignItems: 'center', borderRadius: 12 }}
        >
          <SkeletonBlock height={48} width={48} radius={11} />
          <SkeletonBlock height={34} width={34} radius={9999} />
          <YStack flex={1} gap="$sm">
            <SkeletonBlock height={14} width="48%" />
            <SkeletonBlock height={12} width="30%" />
          </YStack>
          <SkeletonBlock height={12} width={46} />
        </XStack>
      ))}
    </YStack>
  );
}

function SelectionSummarySkeleton() {
  return (
    <XStack gap="$xs">
      {[0, 1, 2].map((item) => (
        <YStack
          key={item}
          bg="$surfaceMuted"
          flex={1}
          gap="$sm"
          minH={104}
          p="$sm"
          style={{ borderRadius: 13 }}
        >
          <SkeletonBlock height={30} width={30} radius={9999} />
          <SkeletonBlock height={28} width="42%" />
          <SkeletonBlock height={12} width="62%" />
        </YStack>
      ))}
    </XStack>
  );
}

function RecentProgressSkeleton() {
  return (
    <YStack borderColor="$border" borderWidth={1} style={{ borderRadius: 12, overflow: 'hidden' }}>
      {[0, 1, 2].map((item) => (
        <XStack
          key={item}
          borderBottomColor="$border"
          borderBottomWidth={item === 2 ? 0 : 1}
          gap="$md"
          p="$md"
          style={{ alignItems: 'center' }}
        >
          <SkeletonBlock height={36} width={36} radius={9999} />
          <YStack flex={1} gap="$sm">
            <SkeletonBlock height={13} width="46%" />
            <SkeletonBlock height={16} width="32%" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function SkeletonBlock({
  height,
  radius = 7,
  width,
}: {
  height: number;
  radius?: number;
  width: number | `${number}%`;
}) {
  return <YStack bg="$surfaceMuted" height={height} width={width} style={{ borderRadius: radius }} />;
}

function ModuleRetry({ compact, onRetry }: { compact: boolean; onRetry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <XStack
      bg={compact ? 'transparent' : '$surfaceMuted'}
      gap="$sm"
      minH={compact ? undefined : 72}
      p={compact ? 0 : '$md'}
      style={{ alignItems: 'center', borderRadius: 12, justifyContent: 'space-between' }}
    >
      <Text color="$danger" fontSize={13}>{t('errors.load')}</Text>
      <AppButton variant="ghost" onPress={onRetry}>{t('actions.retry')}</AppButton>
    </XStack>
  );
}

function InlineEmpty({ message }: { message: string }) {
  return (
    <Text color="$textMuted" fontSize={14} py="$md">
      {message}
    </Text>
  );
}
