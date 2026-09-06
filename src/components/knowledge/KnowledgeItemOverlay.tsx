import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useEffect, useState } from 'react';
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
  title: z.string().trim().min(1, '请输入标题'),
  content: z.string(),
  note: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const labels: Record<KnowledgeCategory, { title: string; content: string }> = {
  qa: { title: '问题 *', content: '当前回答' },
  material: { title: '素材标题 *', content: '素材内容' },
  reverse_question: { title: '逆質問 *', content: '提问背景' },
};

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
      onSaved?.(item ? '已保存修改' : '已添加知识');
    } catch {
      setErrorMessage('保存失败，请重试');
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
      title={item ? '编辑知识' : fixedCategory === 'reverse_question' ? '添加逆質問' : '添加知识'}
      width={620}
    >
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$lg" pb="$sm">
          {!fixedCategory ? (
            <FormField label="类型 *">
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <XStack gap="$sm" flexWrap="wrap">
                    <Choice label="问题回答" selected={field.value === 'qa'} onPress={() => field.onChange('qa')} />
                    <Choice label="可用素材" selected={field.value === 'material'} onPress={() => field.onChange('material')} />
                  </XStack>
                )}
              />
            </FormField>
          ) : null}
          <FormField label={labels[category].title} error={errors.title?.message}>
            <Controller
              control={control}
              name="title"
              render={({ field }) => (
                <AppInput value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
              )}
            />
          </FormField>
          <FormField label={labels[category].content}>
            <Controller
              control={control}
              name="content"
              render={({ field }) => (
                <TextArea minH={160} color="$text" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
          </FormField>
          <FormField label="补充备注">
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
            <AppButton variant="secondary" disabled={isSubmitting} onPress={() => { setErrorMessage(null); onClose(); }}>取消</AppButton>
            <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
              {isSubmitting ? '保存中...' : '保存'}
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
