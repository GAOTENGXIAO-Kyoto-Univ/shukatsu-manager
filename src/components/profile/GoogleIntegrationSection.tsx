import { Mail, Unplug } from '@tamagui/lucide-icons-2';
import { useAction, useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner, Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { AppButton } from '@/components/ui/AppButton';

export function GoogleIntegrationSection() {
  const { t } = useTranslation('gmail');
  const router = useRouter();
  const connection = useQuery({ query: api.googleConnections.current, args: {} });
  const beginAuthorization = useAction(api.googleOAuth.beginGmailAuthorization);
  const disableGmail = useMutation(api.googleConnections.disableGmail);
  const disconnectGoogle = useMutation(api.googleConnections.disconnectGoogle);
  const [busyAction, setBusyAction] = useState<'connect' | 'disable' | 'disconnect' | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (busyAction) return;
    setBusyAction('connect');
    setError(null);
    try {
      const result = await beginAuthorization({});
      window.location.assign(result.authorizationUrl);
    } catch {
      setError(t('errors.connection'));
      setBusyAction(null);
    }
  }

  async function disable() {
    if (busyAction) return;
    setBusyAction('disable');
    setError(null);
    try {
      await disableGmail({});
    } catch {
      setError(t('errors.operation'));
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnect() {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    if (busyAction) return;
    setBusyAction('disconnect');
    setError(null);
    try {
      await disconnectGoogle({});
      setConfirmDisconnect(false);
    } catch {
      setError(t('errors.operation'));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <YStack gap="$sm">
      <Text color="$textSecondary" fontSize={14} fontWeight="600" px="$xs">
        {t('profile.sectionTitle')}
      </Text>
      <YStack
        bg="$surface"
        borderColor="$border"
        borderWidth={1}
        gap="$md"
        p="$base"
        style={{ borderRadius: 16 }}
      >
        <XStack gap="$md" style={{ alignItems: 'center' }}>
          <YStack
            bg="$accentSoft"
            height={42}
            width={42}
            style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
          >
            <Mail color="$accentStrong" size={21} />
          </YStack>
          <YStack flex={1} gap="$xs">
            <Text color="$text" fontSize={15} fontWeight="600">
              {t('profile.title')}
            </Text>
            {connection.status === 'pending' ? (
              <XStack gap="$sm" style={{ alignItems: 'center' }}>
                <Spinner color="$textMuted" size="small" />
                <Text color="$textMuted" fontSize={13}>{t('profile.loading')}</Text>
              </XStack>
            ) : connection.status === 'error' ? (
              <Text color="$danger" fontSize={13}>{t('errors.loadConnection')}</Text>
            ) : (
              <Text color="$textSecondary" fontSize={13}>
                {connection.data?.email ?? t('profile.notConnected')}
              </Text>
            )}
          </YStack>
        </XStack>

        {connection.status === 'success' && connection.data ? (
          <YStack gap="$sm">
            {connection.data.credentialStatus === 'reauth_required' ? (
              <Text color="$danger" fontSize={13}>{t('profile.reauthRequired')}</Text>
            ) : !connection.data.gmailEnabled ? (
              <Text color="$textSecondary" fontSize={13}>{t('profile.disabled')}</Text>
            ) : (
              <Text color="$success" fontSize={13}>{t('profile.connected')}</Text>
            )}
            <XStack flexWrap="wrap" gap="$sm">
              {connection.data.gmailEnabled && connection.data.credentialStatus === 'active' ? (
                <>
                  <AppButton variant="primary" onPress={() => router.push('/import/gmail' as Href)}>
                    {t('profile.import')}
                  </AppButton>
                  <AppButton disabled={Boolean(busyAction)} onPress={() => void disable()}>
                    {busyAction === 'disable' ? t('profile.disabling') : t('profile.disable')}
                  </AppButton>
                </>
              ) : (
                <AppButton
                  disabled={Boolean(busyAction)}
                  variant="primary"
                  onPress={() => void connect()}
                >
                  {busyAction === 'connect' ? t('profile.connecting') : t('profile.connect')}
                </AppButton>
              )}
              <AppButton
                disabled={Boolean(busyAction)}
                icon={<Unplug size={16} />}
                variant={confirmDisconnect ? 'danger' : 'ghost'}
                onPress={() => void disconnect()}
              >
                {busyAction === 'disconnect'
                  ? t('profile.disconnecting')
                  : confirmDisconnect
                    ? t('profile.confirmDisconnect')
                    : t('profile.disconnect')}
              </AppButton>
              {confirmDisconnect ? (
                <AppButton variant="ghost" onPress={() => setConfirmDisconnect(false)}>
                  {t('profile.cancelDisconnect')}
                </AppButton>
              ) : null}
            </XStack>
          </YStack>
        ) : connection.status === 'success' ? (
          <AppButton
            disabled={Boolean(busyAction)}
            variant="primary"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => void connect()}
          >
            {busyAction === 'connect' ? t('profile.connecting') : t('profile.connect')}
          </AppButton>
        ) : null}

        <Text color="$textMuted" fontSize={12} lineHeight={18}>
          {t('profile.privacy')}
        </Text>
        {error ? <Text color="$danger" fontSize={13}>{error}</Text> : null}
      </YStack>
    </YStack>
  );
}
