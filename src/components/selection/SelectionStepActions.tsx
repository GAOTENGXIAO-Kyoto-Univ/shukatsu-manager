import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, CalendarClock, ChevronLeft, ExternalLink, MessageSquareText, Trash2 } from '@tamagui/lucide-icons-2';
import { useMutation } from 'convex/react';
import { Href, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import { warmPaperColors } from '../../../tamagui.config';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { analytics } from '@/lib/analytics';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import type { SelectionStepDetail } from '@/components/applications/types';
import { EventForm } from '@/components/events/EventForm';
import { formatEventSummary } from '@/components/events/eventFormatting';
import { canMoveStep } from './SelectionTimeline';
import {
  getStepTypeLabel,
  getSelectionStepDisplayName,
  selectionStepTypeOptions,
  type SelectionStepType,
} from './selectionConstants';

const editStepSchema = z.object({
  name: z.string().trim().min(1, 'STEP_NAME_REQUIRED'),
  type: z.enum(['es', 'web_test', 'interview', 'briefing', 'group_discussion', 'offer_meeting', 'other']),
});

type EditStepForm = z.infer<typeof editStepSchema>;

type SelectionStepActionsProps = {
  onClose: () => void;
  onMove: (step: SelectionStepDetail, direction: 'up' | 'down') => void;
  open: boolean;
  step: SelectionStepDetail | null;
  steps: SelectionStepDetail[];
};

export function SelectionStepActions({
  onClose,
  onMove,
  open,
  step,
  steps,
}: SelectionStepActionsProps) {
  const { t } = useTranslation(['selection', 'common']);
  const router = useRouter();
  const updateStep = useMutation(api.selectionSteps.update);
  const removeStep = useMutation(api.selectionSteps.remove);
  const removeEvent = useMutation(api.events.remove);
  const [editing, setEditing] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [confirmingEventDelete, setConfirmingEventDelete] = useState(false);
  const [confirmingStepDelete, setConfirmingStepDelete] = useState(false);
  const [pendingTypeChange, setPendingTypeChange] = useState<EditStepForm | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteHintStepId, setDeleteHintStepId] = useState<SelectionStepDetail['selectionStepId'] | null>(null);
  const {
    control,
    formState: { dirtyFields, errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<EditStepForm>({
    defaultValues: { name: '', type: 'other' },
    resolver: zodResolver(editStepSchema),
  });

  if (!step) {
    return null;
  }

  const activeStep = step;
  const displayName = getSelectionStepDisplayName(activeStep, t);
  const canMoveUp = canMoveStep(steps, activeStep, 'up');
  const canMoveDown = canMoveStep(steps, activeStep, 'down');
  const canDelete = !activeStep.completed && activeStep.result === null;
  const busy = Boolean(pendingAction) || isSubmitting;
  const moveUpUnavailable = !canMoveUp;
  const moveDownUnavailable = !canMoveDown;
  const moveUpDisabled = busy || moveUpUnavailable;
  const moveDownDisabled = busy || moveDownUnavailable;
  const deleteUnavailable = !canDelete;
  const showDeleteHint = deleteUnavailable && deleteHintStepId === activeStep.selectionStepId;
  const unavailableMoveButtonStyle = {
    backgroundColor: warmPaperColors.warningSoft,
    borderColor: warmPaperColors.warningStrong,
    cursor: 'not-allowed',
  } as const;
  const unavailableDeleteButtonStyle = {
    backgroundColor: warmPaperColors.dangerSoft,
    borderColor: warmPaperColors.danger,
    cursor: 'not-allowed',
  } as const;

  async function mutate(
    actionName: string,
    action: () => Promise<void>,
    failureMessage = t('selection:messages.updateFailed'),
  ) {
    setPendingAction(actionName);
    setErrorMessage(null);

    try {
      await action();
    } catch {
      setErrorMessage(failureMessage);
    } finally {
      setPendingAction(null);
    }
  }

  async function saveEdit(values: EditStepForm, confirmDeleteInterviewData = false) {
    await mutate('edit', async () => {
      await updateStep({
        selectionStepId: activeStep.selectionStepId,
        ...(dirtyFields.name || (dirtyFields.type && activeStep.presetKey)
          ? { name: values.name }
          : {}),
        ...(dirtyFields.type ? { type: values.type } : {}),
        ...(confirmDeleteInterviewData ? { confirmDeleteInterviewData: true } : {}),
      });
      setPendingTypeChange(null);
      setEditing(false);
    });
  }

  async function submitEdit(values: EditStepForm) {
    if (
      activeStep.type === 'interview' &&
      values.type !== 'interview' &&
      activeStep.hasInterviewDetail
    ) {
      setPendingTypeChange(values);
      return;
    }

    await saveEdit(values);
  }

  function close() {
    setEditing(false);
    setEditingEvent(false);
    setConfirmingEventDelete(false);
    setConfirmingStepDelete(false);
    setPendingTypeChange(null);
    setErrorMessage(null);
    setDeleteHintStepId(null);
    reset();
    onClose();
  }

  return (
    <>
    <ResponsiveOverlay
      open={open}
      onClose={close}
      title={editingEvent ? (activeStep.event ? t('selection:actions.editEvent') : t('selection:actions.addEvent')) : t('selection:actions.stepActions')}
      desktopPresentation="popover"
      mobileNearFullscreen
      width={480}
      headerAction={editingEvent ? null : undefined}
      headerLeading={
        editingEvent ? (
          <AppButton
            aria-label={t('selection:actions.stepActions')}
            variant="ghost"
            icon={<ChevronLeft size={18} />}
            onPress={() => {
              setEditingEvent(false);
              setErrorMessage(null);
            }}
          />
        ) : undefined
      }
    >
      {editingEvent ? (
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 620 }}>
          <EventForm
            key={activeStep.event?.eventId ?? `new-${activeStep.selectionStepId}`}
            event={activeStep.event}
            onSaved={() => setEditingEvent(false)}
            selectionStepId={activeStep.selectionStepId}
            stepType={activeStep.type}
          />
        </ScrollView>
      ) : (
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
      <YStack gap="$base" pb="$sm">
        <YStack gap="$xs">
          <Text color="$text" fontSize={18} fontWeight="600">
            {displayName}
          </Text>
          <Text color="$textMuted" fontSize={13}>
            {getStepTypeLabel(t, step.type)}
          </Text>
        </YStack>

        {editing ? (
          <YStack gap="$base">
            <YStack gap="$sm">
              <Text color="$text" fontWeight="600">
                {t('selection:labels.stepName')} *
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <AppInput
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                  />
                )}
              />
              {errors.name ? <Text color="$danger">{t('selection:messages.nameRequired')}</Text> : null}
            </YStack>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <YStack gap="$sm">
                  <Text color="$text" fontWeight="600">
                    {t('selection:labels.stepType')} *
                  </Text>
                  <XStack flexWrap="wrap" gap="$sm">
                    {selectionStepTypeOptions.map((option) => (
                      <XStack
                        key={option.value}
                        bg={field.value === option.value ? '$accentSoft' : '$surfaceMuted'}
                        cursor="pointer"
                        onPress={() => field.onChange(option.value)}
                        px="$md"
                        py="$xs"
                        style={{ borderRadius: 9999 }}
                      >
                        <Text
                          color={field.value === option.value ? '$accentStrong' : '$textSecondary'}
                          fontSize={13}
                          fontWeight="600"
                        >
                          {getStepTypeLabel(t, option.value)}
                        </Text>
                      </XStack>
                    ))}
                  </XStack>
                </YStack>
              )}
            />
            <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
              <AppButton variant="secondary" disabled={busy} onPress={() => setEditing(false)}>
                {t('common:actions.cancel')}
              </AppButton>
              <AppButton variant="primary" disabled={busy} onPress={handleSubmit(submitEdit)}>
                {isSubmitting || pendingAction === 'edit' ? t('common:states.saving') : t('common:actions.save')}
              </AppButton>
            </XStack>
          </YStack>
        ) : (
          <>
            <XStack gap="$sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Text color="$text" fontWeight="600">
                {t('selection:labels.completed')}
              </Text>
              <AppButton
                variant={activeStep.completed ? 'primary' : 'secondary'}
                disabled={busy}
                onPress={() =>
                  void mutate('completed', async () => {
                    const transition = await updateStep({
                      selectionStepId: activeStep.selectionStepId,
                      completed: !activeStep.completed,
                    });
                    if (transition.completedBecameTrue) {
                      analytics.selectionStepCompleted({ step_type: activeStep.type });
                    }
                  })
                }
              >
                {activeStep.completed ? t('selection:labels.completed') : t('selection:actions.markComplete')}
              </AppButton>
            </XStack>

            <YStack gap="$sm">
              <Text color="$text" fontWeight="600">
                {t('selection:labels.result')}
              </Text>
              <XStack gap="$sm" flexWrap="wrap">
                {[
                  { label: t('selection:result.unset'), value: null },
                  { label: t('selection:result.passed'), value: 'passed' as const },
                  { label: t('selection:result.failed'), value: 'failed' as const },
                ].map((option) => {
                  const selected = activeStep.result === option.value;

                  return (
                    <AppButton
                      key={option.label}
                      variant={selected ? 'primary' : 'secondary'}
                      disabled={busy}
                      onPress={() =>
                        void mutate('result', async () => {
                          const transition = await updateStep({
                            selectionStepId: activeStep.selectionStepId,
                            result: option.value,
                          });
                          if (option.value && transition.resultChanged) {
                            analytics.selectionStepResultSet({
                              result: option.value,
                              step_type: activeStep.type,
                            });
                          }
                        })
                      }
                    >
                      {option.label}
                    </AppButton>
                  );
                })}
              </XStack>
            </YStack>

            <YStack borderTopColor="$border" borderTopWidth={1} gap="$sm" pt="$base">
              <XStack gap="$sm" style={{ alignItems: 'center' }}>
                <CalendarClock color="$textSecondary" size={18} />
                <Text color="$text" fontWeight="600">{t('selection:labels.event')}</Text>
              </XStack>
              {activeStep.event ? (
                <YStack gap="$sm">
                  <Text color="$text" fontWeight="600">
                    {formatEventSummary(activeStep.event)}
                  </Text>
                  {activeStep.event.location ? (
                    <EventInfo label={t('selection:labels.location')} value={activeStep.event.location} />
                  ) : null}
                  {activeStep.event.meetingUrl ? (
                    <YStack gap="$xs">
                      <Text color="$textMuted" fontSize={13}>{t('selection:labels.meetingUrl')}</Text>
                      <AppButton
                        variant="ghost"
                        icon={<ExternalLink size={15} />}
                        onPress={() => void Linking.openURL(activeStep.event?.meetingUrl ?? '')}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {t('selection:actions.joinMeeting')}
                      </AppButton>
                    </YStack>
                  ) : null}
                  {activeStep.event.note ? (
                    <EventInfo label={t('selection:labels.note')} value={activeStep.event.note} />
                  ) : null}
                  {confirmingEventDelete ? (
                    <YStack bg="$dangerSoft" gap="$sm" p="$md" style={{ borderRadius: 8 }}>
                      <Text color="$text" fontWeight="600">{t('selection:messages.eventDeleteTitle')}</Text>
                      <Text color="$textSecondary" fontSize={13}>{t('selection:messages.eventDeleteDescription')}</Text>
                      <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
                        <AppButton variant="secondary" disabled={busy} onPress={() => setConfirmingEventDelete(false)}>
                          {t('common:actions.cancel')}
                        </AppButton>
                        <AppButton
                          variant="danger"
                          disabled={busy}
                          onPress={() =>
                            void mutate('delete-event', async () => {
                              if (!activeStep.event) return;
                              await removeEvent({ eventId: activeStep.event.eventId });
                              setConfirmingEventDelete(false);
                            }, t('selection:messages.deleteFailed'))
                          }
                        >
                          {pendingAction === 'delete-event' ? t('common:states.deleting') : t('common:actions.delete')}
                        </AppButton>
                      </XStack>
                    </YStack>
                  ) : (
                    <XStack flexWrap="wrap" gap="$sm">
                      <AppButton variant="secondary" disabled={busy} onPress={() => setEditingEvent(true)}>
                        {t('selection:actions.editEvent')}
                      </AppButton>
                      <AppButton variant="ghost" color="$danger" disabled={busy} onPress={() => setConfirmingEventDelete(true)}>
                        {t('selection:actions.deleteEvent')}
                      </AppButton>
                    </XStack>
                  )}
                </YStack>
              ) : (
                <YStack gap="$sm">
                  <Text color="$textMuted">{t('selection:states.noEvent')}</Text>
                  <AppButton
                    variant="secondary"
                    icon={<CalendarClock size={16} />}
                    disabled={busy}
                    onPress={() => setEditingEvent(true)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {t('selection:actions.addEvent')}
                  </AppButton>
                </YStack>
              )}
            </YStack>

            {activeStep.type === 'interview' ? (
              <YStack borderTopColor="$border" borderTopWidth={1} gap="$sm" pt="$base">
                <XStack gap="$sm" style={{ alignItems: 'center' }}>
                  <MessageSquareText color="$textSecondary" size={18} />
                  <Text color="$text" fontWeight="600">{t('selection:labels.interviewReview')}</Text>
                </XStack>
                <Text color="$textMuted" fontSize={13} lineHeight={20}>
                  {t('selection:messages.interviewDescription')}
                </Text>
                <AppButton
                  variant="secondary"
                  disabled={busy}
                  onPress={() => {
                    const href = `/applications/${activeStep.applicationId}/interviews/${activeStep.selectionStepId}`;
                    close();
                    router.push(href as Href);
                  }}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {activeStep.hasInterviewDetail ? t('selection:actions.viewInterview') : t('selection:actions.recordInterview')}
                </AppButton>
              </YStack>
            ) : null}

            <AppButton variant="secondary" disabled={busy} onPress={() => { reset({ name: displayName, type: activeStep.type as SelectionStepType }); setEditing(true); }}>
              {t('selection:actions.editStep')}
            </AppButton>

            <XStack gap="$sm">
              <AppButton
                variant="secondary"
                disabled={busy}
                color={moveUpDisabled ? '$warningStrong' : '$text'}
                icon={<ArrowUp color={moveUpDisabled ? '$warningStrong' : '$textSecondary'} size={16} />}
                onPress={() => {
                  if (moveUpUnavailable) {
                    return;
                  }

                  onMove(activeStep, 'up');
                }}
                style={moveUpUnavailable ? unavailableMoveButtonStyle : undefined}
                textProps={moveUpUnavailable ? { cursor: 'not-allowed' } : undefined}
              >
                {t('selection:actions.moveUp')}
              </AppButton>
              <AppButton
                variant="secondary"
                disabled={busy}
                color={moveDownDisabled ? '$warningStrong' : '$text'}
                icon={<ArrowDown color={moveDownDisabled ? '$warningStrong' : '$textSecondary'} size={16} />}
                onPress={() => {
                  if (moveDownUnavailable) {
                    return;
                  }

                  onMove(activeStep, 'down');
                }}
                style={moveDownUnavailable ? unavailableMoveButtonStyle : undefined}
                textProps={moveDownUnavailable ? { cursor: 'not-allowed' } : undefined}
              >
                {t('selection:actions.moveDown')}
              </AppButton>
            </XStack>

            {confirmingStepDelete && canDelete ? (
              <YStack bg="$dangerSoft" gap="$sm" p="$md" style={{ borderRadius: 8 }}>
                <Text color="$text" fontWeight="600">{t('selection:messages.deleteStepTitle', { name: displayName })}</Text>
                <Text color="$textSecondary" fontSize={13} lineHeight={20}>
                  {activeStep.hasInterviewDetail
                    ? t('selection:messages.deleteStepWithInterview')
                    : t('selection:messages.deleteStepWithoutInterview')}
                </Text>
                <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
                  <AppButton variant="secondary" disabled={busy} onPress={() => setConfirmingStepDelete(false)}>
                    {t('common:actions.cancel')}
                  </AppButton>
                  <AppButton
                    variant="danger"
                    disabled={busy}
                    onPress={() =>
                      void mutate('delete', async () => {
                        await removeStep({ selectionStepId: activeStep.selectionStepId });
                        close();
                      }, t('selection:messages.deleteFailed'))
                    }
                  >
                    {pendingAction === 'delete' ? t('common:states.deleting') : t('common:actions.delete')}
                  </AppButton>
                </XStack>
              </YStack>
            ) : (
              <AppButton
                variant={deleteUnavailable ? 'secondary' : 'danger'}
                color={deleteUnavailable ? '$danger' : undefined}
                disabled={busy}
                icon={<Trash2 color={deleteUnavailable ? '$danger' : '$surface'} size={16} />}
                onPress={() => {
                  if (deleteUnavailable) {
                    setDeleteHintStepId(activeStep.selectionStepId);
                    return;
                  }

                  setConfirmingStepDelete(true);
                }}
                style={deleteUnavailable ? unavailableDeleteButtonStyle : undefined}
                textProps={deleteUnavailable ? { cursor: 'not-allowed' } : undefined}
              >
                {t('selection:actions.deleteStep')}
              </AppButton>
            )}
            {showDeleteHint ? (
              <Text color="$textMuted" fontSize={13}>
                {t('selection:messages.deleteLocked')}
              </Text>
            ) : null}
          </>
        )}

        {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
      </YStack>
      </ScrollView>
      )}
    </ResponsiveOverlay>
    <ResponsiveOverlay
      open={Boolean(pendingTypeChange)}
      onClose={() => setPendingTypeChange(null)}
      title={t('selection:messages.changeTypeTitle')}
    >
      <YStack gap="$base">
        <Text color="$textSecondary" lineHeight={22}>
          {t('selection:messages.changeTypeDescription')}
        </Text>
        {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
        <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton variant="secondary" disabled={busy} onPress={() => setPendingTypeChange(null)}>
            {t('common:actions.cancel')}
          </AppButton>
          <AppButton
            variant="danger"
            disabled={busy}
            onPress={() => {
              if (pendingTypeChange) {
                void saveEdit(pendingTypeChange, true);
              }
            }}
          >
            {pendingAction === 'edit' ? t('selection:states.updating') : t('selection:actions.confirmChange')}
          </AppButton>
        </XStack>
      </YStack>
    </ResponsiveOverlay>
    </>
  );
}

function EventInfo({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$xs">
      <Text color="$textMuted" fontSize={13}>{label}</Text>
      <Text color="$text" lineHeight={21}>{value}</Text>
    </YStack>
  );
}
