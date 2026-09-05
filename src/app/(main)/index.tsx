import { ScrollView } from 'react-native';
import { Text, XStack, YStack, useMedia } from 'tamagui';

import {
  RecentProgressSection,
  SelectionSummarySection,
  UpcomingItemsSection,
} from '@/components/dashboard/DashboardSections';
import { useTimeBucket } from '@/hooks/useTimeBucket';

export default function DashboardScreen() {
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
                你好！
              </Text>
              <Text color="$textSecondary" fontSize={isDesktop ? 16 : 14} lineHeight={22}>
                继续加油！今天也朝着理想的未来前进吧。
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
                一歩ずつ、きっとたどり着ける。
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
