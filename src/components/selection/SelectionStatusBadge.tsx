import { Text, XStack } from 'tamagui';
import { useTranslation } from 'react-i18next';

import { getStatusLabel, type ApplicationSelectionStatus, type SelectionStepStatus } from './selectionConstants';

type SelectionStatusBadgeProps = {
  status: Exclude<ApplicationSelectionStatus, null> | SelectionStepStatus;
};

export function SelectionStatusBadge({ status }: SelectionStatusBadgeProps) {
  const { t } = useTranslation('selection');
  const colors = {
    waiting_schedule: { bg: '$accentSoft', color: '$accentStrong' },
    preparing: { bg: '$infoSoft', color: '$infoStrong' },
    overdue: { bg: '$dangerSoft', color: '$danger' },
    waiting_result: { bg: '$warningSoft', color: '$warningStrong' },
    passed: { bg: '$successSoft', color: '$successStrong' },
    failed: { bg: '$dangerSoft', color: '$danger' },
  } as const;
  const statusColors = colors[status];

  return (
    <XStack bg={statusColors.bg} px="$sm" py="$xs" style={{ borderRadius: 9999 }}>
      <Text color={statusColors.color} fontSize={12} fontWeight="600">
        {getStatusLabel(t, status)}
      </Text>
    </XStack>
  );
}
