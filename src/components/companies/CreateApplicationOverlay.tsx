import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { useRouter, Href } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';

import { normalizeSearch } from './filtering';
import { ResponsiveOverlay } from './ResponsiveOverlay';

const createApplicationSchema = z.object({
  companyName: z.string().trim().min(1, '企业名称不能为空'),
  jobTitle: z.string().trim().min(1, '应聘岗位不能为空'),
});

type CreateApplicationForm = z.infer<typeof createApplicationSchema>;

type CreateApplicationOverlayProps = {
  onClose: () => void;
  open: boolean;
};

export function CreateApplicationOverlay({ onClose, open }: CreateApplicationOverlayProps) {
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
      const applicationId = await createApplication({
        company: selectedCompanyId
          ? { kind: 'existing', companyId: selectedCompanyId }
          : { kind: 'new', name: values.companyName },
        jobTitle: values.jobTitle,
      });

      reset();
      setSelectedCompanyId(null);
      onClose();
      router.push(`/applications/${applicationId}` as Href);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setError('root', {
        message: message.includes('相同岗位') ? '该企业下已存在相同岗位的应聘记录' : '添加失败，请重试',
      });
    }
  }

  function close() {
    reset();
    setSelectedCompanyId(null);
    onClose();
  }

  return (
    <ResponsiveOverlay open={open} onClose={close} title="添加企业">
      <YStack gap="$base">
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            企业名称 *
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
          {errors.companyName ? <Text color="$danger">{errors.companyName.message}</Text> : null}
        </YStack>

        {matchedCompanies.length > 0 ? (
          <YStack gap="$xs">
            <Text color="$textMuted" fontSize={13}>
              已有企业
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
                  {selected ? <Text color="$accentStrong">已选择</Text> : null}
                </XStack>
              );
            })}
          </YStack>
        ) : normalizedCompanyName ? (
          <Text color="$textMuted" fontSize={13}>
            “{companyName.trim()}” 将作为新企业创建
          </Text>
        ) : null}

        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            应聘岗位 *
          </Text>
          <Controller
            control={control}
            name="jobTitle"
            render={({ field }) => (
              <AppInput
                placeholder="软件工程师"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
              />
            )}
          />
          {errors.jobTitle ? <Text color="$danger">{errors.jobTitle.message}</Text> : null}
        </YStack>

        {errors.root?.message ? <Text color="$danger">{errors.root.message}</Text> : null}

        <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton variant="secondary" disabled={isSubmitting} onPress={close}>
            取消
          </AppButton>
          <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
            {isSubmitting ? '添加中...' : '添加'}
          </AppButton>
        </XStack>
      </YStack>
    </ResponsiveOverlay>
  );
}
