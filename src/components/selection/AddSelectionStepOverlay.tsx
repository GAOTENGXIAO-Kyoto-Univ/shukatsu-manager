import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { analytics } from '@/lib/analytics';
import {
  selectionStepPresets,
  selectionStepTypeOptions,
  getPresetLabel,
  getStepTypeLabel,
  type SelectionStepPresetKey,
  type SelectionStepType,
} from './selectionConstants';

const customStepSchema = z.object({
  name: z.string().trim().min(1, 'STEP_NAME_REQUIRED'),
  type: z.enum(['es', 'web_test', 'interview', 'briefing', 'group_discussion', 'offer_meeting', 'other']),
});

type CustomStepForm = z.infer<typeof customStepSchema>;

type AddSelectionStepOverlayProps = {
  applicationId: Id<'applications'>;
  onClose: () => void;
  open: boolean;
};

export function AddSelectionStepOverlay({ applicationId, onClose, open }: AddSelectionStepOverlayProps) {
  const { t } = useTranslation(['selection', 'common']);
  const createStep = useMutation(api.selectionSteps.create);
  const [customOpen, setCustomOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setValue,
  } = useForm<CustomStepForm>({
    defaultValues: {
      name: '',
      type: 'interview',
    },
    resolver: zodResolver(customStepSchema),
  });
  const selectedCustomType = useWatch({ control, name: 'type' }) ?? 'interview';

  async function createPreset(
    name: string,
    type: SelectionStepType,
    presetKey: SelectionStepPresetKey,
  ) {
    if (pendingPreset) {
      return;
    }

    setPendingPreset(presetKey);
    setErrorMessage(null);

    try {
      await createStep({ applicationId, name, presetKey, type });
      analytics.selectionStepCreated({ step_type: type });
      close();
    } catch {
      setErrorMessage(t('selection:messages.addFailed'));
    } finally {
      setPendingPreset(null);
    }
  }

  async function submitCustom(values: CustomStepForm) {
    try {
      await createStep({ applicationId, name: values.name, type: values.type });
      analytics.selectionStepCreated({ step_type: values.type });
      close();
    } catch {
      setErrorMessage(t('selection:messages.addFailed'));
    }
  }

  function close() {
    reset();
    setCustomOpen(false);
    setErrorMessage(null);
    setPendingPreset(null);
    onClose();
  }

  return (
    <ResponsiveOverlay open={open} onClose={close} title={t('selection:actions.addStep')} desktopPresentation="popover">
      <YStack gap="$base">
        <YStack gap="$sm">
          <Text color="$textSecondary" fontSize={13}>
            {t('selection:labels.commonSteps')}
          </Text>
          <XStack flexWrap="wrap" gap="$sm">
            {selectionStepPresets.map((preset) => {
              const key = preset.presetKey ?? 'custom';
              const label = getPresetLabel(t, preset.presetKey);

              return (
              <AppButton
                key={key}
                variant={preset.custom ? 'secondary' : 'ghost'}
                disabled={Boolean(pendingPreset) || isSubmitting}
                onPress={() => {
                  if (preset.custom) {
                    setCustomOpen(true);
                    return;
                  }

                  if (preset.presetKey) {
                    void createPreset(preset.name, preset.type, preset.presetKey);
                  }
                }}
              >
                {pendingPreset === key ? t('common:states.adding') : label}
              </AppButton>
              );
            })}
          </XStack>
        </YStack>

        {customOpen ? (
          <YStack gap="$base">
            <YStack gap="$sm">
              <Text color="$text" fontWeight="600">
                {t('selection:labels.stepName')} *
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <AppInput
                    placeholder={t('selection:placeholders.stepName')}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                  />
                )}
              />
              {errors.name ? <Text color="$danger">{t('selection:messages.nameRequired')}</Text> : null}
            </YStack>
            <YStack gap="$sm">
              <Text color="$text" fontWeight="600">
                {t('selection:labels.stepType')} *
              </Text>
              <XStack flexWrap="wrap" gap="$sm">
                {selectionStepTypeOptions.map((option) => {
                  const selected = selectedCustomType === option.value;

                  return (
                    <XStack
                      key={option.value}
                      bg={selected ? '$accentSoft' : '$surfaceMuted'}
                      borderColor={selected ? '$accentStrong' : '$border'}
                      borderWidth={1}
                      cursor="pointer"
                      onPress={() => setValue('type', option.value, { shouldValidate: true })}
                      px="$md"
                      py="$xs"
                      style={{ borderRadius: 9999 }}
                    >
                      <Text
                        color={selected ? '$accentStrong' : '$textSecondary'}
                        fontSize={13}
                        fontWeight="600"
                      >
                        {getStepTypeLabel(t, option.value)}
                      </Text>
                    </XStack>
                  );
                })}
              </XStack>
            </YStack>
            <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
              <AppButton variant="secondary" disabled={isSubmitting} onPress={() => setCustomOpen(false)}>
                {t('common:actions.cancel')}
              </AppButton>
              <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submitCustom)}>
                {isSubmitting ? t('common:states.adding') : t('common:actions.add')}
              </AppButton>
            </XStack>
          </YStack>
        ) : null}

        {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
      </YStack>
    </ResponsiveOverlay>
  );
}
