import { CalendarClock, ChevronLeft, MoreHorizontal, Plus } from '@tamagui/lucide-icons-2';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { XStack, YStack, Text, useMedia } from 'tamagui';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ApplicationDetailActionMenu } from '@/components/applications/ApplicationDetailActionMenu';
import { EditApplicationOverlay } from '@/components/applications/EditApplicationOverlay';
import { EditCompanyOverlay } from '@/components/applications/EditCompanyOverlay';
import type { ApplicationDetailData, SelectionStepDetail } from '@/components/applications/types';
import { DeleteApplicationDialog, type DeleteApplicationTarget } from '@/components/companies/DeleteApplicationDialog';
import { AddSelectionStepOverlay } from '@/components/selection/AddSelectionStepOverlay';
import { ResearchSummary } from '@/components/research/ResearchSummary';
import { formatEventDate, getEventLabel } from '@/components/events/eventFormatting';
import { useTimeBucket } from '@/hooks/useTimeBucket';
import { SelectionStatusBadge } from '@/components/selection/SelectionStatusBadge';
import { SelectionStepActions } from '@/components/selection/SelectionStepActions';
import { canMoveStep, SelectionTimeline } from '@/components/selection/SelectionTimeline';
import { getStatusLabel } from '@/components/selection/selectionConstants';
import { AppButton } from '@/components/ui/AppButton';
import { AppToast } from '@/components/ui/AppToast';
import { LoadingState, MessageState } from '@/components/ui/States';
import { useRetainedQueryData } from '@/hooks/useRetainedQueryData';

function readRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ApplicationDetailScreen() {
  const router = useRouter();
  const media = useMedia();
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
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [editApplicationOpen, setEditApplicationOpen] = useState(false);
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<Id<'selectionSteps'> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteApplicationTarget | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dismissedStepParam, setDismissedStepParam] = useState<string | null>(null);
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
      setToastMessage('链接打开失败');
    }
  }

  if (!applicationId) {
    return (
      <PageFrame>
        <MessageState message="应聘记录不存在" actionLabel="返回企业" onAction={goBack} />
      </PageFrame>
    );
  }

  if (applicationState.status === 'pending' && !retainedApplication.hasData) {
    return (
      <PageFrame>
        <LoadingState message="正在读取应聘记录..." />
      </PageFrame>
    );
  }

  if (applicationState.status === 'error' && !retainedApplication.hasData) {
    return (
      <PageFrame>
        <MessageState message="读取失败，请重试" actionLabel="返回企业" onAction={goBack} />
      </PageFrame>
    );
  }

  if (!retainedApplication.hasData || !retainedApplication.data) {
    return (
      <PageFrame>
        <MessageState message="应聘记录不存在，或你没有访问权限" actionLabel="返回企业" onAction={goBack} />
      </PageFrame>
    );
  }

  const application: ApplicationDetailData = retainedApplication.data;
  const isDesktop = Boolean(media.md);
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
      setToastMessage('顺序已更新');
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : '顺序更新失败');
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
                返回
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
              操作
            </AppButton>
          </XStack>

          <CurrentStatusPanel application={application} onAddStep={() => setAddStepOpen(true)} />

          <XStack
            gap="$xl"
            style={{
              alignItems: 'flex-start',
              flexDirection: isDesktop ? 'row' : 'column',
            }}
          >
            <YStack flex={1} gap="$xl" width={isDesktop ? undefined : '100%'}>
              <SectionHeader
                action={
                  application.selectionSteps.length > 0 ? (
                    <AppButton
                      variant="primary"
                      icon={<Plus size={18} />}
                      onPress={() => setAddStepOpen(true)}
                    >
                      添加步骤
                    </AppButton>
                  ) : undefined
                }
                title="选考流程"
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
                    尚未设置选考流程
                  </Text>
                  <Text color="$textSecondary" lineHeight={22} style={{ maxWidth: 360, textAlign: 'center' }}>
                    添加 ES、Web Test、面试等步骤后，当前阶段会自动从流程中计算。
                  </Text>
                </YStack>
              )}
            </YStack>

            <YStack gap="$xl" width={isDesktop ? 360 : '100%'}>
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

