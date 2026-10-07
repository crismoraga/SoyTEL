import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { Celebration } from '@/components/feedback/Celebration';
import { ProgressRing } from '@/components/feedback/Progress';
import { Rutix, type RutixExpression, type RutixPose } from '@/components/graphics/Rutix';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { danceLines, highFiveLines, pickDifferent, rutixJokes, rutixTrueFalse, tickleReactions } from '@/data/rutixPlay';
import { randomTip } from '@/data/tips';
import { MissionsCard } from '@/features/missions/MissionsCard';
import { HelpButton, TutorialSheet } from '@/features/tutorial/TutorialSheet';
import { tutorials } from '@/features/tutorial/tutorials';
import { expressionForMood, isAccessoryUnlocked, rutixWardrobe, signalForMood } from '@/graphics/rutix';
import { now } from '@/lib/clock';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useEntering, useMotionLevel } from '@/lib/motion';
import { useFocusData } from '@/lib/useFocusData';
import { loadProfile, loadResults, syncAchievements, updateMascotMood } from '@/storage/profile';
import { updateSettings, useSettings } from '@/storage/settings';
import { countMascotCare, loadMascotDays, loadMascotLog, logMascotDay } from '@/storage/story';
import { useTutorial } from '@/storage/tutorials';
import { colors, radius, spacing } from '@/theme';

const MAX_DAILY_INTERACTIONS = 3;

type Interaction = 'feed' | 'train' | 'talk';

const interactions: { id: Interaction; label: string; icon: IconName; delta: number }[] = [
  { id: 'feed', label: 'Recargar datos', icon: 'bolt', delta: 6 },
  { id: 'train', label: 'Entrenar', icon: 'target', delta: 8 },
  { id: 'talk', label: 'Conversar', icon: 'sparkle', delta: 4 },
];

// Juegos con Rutix: no gastan cuidados del día, son solo para divertirse.
type PlayId = 'highfive' | 'joke' | 'dance' | 'quiz';

const plays: { id: PlayId; label: string; icon: IconName }[] = [
  { id: 'highfive', label: 'Chócala', icon: 'tap' },
  { id: 'joke', label: 'Chiste', icon: 'sound' },
  { id: 'dance', label: 'Baila', icon: 'sparkles' },
  { id: 'quiz', label: '¿V o F?', icon: 'help' },
];

const danceFrames: [RutixExpression, RutixPose][] = [
  ['laugh', 'celebrate'],
  ['happy', 'wave'],
  ['wink', 'thumbsUp'],
  ['laugh', 'celebrate'],
  ['happy', 'point'],
  ['celebrate', 'celebrate'],
  ['happy', 'wave'],
  ['proud', 'thumbsUp'],
];

function moodLabel(value: number): string {
  if (value >= 85) return 'radiante';
  if (value >= 60) return 'motivado';
  if (value >= 35) return 'con sueño';
  return 'con poca señal';
}

