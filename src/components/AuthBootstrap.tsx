import { api } from '../../convex/_generated/api';
import { useAuth } from '@clerk/expo';
import { useMutation } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccountMenu } from './AccountMenu';
import { analytics } from '@/lib/analytics';

type BootstrapState = 'loading' | 'ready' | 'error';

type AuthBootstrapProps = {
  children: ReactNode;
};

export function AuthBootstrap({ children }: AuthBootstrapProps) {
  const { userId } = useAuth();
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
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

        if (isCurrent) {
          setState('ready');
        }
      } catch (error) {
        if (isCurrent) {
          setState('error');
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    void ensureUser();

    return () => {
      isCurrent = false;
    };
  }, [ensureCurrentUser, retryCount, userId]);

  if (state === 'ready') {
    return <>{children}</>;
  }

  if (state === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>账户初始化失败</Text>
        {errorMessage ? <Text style={styles.message}>{errorMessage}</Text> : null}
        <Pressable style={styles.button} onPress={() => setRetryCount((count) => count + 1)}>
          <Text style={styles.buttonText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.message}>正在初始化账户...</Text>
    </View>
  );
}

export function AuthLoadingState() {
  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.message}>正在确认登录状态...</Text>
    </View>
  );
}

export function ConvexAuthErrorState() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Convex 登录状态未就绪</Text>
      <Text style={styles.message}>
        Clerk 已经登录，但 Convex 还没有接受 Clerk 的认证 token。请确认 Clerk 后台已启用 Convex
        integration，或已创建名为 convex 的 JWT template。
      </Text>
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
