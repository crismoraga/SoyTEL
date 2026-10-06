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
import { DAILY_BONUS, dailyKey, isDailyDone } from '@/features/burst/daily';
import { puzzles } from '@/features/puzzles/catalog';
import { runnerCharacters } from '@/features/runner/characters';
import { stationGames } from '@/features/stations/registry';
import { runnerCharacterDrawing } from '@/graphics/runners';
import { SvgDrawing } from '@/graphics/ShapeLayer';
import { wonMicroGames } from '@/lib/achievements';
import { formatNumber } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { useFocusData } from '@/lib/useFocusData';
import { loadResults } from '@/storage/profile';
import { loadPuzzleProgress } from '@/storage/puzzles';
import { loadRunnerSave } from '@/storage/runner';
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
    const [results, story, puzzleProgress, runner] = await Promise.all([loadResults(), loadStoryProgress(), loadPuzzleProgress(), loadRunnerSave()]);
    return { results, chapters: story.completedChapters.length, puzzleProgress, runner };
  });
  const won = new Set(data ? wonMicroGames(data.results) : []);
  const bestBurst = data ? data.results.filter((item) => item.gameId === 'burst').reduce((max, item) => Math.max(max, item.score), 0) : 0;
  const dailyDone = data ? isDailyDone(data.results, dailyKey(new Date())) : false;

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

      <Animated.View entering={entering.fadeUp(1)}>
        <TelCard tone="navy" onPress={() => router.push('/runner')} accessibilityLabel="TEL Runner, carrera sin fin. Jugar" style={styles.runnerCard}>
          <View style={styles.runnerArt}>
            <SvgDrawing drawing={runnerCharacterDrawing(data?.runner.selected ?? 'rutix')} width={84} height={84} />
          </View>
          <View style={styles.flex}>
            <Tag tone="cream" icon="sparkle" label="NUEVO" style={styles.runnerTag} />
            <TelText variant="heading" color="cream">
              TEL Runner
            </TelText>
            <TelText variant="caption" color="accentSoft">
              Carrera sin fin por la autopista de datos: junta paquetes, esquiva virus y desbloquea personajes telemáticos.
            </TelText>
            <TelText variant="label" color="accent" tabular>
              {data && data.runner.best > 0
                ? `Récord: ${formatNumber(data.runner.best)} pts · ${data.runner.unlocked.length}/${runnerCharacters.length} personajes`
                : `${runnerCharacters.length} personajes por desbloquear`}
            </TelText>
          </View>
          <TelIcon name="chevronRight" size={22} color={colors.cream} />
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
              8 microjuegos al azar y 3 vidas. Cada ronda parte cuando tú tocas y explica cómo se juega.
            </TelText>
            {bestBurst > 0 && (
              <TelText variant="label" color="accent" tabular>
                Récord: {formatNumber(bestBurst)} pts
              </TelText>
            )}
          </View>
          <TelButton label="Jugar ráfaga" variant="cream" iconRight="arrowRight" onPress={() => router.push('/burst')} />
          <TelButton
            label={dailyDone ? 'Desafío de hoy: completado' : `Desafío de hoy · bono +${DAILY_BONUS}`}
            variant="outlineLight"
            icon={dailyDone ? 'checkCircle' : 'calendar'}
            onPress={() => router.push({ pathname: '/burst', params: { diario: '1' } })}
          />
        </TelCard>
      </Animated.View>

      <View style={styles.section}>
        <SectionHeader title="Desafíos sin reloj" subtitle="Rompecabezas por niveles: piensa con calma, Rutix te guía" />
        {puzzles.map((puzzle, index) => {
          const state = data?.puzzleProgress[puzzle.id];
          const solved = state?.level ?? 0;
          return (
            <Animated.View key={puzzle.id} entering={entering.fadeUp(index)}>
              <TelCard
                onPress={() => router.push({ pathname: '/puzzle', params: { juego: puzzle.id } })}
                accessibilityLabel={`${puzzle.title}. Nivel ${Math.min(solved + 1, puzzle.maxLevel)} de ${puzzle.maxLevel}`}
                style={styles.puzzleCard}
              >
                <View style={[styles.stationIcon, { backgroundColor: puzzle.color }]}>
                  <TelIcon name={puzzle.icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <TelText variant="subtitle" color="ink">
                    {puzzle.title}
                  </TelText>
                  <TelText variant="caption" color="inkSoft">
                    {puzzle.subtitle}
                  </TelText>
                  <ProgressBar progress={solved / puzzle.maxLevel} height={6} accessibilityLabel={`Niveles resueltos de ${puzzle.title}`} />
                  <TelText variant="small" color={solved > 0 ? 'successInk' : 'inkAccent'}>
                    {solved >= puzzle.maxLevel ? '¡Todos los niveles resueltos!' : solved > 0 ? `${solved}/${puzzle.maxLevel} niveles · sigue el ${solved + 1}` : `${puzzle.maxLevel} niveles · empieza por el 1`}
                  </TelText>
                </View>
                <TelIcon name="chevronRight" size={20} color={colors.ink} />
              </TelCard>
            </Animated.View>
          );
        })}
      </View>

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
  runnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  runnerTag: {
    alignSelf: 'flex-start',
  },
  runnerArt: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDeep,
  },
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
  puzzleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
