import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { ChipGroup, Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { Rutix } from '@/components/graphics/Rutix';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import type { CoachMood } from '@/data/coachLines';
import { AccountGate } from '@/features/account/AccountGate';
import { CoachBubble, useCoachEnabled } from '@/features/coach/CoachBubble';
import { BinaryLabGame } from '@/features/puzzles/BinaryLabGame';
import { getPuzzle } from '@/features/puzzles/catalog';
import { CipherGame } from '@/features/puzzles/CipherGame';
import { NetWalkGame } from '@/features/puzzles/NetWalkGame';
import type { PuzzleGameProps, PuzzleResult } from '@/features/puzzles/types';
import { HelpButton, TutorialSheet } from '@/features/tutorial/TutorialSheet';
import { getTutorial } from '@/features/tutorial/tutorials';
import { now } from '@/lib/clock';
import { formatNumber } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { recordGameResult } from '@/storage/profile';
import { loadPuzzleProgress, recordPuzzleSolved, type PuzzleId } from '@/storage/puzzles';
import { useTutorial } from '@/storage/tutorials';
import { colors, radius, spacing } from '@/theme';
import type { GameOutcome } from '@/types/game';

const components: Record<PuzzleId, React.ComponentType<PuzzleGameProps>> = {
  red: NetWalkGame,
  binario: BinaryLabGame,
  cifrado: CipherGame,
};

interface Solved {
  level: number;
  result: PuzzleResult;
  outcome: GameOutcome | null;
}

// Desafíos sin reloj (Conecta la red, Binario, Mensaje cifrado): por niveles y con Rutix de guía.
export default function PuzzleScreen() {
  const { juego } = useLocalSearchParams<{ juego?: string }>();
  const info = getPuzzle(juego ?? '');
  const coach = useCoachEnabled();
  const tutorial = useTutorial(info ? `puzzle-${info.id}` : null);
  const guide = info ? getTutorial(`puzzle-${info.id}`) : undefined;
  const { data: progress, setData: setProgress } = useFocusData(loadPuzzleProgress);
  const [chosenLevel, setChosenLevel] = useState<number | null>(null);
  const [run, setRun] = useState(() => ({ key: 0, seed: Math.floor(Math.random() * 1e9), startedAt: now() }));
  const [solved, setSolved] = useState<Solved | null>(null);
  const [line, setLine] = useState<{ text: string; mood: CoachMood } | null>(null);

  if (!info) return <Redirect href="/games" />;
  if (!progress) return <Screen tone="dark" header={<AppHeader transparent compact onBack={() => router.back()} />} />;

  const unlocked = Math.min(info.maxLevel, progress[info.id].level + 1);
  const level = Math.min(chosenLevel ?? unlocked, unlocked);
  const Game = components[info.id];

  function restart(nextLevel: number) {
    setChosenLevel(nextLevel);
    setSolved(null);
    setLine(null);
    setRun((current) => ({ key: current.key + 1, seed: Math.floor(now() % 1e9) + current.key * 7919, startedAt: now() }));
  }

  async function onSolved(result: PuzzleResult) {
    if (!info) return;
    setSolved({ level, result, outcome: null });
    setProgress(await recordPuzzleSolved(info.id, level, result.score));
    const outcome = await recordGameResult({
      gameId: 'puzzle',
      score: result.score,
      accuracy: result.accuracy,
      durationSeconds: Math.max(1, Math.round((now() - run.startedAt) / 1000)),
      completedAt: new Date().toISOString(),
      metadata: { game: info.id, level },
    });
    setSolved({ level, result, outcome });
  }

  if (solved) {
    const great = solved.result.score >= 800;
    const hasNext = solved.level < info.maxLevel;
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact onBack={() => router.back()} />}>
        <Celebration burstKey={run.key + 1} count={great ? 40 : 24} />
        <View style={styles.hero}>
          <Rutix size={150} expression={great ? 'proud' : 'happy'} pose={great ? 'celebrate' : 'thumbsUp'} signal={4} />
          <TelText variant="overline" color="accent" align="center">
            {info.title} · nivel {solved.level} resuelto
          </TelText>
          <TelText variant="display" color="cream" align="center" tabular>
            {formatNumber(solved.result.score)}
          </TelText>
          <TelText variant="label" color="accentSoft" align="center">
            {solved.result.detail}
          </TelText>
          <View style={styles.tags}>
            {solved.outcome && <Tag tone="cream" icon="sparkle" label={`+${solved.outcome.xpGained} XP`} />}
            {solved.outcome?.leveledUp && <Tag tone="cream" icon="rocket" label={`Nivel ${solved.outcome.profile.level}`} />}
          </View>
        </View>
        <View style={styles.learned}>
          <TelIcon name="lightbulb" size={20} color={colors.cream} />
          <TelText variant="caption" color="cream" style={styles.flex}>
            {info.learned}
          </TelText>
        </View>
        <View style={styles.actions}>
          {hasNext && <TelButton label={`Nivel ${solved.level + 1}`} variant="cream" iconRight="arrowRight" onPress={() => restart(solved.level + 1)} />}
          <TelButton label="Repetir este nivel" variant="outlineLight" icon="refresh" onPress={() => restart(solved.level)} />
          <TelButton label="Volver a los juegos" variant="ghostLight" size="sm" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const levels = Array.from({ length: unlocked }, (_, index) => ({ id: String(index + 1), label: `Nivel ${index + 1}` }));

  return (
    <Screen
      tone="dark"
      backdrop="stars"
      header={
        <AppHeader
          compact
          onBack={() => router.back()}
          right={
            <View style={styles.headRight}>
              <Tag tone="glass" icon={info.icon} label={`Nivel ${level} · ${info.levelName(level)}`} />
              <HelpButton onPress={tutorial.open} />
            </View>
          }
        >
          <TelText variant="heading" color="cream">
            {info.title}
          </TelText>
        </AppHeader>
      }
    >
      {levels.length > 1 && (
        <ChipGroup tone="dark" accessibilityLabel="Elegir nivel" options={levels} value={String(level)} onChange={(id) => restart(Number(id))} inset={spacing.md} />
      )}
      {coach ? (
        <CoachBubble mood={line?.mood ?? 'intro'} tone={line?.mood === 'good' ? 'good' : line?.mood === 'bad' ? 'bad' : 'info'} size={60}>
          {line?.text ?? info.how}
        </CoachBubble>
      ) : (
        <TelText variant="caption" color="accentSoft" align="center">
          {line?.text ?? info.how}
        </TelText>
      )}
      <Game key={`${info.id}-${level}-${run.key}`} level={level} seed={run.seed + level * 101} onSolved={(result) => void onSolved(result)} say={(text, mood = 'tip') => setLine({ text, mood })} />
      <View style={styles.footer}>
        <TelIcon name="clock" size={14} color={colors.slate} />
        <TelText variant="small" color="slate">
          Sin reloj: piensa con calma.
        </TelText>
      </View>
      <AccountGate />
      {guide && <TutorialSheet tutorial={guide} visible={tutorial.visible} onClose={tutorial.close} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 28,
  },
  flex: {
    flex: 1,
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
  actions: {
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
