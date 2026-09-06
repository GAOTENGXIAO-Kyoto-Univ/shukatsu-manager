import { SensitiveReplayMask } from '@/components/analytics/SensitiveReplayMask';
import { AuthBootstrap, AuthLoadingState, ConvexAuthErrorState } from '@/components/AuthBootstrap';
import { DashboardScreen } from '@/components/dashboard/DashboardScreen';
import { LandingPage } from '@/components/landing/LandingPage';
import { AppShell } from '@/components/navigation/AppShell';
import { useAuth } from '@clerk/expo';
import { useConvexAuth } from 'convex/react';

export default function IndexRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded || isLoading) {
    return <AuthLoadingState />;
  }

  if (isSignedIn && !isAuthenticated) {
    return <ConvexAuthErrorState />;
  }

  if (isAuthenticated) {
    return (
      <AuthBootstrap>
        <AppShell>
          <SensitiveReplayMask>
            <DashboardScreen />
          </SensitiveReplayMask>
        </AppShell>
      </AuthBootstrap>
    );
  }

  return <LandingPage />;
}
