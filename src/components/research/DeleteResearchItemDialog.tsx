import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['research', 'common']);
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
      setErrorMessage(t('common:errors.delete'));
    }
  }

  return (
    <ResponsiveOverlay onClose={close} open={Boolean(item)} title={t('research:deleteTitle')}>
      {item ? (
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>
            {t('research:deleteDescription')}
          </Text>
          {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={isDeleting} onPress={close}>
              {t('common:actions.cancel')}
            </AppButton>
            <AppButton variant="danger" disabled={isDeleting} onPress={confirmDelete}>
              {isDeleting ? t('common:states.deleting') : t('common:actions.delete')}
            </AppButton>
          </XStack>
        </YStack>
      ) : null}
    </ResponsiveOverlay>
  );
}
