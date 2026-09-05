import { zodResolver } from '@hookform/resolvers/zod';
import { Bold, Link2, List, ListOrdered, Plus, X } from '@tamagui/lucide-icons-2';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import type { ElementRef, ReactElement } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { Switch, Text, TextArea, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { researchCategoryOptions } from './researchConstants';
import type {
  ResearchApplicationContext,
  ResearchItemData,
} from './types';

const sourceUrlSchema = z.object({
  value: z.string().refine((value) => {
    const trimmed = value.trim();

    if (!trimmed) {
      return true;
    }

    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, '请输入以 http:// 或 https:// 开头的链接'),
});

const researchFormSchema = z.object({
  scope: z.enum(['company', 'application']),
  category: z.enum([
    'business',
    'culture',
    'strength',
    'weakness',
    'motivation',
    'reverse_question',
    'recruiting',
    'other',
  ]),
  title: z.string(),
  content: z.string().trim().min(1, '请输入研究内容'),
  sourceUrls: z.array(sourceUrlSchema),
  isPinned: z.boolean(),
});

type ResearchFormValues = z.infer<typeof researchFormSchema>;
type ContentFormat = 'bold' | 'unordered-list' | 'ordered-list' | 'link';
type EditorSelection = { start: number; end: number };

type ResearchItemOverlayProps = {
  application: ResearchApplicationContext;
  item: ResearchItemData | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  open: boolean;
};

function getInitialValues(item: ResearchItemData | null): ResearchFormValues {
  return {
    scope: item?.applicationId ? 'application' : 'company',
    category: item?.category ?? 'business',
    title: item?.title ?? '',
    content: item?.content ?? '',
    sourceUrls: (item?.sourceUrls ?? []).map((value) => ({ value })),
    isPinned: item?.isPinned ?? false,
  };
}

export function ResearchItemOverlay({
  application,
  item,
  onClose,
  onSaved,
  open,
}: ResearchItemOverlayProps) {
  const createResearchItem = useMutation(api.researchItems.create);
  const updateResearchItem = useMutation(api.researchItems.update);
  const editorRef = useRef<ElementRef<typeof TextArea>>(null);
  const [editorSelection, setEditorSelection] = useState<EditorSelection>({ start: 0, end: 0 });
  const [discardOpen, setDiscardOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initialValues = getInitialValues(item);
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    getValues,
    handleSubmit,
    reset,
    setValue,
  } = useForm<ResearchFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(researchFormSchema),
  });
  const { append, fields, remove } = useFieldArray({ control, name: 'sourceUrls' });
  const selectedScope = useWatch({ control, name: 'scope' });

  function requestClose() {
    if (isSubmitting) {
      return;
    }

    if (isDirty) {
      setDiscardOpen(true);
      return;
    }

    onClose();
  }

  function applyFormat(format: ContentFormat) {
    const content = getValues('content');
    const result = formatContent(content, editorSelection, format);

    setValue('content', result.content, { shouldDirty: true, shouldValidate: true });
    setEditorSelection(result.selection);
    window.requestAnimationFrame(() => editorRef.current?.focus());
  }

  async function submit(values: ResearchFormValues) {
    setErrorMessage(null);

    const title = values.title.trim() || undefined;
    const sourceUrls = Array.from(
      new Set(values.sourceUrls.map((source) => source.value.trim()).filter(Boolean)),
    );

    try {
      if (item) {
        await updateResearchItem({
          researchItemId: item.researchItemId,
          applicationId: application.applicationId,
          scope: values.scope,
          category: values.category,
          ...(title ? { title } : {}),
          content: values.content,
          ...(sourceUrls.length > 0 ? { sourceUrls } : {}),
          isPinned: values.isPinned,
        });
        reset(values);
        onClose();
        onSaved('已保存修改');
        return;
      }

      await createResearchItem({
        applicationId: application.applicationId,
        scope: values.scope,
        category: values.category,
        ...(title ? { title } : {}),
        content: values.content,
        ...(sourceUrls.length > 0 ? { sourceUrls } : {}),
        isPinned: values.isPinned,
      });
      reset(values);
      onClose();
      onSaved('已添加企业研究');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setErrorMessage(
        message.includes('来源链接格式不正确')
          ? '来源链接格式不正确'
          : message.includes('请输入研究内容')
            ? '请输入研究内容'
            : '保存失败，请重试',
      );
    }
  }

  return (
    <>
      <ResponsiveOverlay
        dismissOnEscape={!discardOpen}
        mobileNearFullscreen
        onClose={requestClose}
        open={open}
        title={item ? '编辑企业研究' : '添加企业研究'}
        width={740}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          <YStack gap="$lg">
            <FormSection label="适用范围 *">
              <Controller
                control={control}
                name="scope"
                render={({ field }) => (
                  <YStack gap="$sm">
                    <ScopeOption
                      label={`${application.companyName} 共通`}
                      selected={field.value === 'company'}
                      onPress={() => field.onChange('company')}
                    />
                    <ScopeOption
                      label={`仅 ${application.companyName} + ${application.jobTitle}`}
                      selected={field.value === 'application'}
                      onPress={() => field.onChange('application')}
                    />
                  </YStack>
                )}
              />
              {item && !item.applicationId && selectedScope === 'application' ? (
                <Text color="$warningStrong" fontSize={13} lineHeight={20}>
                  修改后，这条研究将不再显示在 {application.companyName} 的其他岗位中。
                </Text>
              ) : null}
            </FormSection>

            <FormSection label="分类 *">
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <XStack flexWrap="wrap" gap="$sm">
                    {researchCategoryOptions.map((option) => (
                      <CategoryOption
                        key={option.value}
                        label={option.label}
                        selected={field.value === option.value}
                        onPress={() => field.onChange(option.value)}
                      />
                    ))}
                  </XStack>
                )}
              />
            </FormSection>

            <FormSection label="标题（可选）">
              <Controller
                control={control}
                name="title"
                render={({ field }) => (
                  <AppInput
                    placeholder="例如：PlayStation 海外业务"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                  />
                )}
              />
            </FormSection>

            <FormSection label="内容 *">
              <XStack flexWrap="wrap" gap="$xs">
                <FormatButton icon={<Bold size={16} />} label="加粗" onPress={() => applyFormat('bold')} />
                <FormatButton icon={<List size={16} />} label="无序列表" onPress={() => applyFormat('unordered-list')} />
                <FormatButton icon={<ListOrdered size={16} />} label="有序列表" onPress={() => applyFormat('ordered-list')} />
                <FormatButton icon={<Link2 size={16} />} label="链接" onPress={() => applyFormat('link')} />
              </XStack>
              <Controller
                control={control}
                name="content"
                render={({ field }) => (
                  <TextArea
                    ref={editorRef}
                    minH={220}
                    color="$text"
                    placeholder="记录业务、企业文化或志望动机素材..."
                    placeholderTextColor="$textMuted"
                    selection={editorSelection}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    onSelectionChange={(event) => setEditorSelection(event.nativeEvent.selection)}
                    style={{ borderRadius: 12 }}
                  />
                )}
              />
              {errors.content ? <Text color="$danger">{errors.content.message}</Text> : null}
            </FormSection>

            <FormSection label="来源">
              <YStack gap="$sm">
                {fields.map((field, index) => (
                  <YStack key={field.id} gap="$xs">
                    <XStack gap="$sm" style={{ alignItems: 'center' }}>
                      <Controller
                        control={control}
                        name={`sourceUrls.${index}.value`}
                        render={({ field: sourceField }) => (
                          <AppInput
                            flex={1}
                            inputMode="url"
                            placeholder="https://..."
                            value={sourceField.value}
                            onBlur={sourceField.onBlur}
                            onChangeText={sourceField.onChange}
                          />
                        )}
                      />
                      <AppButton
                        aria-label="移除来源"
                        variant="ghost"
                        icon={<X size={18} />}
                        onPress={() => remove(index)}
                      />
                    </XStack>
                    {errors.sourceUrls?.[index]?.value ? (
                      <Text color="$danger" fontSize={13}>
                        {errors.sourceUrls[index]?.value?.message}
                      </Text>
                    ) : null}
                  </YStack>
                ))}
                <AppButton
                  variant="ghost"
                  icon={<Plus size={17} />}
                  onPress={() => append({ value: '' })}
                  style={{ alignSelf: 'flex-start' }}
                >
                  添加来源
                </AppButton>
              </YStack>
            </FormSection>

            <Controller
              control={control}
              name="isPinned"
              render={({ field }) => (
                <XStack gap="$base" minH={44} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <YStack flex={1} gap="$xs">
                    <Text color="$text" fontWeight="600">
                      置顶这条研究
                    </Text>
                    <Text color="$textMuted" fontSize={13}>
                      置顶内容会优先显示。
                    </Text>
                  </YStack>
                  <Switch
                    activeStyle={{ backgroundColor: '$accentStrong' }}
                    backgroundColor="$surfaceMuted"
                    borderColor="$border"
                    borderWidth={1}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    size="$3"
                  >
                    <Switch.Thumb backgroundColor="$surface" borderColor="$border" borderWidth={1} size="$3" />
                  </Switch>
                </XStack>
              )}
            />

            {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}

            <XStack gap="$sm" pb="$sm" style={{ justifyContent: 'flex-end' }}>
              <AppButton variant="secondary" disabled={isSubmitting} onPress={requestClose}>
                取消
              </AppButton>
              <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
                {isSubmitting ? '保存中...' : item ? '保存' : '添加'}
              </AppButton>
            </XStack>
          </YStack>
        </ScrollView>
      </ResponsiveOverlay>

      <ResponsiveOverlay
        onClose={() => setDiscardOpen(false)}
        open={discardOpen}
        title="放弃未保存的修改？"
      >
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>
            当前输入尚未保存，放弃后无法恢复。
          </Text>
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" onPress={() => setDiscardOpen(false)}>
              继续编辑
            </AppButton>
            <AppButton
              variant="danger"
              onPress={() => {
                setDiscardOpen(false);
                reset(initialValues);
                onClose();
              }}
            >
              放弃
            </AppButton>
          </XStack>
        </YStack>
      </ResponsiveOverlay>
    </>
  );
}

function FormSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <YStack gap="$sm">
      <Text color="$text" fontWeight="600">
        {label}
      </Text>
      {children}
    </YStack>
  );
}

function ScopeOption({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <XStack
      bg={selected ? '$accentSoft' : '$surfaceMuted'}
      borderColor={selected ? '$accentStrong' : '$border'}
      borderWidth={1}
      cursor="pointer"
      gap="$sm"
      minH={44}
      onPress={onPress}
      px="$md"
      style={{ alignItems: 'center', borderRadius: 12 }}
    >
      <YStack
        bg={selected ? '$accentStrong' : '$surface'}
        borderColor={selected ? '$accentStrong' : '$border'}
        borderWidth={1}
        height={18}
        width={18}
        style={{ borderRadius: 9999 }}
      />
      <Text color={selected ? '$accentStrong' : '$text'} fontWeight="600">
        {label}
      </Text>
    </XStack>
  );
}

function CategoryOption({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <XStack
      bg={selected ? '$accentSoft' : '$surfaceMuted'}
      borderColor={selected ? '$accentStrong' : '$border'}
      borderWidth={1}
      cursor="pointer"
      minH={40}
      onPress={onPress}
      px="$md"
      py="$xs"
      style={{ alignItems: 'center', borderRadius: 9999 }}
    >
      <Text color={selected ? '$accentStrong' : '$textSecondary'} fontSize={13} fontWeight="600">
        {label}
      </Text>
    </XStack>
  );
}

