import { ScrollView } from 'react-native';
import { Text, XStack, YStack, useMedia } from 'tamagui';
import { useTranslation } from 'react-i18next';

import {
  RecentProgressSection,
  SelectionSummarySection,
  UpcomingItemsSection,
} from '@/components/dashboard/DashboardSections';
import { useTimeBucket } from '@/hooks/useTimeBucket';

export function DashboardScreen() {
  const { t } = useTranslation('dashboard');
  const media = useMedia();
  const timeBucket = useTimeBucket();
  const isDesktop = Boolean(media.md);

  return (
    <YStack flex={1} bg="$background">
      <ScrollView style={{ flex: 1 }}>
        <YStack
          gap="$lg"
          maxW={960}
          p={isDesktop ? '$xl' : '$base'}
          pb="$xxl"
          width="100%"
        >
          <XStack
            gap="$lg"
            py={isDesktop ? '$md' : '$sm'}
            style={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <YStack gap="$xs" flex={1}>
              <Text
                color="$text"
                fontSize={isDesktop ? 34 : 28}
                fontWeight="600"
                lineHeight={isDesktop ? 43 : 36}
              >
                {t('greeting')}
              </Text>
              <Text color="$textSecondary" fontSize={isDesktop ? 16 : 14} lineHeight={22}>
                {t('encouragement')}
              </Text>
            </YStack>
            {isDesktop ? (
              <Text
                color="$textSecondary"
                fontSize={16}
                fontStyle="italic"
                letterSpacing={2}
                style={{ transform: [{ rotate: '-3deg' }] }}
              >
                {t('motto')}
              </Text>
            ) : null}
          </XStack>
          <UpcomingItemsSection timeBucket={timeBucket} />
          <SelectionSummarySection timeBucket={timeBucket} />
          <RecentProgressSection timeBucket={timeBucket} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