function CurrentStatusPanel({
  application,
  onAddStep,
}: {
  application: ApplicationDetailData;
  onAddStep: () => void;
}) {
  return (
    <YStack bg="$surface" gap="$base" p="$lg" style={{ borderRadius: 16 }}>
      <XStack gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color="$textSecondary" fontSize={14} fontWeight="600">
          当前状态
        </Text>
        {application.currentStatus ? <SelectionStatusBadge status={application.currentStatus} /> : null}
      </XStack>
      {application.currentStage && application.currentStatus ? (
        <YStack gap="$xs">
          <Text color="$text" fontSize={26} fontWeight="600" lineHeight={34}>
            {application.currentStage.name}
          </Text>
          <Text color="$textSecondary" lineHeight={22}>
            {getStatusLabel(application.currentStatus)}
          </Text>
          {application.nextEvent ? (
            <YStack borderTopColor="$border" borderTopWidth={1} gap="$xs" mt="$md" pt="$md">
              <XStack gap="$sm" style={{ alignItems: 'center' }}>
                <CalendarClock color="$textSecondary" size={17} />
                <Text color="$textSecondary" fontSize={13} fontWeight="600">下一事项</Text>
              </XStack>
              <Text color={application.nextEvent.isOverdue ? '$danger' : '$text'} fontSize={18} fontWeight="600">
                {formatEventDate(application.nextEvent, 'detail')}
              </Text>
              <Text color="$textSecondary" lineHeight={22}>
                {getEventLabel(application.nextEvent.stepName, application.nextEvent.timingType)}
                {application.nextEvent.isOverdue ? ' · 已超时' : ''}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      ) : (
        <YStack gap="$base">
          <Text color="$text" fontSize={24} fontWeight="600" lineHeight={32}>
            尚未设置选考流程
          </Text>
          <Text color="$textSecondary" lineHeight={22}>
            当前状态会由已添加的选考步骤自动推导，不需要手动维护。
          </Text>
          <AppButton variant="primary" icon={<Plus size={18} />} onPress={onAddStep} style={{ alignSelf: 'flex-start' }}>
            添加步骤
          </AppButton>
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
  const hasOptionalInfo = Boolean(
    application.preferenceLevel ||
      application.location ||
      application.applicationUrl ||
      application.mypageUrl ||
      application.memo,
  );

  return (
    <InfoSection title="应聘信息" onEdit={onEdit}>
      <InfoRow label="岗位" value={application.jobTitle} />
      {application.preferenceLevel ? (
        <InfoRow label="志望度" value={`${application.preferenceLevel} / 5`} />
      ) : null}
      {application.location ? <InfoRow label="工作地点" value={application.location} /> : null}
      {application.applicationUrl ? (
        <InfoLink label="招聘职位页面" url={application.applicationUrl} onOpen={onOpenUrl} />
      ) : null}
      {application.mypageUrl ? (
        <InfoLink label="MyPage" url={application.mypageUrl} onOpen={onOpenUrl} />
      ) : null}
      {application.memo ? <MemoBlock memo={application.memo} /> : null}
      {!hasOptionalInfo ? (
        <Text color="$textMuted" lineHeight={22}>
          还没有补充地点、志望度、链接或备注。
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
  const hasOptionalInfo = Boolean(application.company.industry || application.company.websiteUrl);

  return (
    <InfoSection title="企业信息" onEdit={onEdit}>
      <InfoRow label="企业" value={application.company.name} />
      {application.company.industry ? <InfoRow label="行业" value={application.company.industry} /> : null}
      {application.company.websiteUrl ? (
        <InfoLink label="官网" url={application.company.websiteUrl} onOpen={onOpenUrl} />
      ) : null}
      {!hasOptionalInfo ? (
        <Text color="$textMuted" lineHeight={22}>
          还没有补充行业或官网。
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
  return (
    <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$lg">
      <XStack gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color="$text" fontSize={20} fontWeight="600">
          {title}
        </Text>
        <AppButton variant="ghost" onPress={onEdit}>
          编辑
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
        打开
      </AppButton>
    </XStack>
  );
}

function MemoBlock({ memo }: { memo: string }) {
  return (
    <YStack gap="$xs">
      <Text color="$textMuted" fontSize={13}>
        备注
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
    return '链接';
  }
}
