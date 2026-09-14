import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';

const displayNameSchema = z.object({
  displayName: z.string().trim().max(50, 'DISPLAY_NAME_TOO_LONG'),
});

type DisplayNameForm = z.infer<typeof displayNameSchema>;

type DisplayNameEditorProps = {
  currentDisplayName?: string;
  onClose: () => void;
  open: boolean;
};

export function DisplayNameEditor({
  currentDisplayName,
  onClose,
  open,
}: DisplayNameEditorProps) {
  const { t } = useTranslation(['profile', 'common']);
  const updateCurrent = useMutation(api.users.updateCurrent);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
  } = useForm<DisplayNameForm>({
    defaultValues: { displayName: currentDisplayName ?? '' },
    resolver: zodResolver(displayNameSchema),
  });

  useEffect(() => {
    if (open) {
      reset({ displayName: currentDisplayName ?? '' });
    }
  }, [currentDisplayName, open, reset]);

  function requestClose() {
    if (!isSubmitting) {
      onClose();
    }
  }

  async function submit(values: DisplayNameForm) {
    try {
      await updateCurrent({ displayName: values.displayName });
      onClose();
    } catch {
      setError('root', { message: t('common:errors.save') });
    }
  }

  return (
    <ResponsiveOverlay
      headerAction={null}
      onClose={requestClose}
      open={open}
      title={t('profile:editDisplayName')}
      width={480}
    >
      <YStack gap="$lg">
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            {t('profile:displayName')}
          </Text>
          <Controller
            control={control}
            name="displayName"
            render={({ field }) => (
              <AppInput
                aria-label={t('profile:displayName')}
                autoFocus
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                onSubmitEditing={() => {
                  void handleSubmit(submit)();
                }}
                returnKeyType="done"
                value={field.value}
              />
            )}
          />
          <Text color="$textMuted" fontSize={13}>
            {t('profile:displayNameHelp')}
          </Text>
          {errors.displayName?.message ? (
            <Text color="$danger" fontSize={13}>
              {t('profile:displayNameTooLong')}
            </Text>
          ) : null}
        </YStack>
        {errors.root?.message ? (
          <Text color="$danger" fontSize={13}>
            {errors.root.message}
          </Text>
        ) : null}
        <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton disabled={isSubmitting} variant="secondary" onPress={requestClose}>
            {t('common:actions.cancel')}
          </AppButton>
          <AppButton
            disabled={isSubmitting}
            variant="primary"
            onPress={handleSubmit(submit)}
          >
            {isSubmitting ? t('common:states.saving') : t('common:actions.save')}
          </AppButton>
        </XStack>
      </YStack>
    </ResponsiveOverlay>
  );
}
