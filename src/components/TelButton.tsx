import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { TelText } from './TelText';

interface TelButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  /** Fondo sobre el que se dibuja el botón; solo cambia el texto de la variante ghost. */
  surface?: 'light' | 'dark';
  loading?: boolean;
  fullWidth?: boolean;
}

export function TelButton({
  label,
  variant = 'primary',
  surface = 'light',
  loading = false,
  fullWidth = true,
  disabled,
  style,
  ...props
}: PropsWithChildren<TelButtonProps>) {
  const isDisabled = disabled || loading;
  const labelColor = variant !== 'ghost' ? 'white' : surface === 'dark' ? 'white' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'object' ? style : undefined,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors[labelColor]} />
      ) : (
        <TelText
          variant="bodyStrong"
          color={labelColor}
          align="center"
        >
          {label}
        </TelText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  primary: {
    backgroundColor: colors.secondary,
  },
  secondary: {
    backgroundColor: colors.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  success: {
    backgroundColor: colors.success,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
