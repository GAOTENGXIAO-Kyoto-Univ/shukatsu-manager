import {
  AuthBootstrap,
  AuthLoadingState,
  ConvexAuthErrorState,
} from '@/components/AuthBootstrap';
import { AppShell } from '@/components/navigation/AppShell';
import { useAuth } from '@clerk/expo';
import { useConvexAuth } from 'convex/react';
import { Redirect, Stack } from 'expo-router';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded || isLoading) {
    return <AuthLoadingState />;
  }

  if (isSignedIn && !isAuthenticated) {
    return <ConvexAuthErrorState />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <AuthBootstrap>
      <AppShell>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="companies" />
          <Stack.Screen name="applications/[applicationId]" />
          <Stack.Screen name="applications/[applicationId]/research" />
          <Stack.Screen name="applications/[applicationId]/interviews/[selectionStepId]" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="knowledge" />
          <Stack.Screen name="knowledge/items" />
          <Stack.Screen name="knowledge/frequent" />
          <Stack.Screen name="knowledge/frequent/[questionGroupId]" />
          <Stack.Screen name="knowledge/weak-answers" />
          <Stack.Screen name="knowledge/weak-answers/[questionGroupId]" />
          <Stack.Screen name="knowledge/weaknesses" />
          <Stack.Screen name="knowledge/weaknesses/[weaknessGroupId]" />
          <Stack.Screen name="knowledge/reverse-questions" />
          <Stack.Screen name="profile" />
        </Stack>
      </AppShell>
    </AuthBootstrap>
  );
}
