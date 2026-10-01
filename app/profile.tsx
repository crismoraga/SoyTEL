import { useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ListRow, SectionHeader, StatTile } from '@/components/Blocks';
import { ChipGroup } from '@/components/Chips';
import { ProgressRing } from '@/components/feedback/Progress';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { UserAvatar } from '@/components/UserAvatar';
import { ApiError } from '@/account/api';
import { aliasProblem, ALIAS_MAX } from '@/account/rules';
import { setIdentity, syncNow, useAccount } from '@/account/store';
import { achievements } from '@/data/achievements';
import { areaLabels } from '@/data/questions';
import { AvatarPicker } from '@/features/account/AvatarPicker';
import { getStationGame } from '@/features/stations/registry';
import { formatNumber, relativeTime } from '@/lib/format';
import { LINKS, openLink } from '@/lib/links';
import { suggestedMotionLevel, useEntering, useMotionLevel, type MotionLevel } from '@/lib/motion';
import { levelTitle, progressToNextLevel, xpToNextLevel } from '@/lib/progression';
import { useFocusData } from '@/lib/useFocusData';
import { loadProfile, loadResults } from '@/storage/profile';
import { resetAllData } from '@/storage/reset';
import { updateSettings, useSettings, type MotionPreference } from '@/storage/settings';
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
      return {
        title: result.metadata?.completed === false ? 'Ruta Telemática · cerrada antes del final' : `Ruta Telemática · ${String(result.metadata?.rank ?? '?')}º lugar`,
        icon: 'route',
      };
    case 'station':
      return { title: getStationGame(String(result.metadata?.game ?? ''))?.title ?? 'Juego de la ruta', icon: getStationGame(String(result.metadata?.game ?? ''))?.icon ?? 'gamepad' };
    case 'story':
      return { title: `Historia · capítulo ${String(result.metadata?.chapter ?? '')}`, icon: 'book' };
    default:
      return { title: 'Actividad', icon: 'sparkle' };
  }
}

const MOTION_OPTIONS: { id: MotionPreference; label: string }[] = [
  { id: 'auto', label: 'Automático' },
  { id: 'full', label: 'Completas' },
  { id: 'balanced', label: 'Equilibradas' },
  { id: 'minimal', label: 'Mínimas' },
];

const motionCopy: Record<MotionLevel, string> = {
  full: 'Todo en movimiento: estrellas que titilan, Rutix con ondas y confeti completo.',
  balanced: 'Transiciones breves y Rutix flotando; sin adornos en bucle. Ideal para la mayoría de los teléfonos.',
  minimal: 'Casi sin movimiento: lo más liviano para teléfonos de gama baja o si prefieres menos estímulos.',
};

