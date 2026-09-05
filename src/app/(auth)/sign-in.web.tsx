import { SignIn } from '@clerk/expo/web';
import { StyleSheet, View } from 'react-native';

export default function SignInScreen() {
  return (
    <View style={styles.container}>
      <SignIn signUpUrl="/sign-up" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
