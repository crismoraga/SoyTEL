import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { SectionHeader } from '@/components/Blocks';
import { ChipGroup, Tag } from '@/components/Chips';
import { ProgressBar } from '@/components/feedback/Progress';
import { Rutix } from '@/components/graphics/Rutix';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { storyChapters } from '@/data/story';
import { microGameCatalog } from '@/features/burst/catalog';
import { DAILY_BONUS, dailyKey, isDailyDone } from '@/features/burst/daily';
import { puzzles } from '@/features/puzzles/catalog';
import { runnerCharacters } from '@/features/runner/characters';
import { stationGames } from '@/features/stations/registry';
import { runnerCharacterDrawing } from '@/graphics/runners';
import { SvgDrawing } from '@/graphics/ShapeLayer';
import { formatNumber } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { LoadError } from '@/components/feedback/LoadError';
import { useFocusData } from '@/lib/useFocusData';
import { loadProfile, loadResults, progressStatsOf } from '@/storage/profile';
import { loadPuzzleProgress } from '@/storage/puzzles';
import { loadRunnerSave } from '@/storage/runner';
import { loadStoryProgress } from '@/storage/story';
import { colors, radius, spacing, type ColorToken } from '@/theme';

type Category = 'todo' | 'vivo' | 'rapido' | 'calma' | 'aprender';

const CATEGORIES: { id: Category; label: string; icon?: IconName }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'vivo', label: 'Ruta', icon: 'route' },
  { id: 'rapido', label: 'Rápidos', icon: 'bolt' },
  { id: 'calma', label: 'Con calma', icon: 'network' },
  { id: 'aprender', label: 'Aprender', icon: 'school' },
];

interface GameRowProps {
  title: string;
  subtitle: string;
  // Dato propio del jugador: récord, avance o estado.
  meta?: string;
  metaTone?: ColorToken;
  icon?: IconName;
  color?: string;
  // Dibujo en vez de ícono (personaje de TEL Runner, Rutix).
  art?: ReactNode;
  tag?: ReactNode;
  onPress: () => void;
}

