import { ArrowRight, Plus, Sparkles } from '@tamagui/lucide-icons-2';
import { useAction, useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { Href, Link } from 'expo-router';
import { useState } from 'react';
import { Text, TextArea, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppButton } from '@/components/ui/AppButton';
import { LoadingState, MessageState } from '@/components/ui/States';
import { KnowledgeItemOverlay } from './KnowledgeItemOverlay';
import { KnowledgePage } from './KnowledgeLayout';

type Reference = { knowledgeItemId: Id<'knowledgeItems'>; title: string; sourceCompanyName?: string };

export function KnowledgeHomeScreen() {
  const overview = useQuery({ query: api.knowledgeOverview.get, args: {} });
  const media = useMedia();
  const [createCategory, setCreateCategory] = useState<'general' | 'reverse' | null>(null);
  const isDesktop = Boolean(media.md);

  return (
    <KnowledgePage alignWithPrimaryPages={isDesktop}>
      <YStack
        borderBottomColor="$border"
        borderBottomWidth={1}
        gap="$xs"
        pb="$lg"
        pt={isDesktop ? '$md' : '$lg'}
      >
        <Text color="$text" fontSize={30} fontWeight="600" lineHeight={38}>知识库</Text>
        <Text color="$textSecondary" lineHeight={22}>把面试经验整理成下一次能直接使用的答案与行动。</Text>
      </YStack>

      <AnswerGenerator />

      {overview.status === 'pending' ? <LoadingState message="正在整理知识库..." /> : null}
      {overview.status === 'error' ? <MessageState message="知识库读取失败" actionLabel="重试" onAction={() => window.location.reload()} /> : null}
      {overview.status === 'success' ? (
        <XStack gap="$xl" flexWrap="wrap" style={{ alignItems: 'flex-start' }}>
          <OverviewSection title="近期需要改善" href={'/knowledge/weaknesses' as Href} width={isDesktop ? '48%' : '100%'} empty="还没有可汇总的弱点">
            {overview.data.topWeaknesses.map((item) => (
              <OverviewLink key={item.weaknessGroupId} href={`/knowledge/weaknesses/${item.weaknessGroupId}` as Href} title={item.title} lines={[`在 ${item.interviewCount} 场面试中出现`, `最近一次：${item.latestCompanyName}`]} />
            ))}
          </OverviewSection>
          <OverviewSection title="高频面试问题" href={'/knowledge/frequent' as Href} width={isDesktop ? '48%' : '100%'} empty="还没有出现两次以上的问题">
            {overview.data.topFrequentQuestions.map((item) => (
              <OverviewLink key={item.questionGroupId} href={`/knowledge/frequent/${item.questionGroupId}` as Href} title={item.title} lines={[`被问 ${item.questionCount} 次 · 来自 ${item.distinctCompanyCount} 家公司`, `最近一次：${item.latestCompanyName}`]} />
            ))}
          </OverviewSection>
          <OverviewSection title="经常回答不好" href={'/knowledge/weak-answers' as Href} width={isDesktop ? '48%' : '100%'} empty="还没有两次以上的「需要改进」评价">
            {overview.data.topWeakAnswers.map((item) => (
              <OverviewLink key={item.questionGroupId} href={`/knowledge/weak-answers/${item.questionGroupId}` as Href} title={item.title} lines={[`评价为「需要改进」：${item.poorCount} 次`, `已评价：${item.evaluatedCount} 次 · 表现不佳率：${Math.round(item.poorRate * 100)}%`]} />
            ))}
          </OverviewSection>
          <OverviewSection
            title="我的知识"
            href={'/knowledge/items' as Href}
            width={isDesktop ? '48%' : '100%'}
            empty="还没有知识内容"
            action={<AppButton variant="ghost" icon={<Plus size={16} />} onPress={() => setCreateCategory('general')}>添加知识</AppButton>}
          >
            {overview.data.recentKnowledgeItems.map((item) => (
              <OverviewLink key={item.knowledgeItemId} href={`/knowledge/items?item=${item.knowledgeItemId}` as Href} title={item.title} lines={[item.category === 'qa' ? '问题回答' : '可用素材']} />
            ))}
          </OverviewSection>
          <OverviewSection
            title="逆質問"
            href={'/knowledge/reverse-questions' as Href}
            width="100%"
            empty="还没有逆質問"
            action={<AppButton variant="ghost" icon={<Plus size={16} />} onPress={() => setCreateCategory('reverse')}>添加逆質問</AppButton>}
          >
            {overview.data.recentReverseQuestions.map((item) => (
              <OverviewLink key={item.knowledgeItemId} href={'/knowledge/reverse-questions' as Href} title={item.title} lines={item.content ? [item.content] : []} />
            ))}
          </OverviewSection>
        </XStack>
      ) : null}

      <KnowledgeItemOverlay
        fixedCategory={createCategory === 'reverse' ? 'reverse_question' : undefined}
        item={null}
        onClose={() => setCreateCategory(null)}
        open={createCategory !== null}
      />
    </KnowledgePage>
  );
}

function AnswerGenerator() {
  const generate = useAction(api.knowledgeAi.generateAnswer);
  const createItem = useMutation(api.knowledgeItems.create);
  const [question, setQuestion] = useState('');
  const [draft, setDraft] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runGeneration() {
    if (!question.trim() || generating) return;
    setGenerating(true);
    setMessage(null);
    try {
      const result = await generate({ question });
      if (result.status === 'no_material') {
        setMessage('暂时没有找到足够的相关回答素材。可以先添加相关知识，或记录更多面试回答后再生成。');
        return;
      }
      setDraft(result.draft);
      setReferences(result.references);
    } catch {
      setMessage('生成失败，请重试；现有草稿已保留。');
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    if (!question.trim() || !draft.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await createItem({ category: 'qa', title: question, content: draft, note: null });
      setMessage('已保存为独立的问题回答。');
    } catch {
      setMessage('保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <YStack bg="$surface" borderColor="$border" borderWidth={1} gap="$base" p="$lg" style={{ borderRadius: 16 }}>
      <XStack gap="$sm" style={{ alignItems: 'center' }}><Sparkles color="$accentStrong" size={20} /><Text color="$text" fontSize={21} fontWeight="600">AI 回答生成</Text></XStack>
      <Text color="$textSecondary" lineHeight={22}>输入新问题，系统会先从你的「问题回答」中严格筛选素材，再生成可编辑草稿。</Text>
      <TextArea minH={88} color="$text" placeholder="例如：请介绍一次你推动团队解决问题的经历" placeholderTextColor="$textMuted" value={question} onChangeText={setQuestion} style={{ borderRadius: 12 }} />
      <AppButton variant="primary" disabled={!question.trim() || generating} onPress={() => void runGeneration()} style={{ alignSelf: 'flex-start' }}>{generating ? '生成中...' : draft ? '重新生成' : '生成回答'}</AppButton>
      {draft ? (
        <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$base">
          <Text color="$text" fontWeight="600">回答草稿</Text>
          <TextArea minH={220} color="$text" value={draft} onChangeText={setDraft} style={{ borderRadius: 12 }} />
          {references.length > 0 ? (
            <YStack gap="$xs"><Text color="$textMuted" fontSize={12} fontWeight="600">参考了 {references.length} 条知识</Text>{references.map((item) => (
              <Link key={item.knowledgeItemId} href={`/knowledge/items?item=${item.knowledgeItemId}` as Href} asChild><Text color="$accentStrong" cursor="pointer" fontSize={13}>{item.sourceCompanyName ? `${item.sourceCompanyName} / ` : ''}{item.title}</Text></Link>
            ))}</YStack>
          ) : null}
          <AppButton variant="secondary" disabled={saving || !draft.trim()} onPress={() => void saveDraft()} style={{ alignSelf: 'flex-start' }}>{saving ? '保存中...' : '保存到我的知识'}</AppButton>
        </YStack>
      ) : null}
      {message ? <Text color={message.startsWith('已保存') ? '$successStrong' : '$warningStrong'}>{message}</Text> : null}
    </YStack>
  );
}

function OverviewSection({ action, children, empty, href, title, width }: { action?: React.ReactNode; children: React.ReactNode; empty: string; href: Href; title: string; width: '48%' | '100%' }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <YStack gap="$base" width={width} style={{ minWidth: 0 }}>
      <XStack gap="$sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}><Text color="$text" fontSize={21} fontWeight="600">{title}</Text>{action}</XStack>
      <YStack borderTopColor="$border" borderTopWidth={1}>{hasChildren ? children : <Text color="$textMuted" py="$lg">{empty}</Text>}</YStack>
      <Link href={href} asChild><Text color="$accentStrong" cursor="pointer" fontSize={14} fontWeight="600">查看全部</Text></Link>
    </YStack>
  );
}

function OverviewLink({ href, lines, title }: { href: Href; lines: string[]; title: string }) {
  return (
    <Link href={href} asChild>
      <XStack borderBottomColor="$border" borderBottomWidth={1} cursor="pointer" gap="$sm" py="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <YStack flex={1} gap="$xs" style={{ minWidth: 0 }}><Text color="$text" fontWeight="600">{title}</Text>{lines.map((line, index) => <Text key={`${line}-${index}`} color={index === 0 ? '$textSecondary' : '$textMuted'} fontSize={index === 0 ? 14 : 12} numberOfLines={2}>{line}</Text>)}</YStack>
        <ArrowRight color="$textMuted" size={17} />
      </XStack>
    </Link>
  );
}
