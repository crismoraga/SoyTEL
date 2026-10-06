import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useEntering } from '@/lib/motion';
import { useSettings } from '@/storage/settings';
import { colors, radius, spacing, type ColorToken } from '@/theme';
import { PressableScale } from './PressableScale';
import { Rutix } from './graphics/Rutix';
import { TelIcon } from './TelIcon';
import { TelText } from './TelText';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed' | 'hidden';

interface OptionButtonProps {
  letter: string;
  label: string;
  state?: OptionState;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'light' | 'dark';
  mono?: boolean;
}

const lightStates: Record<OptionState, { bg: string; border: string; badgeBg: string; badgeFg: ColorToken; fg: ColorToken }> = {
  idle: { bg: colors.surface, border: colors.border, badgeBg: colors.surfaceAlt, badgeFg: 'inkAccent', fg: 'ink' },
  selected: { bg: colors.surfaceAlt, border: colors.inkAccent, badgeBg: colors.secondary, badgeFg: 'white', fg: 'ink' },
  correct: { bg: colors.successSoft, border: colors.success, badgeBg: colors.success, badgeFg: 'white', fg: 'ink' },
  wrong: { bg: colors.dangerSoft, border: colors.danger, badgeBg: colors.danger, badgeFg: 'white', fg: 'ink' },
  dimmed: { bg: colors.surface, border: colors.border, badgeBg: colors.surfaceAlt, badgeFg: 'inkSoft', fg: 'inkSoft' },
  hidden: { bg: colors.surface, border: colors.border, badgeBg: colors.surfaceAlt, badgeFg: 'inkSoft', fg: 'inkSoft' },
};

const darkStates: Record<OptionState, { bg: string; border: string; badgeBg: string; badgeFg: ColorToken; fg: ColorToken }> = {
  idle: { bg: colors.primarySoft, border: 'rgba(167, 212, 237, 0.25)', badgeBg: colors.primary, badgeFg: 'accent', fg: 'cream' },
  selected: { bg: '#1B4F75', border: colors.cream, badgeBg: colors.cream, badgeFg: 'primary', fg: 'cream' },
  correct: { bg: '#1F5E43', border: '#6BC59A', badgeBg: '#6BC59A', badgeFg: 'primary', fg: 'white' },
  wrong: { bg: '#6E2A2A', border: '#E58A8A', badgeBg: '#E58A8A', badgeFg: 'primary', fg: 'white' },
  dimmed: { bg: colors.primarySoft, border: 'rgba(167, 212, 237, 0.12)', badgeBg: colors.primary, badgeFg: 'slate', fg: 'slate' },
  hidden: { bg: colors.primarySoft, border: 'rgba(167, 212, 237, 0.12)', badgeBg: colors.primary, badgeFg: 'slate', fg: 'slate' },
};

// Alternativa A/B/C/D como en la pantalla "Reto de estación".
export function OptionButton({ letter, label, state = 'idle', onPress, disabled, tone = 'light', mono = false }: OptionButtonProps) {
  const palette = (tone === 'dark' ? darkStates : lightStates)[state];
  const hidden = state === 'hidden';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${letter}. ${label}`}
      accessibilityState={{ disabled: disabled || hidden, selected: state === 'selected' }}
      disabled={disabled || hidden}
      onPress={onPress}
      haptic
      scaleTo={0.98}
      style={[
        styles.option,
        { backgroundColor: palette.bg, borderColor: palette.border, borderWidth: state === 'idle' || state === 'dimmed' || hidden ? 1.5 : 2 },
        hidden && styles.hidden,
      ]}
    >
      <View style={[styles.badge, { backgroundColor: palette.badgeBg }]}>
        {state === 'correct' ? (
          <TelIcon name="check" size={16} color={colors[palette.badgeFg]} strokeWidth={3} />
        ) : state === 'wrong' ? (
          <TelIcon name="close" size={16} color={colors[palette.badgeFg]} strokeWidth={3} />
        ) : (
          <TelText variant="button" color={palette.badgeFg} style={styles.letter}>
            {letter}
          </TelText>
        )}
      </View>
      <TelText
        variant="bodyStrong"
        color={palette.fg}
        style={[styles.label, mono && styles.mono, hidden && styles.strike]}
      >
        {label}
      </TelText>
    </PressableScale>
  );
}

interface FeedbackPanelProps {
  kind: 'success' | 'error' | 'info';
  title: string;
  body?: string;
}

// Tarjeta de retroalimentación verde/roja con explicación breve.
export function FeedbackPanel({ kind, title, body, children }: PropsWithChildren<FeedbackPanelProps>) {
  const entering = useEntering();
  const { coach } = useSettings();
  const palette = kind === 'success'
    ? { bg: colors.successSoft, border: colors.success, icon: colors.success, title: 'successInk' as ColorToken, body: colors.successInk }
    : kind === 'error'
      ? { bg: colors.dangerSoft, border: colors.danger, icon: colors.danger, title: 'dangerInk' as ColorToken, body: colors.dangerInk }
      : { bg: colors.highlight, border: colors.borderStrong, icon: colors.inkAccent, title: 'ink' as ColorToken, body: colors.ink };
  return (
    <Animated.View
      entering={entering.fadeUp()}
      accessibilityLiveRegion="polite"
      style={[styles.panel, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <View style={styles.panelHead}>
        {coach && kind !== 'info' ? (
          <Rutix size={46} expression={kind === 'success' ? 'happy' : 'worried'} pose={kind === 'success' ? 'thumbsUp' : 'shrug'} animated={false} accessibilityLabel="" />
        ) : (
          <View style={[styles.panelIcon, { backgroundColor: palette.icon }]}>
            <TelIcon name={kind === 'success' ? 'check' : kind === 'error' ? 'close' : 'info'} size={18} color={colors.white} strokeWidth={3} />
          </View>
        )}
        <TelText variant="subtitle" color={palette.title} style={styles.flex}>
          {title}
        </TelText>
      </View>
      {body && (
        <TelText variant="body" style={[styles.panelBody, { color: palette.body }]}>
          {body}
        </TelText>
      )}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  hidden: {
    opacity: 0.4,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 14,
  },
  label: {
    flex: 1,
  },
  mono: {
    letterSpacing: 0.3,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  flex: {
    flex: 1,
  },
});
