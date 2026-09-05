import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SignInFallbackScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>登录目前仅支持 Web。</Text>
      <Link href="/sign-up" style={styles.link}>
        创建账户
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
