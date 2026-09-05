import { Clock3, MoreHorizontal } from '@tamagui/lucide-icons-2';
import { XStack, YStack, Text } from 'tamagui';

import { SelectionStatusBadge } from '@/components/selection/SelectionStatusBadge';
import { formatEventDate, getEventLabel } from '@/components/events/eventFormatting';
import type { ApplicationListItem } from './types';

type ApplicationRowProps = {
  application: ApplicationListItem;
  onOpen: (application: ApplicationListItem) => void;
  onOpenMenu: (application: ApplicationListItem) => void;
};

export function ApplicationRow({ application, onOpen, onOpenMenu }: ApplicationRowProps) {
  return (
    <YStack borderBottomColor="$border" borderBottomWidth={1} py="$base">
      <XStack gap="$md" style={{ alignItems: 'flex-start' }}>
        <YStack
          accessibilityRole="link"
          cursor="pointer"
          flex={1}
          gap="$xs"
          onPress={() => onOpen(application)}
          pr="$sm"
          tabIndex={0}
          style={{ minHeight: 76 }}
          focusStyle={{
            outlineColor: '$focusRing',
            outlineStyle: 'solid',
            outlineWidth: 2,
          }}
        >
          <Text color="$text" fontSize={17} fontWeight="600">
            {application.companyName}
          </Text>
          <Text color="$text" fontSize={15}>
            {application.jobTitle}
          </Text>
          {application.currentStage && application.currentStatus ? (
            <XStack gap="$sm" style={{ alignItems: 'center' }}>
              <Text color="$textSecondary" fontSize={13} fontWeight="600">
                {application.currentStage.name}
              </Text>
              <SelectionStatusBadge status={application.currentStatus} />
            </XStack>
          ) : (
            <Text color="$textMuted" fontSize={13}>
              尚未设置选考流程
            </Text>
          )}
          {application.nextEvent ? (
            <XStack gap="$xs" style={{ alignItems: 'center' }}>
              <Clock3 color={application.nextEvent.isOverdue ? '$danger' : '$textMuted'} size={14} />
              <Text color={application.nextEvent.isOverdue ? '$danger' : '$textSecondary'} fontSize={13}>
                {formatEventDate(application.nextEvent)} ·{' '}
                {getEventLabel(application.nextEvent.stepName, application.nextEvent.timingType)}
              </Text>
            </XStack>
          ) : null}
        </YStack>
        <XStack
          aria-label="更多操作"
          cursor="pointer"
          height={40}
          onPress={() => onOpenMenu(application)}
          width={40}
          hoverStyle={{ bg: '$surfaceMuted' }}
          pressStyle={{ bg: '$accentSoft' }}
          style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
        >
          <MoreHorizontal color="$textSecondary" size={20} />
        </XStack>
      </XStack>
    </YStack>
  );
}
