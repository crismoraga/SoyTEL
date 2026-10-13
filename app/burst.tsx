import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { pickBurstGames, microGameRegistry } from '@/features/burst/registry';
import type { MicroGameDefinition } from '@/features/burst/types';
import { recordGameResult } from '@/storage/profile';
import { colors, radius, spacing } from '@/theme';

type BurstPhase = 'intro' | 'playing' | 'feedback' | 'finished';

const ROUNDS_PER_SESSION = 6;

export default function BurstScreen() {
  const [phase, setPhase] = useState<BurstPhase>('intro');
  const [games, setGames] = useState<MicroGameDefinition[]>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const timeoutAnswer = useRef<() => void>(() => undefined);
  const current: MicroGameDefinition | undefined = games[round];

  const accuracy = useMemo(
    () => (games.length === 0 ? 0 : correct / games.length),
    [correct, games.length],
  );

  useEffect(() => {
    if (phase === 'playing' && current) {
      setSecondsLeft(current.durationSeconds);
      const interval = setInterval(() => {
        setSecondsLeft((value) => {
          if (value <= 1) {
            clearInterval(interval);
            timeoutAnswer.current();
            return 0;
          }
          return value - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [current, phase, round]);

  function start() {
    startedAt.current = Date.now();
    setGames(pickBurstGames(ROUNDS_PER_SESSION));
    setRound(0);
    setScore(0);
    setCorrect(0);
    setLastAnswerCorrect(false);
    setPhase('playing');
  }

  async function answer(isCorrect: boolean, bonus = 0) {
    setLastAnswerCorrect(isCorrect);
    if (isCorrect) {
      setCorrect((value) => value + 1);
      setScore((value) => value + 100 + bonus + secondsLeft * 5);
      await feedbackSuccess();
    } else {
      await feedbackWarning();
    }
    setPhase('feedback');
  }

  timeoutAnswer.current = () => {
    void answer(false);
  };

  async function next() {
    if (round + 1 >= games.length) {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      await recordGameResult({
        gameId: 'burst',
        score,
        accuracy,
        durationSeconds,
        completedAt: new Date().toISOString(),
        metadata: { rounds: games.length },
      });
      setPhase('finished');
      return;
    }

    setRound((value) => value + 1);
    setPhase('playing');
  }

  if (phase === 'intro') {
    return (
      <Screen dark onBack={() => (router.canGoBack() ? router.back() : router.replace('/games'))}>
        <View style={styles.intro}>
          <TelText variant="overline" color="accentSoft" align="center">Modo WarioWare</TelText>
          <TelText variant="hero" color="white" align="center">Ráfaga TEL</TelText>
          <TelText color="accentSoft" align="center">
            {ROUNDS_PER_SESSION} microretos al azar de un set de {microGameRegistry.length}: responde, memoriza, sintoniza y envía paquetes antes de que se acabe el tiempo.
          </TelText>
          <TelButton label="Iniciar ráfaga" onPress={start} />
        </View>
      </Screen>
    );
  }

  if (phase === 'finished') {
    return (
      <Screen dark contentStyle={styles.centered}>
        <TelText variant="overline" color="accentSoft" align="center">Ráfaga completada</TelText>
        <TelText variant="hero" color="white" align="center">{score} pts</TelText>
        <TelCard tone="cream">
          <TelText variant="subtitle" color="primary" align="center">
            Precisión: {Math.round(accuracy * 100)}%
          </TelText>
          <TelText color="primarySoft" align="center">
            {accuracy >= 1
              ? '¡Sin pérdida de paquetes! Logro desbloqueado.'
              : 'Tu XP ya se guardó localmente. Repite la ráfaga para subir nivel y mejorar a Telix.'}
          </TelText>
        </TelCard>
        <TelButton label="Jugar otra vez" onPress={start} />
        <TelButton label="Volver al inicio" variant="ghost" surface="dark" onPress={() => router.replace('/home')} />
      </Screen>
    );
  }

  if (!current) {
    return <Screen dark contentStyle={styles.centered} />;
  }

  const isFeedback = phase === 'feedback';

  return (
    <Screen dark scroll={isFeedback}>
      <View style={styles.topBar}>
        <TelText variant="bodyStrong" color="white">Reto {round + 1}/{games.length}</TelText>
        {!isFeedback && (
          <View style={[styles.timer, secondsLeft <= 3 && styles.timerDanger]}>
            <TelText variant="bodyStrong" color="white" align="center">{secondsLeft}s</TelText>
          </View>
        )}
      </View>

      <View style={styles.stage}>
        <View style={styles.prompt}>
          <TelText variant="overline" color="accentSoft" align="center">{current.title}</TelText>
          <TelText variant="title" color="white" align="center">{current.instruction}</TelText>
          {isFeedback && (
            <TelText variant="bodyStrong" color={lastAnswerCorrect ? 'success' : 'warning'} align="center">
              {lastAnswerCorrect ? '¡Conexión establecida!' : 'Se perdió el paquete.'}
            </TelText>
          )}
        </View>

        {/* En feedback se desmonta el microjuego: así el botón siempre cabe en pantallas bajas. */}
        {isFeedback ? (
          <TelButton
            label={round + 1 >= games.length ? 'Ver resultado' : 'Siguiente reto'}
            onPress={() => void next()}
          />
        ) : (
          <current.Component
            durationSeconds={current.durationSeconds}
            active
            onAnswer={(isCorrect, bonus) => void answer(isCorrect, bonus)}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  intro: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stage: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  timer: {
    width: 62,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDanger: {
    backgroundColor: colors.danger,
  },
  prompt: {
    gap: spacing.sm,
  },
});
