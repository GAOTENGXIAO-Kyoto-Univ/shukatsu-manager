import { MoreHorizontal, Pencil } from '@tamagui/lucide-icons-2';
import { Href, Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ElementRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';
import { eventTimeZone } from '@/components/events/eventFormatting';
import type { KnowledgeItemData } from './types';
import { getCurrentAppLocale } from '@/i18n';

export function KnowledgeItemCard({
  initiallyExpanded = false,
  item,
  onEdit,
  onMenu,
}: {
  initiallyExpanded?: boolean;
  item: KnowledgeItemData;
  onEdit: () => void;
  onMenu: () => void;
}) {
  const { t } = useTranslation(['knowledge', 'common', 'companies']);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const cardRef = useRef<ElementRef<typeof YStack>>(null);
  const isLong = (item.content?.length ?? 0) > 240;

  useEffect(() => {
    if (!initiallyExpanded) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const target = cardRef.current as unknown as {
        scrollIntoView?: (options?: ScrollIntoViewOptions) => void;
      };
      target.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initiallyExpanded]);

  return (
    <YStack
      ref={cardRef}
      bg="$surface"
      borderColor={initiallyExpanded ? '$accentStrong' : '$border'}
      borderWidth={1}
      gap="$base"
      p="$lg"
      style={{ borderRadius: 16 }}
    >
      <XStack gap="$base" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <YStack flex={1} gap="$sm" style={{ minWidth: 0 }}>
          <Text color="$accentStrong" fontSize={12} fontWeight="700">{item.category === 'qa' ? t('knowledge:qa') : item.category === 'material' ? t('knowledge:material') : t('knowledge:reverse')}</Text>
          <Text color="$text" fontSize={19} fontWeight="600" lineHeight={27}>{item.title}</Text>
          {item.sourceCompany ? <Text color="$textMuted" fontSize={13}>{t('knowledge:items.source', { company: item.sourceCompany.name })}</Text> : null}
        </YStack>
        <XStack gap="$xs">
          <AppButton aria-label={t('common:actions.edit')} variant="ghost" icon={<Pencil size={17} />} onPress={onEdit} />
          <AppButton aria-label={t('companies:moreActions')} variant="ghost" icon={<MoreHorizontal size={19} />} onPress={onMenu} />
        </XStack>
      </XStack>
      {item.content ? (
        <YStack gap="$sm">
          <Text color="$textSecondary" lineHeight={23} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {isLong && !expanded ? `${item.content.slice(0, 240)}…` : item.content}
          </Text>
          {isLong ? (
            <AppButton variant="ghost" onPress={() => setExpanded((value) => !value)} style={{ alignSelf: 'flex-start' }}>
              {expanded ? t('knowledge:items.collapse') : t('knowledge:items.expand')}
            </AppButton>
          ) : null}
        </YStack>
      ) : null}
      {item.note ? <Text color="$textMuted" fontSize={13} lineHeight={20}>{t('knowledge:items.noteValue', { note: item.note })}</Text> : null}
      <XStack gap="$base" flexWrap="wrap" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color="$textMuted" fontSize={12}>{t('knowledge:items.updated', { date: new Intl.DateTimeFormat(getCurrentAppLocale(), { timeZone: eventTimeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(item.updatedAt)) })}</Text>
        {item.sourceInterview ? (
          <Link href={`/applications/${item.sourceInterview.applicationId}/interviews/${item.sourceInterview.selectionStepId}` as Href} asChild>
            <Text color="$accentStrong" cursor="pointer" fontSize={13} fontWeight="600">{t('knowledge:items.sourceInterview')}</Text>
          </Link>
        ) : null}
      </XStack>
    </YStack>
  );
}
