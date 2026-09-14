import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XStack, YStack, Text } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppButton } from '@/components/ui/AppButton';

import { ResponsiveOverlay } from './ResponsiveOverlay';

export type DeleteApplicationTarget = {
  applicationId: Id<'applications'>;
  companyName: string;
  jobTitle: string;
};

type DeleteApplicationDialogProps = {
  application: DeleteApplicationTarget | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteApplicationDialog({
  application,
  onClose,
  onDeleted,
}: DeleteApplicationDialogProps) {
  const { t } = useTranslation(['companies', 'common']);
  const removeApplication = useMutation(api.applications.remove);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    if (!application || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await removeApplication({ applicationId: application.applicationId });
      setIsDeleting(false);
      onDeleted();
    } catch {
      setIsDeleting(false);
      setErrorMessage(t('common:errors.delete'));
    }
  }

  function close() {
    if (!isDeleting) {
      setErrorMessage(null);
      onClose();
    }
  }

  return (
    <ResponsiveOverlay open={Boolean(application)} onClose={close} title={t('companies:deleteDialog.title')}>
      {application ? (
        <YStack gap="$base">
          <YStack gap="$xs">
            <Text color="$text" fontSize={16} fontWeight="600">
              {application.companyName}
            </Text>
            <Text color="$textSecondary">{application.jobTitle}</Text>
          </YStack>
          <Text color="$textSecondary" lineHeight={22}>
            {t('companies:deleteDialog.description')}
          </Text>
          {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={isDeleting} onPress={close}>
              {t('common:actions.cancel')}
            </AppButton>
            <AppButton variant="danger" disabled={isDeleting} onPress={confirmDelete}>
              {isDeleting ? t('common:states.deleting') : t('companies:deleteDialog.action')}
            </AppButton>
          </XStack>
        </YStack>
      ) : null}
    </ResponsiveOverlay>
  );
}
