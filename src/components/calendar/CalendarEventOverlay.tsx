import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { eventToFormValues } from '@/components/events/eventFormatting';
import { getStepTypeLabel } from '@/components/selection/selectionConstants';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
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
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '请选择日期'),
    time: z.string(),
    location: z.string(),
    meetingUrl: z.string(),
    note: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === 'independent' && !values.title.trim()) {
      ctx.addIssue({ code: 'custom', path: ['title'], message: '标题不能为空' });
    }
    if (values.mode === 'selection' && !values.applicationId) {
      ctx.addIssue({ code: 'custom', path: ['applicationId'], message: '请选择应聘记录' });
    }
    if (values.mode === 'selection' && !values.selectionStepId) {
      ctx.addIssue({ code: 'custom', path: ['selectionStepId'], message: '请选择选考步骤' });
    }
    if (values.timingType === 'scheduled' && !values.time) {
      ctx.addIssue({ code: 'custom', path: ['time'], message: '预定时间必须填写时间' });
    }
    if (values.meetingUrl.trim()) {
      try {
        const url = new URL(values.meetingUrl.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['meetingUrl'],
          message: '请输入有效的 http/https 链接',
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
      } else {
        await createIndependent({ title: values.title, ...common });
      }
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存失败，请重试');
    }
  }

  async function confirmDelete() {
    if (!event) return;
    setSaveError(null);
    try {
      await removeEvent({ eventId: event.eventId });
      setConfirmingDelete(false);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '删除失败，请重试');
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
        title={event ? '编辑日程' : '添加日程'}
        width={520}
      >
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
          <YStack gap="$base" pb="$sm">
            {!event ? (
              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <Field label="日程类型">
                    <XStack gap="$sm" flexWrap="wrap">
                      <AppButton
                        variant={field.value === 'independent' ? 'primary' : 'secondary'}
                        onPress={() => field.onChange('independent')}
                      >
                        独立日程
                      </AppButton>
                      <AppButton
                        variant={field.value === 'selection' ? 'primary' : 'secondary'}
                        onPress={() => field.onChange('selection')}
                      >
                        选考步骤
                      </AppButton>
                    </XStack>
                  </Field>
                )}
              />
            ) : null}

            {mode === 'independent' || event ? (
              <Field label="标题 *" error={errors.title?.message}>
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
                <Field label="时间类型 *">
                  <XStack gap="$sm" flexWrap="wrap">
                    <AppButton
                      variant={field.value === 'scheduled' ? 'primary' : 'secondary'}
                      onPress={() => field.onChange('scheduled')}
                    >
                      预定时间
                    </AppButton>
                    <AppButton
                      variant={field.value === 'deadline' ? 'primary' : 'secondary'}
                      onPress={() => field.onChange('deadline')}
                    >
                      截止日期
                    </AppButton>
                  </XStack>
                </Field>
              )}
            />

            <Field label="日期 *" error={errors.date?.message}>
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
              label={`时间${timingType === 'scheduled' ? ' *' : ''}`}
              error={errors.time?.message}
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
            <Field label="地点">
              <Controller
                control={control}
                name="location"
                render={({ field }) => (
                  <AppInput value={field.value} onChangeText={field.onChange} />
                )}
              />
            </Field>
            <Field label="会议链接" error={errors.meetingUrl?.message}>
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
            <Field label="备注">
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
                  删除日程
                </AppButton>
              ) : null}
              <AppButton
                disabled={isSubmitting}
                variant="primary"
                onPress={handleSubmit(submit)}
              >
                {isSubmitting ? '保存中...' : event ? '保存' : '添加'}
              </AppButton>
            </XStack>
          </YStack>
        </ScrollView>
      </ResponsiveOverlay>

      <ResponsiveOverlay
        onClose={() => setConfirmingDelete(false)}
        open={confirmingDelete}
        title="删除日程？"
      >
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={22}>
            将删除「{event?.title}」。此操作无法撤销。
          </Text>
          {saveError ? <Text color="$danger">{saveError}</Text> : null}
          <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" onPress={() => setConfirmingDelete(false)}>
              取消
            </AppButton>
            <AppButton variant="danger" onPress={() => void confirmDelete()}>
              确认删除
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
  const selectedStepId = useWatch({ control, name: 'selectionStepId' });

  return (
    <>
      <Field label="应聘记录 *" error={errors.applicationId?.message}>
        {isLoading ? <Text color="$textMuted">正在读取应聘记录...</Text> : null}
        {loadError ? <Text color="$danger">应聘记录读取失败，请稍后重试</Text> : null}
        {!isLoading && !loadError && targets.length === 0 ? (
          <Text color="$textMuted">暂无可选的应聘记录</Text>
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
        <Field label="选考步骤 *" error={errors.selectionStepId?.message}>
          <YStack gap="$sm">
            {selectedApplication.steps.length === 0 ? (
              <Text color="$textMuted">该应聘记录尚无选考步骤</Text>
            ) : null}
            {selectedApplication.steps.length > 0 &&
            selectedApplication.steps.every((step) => step.hasEvent) ? (
              <Text color="$textMuted">该应聘记录暂无可添加日程的选考步骤</Text>
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
                  <Text color="$text" fontWeight="600">{step.name}</Text>
                  <Text color="$textMuted" fontSize={13}>{getStepTypeLabel(step.type)}</Text>
                </XStack>
                {step.hasEvent ? <Text color="$textMuted" fontSize={12}>已有时间事项</Text> : null}
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
