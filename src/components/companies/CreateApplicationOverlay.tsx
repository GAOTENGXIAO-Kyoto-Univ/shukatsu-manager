import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { useRouter, Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { analytics } from '@/lib/analytics';

import { normalizeSearch } from './filtering';
import { ResponsiveOverlay } from './ResponsiveOverlay';

const createApplicationSchema = z.object({
  companyName: z.string().trim().min(1, 'COMPANY_NAME_REQUIRED'),
  jobTitle: z.string().trim().min(1, 'JOB_TITLE_REQUIRED'),
});

type CreateApplicationForm = z.infer<typeof createApplicationSchema>;

type CreateApplicationOverlayProps = {
  onClose: () => void;
  open: boolean;
};

export function CreateApplicationOverlay({ onClose, open }: CreateApplicationOverlayProps) {
  const { t } = useTranslation(['companies', 'common']);
  const router = useRouter();
  const companies = useQuery(api.companies.listForPicker, {}) ?? [];
  const createApplication = useMutation(api.applications.create);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm<CreateApplicationForm>({
    defaultValues: {
      companyName: '',
      jobTitle: '',
    },
    resolver: zodResolver(createApplicationSchema),
  });
  const companyName = useWatch({ control, name: 'companyName' }) ?? '';
  const [selectedCompanyId, setSelectedCompanyId] = useState<Id<'companies'> | null>(null);

  const normalizedCompanyName = normalizeSearch(companyName);
  const matchedCompanies = normalizedCompanyName
    ? companies.filter((company) => normalizeSearch(company.name).includes(normalizedCompanyName))
    : [];

  const selectedCompany = selectedCompanyId
    ? companies.find((company) => company.companyId === selectedCompanyId)
    : null;

  async function submit(values: CreateApplicationForm) {
    try {
      const result = await createApplication({
        company: selectedCompanyId
          ? { kind: 'existing', companyId: selectedCompanyId }
          : { kind: 'new', name: values.companyName },
        jobTitle: values.jobTitle,
      });
      analytics.applicationCreated({ company_reused: result.companyReused });

      reset();
      setSelectedCompanyId(null);
      onClose();
      router.push(`/applications/${result.applicationId}` as Href);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setError('root', {
        message: message.includes('APPLICATION_DUPLICATE') ? t('companies:form.duplicateApplication') : t('common:errors.save'),
      });
    }
  }

  function close() {
    reset();
    setSelectedCompanyId(null);
    onClose();
  }

  return (
    <ResponsiveOverlay open={open} onClose={close} title={t('companies:form.addCompany')}>
      <YStack gap="$base">
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            {t('companies:form.companyName')} *
          </Text>
          <Controller
            control={control}
            name="companyName"
            render={({ field }) => (
              <AppInput
                autoFocus
                placeholder="Sony"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={(value) => {
                  field.onChange(value);
                  if (selectedCompanyId && selectedCompany?.name !== value) {
                    setSelectedCompanyId(null);
                  }
                }}
              />
            )}
          />
          {errors.companyName ? <Text color="$danger">{t('companies:form.companyRequired')}</Text> : null}
        </YStack>

        {matchedCompanies.length > 0 ? (
          <YStack gap="$xs">
            <Text color="$textMuted" fontSize={13}>
              {t('companies:form.existingCompanies')}
            </Text>
            {matchedCompanies.slice(0, 5).map((company) => {
              const selected = company.companyId === selectedCompanyId;

              return (
                <XStack
                  key={company.companyId}
                  bg={selected ? '$accentSoft' : '$surfaceMuted'}
                  cursor="pointer"
                  onPress={() => {
                    setSelectedCompanyId(company.companyId);
                    setValue('companyName', company.name, { shouldValidate: true });
                  }}
                  p="$md"
                  style={{
                    alignItems: 'center',
                    borderRadius: 12,
                    justifyContent: 'space-between',
                  }}
                >
                  <Text color="$text">{company.name}</Text>
                  {selected ? <Text color="$accentStrong">{t('companies:form.selected')}</Text> : null}
                </XStack>
              );
            })}
          </YStack>
        ) : normalizedCompanyName ? (
          <Text color="$textMuted" fontSize={13}>
            {t('companies:form.createNew', { name: companyName.trim() })}
          </Text>
        ) : null}

        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            {t('companies:form.jobTitle')} *
          </Text>
          <Controller
            control={control}
            name="jobTitle"
            render={({ field }) => (
              <AppInput
                placeholder={t('companies:form.jobPlaceholder')}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
              />
            )}
          />
          {errors.jobTitle ? <Text color="$danger">{t('companies:form.jobRequired')}</Text> : null}
        </YStack>

        {errors.root?.message ? <Text color="$danger">{errors.root.message}</Text> : null}

        <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton variant="secondary" disabled={isSubmitting} onPress={close}>
            {t('common:actions.cancel')}
          </AppButton>
          <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
            {isSubmitting ? t('common:states.adding') : t('common:actions.add')}
          </AppButton>
        </XStack>
      </YStack>
    </ResponsiveOverlay>
  );
}
