import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { achievements } from '@/data/achievements';
import { progressToNextLevel } from '@/lib/progression';
import { loadProfile } from '@/storage/profile';
import { colors, radius, spacing } from '@/theme';
import type { UserProfile } from '@/types/game';

const logo = require('../assets/logo.png');

export default function HomeScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadProfile().then((value) => {
        if (active) {
          setProfile(value);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const unlockedCount = profile?.unlockedAchievements.length ?? 0;
  const progress = profile ? progressToNextLevel(profile.xp) : 0;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <View style={styles.identityText}>
            <TelText variant="caption" color="muted">Hola,</TelText>
            <TelText variant="subtitle" color="primary">{profile?.alias ?? 'Explorador TEL'}</TelText>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Abrir perfil"
          accessibilityRole="button"
          onPress={() => router.push('/profile')}
          style={styles.profileButton}
        >
          <Ionicons color={colors.primary} name="person-circle" size={34} />
        </Pressable>
      </View>

      <TelCard tone="dark">
        <TelText variant="overline" color="accentSoft">Nivel {profile?.level ?? 1}</TelText>
        <TelText variant="title" color="white">Restaura la red del campus</TelText>
        <View accessibilityLabel={`Progreso de experiencia ${Math.round(progress * 100)} por ciento`} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(6, progress * 100)}%` }]} />
        </View>
        <TelText variant="caption" color="accentSoft">
          {profile?.xp ?? 0} XP · Racha de {profile?.streakDays ?? 0} días · {unlockedCount}/{achievements.length} logros
        </TelText>
      </TelCard>

      <View style={styles.quickGrid}>
        <QuickAction
          icon="flash"
          label="Ráfaga TEL"
          description="6 microretos"
          onPress={() => router.push('/burst')}
        />
        <QuickAction
          icon="help-circle"
          label="Telemático"
          description="10 preguntas"
          onPress={() => router.push('/millionaire')}
        />
        <QuickAction
          icon="map"
          label="Recorrido"
          description="Juega con ID"
          onPress={() => router.push('/journey')}
        />
        <QuickAction
          icon="book"
          label="Historia"
          description="La señal perdida"
          onPress={() => router.push('/story')}
        />
        <QuickAction
          icon="medal"
          label="Logros"
          description="Medallas"
          onPress={() => router.push('/achievements')}
        />
        <QuickAction
          icon="planet"
          label="Telix"
          description="Mascota"
          onPress={() => router.push('/mascot')}
        />
      </View>

      <TelCard tone="cream">
        <TelText variant="overline" color="secondary">Misión diaria</TelText>
        <TelText variant="subtitle" color="primary">Completa una ráfaga y una prenda de conocimiento</TelText>
        <TelText color="primarySoft">
          Las sesiones cortas mantienen la racha y mejoran el ánimo de Telix.
        </TelText>
        <TelButton label="Jugar ahora" variant="primary" onPress={() => router.push('/burst')} />
      </TelCard>
    </Screen>
  );
}

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
}

function QuickAction({ icon, label, description, onPress }: QuickActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
    >
      <Ionicons color={colors.accent} name={icon} size={28} />
      <TelText variant="bodyStrong" color="primary">{label}</TelText>
      <TelText variant="caption" color="muted">{description}</TelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityText: {
    gap: 2,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
  },
  profileButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAction: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 132,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  quickActionPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.accentSoft,
  },
});
