import { MoreHorizontal, Pencil } from '@tamagui/lucide-icons-2';
import { Href, Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ElementRef } from 'react';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';
import { eventTimeZone } from '@/components/events/eventFormatting';
import type { KnowledgeItemData } from './types';

const updatedFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: eventTimeZone,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const categoryLabels = { qa: '问题回答', material: '可用素材', reverse_question: '逆質問' } as const;

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
          <Text color="$accentStrong" fontSize={12} fontWeight="700">{categoryLabels[item.category]}</Text>
          <Text color="$text" fontSize={19} fontWeight="600" lineHeight={27}>{item.title}</Text>
          {item.sourceCompany ? <Text color="$textMuted" fontSize={13}>来源：{item.sourceCompany.name}</Text> : null}
        </YStack>
        <XStack gap="$xs">
          <AppButton aria-label="编辑" variant="ghost" icon={<Pencil size={17} />} onPress={onEdit} />
          <AppButton aria-label="更多操作" variant="ghost" icon={<MoreHorizontal size={19} />} onPress={onMenu} />
        </XStack>
      </XStack>
      {item.content ? (
        <YStack gap="$sm">
          <Text color="$textSecondary" lineHeight={23} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {isLong && !expanded ? `${item.content.slice(0, 240)}…` : item.content}
          </Text>
          {isLong ? (
            <AppButton variant="ghost" onPress={() => setExpanded((value) => !value)} style={{ alignSelf: 'flex-start' }}>
              {expanded ? '收起' : '展开全文'}
            </AppButton>
          ) : null}
        </YStack>
      ) : null}
      {item.note ? <Text color="$textMuted" fontSize={13} lineHeight={20}>备注：{item.note}</Text> : null}
      <XStack gap="$base" flexWrap="wrap" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color="$textMuted" fontSize={12}>更新于 {updatedFormatter.format(new Date(item.updatedAt))}</Text>
        {item.sourceInterview ? (
          <Link href={`/applications/${item.sourceInterview.applicationId}/interviews/${item.sourceInterview.selectionStepId}` as Href} asChild>
            <Text color="$accentStrong" cursor="pointer" fontSize={13} fontWeight="600">查看原面试记录</Text>
          </Link>
        ) : null}
      </XStack>
    </YStack>
  );
}
