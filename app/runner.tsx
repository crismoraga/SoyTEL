import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { ProgressBar } from '@/components/feedback/Progress';
import { Medallion } from '@/components/graphics/Medallion';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { getAchievement } from '@/data/achievements';
import { AccountGate } from '@/features/account/AccountGate';
import { CoachBubble, useCoachEnabled } from '@/features/coach/CoachBubble';
import { getRunnerCharacter, nextRunnerCharacter, runnerCharacters, type RunnerCharacter } from '@/features/runner/characters';
import { RunnerGame, type RunnerSummary } from '@/features/runner/RunnerGame';
import { HelpButton, TutorialSheet } from '@/features/tutorial/TutorialSheet';
import { tutorials } from '@/features/tutorial/tutorials';
import { runnerCharacterDrawing } from '@/graphics/runners';
import { SvgDrawing } from '@/graphics/ShapeLayer';
import { feedbackSuccess } from '@/lib/feedback';
import { formatNumber } from '@/lib/format';
import { usePaceFactor } from '@/lib/pace';
import { LoadError } from '@/components/feedback/LoadError';
import { useFocusData } from '@/lib/useFocusData';
import { recordGameResult } from '@/storage/profile';
import { loadRunnerSave, recordRun, selectRunnerCharacter, unlockRunnerCharacter, type RunnerSave } from '@/storage/runner';
import { useTutorial } from '@/storage/tutorials';
import { colors, radius, spacing } from '@/theme';
import type { GameOutcome } from '@/types/game';

interface Finished {
  summary: RunnerSummary;
  outcome: GameOutcome | null;
  record: boolean;
  save: RunnerSave | null;
}

function Avatar({ character, size }: { character: RunnerCharacter; size: number }) {
  return <SvgDrawing drawing={runnerCharacterDrawing(character.id)} width={size} height={size} />;
}

