import { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ListRow, SectionHeader, StatTile } from '@/components/Blocks';
import { ProgressRing } from '@/components/feedback/Progress';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import type { IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { achievements } from '@/data/achievements';
import { USM_URL } from '@/data/career';
import { areaLabels } from '@/data/questions';
import { getStationGame } from '@/features/stations/registry';
import { formatNumber, relativeTime } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { levelTitle, progressToNextLevel, xpToNextLevel } from '@/lib/progression';
import { useFocusData } from '@/lib/useFocusData';
import { loadProfile, loadResults, updateAlias } from '@/storage/profile';
import { resetAllData } from '@/storage/reset';
import { updateSettings, useSettings } from '@/storage/settings';
import { colors, font, radius, spacing } from '@/theme';
import type { GameResult, KnowledgeArea } from '@/types/game';

function describeResult(result: GameResult): { title: string; icon: IconName } {
  switch (result.gameId) {
    case 'burst':
      return { title: 'Ráfaga TEL', icon: 'bolt' };
    case 'millionaire':
      return { title: 'Quién quiere ser Telemático', icon: 'help' };
    case 'practice': {
      const area = String(result.metadata?.area ?? '') as KnowledgeArea;
      return { title: `Práctica: ${areaLabels[area] ?? 'área'}`, icon: 'target' };
    }
    case 'journey':
      return { title: `Recorrido ${String(result.metadata?.code ?? '')}`.trim(), icon: 'route' };
    case 'route':
      return { title: `Ruta Telemática · ${String(result.metadata?.rank ?? '?')}º lugar`, icon: 'route' };
    case 'station':
      return { title: getStationGame(String(result.metadata?.game ?? ''))?.title ?? 'Juego de la ruta', icon: getStationGame(String(result.metadata?.game ?? ''))?.icon ?? 'gamepad' };
    case 'story':
      return { title: `Historia · capítulo ${String(result.metadata?.chapter ?? '')}`, icon: 'book' };
    default:
      return { title: 'Actividad', icon: 'sparkle' };
  }
}

export default function ProfileScreen() {
  const entering = useEntering();
  const settings = useSettings();
  const [aliasDraft, setAliasDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { data, setData } = useFocusData(async () => {
    const [profile, results] = await Promise.all([loadProfile(), loadResults()]);
    return { profile, results };
  });
  const profile = data?.profile;
  const alias = aliasDraft ?? profile?.alias ?? '';

  async function saveAlias() {
    const updated = await updateAlias(alias);
    setData((current) => (current ? { ...current, profile: updated } : current));
    setAliasDraft(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function confirmReset() {
    Alert.alert(
      'Borrar datos locales',
      'Se reiniciarán tu XP, logros, historial, avisos y ajustes de este dispositivo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: () => {
            void resetAllData().then(() => router.replace('/home'));
          },
        },
      ],
    );
  }

  const initials = (profile?.alias ?? 'TEL')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Screen
      keyboard
      header={
        <AppHeader onBack={() => router.back()} kicker="Perfil local" title={profile?.alias ?? ' '}>
          <View style={styles.hero}>
            <ProgressRing progress={profile ? progressToNextLevel(profile.xp) : 0} size={92} strokeWidth={7} accessibilityLabel="Progreso al siguiente nivel">
              <View style={styles.avatar}>
                <TelText variant="heading" color="primary">
                  {initials}
                </TelText>
              </View>
            </ProgressRing>
            {profile ? (
              <View style={styles.flex}>
                <TelText variant="subtitle" color="cream">
                  Nivel {profile.level} · {levelTitle(profile.level)}
                </TelText>
                <TelText variant="caption" color="accentSoft" tabular>
                  {formatNumber(profile.xp)} XP · faltan {formatNumber(xpToNextLevel(profile.xp))} para el nivel {profile.level + 1}
                </TelText>
              </View>
            ) : (
              <View style={styles.flex}>
                <Skeleton tone="dark" height={18} width="70%" />
                <Skeleton tone="dark" height={14} width="90%" />
              </View>
            )}
          </View>
        </AppHeader>
      }
    >
      <Animated.View entering={entering.fadeUp()} style={styles.stats}>
        <StatTile icon="sparkle" value={profile ? formatNumber(profile.xp) : '—'} label="XP total" />
        <StatTile icon="flame" value={profile?.streakDays ?? '—'} label="Racha" />
        <StatTile icon="gamepad" value={data?.results.length ?? '—'} label="Partidas" />
        <StatTile icon="trophy" value={profile ? `${profile.unlockedAchievements.length}/${achievements.length}` : '—'} label="Logros" />
      </Animated.View>

      <View style={styles.section}>
        <SectionHeader title="Historial reciente" actionLabel="Ver logros" onAction={() => router.navigate('/achievements')} />
        {data && data.results.length === 0 && (
          <EmptyState illustration="trophy" title="Aún no juegas" body="Tu historial aparecerá aquí después de tu primera partida." actionLabel="Jugar una ráfaga" onAction={() => router.push('/burst')} />
        )}
        {data?.results.slice(0, 6).map((result) => {
          const info = describeResult(result);
          return (
            <ListRow
              key={`${result.gameId}-${result.completedAt}`}
              icon={info.icon}
              meta={relativeTime(result.completedAt).toUpperCase()}
              title={info.title}
              body={`${formatNumber(result.score)} pts · ${Math.round(result.accuracy * 100)}% de precisión`}
            />
          );
        })}
      </View>

      <TelCard style={styles.settings}>
        <TelText variant="heading" color="primary">
          Ajustes
        </TelText>
        <TelText variant="caption" color="muted">
          Tu progreso vive en este dispositivo, sin cuentas ni correos.
        </TelText>
        <TelText variant="label" color="primary" nativeID="alias-edit">
          Alias
        </TelText>
        <View style={styles.aliasRow}>
          <TextInput
            accessibilityLabel="Editar alias"
            accessibilityLabelledBy="alias-edit"
            value={alias}
            onChangeText={(value) => setAliasDraft(value.slice(0, 24))}
            maxLength={24}
            placeholder="Tu alias"
            placeholderTextColor={colors.slate}
            returnKeyType="done"
            onSubmitEditing={() => void saveAlias()}
            style={[styles.aliasInput, font('bodySemi')]}
          />
          <TelButton label={saved ? 'Guardado' : 'Guardar'} icon={saved ? 'check' : undefined} variant="secondary" size="sm" fullWidth={false} onPress={() => void saveAlias()} />
        </View>
        <SettingSwitch
          label="Vibración y hápticos"
          description="Pequeñas vibraciones al acertar, fallar o tocar botones."
          value={settings.haptics}
          onChange={(value) => void updateSettings({ haptics: value })}
        />
        <SettingSwitch
          label="Reducir animaciones"
          description="Desactiva el movimiento decorativo (Telix, estrellas, confeti)."
          value={settings.reducedMotion}
          onChange={(value) => void updateSettings({ reducedMotion: value })}
        />
        <TelButton label="Borrar datos locales" variant="dangerOutline" icon="trash" onPress={confirmReset} style={styles.danger} />
      </TelCard>

      <View style={styles.about}>
        <TelText variant="caption" color="muted" align="center">
          SoyTEL 1.0 · Ingeniería Civil Telemática USM
        </TelText>
        <TelButton label="Visitar usm.cl" variant="ghost" size="sm" icon="external" fullWidth={false} onPress={() => void Linking.openURL(USM_URL)} />
      </View>
    </Screen>
  );
}

function SettingSwitch({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.flex}>
        <TelText variant="label" color="primary">
          {label}
        </TelText>
        <TelText variant="caption" color="muted">
          {description}
        </TelText>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.secondary }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  settings: {
    gap: spacing.sm,
  },
  aliasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aliasInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    color: colors.primary,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  settingRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  danger: {
    marginTop: spacing.xs,
  },
  about: {
    alignItems: 'center',
    gap: 4,
  },
});
