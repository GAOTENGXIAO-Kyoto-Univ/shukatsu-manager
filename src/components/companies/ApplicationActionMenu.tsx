import { Trash2 } from '@tamagui/lucide-icons-2';
import { XStack, YStack, Text } from 'tamagui';
import { useTranslation } from 'react-i18next';

import type { ApplicationListItem } from './types';
import { ResponsiveOverlay } from './ResponsiveOverlay';

type ApplicationActionMenuProps = {
  application: ApplicationListItem | null;
  onClose: () => void;
  onRequestDelete: (application: ApplicationListItem) => void;
};

export function ApplicationActionMenu({
  application,
  onClose,
  onRequestDelete,
}: ApplicationActionMenuProps) {
  const { t } = useTranslation('companies');
  return (
    <ResponsiveOverlay
      open={Boolean(application)}
      onClose={onClose}
      title={t('detail.actions')}
      desktopPresentation="popover"
      width={320}
    >
      {application ? (
        <YStack gap="$base">
          <YStack gap="$xs">
            <Text color="$text" fontWeight="600">
              {application.companyName}
            </Text>
            <Text color="$textSecondary">{application.jobTitle}</Text>
          </YStack>
          <XStack
            bg="$dangerSoft"
            cursor="pointer"
            gap="$sm"
            onPress={() => onRequestDelete(application)}
            p="$md"
            style={{ alignItems: 'center', borderRadius: 12, minHeight: 44 }}
          >
            <Trash2 color="$danger" size={18} />
            <Text color="$danger" fontWeight="600">
              {t('deleteDialog.action')}
            </Text>
          </XStack>
        </YStack>
      ) : null}
    </ResponsiveOverlay>
  );
}
