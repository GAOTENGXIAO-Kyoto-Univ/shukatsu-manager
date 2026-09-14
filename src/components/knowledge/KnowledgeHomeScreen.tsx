import {
  ArrowRight,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Library,
  MessageCircleQuestion,
  MessageSquareWarning,
  Plus,
  Sparkles,
} from '@tamagui/lucide-icons-2';
import { useAction, useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { Href, Link } from 'expo-router';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextArea, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { analytics } from '@/lib/analytics';
import { AppButton } from '@/components/ui/AppButton';
import { MessageState } from '@/components/ui/States';
import { KnowledgeItemOverlay } from './KnowledgeItemOverlay';
import { KnowledgePage } from './KnowledgeLayout';

type Reference = { knowledgeItemId: Id<'knowledgeItems'>; title: string; sourceCompanyName?: string };

export function KnowledgeHomeScreen() {
  const { t } = useTranslation(['knowledge', 'common']);
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
        <Text color="$text" fontSize={30} fontWeight="600" lineHeight={38}>{t('knowledge:title')}</Text>
        <Text color="$textSecondary" lineHeight={22}>{t('knowledge:description')}</Text>
      </YStack>

      <AnswerGenerator />

      {overview.status === 'pending' ? <KnowledgeOverviewSkeleton isDesktop={isDesktop} /> : null}
      {overview.status === 'error' ? (
        <YStack
          bg="$surface"
          borderColor="$border"
          borderWidth={1}
          style={{ borderRadius: 16, overflow: 'hidden' }}
        >
          <MessageState
            message={t('knowledge:loadFailed')}
            actionLabel={t('common:actions.retry')}
            onAction={() => window.location.reload()}
          />
        </YStack>
      ) : null}
      {overview.status === 'success' ? (
        <YStack gap="$lg">
          <KnowledgeGroup
            isDesktop={isDesktop}
            title={t('knowledge:summaryGroup')}
            subtitle={t('knowledge:summarySubtitle')}
          >
            <KnowledgeModule
              href={'/knowledge/weaknesses' as Href}
              icon={<CircleAlert color="$danger" size={20} />}
              softTone="$dangerSoft"
              title={t('knowledge:improve')}
              width="100%"
            >
              {overview.data.topWeaknesses.length > 0 ? (
                overview.data.topWeaknesses.map((item, index) => (
                  <KnowledgeSummaryRow
                    key={item.weaknessGroupId}
                    href={`/knowledge/weaknesses/${item.weaknessGroupId}` as Href}
                    last={index === overview.data.topWeaknesses.length - 1}
                    lines={[
                      t('knowledge:weaknessCount', { count: item.interviewCount }),
                      t('knowledge:latest', { company: item.latestCompanyName }),
                    ]}
                    title={item.title}
                  />
                ))
              ) : (
                <KnowledgeEmpty
                  icon={<CircleAlert color="$danger" size={19} />}
                  softTone="$dangerSoft"
                  message={t('knowledge:noWeaknesses')}
                />
              )}
            </KnowledgeModule>

            <XStack
              gap="$base"
              style={{ alignItems: 'flex-start', flexDirection: isDesktop ? 'row' : 'column' }}
            >
              <KnowledgeModule
                flexValue={isDesktop ? 1 : undefined}
                href={'/knowledge/frequent' as Href}
                icon={<MessageCircleQuestion color="$infoStrong" size={20} />}
                softTone="$infoSoft"
                title={t('knowledge:frequent')}
                width={isDesktop ? undefined : '100%'}
              >
                {overview.data.topFrequentQuestions.length > 0 ? (
                  overview.data.topFrequentQuestions.map((item, index) => (
                    <KnowledgeSummaryRow
                      key={item.questionGroupId}
                      href={`/knowledge/frequent/${item.questionGroupId}` as Href}
                      last={index === overview.data.topFrequentQuestions.length - 1}
                      lines={[
                        t('knowledge:frequency', { count: item.questionCount, companies: item.distinctCompanyCount }),
                        t('knowledge:latest', { company: item.latestCompanyName }),
                      ]}
                      title={item.title}
                    />
                  ))
                ) : (
                  <KnowledgeEmpty
                    icon={<MessageCircleQuestion color="$infoStrong" size={19} />}
                    softTone="$infoSoft"
                    message={t('knowledge:noFrequent')}
                  />
                )}
              </KnowledgeModule>

              <KnowledgeModule
                flexValue={isDesktop ? 1 : undefined}
                href={'/knowledge/weak-answers' as Href}
                icon={<MessageSquareWarning color="$warningStrong" size={20} />}
                softTone="$warningSoft"
                title={t('knowledge:weakAnswers')}
                width={isDesktop ? undefined : '100%'}
              >
                {overview.data.topWeakAnswers.length > 0 ? (
                  overview.data.topWeakAnswers.map((item, index) => (
                    <KnowledgeSummaryRow
                      key={item.questionGroupId}
                      href={`/knowledge/weak-answers/${item.questionGroupId}` as Href}
                      last={index === overview.data.topWeakAnswers.length - 1}
                      lines={[
                        t('knowledge:poorCount', { count: item.poorCount }),
                        t('knowledge:poorRate', { count: item.evaluatedCount, rate: Math.round(item.poorRate * 100) }),
                      ]}
                      title={item.title}
                    />
                  ))
                ) : (
                  <KnowledgeEmpty
                    icon={<MessageSquareWarning color="$warningStrong" size={19} />}
                    softTone="$warningSoft"
                    message={t('knowledge:noWeakAnswers')}
                  />
                )}
              </KnowledgeModule>
            </XStack>
          </KnowledgeGroup>

          <KnowledgeGroup
            isDesktop={isDesktop}
            title={t('knowledge:assets')}
            subtitle={t('knowledge:assetsSubtitle')}
          >
            <XStack
              gap="$base"
              style={{ alignItems: 'flex-start', flexDirection: isDesktop ? 'row' : 'column' }}
            >
              <KnowledgeModule
                action={(
                  <AppButton
                    icon={<Plus size={15} />}
                    minH={36}
                    px="$sm"
                    variant="ghost"
                    onPress={() => setCreateCategory('general')}
                  >
                    {t('knowledge:addKnowledge')}
                  </AppButton>
                )}
                flexValue={isDesktop ? 1.25 : undefined}
                href={'/knowledge/items' as Href}
                icon={<Library color="$successStrong" size={20} />}
                softTone="$successSoft"
                title={t('knowledge:myKnowledge')}
                width={isDesktop ? undefined : '100%'}
              >
                {overview.data.recentKnowledgeItems.length > 0 ? (
                  overview.data.recentKnowledgeItems.map((item, index) => (
                    <KnowledgeItemRow
                      key={item.knowledgeItemId}
                      category={item.category === 'qa' ? t('knowledge:qa') : t('knowledge:material')}
                      href={`/knowledge/items?item=${item.knowledgeItemId}` as Href}
                      last={index === overview.data.recentKnowledgeItems.length - 1}
                      title={item.title}
                    />
                  ))
                ) : (
                  <KnowledgeEmpty
                    action={<AppButton onPress={() => setCreateCategory('general')}>{t('knowledge:addKnowledge')}</AppButton>}
                    icon={<Library color="$successStrong" size={19} />}
                    softTone="$successSoft"
                    message={t('knowledge:noKnowledge')}
                  />
                )}
              </KnowledgeModule>

              <KnowledgeModule
                action={(
                  <AppButton
                    icon={<Plus size={15} />}
                    minH={36}
                    px="$sm"
                    variant="ghost"
                    onPress={() => setCreateCategory('reverse')}
                  >
                    {t('knowledge:addReverse')}
                  </AppButton>
                )}
                flexValue={isDesktop ? 1 : undefined}
                href={'/knowledge/reverse-questions' as Href}
                icon={<CircleHelp color="$accentStrong" size={20} />}
                softTone="$accentSoft"
                title={t('knowledge:reverse')}
                width={isDesktop ? undefined : '100%'}
              >
                {overview.data.recentReverseQuestions.length > 0 ? (
                  overview.data.recentReverseQuestions.map((item, index) => (
                    <KnowledgeSummaryRow
                      key={item.knowledgeItemId}
                      href={'/knowledge/reverse-questions' as Href}
                      last={index === overview.data.recentReverseQuestions.length - 1}
                      lines={item.content ? [item.content] : []}
                      title={item.title}
                    />
                  ))
                ) : (
                  <KnowledgeEmpty
                    action={<AppButton onPress={() => setCreateCategory('reverse')}>{t('knowledge:addReverse')}</AppButton>}
                    icon={<CircleHelp color="$accentStrong" size={19} />}
                    softTone="$accentSoft"
                    message={t('knowledge:noReverse')}
                  />
                )}
              </KnowledgeModule>
            </XStack>
          </KnowledgeGroup>
        </YStack>
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
  const { t } = useTranslation('knowledge');
  const generate = useAction(api.knowledgeAi.generateAnswer);
  const createItem = useMutation(api.knowledgeItems.create);
  const [question, setQuestion] = useState('');
  const [draft, setDraft] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsSuccess, setMessageIsSuccess] = useState(false);

  async function runGeneration() {
    if (!question.trim() || generating) return;
    setGenerating(true);
    setMessage(null);
    setMessageIsSuccess(false);
    try {
      const result = await generate({ question });
      if (result.status === 'no_material') {
        setMessage(t('ai.noMaterial'));
        return;
      }
      setDraft(result.draft);
      setReferences(result.references);
      analytics.aiAnswerGenerated({ used_reference_count: result.references.length });
    } catch {
      setMessage(t('ai.generateFailed'));
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    if (!question.trim() || !draft.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    setMessageIsSuccess(false);
    try {
      await createItem({ category: 'qa', title: question, content: draft, note: null });
      analytics.knowledgeItemCreated({
        category: 'qa',
        creation_source: 'ai_generated_saved',
      });
      setMessage(t('ai.saved'));
      setMessageIsSuccess(true);
    } catch {
      setMessage(t('ai.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <YStack bg="$surface" borderColor="$border" borderWidth={1} gap="$base" p="$lg" style={{ borderRadius: 16 }}>
      <XStack gap="$sm" style={{ alignItems: 'center' }}><Sparkles color="$accentStrong" size={20} /><Text color="$text" fontSize={21} fontWeight="600">{t('ai.title')}</Text></XStack>
      <Text color="$textSecondary" lineHeight={22}>{t('ai.description')}</Text>
      <TextArea minH={88} color="$text" placeholder={t('ai.placeholder')} placeholderTextColor="$textMuted" value={question} onChangeText={setQuestion} style={{ borderRadius: 12 }} />
      <AppButton variant="primary" disabled={!question.trim() || generating} onPress={() => void runGeneration()} style={{ alignSelf: 'flex-start' }}>{generating ? t('ai.generating') : draft ? t('ai.regenerate') : t('ai.generate')}</AppButton>
      {draft ? (
        <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$base">
          <Text color="$text" fontWeight="600">{t('ai.draft')}</Text>
          <TextArea minH={220} color="$text" value={draft} onChangeText={setDraft} style={{ borderRadius: 12 }} />
          {references.length > 0 ? (
            <YStack gap="$xs"><Text color="$textMuted" fontSize={12} fontWeight="600">{t('ai.references', { count: references.length })}</Text>{references.map((item) => (
              <Link key={item.knowledgeItemId} href={`/knowledge/items?item=${item.knowledgeItemId}` as Href} asChild><Text color="$accentStrong" cursor="pointer" fontSize={13}>{item.sourceCompanyName ? `${item.sourceCompanyName} / ` : ''}{item.title}</Text></Link>
            ))}</YStack>
          ) : null}
          <AppButton variant="secondary" disabled={saving || !draft.trim()} onPress={() => void saveDraft()} style={{ alignSelf: 'flex-start' }}>{saving ? t('common:states.saving') : t('ai.save')}</AppButton>
        </YStack>
      ) : null}
      {message ? <Text color={messageIsSuccess ? '$successStrong' : '$warningStrong'}>{message}</Text> : null}
    </YStack>
  );
}

type KnowledgeSoftTone =
  | '$accentSoft'
  | '$dangerSoft'
  | '$infoSoft'
  | '$successSoft'
  | '$warningSoft';

function KnowledgeGroup({
  children,
  isDesktop,
  subtitle,
  title,
}: {
  children: ReactNode;
  isDesktop: boolean;
  subtitle: string;
  title: string;
}) {
  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      gap="$lg"
      p={isDesktop ? '$lg' : '$base'}
      style={{ borderRadius: 16 }}
    >
      <YStack gap="$xs">
        <Text color="$text" fontSize={isDesktop ? 20 : 19} fontWeight="600" lineHeight={26}>
          {title}
        </Text>
        <Text color="$textSecondary" fontSize={isDesktop ? 14 : 13} lineHeight={19}>
          {subtitle}
        </Text>
      </YStack>
      {children}
    </YStack>
  );
}

function KnowledgeModule({
  action,
  children,
  flexValue,
  href,
  icon,
  softTone,
  title,
  width,
}: {
  action?: ReactNode;
  children: ReactNode;
  flexValue?: number;
  href: Href;
  icon: ReactNode;
  softTone: KnowledgeSoftTone;
  title: string;
  width?: '100%';
}) {
  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      width={width}
      style={{ borderRadius: 14, flex: flexValue, minWidth: 0, overflow: 'hidden' }}
    >
      <XStack
        bg={softTone}
        flexWrap="wrap"
        gap="$sm"
        p="$base"
        style={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <XStack flex={1} gap="$md" style={{ alignItems: 'center', minWidth: 150 }}>
          <YStack
            bg="$surface"
            height={36}
            width={36}
            style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
          >
            {icon}
          </YStack>
          <Text
            color="$text"
            flex={1}
            fontSize={18}
            fontWeight="600"
            lineHeight={23}
            numberOfLines={2}
            style={{ minWidth: 0 }}
          >
            {title}
          </Text>
        </XStack>
        <XStack flexWrap="wrap" gap="$xs" style={{ alignItems: 'center' }}>
          {action}
          <ViewAllLink href={href} />
        </XStack>
      </XStack>
      <YStack borderTopColor="$border" borderTopWidth={1}>
        {children}
      </YStack>
    </YStack>
  );
}

function ViewAllLink({ href }: { href: Href }) {
  const { t } = useTranslation('knowledge');
  return (
    <Link href={href} asChild>
      <XStack
        cursor="pointer"
        gap="$xs"
        minH={36}
        px="$xs"
        pressStyle={{ opacity: 0.72 }}
        hoverStyle={{ opacity: 0.72 }}
        focusStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
        style={{ alignItems: 'center', borderRadius: 8 }}
      >
        <Text color="$textSecondary" fontSize={13} fontWeight="600">
          {t('viewAll')}
        </Text>
        <ArrowRight color="$textMuted" size={15} />
      </XStack>
    </Link>
  );
}

function KnowledgeSummaryRow({
  badge,
  href,
  last,
  lines,
  title,
}: {
  badge?: string;
  href: Href;
  last: boolean;
  lines: string[];
  title: string;
}) {
  return (
    <Link href={href} asChild>
      <XStack
        borderBottomColor="$border"
        borderBottomWidth={last ? 0 : 1}
        cursor="pointer"
        gap="$md"
        px="$base"
        py="$md"
        pressStyle={{ opacity: 0.74 }}
        hoverStyle={{ background: '$surfaceMuted' }}
        focusStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
        style={{ alignItems: 'center' }}
      >
        <YStack flex={1} gap="$xs" style={{ minWidth: 0 }}>
          <Text
            color="$text"
            fontSize={15}
            fontWeight="600"
            lineHeight={21}
            numberOfLines={2}
            style={{ overflowWrap: 'anywhere' }}
          >
            {title}
          </Text>
          {badge ? (
            <XStack
              bg="$successSoft"
              px="$sm"
              py={2}
              style={{ alignSelf: 'flex-start', borderRadius: 9999 }}
            >
              <Text color="$successStrong" fontSize={12} fontWeight="600">
                {badge}
              </Text>
            </XStack>
          ) : null}
          {lines.map((line, index) => (
            <Text
              key={`${line}-${index}`}
              color={index === 0 ? '$textSecondary' : '$textMuted'}
              fontSize={index === 0 ? 13 : 12}
              lineHeight={18}
              numberOfLines={2}
            >
              {line}
            </Text>
          ))}
        </YStack>
        <ChevronRight color="$textMuted" size={16} />
      </XStack>
    </Link>
  );
}

function KnowledgeItemRow({
  category,
  href,
  last,
  title,
}: {
  category: string;
  href: Href;
  last: boolean;
  title: string;
}) {
  return (
    <KnowledgeSummaryRow
      badge={category}
      href={href}
      last={last}
      lines={[]}
      title={title}
    />
  );
}

function KnowledgeEmpty({
  action,
  icon,
  message,
  softTone,
}: {
  action?: ReactNode;
  icon: ReactNode;
  message: string;
  softTone: KnowledgeSoftTone;
}) {
  return (
    <YStack gap="$md" p="$lg" style={{ alignItems: 'center' }}>
      <YStack
        bg={softTone}
        height={38}
        width={38}
        style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
      >
        {icon}
      </YStack>
      <Text color="$textSecondary" fontSize={14} lineHeight={20} style={{ textAlign: 'center' }}>
        {message}
      </Text>
      {action}
    </YStack>
  );
}

function KnowledgeOverviewSkeleton({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation('knowledge');
  return (
    <YStack gap="$lg">
      <KnowledgeGroup
        isDesktop={isDesktop}
        title={t('summaryGroup')}
        subtitle={t('summarySubtitle')}
      >
        <KnowledgeModuleSkeleton rows={3} width="100%" />
        <XStack
          gap="$base"
          style={{ alignItems: 'flex-start', flexDirection: isDesktop ? 'row' : 'column' }}
        >
          <KnowledgeModuleSkeleton
            flexValue={isDesktop ? 1 : undefined}
            rows={3}
            width={isDesktop ? undefined : '100%'}
          />
          <KnowledgeModuleSkeleton
            flexValue={isDesktop ? 1 : undefined}
            rows={2}
            width={isDesktop ? undefined : '100%'}
          />
        </XStack>
      </KnowledgeGroup>
      <KnowledgeGroup
        isDesktop={isDesktop}
        title={t('assets')}
        subtitle={t('assetsSubtitle')}
      >
        <XStack
          gap="$base"
          style={{ alignItems: 'flex-start', flexDirection: isDesktop ? 'row' : 'column' }}
        >
          <KnowledgeModuleSkeleton
            flexValue={isDesktop ? 1.25 : undefined}
            rows={4}
            width={isDesktop ? undefined : '100%'}
          />
          <KnowledgeModuleSkeleton
            flexValue={isDesktop ? 1 : undefined}
            rows={3}
            width={isDesktop ? undefined : '100%'}
          />
        </XStack>
      </KnowledgeGroup>
    </YStack>
  );
}

function KnowledgeModuleSkeleton({
  flexValue,
  rows,
  width,
}: {
  flexValue?: number;
  rows: number;
  width?: '100%';
}) {
  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      width={width}
      style={{ borderRadius: 14, flex: flexValue, minWidth: 0, overflow: 'hidden' }}
    >
      <XStack bg="$surfaceMuted" gap="$md" p="$base" style={{ alignItems: 'center' }}>
        <SkeletonBlock height={36} radius={9999} width={36} />
        <SkeletonBlock height={18} width="38%" />
      </XStack>
      <YStack borderTopColor="$border" borderTopWidth={1}>
        {Array.from({ length: rows }, (_, index) => (
          <YStack
            key={index}
            borderBottomColor="$border"
            borderBottomWidth={index === rows - 1 ? 0 : 1}
            gap="$sm"
            px="$base"
            py="$md"
          >
            <SkeletonBlock height={15} width={index % 2 === 0 ? '68%' : '54%'} />
            <SkeletonBlock height={12} width={index % 2 === 0 ? '44%' : '58%'} />
          </YStack>
        ))}
      </YStack>
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
  return (
    <YStack
      bg="$surfaceMuted"
      height={height}
      width={width}
      style={{ borderRadius: radius }}
    />
  );
}
