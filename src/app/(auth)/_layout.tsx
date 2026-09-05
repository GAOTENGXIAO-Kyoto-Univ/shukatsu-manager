import { AuthLoadingState, ConvexAuthErrorState } from '@/components/AuthBootstrap';
import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { useConvexAuth } from 'convex/react';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded || isLoading) {
    return <AuthLoadingState />;
  }

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  if (isSignedIn) {
    return <ConvexAuthErrorState />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
