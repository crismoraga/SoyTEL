import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { FitBox } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { mulberry32 } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import { GameBoard, Hint, StageBanner, StationHud, StationSummary, clamp, gameNow, useAskContinue, useDeadline, useGameTimeout, useNow, usePace, useStageFlow, useSubmitOnce, type StationGameProps } from '../kit';
import {
  bestEpoch,
  EPOCHS,
  FILTER_MAX,
  filtered,
  filterFeedback,
  GRID,
  LABEL_COUNT,
  LABEL_MAX,
  makeDataset,
  makeImage,
  pickDemoImage,
  stopVerdict,
  TEST_COUNT,
  testOutcome,
  TRAIN_MAX,
  trainLoss,
  trainScore,
  validationLoss,
  type FilterKind,
  type PixelImage,
  type Species,
} from '../logic/vision';

type StageKey = 'label' | 'filter' | 'train';

// Cada etapa: la meta en una frase y la idea en dos líneas cortas.
const STAGES: { key: StageKey; title: string; goal: string; body: string; icon: IconName; seconds: number }[] = [
  {
    key: 'label',
    title: 'Etiqueta los datos',
    goal: 'Marca cada foto: ¿gato o perro?',
    body: 'Un modelo de IA aprende de ejemplos con su respuesta.\nSi las etiquetas fallan, aprende mal: fíjate en las orejas.',
    icon: 'image',
    seconds: 30,
  },
  {
    key: 'filter',
    title: 'Procesa las imágenes',
    goal: 'Elige el filtro que mejor muestra la forma del animal.',
    body: 'Un filtro cambia los píxeles antes de que el modelo mire la foto.\nAlgunos resaltan lo importante y otros lo esconden.',
    icon: 'eye',
    seconds: 20,
  },
  {
    key: 'train',
    title: 'Entrena el modelo',
    goal: 'Detén el entrenamiento cuando la curva morada deje de bajar.',
    body: 'El modelo practica con unas fotos y se examina con otras que no vio.\nSi practica de más, memoriza las fotos y falla con las nuevas.',
    icon: 'neural',
    seconds: 30,
  },
];

const SECONDS = STAGES.map((item) => item.seconds);
const ACCENT = '#9B8AE6';
// Lo que tarda cada época de entrenamiento (ms, a ritmo normal).
const EPOCH_MS = 300;

const PixelGrid = memo(function PixelGrid({ pixels, size }: { pixels: string[]; size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {pixels.map((color, index) => (
        <Rect key={index} x={index % GRID} y={Math.floor(index / GRID)} width={1.04} height={1.04} fill={color} />
      ))}
    </Svg>
  );
});

