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
import { getSelectionStepDisplayName } from '@/components/selection/selectionConstants';

type WeaknessSummary = {
  weaknessGroupId: Id<'weaknessGroups'>;
  title: string;
  interviewCount: number;
  latestOccurrence: number;
  latestCompanyName: string;
  latestStepName: string;
};

export function WeaknessesScreen() {
  const { t } = useTranslation(['knowledge', 'common']);
  const state = useQuery({ query: api.weaknessGroups.list, args: {} });
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLocaleLowerCase();
  const items = useMemo(() => state.status === 'success'
    ? (state.data as WeaknessSummary[]).filter((item) => item.title.toLocaleLowerCase().includes(normalized))
    : [], [normalized, state]);

  return (
    <KnowledgePage>
      <KnowledgeHeader title={t('knowledge:improve')} description={t('knowledge:weaknesses.description')} />
      <SearchInput value={search} onChangeText={setSearch} placeholder={t('knowledge:weaknesses.search')} />
      {state.status === 'pending' ? <LoadingState message={t('knowledge:weaknesses.aggregating')} /> : null}
      {state.status === 'error' ? <MessageState message={t('knowledge:weaknesses.loadFailed')} actionLabel={t('common:actions.retry')} onAction={() => window.location.reload()} /> : null}
      {state.status === 'success' && items.length === 0 ? <KnowledgeEmpty message={normalized ? t('knowledge:weaknesses.noMatches') : t('knowledge:weaknesses.none')} /> : null}
      {items.length > 0 ? <YStack borderTopColor="$border" borderTopWidth={1}>{items.map((item) => (
        <Link key={item.weaknessGroupId} href={`/knowledge/weaknesses/${item.weaknessGroupId}` as Href} asChild>
          <XStack borderBottomColor="$border" borderBottomWidth={1} cursor="pointer" gap="$base" py="$lg" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <YStack flex={1} gap="$xs"><Text color="$text" fontSize={18} fontWeight="600">{item.title}</Text><Text color="$textSecondary">{t('knowledge:weaknessCount', { count: item.interviewCount })}</Text><Text color="$textMuted" fontSize={13}>{t('knowledge:latest', { company: item.latestCompanyName })}</Text></YStack>
            <ArrowRight color="$textMuted" size={19} />
          </XStack>
        </Link>
      ))}</YStack> : null}
    </KnowledgePage>
  );
}

export function WeaknessDetailScreen() {
  const { t } = useTranslation(['knowledge', 'common', 'selection']);
  const rawId = useLocalSearchParams().weaknessGroupId;
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) as Id<'weaknessGroups'> | undefined;
  const state = useQuery({ query: api.weaknessGroups.getDetail, args: id ? { weaknessGroupId: id } : 'skip' });

  if (state.status === 'pending') return <KnowledgePage><LoadingState message={t('knowledge:weaknesses.historyLoading')} /></KnowledgePage>;
  if (state.status === 'error') return <KnowledgePage><MessageState message={t('knowledge:weaknesses.historyFailed')} actionLabel={t('common:actions.back')} onAction={() => window.history.back()} /></KnowledgePage>;
  const detail = state.data;
  if (!detail) return <KnowledgePage><KnowledgeHeader title={t('knowledge:groups.missing')} /><KnowledgeEmpty message={t('knowledge:weaknesses.missing')} /></KnowledgePage>;

  return (
    <KnowledgePage>
      <KnowledgeHeader backHref={'/knowledge/weaknesses' as Href} title={detail.title} description={`${t('knowledge:weaknessCount', { count: detail.interviewCount })} · ${t('knowledge:latest', { company: detail.latestCompanyName })} · ${getSelectionStepDisplayName({ name: detail.latestStepName, presetKey: detail.latestStepPresetKey }, t)}`} />
      <YStack gap="$lg">
        {detail.history.map((item) => (
          <YStack key={item.weaknessOccurrenceId} borderBottomColor="$border" borderBottomWidth={1} gap="$base" pb="$lg">
            <Text color="$accentStrong" fontWeight="600">{item.company.name} · {getSelectionStepDisplayName(item.selectionStep, t)}</Text>
            <Field label={t('knowledge:weaknesses.detail')} value={item.extractedWeakness} />
            {item.improvementAction ? <Field label={t('knowledge:weaknesses.improvement')} value={item.improvementAction} /> : null}
            <Link href={`/applications/${item.applicationId}/interviews/${item.selectionStep.selectionStepId}` as Href} asChild><AppButton variant="ghost" style={{ alignSelf: 'flex-start' }}>{t('knowledge:groups.interviewReview')}</AppButton></Link>
          </YStack>
        ))}
      </YStack>
    </KnowledgePage>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <YStack gap="$xs"><Text color="$textMuted" fontSize={12} fontWeight="600">{label}</Text><Text color="$textSecondary" lineHeight={23} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</Text></YStack>;
}
