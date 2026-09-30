import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { Telix } from '@/components/graphics/Telix';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { getStationGame } from '@/features/stations/registry';
import { now } from '@/lib/clock';
import { formatNumber } from '@/lib/format';
import { recordGameResult } from '@/storage/profile';
import { spacing } from '@/theme';
import type { GameOutcome } from '@/types/game';

// Práctica individual de cualquier juego de la ruta (fuera de la ruta en vivo).
export default function StationPracticeScreen() {
  const { juego } = useLocalSearchParams<{ juego?: string }>();
  const info = getStationGame(juego ?? '');
  const [run, setRun] = useState(() => ({ key: 0, seed: Math.floor(Math.random() * 1e9), startedAt: 0 }));
  const [result, setResult] = useState<{ score: number; outcome: GameOutcome | null } | null>(null);

  if (!info) return <Redirect href="/games" />;
  const Game = info.Component;

  if (result) {
    const great = result.score >= 700;
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact onBack={() => router.back()} />}>
        <Celebration burstKey={great ? run.key + 1 : null} count={36} />
        <View style={styles.hero}>
          <Telix size={150} expression={great ? 'celebrate' : 'happy'} pose={great ? 'celebrate' : 'wave'} />
          <TelText variant="overline" color="accent" align="center">
            {info.title}
          </TelText>
          <TelText variant="display" color="cream" align="center" tabular>
            {formatNumber(result.score)}
          </TelText>
          <View style={styles.tags}>
            <Tag tone="glass" icon="star" label="puntos" />
            {result.outcome && <Tag tone="cream" icon="sparkle" label={`+${result.outcome.xpGained} XP`} />}
          </View>
          <TelText variant="body" color="accentSoft" align="center">
            {great ? '¡Listo para la ruta en vivo!' : 'Practica otra vez: en la ruta cada punto cuenta.'}
          </TelText>
        </View>
        <View style={styles.actions}>
          <TelButton
            label="Jugar de nuevo"
            variant="cream"
            icon="refresh"
            onPress={() => {
              setResult(null);
              setRun((current) => ({ key: current.key + 1, seed: Math.floor(now() % 1e9), startedAt: now() }));
            }}
          />
          <TelButton label="Volver a los juegos" variant="outlineLight" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      tone="dark"
      backdrop="stars"
      scroll={false}
      header={
        <AppHeader compact onBack={() => router.back()} right={<Tag tone="glass" icon="pin" label={info.place} />}>
          <TelText variant="heading" color="cream">
            {info.title}
          </TelText>
        </AppHeader>
      }
    >
      <Game
        key={run.key}
        seed={run.seed}
        onComplete={(value) => {
          setResult({ score: value.score, outcome: null });
          void recordGameResult({
            gameId: 'station',
            score: value.score,
            accuracy: value.accuracy,
            durationSeconds: run.startedAt ? Math.max(1, Math.round((now() - run.startedAt) / 1000)) : 90,
            completedAt: new Date().toISOString(),
            metadata: { game: info.id },
          }).then((outcome) => setResult({ score: value.score, outcome }));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