function FormatButton({ icon, label, onPress }: { icon: ReactElement; label: string; onPress: () => void }) {
  return (
    <AppButton variant="secondary" icon={icon} onPress={onPress}>
      {label}
    </AppButton>
  );
}

function formatContent(
  content: string,
  selection: EditorSelection,
  format: ContentFormat,
): { content: string; selection: EditorSelection } {
  const start = Math.min(selection.start, content.length);
  const end = Math.min(Math.max(selection.end, start), content.length);
  const selectedText = content.slice(start, end);

  if (format === 'bold') {
    const label = selectedText || '加粗文字';
    const replacement = `**${label}**`;
    return replaceSelection(content, start, end, replacement, start + 2, start + 2 + label.length);
  }

  if (format === 'link') {
    const label = selectedText || '链接文字';
    const replacement = `[${label}](https://example.com)`;
    const urlStart = start + label.length + 3;
    return replaceSelection(content, start, end, replacement, urlStart, urlStart + 19);
  }

  const prefix = format === 'ordered-list' ? '1. ' : '- ';

  if (!selectedText) {
    const replacement = `${prefix}列表项`;
    return replaceSelection(
      content,
      start,
      end,
      replacement,
      start + prefix.length,
      start + replacement.length,
    );
  }

  const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const followingBreak = content.indexOf('\n', end);
  const lineEnd = followingBreak === -1 ? content.length : followingBreak;
  const replacement = content
    .slice(lineStart, lineEnd)
    .split('\n')
    .map((line, index) => `${format === 'ordered-list' ? `${index + 1}. ` : '- '}${line}`)
    .join('\n');

  return replaceSelection(
    content,
    lineStart,
    lineEnd,
    replacement,
    lineStart,
    lineStart + replacement.length,
  );
}

function replaceSelection(
  content: string,
  start: number,
  end: number,
  replacement: string,
  selectionStart: number,
  selectionEnd: number,
) {
  return {
    content: `${content.slice(0, start)}${replacement}${content.slice(end)}`,
    selection: { start: selectionStart, end: selectionEnd },
  };
}
