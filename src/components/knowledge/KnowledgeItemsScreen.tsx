import { Plus, Trash2 } from '@tamagui/lucide-icons-2';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
      setDeleteError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <KnowledgePage>
      <KnowledgeHeader
        title={reverseOnly ? '逆質問' : '我的知识'}
        description={reverseOnly ? '整理面试末尾想向企业确认的问题。' : '集中管理问题回答与可复用素材。'}
        action={<AppButton variant="primary" icon={<Plus size={17} />} onPress={() => openEditor(null)}>{reverseOnly ? '添加逆質問' : '添加知识'}</AppButton>}
      />
      <YStack gap="$base">
        <SearchInput value={search} onChangeText={setSearch} placeholder={reverseOnly ? '搜索逆質問...' : '搜索知识...'} />
        {!reverseOnly ? (
          <XStack gap="$sm" flexWrap="wrap">
            {([['all', '全部'], ['qa', '问题回答'], ['material', '可用素材']] as const).map(([value, label]) => (
              <AppButton key={value} variant={filter === value ? 'primary' : 'secondary'} onPress={() => setFilter(value)}>{label}</AppButton>
            ))}
          </XStack>
        ) : null}
      </YStack>
      {state.status === 'pending' ? <LoadingState message="正在加载知识..." /> : null}
      {state.status === 'error' ? <MessageState message="知识读取失败，请稍后重试" actionLabel="重试" onAction={() => window.location.reload()} /> : null}
      {state.status === 'success' && items.length === 0 ? <KnowledgeEmpty message={search.trim() ? '没有符合条件的内容' : reverseOnly ? '还没有逆質問' : '还没有知识内容'} /> : null}
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
      <ResponsiveOverlay desktopPresentation="popover" onClose={() => setMenuItem(null)} open={Boolean(menuItem)} title="知识操作" width={320}>
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
          <Text color="$danger" fontWeight="600">{reverseOnly ? '删除逆質問' : '删除知识'}</Text>
        </XStack>
      </ResponsiveOverlay>
      <ResponsiveOverlay onClose={() => !deleting && setDeleteItem(null)} open={Boolean(deleteItem)} title="确认删除？">
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>仅删除这条知识内容，不会删除来源面试记录。</Text>
          {deleteError ? <Text color="$danger">{deleteError}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton disabled={deleting} onPress={() => setDeleteItem(null)}>取消</AppButton>
            <AppButton variant="danger" disabled={deleting} onPress={() => void confirmDelete()}>{deleting ? '删除中...' : '删除'}</AppButton>
          </XStack>
        </YStack>
      </ResponsiveOverlay>
    </KnowledgePage>
  );
}
