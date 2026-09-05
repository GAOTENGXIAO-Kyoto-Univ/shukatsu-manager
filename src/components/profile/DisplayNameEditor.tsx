import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';

const displayNameSchema = z.object({
  displayName: z.string().trim().max(50, '显示名称不能超过 50 个字符'),
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
      setError('root', { message: '保存失败，请重试' });
    }
  }

  return (
    <ResponsiveOverlay
      headerAction={null}
      onClose={requestClose}
      open={open}
      title="编辑显示名称"
      width={480}
    >
      <YStack gap="$lg">
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            显示名称
          </Text>
          <Controller
            control={control}
            name="displayName"
            render={({ field }) => (
              <AppInput
                aria-label="显示名称"
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
            最多 50 个字符，留空即可清除。
          </Text>
          {errors.displayName?.message ? (
            <Text color="$danger" fontSize={13}>
              {errors.displayName.message}
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
            取消
          </AppButton>
          <AppButton
            disabled={isSubmitting}
            variant="primary"
            onPress={handleSubmit(submit)}
          >
            {isSubmitting ? '保存中...' : '保存'}
          </AppButton>
        </XStack>
      </YStack>
    </ResponsiveOverlay>
  );
}
