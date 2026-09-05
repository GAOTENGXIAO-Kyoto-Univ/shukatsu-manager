import { Input, GetProps } from 'tamagui';

import { warmPaperColors } from '../../../tamagui.config';

export function AppInput(props: GetProps<typeof Input>) {
  return (
    <Input
      color="$text"
      minH={42}
      placeholderTextColor="$textMuted"
      style={{
        backgroundColor: warmPaperColors.surface,
        borderColor: warmPaperColors.border,
        borderRadius: 12,
      }}
      {...props}
    />
  );
}
