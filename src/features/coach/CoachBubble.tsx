import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Rutix } from '@/components/graphics/Rutix';
import { TelText } from '@/components/TelText';
import { coachLooks, type CoachMood } from '@/data/coachLines';
import { useMotionEnabled } from '@/lib/motion';
import { useSettings } from '@/storage/settings';
import { colors, radius, spacing } from '@/theme';

export type BubbleTone = 'info' | 'good' | 'bad';

interface CoachBubbleProps {
  mood?: CoachMood;
  tone?: BubbleTone;
  size?: number;
  // Con Rutix a la derecha la burbuja queda a la izquierda.
  side?: 'left' | 'right';
  title?: string;
  style?: StyleProp<ViewStyle>;
  // Clave para repetir la animación aunque el texto no cambie.
  bounceKey?: string | number;
}

// Colores fijos: la burbuja vive sobre los fondos azul noche de los juegos en ambos temas.
const tones: Record<BubbleTone, { bg: string; fg: string }> = {
  info: { bg: colors.cream, fg: colors.primary },
  good: { bg: '#DDF3E6', fg: '#16513A' },
  bad: { bg: '#FBE2E2', fg: '#842626' },
};

export function useCoachEnabled(): boolean {
  return useSettings().coach;
}

// Rutix hablando: mascota + burbuja de diálogo. Es la voz de las pistas y reacciones en los juegos.
export function CoachBubble({ mood = 'tip', tone = 'info', size = 48, side = 'left', title, style, bounceKey, children }: PropsWithChildren<CoachBubbleProps>) {
  const motion = useMotionEnabled();
  const look = coachLooks[mood];
  const palette = tones[tone];
  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : undefined;
  const key = bounceKey ?? text ?? mood;
  const rutix = <Rutix size={size} expression={look.expression} pose={look.pose} reactKey={key} animated={false} accessibilityLabel="" />;
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={text ? `Rutix dice: ${title ? `${title}. ` : ''}${text}` : undefined} style={[styles.row, side === 'right' && styles.rowReverse, style]}>
      {rutix}
      <Animated.View key={String(key)} entering={motion ? FadeIn.duration(180) : undefined} style={[styles.bubble, { backgroundColor: palette.bg }]}>
        <View style={[styles.tail, side === 'right' ? styles.tailRight : styles.tailLeft, { backgroundColor: palette.bg }]} />
        {title && (
          <TelText variant="small" style={{ color: palette.fg, opacity: 0.75 }}>
            {title.toUpperCase()}
          </TelText>
        )}
        <TelText variant="caption" style={{ color: palette.fg }}>
          {children}
        </TelText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  bubble: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 1,
  },
  tail: {
    position: 'absolute',
    top: '50%',
    width: 10,
    height: 10,
    marginTop: -5,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  tailLeft: {
    left: -4,
  },
  tailRight: {
    right: -4,
  },
});
