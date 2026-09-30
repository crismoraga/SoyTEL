import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';

export type TileState = 'idle' | 'correct' | 'wrong' | 'dimmed';

interface ChoiceTileProps {
  label: string;
  icon?: IconName;
  state?: TileState;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

// Opción grande con ícono para los microjuegos de elección rápida.
export function ChoiceTile({ label, icon, state = 'idle', disabled, onPress, style, children }: PropsWithChildren<ChoiceTileProps>) {
  const palette =
    state === 'correct'
      ? { bg: '#1F5E43', border: '#6BC59A', fg: colors.white }
      : state === 'wrong'
        ? { bg: '#6E2A2A', border: '#E58A8A', fg: colors.white }
        : state === 'dimmed'
          ? { bg: colors.primarySoft, border: 'rgba(167,212,237,0.1)', fg: colors.slate }
          : { bg: colors.primarySoft, border: 'rgba(167,212,237,0.3)', fg: colors.cream };
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      haptic
      onPress={onPress}
      scaleTo={0.94}
      style={[styles.tile, { backgroundColor: palette.bg, borderColor: palette.border }, style]}
    >
      {icon && (
        <View style={styles.tileIcon}>
          <TelIcon name={icon} size={26} color={colors.primary} />
        </View>
      )}
      {children}
      <TelText variant="label" align="center" style={{ color: palette.fg }}>
        {label}
      </TelText>
    </PressableScale>
  );
}

export function TileGrid({ children }: PropsWithChildren) {
  return <View style={styles.grid}>{children}</View>;
}

export function GameCaption({ children }: PropsWithChildren) {
  return (
    <TelText variant="label" color="accentSoft" align="center">
      {children}
    </TelText>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
