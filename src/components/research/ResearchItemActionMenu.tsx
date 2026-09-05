import { FilePenLine, Pin, PinOff, Trash2 } from '@tamagui/lucide-icons-2';
import { useMutation } from 'convex/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import type { ResearchItemData } from './types';

type ResearchItemActionMenuProps = {
  item: ResearchItemData | null;
  onClose: () => void;
  onEdit: (item: ResearchItemData) => void;
  onError: (message: string) => void;
  onRequestDelete: (item: ResearchItemData) => void;
};

export function ResearchItemActionMenu({
  item,
  onClose,
  onEdit,
  onError,
  onRequestDelete,
}: ResearchItemActionMenuProps) {
  const setPinned = useMutation(api.researchItems.setPinned);
  const [isPinning, setIsPinning] = useState(false);

  async function togglePinned() {
    if (!item || isPinning) {
      return;
    }

    setIsPinning(true);

    try {
      await setPinned({ researchItemId: item.researchItemId, isPinned: !item.isPinned });
      setIsPinning(false);
      onClose();
    } catch {
      setIsPinning(false);
      onError('置顶状态更新失败，请重试');
    }
  }

  return (
    <ResponsiveOverlay
      desktopPresentation="popover"
      onClose={onClose}
      open={Boolean(item)}
      title="研究操作"
      width={320}
    >
      {item ? (
        <YStack gap="$sm">
          <MenuAction
            disabled={isPinning}
            icon={
              item.isPinned ? (
                <PinOff color="$textSecondary" size={18} />
              ) : (
                <Pin color="$textSecondary" size={18} />
              )
            }
            label={item.isPinned ? '取消置顶' : '置顶'}
            onPress={() => void togglePinned()}
          />
          <MenuAction
            icon={<FilePenLine color="$textSecondary" size={18} />}
            label="编辑"
            onPress={() => onEdit(item)}
          />
          <MenuAction
            danger
            icon={<Trash2 color="$danger" size={18} />}
            label="删除"
            onPress={() => onRequestDelete(item)}
          />
        </YStack>
      ) : null}
    </ResponsiveOverlay>
  );
}

function MenuAction({
  danger = false,
  disabled = false,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <XStack
      bg={danger ? '$dangerSoft' : '$surfaceMuted'}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      gap="$sm"
      minH={44}
      onPress={disabled ? undefined : onPress}
      opacity={disabled ? 0.6 : 1}
      p="$md"
      style={{ alignItems: 'center', borderRadius: 12 }}
    >
      {icon}
      <Text color={danger ? '$danger' : '$text'} fontWeight="600">
        {label}
      </Text>
    </XStack>
  );
}
