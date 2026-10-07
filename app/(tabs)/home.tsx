import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { ListRow, SectionHeader } from '@/components/Blocks';
import { AppLogo, Wordmark } from '@/components/Brand';
import { Tag } from '@/components/Chips';
import { ProgressBar } from '@/components/feedback/Progress';
import { Skeleton, SkeletonText } from '@/components/feedback/Skeleton';
import { Medallion, type MedallionGlyph } from '@/components/graphics/Medallion';
import { Rutix } from '@/components/graphics/Rutix';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { UserAvatar } from '@/components/UserAvatar';
import { useAccount } from '@/account/store';
import { tipForDate } from '@/data/tips';
import { DAILY_BONUS, dailyKey, isDailyDone } from '@/features/burst/daily';
import { TelematicaSheet } from '@/features/brand/TelematicaSheet';
import { RouteProgress } from '@/features/route/parts';
import { TipSheet } from '@/features/tips/TipSheet';
import { useMemberView } from '@/route/hooks';
import { expressionForMood, signalForMood } from '@/graphics/rutix';
import { formatNumber, greeting } from '@/lib/format';
import { missionStates } from '@/lib/dailyMissions';
import { guideProgress, starterGuide } from '@/lib/guide';
import { nextMission } from '@/lib/missions';
import { useEntering } from '@/lib/motion';
import { levelTitle, progressToNextLevel, xpToNextLevel } from '@/lib/progression';
import { useFocusData } from '@/lib/useFocusData';
import { ensureDailyInbox } from '@/storage/inbox';
import { loadProfile, loadResults, progressStatsOf } from '@/storage/profile';
import { loadCareerProgress } from '@/storage/career';
import { loadMascotDays, loadStoryProgress } from '@/storage/story';
import { colors, radius, spacing } from '@/theme';

function moodLabel(value: number): string {
  if (value >= 85) return 'radiante';
  if (value >= 60) return 'motivado';
  if (value >= 35) return 'con sueño';
  return 'con poca señal';
}

// El único paso que Inicio propone a la vez: volver a la ruta, seguir la guía o la próxima misión.
interface NextStep {
  kicker: string;
  title: string;
  text: string;
  cta: string;
  route: Href;
  glyph?: MedallionGlyph;
  icon?: IconName;
}

