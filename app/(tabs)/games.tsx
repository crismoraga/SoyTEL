import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { SectionHeader } from '@/components/Blocks';
import { Tag } from '@/components/Chips';
import { ProgressBar } from '@/components/feedback/Progress';
import { SkeletonCard } from '@/components/feedback/Skeleton';
import { Illustration, type IllustrationName } from '@/components/graphics/Illustration';
import { Rutix } from '@/components/graphics/Rutix';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { storyChapters } from '@/data/story';
import { microGameCatalog } from '@/features/burst/catalog';
import { stationGames } from '@/features/stations/registry';
import { wonMicroGames } from '@/lib/achievements';
import { formatNumber } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { useFocusData } from '@/lib/useFocusData';
import { loadResults } from '@/storage/profile';
import { loadStoryProgress } from '@/storage/story';
import { colors, radius, spacing } from '@/theme';
import type { GameResult } from '@/types/game';

interface ModeCard {
  title: string;
  subtitle: string;
  duration: string;
  illustration: IllustrationName;
  route: Href;
  stat: (results: GameResult[], chapters: number) => string;
}

const modes: ModeCard[] = [
  {
    title: 'Quién quiere ser Telemático',
    subtitle: 'Diez preguntas de menor a mayor dificultad, tres comodines y la opción de plantarte.',
    duration: '8–12 min',
    illustration: 'quiz',
    route: '/millionaire',
    stat: (results) => {
      const best = results.filter((item) => item.gameId === 'millionaire').reduce((max, item) => Math.max(max, Number(item.metadata?.correctAnswers ?? 0)), 0);
      return best > 0 ? `Mejor: ${best}/10 correctas` : 'Sin partidas aún';
    },
  },
  {
    title: 'Historia: La señal perdida',
    subtitle: 'Cinco capítulos con Rutix por el campus. Cada uno es un reto de un área distinta.',
    duration: '10–15 min',
    illustration: 'campus',
    route: '/story',
    stat: (_, chapters) => `${chapters}/${storyChapters.length} capítulos`,
  },
];

