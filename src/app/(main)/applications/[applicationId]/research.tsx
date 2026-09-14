import { ChevronLeft, Plus, Search } from '@tamagui/lucide-icons-2';
import { useQuery_experimental as useQuery } from 'convex/react';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';
import type { ApplicationDetailData } from '@/components/applications/types';
import { DeleteResearchItemDialog } from '@/components/research/DeleteResearchItemDialog';
import { researchCategoryOptions } from '@/components/research/researchConstants';
import { ResearchItemActionMenu } from '@/components/research/ResearchItemActionMenu';
import { ResearchItemOverlay } from '@/components/research/ResearchItemOverlay';
import { ResearchItemRow } from '@/components/research/ResearchItemRow';
import type {
  ResearchApplicationContext,
  ResearchCategory,
  ResearchItemData,
  ResearchScope,
} from '@/components/research/types';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppToast } from '@/components/ui/AppToast';
import { LoadingState, MessageState } from '@/components/ui/States';

type CategoryFilter = 'all' | ResearchCategory;
type ScopeFilter = 'all' | ResearchScope;
const emptyResearchItems: ResearchItemData[] = [];

function readRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResearchScreen() {
  const { t } = useTranslation(['research', 'companies', 'common']);
  const params = useLocalSearchParams();
  const router = useRouter();
  const applicationId = readRouteParam(params.applicationId);
  const applicationState = useQuery({
    query: api.applications.get,
    args: applicationId
      ? { applicationId: applicationId as Id<'applications'> }
      : 'skip',
  });

  function returnToApplication() {
    if (applicationId) {
      router.replace(`/applications/${applicationId}` as Href);
      return;
    }

    router.replace('/companies' as Href);
  }

  if (!applicationId) {
    return (
      <PageFrame>
        <MessageState message={t('companies:detail.missing')} actionLabel={t('companies:detail.back')} onAction={returnToApplication} />
      </PageFrame>
    );
  }

  if (applicationState.status === 'pending') {
    return (
      <PageFrame>
        <LoadingState message={t('research:loading')} />
      </PageFrame>
    );
  }

  if (applicationState.status === 'error') {
    return (
      <PageFrame>
        <MessageState message={t('common:errors.load')} actionLabel={t('interview:back')} onAction={returnToApplication} />
      </PageFrame>
    );
  }

  if (!applicationState.data) {
    return (
      <PageFrame>
        <MessageState message={t('companies:detail.forbidden')} actionLabel={t('companies:detail.back')} onAction={returnToApplication} />
      </PageFrame>
    );
  }

  return (
    <ResearchQueryBoundary
      application={applicationState.data}
      onBack={returnToApplication}
    />
  );
}

function ResearchQueryBoundary({
  application,
  onBack,
}: {
  application: ApplicationDetailData;
  onBack: () => void;
}) {
  const [queryVersion, setQueryVersion] = useState(0);

  return (
    <ResearchWorkspace
      key={queryVersion}
      application={application}
      onBack={onBack}
      onRetry={() => setQueryVersion((value) => value + 1)}
    />
  );
}

