import { useAuth } from '@clerk/expo';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { analytics } from '@/lib/analytics';
import { analyticsPageForPathname } from '@/lib/analytics/routes';

export function AnalyticsLifecycle() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const pathname = usePathname();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    analytics.initialize();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && userId) {
      if (previousUserId.current && previousUserId.current !== userId) {
        analytics.setSessionRecordingEnabled(false);
        analytics.reset();
      }
      analytics.identify(userId);
      previousUserId.current = userId;
      return;
    }

    if (previousUserId.current) {
      analytics.setSessionRecordingEnabled(false);
      analytics.reset();
      previousUserId.current = null;
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      analytics.setSessionRecordingEnabled(false);
      return;
    }

    const page = analyticsPageForPathname(pathname);
    analytics.setSessionRecordingEnabled(page !== null && page !== 'profile');
    if (page) analytics.pageViewed(page, `${userId}:${pathname}`);
  }, [isLoaded, isSignedIn, pathname, userId]);

  return null;
}