// Una fila por juego, todas con la misma forma: se recorren de un vistazo.
function GameRow({ title, subtitle, meta, metaTone = 'inkAccent', icon, color = colors.highlight, art, tag, onPress }: GameRowProps) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}${meta ? `. ${meta}` : ''}`} haptic onPress={onPress} scaleTo={0.98} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color }]}>{art ?? (icon ? <TelIcon name={icon} size={24} color={colors.primary} /> : null)}</View>
      <View style={styles.flex}>
        <View style={styles.rowTitle}>
          <TelText variant="label" color="ink" numberOfLines={1} style={styles.rowTitleText}>
            {title}
          </TelText>
          {tag}
        </View>
        <TelText variant="caption" color="inkSoft" numberOfLines={2}>
          {subtitle}
        </TelText>
        {meta ? (
          <TelText variant="small" color={metaTone} tabular>
            {meta}
          </TelText>
        ) : null}
      </View>
      <TelIcon name="chevronRight" size={18} color={colors.inkSoft} />
    </PressableScale>
  );
}

// Fila que abre o cierra una lista larga (los juegos de la ruta, la colección de microjuegos).
function Disclosure({ title, subtitle, icon, open, onToggle }: { title: string; subtitle: string; icon: IconName; open: boolean; onToggle: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} accessibilityState={{ expanded: open }} haptic onPress={onToggle} scaleTo={0.98} style={[styles.row, styles.disclosure]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceAlt }]}>
        <TelIcon name={icon} size={24} color={colors.inkAccent} />
      </View>
      <View style={styles.flex}>
        <TelText variant="label" color="ink">
          {title}
        </TelText>
        <TelText variant="caption" color="inkSoft">
          {subtitle}
        </TelText>
      </View>
      <TelIcon name={open ? 'chevronUp' : 'chevronDown'} size={18} color={colors.inkSoft} />
    </PressableScale>
  );
}

// Pestaña "Jugar": todos los juegos, ordenados por lo que apetece hacer (en grupo, rápido, con calma,
// aprender). Las listas largas parten cerradas para que la pantalla se lea de un vistazo.
export default function GamesScreen() {
  const entering = useEntering();
  const [category, setCategory] = useState<Category>('todo');
  const [stationsOpen, setStationsOpen] = useState(false);
  const [microOpen, setMicroOpen] = useState(false);
  const { data, error, reload } = useFocusData(async () => {
    const [profile, results, story, puzzleProgress, runner] = await Promise.all([loadProfile(), loadResults(), loadStoryProgress(), loadPuzzleProgress(), loadRunnerSave()]);
    return { results, stats: progressStatsOf(profile, results), chapters: story.completedChapters.length, puzzleProgress, runner };
  });
  const results = data?.results ?? [];
  const stats = data?.stats;
  const won = new Set(Object.keys(stats?.microWins ?? {}));
  const best = (gameId: string) => results.filter((item) => item.gameId === gameId).reduce((max, item) => Math.max(max, item.score), 0);
  const bestBurst = best('burst');
  const dailyDone = isDailyDone(results, dailyKey(new Date()));
  const show = (id: Exclude<Category, 'todo'>) => category === 'todo' || category === id;
  // Al elegir una categoría sus listas se muestran completas.
  const stationsVisible = stationsOpen || category === 'vivo';
  const microVisible = microOpen || category === 'rapido';

  return (
    <Screen inTabs header={<AppHeader kicker="Sala de juegos" title="Jugar" subtitle="Elige cómo quieres jugar hoy" />}>
      <ChipGroup accessibilityLabel="Tipo de juego" options={CATEGORIES} value={category} onChange={setCategory} inset={spacing.md} />
      {error && !data && <LoadError onRetry={reload} />}

      {show('vivo') && (
        <Animated.View key={`vivo-${category}`} entering={entering.fadeUp()} style={styles.section}>
          <SectionHeader title="Ruta Telemática" subtitle="En la feria, con tu grupo y en vivo" />
          <TelCard tone="navy" style={styles.live}>
            <Tag tone="glass" live label="EN VIVO · GRUPAL" style={styles.liveTag} />
            <TelText variant="heading" color="cream">
              Stand → B215 → B213 → pasillo
            </TelText>
            <TelText variant="caption" color="accentSoft">
              Seis juegos y una trivia final con tu grupo. {stats && stats.routesCompleted > 0 ? `Llevas ${stats.routesCompleted} ${stats.routesCompleted === 1 ? 'ruta completada' : 'rutas completadas'}.` : 'También puedes recorrerla sin grupo.'}
            </TelText>
            <TelButton label="Ingresar código del stand" variant="cream" icon="qr" onPress={() => router.push('/ruta')} />
          </TelCard>
          <Disclosure
            title="Practicar los juegos de la ruta"
            subtitle={`${stationGames.length} juegos de las salas B215 y B213`}
            icon="target"
            open={stationsVisible}
            onToggle={() => setStationsOpen((value) => !value)}
          />
          {stationsVisible &&
            stationGames.map((game) => {
              const record = results.filter((item) => item.gameId === 'station' && item.metadata?.game === game.id).reduce((max, item) => Math.max(max, item.score), 0);
              return (
                <GameRow
                  key={game.id}
                  title={game.title}
                  subtitle={`${game.place} · ${game.pillar}`}
                  meta={record ? `Récord ${formatNumber(record)} pts` : game.minutes}
                  metaTone={record ? 'successInk' : 'inkAccent'}
                  icon={game.icon}
                  color={game.color}
                  onPress={() => router.push({ pathname: '/estacion', params: { juego: game.id } })}
                />
              );
            })}
        </Animated.View>
      )}

      {show('rapido') && (
        <Animated.View key={`rapido-${category}`} entering={entering.fadeUp(1)} style={styles.section}>
          <SectionHeader title="Rápidos" subtitle="De 3 a 5 minutos" />
          <GameRow
            title="Ráfaga TEL"
            subtitle="8 microjuegos al azar y 3 vidas. Cada ronda parte cuando tú tocas."
            meta={bestBurst > 0 ? `Récord ${formatNumber(bestBurst)} pts` : undefined}
            icon="bolt"
            color={colors.accent}
            onPress={() => router.push('/burst')}
          />
          <GameRow
            title="Desafío de hoy"
            subtitle="Los mismos 5 microjuegos para todos, solo por hoy."
            meta={dailyDone ? 'Completado · vuelve mañana' : `Bono de +${DAILY_BONUS} puntos`}
            metaTone={dailyDone ? 'successInk' : 'inkAccent'}
            icon={dailyDone ? 'checkCircle' : 'calendar'}
            color={dailyDone ? colors.successSoft : colors.accent}
            onPress={() => router.push({ pathname: '/burst', params: { diario: '1' } })}
          />
          <GameRow
            title="TEL Runner"
            subtitle="Carrera sin fin: junta paquetes de datos, esquiva virus y desbloquea personajes."
            meta={data && data.runner.best > 0 ? `Récord ${formatNumber(data.runner.best)} pts · ${data.runner.unlocked.length}/${runnerCharacters.length} personajes` : `${runnerCharacters.length} personajes por desbloquear`}
            color={colors.primary}
            art={<SvgDrawing drawing={runnerCharacterDrawing(data?.runner.selected ?? 'rutix')} width={42} height={42} />}
            onPress={() => router.push('/runner')}
          />
          <Disclosure
            title="Colección de microjuegos"
            subtitle={`${won.size} de ${microGameCatalog.length} ganados · practica el que quieras`}
            icon="grid"
            open={microVisible}
            onToggle={() => setMicroOpen((value) => !value)}
          />
          {microVisible && (
            <>
              <ProgressBar progress={won.size / microGameCatalog.length} accessibilityLabel="Microjuegos ganados" />
              <View style={styles.microGrid}>
                {microGameCatalog.map((game) => {
                  const isWon = won.has(game.id);
                  return (
                    <View key={game.id} style={styles.microCell}>
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
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </Animated.View>
      )}

      {show('calma') && (
        <Animated.View key={`calma-${category}`} entering={entering.fadeUp(1)} style={styles.section}>
          <SectionHeader title="Con calma" subtitle="Sin reloj y por niveles: Rutix te guía" />
          {puzzles.map((puzzle) => {
            const solved = data?.puzzleProgress[puzzle.id]?.level ?? 0;
            return (
              <GameRow
                key={puzzle.id}
                title={puzzle.title}
                subtitle={puzzle.subtitle}
                meta={solved >= puzzle.maxLevel ? '¡Todos los niveles resueltos!' : solved > 0 ? `${solved} de ${puzzle.maxLevel} niveles · sigue el ${solved + 1}` : `${puzzle.maxLevel} niveles · empieza por el 1`}
                metaTone={solved > 0 ? 'successInk' : 'inkAccent'}
                icon={puzzle.icon}
                color={puzzle.color}
                onPress={() => router.push({ pathname: '/puzzle', params: { juego: puzzle.id } })}
              />
            );
          })}
        </Animated.View>
      )}

      {show('aprender') && (
        <Animated.View key={`aprender-${category}`} entering={entering.fadeUp(1)} style={styles.section}>
          <SectionHeader title="Aprender" subtitle="Preguntas, historia y tu compañero" />
          <GameRow
            title="Quién quiere ser Telemático"
            subtitle="Diez preguntas de menor a mayor dificultad, con tres comodines."
            meta={stats && stats.millionaireBest > 0 ? `Mejor: ${stats.millionaireBest} de 10 correctas` : '8 a 12 minutos'}
            metaTone={stats && stats.millionaireBest > 0 ? 'successInk' : 'inkAccent'}
            icon="help"
            onPress={() => router.push('/millionaire')}
          />
          <GameRow
            title="Historia: La señal perdida"
            subtitle="Cinco capítulos con Rutix por el campus, cada uno con un reto distinto."
            meta={`${data?.chapters ?? 0} de ${storyChapters.length} capítulos`}
            metaTone={data && data.chapters > 0 ? 'successInk' : 'inkAccent'}
            icon="book"
            onPress={() => router.push('/story')}
          />
          <GameRow
            title="Practica un área de la carrera"
            subtitle="Cinco preguntas de redes, software, hardware, telecomunicaciones o seguridad."
            icon="school"
            onPress={() => router.navigate('/career')}
          />
          <GameRow
            title="Rutix, tu compañero"
            subtitle="Cuídalo, cumple sus misiones del día y cámbiale el look."
            meta="1 minuto al día"
            color={colors.primary}
            art={<Rutix size={42} expression="happy" animated={false} accessibilityLabel="" />}
            onPress={() => router.push('/mascot')}
          />
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  live: {
    gap: spacing.xs,
    padding: 16,
  },
  liveTag: {
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    minHeight: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclosure: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowTitleText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
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
});
