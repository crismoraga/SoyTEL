import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { loadProfile, saveProfile, unlockAchievement } from '@/storage/profile';
import { loadMascotDays, loadMascotLog, logMascotDay, saveMascotLog, type MascotLog } from '@/storage/story';
import { colors, radius, spacing } from '@/theme';
import type { UserProfile } from '@/types/game';

const MAX_DAILY_INTERACTIONS = 3;

function moodLabel(value: number): string {
  if (value >= 85) return 'radiante';
  if (value >= 65) return 'motivado';
  if (value >= 40) return 'curioso';
  return 'con poca señal';
}

export default function MascotScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [log, setLog] = useState<MascotLog | null>(null);
  const [daysCount, setDaysCount] = useState(0);
  const [message, setMessage] = useState('Telix está listo para restaurar la red.');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([loadProfile(), loadMascotLog(), loadMascotDays()]).then(async ([profileValue, logValue, days]) => {
        if (!active) {
          return;
        }
        if (profileValue.lastPlayedAt) {
          const saved = { ...profileValue, mascotMood: profileValue.mascotMood };
          await saveProfile(saved);
        }
        setProfile(profileValue);
        setLog(logValue);
        setDaysCount(days.length);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  async function interact(kind: 'feed' | 'train' | 'listen') {
    if (!profile || !log) {
      return;
    }

    if (log.count >= MAX_DAILY_INTERACTIONS) {
      setMessage('Telix necesita procesar datos. Vuelve mañana o juega una partida para motivarlo.');
      await feedbackTap();
      return;
    }

    const delta = kind === 'feed' ? 5 : kind === 'train' ? 8 : 3;
    const updated = {
      ...profile,
      mascotMood: Math.min(100, profile.mascotMood + delta),
    };
    const updatedLog = { date: log.date, count: log.count + 1 };
    const days = await logMascotDay(new Date().toISOString());

    setProfile(updated);
    setLog(updatedLog);
    setDaysCount(days.length);
    setMessage(
      kind === 'feed'
        ? 'Telix recargó energía con datos frescos.'
        : kind === 'train'
          ? 'Telix practicó diagnósticos de red.'
          : 'Telix escuchó tu reporte de señal.',
    );

    if (days.length >= 7) {
      await unlockAchievement('telix-friend');
      setMessage('¡Logro desbloqueado: Aliado de Telix! Siete días de cuidado.');
    }

    await Promise.all([
      saveProfile(updated),
      saveMascotLog(updatedLog),
      feedbackTap(),
    ]);
  }

  const mood = profile?.mascotMood ?? 0;
  const interactionsLeft = MAX_DAILY_INTERACTIONS - (log?.count ?? 0);

  return (
    <Screen dark>
      <View style={styles.header}>
        <View>
          <TelText variant="overline" color="accentSoft">Mascota</TelText>
          <TelText variant="hero" color="white">Telix</TelText>
        </View>
        <View style={styles.moodBadge}>
          <TelText variant="bodyStrong" color="primary" align="center">{mood}%</TelText>
        </View>
      </View>

      <View accessibilityLabel={`Telix está ${moodLabel(mood)}`} style={styles.mascotOrb}>
        <Ionicons color={colors.accentSoft} name="planet" size={120} />
      </View>

      <TelCard tone="cream">
        <TelText variant="subtitle" color="primary">Telix está {moodLabel(mood)}</TelText>
        <TelText color="primarySoft">{message}</TelText>
        <TelText variant="caption" color="secondary">
          Interacciones de hoy: {interactionsLeft}/{MAX_DAILY_INTERACTIONS} · Días de cuidado: {daysCount}/7
        </TelText>
        <TelText variant="caption" color="secondary">
          Juega cada día para mantener su señal alta: el ánimo baja si lo abandonas.
        </TelText>
      </TelCard>

      <View style={styles.actions}>
        <TelButton label="Alimentar con datos" onPress={() => void interact('feed')} />
        <TelButton label="Entrenar diagnóstico" variant="secondary" onPress={() => void interact('train')} />
        <TelButton label="Enviar reporte" variant="ghost" onPress={() => void interact('listen')} />
        <TelButton label="Ir a jugar" variant="primary" onPress={() => router.push('/games')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moodBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotOrb: {
    minHeight: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(111, 179, 217, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.35)',
  },
  actions: {
    gap: spacing.sm,
  },
});
