import { SignUp } from '@clerk/expo/web';
import { StyleSheet, View } from 'react-native';

import { AuthLanguageSwitcher } from '@/components/i18n/AuthLanguageSwitcher';

export default function SignUpScreen() {
  return (
    <View style={styles.container}>
      <AuthLanguageSwitcher />
      <SignUp signInUrl="/sign-in" />
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