// Pestaña "Jugar": todos los modos y la colección de microjuegos ganados.
export default function GamesScreen() {
  const entering = useEntering();
  const { data } = useFocusData(async () => {
    const [results, story] = await Promise.all([loadResults(), loadStoryProgress()]);
    return { results, chapters: story.completedChapters.length };
  });
  const won = new Set(data ? wonMicroGames(data.results) : []);
  const bestBurst = data ? data.results.filter((item) => item.gameId === 'burst').reduce((max, item) => Math.max(max, item.score), 0) : 0;

  return (
    <Screen
      inTabs
      header={<AppHeader kicker="Sala de juegos" title="Jugar" subtitle="Sesiones cortas de 3 a 20 minutos" />}
    >
      <Animated.View entering={entering.fadeUp()}>
        <TelCard tone="navy" style={styles.featured}>
          <View style={styles.featuredArt}>
            <Illustration name="route" width={150} tone="dark" />
          </View>
          <View style={styles.featuredText}>
            <Tag tone="glass" live label="EN VIVO · GRUPAL" />
            <TelText variant="title" color="cream">
              Ruta Telemática
            </TelText>
            <TelText variant="caption" color="accentSoft">
              Stand → B215 → B213 → pasillo. Seis juegos y una trivia final en vivo con tu grupo.
            </TelText>
            {data && data.results.some((item) => item.gameId === 'route') && (
              <TelText variant="label" color="accent" tabular>
                {data.results.filter((item) => item.gameId === 'route').length} rutas completadas
              </TelText>
            )}
          </View>
          <TelButton label="Ingresar código del stand" variant="cream" icon="qr" onPress={() => router.push('/ruta')} />
        </TelCard>
      </Animated.View>

      <View style={styles.section}>
        <SectionHeader title="Juegos de la ruta" subtitle="Practícalos antes de la feria o repítelos cuando quieras" />
        <View style={styles.stationGrid}>
          {stationGames.map((game, index) => {
            const best = data ? data.results.filter((item) => item.gameId === 'station' && item.metadata?.game === game.id).reduce((max, item) => Math.max(max, item.score), 0) : 0;
            return (
              <Animated.View key={game.id} entering={entering.pop(index)} style={styles.stationCell}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${game.title}, ${game.place}. Practicar`}
                  haptic
                  onPress={() => router.push({ pathname: '/estacion', params: { juego: game.id } })}
                  style={styles.station}
                >
                  <View style={[styles.stationIcon, { backgroundColor: game.color }]}>
                    <TelIcon name={game.icon} size={24} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <TelText variant="small" color="inkAccent">
                      {game.place.toUpperCase()} · {game.pillar}
                    </TelText>
                    <TelText variant="label" color="ink" numberOfLines={1}>
                      {game.title}
                    </TelText>
                    <TelText variant="small" color={best ? 'successInk' : 'inkSoft'}>
                      {best ? `Récord ${formatNumber(best)} pts` : game.minutes}
                    </TelText>
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <Animated.View entering={entering.fadeUp(1)}>
        <TelCard tone="navy" style={styles.featured}>
          <View style={styles.featuredArt}>
            <Illustration name="burst" width={150} tone="dark" />
          </View>
          <View style={styles.featuredText}>
            <Tag tone="glass" icon="bolt" label="MODO WARIOWARE" />
            <TelText variant="title" color="cream">
              Ráfaga TEL
            </TelText>
            <TelText variant="caption" color="accentSoft">
              6 microjuegos al azar, 3 vidas y cada vez más rápido.
            </TelText>
            {bestBurst > 0 && (
              <TelText variant="label" color="accent" tabular>
                Récord: {formatNumber(bestBurst)} pts
              </TelText>
            )}
          </View>
          <TelButton label="Jugar ráfaga" variant="cream" iconRight="arrowRight" onPress={() => router.push('/burst')} />
        </TelCard>
      </Animated.View>

      <View style={styles.section}>
        <SectionHeader title="Modos de juego" />
        {data
          ? modes.map((mode, index) => (
              <Animated.View key={mode.title} entering={entering.fadeUp(index + 1)}>
                <TelCard onPress={() => router.push(mode.route)} accessibilityLabel={`${mode.title}. ${mode.duration}`} style={styles.modeCard}>
                  <View style={styles.modeArt}>
                    <Illustration name={mode.illustration} width={112} />
                  </View>
                  <View style={styles.flex}>
                    <Tag tone="sky" icon="clock" label={mode.duration} />
                    <TelText variant="subtitle" color="ink">
                      {mode.title}
                    </TelText>
                    <TelText variant="caption" color="inkSoft">
                      {mode.subtitle}
                    </TelText>
                    <TelText variant="small" color="inkAccent">
                      {mode.stat(data.results, data.chapters)}
                    </TelText>
                  </View>
                </TelCard>
              </Animated.View>
            ))
          : [0, 1, 2].map((index) => <SkeletonCard key={index} />)}
        <TelCard onPress={() => router.push('/mascot')} accessibilityLabel="Visitar a Rutix" style={styles.modeCard}>
          <View style={styles.modeArt}>
            <Rutix size={96} expression="happy" pose="wave" signal={4} animated={false} />
          </View>
          <View style={styles.flex}>
            <Tag tone="warning" icon="heart" label="1 min al día" />
            <TelText variant="subtitle" color="ink">
              Rutix, tu mascota
            </TelText>
            <TelText variant="caption" color="inkSoft">
              Cuídalo cada día: su señal sube cuando juegas y baja si lo olvidas.
            </TelText>
          </View>
        </TelCard>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Colección de microjuegos"
          subtitle={`${won.size}/${microGameCatalog.length} ganados · toca uno para practicarlo`}
        />
        <ProgressBar progress={won.size / microGameCatalog.length} accessibilityLabel="Microjuegos ganados" />
        <View style={styles.microGrid}>
          {microGameCatalog.map((game, index) => {
            const isWon = won.has(game.id);
            return (
              <Animated.View key={game.id} entering={entering.pop(index)} style={styles.microCell}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${game.title}. ${isWon ? 'Ganado' : 'Aún sin ganar'}. Practicar`}
                  haptic
                  onPress={() => router.push({ pathname: '/burst', params: { focus: game.id } })}
                  style={[styles.micro, isWon && styles.microWon]}
                >
                  <View style={[styles.microIcon, { backgroundColor: isWon ? colors.action : colors.surfaceAlt }]}>
                    <TelIcon name={game.icon} size={24} color={isWon ? colors.actionInk : colors.inkAccent} />
                  </View>
                  <TelText variant="small" color="ink" align="center" numberOfLines={2}>
                    {game.title}
                  </TelText>
                  <TelText variant="small" color={isWon ? 'successInk' : 'inkSoft'} style={styles.microMeta}>
                    {isWon ? 'Ganado' : game.mechanic}
                  </TelText>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  featured: {
    gap: spacing.sm,
    overflow: 'hidden',
  },
  featuredArt: {
    position: 'absolute',
    right: -18,
    top: -6,
    opacity: 0.95,
  },
  featuredText: {
    gap: 6,
    paddingRight: 110,
    minHeight: 132,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 14,
  },
  modeArt: {
    width: 104,
    alignItems: 'center',
  },
  flex: {
    flex: 1,
    gap: 4,
  },
  microGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  microCell: {
    width: '33.33%',
    padding: 5,
  },
  micro: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 124,
  },
  microWon: {
    borderColor: colors.accent,
    backgroundColor: colors.highlight,
  },
  microIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microMeta: {
    fontSize: 11,
  },
  stationGrid: {
    gap: spacing.xs,
  },
  stationCell: {
    width: '100%',
  },
  station: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stationIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
