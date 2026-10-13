import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { storyChapters, type StoryChapter } from '@/data/story';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { recordGameResult } from '@/storage/profile';
import { completeChapter, loadStoryProgress, type StoryProgress } from '@/storage/story';
import { colors, radius, spacing } from '@/theme';

const MAP_HEIGHT = 340;
const MAP_PADDING = spacing.sm;
const BADGE_SIZE = 48;
// Desplazamiento horizontal de cada nodo: dibuja la ruta en zigzag sin que los nodos se crucen.
const NODE_OFFSETS = [0, 56, 16];

type StoryPhase = 'map' | 'dialogue' | 'challenge' | 'done';

export default function StoryScreen() {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [phase, setPhase] = useState<StoryPhase>('map');
  const [chapter, setChapter] = useState<StoryChapter | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [challengeFailed, setChallengeFailed] = useState(false);
  const [chapterStartedAt, setChapterStartedAt] = useState(0);
  const { height } = useWindowDimensions();
  const compact = height < 700;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadStoryProgress().then((value) => {
        if (active) {
          setProgress(value);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const completed = progress?.completedChapters ?? [];
  const allDone = completed.length >= storyChapters.length;

  function isUnlocked(index: number): boolean {
    if (index === 0) {
      return true;
    }
    return completed.includes(storyChapters[index - 1].id);
  }

  function openChapter(target: StoryChapter) {
    setChapter(target);
    setDialogueIndex(0);
    setSelected(null);
    setChallengeFailed(false);
    setChapterStartedAt(Date.now());
    setPhase('dialogue');
  }

  function advanceDialogue() {
    if (!chapter) {
      return;
    }
    if (dialogueIndex + 1 >= chapter.dialogue.length) {
      setPhase('challenge');
      return;
    }
    setDialogueIndex((value) => value + 1);
  }

  async function answerChallenge(index: number) {
    if (!chapter || selected !== null) {
      return;
    }

    setSelected(index);
    if (index === chapter.challenge.answerIndex) {
      await feedbackSuccess();
      return;
    }
    await feedbackWarning();
  }

  async function finishChallenge() {
    if (!chapter || selected !== chapter.challenge.answerIndex) {
      setSelected(null);
      setChallengeFailed(true);
      return;
    }

    const updated = await completeChapter(chapter.id);
    setProgress(updated);
    await recordGameResult({
      gameId: 'story',
      score: chapter.rewardXp,
      accuracy: 1,
      durationSeconds: Math.max(1, Math.round((Date.now() - chapterStartedAt) / 1000)),
      completedAt: new Date().toISOString(),
      metadata: { chapter: chapter.number },
    });
    setPhase('done');
  }

  if (phase === 'map') {
    // Cada nodo ocupa su propia fila; los centros de las insignias definen la ruta punteada.
    const rowGap = (MAP_HEIGHT - MAP_PADDING * 2 - BADGE_SIZE * storyChapters.length) / (storyChapters.length - 1);
    const centers = storyChapters.map((_, index) => ({
      x: MAP_PADDING + NODE_OFFSETS[index % NODE_OFFSETS.length] + BADGE_SIZE / 2,
      y: MAP_PADDING + index * (BADGE_SIZE + rowGap) + BADGE_SIZE / 2,
    }));
    const pathDots = centers.slice(1).flatMap((end, index) => {
      const start = centers[index];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const steps = Math.max(2, Math.round(length / 12));
      const reached = completed.includes(storyChapters[index].id);
      return Array.from({ length: steps - 1 }, (_, step) => (step + 1) / steps)
        // Sin puntos bajo las insignias: las bloqueadas son translúcidas y los dejarían ver.
        .filter((ratio) => Math.min(ratio, 1 - ratio) * length > BADGE_SIZE / 2 + 4)
        .map((ratio) => ({
          key: `${index}-${ratio}`,
          left: start.x + (end.x - start.x) * ratio - 2,
          top: start.y + (end.y - start.y) * ratio - 2,
          reached,
        }));
    });

    return (
      <Screen dark>
        <TelText variant="overline" color="accentSoft">Modo historia</TelText>
        <TelText variant="hero" color="white">La señal perdida</TelText>
        <TelText color="accentSoft">
          Alguien —o algo— dejó el campus sin conexión. Ayuda a Telix a restaurarla capítulo a capítulo.
        </TelText>

        <View style={styles.mapContainer}>
          {pathDots.map((dot) => (
            <View
              key={dot.key}
              style={[styles.pathDot, dot.reached && styles.pathDotReached, { left: dot.left, top: dot.top }]}
            />
          ))}
          {storyChapters.map((item, index) => {
            const unlocked = isUnlocked(index);
            const done = completed.includes(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Capítulo ${item.number}: ${item.title}. ${done ? 'Completado' : unlocked ? 'Disponible' : 'Bloqueado'}`}
                disabled={!unlocked}
                onPress={() => openChapter(item)}
                style={({ pressed }) => [
                  styles.chapterNode,
                  { marginLeft: NODE_OFFSETS[index % NODE_OFFSETS.length] },
                  !unlocked && styles.chapterLocked,
                  pressed && unlocked && styles.chapterPressed,
                ]}
              >
                <View style={styles.chapterBadge}>
                  <Ionicons
                    color={done ? colors.success : unlocked ? colors.primary : colors.muted}
                    name={done ? 'checkmark-circle' : unlocked ? 'radio-button-on' : 'lock-closed'}
                    size={24}
                  />
                </View>
                <View style={styles.chapterLabel}>
                  <TelText variant="caption" color={unlocked ? 'white' : 'muted'} style={styles.chapterTitle}>
                    {item.number}. {item.title}
                  </TelText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {allDone && (
          <TelCard tone="cream">
            <TelText variant="subtitle" color="primary">¡Historia completada!</TelText>
            <TelText color="primarySoft">
              Restauraste la red del campus. Nuevos capítulos llegarán en futuras actualizaciones.
            </TelText>
          </TelCard>
        )}

        <TelButton label="Volver" variant="ghost" surface="dark" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!chapter) {
    return <Screen dark />;
  }

  if (phase === 'dialogue') {
    return (
      <Screen dark contentStyle={styles.centered}>
        <View style={styles.dialogueAvatar}>
          <Ionicons color={colors.accentSoft} name="planet" size={88} />
        </View>
        <TelText variant="overline" color="accentSoft" align="center">
          Capítulo {chapter.number} · {chapter.title}
        </TelText>
        <TelCard tone="cream">
          <TelText variant="body" color="primary">{chapter.dialogue[dialogueIndex]}</TelText>
        </TelCard>
        <TelText variant="caption" color="accentSoft" align="center">
          {dialogueIndex + 1}/{chapter.dialogue.length}
        </TelText>
        <TelButton
          label={dialogueIndex + 1 >= chapter.dialogue.length ? 'Aceptar el reto' : 'Continuar'}
          onPress={advanceDialogue}
        />
      </Screen>
    );
  }

  if (phase === 'challenge') {
    const isCorrect = selected === chapter.challenge.answerIndex;
    return (
      <Screen dark autoScrollKey={selected !== null}>
        <TelText variant="overline" color="accentSoft">Reto del capítulo</TelText>
        <TelText variant={compact ? 'subtitle' : 'title'} color="white">{chapter.challenge.prompt}</TelText>

        <View style={styles.options}>
          {chapter.challenge.options.map((option, index) => {
            const isSelected = selected === index;
            const showCorrect = selected !== null && index === chapter.challenge.answerIndex;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={option}
                disabled={selected !== null}
                onPress={() => void answerChallenge(index)}
                style={({ pressed }) => [
                  styles.option,
                  compact && styles.optionCompact,
                  pressed && styles.optionPressed,
                  showCorrect && styles.optionCorrect,
                  isSelected && !showCorrect && styles.optionWrong,
                ]}
              >
                <TelText variant="bodyStrong" color="primary" align="center">{option}</TelText>
              </Pressable>
            );
          })}
        </View>

        {selected !== null && (
          <TelCard tone="cream" style={compact && styles.compactCard}>
            <TelText variant="bodyStrong" color="primary">
              {isCorrect ? '¡Exacto!' : 'Casi…'}
            </TelText>
            <TelText color="primarySoft">{chapter.challenge.explanation}</TelText>
            <TelButton
              label={isCorrect ? 'Completar capítulo' : 'Intentar de nuevo'}
              variant={isCorrect ? 'primary' : 'secondary'}
              onPress={() => void finishChallenge()}
            />
            {challengeFailed && !isCorrect && (
              <TelText variant="caption" color="secondary">Pista: piensa como telemático en terreno.</TelText>
            )}
          </TelCard>
        )}
      </Screen>
    );
  }

  return (
    <Screen dark contentStyle={styles.centered}>
      <Ionicons color={colors.success} name="checkmark-circle" size={88} style={styles.doneIcon} />
      <TelText variant="hero" color="white" align="center">Capítulo {chapter.number} completado</TelText>
      <TelText color="accentSoft" align="center">
        +{chapter.rewardXp} XP. {chapter.number >= storyChapters.length
          ? 'Restauraste la señal del campus. Telix está orgulloso.'
          : 'La señal se acerca. El siguiente capítulo ya está desbloqueado.'}
      </TelText>
      <TelButton label="Volver al mapa" onPress={() => setPhase('map')} />
      <TelButton label="Ir al inicio" variant="ghost" surface="dark" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  compactCard: {
    padding: spacing.md,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    justifyContent: 'space-between',
    padding: MAP_PADDING,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,212,237,0.25)',
    backgroundColor: 'rgba(111,179,217,0.1)',
  },
  pathDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(167,212,237,0.4)',
  },
  pathDotReached: {
    backgroundColor: colors.success,
  },
  chapterNode: {
    minHeight: BADGE_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  chapterBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.accent,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  chapterLabel: {
    flexShrink: 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(11,45,69,0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  chapterTitle: {
    fontWeight: '700',
  },
  chapterLocked: {
    opacity: 0.55,
  },
  chapterPressed: {
    transform: [{ scale: 0.95 }],
  },
  dialogueAvatar: {
    width: 140,
    height: 140,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(111,179,217,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,212,237,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  doneIcon: {
    alignSelf: 'center',
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  optionCompact: {
    minHeight: 52,
  },
  optionPressed: {
    backgroundColor: colors.accentSoft,
    transform: [{ scale: 0.98 }],
  },
  optionCorrect: {
    backgroundColor: '#BEE3C7',
  },
  optionWrong: {
    backgroundColor: '#F6C8C4',
  },
});
