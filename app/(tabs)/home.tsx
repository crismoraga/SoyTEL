import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { SectionHeader } from '@/components/Blocks';
import { AppLogo, brandImages, Wordmark } from '@/components/Brand';
import { Tag } from '@/components/Chips';
import { ProgressBar } from '@/components/feedback/Progress';
import { Skeleton, SkeletonText } from '@/components/feedback/Skeleton';
import { Medallion, type MedallionGlyph } from '@/components/graphics/Medallion';
import { Rutix } from '@/components/graphics/Rutix';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { UserAvatar } from '@/components/UserAvatar';
import { useAccount } from '@/account/store';
import { tipForDate } from '@/data/tips';
import { TelematicaSheet } from '@/features/brand/TelematicaSheet';
import { RouteProgress } from '@/features/route/parts';
import { TipSheet } from '@/features/tips/TipSheet';
import { useMemberView } from '@/route/hooks';
import { expressionForMood, signalForMood } from '@/graphics/rutix';
import { formatNumber, greeting } from '@/lib/format';
import { nextMission } from '@/lib/missions';
import { useEntering } from '@/lib/motion';
import { levelTitle, progressToNextLevel, xpToNextLevel } from '@/lib/progression';
import { useFocusData } from '@/lib/useFocusData';
import { ensureDailyInbox, useUnreadCount } from '@/storage/inbox';
import { loadProfile, loadResults } from '@/storage/profile';
import { loadStoryProgress } from '@/storage/story';
import { colors, radius, shadows, spacing } from '@/theme';

interface ExploreItem {
  label: string;
  glyph: MedallionGlyph;
  route: Href;
}

const explore: ExploreItem[] = [
  { label: 'Ráfaga', glyph: 'bolt', route: '/burst' },
  { label: 'Telemático', glyph: 'question', route: '/millionaire' },
  { label: 'Historia', glyph: 'book', route: '/story' },
  { label: 'Ruta', glyph: 'route', route: '/ruta' },
  { label: 'Rutix', glyph: 'robot', route: '/mascot' },
  { label: 'Ranking', glyph: 'trophy', route: '/ranking' },
  { label: 'Malla', glyph: 'cap', route: '/malla' },
  { label: 'Perfil', glyph: 'rocket', route: '/profile' },
];

function moodLabel(value: number): string {
  if (value >= 85) return 'radiante';
  if (value >= 60) return 'motivado';
  if (value >= 35) return 'con sueño';
  return 'con poca señal';
}

