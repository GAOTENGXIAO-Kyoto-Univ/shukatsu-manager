import { Plus } from '@tamagui/lucide-icons-2';
import { useQuery_experimental as useQuery } from 'convex/react';
import { Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { AppButton } from '@/components/ui/AppButton';
import { AppToast } from '@/components/ui/AppToast';
import { ResearchItemOverlay } from './ResearchItemOverlay';
import { ResearchItemRow } from './ResearchItemRow';
import type {
  ResearchApplicationContext,
  ResearchItemData,
} from './types';

export function ResearchSummary({ application }: { application: ResearchApplicationContext }) {
  const [queryVersion, setQueryVersion] = useState(0);

  return (
    <ResearchSummaryContent
      key={queryVersion}
      application={application}
      onRetry={() => setQueryVersion((value) => value + 1)}
    />
  );
}

function ResearchSummaryContent({
  application,
  onRetry,
}: {
  application: ResearchApplicationContext;
  onRetry: () => void;
}) {
  const { t } = useTranslation(['research', 'common']);
  const router = useRouter();
  const researchState = useQuery({
    query: api.researchItems.listForApplication,
    args: { applicationId: application.applicationId },
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<ResearchItemData['researchItemId'] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const handle = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(handle);
  }, [toastMessage]);

  const items: ResearchItemData[] = researchState.status === 'success' ? researchState.data : [];
  const editingItem = editingItemId
    ? items.find((item) => item.researchItemId === editingItemId) ?? null
    : null;

  return (
    <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$lg">
      <XStack flexWrap="wrap" gap="$sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <YStack gap="$xs">
          <Text color="$text" fontSize={22} fontWeight="600">
            {t('research:title')}
          </Text>
          {researchState.status === 'success' ? (
            <Text color="$textMuted" fontSize={13}>
              {t('research:records', { count: items.length })}
            </Text>
          ) : null}
        </YStack>
        <XStack gap="$sm">
          <AppButton
            variant="ghost"
            onPress={() =>
              router.push(`/applications/${application.applicationId}/research` as Href)
            }
          >
            {t('research:viewAll')}
          </AppButton>
          <AppButton variant="primary" icon={<Plus size={17} />} onPress={() => setCreateOpen(true)}>
            {t('research:add')}
          </AppButton>
        </XStack>
      </XStack>

      {researchState.status === 'pending' ? <ResearchSummarySkeleton /> : null}

      {researchState.status === 'error' ? (
        <YStack gap="$sm" py="$md" style={{ alignItems: 'flex-start' }}>
          <Text color="$textSecondary">{t('common:errors.load')}</Text>
          <AppButton variant="secondary" onPress={onRetry}>
            {t('common:actions.retry')}
          </AppButton>
        </YStack>
      ) : null}

      {researchState.status === 'success' && items.length === 0 ? (
        <YStack gap="$sm" py="$lg">
          <Text color="$text" fontSize={17} fontWeight="600">
            {t('research:empty')}
          </Text>
          <Text color="$textSecondary" lineHeight={22}>
            {t('research:emptyDescription')}
          </Text>
        </YStack>
      ) : null}

      {researchState.status === 'success' && items.length > 0 ? (
        <YStack>
          {items.slice(0, 3).map((item) => (
            <ResearchItemRow
              key={item.researchItemId}
              application={application}
              compact
              item={item}
              onOpen={(selected) => setEditingItemId(selected.researchItemId)}
            />
          ))}
        </YStack>
      ) : null}

      {createOpen || editingItem ? (
        <ResearchItemOverlay
          application={application}
          item={editingItem}
          onClose={() => {
            setCreateOpen(false);
            setEditingItemId(null);
          }}
          onSaved={setToastMessage}
          open
        />
      ) : null}
      <AppToast message={toastMessage} />
    </YStack>
  );
}

function ResearchSummarySkeleton() {
  return (
    <YStack gap="$md" py="$sm">
      {[0, 1].map((item) => (
        <YStack key={item} borderBottomColor="$border" borderBottomWidth={1} gap="$sm" py="$md">
          <YStack bg="$surfaceMuted" height={16} width="34%" style={{ borderRadius: 8 }} />
          <YStack bg="$surfaceMuted" height={14} width="82%" style={{ borderRadius: 8 }} />
        </YStack>
      ))}
    </YStack>
  );
}
