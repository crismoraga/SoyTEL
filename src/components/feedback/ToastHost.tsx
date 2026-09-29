import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, ReduceMotion, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAchievement } from '@/data/achievements';
import type { MedallionGlyph } from '@/graphics/medallions';
import { onAppEvent, type AppEvent } from '@/lib/events';
import { feedbackSuccess } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { levelTitle } from '@/lib/progression';
import { colors, radius, shadows, spacing, tierColors, type Tier } from '@/theme';
import { Medallion } from '../graphics/Medallion';
import { TelText } from '../TelText';

interface Toast {
  id: number;
  kicker: string;
  title: string;
  body?: string;
  glyph: MedallionGlyph;
  tier?: Tier;
}

let sequence = 0;

function toToast(event: AppEvent): Toast | null {
  sequence += 1;
  if (event.type === 'achievement') {
    const achievement = getAchievement(event.id);
    if (!achievement) return null;
    return {
      id: sequence,
      kicker: `Logro ${tierColors[achievement.tier].label.toLowerCase()} desbloqueado`,
      title: achievement.title,
      body: achievement.description,
      glyph: achievement.glyph,
      tier: achievement.tier,
    };
  }
  if (event.type === 'levelUp') {
    return { id: sequence, kicker: `Nivel ${event.level}`, title: '¡Subiste de nivel!', body: `Ahora eres ${levelTitle(event.level)}.`, glyph: 'rocket' };
  }
  return { id: sequence, kicker: 'SoyTEL', title: event.title, body: event.body, glyph: 'sparkle' };
}

// Avisos flotantes (logros y subidas de nivel) que aparecen desde arriba sobre cualquier pantalla.
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const motionEnabled = useMotionEnabled();
  const [queue, setQueue] = useState<Toast[]>([]);
  const current = queue[0];

  useEffect(
    () =>
      onAppEvent((event) => {
        const toast = toToast(event);
        if (toast) setQueue((items) => [...items, toast]);
      }),
    [],
  );

  useEffect(() => {
    if (!current) return;
    void feedbackSuccess();
    const timer = setTimeout(() => setQueue((items) => items.slice(1)), 3600);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) {
    return null;
  }

  const policy = motionEnabled ? ReduceMotion.System : ReduceMotion.Always;
  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + spacing.xs }]}>
      <Animated.View
        key={current.id}
        entering={SlideInUp.springify().damping(16).reduceMotion(policy)}
        exiting={FadeOutUp.duration(220).reduceMotion(policy)}
        style={[styles.toast, shadows.lifted]}
      >
        <Pressable
          accessibilityRole="alert"
          accessibilityLabel={`${current.kicker}. ${current.title}. ${current.body ?? ''}`}
          accessibilityHint="Toca para cerrar"
          onPress={() => setQueue((items) => items.slice(1))}
          style={styles.inner}
        >
          <Medallion glyph={current.glyph} tier={current.tier ?? 'crema'} size={52} />
          <View style={styles.text}>
            <TelText variant="small" color="accent" style={styles.kicker}>
              {current.kicker.toUpperCase()}
            </TelText>
            <TelText variant="subtitle" color="cream" numberOfLines={1}>
              {current.title}
            </TelText>
            {current.body && (
              <TelText variant="caption" color="accentSoft" numberOfLines={2}>
                {current.body}
              </TelText>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 100,
    elevation: 100,
  },
  toast: {
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.25)',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.2,
  },
});
