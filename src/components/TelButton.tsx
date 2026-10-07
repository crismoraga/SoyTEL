import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, type ColorToken } from '@/theme';
import { DotsLoader } from './feedback/Loaders';
import { PressableScale } from './PressableScale';
import { TelIcon, type IconName } from './TelIcon';
import { TelText } from './TelText';

export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'cream'
  | 'secondary'
  | 'subtle'
  | 'outline'
  | 'outlineLight'
  | 'ghost'
  | 'ghostLight'
  | 'danger'
  | 'dangerOutlineLight'
  | 'dangerOutline'
  | 'success';

interface TelButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

const variantColors: Record<ButtonVariant, { bg: string; fg: ColorToken; border?: string }> = {
  primary: { bg: colors.action, fg: 'actionInk' },
  accent: { bg: colors.accent, fg: 'primary' },
  cream: { bg: colors.cream, fg: 'primary' },
  secondary: { bg: colors.accentSoft, fg: 'primary' },
  subtle: { bg: colors.surfaceAlt, fg: 'inkAccent' },
  outline: { bg: 'transparent', fg: 'ink', border: colors.ink },
  outlineLight: { bg: 'rgba(11, 45, 69, 0.55)', fg: 'cream', border: 'rgba(167, 212, 237, 0.55)' },
  ghost: { bg: 'transparent', fg: 'inkAccent' },
  // Sobre fondos azul noche (pantallas de juego).
  ghostLight: { bg: 'transparent', fg: 'accentSoft' },
  danger: { bg: colors.danger, fg: 'white' },
  dangerOutline: { bg: 'transparent', fg: 'dangerText', border: colors.dangerText },
  // Acción destructiva sobre fondos azul noche.
  dangerOutlineLight: { bg: 'rgba(11, 45, 69, 0.55)', fg: 'dangerLight', border: 'rgba(255, 156, 156, 0.6)' },
  success: { bg: colors.success, fg: 'white' },
};

const sizes = {
  sm: { height: 40, radius: radius.sm, padding: spacing.md, icon: 18 },
  md: { height: 52, radius: radius.md, padding: spacing.lg, icon: 20 },
  lg: { height: 56, radius: radius.md, padding: spacing.lg, icon: 20 },
} as const;

export function TelButton({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = true,
  haptic = true,
  disabled,
  style,
  accessibilityLabel,
  ...props
}: TelButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const palette = variantColors[variant];
  const metrics = sizes[size];
  const filled = !palette.border && palette.bg !== 'transparent';
  const fgToken: ColorToken = isDisabled && filled ? 'inkSoft' : palette.fg;
  const fg = colors[fgToken];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic={haptic}
      style={[
        styles.base,
        {
          minHeight: metrics.height,
          borderRadius: metrics.radius,
          paddingHorizontal: metrics.padding,
          backgroundColor: isDisabled && filled ? colors.border : palette.bg,
          borderColor: palette.border,
          borderWidth: palette.border ? 1.5 : 0,
        },
        fullWidth && styles.fullWidth,
        isDisabled && !filled && styles.disabledOutline,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <DotsLoader color={fg} />
      ) : (
        <View style={styles.content}>
          {icon && <TelIcon name={icon} size={metrics.icon} color={fg} strokeWidth={2.2} />}
          <TelText variant={size === 'sm' ? 'label' : 'button'} color={fgToken} align="center" numberOfLines={2}>
            {label}
          </TelText>
          {iconRight && <TelIcon name={iconRight} size={metrics.icon} color={fg} strokeWidth={2.2} />}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  disabledOutline: {
    opacity: 0.5,
  },
});
