import { ArrowRight } from '@tamagui/lucide-icons-2';
import { useQuery_experimental as useQuery } from 'convex/react';
import { Href, Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppButton } from '@/components/ui/AppButton';
import { LoadingState, MessageState } from '@/components/ui/States';
import { KnowledgeEmpty, KnowledgeHeader, KnowledgePage, SearchInput } from './KnowledgeLayout';
import { getSelectionStepDisplayName, type SelectionStepPresetKey } from '@/components/selection/selectionConstants';

type QuestionSummary = {
  questionGroupId: Id<'interviewQuestionGroups'>;
  title: string;
  questionCount: number;
  distinctCompanyCount: number;
  latestOccurrence: number;
  latestCompanyName: string;
  latestStepName: string;
  latestStepPresetKey?: SelectionStepPresetKey;
  poorCount: number;
  evaluatedCount: number;
  poorRate: number;
  latestPoorOccurrence: number;
};

type QuestionHistory = {
  interviewQuestionId: Id<'interviewQuestions'>;
  question: string;
  answer?: string;
  evaluation?: 'good' | 'neutral' | 'poor';
  occurrenceAt: number;
  company: { name: string };
  selectionStep: { selectionStepId: Id<'selectionSteps'>; name: string; presetKey?: SelectionStepPresetKey };
  applicationId: Id<'applications'>;
  knowledgeItemId?: Id<'knowledgeItems'>;
};

type QuestionDetail = QuestionSummary & { history: QuestionHistory[] };
type Mode = 'frequent' | 'weak';

export function FrequentQuestionsScreen() {
  const state = useQuery({ query: api.questionGroups.listFrequent, args: {} });
  return <QuestionListState mode="frequent" state={state} />;
}

export function WeakAnswersScreen() {
  const state = useQuery({ query: api.questionGroups.listWeakAnswers, args: {} });
  return <QuestionListState mode="weak" state={state} />;
}

function QuestionListState({ mode, state }: { mode: Mode; state: { status: string; data?: unknown } }) {
  const { t } = useTranslation(['knowledge', 'common']);
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLocaleLowerCase();
  const items = useMemo(
    () => state.status === 'success'
      ? (state.data as QuestionSummary[]).filter((item) => item.title.toLocaleLowerCase().includes(normalized))
      : [],
    [normalized, state],
  );
  const frequent = mode === 'frequent';

  return (
    <KnowledgePage>
      <KnowledgeHeader
        title={frequent ? t('knowledge:frequent') : t('knowledge:weakAnswers')}
        description={frequent ? t('knowledge:groups.frequentDescription') : t('knowledge:groups.weakDescription')}
      />
      <SearchInput value={search} onChangeText={setSearch} placeholder={t('knowledge:groups.searchQuestion')} />
      {state.status === 'pending' ? <LoadingState message={t('knowledge:groups.aggregating')} /> : null}
      {state.status === 'error' ? <MessageState message={t('knowledge:groups.aggregateFailed')} actionLabel={t('common:actions.retry')} onAction={() => window.location.reload()} /> : null}
      {state.status === 'success' && items.length === 0 ? <KnowledgeEmpty message={normalized ? t('knowledge:groups.noQuestionMatches') : frequent ? t('knowledge:groups.noFrequent') : t('knowledge:groups.noWeak')} /> : null}
      {items.length > 0 ? <YStack borderTopColor="$border" borderTopWidth={1}>{items.map((item) => <QuestionSummaryRow key={item.questionGroupId} item={item} mode={mode} />)}</YStack> : null}
    </KnowledgePage>
  );
}

function QuestionSummaryRow({ item, mode }: { item: QuestionSummary; mode: Mode }) {
  const { t } = useTranslation('knowledge');
  const href = `/knowledge/${mode === 'frequent' ? 'frequent' : 'weak-answers'}/${item.questionGroupId}` as Href;
  return (
    <Link href={href} asChild>
      <XStack borderBottomColor="$border" borderBottomWidth={1} cursor="pointer" gap="$base" py="$lg" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <YStack flex={1} gap="$xs" style={{ minWidth: 0 }}>
          <Text color="$text" fontSize={18} fontWeight="600">{item.title}</Text>
          {mode === 'frequent' ? (
            <Text color="$textSecondary">{t('frequency', { count: item.questionCount, companies: item.distinctCompanyCount })}</Text>
          ) : (
            <Text color="$textSecondary">{t('poorCount', { count: item.poorCount })} · {t('poorRate', { count: item.evaluatedCount, rate: Math.round(item.poorRate * 100) })}</Text>
          )}
          <Text color="$textMuted" fontSize={13}>{t('latest', { company: item.latestCompanyName })}</Text>
        </YStack>
        <ArrowRight color="$textMuted" size={19} />
      </XStack>
    </Link>
  );
}

