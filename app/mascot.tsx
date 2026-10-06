import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { Celebration } from '@/components/feedback/Celebration';
import { ProgressRing } from '@/components/feedback/Progress';
import { Rutix, type RutixExpression, type RutixPose } from '@/components/graphics/Rutix';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { randomTip } from '@/data/tips';
import { expressionForMood, isAccessoryUnlocked, rutixWardrobe, signalForMood } from '@/graphics/rutix';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useEntering } from '@/lib/motion';
import { useFocusData } from '@/lib/useFocusData';
import { loadProfile, saveProfile, syncAchievements } from '@/storage/profile';
import { updateSettings, useSettings } from '@/storage/settings';
import { loadMascotDays, loadMascotLog, logMascotDay, saveMascotLog } from '@/storage/story';
import { colors, radius, spacing } from '@/theme';

const MAX_DAILY_INTERACTIONS = 3;

type Interaction = 'feed' | 'train' | 'talk';

const interactions: { id: Interaction; label: string; icon: IconName; delta: number }[] = [
  { id: 'feed', label: 'Recargar datos', icon: 'bolt', delta: 6 },
  { id: 'train', label: 'Entrenar', icon: 'target', delta: 8 },
  { id: 'talk', label: 'Conversar', icon: 'sparkle', delta: 4 },
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
  const { data, setData } = useFocusData(async () => {
    const [profile, log, days] = await Promise.all([loadProfile(), loadMascotLog(), loadMascotDays()]);
    return { profile, log, days: days.length };
  });

  useEffect(() => () => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
  }, []);

  function react(expression: RutixExpression, pose: RutixPose = 'idle', duration = 2200) {
    setReaction({ expression, pose });
    setReactKey((value) => value + 1);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(null), duration);
  }

  async function interact(kind: Interaction) {
    if (!data) return;
    if (data.log.count >= MAX_DAILY_INTERACTIONS) {
      setMessage('Estoy procesando todo lo que aprendimos hoy. Vuelve mañana o juega una partida para motivarme.');
      react('sleepy');
      await feedbackWarning();
      return;
    }

    const option = interactions.find((item) => item.id === kind);
    const mood = Math.min(100, data.profile.mascotMood + (option?.delta ?? 4));
    const profile = { ...data.profile, mascotMood: mood };
    const log = { date: data.log.date, count: data.log.count + 1 };
    const days = await logMascotDay(new Date().toISOString());
    await Promise.all([saveProfile(profile), saveMascotLog(log)]);
    setData({ profile, log, days: days.length });

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

  async function pet() {
    await feedbackTap();
    react('love', 'wave', 1600);
    setMessage('¡Jiji! Eso me sube la señal.');
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
      header={<AppHeader transparent onBack={() => router.back()} kicker="Tu compañero" title="Rutix" compact />}
    >
      <Celebration burstKey={burst} />
      <View style={styles.stage}>
        <Pressable accessibilityRole="button" accessibilityLabel="Acariciar a Rutix" onPress={() => void pet()}>
          <Rutix size={230} expression={expression} pose={pose} signal={signalForMood(mood)} reactKey={reactKey} />
        </Pressable>
        <Animated.View key={message} entering={entering.fadeUp()} style={styles.bubble} accessibilityLiveRegion="polite">
          <View style={styles.bubbleTail} />
          <TelText variant="bodyStrong" color="primary">
            {message}
          </TelText>
        </Animated.View>
      </View>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  wardrobe: {
    gap: spacing.xs,
  },
  wardrobeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xxs,
  },
  outfit: {
    flex: 1,
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
