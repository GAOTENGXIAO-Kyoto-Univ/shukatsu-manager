import { ClerkProvider, useAuth } from '@clerk/expo';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';

import tamaguiConfig from '../../tamagui.config';
import { AnalyticsLifecycle } from '@/components/analytics/AnalyticsLifecycle';

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const clerkPublishableKey = requireEnv(
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
);
const convex = new ConvexReactClient(
  requireEnv(process.env.EXPO_PUBLIC_CONVEX_URL, 'EXPO_PUBLIC_CONVEX_URL'),
);

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <AnalyticsLifecycle />
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(main)" />
          </Stack>
        </TamaguiProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
