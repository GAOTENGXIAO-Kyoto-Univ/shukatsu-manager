import { Button, GetProps } from 'tamagui';

import { warmPaperColors } from '../../../tamagui.config';

type AppButtonProps = Omit<GetProps<typeof Button>, 'variant'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

const buttonVariants = {
  primary: {
    backgroundColor: warmPaperColors.accentStrong,
    color: '$surface',
    borderColor: warmPaperColors.accentStrong,
  },
  secondary: {
    backgroundColor: warmPaperColors.surface,
    color: '$text',
    borderColor: warmPaperColors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '$textSecondary',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: warmPaperColors.danger,
    color: '$surface',
    borderColor: warmPaperColors.danger,
  },
} as const;

export function AppButton({ variant = 'secondary', ...props }: AppButtonProps) {
  const { disabled, style, ...buttonProps } = props;
  const styles = buttonVariants[variant];

  return (
    <Button
      cursor={disabled ? 'not-allowed' : undefined}
      disabled={disabled}
      fontWeight="600"
      pressStyle={{ opacity: 0.78 }}
      style={{
        backgroundColor: disabled ? warmPaperColors.surfaceMuted : styles.backgroundColor,
        borderColor: disabled ? warmPaperColors.border : styles.borderColor,
        borderRadius: 12,
        borderWidth: 1,
        minHeight: 42,
        opacity: disabled ? 1 : undefined,
        ...(typeof style === 'object' && !Array.isArray(style) ? style : {}),
      }}
      color={disabled ? '$textMuted' : styles.color}
      {...buttonProps}
    />
  );
}
