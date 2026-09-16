import { ChevronLeft } from '@tamagui/lucide-icons-2';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  selectionProcessTemplates,
  type SelectionProcessTemplateKey,
} from '../../../convex/lib/selectionProcessTemplates';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { getPresetLabel, getStepTypeLabel, selectionStepPresets, type SelectionStepPresetKey } from './selectionConstants';
import { SelectionProcessPreview } from './SelectionProcessPreview';

type SelectionProcessTemplateOverlayProps = {
  applicationId: Id<'applications'>;
  onClose: () => void;
  open: boolean;
};

const presetTypeByKey = new Map(
  selectionStepPresets.flatMap((preset) =>
    preset.presetKey ? [[preset.presetKey, preset.type] as const] : [],
  ),
);

export function SelectionProcessTemplateOverlay({
  applicationId,
  onClose,
  open,
}: SelectionProcessTemplateOverlayProps) {
  const { t } = useTranslation(['selection', 'common']);
  const createFromTemplate = useMutation(api.selectionProcesses.createFromTemplate);
  const [templateKey, setTemplateKey] = useState<SelectionProcessTemplateKey | null>(null);
  const [orderedPresetKeys, setOrderedPresetKeys] = useState<SelectionStepPresetKey[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function close() {
    setTemplateKey(null);
    setOrderedPresetKeys([]);
    setIsSubmitting(false);
    setErrorMessage(null);
    onClose();
  }

  function selectTemplate(key: SelectionProcessTemplateKey) {
    const template = selectionProcessTemplates.find((entry) => entry.key === key);

    if (!template) {
      return;
    }

    setTemplateKey(key);
    setOrderedPresetKeys([...template.presetKeys]);
    setErrorMessage(null);
  }

  async function submit() {
    if (!templateKey || orderedPresetKeys.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createFromTemplate({
        targetApplicationId: applicationId,
        templateKey,
        orderedTemplateStepKeys: orderedPresetKeys,
      });
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setErrorMessage(
        message.includes('SELECTION_PROCESS_TARGET_NOT_EMPTY')
          ? t('selection:messages.targetNoLongerEmpty')
          : t('selection:messages.templateCreateFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const previewItems = orderedPresetKeys.map((presetKey) => ({
    id: presetKey,
    label: getPresetLabel(t, presetKey),
    typeLabel: getStepTypeLabel(t, presetTypeByKey.get(presetKey) ?? 'other'),
  }));

  return (
    <ResponsiveOverlay
      mobileNearFullscreen
      onClose={close}
      open={open}
      title={t('selection:templates.overlayTitle')}
      width={680}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 4 }} style={{ flex: 1 }}>
        {templateKey ? (
          <YStack gap="$base">
            <AppButton
              icon={<ChevronLeft size={17} />}
              onPress={() => {
                setTemplateKey(null);
                setOrderedPresetKeys([]);
                setErrorMessage(null);
              }}
              style={{ alignSelf: 'flex-start' }}
              variant="ghost"
            >
              {t('selection:templates.backToList')}
            </AppButton>
            <YStack gap="$xs">
              <Text color="$text" fontSize={18} fontWeight="600">
                {t(`selection:templates.${templateKey}.title`)}
              </Text>
              <Text color="$textSecondary" lineHeight={21}>
                {t('selection:templates.previewDescription')}
              </Text>
            </YStack>
            {previewItems.length > 0 ? (
              <SelectionProcessPreview
                items={previewItems}
                onChange={(orderedIds) => setOrderedPresetKeys(orderedIds as SelectionStepPresetKey[])}
              />
            ) : (
              <Text color="$warningStrong">{t('selection:messages.previewEmpty')}</Text>
            )}
            {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
            <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'flex-end' }}>
              <AppButton disabled={isSubmitting} onPress={close} variant="secondary">
                {t('common:actions.cancel')}
              </AppButton>
              <AppButton
                disabled={isSubmitting || orderedPresetKeys.length === 0}
                onPress={() => void submit()}
                variant="primary"
              >
                {isSubmitting ? t('selection:states.creatingProcess') : t('selection:actions.createProcess')}
              </AppButton>
            </XStack>
          </YStack>
        ) : (
          <YStack gap="$sm">
            <Text color="$textSecondary" lineHeight={21}>
              {t('selection:templates.chooseDescription')}
            </Text>
            {selectionProcessTemplates.map((template) => (
              <YStack
                key={template.key}
                bg="$surfaceMuted"
                cursor="pointer"
                gap="$xs"
                onPress={() => selectTemplate(template.key)}
                p="$base"
                style={{ borderRadius: 12 }}
              >
                <Text color="$text" fontSize={17} fontWeight="600">
                  {t(`selection:templates.${template.key}.title`)}
                </Text>
                <Text color="$textSecondary" lineHeight={20}>
                  {template.presetKeys.map((key) => getPresetLabel(t, key)).join(' → ')}
                </Text>
              </YStack>
            ))}
          </YStack>
        )}
      </ScrollView>
    </ResponsiveOverlay>
  );
}