function ResearchWorkspace({
  application,
  onBack,
  onRetry,
}: {
  application: ApplicationDetailData;
  onBack: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation(['research', 'common']);
  const researchState = useQuery({
    query: api.researchItems.listForApplication,
    args: { applicationId: application.applicationId },
  });
  const applicationContext: ResearchApplicationContext = {
    applicationId: application.applicationId,
    companyName: application.company.name,
    jobTitle: application.jobTitle,
  };
  const [searchKeyword, setSearchKeyword] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<ResearchItemData['researchItemId'] | null>(null);
  const [menuItemId, setMenuItemId] = useState<ResearchItemData['researchItemId'] | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<ResearchItemData['researchItemId'] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const handle = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(handle);
  }, [toastMessage]);

  const items: ResearchItemData[] =
    researchState.status === 'success' ? researchState.data : emptyResearchItems;
  const filteredItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !keyword ||
        (item.title ?? '').toLocaleLowerCase().includes(keyword) ||
        item.content.toLocaleLowerCase().includes(keyword);
      const matchesCategory = category === 'all' || item.category === category;
      const matchesScope =
        scope === 'all' ||
        (scope === 'company' ? item.applicationId === undefined : item.applicationId !== undefined);

      return matchesSearch && matchesCategory && matchesScope;
    });
  }, [category, items, scope, searchKeyword]);
  const editingItem = editingItemId
    ? items.find((item) => item.researchItemId === editingItemId) ?? null
    : null;
  const menuItem = menuItemId
    ? items.find((item) => item.researchItemId === menuItemId) ?? null
    : null;
  const deleteItem = deleteItemId
    ? items.find((item) => item.researchItemId === deleteItemId) ?? null
    : null;
  const hasConditions = Boolean(searchKeyword.trim()) || category !== 'all' || scope !== 'all';

  function clearConditions() {
    setSearchKeyword('');
    setCategory('all');
    setScope('all');
  }

  return (
    <PageFrame>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$lg" width="100%" maxW={1120} p="$base" pb="$xxl" style={{ alignSelf: 'center' }}>
          <YStack gap="$base" py="$md">
            <AppButton
              variant="ghost"
              icon={<ChevronLeft size={18} />}
              onPress={onBack}
              style={{ alignSelf: 'flex-start' }}
            >
              {application.company.name} / {application.jobTitle}
            </AppButton>
            <XStack flexWrap="wrap" gap="$base" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <YStack gap="$xs">
                <Text color="$text" fontSize={30} fontWeight="600" lineHeight={38}>
                  {t('research:title')}
                </Text>
                {researchState.status === 'success' ? (
                  <Text color="$textMuted">{t('research:records', { count: items.length })}</Text>
                ) : null}
              </YStack>
              <AppButton variant="primary" icon={<Plus size={18} />} onPress={() => setCreateOpen(true)}>
                {t('research:add')}
              </AppButton>
            </XStack>
          </YStack>

          <XStack style={{ alignItems: 'center', position: 'relative' }}>
            <YStack style={{ left: 12, position: 'absolute', zIndex: 1 }}>
              <Search color="$textMuted" size={18} />
            </YStack>
            <AppInput
              flex={1}
              pl="$xl"
              placeholder={t('research:search')}
              value={searchKeyword}
              onChangeText={setSearchKeyword}
            />
          </XStack>

          <YStack borderBottomColor="$border" borderBottomWidth={1} gap="$md" pb="$lg">
            <FilterGroup label={t('research:category')}>
              <FilterOption label={t('research:all')} selected={category === 'all'} onPress={() => setCategory('all')} />
              {researchCategoryOptions.map((option) => (
                <FilterOption
                  key={option}
                  label={t(`research:categories.${option}`)}
                  selected={category === option}
                  onPress={() => setCategory(option)}
                />
              ))}
            </FilterGroup>
            <FilterGroup label={t('research:scope')}>
              <FilterOption label={t('research:all')} selected={scope === 'all'} onPress={() => setScope('all')} />
              <FilterOption
                label={t('research:companyShared', { company: application.company.name })}
                selected={scope === 'company'}
                onPress={() => setScope('company')}
              />
              <FilterOption
                label={t('research:applicationOnly')}
                selected={scope === 'application'}
                onPress={() => setScope('application')}
              />
            </FilterGroup>
          </YStack>

          {researchState.status === 'pending' ? <ResearchListSkeleton /> : null}

          {researchState.status === 'error' ? (
            <MessageState message={t('common:errors.load')} actionLabel={t('common:actions.retry')} onAction={onRetry} />
          ) : null}

          {researchState.status === 'success' && items.length === 0 ? (
            <YStack gap="$md" py="$xl" style={{ alignItems: 'center' }}>
              <Text color="$text" fontSize={20} fontWeight="600">
                {t('research:empty')}
              </Text>
              <Text color="$textSecondary" lineHeight={22} style={{ textAlign: 'center' }}>
                {t('research:emptyDescription')}
              </Text>
              <AppButton variant="primary" onPress={() => setCreateOpen(true)}>
                {t('research:add')}
              </AppButton>
            </YStack>
          ) : null}

          {researchState.status === 'success' && items.length > 0 && filteredItems.length === 0 ? (
            <MessageState
              message={t('research:noMatches')}
              actionLabel={t('research:clear')}
              onAction={clearConditions}
            />
          ) : null}

          {researchState.status === 'success' && filteredItems.length > 0 ? (
            <YStack>
              {filteredItems.map((item) => (
                <ResearchItemRow
                  key={item.researchItemId}
                  application={applicationContext}
                  item={item}
                  onOpen={(selected) => setEditingItemId(selected.researchItemId)}
                  onOpenMenu={(selected) => setMenuItemId(selected.researchItemId)}
                />
              ))}
            </YStack>
          ) : null}

          {hasConditions && researchState.status === 'success' && filteredItems.length > 0 ? (
            <AppButton variant="secondary" onPress={clearConditions} style={{ alignSelf: 'flex-start' }}>
              {t('research:clear')}
            </AppButton>
          ) : null}
        </YStack>
      </ScrollView>

      {createOpen || editingItem ? (
        <ResearchItemOverlay
          application={applicationContext}
          item={editingItem}
          onClose={() => {
            setCreateOpen(false);
            setEditingItemId(null);
          }}
          onSaved={setToastMessage}
          open
        />
      ) : null}
      <ResearchItemActionMenu
        item={menuItem}
        onClose={() => setMenuItemId(null)}
        onEdit={(item) => {
          setMenuItemId(null);
          setEditingItemId(item.researchItemId);
        }}
        onError={(message) => {
          setMenuItemId(null);
          setToastMessage(message);
        }}
        onRequestDelete={(item) => {
          setMenuItemId(null);
          setDeleteItemId(item.researchItemId);
        }}
      />
      <DeleteResearchItemDialog
        item={deleteItem}
        onClose={() => setDeleteItemId(null)}
        onDeleted={() => {
          setDeleteItemId(null);
          setToastMessage(t('research:deleted'));
        }}
      />
      <AppToast message={toastMessage} />
    </PageFrame>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <YStack flex={1} bg="$background">
      {children}
    </YStack>
  );
}

function FilterGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <YStack gap="$sm">
      <Text color="$textMuted" fontSize={13} fontWeight="600">
        {label}
      </Text>
      <XStack flexWrap="wrap" gap="$sm">
        {children}
      </XStack>
    </YStack>
  );
}

function FilterOption({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <XStack
      bg={selected ? '$accentStrong' : '$surfaceMuted'}
      borderColor={selected ? '$accentStrong' : '$border'}
      borderWidth={1}
      cursor="pointer"
      minH={38}
      onPress={onPress}
      px="$md"
      py="$xs"
      style={{ alignItems: 'center', borderRadius: 9999 }}
    >
      <Text color={selected ? '$surface' : '$textSecondary'} fontSize={13} fontWeight="600">
        {label}
      </Text>
    </XStack>
  );
}

function ResearchListSkeleton() {
  return (
    <YStack gap="$base">
      {[0, 1, 2].map((item) => (
        <YStack key={item} borderBottomColor="$border" borderBottomWidth={1} gap="$sm" py="$base">
          <YStack bg="$surfaceMuted" height={16} width="28%" style={{ borderRadius: 8 }} />
          <YStack bg="$surfaceMuted" height={18} width="46%" style={{ borderRadius: 8 }} />
          <YStack bg="$surfaceMuted" height={14} width="88%" style={{ borderRadius: 8 }} />
        </YStack>
      ))}
    </YStack>
  );
}