// Pantalla "Inicio" de Claude Design: cabecera azul, tarjeta flotante de misión y accesos a todo.
export default function HomeScreen() {
  const entering = useEntering();
  const unread = useUnreadCount();
  const account = useAccount();
  const [tipOpen, setTipOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const { data } = useFocusData(async () => {
    const [profile, results, story] = await Promise.all([loadProfile(), loadResults(), loadStoryProgress()]);
    return { profile, results, story };
  });
  const profile = data?.profile;

  useEffect(() => {
    if (profile) void ensureDailyInbox(profile.mascotMood);
  }, [profile]);

  const route = useMemberView();
  const routeActive = route.status !== 'idle' && Boolean(route.code);
  const mission = data ? nextMission(data.results, data.story.completedChapters) : null;
  const tip = tipForDate(new Date());

  return (
    <Screen
      inTabs
      header={
        <AppHeader rounded overlap={64}>
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
            <View style={styles.headerActions}>
              <IconButton icon="bell" tone="dark" badge={unread} accessibilityLabel="Avisos" onPress={() => router.navigate('/inbox')} />
              <PressableScale accessibilityRole="button" accessibilityLabel="Tu perfil" haptic onPress={() => router.push('/profile')} style={styles.avatarButton}>
                <UserAvatar avatar={profile?.avatar ?? 0} size={40} />
              </PressableScale>
            </View>
          </View>
          {profile ? (
            <Animated.View entering={entering.fade()} style={styles.greeting}>
              <TelText variant="title" color="cream">
                {greeting()}, {profile.alias}
              </TelText>
              <View style={styles.pills}>
                <Tag tone="glass" icon="star" label={`Nivel ${profile.level} · ${levelTitle(profile.level)}`} />
                <Tag
                  tone="glass"
                  icon="flame"
                  label={profile.streakDays > 0 ? `Racha ${profile.streakDays} ${profile.streakDays === 1 ? 'día' : 'días'}` : 'Empieza tu racha'}
                />
              </View>
            </Animated.View>
          ) : (
            <View style={styles.greeting}>
              <Skeleton tone="dark" height={26} width="70%" />
              <Skeleton tone="dark" height={20} width="55%" />
            </View>
          )}
        </AppHeader>
      }
    >
      <View style={styles.floating}>
        <TelCard elevated style={styles.missionCard}>
          {mission && profile ? (
            <Animated.View entering={entering.fadeUp()} style={styles.missionInner}>
              <View style={styles.missionRow}>
                <Medallion glyph={mission.glyph} size={58} />
                <View style={styles.flex}>
                  <TelText variant="small" color="inkAccent" style={styles.kicker}>
                    {mission.kicker.toUpperCase()}
                  </TelText>
                  <TelText variant="subtitle" color="ink">
                    {mission.title}
                  </TelText>
                  <TelText variant="caption" color="inkSoft">
                    {mission.subtitle}
                  </TelText>
                </View>
              </View>
              <View style={styles.progressBlock}>
                <View style={styles.progressLabels}>
                  <TelText variant="label" color="ink">
                    Nivel {profile.level}
                  </TelText>
                  <TelText variant="label" color="inkSoft" tabular>
                    {formatNumber(profile.xp)} XP · faltan {formatNumber(xpToNextLevel(profile.xp))}
                  </TelText>
                </View>
                <ProgressBar progress={progressToNextLevel(profile.xp)} accessibilityLabel="Progreso al siguiente nivel" />
              </View>
              <TelButton label={mission.cta} iconRight="arrowRight" onPress={() => router.push(mission.route)} />
            </Animated.View>
          ) : (
            <View style={styles.missionInner}>
              <View style={styles.missionRow}>
                <Skeleton width={58} height={58} rounded={29} />
                <View style={styles.flex}>
                  <SkeletonText lines={3} />
                </View>
              </View>
              <Skeleton height={8} rounded={radius.pill} />
              <Skeleton height={52} rounded={radius.md} />
            </View>
          )}
        </TelCard>
      </View>

      <Animated.View entering={entering.fadeUp(1)}>
        <TelCard tone="navy" style={styles.routeCard}>
          <View style={styles.routeHead}>
            <Tag tone="glass" live label={routeActive ? (route.solo ? 'RUTA INDIVIDUAL' : `RUTA ${route.code}`) : 'FERIA · STAND TELEMÁTICA'} />
          </View>
          <TelText variant="heading" color="cream">
            {routeActive ? 'Tienes una ruta en curso' : 'Ruta Telemática en vivo'}
          </TelText>
          <TelText variant="caption" color="accentSoft">
            {routeActive ? 'Vuelve para seguir jugando con tu grupo.' : 'Ingresa el código del stand y juega con tu grupo en B215, B213 y el pasillo.'}
          </TelText>
          <RouteProgress stop={route.snapshot?.stop ?? 'stand'} finished={route.snapshot?.phase === 'podium'} />
          <TelButton
            label={routeActive ? 'Volver a la ruta' : 'Ingresar código del stand'}
            variant="cream"
            icon={routeActive ? 'route' : 'qr'}
            onPress={() => router.push(routeActive ? '/ruta/juego' : '/ruta')}
          />
        </TelCard>
      </Animated.View>

      <Animated.View entering={entering.fadeUp(1)}>
        <TelCard onPress={() => router.push(account.status === 'guest' ? '/cuenta' : '/ranking')} accessibilityLabel="Ranking global" style={styles.rankCard}>
          <View style={styles.rankIcon}>
            <TelIcon name="trophy" size={24} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <TelText variant="small" color="inkAccent" style={styles.kicker}>
              RANKING GLOBAL
            </TelText>
            {account.status === 'registered' && account.rank ? (
              <TelText variant="subtitle" color="ink">
                Lugar #{formatNumber(account.rank.rank)} de {formatNumber(account.rank.total)}
              </TelText>
            ) : (
              <TelText variant="subtitle" color="ink">
                {account.status === 'expired' ? 'Vuelve a entrar a tu cuenta' : 'Crea tu cuenta y entra al ranking'}
              </TelText>
            )}
            <TelText variant="caption" color="inkSoft">
              {account.status === 'registered' ? 'Compara tu XP con todos los que juegan SoyTEL.' : 'Solo un alias: tus puntajes quedan registrados.'}
            </TelText>
          </View>
          <TelIcon name="chevronRight" size={20} color={colors.ink} />
        </TelCard>
      </Animated.View>

      <View style={styles.section}>
        <SectionHeader title="Explora" />
        <View style={styles.grid}>
          {explore.map((item, index) => (
            <Animated.View key={item.label} entering={entering.pop(index)} style={styles.gridCell}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={item.label}
                haptic
                onPress={() => router.push(item.route)}
                style={styles.gridButton}
              >
                <Medallion glyph={item.glyph} size={64} />
                <TelText variant="small" color="ink" align="center">
                  {item.label}
                </TelText>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </View>

      {profile && (
        <Animated.View entering={entering.fadeUp(2)}>
          <TelCard tone="navy" onPress={() => router.push('/mascot')} accessibilityLabel={`Rutix está ${moodLabel(profile.mascotMood)}. Visitar a Rutix`} style={styles.rutixCard}>
            <Rutix size={96} expression={expressionForMood(profile.mascotMood)} signal={signalForMood(profile.mascotMood)} />
            <View style={styles.flex}>
              <TelText variant="small" color="accent" style={styles.kicker}>
                TU COMPAÑERO
              </TelText>
              <TelText variant="subtitle" color="cream">
                Rutix está {moodLabel(profile.mascotMood)}
              </TelText>
              <ProgressBar progress={profile.mascotMood / 100} color={colors.accent} trackColor={colors.secondary} height={6} style={styles.moodBar} />
              <View style={styles.inlineLink}>
                <TelText variant="label" color="accentSoft">
                  Visitar a Rutix
                </TelText>
                <TelIcon name="arrowRight" size={16} color={colors.accentSoft} />
              </View>
            </View>
          </TelCard>
        </Animated.View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Hoy en SoyTEL" actionLabel="Ver avisos" onAction={() => router.navigate('/inbox')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={styles.carouselContent}>
          <FeatureCard
            image={brandImages.spotLabs}
            tag={<Tag tone="navy" live label="EN VIVO" />}
            title="Ráfaga relámpago"
            meta="6 microjuegos · 3 min"
            onPress={() => router.push('/burst')}
          />
          <FeatureCard
            image={brandImages.spotEvents}
            tag={<Tag tone="cream" label="¿SABÍAS QUE?" />}
            title={tip.text}
            meta="Dato del día · toca para leer"
            onPress={() => setTipOpen(true)}
            compactTitle
          />
          <FeatureCard
            image={brandImages.spotCareer}
            tag={<Tag tone="sky" label="CARRERA" />}
            title="¿Qué hace un telemático?"
            meta="6 áreas para descubrir"
            onPress={() => router.navigate('/career')}
          />
        </ScrollView>
      </View>
      <TipSheet tip={tip} visible={tipOpen} onClose={() => setTipOpen(false)} />
      <TelematicaSheet visible={brandOpen} onClose={() => setBrandOpen(false)} />
    </Screen>
  );
}

function FeatureCard({
  image,
  tag,
  title,
  meta,
  onPress,
  compactTitle = false,
}: {
  image: number;
  tag: React.ReactNode;
  title: string;
  meta: string;
  onPress: () => void;
  compactTitle?: boolean;
}) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`} onPress={onPress} scaleTo={0.97} style={styles.feature}>
      <View style={styles.featureMedia}>
        <Image source={image} style={styles.featureImage} resizeMode="cover" />
        <View style={styles.featureTag}>{tag}</View>
      </View>
      <View style={styles.featureBody}>
        <TelText variant={compactTitle ? 'label' : 'subtitle'} color="ink" numberOfLines={compactTitle ? 3 : 2}>
          {title}
        </TelText>
        <TelText variant="caption" color="inkSoft">
          {meta}
        </TelText>
      </View>
    </PressableScale>
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2CE63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  greeting: {
    gap: spacing.xs,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  floating: {
    marginTop: -64 - spacing.gutter,
  },
  missionCard: {
    padding: 18,
  },
  missionInner: {
    gap: 14,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  kicker: {
    letterSpacing: 1.4,
  },
  progressBlock: {
    gap: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  gridCell: {
    width: '25%',
  },
  gridButton: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  routeCard: {
    gap: spacing.sm,
  },
  routeHead: {
    flexDirection: 'row',
  },
  rutixCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
  },
  moodBar: {
    marginTop: 6,
    marginBottom: 4,
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  carousel: {
    marginHorizontal: -spacing.md,
    flexGrow: 0,
  },
  carouselContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
  },
  feature: {
    width: 236,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.soft,
  },
  featureMedia: {
    height: 120,
    backgroundColor: colors.surfaceAlt,
  },
  featureImage: {
    width: '100%',
    height: '100%',
  },
  featureTag: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  featureBody: {
    padding: 14,
    gap: 4,
    minHeight: 96,
  },
});
