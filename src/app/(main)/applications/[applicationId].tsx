import { CalendarClock, ChevronLeft, MoreHorizontal, Plus } from '@tamagui/lucide-icons-2';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, type LayoutChangeEvent } from 'react-native';
import { XStack, YStack, Text } from 'tamagui';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ApplicationDetailActionMenu } from '@/components/applications/ApplicationDetailActionMenu';
import { EditApplicationOverlay } from '@/components/applications/EditApplicationOverlay';
import { EditCompanyOverlay } from '@/components/applications/EditCompanyOverlay';
import type { ApplicationDetailData, SelectionStepDetail } from '@/components/applications/types';
import { DeleteApplicationDialog, type DeleteApplicationTarget } from '@/components/companies/DeleteApplicationDialog';
import { AddSelectionStepOverlay } from '@/components/selection/AddSelectionStepOverlay';
import { CopySelectionProcessOverlay } from '@/components/selection/CopySelectionProcessOverlay';
import { SelectionProcessTemplateOverlay } from '@/components/selection/SelectionProcessTemplateOverlay';
import { ResearchSummary } from '@/components/research/ResearchSummary';
import { formatEventDate, getEventLabel } from '@/components/events/eventFormatting';
import { useTimeBucket } from '@/hooks/useTimeBucket';
import { SelectionStatusBadge } from '@/components/selection/SelectionStatusBadge';
import { SelectionStepActions } from '@/components/selection/SelectionStepActions';
import { canMoveStep, SelectionTimeline } from '@/components/selection/SelectionTimeline';
import { getSelectionStepDisplayName, getStatusLabel } from '@/components/selection/selectionConstants';
import { AppButton } from '@/components/ui/AppButton';
import { AppToast } from '@/components/ui/AppToast';
import { LoadingState, MessageState } from '@/components/ui/States';
import { useRetainedQueryData } from '@/hooks/useRetainedQueryData';

const APPLICATION_DETAIL_SELECTION_MIN_WIDTH = 480;
const APPLICATION_DETAIL_INFO_COLUMN_WIDTH = 360;
const APPLICATION_DETAIL_COLUMN_GAP = 32;
const APPLICATION_DETAIL_TWO_COLUMN_MIN_WIDTH =
  APPLICATION_DETAIL_SELECTION_MIN_WIDTH +
  APPLICATION_DETAIL_INFO_COLUMN_WIDTH +
  APPLICATION_DETAIL_COLUMN_GAP;

function readRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ApplicationDetailScreen() {
  const { t } = useTranslation(['selection', 'common', 'companies']);
  const router = useRouter();
  const params = useLocalSearchParams();
  const timeBucket = useTimeBucket();
  const applicationId = readRouteParam(params.applicationId);
  const stepParam = readRouteParam(params.step);
  const reorderSteps = useMutation(api.selectionSteps.reorder);
  const applicationState = useQuery({
    query: api.applications.get,
    args: applicationId
      ? { applicationId: applicationId as Id<'applications'>, timeBucket }
      : 'skip',
  });
  const retainedApplication = useRetainedQueryData(
    applicationState,
    applicationId ?? 'missing-application-id',
  );
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [copyProcessOpen, setCopyProcessOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [editApplicationOpen, setEditApplicationOpen] = useState(false);
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<Id<'selectionSteps'> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteApplicationTarget | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dismissedStepParam, setDismissedStepParam] = useState<string | null>(null);
  const [hasTwoColumnSpace, setHasTwoColumnSpace] = useState(false);
  const deepLinkedStep =
    stepParam && retainedApplication.hasData && retainedApplication.data
      ? retainedApplication.data.selectionSteps.find(
          (step) => step.selectionStepId === stepParam,
        ) ?? null
      : null;

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const handle = setTimeout(() => setToastMessage(null), 2400);
    return () => clearTimeout(handle);
  }, [toastMessage]);

  useEffect(() => {
    if (!stepParam) {
      return;
    }
    if (
      applicationId &&
      retainedApplication.hasData &&
      retainedApplication.data &&
      !deepLinkedStep
    ) {
      router.replace(`/applications/${applicationId}` as Href);
    }
  }, [applicationId, deepLinkedStep, retainedApplication, router, stepParam]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/companies' as Href);
  }

  async function openUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      setToastMessage(t('companies:detail.openLinkFailed'));
    }
  }

  if (!applicationId) {
    return (
      <PageFrame>
        <MessageState message={t('companies:detail.missing')} actionLabel={t('companies:detail.back')} onAction={goBack} />
      </PageFrame>
    );
  }

  if (applicationState.status === 'pending' && !retainedApplication.hasData) {
    return (
      <PageFrame>
        <LoadingState message={t('companies:detail.loading')} />
      </PageFrame>
    );
  }

  if (applicationState.status === 'error' && !retainedApplication.hasData) {
    return (
      <PageFrame>
        <MessageState message={t('companies:detail.loadFailed')} actionLabel={t('companies:detail.back')} onAction={goBack} />
      </PageFrame>
    );
  }

  if (!retainedApplication.hasData || !retainedApplication.data) {
    return (
      <PageFrame>
        <MessageState message={t('companies:detail.forbidden')} actionLabel={t('companies:detail.back')} onAction={goBack} />
      </PageFrame>
    );
  }

  const application: ApplicationDetailData = retainedApplication.data;
  const activeStepId = selectedStepId ??
    (deepLinkedStep && dismissedStepParam !== stepParam
      ? deepLinkedStep.selectionStepId
      : null);
  const selectedStep = activeStepId
    ? application.selectionSteps.find((step) => step.selectionStepId === activeStepId) ?? null
    : null;

  async function moveStep(step: SelectionStepDetail, direction: 'up' | 'down') {
    if (!canMoveStep(application.selectionSteps, step, direction)) {
      return;
    }

    const currentIndex = application.selectionSteps.findIndex(
      (item) => item.selectionStepId === step.selectionStepId,
    );
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= application.selectionSteps.length) {
      return;
    }

    const orderedStepIds = application.selectionSteps.map((item) => item.selectionStepId);
    [orderedStepIds[currentIndex], orderedStepIds[targetIndex]] = [
      orderedStepIds[targetIndex],
      orderedStepIds[currentIndex],
    ];

    try {
      await reorderSteps({
        applicationId: application.applicationId,
        orderedStepIds,
      });
      setToastMessage(t('companies:detail.reordered'));
    } catch {
      setToastMessage(t('companies:detail.reorderFailed'));
    }
  }

  function moveStepById(selectionStepId: Id<'selectionSteps'>, direction: 'up' | 'down') {
    const step = application.selectionSteps.find((item) => item.selectionStepId === selectionStepId);

    if (step) {
      void moveStep(step, direction);
    }
  }

  function closeStepActions() {
    setSelectedStepId(null);
    if (stepParam) {
      setDismissedStepParam(stepParam);
      router.replace(`/applications/${applicationId}` as Href);
    }
  }

  function handleMainContentLayout(event: LayoutChangeEvent) {
    setHasTwoColumnSpace(
      event.nativeEvent.layout.width >= APPLICATION_DETAIL_TWO_COLUMN_MIN_WIDTH,
    );
  }

  return (
    <PageFrame>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$xl" width="100%" maxW={1120} p="$base" pb="$xxl" style={{ alignSelf: 'center' }}>
          <XStack gap="$base" py="$md" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <YStack flex={1} gap="$base">
              <AppButton
                variant="ghost"
                icon={<ChevronLeft size={18} />}
                onPress={goBack}
                style={{ alignSelf: 'flex-start' }}
              >
                {t('common:actions.back')}
              </AppButton>
              <YStack gap="$xs">
                <Text color="$text" fontSize={30} fontWeight="600" lineHeight={38}>
                  {application.company.name}
                </Text>
                <Text color="$textSecondary" fontSize={17} lineHeight={24}>
                  {application.jobTitle}
                  {application.company.industry ? ` · ${application.company.industry}` : ''}
                </Text>
              </YStack>
            </YStack>
            <AppButton
              variant="secondary"
              icon={<MoreHorizontal size={18} />}
              onPress={() => setActionMenuOpen(true)}
            >
              {t('companies:detail.actions')}
            </AppButton>
          </XStack>

          <CurrentStatusPanel application={application} />

          <XStack
            gap="$xl"
            onLayout={handleMainContentLayout}
            width="100%"
            style={{
              alignItems: 'flex-start',
              flexDirection: hasTwoColumnSpace ? 'row' : 'column',
            }}
          >
            <YStack
              flex={hasTwoColumnSpace ? 1 : undefined}
              gap="$xl"
              width={hasTwoColumnSpace ? undefined : '100%'}
              style={{ minWidth: hasTwoColumnSpace ? APPLICATION_DETAIL_SELECTION_MIN_WIDTH : 0 }}
            >
              <SectionHeader
                action={
                  application.selectionSteps.length > 0 ? (
                    <AppButton
                      variant="primary"
                      icon={<Plus size={18} />}
                      onPress={() => setAddStepOpen(true)}
                    >
                      {t('selection:actions.addStep')}
                    </AppButton>
                  ) : undefined
                }
                title={t('companies:detail.process')}
              />
              {application.selectionSteps.length > 0 ? (
                <SelectionTimeline
                  currentStageId={application.currentStage?.selectionStepId ?? null}
                  onMove={moveStepById}
                  onOpenStep={(step) => {
                    setDismissedStepParam(null);
                    setSelectedStepId(step.selectionStepId);
                  }}
                  steps={application.selectionSteps}
                />
              ) : (
                <YStack gap="$base" py="$xl" style={{ alignItems: 'center' }}>
                  <Text color="$text" fontSize={18} fontWeight="600">
                    {t('selection:status.noSteps')}
                  </Text>
                  <Text color="$textSecondary" lineHeight={22} style={{ maxWidth: 360, textAlign: 'center' }}>
                    {t('companies:detail.noProcessDescription')}
                  </Text>
                  <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'center' }}>
                    <AppButton
                      icon={<Plus size={18} />}
                      onPress={() => setAddStepOpen(true)}
                      variant="primary"
                    >
                      {t('selection:actions.addStep')}
                    </AppButton>
                    <AppButton onPress={() => setTemplateOpen(true)} variant="secondary">
                      {t('selection:actions.createFromTemplate')}
                    </AppButton>
                    <AppButton onPress={() => setCopyProcessOpen(true)} variant="secondary">
                      {t('selection:actions.copyOtherProcess')}
                    </AppButton>
                  </XStack>
                </YStack>
              )}
            </YStack>

            <YStack
              gap="$xl"
              width={hasTwoColumnSpace ? APPLICATION_DETAIL_INFO_COLUMN_WIDTH : '100%'}
            >
              <ApplicationInfoSection application={application} onEdit={() => setEditApplicationOpen(true)} onOpenUrl={openUrl} />
              <CompanyInfoSection application={application} onEdit={() => setEditCompanyOpen(true)} onOpenUrl={openUrl} />
            </YStack>
          </XStack>

          <ResearchSummary
            application={{
              applicationId: application.applicationId,
              companyName: application.company.name,
              jobTitle: application.jobTitle,
            }}
          />
        </YStack>
      </ScrollView>

      <AddSelectionStepOverlay
        applicationId={application.applicationId}
        onClose={() => setAddStepOpen(false)}
        open={addStepOpen}
      />
      <SelectionProcessTemplateOverlay
        applicationId={application.applicationId}
        onClose={() => setTemplateOpen(false)}
        open={templateOpen}
      />
      <CopySelectionProcessOverlay
        applicationId={application.applicationId}
        onClose={() => setCopyProcessOpen(false)}
        open={copyProcessOpen}
      />
      <SelectionStepActions
        onClose={closeStepActions}
        onMove={(step, direction) => void moveStep(step, direction)}
        open={Boolean(selectedStep)}
        step={selectedStep}
        steps={application.selectionSteps}
      />
      <ApplicationDetailActionMenu
        application={application}
        open={actionMenuOpen}
        onClose={() => setActionMenuOpen(false)}
        onEditApplication={() => {
          setActionMenuOpen(false);
          setEditApplicationOpen(true);
        }}
        onEditCompany={() => {
          setActionMenuOpen(false);
          setEditCompanyOpen(true);
        }}
        onRequestDelete={() => {
          setActionMenuOpen(false);
          setDeleteTarget({
            applicationId: application.applicationId,
            companyName: application.company.name,
            jobTitle: application.jobTitle,
          });
        }}
      />
      <EditApplicationOverlay
        application={application}
        onClose={() => setEditApplicationOpen(false)}
        open={editApplicationOpen}
      />
      <EditCompanyOverlay
        application={application}
        onClose={() => setEditCompanyOpen(false)}
        open={editCompanyOpen}
      />
      <DeleteApplicationDialog
        application={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          router.replace('/companies' as Href);
        }}
      />
      <AppToast message={toastMessage} />
    </PageFrame>
  );
}

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <YStack flex={1} bg="$background">
      {children}
    </YStack>
  );
}

