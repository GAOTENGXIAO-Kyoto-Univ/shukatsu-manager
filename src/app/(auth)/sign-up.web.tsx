import { SignUp } from '@clerk/expo/web';
import { StyleSheet, View } from 'react-native';

export default function SignUpScreen() {
  return (
    <View style={styles.container}>
      <SignUp signInUrl="/sign-in" />
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
