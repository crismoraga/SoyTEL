import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
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

const campusMap = require('../assets/Assets_SoyTEL_4.png');
const telixSprite = require('../assets/Assets_SoyTEL_2.png');

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

        <View style={styles.mapContainer}>
          <Image source={campusMap} style={styles.mapImage} resizeMode="cover" />
          <View style={styles.mapOverlay}>
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
                    index === 0 && { top: '20%', left: '20%' },
                    index === 1 && { top: '45%', right: '15%' },
                    index === 2 && { bottom: '15%', left: '40%' },
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
                    <TelText variant="caption" color={unlocked ? 'white' : 'muted'} style={{ fontWeight: '700' }}>
                      {item.number}. {item.title}
                    </TelText>
                  </View>
                </Pressable>
              );
            })}
          </View>
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
          <Image source={telixSprite} style={styles.telixImage} resizeMode="contain" />
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
  mapContainer: {
    height: 340,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,212,237,0.25)',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  chapterNode: {
    position: 'absolute',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 140,
  },
  chapterBadge: {
    width: 48,
    height: 48,
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
    borderRadius: radius.sm,
    backgroundColor: 'rgba(11,45,69,0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  chapterDone: {
    opacity: 1,
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
  telixImage: {
    width: 120,
    height: 120,
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
