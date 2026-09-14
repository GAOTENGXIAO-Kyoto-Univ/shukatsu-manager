import { ChevronLeft, MoreHorizontal, Pencil, Plus, Trash2 } from '@tamagui/lucide-icons-2';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { formatEventDate } from '@/components/events/eventFormatting';
import { InterviewDetailFormOverlay } from '@/components/interviews/InterviewDetailFormOverlay';
import { InterviewQuestionList } from '@/components/interviews/InterviewQuestionList';
import { InterviewQuestionOverlay } from '@/components/interviews/InterviewQuestionOverlay';
import type {
  InterviewDetailData,
  InterviewPageData,
  InterviewQuestionData,
} from '@/components/interviews/types';
import { AppButton } from '@/components/ui/AppButton';
import { LoadingState, MessageState } from '@/components/ui/States';
import { getSelectionStepDisplayName } from '@/components/selection/selectionConstants';

function readRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function InterviewDetailScreen() {
  const { t } = useTranslation('interview');
  const params = useLocalSearchParams();
  const applicationId = readRouteParam(params.applicationId);
  const selectionStepId = readRouteParam(params.selectionStepId);
  const [retryKey, setRetryKey] = useState(0);

  if (!applicationId || !selectionStepId) {
    return <UnavailableState applicationId={applicationId} message={t('missing')} />;
  }

  return (
    <InterviewDetailContent
      key={retryKey}
      applicationId={applicationId as Id<'applications'>}
      selectionStepId={selectionStepId as Id<'selectionSteps'>}
      onRetry={() => setRetryKey((value) => value + 1)}
    />
  );
}

function InterviewDetailContent({
  applicationId,
  onRetry,
  selectionStepId,
}: {
  applicationId: Id<'applications'>;
  onRetry: () => void;
  selectionStepId: Id<'selectionSteps'>;
}) {
  const { t } = useTranslation(['interview', 'common']);
  const interviewState = useQuery({
    query: api.interviews.getBySelectionStep,
    args: { applicationId, selectionStepId },
  });

  if (interviewState.status === 'pending') {
    return <PageFrame><LoadingState message={t('interview:loading')} /></PageFrame>;
  }

  if (interviewState.status === 'error') {
    return <PageFrame><MessageState message={t('common:errors.load')} actionLabel={t('common:actions.retry')} onAction={onRetry} /></PageFrame>;
  }

  if (interviewState.data.status === 'unavailable') {
    return <UnavailableState applicationId={applicationId} message={t('interview:missing')} />;
  }

  if (interviewState.data.status === 'not_interview') {
    return <UnavailableState applicationId={applicationId} message={t('interview:notInterview')} />;
  }

  const data: InterviewPageData = interviewState.data;
  return <InterviewWorkspace data={data} />;
}

