import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { achievements } from '@/data/achievements';
import { progressToNextLevel } from '@/lib/progression';
import { defaultProfile, loadProfile, loadResults, saveProfile, updateAlias } from '@/storage/profile';
import { getSettings, initSettings, updateSettings, type AppSettings } from '@/storage/settings';
import { colors, radius, spacing } from '@/theme';
import type { GameResult, UserProfile } from '@/types/game';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<GameResult[]>([]);
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [aliasDraft, setAliasDraft] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([loadProfile(), loadResults(), initSettings()]).then(([profileValue, resultValues, settingsValue]) => {
        if (active) {
          setProfile(profileValue);
          setResults(resultValues);
          setSettings(settingsValue);
          setAliasDraft(profileValue.alias);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  async function saveAlias() {
    setProfile(await updateAlias(aliasDraft));
  }

  async function toggleHaptics(value: boolean) {
    setSettings(await updateSettings({ haptics: value }));
  }

  async function resetLocalData() {
    Alert.alert(
      'Borrar datos locales',
      'Se reiniciarán XP, logros, resultados y configuración de este dispositivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => {
            void AsyncStorage.multiRemove([
              '@soytel/profile',
              '@soytel/results',
              '@soytel/story',
              '@soytel/mascot-days',
              '@soytel/mascot-log',
              '@soytel/settings',
            ]).then(async () => {
              setProfile(defaultProfile);
              setResults([]);
              await saveProfile(defaultProfile);
            });
          },
        },
      ],
    );
  }

  const progress = profile ? progressToNextLevel(profile.xp) : 0;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons color={colors.white} name="person" size={42} />
        </View>
        <View style={styles.headerText}>
          <TelText variant="caption" color="muted">Perfil local</TelText>
          <TelText variant="title" color="primary">{profile?.alias ?? 'Explorador TEL'}</TelText>
        </View>
      </View>

      <TelCard tone="dark">
        <TelText variant="overline" color="accentSoft">Nivel {profile?.level ?? 1}</TelText>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(6, progress * 100)}%` }]} />
        </View>
        <TelText color="white">{profile?.xp ?? 0} XP acumulados</TelText>
        <TelText variant="caption" color="accentSoft">
          {results.length} sesiones registradas · Racha de {profile?.streakDays ?? 0} días
        </TelText>
      </TelCard>

      <TelCard>
        <View style={styles.cardHeader}>
          <TelText variant="subtitle" color="primary">Logros</TelText>
          <TelButton label="Ver todos" variant="ghost" fullWidth={false} onPress={() => router.push('/achievements')} />
        </View>
        {achievements.slice(0, 4).map((achievement) => {
          const unlocked = profile?.unlockedAchievements.includes(achievement.id) ?? false;
          return (
            <View key={achievement.id} style={styles.achievementRow}>
              <Ionicons
                color={unlocked ? colors.warning : colors.muted}
                name={unlocked ? 'medal' : 'medal-outline'}
                size={26}
              />
              <View style={styles.achievementText}>
                <TelText variant="bodyStrong" color={unlocked ? 'primary' : 'muted'}>
                  {achievement.title}
                </TelText>
                <TelText variant="caption" color="muted">{achievement.description}</TelText>
              </View>
            </View>
          );
        })}
      </TelCard>

      <TelCard tone="cream">
        <TelText variant="subtitle" color="primary">Ajustes</TelText>
        <TelText color="primarySoft">
          Tu progreso vive en este dispositivo, sin cuentas ni correos.
        </TelText>
        <View style={styles.aliasRow}>
          <TextInput
            accessibilityLabel="Editar alias"
            value={aliasDraft}
            onChangeText={(value) => setAliasDraft(value.slice(0, 24))}
            maxLength={24}
            placeholder="Tu alias"
            placeholderTextColor={colors.muted}
            style={styles.aliasInput}
            returnKeyType="done"
            onSubmitEditing={() => void saveAlias()}
          />
          <TelButton label="Guardar" variant="secondary" fullWidth={false} onPress={() => void saveAlias()} />
        </View>
        <View style={styles.settingRow}>
          <TelText color="primary">Vibración y hápticos</TelText>
          <Switch
            accessibilityLabel="Activar o desactivar hápticos"
            value={settings.haptics}
            onValueChange={(value) => void toggleHaptics(value)}
            trackColor={{ false: colors.muted, true: colors.secondary }}
            thumbColor={colors.white}
          />
        </View>
        <TelButton label="Borrar datos locales" variant="danger" onPress={() => void resetLocalData()} />
      </TelCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
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
  achievementRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  achievementText: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aliasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aliasInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    color: colors.primary,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontWeight: '600',
  },
  settingRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