// B213 · Datos: etiquetar, filtrar, entrenar y probar un clasificador de imágenes.
export function TrainAIGame({ seed, deadline, onComplete }: StationGameProps) {
  const pace = usePace();
  const [setup] = useState(() => {
    const random = mulberry32(seed ^ 0xda7a);
    const dataset = makeDataset(LABEL_COUNT, random);
    const testSet = makeDataset(TEST_COUNT, random, 100);
    return { dataset, testSet, best: bestEpoch(random), demo: pickDemoImage(dataset) };
  });
  const { dataset, testSet, best, demo } = setup;
  const flow = useStageFlow(SECONDS, pace);
  const [labels, setLabels] = useState<Species[]>([]);
  const [filter, setFilter] = useState<FilterKind | null>(null);
  const [stopEpoch, setStopEpoch] = useState<number | null>(null);
  const [summary, setSummary] = useState(false);
  const now = useNow(flow.endsAt !== null, 250);
  const stage = STAGES[flow.index];

  // Una sola cuenta para la barra superior, el resumen y el cierre forzado.
  const score = trainScore({ dataset, labels, filter, stopEpoch, best });
  const outcome = testOutcome(score.quality, TEST_COUNT);
  const accuracy = stopEpoch === null ? score.labelAccuracy : outcome.accuracy;
  const submit = useSubmitOnce(onComplete);
  // Si el stand cierra el proyecto antes, se entrega lo logrado hasta ese momento.
  useDeadline(deadline, () => submit({ score: score.total, accuracy }));

  const addLabel = useCallback((species: Species) => setLabels((current) => [...current, species]), []);
  const showSummary = useCallback(() => setSummary(true), []);

  if (summary) {
    return (
      <StationSummary
        title="Entrena la IA"
        total={score.total}
        message={`Tu modelo acertó ${outcome.correct} de ${TEST_COUNT} fotos nuevas.`}
        accent={ACCENT}
        rows={[
          { label: 'Datos bien etiquetados', value: score.label, max: LABEL_MAX, icon: 'image' },
          { label: 'Filtro elegido', value: score.filter, max: FILTER_MAX, icon: 'eye' },
          { label: 'Momento de detener', value: score.train, max: TRAIN_MAX, icon: 'neural' },
        ]}
        learned="Un modelo aprende de datos bien etiquetados, los filtros de bordes resaltan la forma y hay que detenerlo antes de que memorice (sobreajuste)."
        onSubmit={() => submit({ score: score.total, accuracy })}
      />
    );
  }

  if (flow.finished) {
    return <TestStage images={testSet} outcome={outcome} filter={filter ?? 'original'} onDone={showSummary} />;
  }

  const secondsLeft = flow.endsAt !== null ? clamp(Math.ceil((flow.endsAt - now) / 1000), 0, Math.round(stage.seconds * pace)) : null;

  return (
    <View style={styles.root}>
      <StationHud stage={flow.index + 1} stages={STAGES.length} title={stage.title} score={score.total} secondsLeft={secondsLeft} totalSeconds={Math.round(stage.seconds * pace)} accent={ACCENT} />
      {flow.endsAt !== null && stage.key === 'label' && <LabelStage images={dataset} labels={labels} onLabel={addLabel} endsAt={flow.endsAt} onFinish={() => flow.finish(0)} />}
      {flow.endsAt !== null && stage.key === 'filter' && <FilterStage image={demo} chosen={filter} onChoose={setFilter} endsAt={flow.endsAt} onFinish={() => flow.finish(1)} />}
      {flow.endsAt !== null && stage.key === 'train' && <TrainStage best={best} stopped={stopEpoch} onStop={setStopEpoch} endsAt={flow.endsAt} onFinish={() => flow.finish(2)} />}
      {flow.banner && <StageBanner key={stage.key} index={flow.index + 1} title={stage.title} goal={stage.goal} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={flow.start} />}
    </View>
  );
}

const SpeciesIcon = memo(function SpeciesIcon({ species }: { species: Species }) {
  const image = useMemo(() => makeImage(0, species, () => 0), [species]);
  return <PixelGrid pixels={image.pixels} size={32} />;
});

// ——— Etapa 1: etiquetar ———

