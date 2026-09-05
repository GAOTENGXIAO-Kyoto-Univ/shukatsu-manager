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
import type { ApplicationDetailData } from './types';

const optionalUrl = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) {
      return true;
    }

    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL 格式不正确');

const editApplicationSchema = z.object({
  jobTitle: z.string().trim().min(1, '应聘岗位不能为空'),
  preferenceLevel: z.number().int().min(1).max(5).nullable(),
  location: z.string(),
  applicationUrl: optionalUrl,
  mypageUrl: optionalUrl,
  memo: z.string(),
});

type EditApplicationForm = z.infer<typeof editApplicationSchema>;

type EditApplicationOverlayProps = {
  application: ApplicationDetailData;
  onClose: () => void;
  open: boolean;
};

export function EditApplicationOverlay({ application, onClose, open }: EditApplicationOverlayProps) {
  const updateApplication = useMutation(api.applications.update);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
  } = useForm<EditApplicationForm>({
    defaultValues: {
      jobTitle: application.jobTitle,
      preferenceLevel: application.preferenceLevel ?? null,
      location: application.location ?? '',
      applicationUrl: application.applicationUrl ?? '',
      mypageUrl: application.mypageUrl ?? '',
      memo: application.memo ?? '',
    },
    resolver: zodResolver(editApplicationSchema),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      jobTitle: application.jobTitle,
      preferenceLevel: application.preferenceLevel ?? null,
      location: application.location ?? '',
      applicationUrl: application.applicationUrl ?? '',
      mypageUrl: application.mypageUrl ?? '',
      memo: application.memo ?? '',
    });
  }, [
    application.applicationUrl,
    application.jobTitle,
    application.location,
    application.memo,
    application.mypageUrl,
    application.preferenceLevel,
    open,
    reset,
  ]);

  async function submit(values: EditApplicationForm) {
    try {
      await updateApplication({
        applicationId: application.applicationId,
        jobTitle: values.jobTitle,
        preferenceLevel: values.preferenceLevel,
        location: values.location,
        applicationUrl: values.applicationUrl,
        mypageUrl: values.mypageUrl,
        memo: values.memo,
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请重试';
      setError('root', {
        message: message.includes('相同岗位') ? '该企业下已存在相同岗位的应聘记录' : message,
      });
    }
  }

  return (
    <ResponsiveOverlay open={open} onClose={onClose} title="编辑应聘信息">
      <YStack gap="$base">
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            应聘岗位 *
          </Text>
          <Controller
            control={control}
            name="jobTitle"
            render={({ field }) => (
              <AppInput value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
            )}
          />
          {errors.jobTitle ? <Text color="$danger">{errors.jobTitle.message}</Text> : null}
        </YStack>

        <Controller
          control={control}
          name="preferenceLevel"
          render={({ field }) => (
            <YStack gap="$sm">
              <Text color="$text" fontWeight="600">
                志望度
              </Text>
              <XStack gap="$xs" flexWrap="wrap">
                {[1, 2, 3, 4, 5].map((level) => (
                  <AppButton
                    key={level}
                    variant={field.value === level ? 'primary' : 'secondary'}
                    onPress={() => field.onChange(field.value === level ? null : level)}
                  >
                    {level}
                  </AppButton>
                ))}
              </XStack>
            </YStack>
          )}
        />

        <ApplicationTextField control={control} errors={errors} name="location" label="工作地点" />
        <ApplicationTextField control={control} errors={errors} name="applicationUrl" label="招聘职位页面" />
        <ApplicationTextField control={control} errors={errors} name="mypageUrl" label="MyPage 链接" />
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            备注
          </Text>
          <Controller
            control={control}
            name="memo"
            render={({ field }) => (
              <AppInput
                multiline
                numberOfLines={5}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                style={{ minHeight: 108 }}
              />
            )}
          />
        </YStack>

        {errors.root?.message ? <Text color="$danger">{errors.root.message}</Text> : null}

        <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton variant="secondary" disabled={isSubmitting} onPress={onClose}>
            取消
          </AppButton>
          <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
            {isSubmitting ? '保存中...' : '保存'}
          </AppButton>
        </XStack>
      </YStack>
    </ResponsiveOverlay>
  );
}

function ApplicationTextField({
  control,
  errors,
  label,
  name,
}: {
  control: ReturnType<typeof useForm<EditApplicationForm>>['control'];
  errors: ReturnType<typeof useForm<EditApplicationForm>>['formState']['errors'];
  label: string;
  name: 'location' | 'applicationUrl' | 'mypageUrl';
}) {
  return (
    <YStack gap="$sm">
      <Text color="$text" fontWeight="600">
        {label}
      </Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <AppInput value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
        )}
      />
      {errors[name] ? <Text color="$danger">{errors[name]?.message}</Text> : null}
    </YStack>
  );
}
