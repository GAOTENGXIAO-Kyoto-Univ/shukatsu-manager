import { ChevronLeft, MoreHorizontal, Pencil, Plus, Trash2 } from '@tamagui/lucide-icons-2';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
  InterviewFormat,
  InterviewPageData,
  InterviewQuestionData,
} from '@/components/interviews/types';
import { AppButton } from '@/components/ui/AppButton';
import { LoadingState, MessageState } from '@/components/ui/States';

const formatLabels: Record<InterviewFormat, string> = {
  online: '线上',
  offline: '线下',
  phone: '电话',
  other: '其他',
};

function readRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function InterviewDetailScreen() {
  const params = useLocalSearchParams();
  const applicationId = readRouteParam(params.applicationId);
  const selectionStepId = readRouteParam(params.selectionStepId);
  const [retryKey, setRetryKey] = useState(0);

  if (!applicationId || !selectionStepId) {
    return <UnavailableState applicationId={applicationId} message="面试记录不存在" />;
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
  const interviewState = useQuery({
    query: api.interviews.getBySelectionStep,
    args: { applicationId, selectionStepId },
  });

  if (interviewState.status === 'pending') {
    return <PageFrame><LoadingState message="正在加载面试记录..." /></PageFrame>;
  }

  if (interviewState.status === 'error') {
    return <PageFrame><MessageState message="加载失败，请重试" actionLabel="重试" onAction={onRetry} /></PageFrame>;
  }

  if (interviewState.data.status === 'unavailable') {
    return <UnavailableState applicationId={applicationId} message="面试记录不存在" />;
  }

  if (interviewState.data.status === 'not_interview') {
    return <UnavailableState applicationId={applicationId} message="该选考步骤不是面试类型" />;
  }

  const data: InterviewPageData = interviewState.data;
  return <InterviewWorkspace data={data} />;
}

function InterviewWorkspace({ data }: { data: InterviewPageData }) {
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
      setDeleteError('删除失败，请重试');
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
      setDeleteError('删除失败，请重试');
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
                  返回
                </AppButton>
                <YStack gap="$xs" style={{ minWidth: 0 }}>
                  <XStack flexWrap="wrap" gap="$sm" style={{ alignItems: 'baseline' }}>
                    <Text color="$text" fontSize={30} fontWeight="600" lineHeight={38}>{data.company.name}</Text>
                    <Text color="$textSecondary" fontSize={17}>{data.application.jobTitle}</Text>
                  </XStack>
                  <Text color="$text" fontSize={22} fontWeight="600" lineHeight={30}>{data.selectionStep.name}</Text>
                  <XStack gap="$sm" mt="$xs" style={{ alignItems: 'center' }}>
                    <Text color="$textMuted" fontSize={13} fontWeight="600">时间</Text>
                    <Text color="$textSecondary">
                      {data.event ? formatEventDate(data.event, 'detail') : '未设置'}
                    </Text>
                  </XStack>
                </YStack>
              </YStack>
              {data.interviewDetail ? (
                <AppButton aria-label="面试记录操作" variant="ghost" icon={<MoreHorizontal size={20} />} onPress={() => setPageMenuOpen(true)} />
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
                title="面试问题"
                action={<AppButton variant="primary" icon={<Plus size={17} />} onPress={() => openQuestionEditor(null)}>添加问题</AppButton>}
              />
              {data.questions.length > 0 ? (
                <InterviewQuestionList items={data.questions} onOpenActions={setQuestionActionTarget} />
              ) : (
                <SectionEmpty message="还没有记录面试问题" actionLabel="添加问题" onAction={() => openQuestionEditor(null)} />
              )}
            </YStack>
          </XStack>
        </YStack>
      </ScrollView>

      <InterviewDetailFormOverlay detail={data.interviewDetail} hasQuestions={data.questions.length > 0} mode={detailFormMode} onClose={() => setDetailFormMode(null)} selectionStepId={data.selectionStep.selectionStepId} />
      <InterviewQuestionOverlay item={editingQuestion} onClose={() => { setQuestionEditorOpen(false); setEditingQuestion(null); }} open={questionEditorOpen} selectionStepId={data.selectionStep.selectionStepId} />

      <ResponsiveOverlay desktopPresentation="popover" onClose={() => setPageMenuOpen(false)} open={pageMenuOpen} title="面试记录操作" width={320}>
        <MenuAction danger icon={<Trash2 color="$danger" size={18} />} label="删除面试记录" onPress={() => { setPageMenuOpen(false); setDeleteError(null); setDeleteInterviewOpen(true); }} />
      </ResponsiveOverlay>

      <ResponsiveOverlay desktopPresentation="popover" onClose={() => setQuestionActionTarget(null)} open={Boolean(questionActionTarget)} title="问题操作" width={320}>
        <YStack gap="$sm">
          <MenuAction icon={<Pencil color="$textSecondary" size={18} />} label="编辑问题" onPress={() => { const item = questionActionTarget; setQuestionActionTarget(null); if (item) openQuestionEditor(item); }} />
          <MenuAction danger icon={<Trash2 color="$danger" size={18} />} label="删除问题" onPress={() => { setDeleteError(null); setDeleteQuestionTarget(questionActionTarget); setQuestionActionTarget(null); }} />
        </YStack>
      </ResponsiveOverlay>

      <ResponsiveOverlay onClose={() => !deletingInterview && setDeleteInterviewOpen(false)} open={deleteInterviewOpen} title="删除面试记录？">
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>该面试的基本信息、复盘内容和所有面试问题都会被删除。</Text>
          <Text color="$textSecondary" lineHeight={22}>选考步骤和时间事项不会受到影响。</Text>
          {deleteError ? <Text color="$danger">{deleteError}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={deletingInterview} onPress={() => setDeleteInterviewOpen(false)}>取消</AppButton>
            <AppButton variant="danger" disabled={deletingInterview} onPress={() => void confirmInterviewDelete()}>{deletingInterview ? '删除中...' : '删除'}</AppButton>
          </XStack>
        </YStack>
      </ResponsiveOverlay>

      <ResponsiveOverlay onClose={() => !deletingQuestion && setDeleteQuestionTarget(null)} open={Boolean(deleteQuestionTarget)} title="删除这个问题？">
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>删除后，该问题的回答、评价和备注也会一并删除。</Text>
          {deleteError ? <Text color="$danger">{deleteError}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={deletingQuestion} onPress={() => setDeleteQuestionTarget(null)}>取消</AppButton>
            <AppButton variant="danger" disabled={deletingQuestion} onPress={() => void confirmQuestionDelete()}>{deletingQuestion ? '删除中...' : '删除'}</AppButton>
          </XStack>
        </YStack>
      </ResponsiveOverlay>
    </PageFrame>
  );
}

function InterviewInfoSection({ detail, onEdit }: { detail: InterviewDetailData | null; onEdit: () => void }) {
  const hasInfo = Boolean(detail?.interviewFormat || detail?.interviewerCount || detail?.durationMinutes || detail?.interviewerInfo);
  return (
    <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$lg">
      <SectionHeader title="面试信息" action={hasInfo ? <AppButton variant="ghost" onPress={onEdit}>编辑</AppButton> : undefined} />
      {hasInfo && detail ? (
        <YStack gap="$base">
          {detail.interviewFormat ? <DisplayField label="面试方式" value={formatLabels[detail.interviewFormat]} /> : null}
          {detail.interviewerCount ? <DisplayField label="面试官人数" value={`${detail.interviewerCount} 人`} /> : null}
          {detail.durationMinutes ? <DisplayField label="实际时长" value={`${detail.durationMinutes} 分钟`} /> : null}
          {detail.interviewerInfo ? <DisplayField label="面试官信息" value={detail.interviewerInfo} multiline /> : null}
        </YStack>
      ) : <SectionEmpty message="暂无面试信息" actionLabel="添加面试信息" onAction={onEdit} />}
    </YStack>
  );
}

function InterviewReviewSection({ detail, onEdit }: { detail: InterviewDetailData | null; onEdit: () => void }) {
  const hasReview = Boolean(detail?.goodPoints || detail?.improvementPoints || detail?.nextImprovement || detail?.overallNote);
  return (
    <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$lg">
      <SectionHeader title="面试复盘" action={hasReview ? <AppButton variant="ghost" onPress={onEdit}>编辑</AppButton> : undefined} />
      {hasReview && detail ? (
        <YStack gap="$lg">
          {detail.goodPoints ? <DisplayField label="表现好的地方" value={detail.goodPoints} multiline /> : null}
          {detail.improvementPoints ? <DisplayField label="需要改进的地方" value={detail.improvementPoints} multiline /> : null}
          {detail.nextImprovement ? <DisplayField label="下次改进事项" value={detail.nextImprovement} multiline /> : null}
          {detail.overallNote ? <DisplayField label="其他复盘" value={detail.overallNote} multiline /> : null}
        </YStack>
      ) : <SectionEmpty message="还没有填写复盘" actionLabel="开始复盘" onAction={onEdit} />}
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
  const back = () => router.replace((applicationId ? `/applications/${applicationId}` : '/companies') as Href);
  return <PageFrame><MessageState message={message} actionLabel="返回应聘详情" onAction={back} /></PageFrame>;
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <YStack flex={1} bg="$background">{children}</YStack>;
}
