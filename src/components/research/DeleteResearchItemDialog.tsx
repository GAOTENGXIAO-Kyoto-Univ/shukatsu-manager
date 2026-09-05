import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import type { ResearchItemData } from './types';

type DeleteResearchItemDialogProps = {
  item: ResearchItemData | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteResearchItemDialog({
  item,
  onClose,
  onDeleted,
}: DeleteResearchItemDialogProps) {
  const removeResearchItem = useMutation(api.researchItems.remove);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function close() {
    if (!isDeleting) {
      setErrorMessage(null);
      onClose();
    }
  }

  async function confirmDelete() {
    if (!item || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await removeResearchItem({ researchItemId: item.researchItemId });
      setIsDeleting(false);
      onDeleted();
    } catch {
      setIsDeleting(false);
      setErrorMessage('删除失败，请重试');
    }
  }

  return (
    <ResponsiveOverlay onClose={close} open={Boolean(item)} title="删除这条企业研究？">
      {item ? (
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>
            删除后无法恢复。企业、应聘记录和其他研究不会受到影响。
          </Text>
          {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={isDeleting} onPress={close}>
              取消
            </AppButton>
            <AppButton variant="danger" disabled={isDeleting} onPress={confirmDelete}>
              {isDeleting ? '删除中...' : '删除'}
            </AppButton>
          </XStack>
        </YStack>
      ) : null}
    </ResponsiveOverlay>
  );
}
