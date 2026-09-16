import { ArrowDown, ArrowUp, Trash2 } from '@tamagui/lucide-icons-2';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';

export type SelectionProcessPreviewItem = {
  id: string;
  label: string;
  typeLabel: string;
};

type SelectionProcessPreviewProps = {
  items: readonly SelectionProcessPreviewItem[];
  onChange: (orderedIds: string[]) => void;
};

export function SelectionProcessPreview({ items, onChange }: SelectionProcessPreviewProps) {
  const { t } = useTranslation('selection');

  function move(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;

    if (nextIndex < 0 || nextIndex >= items.length) {
      return;
    }

    const orderedIds = items.map((item) => item.id);
    [orderedIds[index], orderedIds[nextIndex]] = [
      orderedIds[nextIndex],
      orderedIds[index],
    ];
    onChange(orderedIds);
  }

  return (
    <YStack gap="$sm">
      {items.map((item, index) => (
        <XStack
          key={item.id}
          bg="$surfaceMuted"
          gap="$sm"
          p="$md"
          style={{ alignItems: 'center', borderRadius: 12 }}
        >
          <YStack flex={1} gap="$xs" style={{ minWidth: 0 }}>
            <Text color="$text" fontWeight="600" numberOfLines={1}>
              {item.label}
            </Text>
            <Text color="$textMuted" fontSize={12} numberOfLines={1}>
              {item.typeLabel}
            </Text>
          </YStack>
          <XStack gap="$xs">
            <AppButton
              aria-label={t('actions.moveUp')}
              circular
              disabled={index === 0}
              icon={<ArrowUp size={16} />}
              onPress={() => move(index, -1)}
              size="$3"
              variant="ghost"
            />
            <AppButton
              aria-label={t('actions.moveDown')}
              circular
              disabled={index === items.length - 1}
              icon={<ArrowDown size={16} />}
              onPress={() => move(index, 1)}
              size="$3"
              variant="ghost"
            />
            <AppButton
              aria-label={t('actions.removeFromPreview')}
              circular
              icon={<Trash2 color="$danger" size={16} />}
              onPress={() => onChange(items.filter((_, itemIndex) => itemIndex !== index).map((entry) => entry.id))}
              size="$3"
              variant="ghost"
            />
          </XStack>
        </XStack>
      ))}
    </YStack>
  );
}
