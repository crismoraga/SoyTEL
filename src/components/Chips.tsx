import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, type ColorToken } from '@/theme';
import { PressableScale } from './PressableScale';
import { TelIcon, type IconName } from './TelIcon';
import { TelText } from './TelText';

interface ChipOption<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: IconName;
}

interface ChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: 'dark' | 'light';
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  inset?: number;
}

// Filtros tipo "Todas · Ruta · Actividades" del centro de avisos.
export function ChipGroup<T extends string>({ options, value, onChange, tone = 'light', accessibilityLabel, style, inset = 0 }: ChipGroupProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.scroller, { marginHorizontal: -inset }, style]}
      contentContainerStyle={[styles.group, { paddingHorizontal: inset }]}
    >
      {options.map((option) => {
        const active = option.id === value;
        const palette = tone === 'dark'
          ? active
            ? { bg: colors.cream, border: colors.cream, fg: 'primary' as ColorToken }
            : { bg: 'transparent', border: colors.secondary, fg: 'onDark' as ColorToken }
          : active
            ? { bg: colors.action, border: colors.action, fg: 'actionInk' as ColorToken }
            : { bg: colors.surface, border: colors.border, fg: 'inkAccent' as ColorToken };
        return (
          <PressableScale
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.count !== undefined ? `${option.label}, ${option.count}` : option.label}
            onPress={() => onChange(option.id)}
            haptic
            style={[styles.chip, { backgroundColor: palette.bg, borderColor: palette.border }]}
          >
            {option.icon && <TelIcon name={option.icon} size={16} color={colors[palette.fg]} />}
            <TelText variant="label" color={palette.fg} style={styles.chipText}>
              {option.count !== undefined ? `${option.label} · ${option.count}` : option.label}
            </TelText>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

export type TagTone = 'navy' | 'cream' | 'success' | 'neutral' | 'sky' | 'warning' | 'danger' | 'glass';

const tagTones: Record<TagTone, { bg: string; fg: ColorToken }> = {
  navy: { bg: colors.primary, fg: 'cream' },
  cream: { bg: colors.cream, fg: 'primary' },
  success: { bg: colors.successSoft, fg: 'successInk' },
  neutral: { bg: colors.surfaceAlt, fg: 'inkSoft' },
  sky: { bg: colors.highlight, fg: 'inkAccent' },
  warning: { bg: colors.warningSoft, fg: 'warningInk' },
  danger: { bg: colors.dangerSoft, fg: 'dangerInk' },
  glass: { bg: 'rgba(167, 212, 237, 0.16)', fg: 'accentSoft' },
};

interface TagProps {
  label: string;
  tone?: TagTone;
  icon?: IconName;
  live?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Tag({ label, tone = 'neutral', icon, live = false, style }: TagProps) {
  const palette = tagTones[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.bg }, style]}>
      {live && <View style={styles.liveDot} />}
      {icon && <TelIcon name={icon} size={13} color={colors[palette.fg]} strokeWidth={2.6} />}
      <TelText variant="small" color={palette.fg} style={styles.tagText}>
        {label}
      </TelText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroller: {
    flexGrow: 0,
  },
  group: {
    gap: spacing.xs,
    flexDirection: 'row',
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    fontSize: 13,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  tagText: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
