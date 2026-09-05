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

type WeaknessSummary = {
  weaknessGroupId: Id<'weaknessGroups'>;
  title: string;
  interviewCount: number;
  latestOccurrence: number;
  latestCompanyName: string;
  latestStepName: string;
};

export function WeaknessesScreen() {
  const state = useQuery({ query: api.weaknessGroups.list, args: {} });
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLocaleLowerCase();
  const items = useMemo(() => state.status === 'success'
    ? (state.data as WeaknessSummary[]).filter((item) => item.title.toLocaleLowerCase().includes(normalized))
    : [], [normalized, state]);

  return (
    <KnowledgePage>
      <KnowledgeHeader title="近期需要改善" description="按完整面试历史汇总反复出现的具体弱点。" />
      <SearchInput value={search} onChangeText={setSearch} placeholder="搜索弱点..." />
      {state.status === 'pending' ? <LoadingState message="正在汇总弱点..." /> : null}
      {state.status === 'error' ? <MessageState message="弱点读取失败" actionLabel="重试" onAction={() => window.location.reload()} /> : null}
      {state.status === 'success' && items.length === 0 ? <KnowledgeEmpty message={normalized ? '没有符合条件的弱点' : '还没有可汇总的弱点'} /> : null}
      {items.length > 0 ? <YStack borderTopColor="$border" borderTopWidth={1}>{items.map((item) => (
        <Link key={item.weaknessGroupId} href={`/knowledge/weaknesses/${item.weaknessGroupId}` as Href} asChild>
          <XStack borderBottomColor="$border" borderBottomWidth={1} cursor="pointer" gap="$base" py="$lg" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <YStack flex={1} gap="$xs"><Text color="$text" fontSize={18} fontWeight="600">{item.title}</Text><Text color="$textSecondary">在 {item.interviewCount} 场面试中出现</Text><Text color="$textMuted" fontSize={13}>最近一次：{item.latestCompanyName}</Text></YStack>
            <ArrowRight color="$textMuted" size={19} />
          </XStack>
        </Link>
      ))}</YStack> : null}
    </KnowledgePage>
  );
}

export function WeaknessDetailScreen() {
  const rawId = useLocalSearchParams().weaknessGroupId;
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) as Id<'weaknessGroups'> | undefined;
  const state = useQuery({ query: api.weaknessGroups.getDetail, args: id ? { weaknessGroupId: id } : 'skip' });

  if (state.status === 'pending') return <KnowledgePage><LoadingState message="正在加载弱点历史..." /></KnowledgePage>;
  if (state.status === 'error') return <KnowledgePage><MessageState message="弱点历史加载失败" actionLabel="返回" onAction={() => window.history.back()} /></KnowledgePage>;
  const detail = state.data;
  if (!detail) return <KnowledgePage><KnowledgeHeader title="记录不存在" /><KnowledgeEmpty message="该弱点组不存在或无权访问" /></KnowledgePage>;

  return (
    <KnowledgePage>
      <KnowledgeHeader backHref={'/knowledge/weaknesses' as Href} title={detail.title} description={`在 ${detail.interviewCount} 场面试中出现 · 最近一次：${detail.latestCompanyName} · ${detail.latestStepName}`} />
      <YStack gap="$lg">
        {detail.history.map((item) => (
          <YStack key={item.weaknessOccurrenceId} borderBottomColor="$border" borderBottomWidth={1} gap="$base" pb="$lg">
            <Text color="$accentStrong" fontWeight="600">{item.company.name} · {item.selectionStep.name}</Text>
            <Field label="具体弱点" value={item.extractedWeakness} />
            {item.improvementAction ? <Field label="当时计划的改进" value={item.improvementAction} /> : null}
            <Link href={`/applications/${item.applicationId}/interviews/${item.selectionStep.selectionStepId}` as Href} asChild><AppButton variant="ghost" style={{ alignSelf: 'flex-start' }}>查看面试复盘</AppButton></Link>
          </YStack>
        ))}
      </YStack>
    </KnowledgePage>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <YStack gap="$xs"><Text color="$textMuted" fontSize={12} fontWeight="600">{label}</Text><Text color="$textSecondary" lineHeight={23} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</Text></YStack>;
}
