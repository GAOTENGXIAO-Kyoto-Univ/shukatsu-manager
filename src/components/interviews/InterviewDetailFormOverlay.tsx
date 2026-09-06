import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { Text, TextArea, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { analytics } from '@/lib/analytics';
import type { InterviewDetailData, InterviewFormat } from './types';

const positiveIntegerText = z.string().refine(
  (value) => !value.trim() || /^[1-9]\d*$/.test(value.trim()),
  '请输入正整数',
);

const infoSchema = z.object({
  interviewFormat: z.enum(['', 'online', 'offline', 'phone', 'other']),
  interviewerCount: positiveIntegerText,
  durationMinutes: positiveIntegerText,
  interviewerInfo: z.string(),
});

const reviewSchema = z.object({
  goodPoints: z.string(),
  improvementPoints: z.string(),
  nextImprovement: z.string(),
  overallNote: z.string(),
});

type InfoFormValues = z.infer<typeof infoSchema>;
type ReviewFormValues = z.infer<typeof reviewSchema>;
type InterviewDetailFormMode = 'info' | 'review';

type InterviewDetailFormOverlayProps = {
  detail: InterviewDetailData | null;
  hasQuestions: boolean;
  mode: InterviewDetailFormMode | null;
  onClose: () => void;
  selectionStepId: Id<'selectionSteps'>;
};

const formatOptions: { label: string; value: InterviewFormat }[] = [
  { label: '线上', value: 'online' },
  { label: '线下', value: 'offline' },
  { label: '电话', value: 'phone' },
  { label: '其他', value: 'other' },
];

export function InterviewDetailFormOverlay({
  detail,
  hasQuestions,
  mode,
  onClose,
  selectionStepId,
}: InterviewDetailFormOverlayProps) {
  return mode === 'info' ? (
    <InterviewInfoForm detail={detail} onClose={onClose} open selectionStepId={selectionStepId} />
  ) : (
    <InterviewReviewForm
      detail={detail}
      hasQuestions={hasQuestions}
      onClose={onClose}
      open={mode === 'review'}
      selectionStepId={selectionStepId}
    />
  );
}

function InterviewInfoForm({
  detail,
  onClose,
  open,
  selectionStepId,
}: Omit<InterviewDetailFormOverlayProps, 'hasQuestions' | 'mode'> & { open: boolean }) {
  const createInterview = useMutation(api.interviews.create);
  const updateInterview = useMutation(api.interviews.update);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<InfoFormValues>({
    values: {
      interviewFormat: detail?.interviewFormat ?? '',
      interviewerCount: detail?.interviewerCount?.toString() ?? '',
      durationMinutes: detail?.durationMinutes?.toString() ?? '',
      interviewerInfo: detail?.interviewerInfo ?? '',
    },
    resolver: zodResolver(infoSchema),
  });

  async function submit(values: InfoFormValues) {
    const hasContent = Object.values(values).some((value) => value.trim());

    if (!detail && !hasContent) {
      setError('root', { message: '请至少填写一项面试信息' });
      return;
    }

    const fields = {
      interviewFormat: values.interviewFormat || null,
      interviewerCount: values.interviewerCount ? Number(values.interviewerCount) : null,
      durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
      interviewerInfo: values.interviewerInfo || null,
    };

    try {
      if (detail) {
        await updateInterview({ interviewDetailId: detail.interviewDetailId, ...fields });
      } else {
        await createInterview({ selectionStepId, ...fields });
      }
      onClose();
    } catch {
      setError('root', { message: '保存失败，请重试' });
    }
  }

  return (
    <ResponsiveOverlay mobileNearFullscreen onClose={onClose} open={open} title={detail ? '编辑面试信息' : '添加面试信息'} width={560}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$lg" pb="$sm">
          <FormField label="面试方式">
            <Controller
              control={control}
              name="interviewFormat"
              render={({ field }) => (
                <XStack flexWrap="wrap" gap="$sm">
                  <Choice label="未设置" selected={!field.value} onPress={() => field.onChange('')} />
                  {formatOptions.map((option) => (
                    <Choice
                      key={option.value}
                      label={option.label}
                      selected={field.value === option.value}
                      onPress={() => field.onChange(option.value)}
                    />
                  ))}
                </XStack>
              )}
            />
          </FormField>
          <FormField label="面试官人数">
            <Controller
              control={control}
              name="interviewerCount"
              render={({ field }) => (
                <AppInput inputMode="numeric" placeholder="例如：2" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
              )}
            />
            {errors.interviewerCount ? <Text color="$danger">{errors.interviewerCount.message}</Text> : null}
          </FormField>
          <FormField label="实际时长（分钟）">
            <Controller
              control={control}
              name="durationMinutes"
              render={({ field }) => (
                <AppInput inputMode="numeric" placeholder="例如：45" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
              )}
            />
            {errors.durationMinutes ? <Text color="$danger">{errors.durationMinutes.message}</Text> : null}
          </FormField>
          <FormField label="面试官信息">
            <Controller
              control={control}
              name="interviewerInfo"
              render={({ field }) => (
                <TextArea minH={120} color="$text" placeholder="姓名、职位、部门或人员构成等" placeholderTextColor="$textMuted" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
          </FormField>
          <FormActions error={errors.root?.message} isSubmitting={isSubmitting} onCancel={onClose} onSubmit={handleSubmit(submit)} />
        </YStack>
      </ScrollView>
    </ResponsiveOverlay>
  );
}

function InterviewReviewForm({
  detail,
  hasQuestions,
  onClose,
  open,
  selectionStepId,
}: Omit<InterviewDetailFormOverlayProps, 'mode'> & { open: boolean }) {
  const createInterview = useMutation(api.interviews.create);
  const updateInterview = useMutation(api.interviews.update);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<ReviewFormValues>({
    values: {
      goodPoints: detail?.goodPoints ?? '',
      improvementPoints: detail?.improvementPoints ?? '',
      nextImprovement: detail?.nextImprovement ?? '',
      overallNote: detail?.overallNote ?? '',
    },
    resolver: zodResolver(reviewSchema),
  });

  async function submit(values: ReviewFormValues) {
    const hasContent = Object.values(values).some((value) => value.trim());

    if (!detail && !hasContent) {
      setError('root', { message: '请至少填写一项复盘内容' });
      return;
    }

    const fields = {
      goodPoints: values.goodPoints || null,
      improvementPoints: values.improvementPoints || null,
      nextImprovement: values.nextImprovement || null,
      overallNote: values.overallNote || null,
    };

    try {
      const result = detail
        ? await updateInterview({ interviewDetailId: detail.interviewDetailId, ...fields })
        : await createInterview({ selectionStepId, ...fields });
      if (result.becameMeaningfulReview) {
        analytics.interviewReviewSaved({
          has_questions: hasQuestions,
          has_improvement_points: Boolean(values.improvementPoints.trim()),
        });
      }
      onClose();
    } catch {
      setError('root', { message: '保存失败，请重试' });
    }
  }

  return (
    <ResponsiveOverlay mobileNearFullscreen onClose={onClose} open={open} title={detail ? '编辑面试复盘' : '开始复盘'} width={680}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$lg" pb="$sm">
          <LongTextField control={control} label="表现好的地方" name="goodPoints" placeholder="记录这次回答或沟通中做得好的部分" />
          <LongTextField control={control} label="需要改进的地方" name="improvementPoints" placeholder="记录这次暴露出的不足" />
          <LongTextField control={control} label="下次改进事项" name="nextImprovement" placeholder="写下下一次可以采取的具体行动" />
          <LongTextField control={control} label="其他复盘" name="overallNote" placeholder="补充其他与本次面试有关的复盘" />
          <FormActions error={errors.root?.message} isSubmitting={isSubmitting} onCancel={onClose} onSubmit={handleSubmit(submit)} />
        </YStack>
      </ScrollView>
    </ResponsiveOverlay>
  );
}

function LongTextField({
  control,
  label,
  name,
  placeholder,
}: {
  control: ReturnType<typeof useForm<ReviewFormValues>>['control'];
  label: string;
  name: keyof ReviewFormValues;
  placeholder: string;
}) {
  return (
    <FormField label={label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TextArea minH={128} color="$text" placeholder={placeholder} placeholderTextColor="$textMuted" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
        )}
      />
    </FormField>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <YStack gap="$sm">
      <Text color="$text" fontWeight="600">{label}</Text>
      {children}
    </YStack>
  );
}

function Choice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <XStack bg={selected ? '$accentSoft' : '$surfaceMuted'} borderColor={selected ? '$accentStrong' : '$border'} borderWidth={1} cursor="pointer" minH={40} onPress={onPress} px="$md" py="$xs" style={{ alignItems: 'center', borderRadius: 9999 }}>
      <Text color={selected ? '$accentStrong' : '$textSecondary'} fontSize={13} fontWeight="600">{label}</Text>
    </XStack>
  );
}

function FormActions({
  error,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  error?: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <YStack gap="$sm">
      {error ? <Text color="$danger">{error}</Text> : null}
      <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
        <AppButton variant="secondary" disabled={isSubmitting} onPress={onCancel}>取消</AppButton>
        <AppButton variant="primary" disabled={isSubmitting} onPress={onSubmit}>{isSubmitting ? '保存中...' : '保存'}</AppButton>
      </XStack>
    </YStack>
  );
}
