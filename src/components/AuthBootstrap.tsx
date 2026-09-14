import { api } from '../../convex/_generated/api';
import { useAuth } from '@clerk/expo';
import { useMutation } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AccountMenu } from './AccountMenu';
import { analytics } from '@/lib/analytics';
import { i18n, reconcileSignedInLocale } from '@/i18n';

type BootstrapState = 'loading' | 'ready' | 'error';

type AuthBootstrapProps = {
  children: ReactNode;
};

export function AuthBootstrap({ children }: AuthBootstrapProps) {
  const { t } = useTranslation(['auth', 'common']);
  const { userId } = useAuth();
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const updateLocale = useMutation(api.users.updateLocale);
  const [state, setState] = useState<BootstrapState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function ensureUser() {
      setState('loading');
      setErrorMessage(null);

      try {
        if (userId) analytics.identify(userId);
        const result = await ensureCurrentUser({});
        if (result.wasCreated) analytics.userSignedUp();
        const { localeToPersist } = await reconcileSignedInLocale(result.locale);

        if (localeToPersist) {
          try {
            await updateLocale({ locale: localeToPersist });
          } catch {
            // Keep the locally selected language and retry carry-over on the next authenticated boot.
          }
        }

        if (isCurrent) {
          setState('ready');
        }
      } catch (error) {
        if (isCurrent) {
          setState('error');
          setErrorMessage(error instanceof Error ? error.message : i18n.t('common:errors.operation'));
        }
      }
    }

    void ensureUser();

    return () => {
      isCurrent = false;
    };
  }, [ensureCurrentUser, retryCount, updateLocale, userId]);

  if (state === 'ready') {
    return <>{children}</>;
  }

  if (state === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('auth:initializationFailed')}</Text>
        {errorMessage ? <Text style={styles.message}>{errorMessage}</Text> : null}
        <Pressable style={styles.button} onPress={() => setRetryCount((count) => count + 1)}>
          <Text style={styles.buttonText}>{t('common:actions.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.message}>{t('auth:initializing')}</Text>
    </View>
  );
}

export function AuthLoadingState() {
  const { t } = useTranslation('auth');
  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.message}>{t('checking')}</Text>
    </View>
  );
}

export function ConvexAuthErrorState() {
  const { t } = useTranslation('auth');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('convexNotReady')}</Text>
      <Text style={styles.message}>{t('convexNotReadyDescription')}</Text>
      <AccountMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderColor: '#111827',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    color: '#4b5563',
    fontSize: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
});