function InterviewWorkspace({ data }: { data: InterviewPageData }) {
  const { t } = useTranslation(['interview', 'common', 'selection']);
  const router = useRouter();
  const media = useMedia();
  const removeInterview = useMutation(api.interviews.remove);
  const removeQuestion = useMutation(api.interviewQuestions.remove);
  const [detailFormMode, setDetailFormMode] = useState<'info' | 'review' | null>(null);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [deleteInterviewOpen, setDeleteInterviewOpen] = useState(false);
  const [questionEditorOpen, setQuestionEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<InterviewQuestionData | null>(null);
  const [questionActionTarget, setQuestionActionTarget] = useState<InterviewQuestionData | null>(null);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<InterviewQuestionData | null>(null);
  const [deletingInterview, setDeletingInterview] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isDesktop = Boolean(media.md);

  function backToApplication() {
    router.replace(`/applications/${data.application.applicationId}` as Href);
  }

  function openQuestionEditor(item: InterviewQuestionData | null) {
    setEditingQuestion(item);
    setQuestionEditorOpen(true);
  }

  async function confirmInterviewDelete() {
    if (!data.interviewDetail || deletingInterview) return;
    setDeletingInterview(true);
    setDeleteError(null);
    try {
      await removeInterview({ interviewDetailId: data.interviewDetail.interviewDetailId });
      setDeleteInterviewOpen(false);
    } catch {
      setDeleteError(t('common:errors.delete'));
    } finally {
      setDeletingInterview(false);
    }
  }

  async function confirmQuestionDelete() {
    if (!deleteQuestionTarget || deletingQuestion) return;
    setDeletingQuestion(true);
    setDeleteError(null);
    try {
      await removeQuestion({ interviewQuestionId: deleteQuestionTarget.interviewQuestionId });
      setDeleteQuestionTarget(null);
    } catch {
      setDeleteError(t('common:errors.delete'));
    } finally {
      setDeletingQuestion(false);
    }
  }

  return (
    <PageFrame>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$xl" maxW={1180} width="100%" p="$base" pb="$xxl" style={{ alignSelf: 'center' }}>
          <YStack borderBottomColor="$border" borderBottomWidth={1} gap="$base" pb="$lg" pt="$md">
            <XStack gap="$base" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <YStack flex={1} gap="$base" style={{ minWidth: 0 }}>
                <AppButton variant="ghost" icon={<ChevronLeft size={18} />} onPress={backToApplication} style={{ alignSelf: 'flex-start' }}>
                  {t('common:actions.back')}
                </AppButton>
                <YStack gap="$xs" style={{ minWidth: 0 }}>
                  <XStack flexWrap="wrap" gap="$sm" style={{ alignItems: 'baseline' }}>
                    <Text color="$text" fontSize={30} fontWeight="600" lineHeight={38}>{data.company.name}</Text>
                    <Text color="$textSecondary" fontSize={17}>{data.application.jobTitle}</Text>
                  </XStack>
                  <Text color="$text" fontSize={22} fontWeight="600" lineHeight={30}>{getSelectionStepDisplayName(data.selectionStep, t)}</Text>
                  <XStack gap="$sm" mt="$xs" style={{ alignItems: 'center' }}>
                    <Text color="$textMuted" fontSize={13} fontWeight="600">{t('interview:time')}</Text>
                    <Text color="$textSecondary">
                      {data.event ? formatEventDate(data.event, 'detail') : t('interview:unset')}
                    </Text>
                  </XStack>
                </YStack>
              </YStack>
              {data.interviewDetail ? (
                <AppButton aria-label={t('interview:recordActions')} variant="ghost" icon={<MoreHorizontal size={20} />} onPress={() => setPageMenuOpen(true)} />
              ) : null}
            </XStack>
          </YStack>

          <XStack gap="$xxl" style={{ alignItems: 'flex-start', flexDirection: isDesktop ? 'row' : 'column' }}>
            <YStack gap="$xl" width={isDesktop ? '38%' : '100%'} style={{ minWidth: 0 }}>
              <InterviewInfoSection detail={data.interviewDetail} onEdit={() => setDetailFormMode('info')} />
              <InterviewReviewSection detail={data.interviewDetail} onEdit={() => setDetailFormMode('review')} />
            </YStack>
            <YStack gap="$base" width={isDesktop ? '62%' : '100%'} style={{ minWidth: 0 }}>
              <SectionHeader
                title={t('interview:questions')}
                action={<AppButton variant="primary" icon={<Plus size={17} />} onPress={() => openQuestionEditor(null)}>{t('interview:addQuestion')}</AppButton>}
              />
              {data.questions.length > 0 ? (
                <InterviewQuestionList items={data.questions} onOpenActions={setQuestionActionTarget} />
              ) : (
                <SectionEmpty message={t('interview:noQuestions')} actionLabel={t('interview:addQuestion')} onAction={() => openQuestionEditor(null)} />
              )}
            </YStack>
          </XStack>
        </YStack>
      </ScrollView>

      <InterviewDetailFormOverlay detail={data.interviewDetail} hasQuestions={data.questions.length > 0} mode={detailFormMode} onClose={() => setDetailFormMode(null)} selectionStepId={data.selectionStep.selectionStepId} />
      <InterviewQuestionOverlay item={editingQuestion} onClose={() => { setQuestionEditorOpen(false); setEditingQuestion(null); }} open={questionEditorOpen} selectionStepId={data.selectionStep.selectionStepId} />

      <ResponsiveOverlay desktopPresentation="popover" onClose={() => setPageMenuOpen(false)} open={pageMenuOpen} title={t('interview:recordActions')} width={320}>
        <MenuAction danger icon={<Trash2 color="$danger" size={18} />} label={t('interview:deleteRecord')} onPress={() => { setPageMenuOpen(false); setDeleteError(null); setDeleteInterviewOpen(true); }} />
      </ResponsiveOverlay>

      <ResponsiveOverlay desktopPresentation="popover" onClose={() => setQuestionActionTarget(null)} open={Boolean(questionActionTarget)} title={t('interview:questionActions')} width={320}>
        <YStack gap="$sm">
          <MenuAction icon={<Pencil color="$textSecondary" size={18} />} label={t('interview:editQuestion')} onPress={() => { const item = questionActionTarget; setQuestionActionTarget(null); if (item) openQuestionEditor(item); }} />
          <MenuAction danger icon={<Trash2 color="$danger" size={18} />} label={t('interview:deleteQuestion')} onPress={() => { setDeleteError(null); setDeleteQuestionTarget(questionActionTarget); setQuestionActionTarget(null); }} />
        </YStack>
      </ResponsiveOverlay>

      <ResponsiveOverlay onClose={() => !deletingInterview && setDeleteInterviewOpen(false)} open={deleteInterviewOpen} title={t('interview:deleteRecordTitle')}>
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>{t('interview:deleteRecordDescription')}</Text>
          <Text color="$textSecondary" lineHeight={22}>{t('interview:deleteRecordSafe')}</Text>
          {deleteError ? <Text color="$danger">{deleteError}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={deletingInterview} onPress={() => setDeleteInterviewOpen(false)}>{t('common:actions.cancel')}</AppButton>
            <AppButton variant="danger" disabled={deletingInterview} onPress={() => void confirmInterviewDelete()}>{deletingInterview ? t('common:states.deleting') : t('common:actions.delete')}</AppButton>
          </XStack>
        </YStack>
      </ResponsiveOverlay>

      <ResponsiveOverlay onClose={() => !deletingQuestion && setDeleteQuestionTarget(null)} open={Boolean(deleteQuestionTarget)} title={t('interview:deleteQuestionTitle')}>
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>{t('interview:deleteQuestionDescription')}</Text>
          {deleteError ? <Text color="$danger">{deleteError}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={deletingQuestion} onPress={() => setDeleteQuestionTarget(null)}>{t('common:actions.cancel')}</AppButton>
            <AppButton variant="danger" disabled={deletingQuestion} onPress={() => void confirmQuestionDelete()}>{deletingQuestion ? t('common:states.deleting') : t('common:actions.delete')}</AppButton>
          </XStack>
        </YStack>
      </ResponsiveOverlay>
    </PageFrame>
  );
}

function InterviewInfoSection({ detail, onEdit }: { detail: InterviewDetailData | null; onEdit: () => void }) {
  const { t } = useTranslation(['interview', 'common']);
  const hasInfo = Boolean(detail?.interviewFormat || detail?.interviewerCount || detail?.durationMinutes || detail?.interviewerInfo);
  return (
    <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$lg">
      <SectionHeader title={t('interview:info')} action={hasInfo ? <AppButton variant="ghost" onPress={onEdit}>{t('common:actions.edit')}</AppButton> : undefined} />
      {hasInfo && detail ? (
        <YStack gap="$base">
          {detail.interviewFormat ? <DisplayField label={t('interview:format')} value={t(`interview:formats.${detail.interviewFormat}`)} /> : null}
          {detail.interviewerCount ? <DisplayField label={t('interview:interviewerCount')} value={t('interview:people', { count: detail.interviewerCount })} /> : null}
          {detail.durationMinutes ? <DisplayField label={t('interview:duration')} value={t('interview:minutes', { count: detail.durationMinutes })} /> : null}
          {detail.interviewerInfo ? <DisplayField label={t('interview:interviewerInfo')} value={detail.interviewerInfo} multiline /> : null}
        </YStack>
      ) : <SectionEmpty message={t('interview:noInfo')} actionLabel={t('interview:addInfo')} onAction={onEdit} />}
    </YStack>
  );
}

function InterviewReviewSection({ detail, onEdit }: { detail: InterviewDetailData | null; onEdit: () => void }) {
  const { t } = useTranslation(['interview', 'common']);
  const hasReview = Boolean(detail?.goodPoints || detail?.improvementPoints || detail?.nextImprovement || detail?.overallNote);
  return (
    <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$lg">
      <SectionHeader title={t('interview:review')} action={hasReview ? <AppButton variant="ghost" onPress={onEdit}>{t('common:actions.edit')}</AppButton> : undefined} />
      {hasReview && detail ? (
        <YStack gap="$lg">
          {detail.goodPoints ? <DisplayField label={t('interview:goodPoints')} value={detail.goodPoints} multiline /> : null}
          {detail.improvementPoints ? <DisplayField label={t('interview:improvementPoints')} value={detail.improvementPoints} multiline /> : null}
          {detail.nextImprovement ? <DisplayField label={t('interview:nextImprovement')} value={detail.nextImprovement} multiline /> : null}
          {detail.overallNote ? <DisplayField label={t('interview:overallNote')} value={detail.overallNote} multiline /> : null}
        </YStack>
      ) : <SectionEmpty message={t('interview:noReview')} actionLabel={t('interview:startReview')} onAction={onEdit} />}
    </YStack>
  );
}

function SectionHeader({ action, title }: { action?: React.ReactNode; title: string }) {
  return <XStack gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}><Text color="$text" fontSize={22} fontWeight="600">{title}</Text>{action}</XStack>;
}

function SectionEmpty({ actionLabel, message, onAction }: { actionLabel: string; message: string; onAction: () => void }) {
  return <YStack gap="$base" py="$md"><Text color="$textMuted">{message}</Text><AppButton variant="secondary" onPress={onAction} style={{ alignSelf: 'flex-start' }}>{actionLabel}</AppButton></YStack>;
}

function DisplayField({ label, multiline = false, value }: { label: string; multiline?: boolean; value: string }) {
  return <YStack gap="$xs" style={{ minWidth: 0 }}><Text color="$textMuted" fontSize={13} fontWeight="600">{label}</Text><Text color="$text" lineHeight={23} style={multiline ? { overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' } : undefined}>{value}</Text></YStack>;
}

function MenuAction({ danger = false, icon, label, onPress }: { danger?: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return <XStack bg={danger ? '$dangerSoft' : '$surfaceMuted'} cursor="pointer" gap="$sm" minH={44} onPress={onPress} p="$md" style={{ alignItems: 'center', borderRadius: 12 }}>{icon}<Text color={danger ? '$danger' : '$text'} fontWeight="600">{label}</Text></XStack>;
}

function UnavailableState({ applicationId, message }: { applicationId?: string; message: string }) {
  const router = useRouter();
  const { t } = useTranslation('interview');
  const back = () => router.replace((applicationId ? `/applications/${applicationId}` : '/companies') as Href);
  return <PageFrame><MessageState message={message} actionLabel={t('back')} onAction={back} /></PageFrame>;
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <YStack flex={1} bg="$background">{children}</YStack>;
}
