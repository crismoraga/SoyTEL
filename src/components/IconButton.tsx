import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';
import { PressableScale } from './PressableScale';
import { TelIcon, type IconName } from './TelIcon';
import { TelText } from './TelText';

type Tone = 'dark' | 'light' | 'glass' | 'cream';

interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  tone?: Tone;
  size?: number;
  badge?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const tones: Record<Tone, { bg: string; fg: string }> = {
  dark: { bg: colors.primarySoft, fg: colors.cream },
  light: { bg: colors.surfaceAlt, fg: colors.ink },
  glass: { bg: 'rgba(11, 45, 69, 0.72)', fg: colors.cream },
  cream: { bg: colors.cream, fg: colors.primary },
};

export function IconButton({ icon, onPress, tone = 'light', size = 44, badge, accessibilityLabel, style, disabled }: IconButtonProps) {
  const palette = tones[tone];
  const label = badge ? `${accessibilityLabel}, ${badge} sin leer` : accessibilityLabel;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      haptic
      hitSlop={6}
      style={[styles.base, { width: size, height: size, backgroundColor: palette.bg }, disabled && styles.disabled, style]}
    >
      <TelIcon name={icon} size={Math.round(size * 0.5)} color={palette.fg} />
      {Boolean(badge) && (
        <View style={styles.badge}>
          <TelText variant="small" color="primary" style={styles.badgeText}>
            {badge && badge > 9 ? '9+' : badge}
          </TelText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
