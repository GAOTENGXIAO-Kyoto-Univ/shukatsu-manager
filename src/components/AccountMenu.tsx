import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export function AccountMenu() {
  const { t } = useTranslation('auth');
  return (
    <View>
      <Text>{t('accountMenuWebOnly')}</Text>
    </View>
  );
}