function confirmAction(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function ProfileScreen() {
  const entering = useEntering();
  const settings = useSettings();
  const motionLevel = useMotionLevel();
  const account = useAccount();
  const [aliasDraft, setAliasDraft] = useState<string | null>(null);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const { data, reload } = useFocusData(async () => {
    const [profile, results] = await Promise.all([loadProfile(), loadResults()]);
    return { profile, results };
  });
  const profile = data?.profile;
  const alias = aliasDraft ?? profile?.alias ?? '';
  const version = Constants.expoConfig?.version ?? '';

  async function saveAlias() {
    const problem = aliasProblem(alias);
    if (problem) {
      setAliasError(problem);
      return;
    }
    setAliasError(null);
    try {
      await setIdentity({ alias });
      setAliasDraft(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      reload();
    } catch (caught) {
      setAliasError(caught instanceof ApiError ? caught.message : 'No se pudo guardar el alias.');
    }
  }

  async function chooseAvatar(avatar: number) {
    setAvatarOpen(false);
    try {
      await setIdentity({ avatar });
    } finally {
      reload();
    }
  }

  function confirmReset() {
    confirmAction(
      'Borrar datos de este teléfono',
      'Se reinician tu XP, logros, historial, avisos y ajustes en este teléfono, y se cierra tu cuenta aquí (sigue existiendo en el servidor y la recuperas con tu código). No se puede deshacer.',
      'Borrar todo',
      () => void resetAllData().then(() => router.replace('/home')),
    );
  }

  return (
    <Screen
      keyboard
      header={
        <AppHeader onBack={() => router.back()} kicker={account.status === 'registered' ? 'Cuenta SoyTEL' : 'Perfil local'} title={profile?.alias ?? ' '}>
          <View style={styles.hero}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Cambiar avatar" haptic onPress={() => setAvatarOpen(true)}>
              <ProgressRing progress={profile ? progressToNextLevel(profile.xp) : 0} size={96} strokeWidth={7} accessibilityLabel="Progreso al siguiente nivel">
                <UserAvatar avatar={profile?.avatar ?? 0} size={74} />
              </ProgressRing>
              <View style={styles.editBadge}>
                <TelIcon name="edit" size={14} color={colors.primary} />
              </View>
            </PressableScale>
            {profile ? (
              <View style={styles.flex}>
                <TelText variant="subtitle" color="cream">
                  Nivel {profile.level} · {levelTitle(profile.level)}
                </TelText>
                <TelText variant="caption" color="accentSoft" tabular>
                  {formatNumber(profile.xp)} XP · faltan {formatNumber(xpToNextLevel(profile.xp))} para el nivel {profile.level + 1}
                </TelText>
                {account.status === 'registered' && account.rank && (
                  <TelText variant="caption" color="cream" tabular>
                    Ranking global: #{formatNumber(account.rank.rank)} de {formatNumber(account.rank.total)}
                  </TelText>
                )}
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
        <StatTile icon="gamepad" value={profile ? Math.max(profile.gamesPlayed, data?.results.length ?? 0) : '—'} label="Partidas" />
        <StatTile icon="trophy" value={profile ? `${profile.unlockedAchievements.length}/${achievements.length}` : '—'} label="Logros" />
      </Animated.View>

      {account.status === 'registered' ? (
        <TelCard style={styles.gap}>
          <View style={styles.rowCenter}>
            <TelIcon name="checkCircle" size={22} color={colors.success} />
            <TelText variant="heading" color="primary" style={styles.flex}>
              Cuenta conectada
            </TelText>
            <TelButton label={account.syncing ? 'Sincronizando' : 'Sincronizar'} variant="subtle" size="sm" icon="refresh" fullWidth={false} loading={account.syncing} onPress={() => void syncNow()} />
          </View>
          <TelText variant="caption" color={account.syncError ? 'danger' : 'muted'}>
            {account.syncError ?? (account.lastSyncAt ? `Puntaje registrado ${relativeTime(account.lastSyncAt)}.` : 'Tu puntaje se registra cada vez que juegas.')}
          </TelText>
          <View style={styles.buttonRow}>
            <TelButton label="Ranking" icon="trophy" size="sm" style={styles.flex} onPress={() => router.push('/ranking')} />
            <TelButton label="Datos de la cuenta" variant="outline" icon="user" size="sm" style={styles.flex} onPress={() => router.push('/cuenta')} />
          </View>
        </TelCard>
      ) : account.status === 'expired' ? (
        <TelCard tone="danger" style={styles.gap}>
          <TelText variant="subtitle" color="dangerInk">
            Tu cuenta se abrió en otro teléfono
          </TelText>
          <TelText variant="caption" color="dangerInk">
            Entra de nuevo con tu código de recuperación para seguir sumando al ranking.
          </TelText>
          <TelButton label="Entrar con mi código" variant="danger" icon="key" onPress={() => router.push('/cuenta/recuperar')} />
        </TelCard>
      ) : (
        <TelCard tone="navy" style={styles.gap}>
          <TelText variant="heading" color="cream">
            Crea tu cuenta
          </TelText>
          <TelText variant="caption" color="accentSoft">
            Registra tus puntajes, aparece en el ranking global y recupera tu progreso en otro teléfono. Solo necesitas un alias.
          </TelText>
          <TelButton label="Crear mi cuenta" variant="cream" icon="user" onPress={() => router.push('/cuenta')} />
          <TelButton label="Ya tengo cuenta" variant="outlineLight" icon="key" onPress={() => router.push('/cuenta/recuperar')} />
        </TelCard>
      )}

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
        <TelText variant="label" color="primary" nativeID="alias-edit">
          Alias
        </TelText>
        <View style={styles.aliasRow}>
          <TextInput
            accessibilityLabel="Editar alias"
            accessibilityLabelledBy="alias-edit"
            value={alias}
            onChangeText={(value) => setAliasDraft(value.slice(0, ALIAS_MAX))}
            maxLength={ALIAS_MAX}
            placeholder="Tu alias"
            placeholderTextColor={colors.slate}
            returnKeyType="done"
            onSubmitEditing={() => void saveAlias()}
            style={[styles.aliasInput, font('bodySemi'), aliasError && styles.inputError]}
          />
          <TelButton label={saved ? 'Guardado' : 'Guardar'} icon={saved ? 'check' : undefined} variant="secondary" size="sm" fullWidth={false} onPress={() => void saveAlias()} />
        </View>
        {aliasError && (
          <TelText variant="small" color="danger">
            {aliasError}
          </TelText>
        )}
        <SettingSwitch
          label="Vibración y hápticos"
          description="Pequeñas vibraciones al acertar, fallar o tocar botones."
          value={settings.haptics}
          onChange={(value) => void updateSettings({ haptics: value })}
        />
        <View style={styles.settingBlock}>
          <TelText variant="label" color="primary">
            Animaciones
          </TelText>
          <View style={styles.chips}>
            <ChipGroup accessibilityLabel="Nivel de animaciones" options={MOTION_OPTIONS} value={settings.motion} onChange={(motion) => void updateSettings({ motion })} />
          </View>
          <TelText variant="caption" color="muted">
            {settings.motion === 'auto' ? `Para este teléfono: ${MOTION_OPTIONS.find((option) => option.id === suggestedMotionLevel())?.label.toLowerCase()}. ` : ''}
            {motionCopy[motionLevel]}
          </TelText>
        </View>
        <ListRow icon="shieldLock" title="Privacidad" body="Qué datos guardamos y cómo los cuidamos." trailing={<TelIcon name="chevronRight" size={18} color={colors.primary} />} onPress={() => router.push('/privacidad')} />
        <TelButton label="Borrar datos de este teléfono" variant="dangerOutline" icon="trash" onPress={confirmReset} style={styles.danger} />
      </TelCard>

      <View style={styles.about}>
        <TelText variant="caption" color="muted" align="center">
          SoyTEL {version} · Ingeniería Civil Telemática USM
        </TelText>
        <TelButton label="La carrera en usm.cl" variant="ghost" size="sm" icon="external" fullWidth={false} onPress={() => void openLink(LINKS.career)} />
      </View>

      <Sheet visible={avatarOpen} onClose={() => setAvatarOpen(false)} accessibilityLabel="Elige tu avatar" scroll>
        <TelText variant="title" color="primary">
          Elige tu avatar
        </TelText>
        <TelText variant="caption" color="muted">
          Los avatares con candado se desbloquean jugando.
        </TelText>
        {profile && (
          <AvatarPicker
            value={profile.avatar}
            onChange={(avatar) => void chooseAvatar(avatar)}
            level={profile.level}
            achievements={profile.unlockedAchievements}
          />
        )}
        <TelButton label="Listo" variant="outline" onPress={() => setAvatarOpen(false)} />
      </Sheet>
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
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  flex: {
    flex: 1,
    gap: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  gap: {
    gap: spacing.sm,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  buttonRow: {
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
  inputError: {
    borderColor: colors.danger,
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
  settingBlock: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  chips: {
    marginHorizontal: -spacing.xs,
  },
  danger: {
    marginTop: spacing.xs,
  },
  about: {
    alignItems: 'center',
    gap: 4,
  },
});
