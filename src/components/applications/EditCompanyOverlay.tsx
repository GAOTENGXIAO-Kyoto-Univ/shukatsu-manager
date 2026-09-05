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
  }, '官网格式不正确');

const editCompanySchema = z.object({
  name: z.string().trim().min(1, '企业名称不能为空'),
  industry: z.string(),
  websiteUrl: optionalUrl,
});

type EditCompanyForm = z.infer<typeof editCompanySchema>;

type EditCompanyOverlayProps = {
  application: ApplicationDetailData;
  onClose: () => void;
  open: boolean;
};

export function EditCompanyOverlay({ application, onClose, open }: EditCompanyOverlayProps) {
  const updateCompany = useMutation(api.companies.update);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
  } = useForm<EditCompanyForm>({
    defaultValues: {
      name: application.company.name,
      industry: application.company.industry ?? '',
      websiteUrl: application.company.websiteUrl ?? '',
    },
    resolver: zodResolver(editCompanySchema),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      name: application.company.name,
      industry: application.company.industry ?? '',
      websiteUrl: application.company.websiteUrl ?? '',
    });
  }, [
    application.company.industry,
    application.company.name,
    application.company.websiteUrl,
    open,
    reset,
  ]);

  async function submit(values: EditCompanyForm) {
    try {
      await updateCompany({
        companyId: application.company.companyId,
        name: values.name,
        industry: values.industry,
        websiteUrl: values.websiteUrl,
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setError('root', {
        message: message.includes('已存在同名企业') ? '已存在同名企业' : '保存失败，请重试',
      });
    }
  }

  return (
    <ResponsiveOverlay open={open} onClose={onClose} title="编辑企业信息">
      <YStack gap="$base">
        <CompanyTextField control={control} errors={errors} name="name" label="企业名称 *" />
        <CompanyTextField control={control} errors={errors} name="industry" label="行业" />
        <CompanyTextField control={control} errors={errors} name="websiteUrl" label="官网" />
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

function CompanyTextField({
  control,
  errors,
  label,
  name,
}: {
  control: ReturnType<typeof useForm<EditCompanyForm>>['control'];
  errors: ReturnType<typeof useForm<EditCompanyForm>>['formState']['errors'];
  label: string;
  name: keyof EditCompanyForm;
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
