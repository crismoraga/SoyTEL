import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { ProgressBar } from '@/components/feedback/Progress';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Medallion } from '@/components/graphics/Medallion';
import { Telix } from '@/components/graphics/Telix';
import { PressableScale } from '@/components/PressableScale';
import { FeedbackPanel, OptionButton, type OptionState } from '@/components/Quiz';
import { Screen, ScreenFooter } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { areaLabels } from '@/data/questions';
import { storyChapters, type StoryChapter } from '@/data/story';
import { campusMapDrawing } from '@/graphics/campusMap';
import { SvgDrawing } from '@/graphics/ShapeLayer';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useEntering } from '@/lib/motion';
import { useScrollToEnd } from '@/lib/useScrollToEnd';
import { useFocusData } from '@/lib/useFocusData';
import { now } from '@/lib/clock';
import { recordGameResult } from '@/storage/profile';
import { completeChapter, loadStoryProgress } from '@/storage/story';
import { colors, radius, spacing } from '@/theme';
import type { GameOutcome } from '@/types/game';

type StoryPhase = 'map' | 'dialogue' | 'challenge' | 'done';

const LETTERS = ['A', 'B', 'C', 'D'];
const NODE = 52;

// Texto que aparece letra a letra (se completa al instante si se reduce el movimiento).
function useTypewriter(text: string, speed = 18) {
  const [progress, setProgress] = useState({ text, count: 0 });
  // Al cambiar de línea se parte desde cero sin esperar al efecto.
  const count = progress.text === text ? progress.count : 0;
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index += 2;
      setProgress({ text, count: index });
      if (index >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [speed, text]);
  const shown = text.slice(0, count);
  return { shown, done: shown.length >= text.length, finish: () => setProgress({ text, count: text.length }) };
}