// Tamagotchi de Rutix: su señal (ánimo) sube con partidas y cuidados, y baja si lo olvidas.
export default function MascotScreen() {
  const entering = useEntering();
  const settings = useSettings();
  const [message, setMessage] = useState('¡Hola! Soy Rutix. Mantengo la señal del campus y aprendo contigo.');
  const [reaction, setReaction] = useState<{ expression: RutixExpression; pose: RutixPose } | null>(null);
  const [reactKey, setReactKey] = useState(0);
  const [burst, setBurst] = useState<number | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Esta pantalla no muestra la invitación a crear cuenta: el tutorial no tiene que esperarla.
  const tutorial = useTutorial('rutix', { waitForAccountOffer: false });
  const motion = useMotionLevel();
  const caring = useRef(false);
  // Pregunta de verdadero o falso en curso (índice en rutixTrueFalse).
  const [quiz, setQuiz] = useState<number | null>(null);
  const tickle = useRef({ level: 0, at: 0 });
  const picks = useRef({ five: -1, joke: -1, dance: -1, quiz: -1 });
  const danceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wiggle = useSharedValue(0);
  const wiggleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value * 9}deg` }, { translateY: -Math.abs(wiggle.value) * 6 }] }));
  const { data, setData, reload } = useFocusData(async () => {
    const [profile, log, days, results] = await Promise.all([loadProfile(), loadMascotLog(), loadMascotDays(), loadResults()]);
    return { profile, log, days: days.length, results };
  });

  useEffect(() => () => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    if (danceTimer.current) clearInterval(danceTimer.current);
    cancelAnimation(wiggle);
  }, [wiggle]);

  // Si se pide menos movimiento mientras Rutix baila, el baile se detiene.
  useEffect(() => {
    if (motion !== 'minimal') return;
    if (danceTimer.current) clearInterval(danceTimer.current);
    danceTimer.current = null;
    cancelAnimation(wiggle);
    wiggle.set(0);
  }, [motion, wiggle]);

  function stopDance() {
    if (danceTimer.current) clearInterval(danceTimer.current);
    danceTimer.current = null;
    cancelAnimation(wiggle);
    wiggle.set(withTiming(0, { duration: 160 }));
  }

  function react(expression: RutixExpression, pose: RutixPose = 'idle', duration = 2200) {
    setReaction({ expression, pose });
    setReactKey((value) => value + 1);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(null), duration);
  }

  async function interact(kind: Interaction) {
    // Un cuidado a la vez: dos toques seguidos no cuentan doble.
    if (!data || caring.current) return;
    caring.current = true;
    try {
      // El cupo del día y el ánimo se actualizan sobre lo guardado, no sobre lo que muestra la pantalla.
      const care = await countMascotCare(MAX_DAILY_INTERACTIONS);
      if (!care.counted) {
        setData({ ...data, log: care.log });
        setMessage('Estoy procesando todo lo que aprendimos hoy. Vuelve mañana o juega una partida para motivarme.');
        react('sleepy');
        await feedbackWarning();
        return;
      }
      const option = interactions.find((item) => item.id === kind);
      const profile = await updateMascotMood(option?.delta ?? 4);
      const days = await logMascotDay();
      setData({ profile, log: care.log, days: days.length, results: data.results });
    } catch {
      setMessage('No pude guardar eso en el teléfono. Inténtalo de nuevo en un momento.');
      react('worried');
      return;
    } finally {
      caring.current = false;
    }

    if (kind === 'feed') {
      setMessage('¡Datos frescos! Mi batería de conocimiento está al máximo.');
      react('happy', 'wave');
    } else if (kind === 'train') {
      setMessage('Practicamos diagnóstico de redes: ¡ya distingo un switch de un router con los ojos cerrados!');
      react('celebrate', 'celebrate');
    } else {
      setMessage(`¿Sabías que…? ${randomTip().text}`);
      react('wink', 'point', 3200);
    }
    await feedbackSuccess();

    const unlocked = await syncAchievements();
    if (unlocked.length > 0) {
      setBurst((value) => (value ?? 0) + 1);
      react('love', 'celebrate', 3000);
    }
  }

  // Tocar a Rutix varias veces seguidas pasa del saludo a las cosquillas.
  async function pet() {
    await feedbackTap();
    stopDance();
    const at = now();
    const level = at - tickle.current.at < 2500 ? Math.min(tickle.current.level + 1, tickleReactions.length - 1) : 0;
    tickle.current = { level, at };
    const reaction = tickleReactions[level];
    react(reaction.expression, reaction.pose, 1900);
    setMessage(reaction.text);
  }

  function play(id: PlayId) {
    stopDance();
    setQuiz(null);
    if (id === 'highfive') {
      picks.current.five = pickDifferent(highFiveLines, picks.current.five);
      setMessage(highFiveLines[picks.current.five]);
      react('proud', 'thumbsUp', 2200);
      void feedbackSuccess();
    } else if (id === 'joke') {
      picks.current.joke = pickDifferent(rutixJokes, picks.current.joke);
      setMessage(rutixJokes[picks.current.joke]);
      react('laugh', 'celebrate', 3800);
      void feedbackTap();
    } else if (id === 'dance') {
      picks.current.dance = pickDifferent(danceLines, picks.current.dance);
      setMessage(danceLines[picks.current.dance]);
      void feedbackSuccess();
      // Con animaciones mínimas, Rutix celebra con una pose en vez de moverse.
      if (motion === 'minimal') {
        react('celebrate', 'celebrate', 2200);
        return;
      }
      let frame = 0;
      react(danceFrames[0][0], danceFrames[0][1], 1400);
      wiggle.set(withRepeat(withSequence(withTiming(1, { duration: 210 }), withTiming(-1, { duration: 210 })), 8, true));
      danceTimer.current = setInterval(() => {
        frame += 1;
        if (frame >= danceFrames.length) {
          stopDance();
          return;
        }
        react(danceFrames[frame][0], danceFrames[frame][1], 1400);
      }, 420);
    } else {
      picks.current.quiz = pickDifferent(rutixTrueFalse, picks.current.quiz);
      setQuiz(picks.current.quiz);
      setMessage(`¿Verdadero o falso? ${rutixTrueFalse[picks.current.quiz].statement}`);
      react('think', 'think', 60000);
    }
  }

  function answer(value: boolean) {
    if (quiz === null) return;
    const item = rutixTrueFalse[quiz];
    const right = item.answer === value;
    setQuiz(null);
    setMessage(`${right ? '¡Correcto!' : 'Casi.'} ${item.why}`);
    react(right ? 'celebrate' : 'worried', right ? 'celebrate' : 'shrug', 3400);
    void (right ? feedbackSuccess() : feedbackWarning());
  }

  const profile = data?.profile;
  const mood = profile?.mascotMood ?? 70;
  const expression = reaction?.expression ?? expressionForMood(mood);
  const pose = reaction?.pose ?? 'idle';
  const left = MAX_DAILY_INTERACTIONS - (data?.log.count ?? 0);

  return (
    <Screen
      tone="dark"
      backdrop="stars"
      header={<AppHeader transparent onBack={() => router.back()} kicker="Tu compañero" title="Rutix" compact right={<HelpButton onPress={tutorial.open} label="Conoce a Rutix" />} />}
    >
      <Celebration burstKey={burst} />
      <View style={styles.stage}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tocar a Rutix" accessibilityHint="Tócalo varias veces para hacerle cosquillas" onPress={() => void pet()}>
          <Animated.View style={wiggleStyle}>
            <Rutix size={230} expression={expression} pose={pose} signal={signalForMood(mood)} reactKey={reactKey} />
          </Animated.View>
        </Pressable>
        <Animated.View key={message} entering={entering.fadeUp()} style={styles.bubble} accessibilityLiveRegion="polite">
          <View style={styles.bubbleTail} />
          <TelText variant="bodyStrong" color="primary">
            {message}
          </TelText>
        </Animated.View>
        {quiz !== null && (
          <View style={styles.quizRow}>
            <TelButton label="Verdadero" variant="cream" icon="check" style={styles.flex} onPress={() => answer(true)} />
            <TelButton label="Falso" variant="outlineLight" icon="close" style={styles.flex} onPress={() => answer(false)} />
          </View>
        )}
      </View>

      <View style={styles.playSection}>
        <TelText variant="small" color="accent" style={styles.kicker}>
          JUEGA CON RUTIX
        </TelText>
        <View style={styles.playRow}>
          {plays.map((item) => (
            <PressableScale key={item.id} accessibilityRole="button" accessibilityLabel={item.id === 'quiz' ? 'Verdadero o falso' : item.label} onPress={() => play(item.id)} style={styles.playButton}>
              <TelIcon name={item.icon} size={22} color={colors.primary} />
              <TelText variant="small" color="primary" align="center" numberOfLines={1}>
                {item.label}
              </TelText>
            </PressableScale>
          ))}
        </View>
      </View>

      {data && (
        <MissionsCard
          results={data.results}
          onClaimed={() => {
            reload();
            setMessage('¡Misiones cumplidas! Te dejé paquetes de datos para TEL Runner.');
            react('proud', 'celebrate', 3200);
            setBurst((value) => (value ?? 0) + 1);
          }}
        />
      )}

      <View style={styles.statusRow}>
        <View style={styles.statusCard}>
          <ProgressRing progress={mood / 100} size={64} color={colors.accent} trackColor={colors.primary} accessibilityLabel="Señal de Rutix">
            <TelText variant="label" color="cream" tabular>
              {mood}%
            </TelText>
          </ProgressRing>
          <View style={styles.flex}>
            <TelText variant="small" color="accent" style={styles.kicker}>
              SEÑAL
            </TelText>
            <TelText variant="label" color="cream" style={styles.moodText}>
              {moodLabel(mood)}
            </TelText>
          </View>
        </View>
        <View style={styles.statusCard}>
          <View style={styles.flex}>
            <TelText variant="small" color="accent" style={styles.kicker}>
              DÍAS DE CUIDADO
            </TelText>
            <View style={styles.days} accessible accessibilityLabel={`${Math.min(data?.days ?? 0, 7)} de 7 días`}>
              {Array.from({ length: 7 }, (_, index) => (
                <View key={index} style={[styles.day, index < (data?.days ?? 0) && styles.dayOn]} />
              ))}
            </View>
            <TelText variant="caption" color="accentSoft">
              {Math.min(data?.days ?? 0, 7)}/7 para «Aliado de Rutix»
            </TelText>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {interactions.map((item) => (
          <PressableScale
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ disabled: left <= 0 }}
            onPress={() => void interact(item.id)}
            style={[styles.action, left <= 0 && styles.actionOff]}
          >
            <View style={styles.actionIcon}>
              <TelIcon name={item.icon} size={24} color={colors.primary} />
            </View>
            <TelText variant="small" color="cream" align="center">
              {item.label}
            </TelText>
          </PressableScale>
        ))}
      </View>
      <TelText variant="caption" color="accentSoft" align="center">
        {left > 0 ? `Te quedan ${left} ${left === 1 ? 'cuidado' : 'cuidados'} hoy. Jugar también sube su señal.` : 'Ya lo cuidaste hoy. ¡Juega una partida para alegrarlo más!'}
      </TelText>
      <View style={styles.wardrobe}>
        <TelText variant="heading" color="cream">
          Guardarropa
        </TelText>
        <TelText variant="caption" color="accentSoft">
          Rutix lleva lo que elijas en toda la app. Desbloquea más accesorios jugando.
        </TelText>
        <View style={styles.wardrobeRow}>
          {rutixWardrobe.map((item) => {
            const unlocked = profile ? isAccessoryUnlocked(item, { level: profile.level, achievements: profile.unlockedAchievements }) : item.id === 'none';
            const selected = settings.rutixAccessory === item.id;
            return (
              <PressableScale
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !unlocked }}
                accessibilityLabel={unlocked ? item.label : `${item.label}, bloqueado. ${item.hint}`}
                haptic
                onPress={() => {
                  if (!unlocked) {
                    setMessage(`Para el accesorio «${item.label}»: ${item.hint}`);
                    react('think', 'think');
                    return;
                  }
                  void updateSettings({ rutixAccessory: item.id });
                  setMessage(item.id === 'none' ? 'Al natural también me veo bien, ¿no?' : `¿Qué tal me queda? ¡Me encanta el estilo ${item.label}!`);
                  react('proud', 'thumbsUp');
                }}
                style={[styles.outfit, selected && styles.outfitOn, !unlocked && styles.outfitLocked]}
              >
                <Rutix size={58} accessory={item.id} expression="happy" animated={false} accessibilityLabel="" />
                {!unlocked && (
                  <View style={styles.outfitLock}>
                    <TelIcon name="lock" size={12} color={colors.white} strokeWidth={2.6} />
                  </View>
                )}
                <TelText variant="small" color={selected ? 'primary' : 'cream'} align="center" numberOfLines={1} style={styles.outfitLabel}>
                  {item.label}
                </TelText>
              </PressableScale>
            );
          })}
        </View>
      </View>
      <TelButton label="Ir a jugar" variant="cream" iconRight="arrowRight" onPress={() => router.navigate('/games')} />
      <TutorialSheet tutorial={tutorials.rutix} visible={tutorial.visible} onClose={tutorial.close} doneLabel="¡A jugar con Rutix!" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  quizRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  playSection: {
    gap: spacing.xs,
  },
  playRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  playButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
  wardrobe: {
    gap: spacing.xs,
  },
  wardrobeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xxs,
  },
  outfit: {
    flexBasis: '18%',
    flexGrow: 1,
    maxWidth: '19%',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.2)',
  },
  outfitOn: {
    backgroundColor: colors.cream,
    borderColor: colors.accent,
  },
  outfitLocked: {
    opacity: 0.6,
  },
  outfitLock: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.slate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitLabel: {
    fontSize: 10,
    paddingHorizontal: 2,
  },
  stage: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  bubble: {
    alignSelf: 'stretch',
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bubbleTail: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -9,
    width: 18,
    height: 18,
    backgroundColor: colors.cream,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  flex: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    letterSpacing: 1.2,
    fontSize: 11,
  },
  moodText: {
    fontSize: 15,
    lineHeight: 19,
  },
  days: {
    flexDirection: 'row',
    gap: 4,
  },
  day: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dayOn: {
    backgroundColor: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
  },
  actionOff: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
