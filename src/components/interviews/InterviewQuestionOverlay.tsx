import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Text, TextArea, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { analytics } from '@/lib/analytics';
import type { InterviewEvaluation, InterviewQuestionData } from './types';

const questionSchema = z.object({
  question: z.string().trim().min(1, 'QUESTION_REQUIRED'),
  answer: z.string(),
  evaluation: z.enum(['', 'good', 'neutral', 'poor']),
  note: z.string(),
});

type QuestionFormValues = z.infer<typeof questionSchema>;

type InterviewQuestionOverlayProps = {
  item: InterviewQuestionData | null;
  onClose: () => void;
  open: boolean;
  selectionStepId: Id<'selectionSteps'>;
};

const evaluationOptions: ('' | InterviewEvaluation)[] = ['', 'good', 'neutral', 'poor'];

export function InterviewQuestionOverlay({
  item,
  onClose,
  open,
  selectionStepId,
}: InterviewQuestionOverlayProps) {
  const { t } = useTranslation(['interview', 'common']);
  const createQuestion = useMutation(api.interviewQuestions.create);
  const updateQuestion = useMutation(api.interviewQuestions.update);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<QuestionFormValues>({
    values: {
      question: item?.question ?? '',
      answer: item?.answer ?? '',
      evaluation: item?.evaluation ?? '',
      note: item?.note ?? '',
    },
    resolver: zodResolver(questionSchema),
  });

  async function submit(values: QuestionFormValues) {
    const fields = {
      question: values.question,
      answer: values.answer || null,
      evaluation: values.evaluation || null,
      note: values.note || null,
    };

    try {
      if (item) {
        await updateQuestion({ interviewQuestionId: item.interviewQuestionId, ...fields });
      } else {
        await createQuestion({ selectionStepId, ...fields });
        analytics.interviewQuestionCreated({
          has_answer: Boolean(values.answer.trim()),
          evaluation: values.evaluation || 'unset',
        });
        analytics.knowledgeItemCreated({
          category: 'qa',
          creation_source: 'interview_auto_deposit',
        });
      }
      onClose();
    } catch {
      setError('root', { message: t('common:errors.save') });
    }
  }

  return (
    <ResponsiveOverlay mobileNearFullscreen onClose={onClose} open={open} title={item ? t('interview:editQuestion') : t('interview:addQuestion')} width={680}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$lg" pb="$sm">
          <FormField label={`${t('interview:question')} *`}>
            <Controller
              control={control}
              name="question"
              render={({ field }) => (
                <TextArea minH={96} color="$text" placeholder={t('interview:placeholders.question')} placeholderTextColor="$textMuted" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
            {errors.question ? <Text color="$danger">{t('interview:questionRequired')}</Text> : null}
          </FormField>
          <FormField label={t('interview:myAnswer')}>
            <Controller
              control={control}
              name="answer"
              render={({ field }) => (
                <TextArea minH={150} color="$text" placeholder={t('interview:placeholders.answer')} placeholderTextColor="$textMuted" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
          </FormField>
          <FormField label={t('interview:performance')}>
            <Controller
              control={control}
              name="evaluation"
              render={({ field }) => (
                <XStack flexWrap="wrap" gap="$sm">
                  {evaluationOptions.map((option) => (
                    <EvaluationChoice key={option || 'unset'} label={t(`interview:evaluations.${option || 'unset'}`)} selected={field.value === option} onPress={() => field.onChange(option)} />
                  ))}
                </XStack>
              )}
            />
          </FormField>
          <FormField label={t('interview:note')}>
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <TextArea minH={120} color="$text" placeholder={t('interview:placeholders.note')} placeholderTextColor="$textMuted" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
          </FormField>
          {errors.root?.message ? <Text color="$danger">{errors.root.message}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={isSubmitting} onPress={onClose}>{t('common:actions.cancel')}</AppButton>
            <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
              {isSubmitting ? (item ? t('common:states.saving') : t('common:states.adding')) : item ? t('common:actions.save') : t('common:actions.add')}
            </AppButton>
          </XStack>
        </YStack>
      </ScrollView>
    </ResponsiveOverlay>
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

function EvaluationChoice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <XStack bg={selected ? '$accentSoft' : '$surfaceMuted'} borderColor={selected ? '$accentStrong' : '$border'} borderWidth={1} cursor="pointer" minH={40} onPress={onPress} px="$md" py="$xs" style={{ alignItems: 'center', borderRadius: 9999 }}>
      <Text color={selected ? '$accentStrong' : '$textSecondary'} fontSize={13} fontWeight="600">{label}</Text>
    </XStack>
  );
}
