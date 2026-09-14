import { GripVertical, MoreHorizontal } from '@tamagui/lucide-icons-2';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder } from 'react-native';
import { XStack, YStack, Text } from 'tamagui';

import type { Id } from '../../../convex/_generated/dataModel';
import { warmPaperColors } from '../../../tamagui.config';
import type { SelectionStepDetail } from '@/components/applications/types';
import { formatEventSummary } from '@/components/events/eventFormatting';
import { SelectionStatusBadge } from './SelectionStatusBadge';
import { getSelectionStepDisplayName } from './selectionConstants';

type SelectionTimelineProps = {
  currentStageId: Id<'selectionSteps'> | null;
  onMove: (selectionStepId: Id<'selectionSteps'>, direction: 'up' | 'down') => void;
  onOpenStep: (step: SelectionStepDetail) => void;
  steps: SelectionStepDetail[];
};

export function getLockedBoundaryOrder(steps: SelectionStepDetail[]) {
  const lockedOrders = steps
    .filter((step) => step.completed || step.result !== null)
    .map((step) => step.order);

  return lockedOrders.length > 0 ? Math.max(...lockedOrders) : null;
}

export function canMoveStep(steps: SelectionStepDetail[], step: SelectionStepDetail, direction: 'up' | 'down') {
  const lockedBoundary = getLockedBoundaryOrder(steps);

  if (lockedBoundary !== null && step.order <= lockedBoundary) {
    return false;
  }

  const index = steps.findIndex((item) => item.selectionStepId === step.selectionStepId);

  if (index === -1) {
    return false;
  }

  if (direction === 'up') {
    const previousStep = steps[index - 1];
    return Boolean(previousStep && (lockedBoundary === null || previousStep.order > lockedBoundary));
  }

  return index < steps.length - 1;
}

export function SelectionTimeline({
  currentStageId,
  onMove,
  onOpenStep,
  steps,
}: SelectionTimelineProps) {
  const { t } = useTranslation('selection');
  if (steps.length === 0) {
    return null;
  }

  const lockedBoundary = getLockedBoundaryOrder(steps);

  return (
    <YStack gap="$base">
      {steps.map((step, index) => (
        <TimelineRow
          key={step.selectionStepId}
          current={step.selectionStepId === currentStageId}
          first={index === 0}
          last={index === steps.length - 1}
          locked={lockedBoundary !== null && step.order <= lockedBoundary}
          onMove={onMove}
          onOpenStep={onOpenStep}
          reorderable={canMoveStep(steps, step, 'up') || canMoveStep(steps, step, 'down')}
          step={step}
          t={t}
        />
      ))}
    </YStack>
  );
}

function TimelineRow({
  current,
  first,
  last,
  locked,
  onMove,
  onOpenStep,
  reorderable,
  step,
  t,
}: {
  current: boolean;
  first: boolean;
  last: boolean;
  locked: boolean;
  onMove: (selectionStepId: Id<'selectionSteps'>, direction: 'up' | 'down') => void;
  onOpenStep: (step: SelectionStepDetail) => void;
  reorderable: boolean;
  step: SelectionStepDetail;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          reorderable && Math.abs(gestureState.dy) > 10,
        onPanResponderRelease: (_, gestureState) => {
          if (!reorderable) {
            return;
          }

          if (gestureState.dy < -32) {
            onMove(step.selectionStepId, 'up');
          } else if (gestureState.dy > 32) {
            onMove(step.selectionStepId, 'down');
          }
        },
      }),
    [onMove, reorderable, step.selectionStepId],
  );

  return (
    <XStack gap="$md" style={{ alignItems: 'stretch' }}>
      <YStack width={24} style={{ alignItems: 'center' }}>
        <YStack flex={1} width={1} bg={first ? 'transparent' : '$border'} />
        <YStack
          width={current ? 16 : 12}
          height={current ? 16 : 12}
          bg={current ? '$accentStrong' : step.status === 'passed' ? '$successStrong' : '$surface'}
          style={{
            borderColor: current ? warmPaperColors.accentStrong : warmPaperColors.border,
            borderRadius: 9999,
            borderWidth: 1,
          }}
        />
        <YStack flex={1} width={1} bg={last ? 'transparent' : '$border'} />
      </YStack>
      <XStack
        flex={1}
        gap="$sm"
        py="$sm"
        style={{ alignItems: 'center', minHeight: 72 }}
      >
        <YStack
          flex={1}
          gap="$xs"
          cursor="pointer"
          onPress={() => onOpenStep(step)}
        >
          <Text color="$text" fontSize={16} fontWeight={current ? '600' : '500'}>
            {getSelectionStepDisplayName(step, t)}
          </Text>
          <XStack gap="$sm" style={{ alignItems: 'center' }}>
            <SelectionStatusBadge status={step.status} />
            {locked ? (
              <Text color="$textMuted" fontSize={12}>
                {t('states.orderLocked')}
              </Text>
            ) : null}
          </XStack>
          {step.event ? (
            <Text color={step.status === 'overdue' ? '$danger' : '$textSecondary'} fontSize={13}>
              {formatEventSummary(step.event)}
            </Text>
          ) : null}
        </YStack>
        {reorderable ? (
          <XStack
            cursor="grab"
            p="$xs"
            {...panResponder.panHandlers}
            style={{ touchAction: 'none' }}
          >
            <GripVertical color="$textMuted" size={18} />
          </XStack>
        ) : null}
        <XStack
          aria-label={t('actions.stepActions')}
          cursor="pointer"
          height={36}
          onPress={() => onOpenStep(step)}
          width={36}
          style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
        >
          <MoreHorizontal color="$textSecondary" size={18} />
        </XStack>
      </XStack>
    </XStack>
  );
}
