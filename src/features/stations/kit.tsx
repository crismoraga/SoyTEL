import { useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { ProgressBar } from '@/components/feedback/Progress';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';

export interface StationGameResult {
  score: number;
  accuracy: number;
}

export interface StationGameProps {
  seed: number;
  // Hora local (ms) en que el juego debe cerrarse sí o sí (B215 va sincronizado con el grupo).
  deadline?: number | null;
  onComplete: (result: StationGameResult) => void;
}

// Reloj que se actualiza solo mientras el juego está activo.
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface HudProps {
  stage: number;
  stages: number;
  title: string;
  score: number;
  secondsLeft: number | null;
  totalSeconds?: number;
  accent?: string;
}

// Barra superior del juego: etapa, puntaje y tiempo.
export function StationHud({ stage, stages, title, score, secondsLeft, totalSeconds, accent = colors.accent }: HudProps) {
  const urgent = secondsLeft !== null && secondsLeft <= 5;
  return (
    <View style={styles.hud}>
      <View style={styles.hudRow}>
        <View style={styles.flex}>
          <TelText variant="small" color="accentSoft" style={styles.kicker}>
            ETAPA {stage} DE {stages}
          </TelText>
          <TelText variant="subtitle" color="cream" numberOfLines={1}>
            {title}
          </TelText>
        </View>
        <View style={styles.scoreBox} accessibilityLabel={`${score} puntos`}>
          <TelText variant="heading" color="cream" tabular>
            {score}
          </TelText>
          <TelText variant="small" color="accentSoft">
            pts
          </TelText>
        </View>
        {secondsLeft !== null && (
          <View style={[styles.timeBox, urgent && styles.timeUrgent]} accessibilityLabel={`${secondsLeft} segundos`}>
            <TelIcon name="timer" size={16} color={urgent ? colors.white : colors.cream} />
            <TelText variant="label" color={urgent ? 'white' : 'cream'} tabular>
              {secondsLeft}s
            </TelText>
          </View>
        )}
      </View>
      {secondsLeft !== null && totalSeconds ? (
        <ProgressBar progress={clamp(secondsLeft / totalSeconds, 0, 1)} color={urgent ? colors.danger : accent} trackColor={colors.primarySoft} height={5} />
      ) : null}
    </View>
  );
}

interface BannerProps {
  index: number;
  title: string;
  body: string;
  icon: IconName;
  accent?: string;
  onDone: () => void;
  durationMs?: number;
}

// Presentación breve de cada etapa; se cierra sola o al tocarla.
export function StageBanner({ index, title, body, icon, accent = colors.accent, onDone, durationMs = 2600 }: BannerProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDone]);
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={styles.bannerWrap}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}. Toca para empezar`} onPress={onDone} style={styles.banner}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.bannerIcon, { backgroundColor: accent }]}>
          <TelIcon name={icon} size={40} color={colors.primary} />
        </Animated.View>
        <TelText variant="overline" color="accent" align="center">
          Etapa {index}
        </TelText>
        <TelText variant="title" color="cream" align="center">
          {title}
        </TelText>
        <TelText variant="body" color="accentSoft" align="center" style={styles.bannerBody}>
          {body}
        </TelText>
        <TelText variant="small" color="slate" align="center">
          Toca para empezar
        </TelText>
      </Pressable>
    </Animated.View>
  );
}

export interface ResultRow {
  label: string;
  value: number;
  max: number;
  icon: IconName;
}

interface ResultProps {
  title: string;
  message: string;
  rows: ResultRow[];
  total: number;
  learned: string;
  accent?: string;
  submitLabel?: string;
  onSubmit: () => void;
}

export function StationSummary({ title, message, rows, total, learned, accent = colors.accent, submitLabel = 'Enviar mi puntaje', onSubmit }: ResultProps) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.summary}>
      <View style={styles.summaryHead}>
        <TelText variant="overline" color="accent" align="center">
          {title}
        </TelText>
        <TelText variant="display" color="cream" align="center" tabular>
          {total}
        </TelText>
        <TelText variant="label" color="accentSoft" align="center">
          {message}
        </TelText>
      </View>
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: accent }]}>
              <TelIcon name={row.icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <TelText variant="label" color="cream">
                {row.label}
              </TelText>
              <ProgressBar progress={row.max ? clamp(row.value / row.max, 0, 1) : 0} color={accent} trackColor={colors.primary} height={5} />
            </View>
            <TelText variant="label" color="cream" tabular>
              {row.value}/{row.max}
            </TelText>
          </View>
        ))}
      </View>
      <View style={styles.learned}>
        <TelIcon name="lightbulb" size={20} color={colors.cream} />
        <TelText variant="caption" color="cream" style={styles.flex}>
          {learned}
        </TelText>
      </View>
      <TelButton label={submitLabel} variant="cream" iconRight="send" onPress={onSubmit} />
    </Animated.View>
  );
}

export function GameBoard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.board, style]}>{children}</View>;
}

export function Hint({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'good' | 'bad' }>) {
  const palette = tone === 'good' ? '#1F5E43' : tone === 'bad' ? '#6E2A2A' : 'rgba(167,212,237,0.12)';
  return (
    <Animated.View entering={FadeIn.duration(160)} style={[styles.hint, { backgroundColor: palette }]}>
      <TelText variant="caption" color="cream" align="center">
        {children}
      </TelText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    letterSpacing: 1.2,
  },
  hud: {
    gap: 8,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreBox: {
    alignItems: 'center',
    minWidth: 58,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  timeUrgent: {
    backgroundColor: colors.danger,
  },
  bannerWrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    backgroundColor: 'rgba(7, 31, 49, 0.94)',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.25)',
  },
  banner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  bannerBody: {
    maxWidth: 320,
  },
  summary: {
    gap: spacing.md,
  },
  summaryHead: {
    gap: 4,
    alignItems: 'center',
  },
  rows: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learned: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(244, 236, 215, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 236, 215, 0.25)',
  },
  board: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18, 61, 92, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
    overflow: 'hidden',
  },
  hint: {
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
