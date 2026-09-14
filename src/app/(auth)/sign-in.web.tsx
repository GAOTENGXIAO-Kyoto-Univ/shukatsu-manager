import { SignIn } from '@clerk/expo/web';
import { StyleSheet, View } from 'react-native';

import { AuthLanguageSwitcher } from '@/components/i18n/AuthLanguageSwitcher';

export default function SignInScreen() {
  return (
    <View style={styles.container}>
      <AuthLanguageSwitcher />
      <SignIn signUpUrl="/sign-up" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: 20,
    justifyContent: 'center',
    padding: 24,
  },
});
