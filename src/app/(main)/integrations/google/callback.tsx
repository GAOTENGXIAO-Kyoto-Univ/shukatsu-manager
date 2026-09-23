import { CheckCircle2, CircleAlert } from '@tamagui/lucide-icons-2';
import { useAction } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner, Text, YStack } from 'tamagui';

import { api } from '../../../../../convex/_generated/api';
import { AppButton } from '@/components/ui/AppButton';

export default function GoogleOAuthCallbackScreen() {
  const { t } = useTranslation('gmail');
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string | string[];
  }>();
  const completeAuthorization = useAction(api.googleOAuth.completeGmailAuthorization);
  const started = useRef(false);
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working');
  const [message, setMessage] = useState(t('callback.completing'));
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const state = Array.isArray(params.state) ? params.state[0] : params.state;
  const callbackError = Array.isArray(params.error) ? params.error[0] : params.error;
  const callbackInvalid = Boolean(callbackError || !code || !state);
  const displayStatus = callbackInvalid ? 'error' : status;
  const displayMessage = callbackInvalid
    ? callbackError === 'access_denied'
      ? t('callback.cancelled')
      : t('callback.invalid')
    : message;

  useEffect(() => {
    if (started.current) return;
    if (!code || !state || callbackError) return;
    started.current = true;

    void completeAuthorization({ code, state })
      .then(() => {
        setStatus('success');
        setMessage(t('callback.success'));
      })
      .catch(() => {
        setStatus('error');
        setMessage(t('callback.failed'));
      });
  }, [callbackError, code, completeAuthorization, state, t]);

  return (
    <YStack bg="$background" flex={1} p="$base" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <YStack
        bg="$surface"
        borderColor="$border"
        borderWidth={1}
        gap="$md"
        maxW={520}
        p="$xl"
        width="100%"
        style={{ alignItems: 'center', borderRadius: 18 }}
      >
        {displayStatus === 'working' ? <Spinner color="$accentStrong" size="large" /> : null}
        {displayStatus === 'success' ? <CheckCircle2 color="$success" size={36} /> : null}
        {displayStatus === 'error' ? <CircleAlert color="$danger" size={36} /> : null}
        <Text color="$text" fontSize={20} fontWeight="600" style={{ textAlign: 'center' }}>
          {t('callback.title')}
        </Text>
        <Text color="$textSecondary" fontSize={14} lineHeight={22} style={{ textAlign: 'center' }}>
          {displayMessage}
        </Text>
        {displayStatus !== 'working' ? (
          <AppButton variant="primary" onPress={() => router.replace('/profile')}>
            {t('callback.back')}
          </AppButton>
        ) : null}
      </YStack>
    </YStack>
  );
}
