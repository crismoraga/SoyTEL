import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { router, usePathname } from 'expo-router';
import { Medallion } from '@/components/graphics/Medallion';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { getAchievement } from '@/data/achievements';
import type { Achievement } from '@/types/game';
import { onAppEvent } from '@/lib/events';
import { feedbackSuccess } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius, spacing, tierColors } from '@/theme';

// Momento de logro: cuando se desbloquea un logro, la medalla entra girando en 3D, brilla y celebra.
// Si hay varios, se muestran uno tras otro. Durante un juego de la ruta en vivo espera a que termine.

export const MAX_IN_A_ROW = 3;

const CAREER_LINES = [
  'Así se siente resolver un problema como ingeniero telemático.',
  'Redes, hardware y software: vas por buen camino.',
  'Esto es lo que se vive en Telemática USM, todos los días.',
  'Cada logro es un paso más cerca de la carrera.',
];

// Pantallas donde no se interrumpe (juegos con reloj de la ruta en vivo).
export function shouldDefer(pathname: string): boolean {
  return pathname.startsWith('/ruta/juego');
}

export function AchievementCelebration() {
  const pathname = usePathname();
  const [queue, setQueue] = useState<string[]>([]);
  // Cuántos se mostraron seguidos en esta tanda (a lo más MAX_IN_A_ROW; el resto se resume).
  const [seen, setSeen] = useState(0);

  useEffect(
    () =>
      onAppEvent((event) => {
        if (event.type === 'achievement') setQueue((items) => (items.includes(event.id) ? items : [...items, event.id]));
      }),
    [],
  );

  const currentId = shouldDefer(pathname) ? undefined : queue[0];
  if (!currentId) return null;
  const achievement = getAchievement(currentId);
  const total = Math.min(MAX_IN_A_ROW, seen + queue.length);
  const lastOfRun = seen + 1 >= total;
  const extra = lastOfRun ? queue.length - 1 : 0;

  function close() {
    setQueue([]);
    setSeen(0);
  }

  function next() {
    if (lastOfRun) {
      close();
      return;
    }
    setQueue((items) => items.slice(1));
    setSeen((value) => value + 1);
  }

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.scrim} accessibilityViewIsModal>
        {achievement ? (
          <CelebrationCard
            key={achievement.id}
            achievement={achievement}
            line={CAREER_LINES[(achievement.id.length + seen) % CAREER_LINES.length]}
            extra={extra}
            step={total > 1 ? `${seen + 1} de ${total}` : null}
            onNext={next}
            nextLabel={lastOfRun ? '¡Genial!' : 'Siguiente logro'}
            onSeeAll={() => {
              close();
              router.push('/achievements');
            }}
          />
        ) : (
          <TelButton label="Cerrar" variant="cream" onPress={next} />
        )}
      </View>
    </Modal>
  );
}

interface CardProps {
  achievement: Achievement;
  line: string;
  extra: number;
  step: string | null;
  nextLabel: string;
  onNext: () => void;
  onSeeAll: () => void;
}

const SPARKS = Array.from({ length: 12 }, (_, index) => index);

function CelebrationCard({ achievement, line, extra, step, nextLabel, onNext, onSeeAll }: CardProps) {
  const motion = useMotionEnabled();
  const spin = useSharedValue(motion ? 0 : 720);
  const grow = useSharedValue(motion ? 0.2 : 1);
  const shine = useSharedValue(-1);
  const glow = useSharedValue(0);
  const tier = tierColors[achievement.tier];

  useEffect(() => {
    void feedbackSuccess();
    if (!motion) return;
    spin.value = withTiming(720, { duration: 1500, easing: Easing.out(Easing.cubic) });
    grow.value = withSpring(1, { damping: 9, stiffness: 120 });
    shine.value = withDelay(1300, withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(-1, { duration: 0 }), withDelay(1200, withTiming(-1, { duration: 0 }))), -1));
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.3, { duration: 900 })), -1, true);
  }, [glow, grow, motion, shine, spin]);

  const medalStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${spin.value}deg` }, { scale: grow.value }],
  }));
  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shine.value * 140 }, { rotate: '20deg' }], opacity: shine.value > -1 && shine.value < 1 ? 0.55 : 0 }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + glow.value * 0.5, transform: [{ scale: 1 + glow.value * 0.12 }] }));

  return (
    <Animated.View entering={ZoomIn.duration(motion ? 260 : 0)} style={styles.card} accessibilityRole="alert" accessibilityLabel={`¡Conseguiste un nuevo logro! ${achievement.title}. ${achievement.description}`}>
      {step && (
        <TelText variant="caption" color="accentSoft" align="center">
          {step}
        </TelText>
      )}
      <TelText variant="label" color="accent" align="center" style={styles.kicker}>
        {`Medalla de ${tier.label.toLowerCase()}`.toUpperCase()}
      </TelText>
      <View style={styles.stage}>
        <Animated.View style={[styles.glow, { backgroundColor: tier.ring[1] }, glowStyle]} />
        {motion &&
          SPARKS.map((spark) => {
            const angle = (spark / SPARKS.length) * Math.PI * 2;
            const distance = 92 + (spark % 3) * 14;
            return (
              <Animated.View key={spark} entering={ZoomIn.delay(900 + spark * 40).duration(420)} style={[styles.spark, { transform: [{ translateX: Math.cos(angle) * distance }, { translateY: Math.sin(angle) * distance }] }]}>
                <TelIcon name={spark % 2 ? 'sparkle' : 'starSolid'} size={spark % 3 ? 14 : 20} color={spark % 2 ? colors.cream : '#F2C94C'} />
              </Animated.View>
            );
          })}
        <Animated.View style={[styles.medal, medalStyle]}>
          <Medallion glyph={achievement.glyph} tier={achievement.tier} size={150} ribbon />
          <View pointerEvents="none" style={styles.shineClip}>
            <Animated.View style={[styles.shine, shineStyle]} />
          </View>
        </Animated.View>
      </View>
      <Animated.View entering={FadeIn.delay(motion ? 700 : 0).duration(300)} style={styles.texts}>
        <TelText variant="title" color="cream" align="center">
          ¡Conseguiste un nuevo logro!
        </TelText>
        <TelText variant="subtitle" color="accent" align="center">
          {achievement.title}
        </TelText>
        <TelText variant="body" color="accentSoft" align="center">
          {achievement.description}
        </TelText>
        <TelText variant="caption" color="cream" align="center" style={styles.line}>
          {line}
        </TelText>
        {extra > 0 && (
          <TelText variant="caption" color="accentSoft" align="center">
            ¡Y {extra} {extra === 1 ? 'logro más' : 'logros más'} te esperan en tu colección!
          </TelText>
        )}
      </Animated.View>
      <View style={styles.actions}>
        <TelButton label={nextLabel} variant="cream" iconRight="sparkles" onPress={onNext} />
        <TelButton label="Ver mis logros" variant="ghostLight" onPress={onSeeAll} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(5, 20, 33, 0.92)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: colors.primary, borderWidth: 1, borderColor: 'rgba(167,212,237,0.25)' },
  kicker: { letterSpacing: 1.5 },
  stage: { width: 230, height: 210, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  spark: { position: 'absolute' },
  medal: { alignItems: 'center', justifyContent: 'center' },
  shineClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 75, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  shine: { width: 34, height: 220, backgroundColor: 'rgba(255,255,255,0.9)' },
  texts: { gap: spacing.xs, alignItems: 'center' },
  line: { fontStyle: 'italic', marginTop: spacing.xs },
  actions: { alignSelf: 'stretch', gap: spacing.xs, marginTop: spacing.sm },
});
