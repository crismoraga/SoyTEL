import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

type StoryPhase = 'map' | 'dialogue' | 'challenge' | 'done';

export default function StoryScreen() {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [phase, setPhase] = useState<StoryPhase>('map');
  const [chapter, setChapter] = useState<StoryChapter | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [challengeFailed, setChallengeFailed] = useState(false);
  const [chapterStartedAt, setChapterStartedAt] = useState(0);

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
    return (
      <Screen dark>
        <TelText variant="overline" color="accentSoft">Modo historia</TelText>
        <TelText variant="hero" color="white">La señal perdida</TelText>
        <TelText color="accentSoft">
          Alguien —o algo— dejó el campus sin conexión. Ayuda a Telix a restaurarla capítulo a capítulo.
        </TelText>

        <View style={styles.map}>
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
                  done && styles.chapterDone,
                  !unlocked && styles.chapterLocked,
                  pressed && unlocked && styles.chapterPressed,
                ]}
              >
                <View style={styles.chapterHeader}>
                  <Ionicons
                    color={done ? colors.success : unlocked ? colors.accent : 'rgba(255,255,255,0.4)'}
                    name={done ? 'checkmark-circle' : unlocked ? 'radio-button-on' : 'lock-closed'}
                    size={28}
                  />
                  <View style={styles.chapterText}>
                    <TelText variant="caption" color={unlocked ? 'accentSoft' : 'muted'}>
                      Capítulo {item.number} · {item.location}
                    </TelText>
                    <TelText variant="subtitle" color={unlocked ? 'white' : 'muted'}>
                      {item.title}
                    </TelText>
                  </View>
                </View>
                <TelText variant="caption" color={unlocked ? 'accentSoft' : 'muted'}>
                  Recompensa: {item.rewardXp} XP
                </TelText>
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

        <TelButton label="Volver" variant="ghost" onPress={() => router.back()} />
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
          <Ionicons color={colors.accent} name="planet" size={64} />
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
      <Screen dark>
        <TelText variant="overline" color="accentSoft">Reto del capítulo</TelText>
        <TelText variant="title" color="white">{chapter.challenge.prompt}</TelText>

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
          <TelCard tone="cream">
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
      <Ionicons color={colors.success} name="checkmark-circle" size={88} />
      <TelText variant="hero" color="white" align="center">Capítulo {chapter.number} completado</TelText>
      <TelText color="accentSoft" align="center">
        +{chapter.rewardXp} XP. {chapter.number >= storyChapters.length
          ? 'Restauraste la señal del campus. Telix está orgulloso.'
          : 'La señal se acerca. El siguiente capítulo ya está desbloqueado.'}
      </TelText>
      <TelButton label="Volver al mapa" onPress={() => setPhase('map')} />
      <TelButton label="Ir al inicio" variant="ghost" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  map: {
    gap: spacing.sm,
  },
  chapterNode: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(167,212,237,0.25)',
    padding: spacing.lg,
  },
  chapterDone: {
    borderColor: colors.success,
  },
  chapterLocked: {
    opacity: 0.55,
  },
  chapterPressed: {
    transform: [{ scale: 0.985 }],
    borderColor: colors.accent,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chapterText: {
    flex: 1,
    gap: 2,
  },
  dialogueAvatar: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(111,179,217,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,212,237,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
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
