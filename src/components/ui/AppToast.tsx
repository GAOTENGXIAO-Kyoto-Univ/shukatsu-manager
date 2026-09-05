import { Text, YStack } from 'tamagui';

export function AppToast({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <YStack
      bg="$accentStrong"
      px="$base"
      py="$md"
      style={{
        borderRadius: 12,
        bottom: 16,
        position: 'fixed',
        right: 16,
        zIndex: 1000,
      }}
    >
      <Text color="$surface" fontWeight="600">
        {message}
      </Text>
    </YStack>
  );
}
