import { XStack, YStack, Text, Spinner } from 'tamagui';
import { useTranslation } from 'react-i18next';

import { AppButton } from './AppButton';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation(['companies', 'common']);
  return (
    <YStack gap="$md" p="$xl" style={{ alignItems: 'center' }}>
      <Text color="$text" fontSize={20} fontWeight="600">
        {t('companies:noApplications')}
      </Text>
      <Text color="$textSecondary" fontSize={15} lineHeight={22} style={{ textAlign: 'center' }}>
        {t('companies:emptyDescription')}
      </Text>
      <AppButton variant="primary" onPress={onAdd}>
        {t('common:actions.add')}
      </AppButton>
    </YStack>
  );
}

export function MessageState({
  actionLabel,
  message,
  onAction,
}: {
  actionLabel: string;
  message: string;
  onAction: () => void;
}) {
  return (
    <YStack gap="$md" p="$xl" style={{ alignItems: 'center' }}>
      <Text color="$textSecondary" fontSize={16} style={{ textAlign: 'center' }}>
        {message}
      </Text>
      <AppButton onPress={onAction}>{actionLabel}</AppButton>
    </YStack>
  );
}

export function ApplicationListSkeleton() {
  return (
    <YStack gap="$base" pt="$md">
      {[0, 1, 2].map((item) => (
        <YStack key={item} gap="$sm" py="$md">
          <XStack style={{ justifyContent: 'space-between' }}>
            <SkeletonBlock width="42%" height={18} />
            <SkeletonBlock width={32} height={24} />
          </XStack>
          <SkeletonBlock width="30%" height={16} />
          <SkeletonBlock width="26%" height={14} />
        </YStack>
      ))}
    </YStack>
  );
}

export function LoadingState({ message }: { message: string }) {
  return (
    <YStack gap="$md" p="$xl" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Spinner color="$accentStrong" />
      <Text color="$textSecondary">{message}</Text>
    </YStack>
  );
}

function SkeletonBlock({ height, width }: { height: number; width: number | `${number}%` }) {
  return <YStack bg="$surfaceMuted" height={height} width={width} style={{ borderRadius: 8 }} />;
}