// Inicio responde una sola pregunta: "¿qué hago ahora?". Un paso principal, lo de hoy y dos accesos.
// Todo el catálogo de juegos vive en la pestaña Jugar.
export default function HomeScreen() {
  const entering = useEntering();
  const account = useAccount();
  const [tipOpen, setTipOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const { data, error, reload } = useFocusData(async () => {
    const [profile, results, story, mascotDays, career] = await Promise.all([loadProfile(), loadResults(), loadStoryProgress(), loadMascotDays(), loadCareerProgress()]);
    return { profile, results, story, mascotDays: mascotDays.length, careerAreas: Object.values(career).filter(Boolean).length };
  });
  const profile = data?.profile;

  useEffect(() => {
    if (profile) void ensureDailyInbox(profile.mascotMood).catch(() => undefined);
  }, [profile]);

  const route = useMemberView();
  const routeActive = route.status !== 'idle' && Boolean(route.code);
  const tip = tipForDate(new Date());
  const dailyDone = data ? isDailyDone(data.results, dailyKey(new Date())) : false;
  const guideSteps = data ? starterGuide({ ...data, stats: progressStatsOf(data.profile, data.results) }) : [];
  const guide = guideProgress(guideSteps);
  const missions = data ? missionStates(data.results) : [];
  const missionsDone = missions.filter((state) => state.done).length;

  let step: NextStep | null = null;
  if (data) {
    if (guide.next) {
      step = { kicker: `Guía de inicio · ${guide.done} de ${guide.total}`, title: guide.next.title, text: guide.next.text, cta: 'Vamos', route: guide.next.route, icon: guide.next.icon };
    } else {
      const mission = nextMission(data.results, data.story.completedChapters);
      step = { kicker: mission.kicker, title: mission.title, text: mission.subtitle, cta: mission.cta, route: mission.route, glyph: mission.glyph };
    }
  }

  return (
    <Screen
      inTabs
      header={
        <AppHeader rounded overlap={56}>
          <View style={styles.brandRow}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Telemática USM: conoce la carrera"
              accessibilityHint="Abre la información de Ingeniería Civil Telemática"
              haptic
              onPress={() => setBrandOpen(true)}
              style={styles.brandButton}
            >
              <AppLogo size={38} />
              <Wordmark size={22} />
            </PressableScale>
            {/* Los avisos tienen su pestaña (con su punto de pendientes): aquí solo va el perfil. */}
            <PressableScale accessibilityRole="button" accessibilityLabel="Tu perfil" haptic onPress={() => router.push('/profile')} style={styles.avatarButton}>
              <UserAvatar avatar={profile?.avatar ?? 0} size={40} />
            </PressableScale>
          </View>
          {profile ? (
            <Animated.View entering={entering.fade()} style={styles.greeting}>
              <TelText variant="title" color="cream" numberOfLines={2}>
                {greeting()}, {profile.alias}
              </TelText>
              {/* Nivel, avance y racha en una sola línea: antes ocupaban dos etiquetas y media tarjeta. */}
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Nivel ${profile.level}, ${levelTitle(profile.level)}. Faltan ${formatNumber(xpToNextLevel(profile.xp))} XP para el siguiente. Racha de ${profile.streakDays} días. Ver tu perfil`}
                onPress={() => router.push('/profile')}
                style={styles.level}
              >
                <View style={styles.levelRow}>
                  <TelText variant="label" color="cream" numberOfLines={1} style={styles.flexText}>
                    Nivel {profile.level} · {levelTitle(profile.level)}
                  </TelText>
                  <View style={styles.streak}>
                    <TelIcon name="flame" size={14} color={colors.accent} />
                    <TelText variant="small" color="accentSoft" tabular>
                      {profile.streakDays > 0 ? `${profile.streakDays} ${profile.streakDays === 1 ? 'día' : 'días'}` : 'Sin racha'}
                    </TelText>
                  </View>
                </View>
                <ProgressBar progress={progressToNextLevel(profile.xp)} color={colors.accent} trackColor={colors.secondary} height={6} accessibilityLabel="Progreso al siguiente nivel" />
                <TelText variant="small" color="accentSoft" tabular>
                  {formatNumber(profile.xp)} XP · faltan {formatNumber(xpToNextLevel(profile.xp))} para el nivel {profile.level + 1}
                </TelText>
              </PressableScale>
            </Animated.View>
          ) : (
            <View style={styles.greeting}>
              <Skeleton tone="dark" height={26} width="70%" />
              <Skeleton tone="dark" height={44} />
            </View>
          )}
        </AppHeader>
      }
    >
      <View style={styles.floating}>
        {routeActive ? (
          <TelCard tone="navy" elevated style={styles.hero}>
            <Tag tone="glass" live label={route.solo ? 'RUTA INDIVIDUAL' : `RUTA ${route.code}`} style={styles.heroTag} />
            <TelText variant="heading" color="cream">
              Tienes una ruta en curso
            </TelText>
            <RouteProgress stop={route.snapshot?.stop ?? 'stand'} finished={route.snapshot?.phase === 'podium'} />
            <TelButton label="Volver a la ruta" variant="cream" icon="route" onPress={() => router.push('/ruta/juego')} />
          </TelCard>
        ) : step ? (
          <TelCard elevated style={styles.hero}>
            <Animated.View entering={entering.fadeUp()} style={styles.heroInner}>
              <View style={styles.heroRow}>
                {step.glyph ? (
                  <Medallion glyph={step.glyph} size={56} />
                ) : (
                  <View style={styles.heroIcon}>
                    <TelIcon name={step.icon ?? 'bolt'} size={26} color={colors.cream} />
                  </View>
                )}
                <View style={styles.flex}>
                  <TelText variant="small" color="inkAccent" style={styles.kicker}>
                    {step.kicker.toUpperCase()}
                  </TelText>
                  <TelText variant="subtitle" color="ink">
                    {step.title}
                  </TelText>
                  <TelText variant="caption" color="inkSoft">
                    {step.text}
                  </TelText>
                </View>
              </View>
              {guide.next && (
                <ProgressBar progress={guide.total ? guide.done / guide.total : 0} height={6} accessibilityLabel={`Guía de inicio: ${guide.done} de ${guide.total} pasos listos`} />
              )}
              <TelButton label={step.cta} iconRight="arrowRight" onPress={() => router.push((step as NextStep).route)} />
            </Animated.View>
          </TelCard>
        ) : error ? (
          <TelCard elevated style={styles.hero}>
            <TelText variant="subtitle" color="ink">
              No pudimos leer tu progreso
            </TelText>
            <TelText variant="caption" color="inkSoft">
              Tus datos siguen en el teléfono. Inténtalo otra vez.
            </TelText>
            <TelButton label="Reintentar" icon="refresh" onPress={reload} />
          </TelCard>
        ) : (
          <TelCard elevated style={styles.hero}>
            <View style={styles.heroRow}>
              <Skeleton width={56} height={56} rounded={28} />
              <View style={styles.flex}>
                <SkeletonText lines={3} />
              </View>
            </View>
            <Skeleton height={52} rounded={radius.md} />
          </TelCard>
        )}
      </View>

      {!routeActive && (
        <Animated.View entering={entering.fadeUp(1)}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Ruta Telemática en vivo. Ingresa el código del stand"
            haptic
            onPress={() => router.push('/ruta')}
            scaleTo={0.98}
            style={styles.routeRow}
          >
            <View style={styles.routeIcon}>
              <TelIcon name="qr" size={24} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <TelText variant="subtitle" color="cream">
                Ruta Telemática en vivo
              </TelText>
              <TelText variant="caption" color="accentSoft">
                ¿Estás en la feria? Ingresa el código del stand y juega con tu grupo.
              </TelText>
            </View>
            <TelIcon name="chevronRight" size={20} color={colors.cream} />
          </PressableScale>
        </Animated.View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Hoy" />
        <Animated.View entering={entering.fadeUp(1)} style={styles.today}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={dailyDone ? 'Desafío de hoy: completado. Repetir para practicar' : `Desafío de hoy: cinco microjuegos, bono de ${DAILY_BONUS} puntos`}
            haptic
            onPress={() => router.push({ pathname: '/burst', params: { diario: '1' } })}
            scaleTo={0.97}
            style={styles.tile}
          >
            <View style={[styles.tileIcon, dailyDone && styles.tileIconDone]}>
              <TelIcon name={dailyDone ? 'checkCircle' : 'calendar'} size={22} color={dailyDone ? colors.white : colors.primary} />
            </View>
            <TelText variant="label" color="ink">
              Desafío de hoy
            </TelText>
            <TelText variant="small" color={dailyDone ? 'successInk' : 'inkSoft'}>
              {dailyDone ? 'Completado' : `5 microjuegos · +${DAILY_BONUS} pts`}
            </TelText>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={profile ? `Rutix está ${moodLabel(profile.mascotMood)}. Misiones de hoy: ${missionsDone} de ${missions.length}. Visitar a Rutix` : 'Visitar a Rutix'}
            haptic
            onPress={() => router.push('/mascot')}
            scaleTo={0.97}
            style={styles.tile}
          >
            <View style={styles.tileRutix}>
              <Rutix size={44} expression={expressionForMood(profile?.mascotMood ?? 70)} signal={signalForMood(profile?.mascotMood ?? 70)} animated={false} accessibilityLabel="" />
            </View>
            <TelText variant="label" color="ink">
              Misiones de Rutix
            </TelText>
            <TelText variant="small" color={missions.length > 0 && missionsDone === missions.length ? 'successInk' : 'inkSoft'}>
              {missions.length ? `${missionsDone} de ${missions.length} · ${profile ? moodLabel(profile.mascotMood) : ''}` : 'Tu compañero'}
            </TelText>
          </PressableScale>
        </Animated.View>
      </View>

      <Animated.View entering={entering.fadeUp(2)} style={styles.rows}>
        <ListRow
          icon="trophy"
          iconTint={['#F2CE63', colors.primary]}
          title={account.status === 'registered' && account.rank ? `Ranking: lugar #${formatNumber(account.rank.rank)} de ${formatNumber(account.rank.total)}` : account.status === 'expired' ? 'Vuelve a entrar a tu cuenta' : 'Entra al ranking global'}
          body={account.status === 'registered' ? 'Compara tu XP con todos los que juegan SoyTEL.' : 'Solo necesitas un alias: tus puntajes quedan registrados.'}
          onPress={() => router.push(account.status === 'guest' ? '/cuenta' : '/ranking')}
        />
        <ListRow icon="lightbulb" title="Dato del día" body={tip.text.length > 78 ? `${tip.text.slice(0, 76).trimEnd()}…` : tip.text} onPress={() => setTipOpen(true)} />
      </Animated.View>

      <TelButton label="Ver todos los juegos" variant="subtle" iconRight="arrowRight" onPress={() => router.navigate('/games')} />

      <TipSheet tip={tip} visible={tipOpen} onClose={() => setTipOpen(false)} />
      <TelematicaSheet visible={brandOpen} onClose={() => setBrandOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingRight: spacing.xs,
  },
  avatarButton: {
    marginLeft: 'auto',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    gap: spacing.sm,
  },
  level: {
    gap: 6,
    minHeight: 44,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flexText: {
    flex: 1,
  },
  floating: {
    marginTop: -56 - spacing.gutter,
  },
  hero: {
    padding: 18,
    gap: spacing.sm,
  },
  heroInner: {
    gap: 14,
  },
  heroTag: {
    alignSelf: 'flex-start',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  kicker: {
    letterSpacing: 1.2,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  routeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  section: {
    gap: spacing.sm,
  },
  today: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    gap: 4,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginBottom: 4,
  },
  tileIconDone: {
    backgroundColor: colors.success,
  },
  tileRutix: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 4,
    overflow: 'hidden',
  },
  rows: {
    gap: spacing.xs,
  },
});
