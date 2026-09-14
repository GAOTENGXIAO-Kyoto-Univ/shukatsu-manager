import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AuthLanguageSwitcher } from '@/components/i18n/AuthLanguageSwitcher';

export default function SignUpFallbackScreen() {
  const { t } = useTranslation('auth');
  return (
    <View style={styles.container}>
      <AuthLanguageSwitcher />
      <Text style={styles.title}>{t('signUpWebOnly')}</Text>
      <Link href="/sign-in" style={styles.link}>
        {t('backToSignIn')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  link: {
    color: '#2563eb',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
