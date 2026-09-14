import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { eventToFormValues } from '@/components/events/eventFormatting';
import { getSelectionStepDisplayName, getStepTypeLabel } from '@/components/selection/selectionConstants';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { analytics } from '@/lib/analytics';
import type {
  ApplicationEventTarget,
  IndependentCalendarEvent,
  SelectionStepTarget,
} from './types';

const formSchema = z
  .object({
    mode: z.enum(['independent', 'selection']),
    title: z.string(),
    applicationId: z.string(),
    selectionStepId: z.string(),
    timingType: z.enum(['scheduled', 'deadline']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATE_REQUIRED'),
    time: z.string(),
    location: z.string(),
    meetingUrl: z.string(),
    note: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === 'independent' && !values.title.trim()) {
      ctx.addIssue({ code: 'custom', path: ['title'], message: 'TITLE_REQUIRED' });
    }
    if (values.mode === 'selection' && !values.applicationId) {
      ctx.addIssue({ code: 'custom', path: ['applicationId'], message: 'APPLICATION_REQUIRED' });
    }
    if (values.mode === 'selection' && !values.selectionStepId) {
      ctx.addIssue({ code: 'custom', path: ['selectionStepId'], message: 'SELECTION_STEP_REQUIRED' });
    }
    if (values.timingType === 'scheduled' && !values.time) {
      ctx.addIssue({ code: 'custom', path: ['time'], message: 'TIME_REQUIRED' });
    }
    if (values.meetingUrl.trim()) {
      try {
        const url = new URL(values.meetingUrl.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['meetingUrl'],
          message: 'URL_INVALID',
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

export function CalendarEventOverlay({
  date,
  event,
  onClose,
  open,
}: {
  date: string;
  event: IndependentCalendarEvent | null;
  onClose: () => void;
  open: boolean;
}) {
  const { t } = useTranslation(['calendar', 'common', 'selection']);
  const createIndependent = useMutation(api.events.createIndependent);
  const createSelectionEvent = useMutation(api.events.create);
  const updateEvent = useMutation(api.events.update);
  const removeEvent = useMutation(api.events.remove);
  const targetState = useQuery({
    query: api.events.listSelectionStepTargets,
    args: open && !event ? {} : 'skip',
  });
  const storedDateTime = event ? eventToFormValues(event) : null;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      mode: 'independent',
      title: event?.title ?? '',
      applicationId: '',
      selectionStepId: '',
      timingType: event?.timingType ?? 'scheduled',
      date: storedDateTime?.date ?? date,
      time: storedDateTime?.time ?? '',
      location: event?.location ?? '',
      meetingUrl: event?.meetingUrl ?? '',
      note: event?.note ?? '',
    },
    resolver: zodResolver(formSchema),
  });
  const mode = useWatch({ control, name: 'mode' });
  const applicationId = useWatch({ control, name: 'applicationId' });
  const timingType = useWatch({ control, name: 'timingType' });
  const targets: ApplicationEventTarget[] =
    targetState.status === 'success' ? targetState.data : [];
  const selectedApplication =
    targets.find((target) => target.applicationId === applicationId) ?? null;

  function chooseStep(step: SelectionStepTarget) {
    if (step.hasEvent) return;
    setValue('selectionStepId', step.selectionStepId, { shouldValidate: true });
    setValue(
      'timingType',
      step.type === 'es' || step.type === 'web_test' ? 'deadline' : 'scheduled',
    );
  }

  async function submit(values: FormValues) {
    setSaveError(null);
    const common = {
      timingType: values.timingType,
      date: values.date,
      time: values.time || null,
      location: values.location || null,
      meetingUrl: values.meetingUrl || null,
      note: values.note || null,
    };

    try {
      if (event) {
        await updateEvent({ eventId: event.eventId, title: values.title, ...common });
      } else if (values.mode === 'selection') {
        await createSelectionEvent({
          selectionStepId: values.selectionStepId as Id<'selectionSteps'>,
          ...common,
        });
        analytics.eventCreated({
          event_kind: 'selection_step',
          timing_type: values.timingType,
          has_explicit_time: Boolean(values.time),
        });
      } else {
        await createIndependent({ title: values.title, ...common });
        analytics.eventCreated({
          event_kind: 'independent',
          timing_type: values.timingType,
          has_explicit_time: Boolean(values.time),
        });
      }
      onClose();
    } catch {
      setSaveError(t('common:errors.save'));
    }
  }

  async function confirmDelete() {
    if (!event) return;
    setSaveError(null);
    try {
      await removeEvent({ eventId: event.eventId });
      setConfirmingDelete(false);
      onClose();
    } catch {
      setSaveError(t('common:errors.delete'));
    }
  }

  function close() {
    if (!isSubmitting) {
      setSaveError(null);
      setConfirmingDelete(false);
      onClose();
    }
  }

  return (
    <>
      <ResponsiveOverlay
        mobileNearFullscreen
        onClose={close}
        open={open}
        title={event ? t('calendar:editSchedule') : t('calendar:addSchedule')}
        width={520}
      >
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
          <YStack gap="$base" pb="$sm">
            {!event ? (
              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <Field label={t('calendar:eventType')}>
                    <XStack gap="$sm" flexWrap="wrap">
                      <AppButton
                        variant={field.value === 'independent' ? 'primary' : 'secondary'}
                        onPress={() => field.onChange('independent')}
                      >
                        {t('calendar:independent')}
                      </AppButton>
                      <AppButton
                        variant={field.value === 'selection' ? 'primary' : 'secondary'}
                        onPress={() => field.onChange('selection')}
                      >
                        {t('calendar:selectionStep')}
                      </AppButton>
                    </XStack>
                  </Field>
                )}
              />
            ) : null}

            {mode === 'independent' || event ? (
              <Field label={`${t('calendar:titleLabel')} *`} error={errors.title ? t('calendar:validation.title') : undefined}>
                <Controller
                  control={control}
                  name="title"
                  render={({ field }) => (
                    <AppInput value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} />
                  )}
                />
              </Field>
            ) : (
              <SelectionTargetFields
                applicationId={applicationId}
                control={control}
                errors={errors}
                isLoading={targetState.status === 'pending'}
                loadError={targetState.status === 'error'}
                onApplicationChange={(value) => {
                  setValue('applicationId', value, { shouldValidate: true });
                  setValue('selectionStepId', '');
                }}
                onChooseStep={chooseStep}
                selectedApplication={selectedApplication}
                targets={targets}
              />
            )}

            <Controller
              control={control}
              name="timingType"
              render={({ field }) => (
                <Field label={`${t('calendar:timingType')} *`}>
                  <XStack gap="$sm" flexWrap="wrap">
                    <AppButton
                      variant={field.value === 'scheduled' ? 'primary' : 'secondary'}
                      onPress={() => field.onChange('scheduled')}
                    >
                      {t('calendar:scheduled')}
                    </AppButton>
                    <AppButton
                      variant={field.value === 'deadline' ? 'primary' : 'secondary'}
                      onPress={() => field.onChange('deadline')}
                    >
                      {t('calendar:deadline')}
                    </AppButton>
                  </XStack>
                </Field>
              )}
            />

            <Field label={`${t('calendar:date')} *`} error={errors.date ? t('calendar:validation.date') : undefined}>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <AppInput
                    type="date"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                  />
                )}
              />
            </Field>
            <Field
              label={`${t('calendar:time')}${timingType === 'scheduled' ? ' *' : ''}`}
              error={errors.time ? t('calendar:validation.time') : undefined}
            >
              <Controller
                control={control}
                name="time"
                render={({ field }) => (
                  <AppInput
                    type="time"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                  />
                )}
              />
            </Field>
            <Field label={t('calendar:location')}>
              <Controller
                control={control}
                name="location"
                render={({ field }) => (
                  <AppInput value={field.value} onChangeText={field.onChange} />
                )}
              />
            </Field>
            <Field label={t('calendar:meetingUrl')} error={errors.meetingUrl ? t('calendar:validation.url') : undefined}>
              <Controller
                control={control}
                name="meetingUrl"
                render={({ field }) => (
                  <AppInput
                    autoCapitalize="none"
                    inputMode="url"
                    value={field.value}
                    onChangeText={field.onChange}
                  />
                )}
              />
            </Field>
            <Field label={t('calendar:note')}>
              <Controller
                control={control}
                name="note"
                render={({ field }) => (
                  <AppInput multiline minH={88} value={field.value} onChangeText={field.onChange} />
                )}
              />
            </Field>
            {saveError ? <Text color="$danger">{saveError}</Text> : null}
            <XStack gap="$sm" flexWrap="wrap" style={{ justifyContent: 'flex-end' }}>
              {event ? (
                <AppButton
                  color="$danger"
                  disabled={isSubmitting}
                  variant="ghost"
                  onPress={() => setConfirmingDelete(true)}
                >
                  {t('calendar:deleteSchedule')}
                </AppButton>
              ) : null}
              <AppButton
                disabled={isSubmitting}
                variant="primary"
                onPress={handleSubmit(submit)}
              >
                {isSubmitting ? t('common:states.saving') : event ? t('common:actions.save') : t('common:actions.add')}
              </AppButton>
            </XStack>
          </YStack>
        </ScrollView>
      </ResponsiveOverlay>

      <ResponsiveOverlay
        onClose={() => setConfirmingDelete(false)}
        open={confirmingDelete}
        title={t('calendar:deleteTitle')}
      >
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>
            {t('calendar:deleteDescription', { title: event?.title })}
          </Text>
          {saveError ? <Text color="$danger">{saveError}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" onPress={() => setConfirmingDelete(false)}>
              {t('common:actions.cancel')}
            </AppButton>
            <AppButton variant="danger" onPress={() => void confirmDelete()}>
              {t('calendar:confirmDelete')}
            </AppButton>
          </XStack>
        </YStack>
      </ResponsiveOverlay>
    </>
  );
}