export default function StoryScreen() {
  const entering = useEntering();
  const { data: progress, setData: setProgress } = useFocusData(loadStoryProgress);
  const [phase, setPhase] = useState<StoryPhase>('map');
  const [chapter, setChapter] = useState<StoryChapter | null>(null);
  const [line, setLine] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const map = useMemo(() => campusMapDrawing(), []);
  const scroller = useScrollToEnd();

  const completed = progress?.completedChapters ?? [];
  const allDone = completed.length >= storyChapters.length;

  function isUnlocked(index: number): boolean {
    return index === 0 || completed.includes(storyChapters[index - 1].id);
  }

  function open(target: StoryChapter) {
    setChapter(target);
    setLine(0);
    setPicked(null);
    setAnswered(false);
    setAttempts(0);
    setOutcome(null);
    setStartedAt(now());
    setPhase('dialogue');
  }

  async function submit() {
    if (!chapter || picked === null) return;
    setAnswered(true);
    scroller.scrollToEnd();
    setAttempts((value) => value + 1);
    if (picked === chapter.challenge.answerIndex) {
      await feedbackSuccess();
    } else {
      await feedbackWarning();
    }
  }

  async function complete() {
    if (!chapter) return;
    const updated = await completeChapter(chapter.id);
    setProgress(updated);
    const result = await recordGameResult({
      gameId: 'story',
      score: chapter.rewardXp,
      accuracy: attempts <= 1 ? 1 : 0.6,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      completedAt: new Date().toISOString(),
      metadata: { chapter: chapter.number },
    });
    setOutcome(result);
    setPhase('done');
  }

  if (phase === 'dialogue' && chapter) {
    return <DialogueView chapter={chapter} line={line} onNext={() => (line + 1 >= chapter.dialogue.length ? setPhase('challenge') : setLine(line + 1))} onBack={() => setPhase('map')} />;
  }

  if (phase === 'challenge' && chapter) {
    const correct = answered && picked === chapter.challenge.answerIndex;
    return (
      <Screen
        tone="dark"
        backdrop="stars"
        scrollRef={scroller.ref}
        header={<AppHeader transparent onBack={() => setPhase('map')} kicker={`Capítulo ${chapter.number} · ${areaLabels[chapter.area]}`} title="Reto del capítulo" compact />}
        footer={
          <ScreenFooter tone="dark">
            {!answered && <TelButton label="Responder" variant="cream" disabled={picked === null} onPress={() => void submit()} />}
            {answered && correct && <TelButton label="Completar capítulo" variant="cream" iconRight="arrowRight" onPress={() => void complete()} />}
            {answered && !correct && (
              <TelButton
                label="Intentar de nuevo"
                variant="outlineLight"
                icon="refresh"
                onPress={() => {
                  setPicked(null);
                  setAnswered(false);
                }}
              />
            )}
          </ScreenFooter>
        }
      >
        <View style={styles.challengeHead}>
          <Telix size={88} expression={answered ? (correct ? 'celebrate' : 'sad') : 'think'} pose={answered && correct ? 'celebrate' : 'idle'} />
          <TelText variant="subtitle" color="cream" style={styles.flex}>
            {chapter.challenge.prompt}
          </TelText>
        </View>
        <View style={styles.options}>
          {chapter.challenge.options.map((option, index) => {
            let state: OptionState = 'idle';
            if (!answered && picked === index) state = 'selected';
            if (answered && correct && index === chapter.challenge.answerIndex) state = 'correct';
            if (answered && !correct && picked === index) state = 'wrong';
            if (answered && state === 'idle') state = 'dimmed';
            return (
              <OptionButton
                key={option}
                tone="dark"
                letter={LETTERS[index]}
                label={option}
                state={state}
                disabled={answered}
                onPress={() => setPicked(index)}
              />
            );
          })}
        </View>
        {answered && correct && <FeedbackPanel kind="success" title={`¡Exacto! +${chapter.rewardXp} XP`} body={chapter.challenge.explanation} />}
        {answered && !correct && (
          <FeedbackPanel kind="error" title="Casi… inténtalo otra vez" body={attempts >= 2 ? `Pista: ${chapter.challenge.hint}` : 'Piensa como telemático en terreno.'} />
        )}
      </Screen>
    );
  }

  if (phase === 'done' && chapter) {
    const finale = chapter.number >= storyChapters.length;
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact />}>
        <Celebration burstKey={chapter.number} count={finale ? 40 : 26} />
        <View style={styles.doneHero}>
          <Telix size={200} expression="celebrate" pose="celebrate" signal={4} />
          <Animated.View entering={entering.pop(2)}>
            <Medallion glyph={chapter.glyph} tier={finale ? 'oro' : 'crema'} size={88} ribbon />
          </Animated.View>
          <TelText variant="overline" color="accent" align="center">
            Capítulo {chapter.number} completado
          </TelText>
          <TelText variant="title" color="cream" align="center">
            {chapter.title}
          </TelText>
          <TelText variant="body" color="onDark" align="center">
            {chapter.outro}
          </TelText>
          {outcome && (
            <View style={styles.rewardRow}>
              <Tag tone="glass" icon="sparkle" label={`+${outcome.xpGained} XP`} />
              {outcome.leveledUp && <Tag tone="cream" icon="rocket" label={`Nivel ${outcome.profile.level}`} />}
            </View>
          )}
        </View>
        <View style={styles.doneActions}>
          {!finale && (
            <TelButton
              label="Siguiente capítulo"
              variant="cream"
              iconRight="arrowRight"
              onPress={() => {
                const next = storyChapters[chapter.number];
                if (next) open(next);
              }}
            />
          )}
          <TelButton label="Volver al mapa" variant="outlineLight" icon="map" onPress={() => setPhase('map')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      tone="dark"
      backdrop="stars"
      header={
        <AppHeader transparent onBack={() => router.back()} kicker="Modo historia" title="La señal perdida" subtitle="Alguien dejó el campus sin conexión. Ayuda a Telix a restaurarla, capítulo a capítulo." />
      }
    >
      <View style={styles.progressRow}>
        <TelText variant="label" color="cream">
          {completed.length} de {storyChapters.length} capítulos
        </TelText>
        <ProgressBar progress={completed.length / storyChapters.length} color={colors.accent} trackColor={colors.primary} style={styles.flex} />
      </View>

      <View style={styles.map} accessibilityLabel="Mapa del campus con los capítulos">
        <SvgDrawing drawing={map} width="100%" height="100%" slice />
        {progress
          ? storyChapters.map((item, index) => {
              const unlocked = isUnlocked(index);
              const done = completed.includes(item.id);
              const current = unlocked && !done;
              return (
                <PressableScale
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Capítulo ${item.number}: ${item.title}. ${done ? 'Completado' : unlocked ? 'Disponible' : 'Bloqueado'}`}
                  disabled={!unlocked}
                  haptic
                  onPress={() => open(item)}
                  style={[styles.node, { left: `${item.map.x}%`, top: `${item.map.y}%` }]}
                >
                  <View style={[styles.nodeRing, current && styles.nodeCurrent]}>
                    <Medallion glyph={item.glyph} state={done ? 'unlocked' : unlocked ? 'progress' : 'locked'} progress={done ? 1 : 0} size={NODE} />
                  </View>
                  <View style={[styles.nodeLabel, !unlocked && styles.nodeLabelLocked]}>
                    <TelText variant="small" color={unlocked ? 'cream' : 'slate'} style={styles.nodeText}>
                      {item.number}. {item.location}
                    </TelText>
                  </View>
                </PressableScale>
              );
            })
          : null}
      </View>

      <View style={styles.list}>
        {progress
          ? storyChapters.map((item, index) => {
              const unlocked = isUnlocked(index);
              const done = completed.includes(item.id);
              return (
                <TelCard
                  key={item.id}
                  tone="dark"
                  onPress={unlocked ? () => open(item) : undefined}
                  accessibilityLabel={`Capítulo ${item.number}: ${item.title}`}
                  style={[styles.chapterRow, !unlocked && styles.locked]}
                >
                  <Medallion glyph={item.glyph} state={done ? 'unlocked' : unlocked ? 'progress' : 'locked'} size={48} />
                  <View style={styles.flex}>
                    <TelText variant="small" color="accent" style={styles.kicker}>
                      CAPÍTULO {item.number} · {areaLabels[item.area].toUpperCase()}
                    </TelText>
                    <TelText variant="subtitle" color="cream">
                      {item.title}
                    </TelText>
                    <TelText variant="caption" color="accentSoft">
                      {item.location} · +{item.rewardXp} XP
                    </TelText>
                  </View>
                  {done ? (
                    <TelIcon name="checkCircle" size={24} color={colors.accent} />
                  ) : unlocked ? (
                    <TelIcon name="play" size={22} color={colors.cream} />
                  ) : (
                    <TelIcon name="lock" size={22} color={colors.slate} />
                  )}
                </TelCard>
              );
            })
          : [0, 1, 2].map((index) => <Skeleton key={index} tone="dark" height={76} rounded={radius.lg} />)}
      </View>

      {allDone && (
        <TelCard tone="cream">
          <TelText variant="subtitle" color="primary">
            ¡Historia completada!
          </TelText>
          <TelText variant="body" color="primarySoft">
            Restauraste la señal del campus. Puedes repetir cualquier capítulo para practicar.
          </TelText>
        </TelCard>
      )}
    </Screen>
  );
}

function DialogueView({ chapter, line, onNext, onBack }: { chapter: StoryChapter; line: number; onNext: () => void; onBack: () => void }) {
  const entering = useEntering();
  const current = chapter.dialogue[line];
  const { shown, done, finish } = useTypewriter(current.text);
  const last = line + 1 >= chapter.dialogue.length;

  return (
    <Screen
      tone="dark"
      backdrop="stars"
      scroll={false}
      header={<AppHeader transparent onBack={onBack} kicker={`Capítulo ${chapter.number} · ${chapter.location}`} title={chapter.title} compact />}
      contentStyle={styles.dialogue}
    >
      <View style={styles.dialogueStage}>
        <Telix size={220} expression={current.mood} pose={current.mood === 'happy' ? 'wave' : current.mood === 'think' ? 'think' : 'idle'} />
      </View>
      <Animated.View key={line} entering={entering.fadeUp()} style={styles.speech}>
        <TelText variant="small" color="secondary" style={styles.kicker}>
          TELIX
        </TelText>
        <TelText variant="bodyStrong" color="primary" style={styles.speechText} accessibilityLiveRegion="polite">
          {shown}
        </TelText>
      </Animated.View>
      <View style={styles.dots}>
        {chapter.dialogue.map((_, index) => (
          <View key={index} style={[styles.dot, index === line && styles.dotActive]} />
        ))}
      </View>
      <TelButton
        label={!done ? 'Mostrar todo' : last ? 'Aceptar el reto' : 'Continuar'}
        variant={last && done ? 'cream' : 'accent'}
        iconRight={done ? 'arrowRight' : undefined}
        onPress={done ? onNext : finish}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    letterSpacing: 1.2,
    fontSize: 11,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  map: {
    aspectRatio: 320 / 400,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.25)',
  },
  node: {
    position: 'absolute',
    marginLeft: -NODE / 2,
    marginTop: -NODE / 2,
    alignItems: 'center',
    width: NODE,
    overflow: 'visible',
  },
  nodeRing: {
    borderRadius: NODE,
  },
  nodeCurrent: {
    boxShadow: '0px 0px 18px rgba(244, 236, 215, 0.75)',
  },
  nodeLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11, 45, 69, 0.88)',
    width: 128,
    alignItems: 'center',
  },
  nodeLabelLocked: {
    backgroundColor: 'rgba(11, 45, 69, 0.6)',
  },
  nodeText: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  list: {
    gap: spacing.sm,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 14,
  },
  locked: {
    opacity: 0.6,
  },
  challengeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  options: {
    gap: 10,
  },
  doneHero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  doneActions: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
  dialogue: {
    justifyContent: 'flex-end',
  },
  dialogueStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speech: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    minHeight: 110,
  },
  speechText: {
    fontSize: 17,
    lineHeight: 25,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.cream,
  },
});
