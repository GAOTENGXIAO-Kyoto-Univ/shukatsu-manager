import { X } from '@tamagui/lucide-icons-2';
import { useTranslation } from 'react-i18next';
import { XStack, Text } from 'tamagui';

import { warmPaperColors } from '../../../tamagui.config';

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation('common');

  return (
    <XStack
      bg="$accentSoft"
      gap="$xs"
      px="$md"
      py="$xs"
      style={{
        alignItems: 'center',
        borderColor: warmPaperColors.border,
        borderRadius: 9999,
        borderWidth: 1,
      }}
    >
      <Text color="$accentStrong" fontSize={13} fontWeight="500">
        {label}
      </Text>
      <XStack
        aria-label={t('removeFilter', { label })}
        cursor="pointer"
        onPress={onRemove}
        style={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <X color="$accentStrong" size={14} />
      </XStack>
    </XStack>
  );
}
