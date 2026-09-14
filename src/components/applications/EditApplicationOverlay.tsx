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
  }, 'URL_INVALID');

const editApplicationSchema = z.object({
  jobTitle: z.string().trim().min(1, 'JOB_TITLE_REQUIRED'),
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
  const { t } = useTranslation(['companies', 'common']);
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
      const message = error instanceof Error ? error.message : '';
      setError('root', {
        message: message.includes('APPLICATION_DUPLICATE') ? t('companies:form.duplicateApplication') : t('common:errors.save'),
      });
    }
  }

  return (
    <ResponsiveOverlay open={open} onClose={onClose} title={t('companies:form.editApplication')}>
      <YStack gap="$base">
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            {t('companies:form.jobTitle')} *
          </Text>
          <Controller
            control={control}
            name="jobTitle"
            render={({ field }) => (
              <AppInput value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
            )}
          />
          {errors.jobTitle ? <Text color="$danger">{t('companies:form.jobRequired')}</Text> : null}
        </YStack>

        <Controller
          control={control}
          name="preferenceLevel"
          render={({ field }) => (
            <YStack gap="$sm">
              <Text color="$text" fontWeight="600">
                {t('companies:detail.preference')}
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

        <ApplicationTextField control={control} errors={errors} name="location" label={t('companies:detail.location')} invalidUrlMessage={t('companies:form.invalidUrl')} />
        <ApplicationTextField control={control} errors={errors} name="applicationUrl" label={t('companies:detail.jobPage')} invalidUrlMessage={t('companies:form.invalidUrl')} />
        <ApplicationTextField control={control} errors={errors} name="mypageUrl" label={t('companies:form.mypage')} invalidUrlMessage={t('companies:form.invalidUrl')} />
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            {t('companies:detail.memo')}
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

function ApplicationTextField({
  control,
  errors,
  label,
  name,
  invalidUrlMessage,
}: {
  control: ReturnType<typeof useForm<EditApplicationForm>>['control'];
  errors: ReturnType<typeof useForm<EditApplicationForm>>['formState']['errors'];
  label: string;
  name: 'location' | 'applicationUrl' | 'mypageUrl';
  invalidUrlMessage: string;
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
      {errors[name] ? <Text color="$danger">{invalidUrlMessage}</Text> : null}
    </YStack>
  );
}
