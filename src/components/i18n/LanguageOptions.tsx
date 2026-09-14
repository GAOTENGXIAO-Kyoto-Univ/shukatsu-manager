import { Check } from '@tamagui/lucide-icons-2';
import { Button, Text, XStack, YStack } from 'tamagui';

import { warmPaperColors } from '../../../tamagui.config';
import {
  LOCALE_DISPLAY_NAMES,
  SUPPORTED_LOCALES,
  type AppLocale,
} from '@/i18n';

export function LanguageOptions({
  disabled = false,
  onSelect,
  selectedLocale,
}: {
  disabled?: boolean;
  onSelect: (locale: AppLocale) => void;
  selectedLocale: AppLocale;
}) {
  return (
    <YStack gap="$sm">
      {SUPPORTED_LOCALES.map((locale) => {
        const selected = locale === selectedLocale;
        return (
          <Button
            key={locale}
            unstyled
            aria-label={LOCALE_DISPLAY_NAMES[locale]}
            bg={selected ? '$accentSoft' : '$surface'}
            borderColor="$border"
            borderWidth={1}
            cursor={disabled ? 'not-allowed' : 'pointer'}
            disabled={disabled}
            minH={52}
            px="$base"
            pressStyle={{ opacity: 0.72 }}
            hoverStyle={{ background: warmPaperColors.surfaceMuted }}
            style={{ borderRadius: 12, justifyContent: 'center' }}
            onPress={() => onSelect(locale)}
          >
            <XStack style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Text color="$text" fontSize={15} fontWeight={selected ? '600' : '500'}>
                {LOCALE_DISPLAY_NAMES[locale]}
              </Text>
              {selected ? <Check color="$accentStrong" size={18} /> : null}
            </XStack>
          </Button>
        );
      })}
    </YStack>
  );
}

