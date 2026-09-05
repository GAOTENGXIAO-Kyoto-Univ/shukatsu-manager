import { ChevronLeft } from '@tamagui/lucide-icons-2';
import { Href, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';

export function KnowledgePage({
  alignWithPrimaryPages = false,
  children,
}: {
  alignWithPrimaryPages?: boolean;
  children: React.ReactNode;
}) {
  return (
    <YStack flex={1} bg="$background">
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack
          gap="$xl"
          maxW={1180}
          width="100%"
          p={alignWithPrimaryPages ? '$xl' : '$base'}
          pb="$xxl"
          style={{ alignSelf: alignWithPrimaryPages ? 'flex-start' : 'center' }}
        >
          {children}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export function KnowledgeHeader({
  action,
  backHref = '/knowledge',
  description,
  title,
}: {
  action?: React.ReactNode;
  backHref?: Href;
  description?: string;
  title: string;
}) {
  const router = useRouter();
  return (
    <YStack borderBottomColor="$border" borderBottomWidth={1} gap="$base" pb="$lg" pt="$md">
      <AppButton variant="ghost" icon={<ChevronLeft size={18} />} onPress={() => router.push(backHref)} style={{ alignSelf: 'flex-start' }}>
        返回
      </AppButton>
      <XStack gap="$base" flexWrap="wrap" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <YStack flex={1} gap="$xs" style={{ minWidth: 240 }}>
          <Text color="$text" fontSize={30} fontWeight="600" lineHeight={38}>{title}</Text>
          {description ? <Text color="$textSecondary" lineHeight={22}>{description}</Text> : null}
        </YStack>
        {action}
      </XStack>
    </YStack>
  );
}

export function KnowledgeEmpty({ message }: { message: string }) {
  return <YStack borderTopColor="$border" borderTopWidth={1} py="$xl"><Text color="$textMuted">{message}</Text></YStack>;
}

export function SearchInput({ onChangeText, placeholder, value }: { onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return <AppInput maxW={520} width="100%" placeholder={placeholder} value={value} onChangeText={onChangeText} />;
}
