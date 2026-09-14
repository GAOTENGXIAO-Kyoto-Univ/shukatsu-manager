import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { Text, TextArea, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { analytics } from '@/lib/analytics';
import type { KnowledgeCategory, KnowledgeItemData } from './types';

const formSchema = z.object({
  category: z.enum(['qa', 'material', 'reverse_question']),
  title: z.string().trim().min(1, 'TITLE_REQUIRED'),
  content: z.string(),
  note: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export function KnowledgeItemOverlay({
  fixedCategory,
  item,
  onClose,
  onSaved,
  open,
}: {
  fixedCategory?: KnowledgeCategory;
  item: KnowledgeItemData | null;
  onClose: () => void;
  onSaved?: (message: string) => void;
  open: boolean;
}) {
  const { t } = useTranslation(['knowledge', 'common']);
  const createItem = useMutation(api.knowledgeItems.create);
  const updateItem = useMutation(api.knowledgeItems.update);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initialCategory = fixedCategory ?? item?.category ?? 'qa';
  const { control, formState: { errors, isSubmitting }, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: initialCategory,
      title: item?.title ?? '',
      content: item?.content ?? '',
      note: item?.note ?? '',
    },
  });
  const category = useWatch({ control, name: 'category' });

  useEffect(() => {
    if (open) {
      reset({
        category: fixedCategory ?? item?.category ?? 'qa',
        title: item?.title ?? '',
        content: item?.content ?? '',
        note: item?.note ?? '',
      });
    }
  }, [fixedCategory, item, open, reset]);

  async function submit(values: FormValues) {
    setErrorMessage(null);
    try {
      const payload = {
        category: fixedCategory ?? values.category,
        title: values.title,
        content: values.content || null,
        note: values.note || null,
      };
      if (item) {
        await updateItem({ knowledgeItemId: item.knowledgeItemId, ...payload });
      } else {
        await createItem(payload);
        analytics.knowledgeItemCreated({
          category: payload.category,
          creation_source: 'manual',
        });
      }
      setErrorMessage(null);
      onClose();
      onSaved?.(item ? t('knowledge:items.saved') : t('knowledge:items.added'));
    } catch {
      setErrorMessage(t('common:errors.save'));
    }
  }

  return (
    <ResponsiveOverlay
      mobileNearFullscreen
      onClose={() => {
        if (!isSubmitting) {
          setErrorMessage(null);
          onClose();
        }
      }}
      open={open}
      title={item ? t('knowledge:items.edit') : fixedCategory === 'reverse_question' ? t('knowledge:addReverse') : t('knowledge:addKnowledge')}
      width={620}
    >
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$lg" pb="$sm">
          {!fixedCategory ? (
            <FormField label={`${t('knowledge:items.type')} *`}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <XStack gap="$sm" flexWrap="wrap">
                    <Choice label={t('knowledge:qa')} selected={field.value === 'qa'} onPress={() => field.onChange('qa')} />
                    <Choice label={t('knowledge:material')} selected={field.value === 'material'} onPress={() => field.onChange('material')} />
                  </XStack>
                )}
              />
            </FormField>
          ) : null}
          <FormField label={`${t(`knowledge:items.${category === 'qa' ? 'question' : category === 'material' ? 'materialTitle' : 'reverseTitle'}`)} *`} error={errors.title ? t('knowledge:items.titleRequired') : undefined}>
            <Controller
              control={control}
              name="title"
              render={({ field }) => (
                <AppInput value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
              )}
            />
          </FormField>
          <FormField label={t(`knowledge:items.${category === 'qa' ? 'answer' : category === 'material' ? 'materialContent' : 'reverseContext'}`)}>
            <Controller
              control={control}
              name="content"
              render={({ field }) => (
                <TextArea minH={160} color="$text" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
          </FormField>
          <FormField label={t('knowledge:items.note')}>
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <TextArea minH={100} color="$text" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
          </FormField>
          {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={isSubmitting} onPress={() => { setErrorMessage(null); onClose(); }}>{t('common:actions.cancel')}</AppButton>
            <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
              {isSubmitting ? t('common:states.saving') : t('common:actions.save')}
            </AppButton>
          </XStack>
        </YStack>
      </ScrollView>
    </ResponsiveOverlay>
  );
}

function FormField({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return <YStack gap="$sm"><Text color="$text" fontWeight="600">{label}</Text>{children}{error ? <Text color="$danger">{error}</Text> : null}</YStack>;
}

function Choice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <XStack
      bg={selected ? '$accentSoft' : '$surface'}
      borderColor={selected ? '$accentStrong' : '$border'}
      borderWidth={1}
      cursor="pointer"
      minH={42}
      onPress={onPress}
      px="$md"
      style={{ alignItems: 'center', borderRadius: 9999 }}
    >
      <Text color={selected ? '$accentStrong' : '$textSecondary'} fontWeight="600">{label}</Text>
    </XStack>
  );
}
