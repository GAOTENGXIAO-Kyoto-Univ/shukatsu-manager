import { MoreHorizontal, Pin } from '@tamagui/lucide-icons-2';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';
import { ResearchMarkdownPreview } from './ResearchMarkdownPreview';
import {
  getResearchCategoryLabel,
  getResearchScope,
  getResearchScopeLabel,
} from './researchConstants';
import type { ResearchApplicationContext, ResearchItemData } from './types';

type ResearchItemRowProps = {
  application: ResearchApplicationContext;
  compact?: boolean;
  item: ResearchItemData;
  onOpen: (item: ResearchItemData) => void;
  onOpenMenu?: (item: ResearchItemData) => void;
};

export function ResearchItemRow({
  application,
  compact = false,
  item,
  onOpen,
  onOpenMenu,
}: ResearchItemRowProps) {
  const sourceDomains = getSourceDomains(item.sourceUrls);
  const scope = getResearchScope(item.applicationId);

  return (
    <XStack
      borderBottomColor="$border"
      borderBottomWidth={1}
      gap="$md"
      py={compact ? '$md' : '$base'}
      style={{ alignItems: 'flex-start' }}
    >
      <YStack
        aria-label={item.title ? `打开研究：${item.title}` : '打开企业研究'}
        cursor="pointer"
        flex={1}
        gap="$sm"
        onPress={() => onOpen(item)}
      >
        <XStack flexWrap="wrap" gap="$xs" style={{ alignItems: 'center' }}>
          {item.isPinned ? <Pin color="$accentStrong" fill="$accentStrong" size={14} /> : null}
          <MetadataLabel label={getResearchCategoryLabel(item.category)} />
          <MetadataLabel
            label={getResearchScopeLabel(scope, application.companyName, application.jobTitle)}
          />
        </XStack>
        {item.title ? (
          <Text color="$text" fontSize={compact ? 15 : 17} fontWeight="600" lineHeight={24}>
            {item.title}
          </Text>
        ) : null}
        <ResearchMarkdownPreview content={item.content} numberOfLines={compact ? 2 : 3} />
        {!compact ? (
          <XStack flexWrap="wrap" gap="$sm" style={{ alignItems: 'center' }}>
            {sourceDomains.length > 0 ? (
              <Text color="$textMuted" fontSize={12} numberOfLines={1}>
                来源：{sourceDomains.join(' · ')}
              </Text>
            ) : null}
            <Text color="$textMuted" fontSize={12}>
              {formatRelativeUpdate(item.updatedAt)}
            </Text>
          </XStack>
        ) : null}
      </YStack>
      {onOpenMenu ? (
        <AppButton
          aria-label="研究操作"
          variant="ghost"
          icon={<MoreHorizontal size={18} />}
          onPress={() => onOpenMenu(item)}
          style={{ minWidth: 42 }}
        />
      ) : null}
    </XStack>
  );
}

function MetadataLabel({ label }: { label: string }) {
  return (
    <Text
      bg="$surfaceMuted"
      color="$textSecondary"
      fontSize={12}
      px="$sm"
      py="$xs"
      style={{ borderRadius: 9999 }}
    >
      {label}
    </Text>
  );
}

function getSourceDomains(sourceUrls: string[] | undefined) {
  const domains = new Set<string>();

  for (const url of sourceUrls ?? []) {
    try {
      domains.add(new URL(url).hostname.replace(/^www\./, ''));
    } catch {
      // Invalid URLs are rejected by the server; omit legacy malformed values defensively.
    }
  }

  return Array.from(domains);
}

function formatRelativeUpdate(updatedAt: number) {
  const elapsed = Math.max(0, Date.now() - updatedAt);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < minute) {
    return '刚刚更新';
  }

  if (elapsed < hour) {
    return `${Math.floor(elapsed / minute)} 分钟前更新`;
  }

  if (elapsed < day) {
    return `${Math.floor(elapsed / hour)} 小时前更新`;
  }

  if (elapsed < 30 * day) {
    return `${Math.floor(elapsed / day)} 天前更新`;
  }

  return `约 ${Math.floor(elapsed / (30 * day))} 个月前更新`;
}
