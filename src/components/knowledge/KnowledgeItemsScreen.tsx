import { Plus, Trash2 } from '@tamagui/lucide-icons-2';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { LoadingState, MessageState } from '@/components/ui/States';
import { KnowledgeItemCard } from './KnowledgeItemCard';
import { KnowledgeItemOverlay } from './KnowledgeItemOverlay';
import { KnowledgeEmpty, KnowledgeHeader, KnowledgePage, SearchInput } from './KnowledgeLayout';
import type { KnowledgeItemData } from './types';

type Filter = 'all' | 'qa' | 'material';

export function KnowledgeItemsScreen({ reverseOnly = false }: { reverseOnly?: boolean }) {
  const { t } = useTranslation(['knowledge', 'common']);
  const state = useQuery({ query: api.knowledgeItems.list, args: {} });
  const removeItem = useMutation(api.knowledgeItems.remove);
  const params = useLocalSearchParams<{ item?: string | string[] }>();
  const revealId = Array.isArray(params.item) ? params.item[0] : params.item;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItemData | null>(null);
  const [menuItem, setMenuItem] = useState<KnowledgeItemData | null>(null);
  const [deleteItem, setDeleteItem] = useState<KnowledgeItemData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const items = useMemo(() => {
    if (state.status !== 'success') return [];
    const normalized = search.trim().toLocaleLowerCase();
    return (state.data as KnowledgeItemData[]).filter((item) => {
      const scopeMatch = reverseOnly
        ? item.category === 'reverse_question'
        : item.category !== 'reverse_question' && (filter === 'all' || item.category === filter);
      const searchMatch = !normalized || [item.title, item.content, item.note]
        .some((value) => value?.toLocaleLowerCase().includes(normalized));
      return scopeMatch && searchMatch;
    });
  }, [filter, reverseOnly, search, state]);
  const revealTargetExists = items.some((item) => item.knowledgeItemId === revealId);

  function openEditor(item: KnowledgeItemData | null) {
    setEditingItem(item);
    setEditorOpen(true);
  }

  async function confirmDelete() {
    if (!deleteItem || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await removeItem({ knowledgeItemId: deleteItem.knowledgeItemId });
      setDeleteItem(null);
    } catch {
      setDeleteError(t('common:errors.delete'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <KnowledgePage>
      <KnowledgeHeader
        title={reverseOnly ? t('knowledge:reverse') : t('knowledge:myKnowledge')}
        description={reverseOnly ? t('knowledge:items.reverseDescription') : t('knowledge:items.description')}
        action={<AppButton variant="primary" icon={<Plus size={17} />} onPress={() => openEditor(null)}>{reverseOnly ? t('knowledge:addReverse') : t('knowledge:addKnowledge')}</AppButton>}
      />
      <YStack gap="$base">
        <SearchInput value={search} onChangeText={setSearch} placeholder={reverseOnly ? t('knowledge:items.searchReverse') : t('knowledge:items.search')} />
        {!reverseOnly ? (
          <XStack gap="$sm" flexWrap="wrap">
            {([['all', t('knowledge:items.all')], ['qa', t('knowledge:qa')], ['material', t('knowledge:material')]] as const).map(([value, label]) => (
              <AppButton key={value} variant={filter === value ? 'primary' : 'secondary'} onPress={() => setFilter(value)}>{label}</AppButton>
            ))}
          </XStack>
        ) : null}
      </YStack>
      {state.status === 'pending' ? <LoadingState message={t('knowledge:items.loading')} /> : null}
      {state.status === 'error' ? <MessageState message={t('knowledge:items.loadFailed')} actionLabel={t('common:actions.retry')} onAction={() => window.location.reload()} /> : null}
      {state.status === 'success' && items.length === 0 ? <KnowledgeEmpty message={search.trim() ? t('knowledge:items.noMatches') : reverseOnly ? t('knowledge:noReverse') : t('knowledge:noKnowledge')} /> : null}
      {state.status === 'success' && items.length > 0 ? (
        <YStack gap="$base">
          {items.map((item) => (
            <KnowledgeItemCard
              key={`${item.knowledgeItemId}-${item.knowledgeItemId === revealId}`}
              initiallyExpanded={item.knowledgeItemId === revealId}
              item={item}
              onEdit={() => openEditor(item)}
              onMenu={() => setMenuItem(item)}
            />
          ))}
          {revealTargetExists ? <YStack aria-hidden height={1} style={{ marginBottom: '50vh' }} /> : null}
        </YStack>
      ) : null}

      <KnowledgeItemOverlay
        fixedCategory={reverseOnly ? 'reverse_question' : undefined}
        item={editingItem}
        onClose={() => { setEditorOpen(false); setEditingItem(null); }}
        open={editorOpen}
      />
      <ResponsiveOverlay desktopPresentation="popover" onClose={() => setMenuItem(null)} open={Boolean(menuItem)} title={t('knowledge:items.menu')} width={320}>
        <XStack
          bg="$dangerSoft"
          cursor="pointer"
          gap="$sm"
          minH={44}
          onPress={() => { setDeleteItem(menuItem); setMenuItem(null); setDeleteError(null); }}
          p="$md"
          style={{ alignItems: 'center', borderRadius: 12 }}
        >
          <Trash2 color="$danger" size={18} />
          <Text color="$danger" fontWeight="600">{reverseOnly ? t('knowledge:items.deleteReverse') : t('knowledge:items.deleteKnowledge')}</Text>
        </XStack>
      </ResponsiveOverlay>
      <ResponsiveOverlay onClose={() => !deleting && setDeleteItem(null)} open={Boolean(deleteItem)} title={t('knowledge:items.deleteTitle')}>
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>{t('knowledge:items.deleteDescription')}</Text>
          {deleteError ? <Text color="$danger">{deleteError}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton disabled={deleting} onPress={() => setDeleteItem(null)}>{t('common:actions.cancel')}</AppButton>
            <AppButton variant="danger" disabled={deleting} onPress={() => void confirmDelete()}>{deleting ? t('common:states.deleting') : t('common:actions.delete')}</AppButton>
          </XStack>
        </YStack>
      </ResponsiveOverlay>
    </KnowledgePage>
  );
}
