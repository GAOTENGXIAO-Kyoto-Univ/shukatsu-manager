import { ArrowRight } from '@tamagui/lucide-icons-2';
import { useQuery_experimental as useQuery } from 'convex/react';
import { Href, Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppButton } from '@/components/ui/AppButton';
import { LoadingState, MessageState } from '@/components/ui/States';
import { KnowledgeEmpty, KnowledgeHeader, KnowledgePage, SearchInput } from './KnowledgeLayout';

type QuestionSummary = {
  questionGroupId: Id<'interviewQuestionGroups'>;
  title: string;
  questionCount: number;
  distinctCompanyCount: number;
  latestOccurrence: number;
  latestCompanyName: string;
  latestStepName: string;
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
  selectionStep: { selectionStepId: Id<'selectionSteps'>; name: string };
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
        title={frequent ? '高频面试问题' : '经常回答不好'}
        description={frequent ? '从完整面试历史中汇总反复出现的问题。' : '只统计被明确评价为「需要改进」的问题。'}
      />
      <SearchInput value={search} onChangeText={setSearch} placeholder="搜索代表问题..." />
      {state.status === 'pending' ? <LoadingState message="正在汇总历史..." /> : null}
      {state.status === 'error' ? <MessageState message="汇总读取失败" actionLabel="重试" onAction={() => window.location.reload()} /> : null}
      {state.status === 'success' && items.length === 0 ? <KnowledgeEmpty message={normalized ? '没有符合条件的问题' : frequent ? '还没有出现两次以上的问题' : '还没有两次以上的「需要改进」评价'} /> : null}
      {items.length > 0 ? <YStack borderTopColor="$border" borderTopWidth={1}>{items.map((item) => <QuestionSummaryRow key={item.questionGroupId} item={item} mode={mode} />)}</YStack> : null}
    </KnowledgePage>
  );
}

function QuestionSummaryRow({ item, mode }: { item: QuestionSummary; mode: Mode }) {
  const href = `/knowledge/${mode === 'frequent' ? 'frequent' : 'weak-answers'}/${item.questionGroupId}` as Href;
  return (
    <Link href={href} asChild>
      <XStack borderBottomColor="$border" borderBottomWidth={1} cursor="pointer" gap="$base" py="$lg" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <YStack flex={1} gap="$xs" style={{ minWidth: 0 }}>
          <Text color="$text" fontSize={18} fontWeight="600">{item.title}</Text>
          {mode === 'frequent' ? (
            <Text color="$textSecondary">被问 {item.questionCount} 次 · 来自 {item.distinctCompanyCount} 家公司</Text>
          ) : (
            <Text color="$textSecondary">评价为「需要改进」：{item.poorCount} 次 · 已评价：{item.evaluatedCount} 次 · 表现不佳率：{Math.round(item.poorRate * 100)}%</Text>
          )}
          <Text color="$textMuted" fontSize={13}>最近一次：{item.latestCompanyName}</Text>
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
  if (state.status === 'pending') return <KnowledgePage><LoadingState message="正在加载问题历史..." /></KnowledgePage>;
  if (state.status === 'error') return <KnowledgePage><MessageState message="问题历史加载失败" actionLabel="返回" onAction={() => window.history.back()} /></KnowledgePage>;
  const detail = state.data as QuestionDetail | null | undefined;
  if (!detail) return <KnowledgePage><KnowledgeHeader title="记录不存在" /><KnowledgeEmpty message="该问题组不存在或无权访问" /></KnowledgePage>;

  return (
    <KnowledgePage>
      <KnowledgeHeader
        backHref={(mode === 'frequent' ? '/knowledge/frequent' : '/knowledge/weak-answers') as Href}
        title={detail.title}
        description={mode === 'frequent'
          ? `被问 ${detail.questionCount} 次 · 来自 ${detail.distinctCompanyCount} 家公司 · 最近一次：${detail.latestCompanyName} · ${detail.latestStepName}`
          : `评价为「需要改进」：${detail.poorCount} 次 · 已评价：${detail.evaluatedCount} 次 · 表现不佳率：${Math.round(detail.poorRate * 100)}%`}
      />
      <YStack gap="$lg">
        {detail.history.map((item) => <QuestionHistoryRow key={item.interviewQuestionId} item={item} />)}
      </YStack>
    </KnowledgePage>
  );
}

const evaluationLabels = { good: '良好', neutral: '普通', poor: '需要改进' } as const;

function QuestionHistoryRow({ item }: { item: QuestionHistory }) {
  return (
    <YStack borderBottomColor="$border" borderBottomWidth={1} gap="$base" pb="$lg">
      <Text color="$accentStrong" fontSize={14} fontWeight="600">{item.company.name} · {item.selectionStep.name}</Text>
      <Field label="原始问题" value={item.question} />
      {item.answer ? <Field label="当时回答" value={item.answer} /> : null}
      {item.evaluation ? <Field label="评价" value={evaluationLabels[item.evaluation]} /> : null}
      <XStack gap="$sm" flexWrap="wrap">
        {item.knowledgeItemId ? (
          <Link href={`/knowledge/items?item=${item.knowledgeItemId}` as Href} asChild><AppButton variant="secondary">查看知识库版本</AppButton></Link>
        ) : null}
        <Link href={`/applications/${item.applicationId}/interviews/${item.selectionStep.selectionStepId}` as Href} asChild><AppButton variant="ghost">查看面试复盘</AppButton></Link>
      </XStack>
    </YStack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <YStack gap="$xs"><Text color="$textMuted" fontSize={12} fontWeight="600">{label}</Text><Text color="$textSecondary" lineHeight={23} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</Text></YStack>;
}
