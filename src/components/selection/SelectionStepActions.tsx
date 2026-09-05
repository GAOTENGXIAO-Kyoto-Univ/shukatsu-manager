import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, CalendarClock, ChevronLeft, ExternalLink, MessageSquareText, Trash2 } from '@tamagui/lucide-icons-2';
import { useMutation } from 'convex/react';
import { Href, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { api } from '../../../convex/_generated/api';
import { warmPaperColors } from '../../../tamagui.config';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import type { SelectionStepDetail } from '@/components/applications/types';
import { EventForm } from '@/components/events/EventForm';
import { formatEventSummary } from '@/components/events/eventFormatting';
import { canMoveStep } from './SelectionTimeline';
import {
  getStepTypeLabel,
  selectionStepTypeOptions,
  type SelectionStepType,
} from './selectionConstants';

const editStepSchema = z.object({
  name: z.string().trim().min(1, '步骤名称不能为空'),
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
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<EditStepForm>({
    values: {
      name: step?.name ?? '',
      type: (step?.type ?? 'other') as SelectionStepType,
    },
    resolver: zodResolver(editStepSchema),
  });

  if (!step) {
    return null;
  }

  const activeStep = step;
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
    failureMessage = '更新失败，请重试',
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
        name: values.name,
        type: values.type,
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
      title={editingEvent ? (activeStep.event ? '编辑时间事项' : '添加时间事项') : '步骤操作'}
      desktopPresentation="popover"
      mobileNearFullscreen
      width={480}
      headerAction={editingEvent ? null : undefined}
      headerLeading={
        editingEvent ? (
          <AppButton
            aria-label="返回步骤操作"
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
            {step.name}
          </Text>
          <Text color="$textMuted" fontSize={13}>
            {getStepTypeLabel(step.type)}
          </Text>
        </YStack>

        {editing ? (
          <YStack gap="$base">
            <YStack gap="$sm">
              <Text color="$text" fontWeight="600">
                步骤名称 *
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
              {errors.name ? <Text color="$danger">{errors.name.message}</Text> : null}
            </YStack>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <YStack gap="$sm">
                  <Text color="$text" fontWeight="600">
                    步骤类型 *
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
                          {option.label}
                        </Text>
                      </XStack>
                    ))}
                  </XStack>
                </YStack>
              )}
            />
            <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
              <AppButton variant="secondary" disabled={busy} onPress={() => setEditing(false)}>
                取消
              </AppButton>
              <AppButton variant="primary" disabled={busy} onPress={handleSubmit(submitEdit)}>
                {isSubmitting || pendingAction === 'edit' ? '保存中...' : '保存'}
              </AppButton>
            </XStack>
          </YStack>
        ) : (
          <>
            <XStack gap="$sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Text color="$text" fontWeight="600">
                已完成
              </Text>
              <AppButton
                variant={activeStep.completed ? 'primary' : 'secondary'}
                disabled={busy}
                onPress={() =>
                  void mutate('completed', async () => {
                    await updateStep({
                      selectionStepId: activeStep.selectionStepId,
                      completed: !activeStep.completed,
                    });
                  })
                }
              >
                {activeStep.completed ? '已完成' : '标记完成'}
              </AppButton>
            </XStack>

            <YStack gap="$sm">
              <Text color="$text" fontWeight="600">
                结果
              </Text>
              <XStack gap="$sm" flexWrap="wrap">
                {[
                  { label: '未设置', value: null },
                  { label: '通过', value: 'passed' as const },
                  { label: '未通过', value: 'failed' as const },
                ].map((option) => {
                  const selected = activeStep.result === option.value;

                  return (
                    <AppButton
                      key={option.label}
                      variant={selected ? 'primary' : 'secondary'}
                      disabled={busy}
                      onPress={() =>
                        void mutate('result', async () => {
                          await updateStep({
                            selectionStepId: activeStep.selectionStepId,
                            result: option.value,
                          });
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
                <Text color="$text" fontWeight="600">时间事项</Text>
              </XStack>
              {activeStep.event ? (
                <YStack gap="$sm">
                  <Text color="$text" fontWeight="600">
                    {formatEventSummary(activeStep.event)}
                  </Text>
                  {activeStep.event.location ? (
                    <EventInfo label="地点" value={activeStep.event.location} />
                  ) : null}
                  {activeStep.event.meetingUrl ? (
                    <YStack gap="$xs">
                      <Text color="$textMuted" fontSize={13}>会议链接</Text>
                      <AppButton
                        variant="ghost"
                        icon={<ExternalLink size={15} />}
                        onPress={() => void Linking.openURL(activeStep.event?.meetingUrl ?? '')}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        加入会议
                      </AppButton>
                    </YStack>
                  ) : null}
                  {activeStep.event.note ? (
                    <EventInfo label="备注" value={activeStep.event.note} />
                  ) : null}
                  {confirmingEventDelete ? (
                    <YStack bg="$dangerSoft" gap="$sm" p="$md" style={{ borderRadius: 8 }}>
                      <Text color="$text" fontWeight="600">删除时间事项？</Text>
                      <Text color="$textSecondary" fontSize={13}>删除后，该选考步骤本身会保留。</Text>
                      <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
                        <AppButton variant="secondary" disabled={busy} onPress={() => setConfirmingEventDelete(false)}>
                          取消
                        </AppButton>
                        <AppButton
                          variant="danger"
                          disabled={busy}
                          onPress={() =>
                            void mutate('delete-event', async () => {
                              if (!activeStep.event) return;
                              await removeEvent({ eventId: activeStep.event.eventId });
                              setConfirmingEventDelete(false);
                            }, '删除失败，请重试')
                          }
                        >
                          {pendingAction === 'delete-event' ? '删除中...' : '删除'}
                        </AppButton>
                      </XStack>
                    </YStack>
                  ) : (
                    <XStack flexWrap="wrap" gap="$sm">
                      <AppButton variant="secondary" disabled={busy} onPress={() => setEditingEvent(true)}>
                        编辑时间事项
                      </AppButton>
                      <AppButton variant="ghost" color="$danger" disabled={busy} onPress={() => setConfirmingEventDelete(true)}>
                        删除时间事项
                      </AppButton>
                    </XStack>
                  )}
                </YStack>
              ) : (
                <YStack gap="$sm">
                  <Text color="$textMuted">暂无时间事项</Text>
                  <AppButton
                    variant="secondary"
                    icon={<CalendarClock size={16} />}
                    disabled={busy}
                    onPress={() => setEditingEvent(true)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    添加时间事项
                  </AppButton>
                </YStack>
              )}
            </YStack>

            {activeStep.type === 'interview' ? (
              <YStack borderTopColor="$border" borderTopWidth={1} gap="$sm" pt="$base">
                <XStack gap="$sm" style={{ alignItems: 'center' }}>
                  <MessageSquareText color="$textSecondary" size={18} />
                  <Text color="$text" fontWeight="600">面试复盘</Text>
                </XStack>
                <Text color="$textMuted" fontSize={13} lineHeight={20}>
                  记录面试信息、复盘内容和实际被问到的问题。
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
                  {activeStep.hasInterviewDetail ? '查看面试复盘' : '记录面试'}
                </AppButton>
              </YStack>
            ) : null}

            <AppButton variant="secondary" disabled={busy} onPress={() => setEditing(true)}>
              编辑步骤
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
                上移
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
                下移
              </AppButton>
            </XStack>

            {confirmingStepDelete && canDelete ? (
              <YStack bg="$dangerSoft" gap="$sm" p="$md" style={{ borderRadius: 8 }}>
                <Text color="$text" fontWeight="600">删除「{activeStep.name}」？</Text>
                <Text color="$textSecondary" fontSize={13} lineHeight={20}>
                  {activeStep.hasInterviewDetail
                    ? '该步骤关联的时间事项、面试记录、问题和复盘内容也会一并删除。此操作无法撤销。'
                    : '该步骤关联的时间事项也会一并删除。此操作无法撤销。'}
                </Text>
                <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
                  <AppButton variant="secondary" disabled={busy} onPress={() => setConfirmingStepDelete(false)}>
                    取消
                  </AppButton>
                  <AppButton
                    variant="danger"
                    disabled={busy}
                    onPress={() =>
                      void mutate('delete', async () => {
                        await removeStep({ selectionStepId: activeStep.selectionStepId });
                        close();
                      }, '删除失败，请重试')
                    }
                  >
                    {pendingAction === 'delete' ? '删除中...' : '删除'}
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
                删除步骤
              </AppButton>
            )}
            {showDeleteHint ? (
              <Text color="$textMuted" fontSize={13}>
                已完成的步骤需要先取消完成并清空结果后才能删除。
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
      title="修改步骤类型？"
    >
      <YStack gap="$base">
        <Text color="$textSecondary" lineHeight={22}>
          该步骤已有面试复盘。修改为非面试类型后，面试信息、问题和复盘内容都会被删除。
          此操作无法撤销。
        </Text>
        {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
        <XStack gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton variant="secondary" disabled={busy} onPress={() => setPendingTypeChange(null)}>
            取消
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
            {pendingAction === 'edit' ? '修改中...' : '确认修改'}
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
