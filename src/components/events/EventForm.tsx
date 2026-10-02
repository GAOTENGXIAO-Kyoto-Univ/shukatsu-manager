import { zodResolver } from '@hookform/resolvers/zod';
import { Clock3 } from '@tamagui/lucide-icons-2';
import { useMutation } from 'convex/react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
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
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATE_REQUIRED'),
    time: z.string(),
    location: z.string(),
    meetingUrl: z.string(),
    note: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.timingType === 'scheduled' && !values.time) {
      ctx.addIssue({ code: 'custom', path: ['time'], message: 'TIME_REQUIRED' });
    } else if (values.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values.time)) {
      ctx.addIssue({ code: 'custom', path: ['time'], message: 'TIME_INVALID' });
    }

    if (values.meetingUrl.trim()) {
      try {
        const url = new URL(values.meetingUrl.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
      } catch {
        ctx.addIssue({ code: 'custom', path: ['meetingUrl'], message: 'URL_INVALID' });
      }
    }
  });

type EventFormValues = z.infer<typeof eventFormSchema>;

const deadlineTypes: SelectionStepType[] = ['es', 'web_test'];
const timeOptionHeight = 40;
const timeOptionsViewportHeight = 224;
const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = (index % 4) * 15;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

function getClosestTimeOptionIndex(input: string) {
  const normalized = input.trim();

  if (!normalized) return null;

  if (/^\d{1,2}$/.test(normalized)) {
    const hour = Number(normalized);
    return hour <= 23 ? hour * 4 : null;
  }

  const timeMatch = /^(\d{1,2}):(\d{0,2})$/.exec(normalized);

  if (!timeMatch) return null;

  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;

  if (hour > 23 || minute > 59) return null;

  const closestIndex = Math.round((hour * 60 + minute) / 15);
  return Math.min(closestIndex, timeOptions.length - 1);
}

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
  const { t } = useTranslation(['calendar', 'common']);
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
      setSaveError(t('common:errors.save'));
    }
  }

  return (
    <YStack gap="$base">
      <Controller
        control={control}
        name="timingType"
        render={({ field }) => (
          <YStack gap="$sm">
            <Text color="$text" fontWeight="600">{t('calendar:timingType')} *</Text>
            <XStack gap="$sm">
              {[
                { value: 'scheduled' as const, label: t('calendar:scheduled') },
                { value: 'deadline' as const, label: t('calendar:deadline') },
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

      <Field label={`${t('calendar:date')} *`} error={errors.date ? t('calendar:validation.date') : undefined}>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateInput value={field.value} onBlur={field.onBlur} onChange={field.onChange} />
          )}
        />
      </Field>
      <Field
        label={`${t('calendar:time')}${timingType === 'scheduled' ? ' *' : ''}`}
        error={
          errors.time?.message === 'TIME_INVALID'
            ? t('calendar:validation.timeFormat')
            : errors.time
              ? t('calendar:validation.time')
              : undefined
        }
      >
        <Controller
          control={control}
          name="time"
          render={({ field }) => (
            <TimeInput
              label={t('calendar:time')}
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
          )}
        />
      </Field>
      <Field label={t('calendar:location')} error={errors.location?.message}>
        <Controller control={control} name="location" render={({ field }) => <AppInput value={field.value} onChangeText={field.onChange} />} />
      </Field>
      <Field label={t('calendar:meetingUrl')} error={errors.meetingUrl ? t('calendar:validation.url') : undefined}>
        <Controller
          control={control}
          name="meetingUrl"
          render={({ field }) => <AppInput autoCapitalize="none" inputMode="url" value={field.value} onChangeText={field.onChange} />}
        />
      </Field>
      <Field label={t('calendar:note')} error={errors.note?.message}>
        <Controller
          control={control}
          name="note"
          render={({ field }) => <AppInput multiline minH={88} value={field.value} onChangeText={field.onChange} />}
        />
      </Field>
      {saveError ? <Text color="$danger">{saveError}</Text> : null}
      <AppButton variant="primary" disabled={isSubmitting} onPress={handleSubmit(submit)}>
        {isSubmitting ? t('common:states.saving') : event ? t('common:actions.save') : t('common:actions.add')}
      </AppButton>
    </YStack>
  );
}

function DateInput({
  onBlur,
  onChange,
  value,
}: {
  onBlur: () => void;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <AppInput
      type="date"
      value={value}
      onBlur={onBlur}
      onClick={(event) => {
        event.currentTarget.focus();

        try {
          event.currentTarget.showPicker?.();
        } catch {
          // Focusing the native date input remains the fallback when showPicker is unavailable.
        }
      }}
      onChangeText={onChange}
    />
  );
}

function TimeInput({
  label,
  onBlur,
  onChange,
  value,
}: {
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  value: string;
}) {
  const inputId = useId();
  const optionsScrollRef = useRef<ScrollView | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const targetIndex = getClosestTimeOptionIndex(value);

    if (targetIndex === null) return undefined;

    const scrollTimer = setTimeout(() => {
      const centeredOffset =
        targetIndex * timeOptionHeight -
        (timeOptionsViewportHeight - timeOptionHeight) / 2;
      const maximumOffset =
        timeOptions.length * timeOptionHeight - timeOptionsViewportHeight;

      optionsScrollRef.current?.scrollTo({
        animated: false,
        y: Math.max(0, Math.min(centeredOffset, maximumOffset)),
      });
    }, 0);

    return () => clearTimeout(scrollTimer);
  }, [open, value]);

  function openOptions() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpen(true);
  }

  function handleBlur() {
    onBlur();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  }

  function focusInput() {
    if (typeof document !== 'undefined') {
      document.getElementById(inputId)?.focus();
    }
    openOptions();
  }

  function selectTime(time: string) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    onChange(time);
    setOpen(false);
  }

  return (
    <YStack gap="$xs">
      <XStack position="relative">
        <AppInput
          id={inputId}
          aria-autocomplete="list"
          aria-expanded={open}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={5}
          placeholder="--:--"
          pr={48}
          type="text"
          value={value}
          width="100%"
          onBlur={handleBlur}
          onChangeText={onChange}
          onFocus={openOptions}
          onPressIn={openOptions}
        />
        <YStack
          aria-label={label}
          cursor="pointer"
          style={{
            alignItems: 'center',
            bottom: 0,
            justifyContent: 'center',
            position: 'absolute',
            right: 0,
            top: 0,
            width: 48,
          }}
          onPress={focusInput}
        >
          <Clock3 color="$textMuted" size={18} />
        </YStack>
      </XStack>

      {open ? (
        <YStack
          bg="$surface"
          borderColor="$border"
          style={{
            borderRadius: 12,
            borderWidth: 1,
            maxHeight: timeOptionsViewportHeight,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            ref={optionsScrollRef}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={{ maxHeight: timeOptionsViewportHeight }}
          >
            {timeOptions.map((time) => (
              <XStack
                key={time}
                bg={value === time ? '$accentSoft' : '$surface'}
                cursor="pointer"
                px="$md"
                pressStyle={{ opacity: 0.72 }}
                style={{ alignItems: 'center', height: timeOptionHeight }}
                onPress={() => selectTime(time)}
              >
                <Text color="$text">{time}</Text>
              </XStack>
            ))}
          </ScrollView>
        </YStack>
      ) : null}
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