// TEL Runner: carrera sin fin por la autopista de datos, con personajes telemáticos que se
// desbloquean juntando paquetes.
export default function RunnerScreen() {
  const pace = usePaceFactor();
  const coach = useCoachEnabled();
  const tutorial = useTutorial('runner');
  const { data: save, setData: setSave, error, reload } = useFocusData(loadRunnerSave);
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'result'>('lobby');
  const [preview, setPreview] = useState<string | null>(null);
  const [run, setRun] = useState({ key: 0, seed: 1 });
  const [finished, setFinished] = useState<Finished | null>(null);

  const onFinish = useCallback(
    (summary: RunnerSummary) => {
      const previousBest = save?.best ?? 0;
      setFinished({ summary, outcome: null, record: summary.score > previousBest && previousBest > 0, save: null });
      setPhase('result');
      void recordRun({ data: summary.data, score: summary.score, distance: summary.distance }).then((next) => {
        setSave(next);
        setFinished((current) => (current ? { ...current, save: next } : current));
      });
      void recordGameResult({
        gameId: 'runner',
        score: summary.score,
        accuracy: summary.accuracy,
        durationSeconds: summary.seconds,
        completedAt: new Date().toISOString(),
        metadata: { distance: summary.distance, data: summary.data, character: save?.selected ?? 'rutix' },
      }).then((outcome) => setFinished((current) => (current ? { ...current, outcome } : current)));
    },
    [save?.best, save?.selected, setSave],
  );

  const leave = useCallback(() => setPhase('lobby'), []);

  if (!save) {
    return (
      <Screen tone="dark" header={<AppHeader transparent compact onBack={() => router.back()} />}>
        {error && <LoadError tone="dark" onRetry={reload} />}
      </Screen>
    );
  }

  const selected = getRunnerCharacter(save.selected);

  function start() {
    setFinished(null);
    setRun((current) => ({ key: current.key + 1, seed: Math.floor(Math.random() * 1e9) }));
    setPhase('playing');
  }

  if (phase === 'playing') {
    return (
      <Screen tone="dark" backdrop="stars" scroll={false} contentStyle={styles.playContent}>
        <RunnerGame key={run.key} character={selected} pace={pace} seed={run.seed} coach={coach} onFinish={onFinish} onLeave={leave} />
      </Screen>
    );
  }

  if (phase === 'result' && finished) {
    const { summary, outcome, record } = finished;
    const wallet = finished.save ?? save;
    const next = nextRunnerCharacter(wallet.unlocked);
    const affordable = next ? wallet.data >= next.cost : false;
    const unlocked = outcome?.newAchievements.map((id) => getAchievement(id)) ?? [];
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact />}>
        <Celebration burstKey={summary.distance >= 150 ? run.key : null} count={record ? 44 : 26} />
        <View style={styles.hero}>
          <Avatar character={selected} size={140} />
          <TelText variant="overline" color="accent" align="center">
            Fin de la carrera
          </TelText>
          <TelText variant="display" color="cream" align="center" tabular>
            {formatNumber(summary.score)}
          </TelText>
          <TelText variant="label" color="accentSoft" align="center">
            puntos · {formatNumber(summary.distance)} m · {formatNumber(summary.data)} {summary.data === 1 ? 'paquete' : 'paquetes'}
          </TelText>
          <View style={styles.tags}>
            {record && <Tag tone="cream" icon="crown" label="¡Nuevo récord!" />}
            {outcome && <Tag tone="glass" icon="sparkle" label={`+${outcome.xpGained} XP`} />}
            {outcome?.leveledUp && <Tag tone="cream" icon="rocket" label={`Nivel ${outcome.profile.level}`} />}
          </View>
        </View>

        {coach && (
          <CoachBubble mood={summary.distance >= 300 ? 'win' : 'good'} size={56}>
            {summary.distance >= 300 ? '¡Qué carrera! Así viajan los datos por una red sin congestión.' : `¿Sabías que…? ${selected.fact}`}
          </CoachBubble>
        )}

        {next && (
          <View style={styles.nextCard}>
            <Avatar character={next} size={64} />
            <View style={styles.flex}>
              <TelText variant="small" color="accent" style={styles.kicker}>
                PRÓXIMO PERSONAJE
              </TelText>
              <TelText variant="subtitle" color="cream">
                {next.name} · {next.role}
              </TelText>
              <ProgressBar progress={Math.min(1, wallet.data / next.cost)} color={colors.accent} trackColor={colors.primary} height={6} accessibilityLabel={`Paquetes para ${next.name}`} />
              <TelText variant="caption" color="accentSoft" tabular>
                {affordable ? '¡Ya puedes desbloquearlo!' : `${formatNumber(wallet.data)} de ${formatNumber(next.cost)} paquetes · faltan ${formatNumber(next.cost - wallet.data)}`}
              </TelText>
            </View>
          </View>
        )}

        {unlocked.map((achievement) =>
          achievement ? (
            <View key={achievement.id} style={styles.nextCard}>
              <Medallion glyph={achievement.glyph} tier={achievement.tier} size={44} />
              <View style={styles.flex}>
                <TelText variant="small" color="accent">
                  LOGRO DESBLOQUEADO
                </TelText>
                <TelText variant="label" color="cream">
                  {achievement.title}
                </TelText>
              </View>
            </View>
          ) : null,
        )}

        <View style={styles.actions}>
          <TelButton label="Correr otra vez" variant="cream" icon="refresh" onPress={start} />
          <TelButton label={affordable ? 'Desbloquear personaje' : 'Elegir personaje'} variant="outlineLight" icon="users" onPress={() => setPhase('lobby')} />
          <TelButton label="Volver" variant="ghostLight" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const shown = getRunnerCharacter(preview ?? save.selected);
  const owned = save.unlocked.includes(shown.id);
  const missing = Math.max(0, shown.cost - save.data);

  async function choose(character: RunnerCharacter) {
    setPreview(character.id);
    if (save && save.unlocked.includes(character.id) && save.selected !== character.id) setSave(await selectRunnerCharacter(character.id));
  }

  async function unlock() {
    const next = await unlockRunnerCharacter(shown.id);
    if (next.unlocked.includes(shown.id)) void feedbackSuccess();
    setSave(next);
  }

  return (
    <Screen
      tone="dark"
      backdrop="signal"
      header={<AppHeader transparent compact onBack={() => router.back()} kicker="Carrera sin fin" title="TEL Runner" right={<HelpButton onPress={tutorial.open} />} />}
    >
      <View style={styles.stats}>
        <View style={styles.stat} accessible accessibilityLabel={`${save.data} paquetes de datos guardados`}>
          <TelIcon name="packet" size={18} color={colors.accent} />
          <TelText variant="label" color="cream" tabular>
            {formatNumber(save.data)} paquetes
          </TelText>
        </View>
        <View style={styles.stat} accessible accessibilityLabel={`Récord: ${save.best} puntos`}>
          <TelIcon name="trophy" size={18} color={colors.accent} />
          <TelText variant="label" color="cream" tabular>
            {save.best > 0 ? `${formatNumber(save.best)} pts · ${formatNumber(save.bestDistance)} m` : 'Sin récord aún'}
          </TelText>
        </View>
      </View>

      <View style={styles.showcase}>
        <View style={[styles.stage, { borderColor: shown.color }, !owned && styles.stageLocked]}>
          <Avatar character={shown} size={132} />
          {!owned && (
            <View style={styles.lock}>
              <TelIcon name="lock" size={16} color={colors.primary} />
            </View>
          )}
        </View>
        <View style={styles.flex}>
          <TelText variant="small" color="accent" style={styles.kicker}>
            {shown.role.toUpperCase()}
          </TelText>
          <TelText variant="title" color="cream">
            {shown.name}
          </TelText>
          <TelText variant="caption" color="accentSoft">
            {shown.fact}
          </TelText>
          <View style={styles.perk}>
            <TelIcon name="bolt" size={14} color={colors.primary} />
            <TelText variant="small" color="primary" style={styles.flex}>
              {shown.perk}
            </TelText>
          </View>
        </View>
      </View>

      {owned ? (
        <TelButton label={`Correr con ${shown.name}`} variant="cream" size="lg" iconRight="arrowRight" onPress={start} />
      ) : (
        <>
          <TelButton
            label={missing === 0 ? `Desbloquear por ${formatNumber(shown.cost)} paquetes` : `Te faltan ${formatNumber(missing)} paquetes`}
            variant="cream"
            size="lg"
            icon={missing === 0 ? 'unlock' : 'lock'}
            disabled={missing > 0}
            onPress={() => void unlock()}
          />
          <ProgressBar progress={Math.min(1, save.data / shown.cost)} color={colors.accent} trackColor={colors.primarySoft} height={6} accessibilityLabel={`Paquetes para ${shown.name}`} />
        </>
      )}

      <View style={styles.section}>
        <TelText variant="heading" color="cream">
          Personajes telemáticos
        </TelText>
        <TelText variant="caption" color="accentSoft">
          Cada uno existe en las redes de verdad y corre con una ventaja distinta. Desbloquéalos con los paquetes que juntas.
        </TelText>
        <View style={styles.grid}>
          {runnerCharacters.map((character) => {
            const has = save.unlocked.includes(character.id);
            const active = shown.id === character.id;
            return (
              <PressableScale
                key={character.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${character.name}, ${character.role}. ${has ? (save.selected === character.id ? 'En uso' : 'Desbloqueado') : `Cuesta ${character.cost} paquetes`}`}
                haptic
                onPress={() => void choose(character)}
                style={[styles.cell, active && styles.cellActive]}
              >
                <View style={!has && styles.dim}>
                  <Avatar character={character} size={62} />
                </View>
                <TelText variant="small" color={active ? 'primary' : 'cream'} align="center" numberOfLines={1}>
                  {character.name}
                </TelText>
                {has ? (
                  <TelText variant="small" color={active ? 'secondary' : 'accentSoft'} align="center" style={styles.cellNote}>
                    {save.selected === character.id ? 'En uso' : 'Listo'}
                  </TelText>
                ) : (
                  <View style={styles.price}>
                    <TelIcon name="packet" size={12} color={active ? colors.secondary : colors.accentSoft} />
                    <TelText variant="small" color={active ? 'secondary' : 'accentSoft'} tabular style={styles.cellNote}>
                      {formatNumber(character.cost)}
                    </TelText>
                  </View>
                )}
              </PressableScale>
            );
          })}
        </View>
      </View>

      <AccountGate />
      <TutorialSheet tutorial={tutorials.runner} visible={tutorial.visible} onClose={tutorial.close} doneLabel="¡Entendido, a correr!" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 4,
  },
  playContent: {
    paddingBottom: spacing.md,
  },
  kicker: {
    letterSpacing: 1.2,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  showcase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stage: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    backgroundColor: colors.primaryDeep,
  },
  stageLocked: {
    opacity: 0.75,
  },
  lock: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  section: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  cell: {
    width: '23%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
    backgroundColor: colors.primarySoft,
  },
  cellActive: {
    borderColor: colors.cream,
    backgroundColor: colors.cream,
  },
  cellNote: {
    fontSize: 11,
  },
  dim: {
    opacity: 0.5,
  },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  actions: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