function CurrentStatusPanel({ application }: { application: ApplicationDetailData }) {
  const { t } = useTranslation(['selection', 'companies']);
  return (
    <YStack bg="$surface" gap="$base" p="$lg" style={{ borderRadius: 16 }}>
      <XStack gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color="$textSecondary" fontSize={14} fontWeight="600">
          {t('companies:detail.currentStatus')}
        </Text>
        {application.currentStatus ? <SelectionStatusBadge status={application.currentStatus} /> : null}
      </XStack>
      {application.currentStage && application.currentStatus ? (
        <YStack gap="$xs">
          <Text color="$text" fontSize={26} fontWeight="600" lineHeight={34}>
            {getSelectionStepDisplayName(application.currentStage, t)}
          </Text>
          <Text color="$textSecondary" lineHeight={22}>
            {getStatusLabel(t, application.currentStatus)}
          </Text>
          {application.nextEvent ? (
            <YStack borderTopColor="$border" borderTopWidth={1} gap="$xs" mt="$md" pt="$md">
              <XStack gap="$sm" style={{ alignItems: 'center' }}>
                <CalendarClock color="$textSecondary" size={17} />
                <Text color="$textSecondary" fontSize={13} fontWeight="600">{t('companies:detail.nextEvent')}</Text>
              </XStack>
              <Text color={application.nextEvent.isOverdue ? '$danger' : '$text'} fontSize={18} fontWeight="600">
                {formatEventDate(application.nextEvent, 'detail')}
              </Text>
              <Text color="$textSecondary" lineHeight={22}>
                {getEventLabel(getSelectionStepDisplayName({ name: application.nextEvent.stepName, presetKey: application.nextEvent.stepPresetKey }, t), application.nextEvent.timingType)}
                {application.nextEvent.isOverdue ? ` · ${t('selection:status.overdue')}` : ''}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      ) : (
        <YStack gap="$base">
          <Text color="$text" fontSize={24} fontWeight="600" lineHeight={32}>
            {t('selection:status.noSteps')}
          </Text>
          <Text color="$textSecondary" lineHeight={22}>
            {t('companies:detail.derivedDescription')}
          </Text>
        </YStack>
      )}
    </YStack>
  );
}

function SectionHeader({ action, title }: { action?: ReactNode; title: string }) {
  return (
    <XStack gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Text color="$text" fontSize={22} fontWeight="600">
        {title}
      </Text>
      {action}
    </XStack>
  );
}

function ApplicationInfoSection({
  application,
  onEdit,
  onOpenUrl,
}: {
  application: ApplicationDetailData;
  onEdit: () => void;
  onOpenUrl: (url: string) => void;
}) {
  const { t } = useTranslation('companies');
  const hasOptionalInfo = Boolean(
    application.preferenceLevel ||
      application.location ||
      application.applicationUrl ||
      application.mypageUrl ||
      application.memo,
  );

  return (
    <InfoSection title={t('detail.applicationInfo')} onEdit={onEdit}>
      <InfoRow label={t('job')} value={application.jobTitle} />
      {application.preferenceLevel ? (
        <InfoRow label={t('detail.preference')} value={`${application.preferenceLevel} / 5`} />
      ) : null}
      {application.location ? <InfoRow label={t('detail.location')} value={application.location} /> : null}
      {application.applicationUrl ? (
        <InfoLink label={t('detail.jobPage')} url={application.applicationUrl} onOpen={onOpenUrl} />
      ) : null}
      {application.mypageUrl ? (
        <InfoLink label="MyPage" url={application.mypageUrl} onOpen={onOpenUrl} />
      ) : null}
      {application.memo ? <MemoBlock memo={application.memo} /> : null}
      {!hasOptionalInfo ? (
        <Text color="$textMuted" lineHeight={22}>
          {t('detail.noApplicationExtras')}
        </Text>
      ) : null}
    </InfoSection>
  );
}

function CompanyInfoSection({
  application,
  onEdit,
  onOpenUrl,
}: {
  application: ApplicationDetailData;
  onEdit: () => void;
  onOpenUrl: (url: string) => void;
}) {
  const { t } = useTranslation('companies');
  const hasOptionalInfo = Boolean(application.company.industry || application.company.websiteUrl);

  return (
    <InfoSection title={t('detail.companyInfo')} onEdit={onEdit}>
      <InfoRow label={t('detail.company')} value={application.company.name} />
      {application.company.industry ? <InfoRow label={t('industry')} value={application.company.industry} /> : null}
      {application.company.websiteUrl ? (
        <InfoLink label={t('detail.website')} url={application.company.websiteUrl} onOpen={onOpenUrl} />
      ) : null}
      {!hasOptionalInfo ? (
        <Text color="$textMuted" lineHeight={22}>
          {t('detail.noCompanyExtras')}
        </Text>
      ) : null}
    </InfoSection>
  );
}

function InfoSection({
  children,
  onEdit,
  title,
}: {
  children: ReactNode;
  onEdit: () => void;
  title: string;
}) {
  const { t } = useTranslation('common');
  return (
    <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$lg">
      <XStack gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color="$text" fontSize={20} fontWeight="600">
          {title}
        </Text>
        <AppButton variant="ghost" onPress={onEdit}>
          {t('actions.edit')}
        </AppButton>
      </XStack>
      {children}
    </YStack>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$xs">
      <Text color="$textMuted" fontSize={13}>
        {label}
      </Text>
      <Text color="$text" lineHeight={22}>
        {value}
      </Text>
    </YStack>
  );
}

function InfoLink({
  label,
  onOpen,
  url,
}: {
  label: string;
  onOpen: (url: string) => void;
  url: string;
}) {
  const { t } = useTranslation('common');
  return (
    <XStack gap="$sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <YStack flex={1} gap="$xs">
        <Text color="$textMuted" fontSize={13}>
          {label}
        </Text>
        <Text color="$textSecondary" fontSize={13} numberOfLines={1}>
          {getUrlHost(url)}
        </Text>
      </YStack>
      <AppButton variant="secondary" onPress={() => onOpen(url)}>
        {t('actions.open')}
      </AppButton>
    </XStack>
  );
}

function MemoBlock({ memo }: { memo: string }) {
  const { t } = useTranslation('companies');
  return (
    <YStack gap="$xs">
      <Text color="$textMuted" fontSize={13}>
        {t('detail.memo')}
      </Text>
      <YStack bg="$surfaceMuted" p="$md" style={{ borderRadius: 12 }}>
        <Text color="$text" lineHeight={22}>
          {memo}
        </Text>
      </YStack>
    </YStack>
  );
}

function getUrlHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
