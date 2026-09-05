import { Trash2 } from '@tamagui/lucide-icons-2';
import { XStack, YStack, Text } from 'tamagui';

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
  return (
    <ResponsiveOverlay
      open={Boolean(application)}
      onClose={onClose}
      title="操作"
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
              删除应聘记录
            </Text>
          </XStack>
        </YStack>
      ) : null}
    </ResponsiveOverlay>
  );
}