function LabelStage({ images, labels, onLabel, endsAt, onFinish }: { images: PixelImage[]; labels: Species[]; onLabel: (species: Species) => void; endsAt: number; onFinish: () => void }) {
  const motion = useMotionEnabled();
  const askContinue = useAskContinue();
  const done = useRef(false);
  const index = labels.length;
  const image = images[Math.min(index, images.length - 1)];
  const lastImage = index > 0 ? images[index - 1] : null;
  const lastOk = lastImage !== null && labels[index - 1] === lastImage.species;

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    askContinue(onFinish, 'Tiempo agotado · Seguir');
  }, [askContinue, onFinish]);
  useGameTimeout(endsAt, timeout);

  function label(species: Species) {
    if (done.current || index >= images.length) return;
    onLabel(species);
    if (species === image.species) void feedbackSuccess();
    else void feedbackWarning();
    if (index + 1 >= images.length) {
      done.current = true;
      onFinish();
    }
  }

  return (
    <View style={styles.stage}>
      <GameBoard style={styles.photoBoard}>
        <View style={styles.photoHead}>
          <TelText variant="small" color="accentSoft">
            {`FOTO ${Math.min(index + 1, images.length)} DE ${images.length}`}
          </TelText>
          {lastImage ? (
            <Animated.View key={lastImage.id} entering={motion ? FadeIn.duration(160) : undefined} style={[styles.lastChip, { backgroundColor: lastOk ? colors.success : colors.danger }]}>
              <TelIcon name={lastOk ? 'check' : 'close'} size={14} color={colors.white} />
              <TelText variant="small" color="white">
                {`Era ${lastImage.species}`}
              </TelText>
            </Animated.View>
          ) : null}
        </View>
        <FitBox maxHeight={260}>
          {({ width, height }) => {
            const size = Math.max(48, Math.min(width, height));
            return (
              <Animated.View key={image.id} entering={motion ? ZoomIn.duration(160) : undefined} style={[styles.photo, { width: size, height: size }]}>
                <PixelGrid pixels={image.pixels} size={size - 6} />
              </Animated.View>
            );
          }}
        </FitBox>
        <View style={styles.dots}>
          {images.map((item, position) => (
            <View key={item.id} style={[styles.dot, position < index && styles.dotDone, position === index && styles.dotNow]} />
          ))}
        </View>
      </GameBoard>
      <View style={styles.choiceRow}>
        {(['gato', 'perro'] as Species[]).map((species) => (
          <PressableScale key={species} accessibilityRole="button" accessibilityLabel={`Etiquetar como ${species}`} onPress={() => label(species)} scaleTo={0.94} style={styles.choice}>
            <SpeciesIcon species={species} />
            <TelText variant="heading" color="cream">
              {species === 'gato' ? 'Gato' : 'Perro'}
            </TelText>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

// ——— Etapa 2: filtros ———

const FILTERS: { kind: FilterKind; label: string }[] = [
  { kind: 'original', label: 'Original' },
  { kind: 'bordes', label: 'Bordes' },
  { kind: 'desenfoque', label: 'Desenfoque' },
];

function FilterStage({ image, chosen, onChoose, endsAt, onFinish }: { image: PixelImage; chosen: FilterKind | null; onChoose: (kind: FilterKind) => void; endsAt: number; onFinish: () => void }) {
  const askContinue = useAskContinue();
  const done = useRef(false);
  const [closed, setClosed] = useState(false);
  const versions = useMemo(() => FILTERS.map((item) => ({ ...item, pixels: filtered(image, item.kind) })), [image]);

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setClosed(true);
    askContinue(onFinish, 'Tiempo agotado · Seguir');
  }, [askContinue, onFinish]);
  useGameTimeout(endsAt, timeout);

  function choose(kind: FilterKind) {
    if (done.current) return;
    done.current = true;
    setClosed(true);
    onChoose(kind);
    if (kind === 'bordes') void feedbackSuccess();
    else void feedbackWarning();
    askContinue(onFinish);
  }

  const hint = chosen ? filterFeedback[chosen] : closed ? 'Se acabó el tiempo: los bordes muestran mejor la forma.' : 'Fíjate en cuál deja ver bien las orejas y el hocico.';
  return (
    <View style={styles.stage}>
      <TelText variant="label" color="cream" align="center">
        ¿Cuál muestra mejor la forma del animal?
      </TelText>
      <FitBox maxHeight={200}>
        {({ width, height }) => {
          const gap = 6;
          const cell = Math.max(40, Math.floor(Math.min((width - 2 * gap) / 3, height - 30)));
          return (
            <View style={[styles.filterRow, { width: cell * 3 + 2 * gap, gap }]}>
              {versions.map((version) => {
                const isBest = version.kind === 'bordes';
                const isPick = chosen === version.kind;
                return (
                  <PressableScale
                    key={version.kind}
                    accessibilityRole="button"
                    accessibilityLabel={`Filtro ${version.label}`}
                    disabled={closed}
                    onPress={() => choose(version.kind)}
                    style={[styles.filterCard, { width: cell }, isPick && styles.filterPicked, closed && isBest && styles.filterBest]}
                  >
                    <PixelGrid pixels={version.pixels} size={cell - 16} />
                    <TelText variant="small" color="cream" numberOfLines={1}>
                      {version.label}
                    </TelText>
                    {closed && (isBest || isPick) ? (
                      <View style={[styles.filterBadge, { backgroundColor: isBest ? colors.success : colors.danger }]}>
                        <TelIcon name={isBest ? 'check' : 'close'} size={14} color={colors.white} />
                      </View>
                    ) : null}
                  </PressableScale>
                );
              })}
            </View>
          );
        }}
      </FitBox>
      <Hint tone={chosen ? (chosen === 'bordes' ? 'good' : 'bad') : closed ? 'bad' : 'info'}>{hint}</Hint>
    </View>
  );
}

// ——— Etapa 3: entrenar ———

function Chart({ width, height, shown, best, stopped }: { width: number; height: number; shown: number; best: number; stopped: number | null }) {
  const x = (value: number) => 14 + (value / EPOCHS) * 272;
  const y = (loss: number) => 8 + (1 - clamp(loss / 1.3, 0, 1)) * 122;
  const line = (fn: (value: number) => number, upTo: number) => Array.from({ length: upTo + 1 }, (_, value) => `${x(value)},${y(fn(value))}`).join(' ');
  const validation = (value: number) => validationLoss(value, best);
  return (
    <Svg width={width} height={height} viewBox="0 0 300 150">
      <Line x1={14} y1={134} x2={286} y2={134} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={1.5} />
      {stopped !== null && <Polyline points={line(validation, EPOCHS)} fill="none" stroke={ACCENT} strokeOpacity={0.3} strokeWidth={3} strokeDasharray="4 4" />}
      <Polyline points={line(trainLoss, shown)} fill="none" stroke={colors.accent} strokeWidth={3} strokeLinejoin="round" />
      <Polyline points={line(validation, shown)} fill="none" stroke={ACCENT} strokeWidth={3} strokeLinejoin="round" />
      {stopped !== null && <Line x1={x(stopped)} y1={6} x2={x(stopped)} y2={134} stroke={colors.cream} strokeDasharray="5 5" strokeWidth={2} />}
      {stopped !== null && <Circle cx={x(best)} cy={y(validation(best))} r={6} fill="#6BC59A" stroke={colors.white} strokeWidth={2} />}
    </Svg>
  );
}

function TrainStage({ best, stopped, onStop, endsAt, onFinish }: { best: number; stopped: number | null; onStop: (epoch: number) => void; endsAt: number; onFinish: () => void }) {
  const pace = usePace();
  const askContinue = useAskContinue();
  const done = useRef(false);
  // El entrenamiento avanza con el reloj del juego: en pausa se detiene y al volver sigue donde iba.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const step = Math.round(EPOCH_MS * pace);
  const running = startedAt !== null && stopped === null;
  const now = useNow(running, 100);
  const epoch = stopped ?? (startedAt === null ? 0 : clamp(Math.floor((now - startedAt) / step), 0, EPOCHS));

  const stop = useCallback(
    (at: number) => {
      if (done.current) return;
      done.current = true;
      onStop(at);
      if (stopVerdict(at, best).tone === 'good') void feedbackSuccess();
      else void feedbackWarning();
      askContinue(onFinish);
    },
    [askContinue, best, onFinish, onStop],
  );
  const epochNow = () => (startedAt === null ? 0 : clamp(Math.floor((gameNow() - startedAt) / step), 0, EPOCHS));

  // Al llegar a la última época el entrenamiento termina solo.
  useGameTimeout(running && startedAt !== null ? startedAt + EPOCHS * step : null, () => stop(EPOCHS));
  // Si se acaba el tiempo de la etapa, queda lo entrenado hasta ahora.
  useGameTimeout(endsAt, () => stop(epochNow()));

  const verdict = stopped !== null ? stopVerdict(stopped, best) : null;
  return (
    <View style={styles.stage}>
      <GameBoard style={styles.chartBoard}>
        <FitBox aspectRatio={2} maxHeight={220}>
          {({ width, height }) => <Chart width={width} height={height} shown={epoch} best={best} stopped={stopped} />}
        </FitBox>
      </GameBoard>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
        <TelText variant="caption" color="cream">
          Entrenamiento (fotos que ya vio)
        </TelText>
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
        <TelText variant="caption" color="cream">
          Validación (fotos nuevas)
        </TelText>
      </View>
      <View style={styles.epochRow}>
        <TelText variant="heading" color="cream" tabular>
          {`Época ${epoch}/${EPOCHS}`}
        </TelText>
        {stopped === null ? (
          <TelButton
            label={running ? 'Detener aquí' : 'Entrenar'}
            variant={running ? 'danger' : 'cream'}
            icon={running ? 'pause' : 'play'}
            fullWidth={false}
            style={styles.trainButton}
            onPress={() => {
              if (startedAt === null) {
                setStartedAt(gameNow());
                void feedbackTap();
                return;
              }
              stop(epochNow());
            }}
          />
        ) : null}
      </View>
      <Hint tone={verdict ? verdict.tone : 'info'}>{verdict ? verdict.text : running ? 'Mira la curva morada: cuando deje de bajar, ¡detén!' : 'Pulsa Entrenar y mira cómo cambian las dos curvas.'}</Hint>
    </View>
  );
}

// ——— Prueba con fotos nuevas ———

function TestStage({ images, outcome, filter, onDone }: { images: PixelImage[]; outcome: { correct: number; wrong: number }; filter: FilterKind; onDone: () => void }) {
  const motion = useMotionEnabled();
  const [revealed, setRevealed] = useState(0);
  const askContinue = useAskContinue();
  // El modelo falla en las últimas fotos que evalúa, tantas como errores le tocan.
  const wrong = useMemo(() => new Set(images.slice(images.length - outcome.wrong).map((item) => item.id)), [images, outcome.wrong]);

  useEffect(() => {
    if (revealed >= images.length) {
      askContinue(onDone, 'Ver resultado');
      return;
    }
    const timer = setTimeout(() => setRevealed((value) => value + 1), 420);
    return () => clearTimeout(timer);
  }, [askContinue, images.length, onDone, revealed]);

  return (
    <View style={styles.root}>
      <View style={styles.testHead}>
        <TelText variant="overline" color="accent" align="center">
          Prueba con fotos nuevas
        </TelText>
        <TelText variant="title" color="cream" align="center" tabular>
          {`${outcome.correct} de ${images.length} bien`}
        </TelText>
      </View>
      <FitBox>
        {({ width, height }) => {
          const gap = 6;
          const cols = 3;
          const cellW = Math.floor((width - (cols - 1) * gap) / cols);
          const cellH = Math.floor((height - gap) / 2);
          const pixels = Math.max(28, Math.min(cellW - 4, cellH - 26));
          return (
            <View style={[styles.testGrid, { width: cols * cellW + (cols - 1) * gap, gap }]}>
              {images.map((image, index) => {
                const shown = index < revealed;
                const ok = !wrong.has(image.id);
                return (
                  <View key={image.id} style={[styles.testCell, { width: cellW }]}>
                    <PixelGrid pixels={filtered(image, filter)} size={pixels} />
                    {shown ? (
                      <Animated.View entering={motion ? FadeInDown.duration(200) : undefined} style={[styles.testTag, { backgroundColor: ok ? colors.success : colors.danger }]}>
                        <TelIcon name={ok ? 'check' : 'close'} size={14} color={colors.white} />
                        <TelText variant="small" color="white" numberOfLines={1}>
                          {ok ? image.species : `Era ${image.species}`}
                        </TelText>
                      </Animated.View>
                    ) : (
                      <View style={styles.testTagSpace} />
                    )}
                  </View>
                );
              })}
            </View>
          );
        }}
      </FitBox>
      <Hint>El conjunto de prueba mide si el modelo funciona con fotos que nunca vio.</Hint>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  photoBoard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.xs,
    gap: 4,
  },
  photoHead: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 22,
  },
  lastChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.pill,
  },
  photo: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.cream,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dotDone: {
    backgroundColor: ACCENT,
  },
  dotNow: {
    backgroundColor: colors.cream,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'row',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.secondary,
    borderWidth: 1.5,
    borderColor: 'rgba(167,212,237,0.35)',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  filterCard: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterPicked: {
    borderColor: colors.cream,
    backgroundColor: colors.secondary,
  },
  filterBest: {
    borderColor: colors.success,
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartBoard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  epochRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  trainButton: {
    minWidth: 170,
  },
  testHead: {
    gap: 2,
  },
  testGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  testCell: {
    alignItems: 'center',
    gap: 4,
  },
  testTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  testTagSpace: {
    height: 22,
  },
});
