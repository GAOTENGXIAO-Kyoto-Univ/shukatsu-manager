import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { LanguageOptions } from '@/components/i18n/LanguageOptions';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { changeAppLocale, getCurrentAppLocale, type AppLocale } from '@/i18n';

export function LanguageSelectorOverlay({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const { t } = useTranslation('profile');
  const updateLocale = useMutation(api.users.updateLocale);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  async function selectLocale(locale: AppLocale) {
    const previousLocale = getCurrentAppLocale();
    if (locale === previousLocale || saving) return;

    setSaveFailed(false);
    setSaving(true);
    await changeAppLocale(locale);

    try {
      await updateLocale({ locale });
      onClose();
    } catch {
      await changeAppLocale(previousLocale);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveOverlay open={open} onClose={saving ? () => undefined : onClose} title={t('language')} width={460}>
      <YStack gap="$md">
        <LanguageOptions
          disabled={saving}
          selectedLocale={getCurrentAppLocale()}
          onSelect={(locale) => void selectLocale(locale)}
        />
        {saveFailed ? (
          <Text color="$danger" fontSize={13} lineHeight={20}>
            {t('localeSaveFailed')}
          </Text>
        ) : null}
      </YStack>
    </ResponsiveOverlay>
  );
}

