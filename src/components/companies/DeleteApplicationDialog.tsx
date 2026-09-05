import { useMutation } from 'convex/react';
import { useState } from 'react';
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
    } catch (error) {
      setIsDeleting(false);
      setErrorMessage(error instanceof Error ? error.message : '删除失败，请重试');
    }
  }

  function close() {
    if (!isDeleting) {
      setErrorMessage(null);
      onClose();
    }
  }

  return (
    <ResponsiveOverlay open={Boolean(application)} onClose={close} title="确认删除">
      {application ? (
        <YStack gap="$base">
          <YStack gap="$xs">
            <Text color="$text" fontSize={16} fontWeight="600">
              {application.companyName}
            </Text>
            <Text color="$textSecondary">{application.jobTitle}</Text>
          </YStack>
          <Text color="$textSecondary" lineHeight={22}>
            该应聘记录下的选考步骤、时间事项、面试记录、复盘和面试问题都会一并删除。
            企业本身不会被删除。
          </Text>
          {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={isDeleting} onPress={close}>
              取消
            </AppButton>
            <AppButton variant="danger" disabled={isDeleting} onPress={confirmDelete}>
              {isDeleting ? '删除中...' : '删除应聘记录'}
            </AppButton>
          </XStack>
        </YStack>
      ) : null}
    </ResponsiveOverlay>
  );
}
