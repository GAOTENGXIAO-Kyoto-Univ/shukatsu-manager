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
  }, 'WEBSITE_URL_INVALID');

const editCompanySchema = z.object({
  name: z.string().trim().min(1, 'COMPANY_NAME_REQUIRED'),
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
  const { t } = useTranslation(['companies', 'common']);
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
        message: message.includes('COMPANY_DUPLICATE') ? t('companies:form.duplicateCompany') : t('common:errors.save'),
      });
    }
  }

  return (
    <ResponsiveOverlay open={open} onClose={onClose} title={t('companies:form.editCompany')}>
      <YStack gap="$base">
        <CompanyTextField control={control} errors={errors} name="name" label={`${t('companies:form.companyName')} *`} errorMessage={t('companies:form.companyRequired')} />
        <CompanyTextField control={control} errors={errors} name="industry" label={t('companies:industry')} errorMessage="" />
        <CompanyTextField control={control} errors={errors} name="websiteUrl" label={t('companies:detail.website')} errorMessage={t('companies:form.invalidUrl')} />
        {errors.root?.message ? <Text color="$danger">{errors.root.message}</Text> : null}
        <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton variant="secondary" disabled={isSubmitting} onPress={onClose}>
            {t('common:actions.cancel')}
          </AppButton>
          <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
            {isSubmitting ? t('common:states.saving') : t('common:actions.save')}
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
  errorMessage,
}: {
  control: ReturnType<typeof useForm<EditCompanyForm>>['control'];
  errors: ReturnType<typeof useForm<EditCompanyForm>>['formState']['errors'];
  label: string;
  name: keyof EditCompanyForm;
  errorMessage: string;
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
      {errors[name] ? <Text color="$danger">{errorMessage}</Text> : null}
    </YStack>
  );
}
