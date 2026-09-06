import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import type { EventDetail } from '@/components/applications/types';
import type { SelectionStepType } from '@/components/selection/selectionConstants';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { analytics } from '@/lib/analytics';
import { eventToFormValues } from './eventFormatting';

const eventFormSchema = z
  .object({
    timingType: z.enum(['scheduled', 'deadline']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '请选择日期'),
    time: z.string(),
    location: z.string(),
    meetingUrl: z.string(),
    note: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.timingType === 'scheduled' && !values.time) {
      ctx.addIssue({ code: 'custom', path: ['time'], message: '预定时间必须填写时间' });
    }

    if (values.meetingUrl.trim()) {
      try {
        const url = new URL(values.meetingUrl.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
      } catch {
        ctx.addIssue({ code: 'custom', path: ['meetingUrl'], message: '请输入有效的 http/https 链接' });
      }
    }
  });

type EventFormValues = z.infer<typeof eventFormSchema>;

const deadlineTypes: SelectionStepType[] = ['es', 'web_test'];

export function EventForm({
  event,
  onSaved,
  selectionStepId,
  stepType,
}: {
  event: EventDetail | null;
  onSaved: () => void;
  selectionStepId: EventDetail['selectionStepId'];
  stepType: SelectionStepType;
}) {
  const createEvent = useMutation(api.events.create);
  const updateEvent = useMutation(api.events.update);
  const [saveError, setSaveError] = useState<string | null>(null);
  const storedDateTime = event ? eventToFormValues(event) : null;
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<EventFormValues>({
    defaultValues: {
      timingType: event?.timingType ?? (deadlineTypes.includes(stepType) ? 'deadline' : 'scheduled'),
      date: storedDateTime?.date ?? '',
      time: storedDateTime?.time ?? '',
      location: event?.location ?? '',
      meetingUrl: event?.meetingUrl ?? '',
      note: event?.note ?? '',
    },
    resolver: zodResolver(eventFormSchema),
  });
  const timingType = useWatch({ control, name: 'timingType' });

  async function submit(values: EventFormValues) {
    setSaveError(null);
    const fields = {
      timingType: values.timingType,
      date: values.date,
      time: values.time || null,
      location: values.location || null,
      meetingUrl: values.meetingUrl || null,
      note: values.note || null,
    };

    try {
      if (event) {
        await updateEvent({ eventId: event.eventId, ...fields });
      } else {
        await createEvent({ selectionStepId, ...fields });
        analytics.eventCreated({
          event_kind: 'selection_step',
          timing_type: values.timingType,
          has_explicit_time: Boolean(values.time),
        });
      }
      onSaved();
    } catch {
      setSaveError('保存失败，请重试');
    }
  }

  return (
    <YStack gap="$base">
      <Controller
        control={control}
        name="timingType"
        render={({ field }) => (
          <YStack gap="$sm">
            <Text color="$text" fontWeight="600">类型 *</Text>
            <XStack gap="$sm">
              {[
                { value: 'scheduled' as const, label: '预定时间' },
                { value: 'deadline' as const, label: '截止日期' },
              ].map((option) => (
                <AppButton
                  key={option.value}
                  variant={field.value === option.value ? 'primary' : 'secondary'}
                  disabled={isSubmitting}
                  onPress={() => field.onChange(option.value)}
                >
                  {option.label}
                </AppButton>
              ))}
            </XStack>
          </YStack>
        )}
      />

      <Field label="日期 *" error={errors.date?.message}>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <AppInput type="date" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
          )}
        />
      </Field>
      <Field label={`时间${timingType === 'scheduled' ? ' *' : ''}`} error={errors.time?.message}>
        <Controller
          control={control}
          name="time"
          render={({ field }) => (
            <AppInput type="time" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
          )}
        />
      </Field>
      <Field label="地点" error={errors.location?.message}>
        <Controller control={control} name="location" render={({ field }) => <AppInput value={field.value} onChangeText={field.onChange} />} />
      </Field>
      <Field label="会议链接" error={errors.meetingUrl?.message}>
        <Controller
          control={control}
          name="meetingUrl"
          render={({ field }) => <AppInput autoCapitalize="none" inputMode="url" value={field.value} onChangeText={field.onChange} />}
        />
      </Field>
      <Field label="备注" error={errors.note?.message}>
        <Controller
          control={control}
          name="note"
          render={({ field }) => <AppInput multiline minH={88} value={field.value} onChangeText={field.onChange} />}
        />
      </Field>
      {saveError ? <Text color="$danger">{saveError}</Text> : null}
      <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
        {isSubmitting ? '保存中...' : event ? '保存' : '添加'}
      </AppButton>
    </YStack>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <YStack gap="$sm">
      <Text color="$text" fontWeight="600">{label}</Text>
      {children}
      {error ? <Text color="$danger" fontSize={13}>{error}</Text> : null}
    </YStack>
  );
}
