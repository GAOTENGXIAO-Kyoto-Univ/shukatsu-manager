import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';

import { LanguageOptions } from './LanguageOptions';
import { changeAppLocale, DEFAULT_LOCALE, isSupportedLocale } from '@/i18n';

export function AuthLanguageSwitcher() {
  const { i18n, t } = useTranslation('auth');
  const selectedLocale = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : DEFAULT_LOCALE;

  return (
    <YStack gap="$sm" width="100%" maxW={400}>
      <Text color="$textSecondary" fontSize={13} fontWeight="600">
        {t('language')}
      </Text>
      <XStack>
        <YStack flex={1}>
          <LanguageOptions
            selectedLocale={selectedLocale}
            onSelect={(locale) => void changeAppLocale(locale)}
          />
        </YStack>
      </XStack>
    </YStack>
  );
}