function routeId(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) as Id<'interviewQuestionGroups'> | undefined;
}

export function FrequentQuestionDetailScreen() {
  const id = routeId(useLocalSearchParams().questionGroupId);
  const state = useQuery({ query: api.questionGroups.getFrequentDetail, args: id ? { questionGroupId: id } : 'skip' });
  return <QuestionDetailState mode="frequent" state={state} />;
}

export function WeakAnswerDetailScreen() {
  const id = routeId(useLocalSearchParams().questionGroupId);
  const state = useQuery({ query: api.questionGroups.getWeakAnswerDetail, args: id ? { questionGroupId: id } : 'skip' });
  return <QuestionDetailState mode="weak" state={state} />;
}

function QuestionDetailState({ mode, state }: { mode: Mode; state: { status: string; data?: unknown } }) {
  const { t } = useTranslation(['knowledge', 'common', 'selection']);
  if (state.status === 'pending') return <KnowledgePage><LoadingState message={t('knowledge:groups.historyLoading')} /></KnowledgePage>;
  if (state.status === 'error') return <KnowledgePage><MessageState message={t('knowledge:groups.historyFailed')} actionLabel={t('common:actions.back')} onAction={() => window.history.back()} /></KnowledgePage>;
  const detail = state.data as QuestionDetail | null | undefined;
  if (!detail) return <KnowledgePage><KnowledgeHeader title={t('knowledge:groups.missing')} /><KnowledgeEmpty message={t('knowledge:groups.missingQuestion')} /></KnowledgePage>;

  return (
    <KnowledgePage>
      <KnowledgeHeader
        backHref={(mode === 'frequent' ? '/knowledge/frequent' : '/knowledge/weak-answers') as Href}
        title={detail.title}
        description={mode === 'frequent'
          ? `${t('knowledge:frequency', { count: detail.questionCount, companies: detail.distinctCompanyCount })} · ${t('knowledge:latest', { company: detail.latestCompanyName })} · ${getSelectionStepDisplayName({ name: detail.latestStepName, presetKey: detail.latestStepPresetKey }, t)}`
          : `${t('knowledge:poorCount', { count: detail.poorCount })} · ${t('knowledge:poorRate', { count: detail.evaluatedCount, rate: Math.round(detail.poorRate * 100) })}`}
      />
      <YStack gap="$lg">
        {detail.history.map((item) => <QuestionHistoryRow key={item.interviewQuestionId} item={item} />)}
      </YStack>
    </KnowledgePage>
  );
}

function QuestionHistoryRow({ item }: { item: QuestionHistory }) {
  const { t } = useTranslation(['knowledge', 'selection']);
  return (
    <YStack borderBottomColor="$border" borderBottomWidth={1} gap="$base" pb="$lg">
      <Text color="$accentStrong" fontSize={14} fontWeight="600">{item.company.name} · {getSelectionStepDisplayName(item.selectionStep, t)}</Text>
      <Field label={t('knowledge:groups.originalQuestion')} value={item.question} />
      {item.answer ? <Field label={t('knowledge:groups.originalAnswer')} value={item.answer} /> : null}
      {item.evaluation ? <Field label={t('knowledge:groups.evaluation')} value={t(`knowledge:groups.evaluation${item.evaluation === 'good' ? 'Good' : item.evaluation === 'neutral' ? 'Neutral' : 'Poor'}`)} /> : null}
      <XStack gap="$sm" flexWrap="wrap">
        {item.knowledgeItemId ? (
          <Link href={`/knowledge/items?item=${item.knowledgeItemId}` as Href} asChild><AppButton variant="secondary">{t('knowledge:groups.knowledgeVersion')}</AppButton></Link>
        ) : null}
        <Link href={`/applications/${item.applicationId}/interviews/${item.selectionStep.selectionStepId}` as Href} asChild><AppButton variant="ghost">{t('knowledge:groups.interviewReview')}</AppButton></Link>
      </XStack>
    </YStack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <YStack gap="$xs"><Text color="$textMuted" fontSize={12} fontWeight="600">{label}</Text><Text color="$textSecondary" lineHeight={23} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</Text></YStack>;
}