function SelectionTargetFields({
  applicationId,
  control,
  errors,
  isLoading,
  loadError,
  onApplicationChange,
  onChooseStep,
  selectedApplication,
  targets,
}: {
  applicationId: string;
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
  isLoading: boolean;
  loadError: boolean;
  onApplicationChange: (value: string) => void;
  onChooseStep: (step: SelectionStepTarget) => void;
  selectedApplication: ApplicationEventTarget | null;
  targets: ApplicationEventTarget[];
}) {
  const { t } = useTranslation(['calendar', 'selection']);
  const selectedStepId = useWatch({ control, name: 'selectionStepId' });

  return (
    <>
      <Field label={`${t('calendar:application')} *`} error={errors.applicationId ? t('calendar:validation.application') : undefined}>
        {isLoading ? <Text color="$textMuted">{t('calendar:applicationsLoading')}</Text> : null}
        {loadError ? <Text color="$danger">{t('calendar:applicationsLoadFailed')}</Text> : null}
        {!isLoading && !loadError && targets.length === 0 ? (
          <Text color="$textMuted">{t('calendar:noApplications')}</Text>
        ) : null}
        <YStack gap="$sm">
          {targets.map((target) => (
            <YStack
              key={target.applicationId}
              bg={applicationId === target.applicationId ? '$accentSoft' : '$surfaceMuted'}
              borderColor={applicationId === target.applicationId ? '$accentStrong' : '$border'}
              borderWidth={1}
              cursor="pointer"
              gap="$xs"
              onPress={() => onApplicationChange(target.applicationId)}
              p="$md"
              style={{ borderRadius: 12 }}
            >
              <Text color="$text" fontWeight="600">{target.companyName}</Text>
              <Text color="$textSecondary" fontSize={13}>{target.jobTitle}</Text>
            </YStack>
          ))}
        </YStack>
      </Field>
      {selectedApplication ? (
        <Field label={`${t('calendar:selectionStep')} *`} error={errors.selectionStepId ? t('calendar:validation.step') : undefined}>
          <YStack gap="$sm">
            {selectedApplication.steps.length === 0 ? (
              <Text color="$textMuted">{t('calendar:noSteps')}</Text>
            ) : null}
            {selectedApplication.steps.length > 0 &&
            selectedApplication.steps.every((step) => step.hasEvent) ? (
              <Text color="$textMuted">{t('calendar:noAvailableSteps')}</Text>
            ) : null}
            {selectedApplication.steps.map((step) => (
              <YStack
                key={step.selectionStepId}
                bg={selectedStepId === step.selectionStepId ? '$accentSoft' : '$surfaceMuted'}
                borderColor={selectedStepId === step.selectionStepId ? '$accentStrong' : '$border'}
                borderWidth={1}
                cursor={step.hasEvent ? 'not-allowed' : 'pointer'}
                gap="$xs"
                opacity={step.hasEvent ? 0.55 : 1}
                onPress={() => onChooseStep(step)}
                p="$md"
                style={{ borderRadius: 12 }}
              >
                <XStack gap="$sm" style={{ justifyContent: 'space-between' }}>
                  <Text color="$text" fontWeight="600">{getSelectionStepDisplayName(step, t)}</Text>
                  <Text color="$textMuted" fontSize={13}>{getStepTypeLabel(t, step.type)}</Text>
                </XStack>
                {step.hasEvent ? <Text color="$textMuted" fontSize={12}>{t('calendar:hasEvent')}</Text> : null}
              </YStack>
            ))}
          </YStack>
        </Field>
      ) : null}
    </>
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
