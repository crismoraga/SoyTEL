import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
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
import { defaultSettings, getSettings, initSettings, updateSettings, type AppSettings } from '@/storage/settings';
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

  async function clearLocalData() {
    await AsyncStorage.multiRemove([
      '@soytel/profile',
      '@soytel/results',
      '@soytel/story',
      '@soytel/mascot-days',
      '@soytel/mascot-log',
      '@soytel/settings',
    ]);
    setProfile(defaultProfile);
    setResults([]);
    setAliasDraft(defaultProfile.alias);
    await saveProfile(defaultProfile);
    setSettings(await updateSettings(defaultSettings));
  }

  function resetLocalData() {
    const title = 'Borrar datos locales';
    const detail = 'Se reiniciarán XP, logros, resultados y configuración de este dispositivo.';

    // Alert.alert con botones no hace nada en react-native-web.
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}

${detail}`)) {
        void clearLocalData();
      }
      return;
    }

    Alert.alert(title, detail, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void clearLocalData() },
    ]);
  }

  const progress = profile ? progressToNextLevel(profile.xp) : 0;

  return (
    <Screen contentStyle={styles.content} onBack={() => router.back()}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons color={colors.white} name="person" size={30} />
        </View>
        <View style={styles.headerText}>
          <TelText variant="caption" color="muted">Perfil local</TelText>
          <TelText variant="title" color="primary" numberOfLines={2}>{profile?.alias ?? 'Explorador TEL'}</TelText>
        </View>
      </View>

      <TelCard tone="dark" style={styles.card}>
        <TelText variant="overline" color="accentSoft">Nivel {profile?.level ?? 1}</TelText>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(6, progress * 100)}%` }]} />
        </View>
        <TelText color="white">{profile?.xp ?? 0} XP acumulados</TelText>
        <TelText variant="caption" color="accentSoft">
          {results.length} sesiones registradas · Racha de {profile?.streakDays ?? 0} días
        </TelText>
      </TelCard>

      <TelCard style={styles.card}>
        <View style={styles.cardHeader}>
          <TelText variant="subtitle" color="primary">Logros</TelText>
          <TelButton label="Ver todos" variant="ghost" fullWidth={false} style={styles.seeAll} onPress={() => router.push('/achievements')} />
        </View>
        {achievements.slice(0, 3).map((achievement) => {
          const unlocked = profile?.unlockedAchievements.includes(achievement.id) ?? false;
          return (
            <View key={achievement.id} style={styles.achievementRow}>
              <Ionicons
                color={unlocked ? colors.warning : colors.muted}
                name={unlocked ? 'medal' : 'medal-outline'}
                size={22}
              />
              <View style={styles.achievementText}>
                <TelText variant="bodyStrong" color={unlocked ? 'primary' : 'muted'}>
                  {achievement.title}
                </TelText>
                <TelText variant="caption" color="muted" numberOfLines={1}>{achievement.description}</TelText>
              </View>
            </View>
          );
        })}
      </TelCard>

      <TelCard tone="cream" style={styles.card}>
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
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Activar o desactivar hápticos"
          aria-checked={settings.haptics}
          onPress={() => void toggleHaptics(!settings.haptics)}
          style={styles.settingRow}
        >
          <TelText color="primary">Vibración y hápticos</TelText>
          {/* Toda la fila es el control: el interruptor solo muestra el estado. */}
          <View
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Switch
              value={settings.haptics}
              trackColor={{ false: colors.muted, true: colors.secondary }}
              thumbColor={colors.white}
            />
          </View>
        </Pressable>
        <TelButton label="Borrar datos locales" variant="danger" onPress={resetLocalData} />
      </TelCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
  },
  card: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  seeAll: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 56,
    height: 56,
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
    // En web el input conserva su ancho intrínseco y empuja «Guardar» fuera de la tarjeta.
    minWidth: 0,
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
