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
import type { InterviewEvaluation, InterviewQuestionData } from './types';

const questionSchema = z.object({
  question: z.string().trim().min(1, '问题不能为空'),
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

const evaluationOptions: { label: string; value: '' | InterviewEvaluation }[] = [
  { label: '未评价', value: '' },
  { label: '回答不错', value: 'good' },
  { label: '一般', value: 'neutral' },
  { label: '需要改进', value: 'poor' },
];

export function InterviewQuestionOverlay({
  item,
  onClose,
  open,
  selectionStepId,
}: InterviewQuestionOverlayProps) {
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
      }
      onClose();
    } catch {
      setError('root', { message: '保存失败，请重试' });
    }
  }

  return (
    <ResponsiveOverlay mobileNearFullscreen onClose={onClose} open={open} title={item ? '编辑问题' : '添加问题'} width={680}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$lg" pb="$sm">
          <FormField label="问题 *">
            <Controller
              control={control}
              name="question"
              render={({ field }) => (
                <TextArea minH={96} color="$text" placeholder="记录实际被问到的问题" placeholderTextColor="$textMuted" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
            {errors.question ? <Text color="$danger">{errors.question.message}</Text> : null}
          </FormField>
          <FormField label="我的回答">
            <Controller
              control={control}
              name="answer"
              render={({ field }) => (
                <TextArea minH={150} color="$text" placeholder="记录自己当时的回答" placeholderTextColor="$textMuted" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
          </FormField>
          <FormField label="回答表现">
            <Controller
              control={control}
              name="evaluation"
              render={({ field }) => (
                <XStack flexWrap="wrap" gap="$sm">
                  {evaluationOptions.map((option) => (
                    <EvaluationChoice key={option.value || 'unset'} label={option.label} selected={field.value === option.value} onPress={() => field.onChange(option.value)} />
                  ))}
                </XStack>
              )}
            />
          </FormField>
          <FormField label="补充备注">
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <TextArea minH={120} color="$text" placeholder="面试官的后续追问、现场反应等" placeholderTextColor="$textMuted" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} style={{ borderRadius: 12 }} />
              )}
            />
          </FormField>
          {errors.root?.message ? <Text color="$danger">{errors.root.message}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" disabled={isSubmitting} onPress={onClose}>取消</AppButton>
            <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
              {isSubmitting ? (item ? '保存中...' : '添加中...') : item ? '保存' : '添加'}
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
