import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SignUpFallbackScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>注册目前仅支持 Web。</Text>
      <Link href="/sign-in" style={styles.link}>
        返回登录
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
