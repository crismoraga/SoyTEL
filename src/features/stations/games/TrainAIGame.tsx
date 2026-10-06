import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { mulberry32 } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import { clamp, GameBoard, Hint, StageBanner, StationHud, StationSummary, useAskContinue, useNow, usePace, type StationGameProps } from '../kit';
import {
  bestEpoch,
  EPOCHS,
  FILTER_MAX,
  filtered,
  filterFactor,
  filterFeedback,
  GRID,
  LABEL_MAX,
  makeDataset,
  makeImage,
  modelAccuracy,
  modelQuality,
  stopQuality,
  TRAIN_MAX,
  trainLoss,
  validationLoss,
  type FilterKind,
  type PixelImage,
  type Species,
} from '../logic/vision';

type StageKey = 'label' | 'filter' | 'train' | 'test';

const STAGES: { key: StageKey; title: string; body: string; icon: IconName; seconds: number }[] = [
  {
    key: 'label',
    title: 'Etiqueta los datos',
    body: 'Un modelo aprende de ejemplos con su respuesta. Marca cada imagen como gato o perro: ¡sin errores!',
    icon: 'image',
    seconds: 24,
  },
  {
    key: 'filter',
    title: 'Procesa las imágenes',
    body: 'Antes de entrenar se aplican filtros. ¿Cuál deja ver mejor la forma del animal?',
    icon: 'eye',
    seconds: 14,
  },
  {
    key: 'train',
    title: 'Entrena el modelo',
    body: 'Mira las curvas de error. Detén el entrenamiento cuando la validación deje de bajar, antes del sobreajuste.',
    icon: 'neural',
    seconds: 20,
  },
];

const ACCENT = '#9B8AE6';
const LABEL_COUNT = 10;
const TEST_COUNT = 6;

const PixelGrid = memo(function PixelGrid({ pixels, size }: { pixels: string[]; size: number }) {
  const cell = size / GRID;
  return (
    <Svg width={size} height={size}>
      {pixels.map((color, index) => (
        <Rect key={index} x={(index % GRID) * cell} y={Math.floor(index / GRID) * cell} width={cell + 0.3} height={cell + 0.3} fill={color} />
      ))}
    </Svg>
  );
});

// B213 · Datos: etiquetar, filtrar, entrenar y probar un clasificador de imágenes.
export function TrainAIGame({ seed, onComplete }: StationGameProps) {
  const pace = usePace();
  const [random] = useState(() => mulberry32(seed ^ 0xda7a));
  const [dataset] = useState(() => makeDataset(LABEL_COUNT, random));
  const [testSet] = useState(() => makeDataset(TEST_COUNT, random, 100));
  const [best] = useState(() => bestEpoch(random));
  const [stageIndex, setStageIndex] = useState(0);
  const [banner, setBanner] = useState(true);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [labels, setLabels] = useState<Species[]>([]);
  const [filter, setFilter] = useState<FilterKind | null>(null);
  const [stopEpoch, setStopEpoch] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [finished, setFinished] = useState(false);
  const now = useNow(endsAt !== null, 250);
  const stageToken = useRef(0);
  const stage = STAGES[stageIndex];

  const labelAccuracy = labels.filter((label, index) => label === dataset[index].species).length / LABEL_COUNT;
  const chosenFilter = filter ?? 'original';
  const trainQuality = stopEpoch === null ? 0 : stopQuality(stopEpoch, best);
  const quality = modelQuality(labelAccuracy, chosenFilter, trainQuality);
  const labelPoints = Math.round(labelAccuracy * LABEL_MAX);
  const filterPoints = filter ? Math.round(filterFactor[filter] * FILTER_MAX) : 0;
  const trainPoints = Math.round(trainQuality * TRAIN_MAX);
  const total = labelPoints + (stageIndex > 1 || testing || finished ? filterPoints : 0) + (testing || finished ? trainPoints : 0);

  const startStage = useCallback(() => {
    setBanner(false);
    setEndsAt(Date.now() + STAGES[stageIndex].seconds * pace * 1000);
  }, [pace, stageIndex]);

  const askContinue = useAskContinue();
  // Mientras el jugador lee la explicación de la etapa, su reloj no la cierra.
  const [waiting, setWaiting] = useState(false);

  const nextStage = useCallback(() => {
    stageToken.current += 1;
    setWaiting(false);
    setEndsAt(null);
    if (stageIndex < STAGES.length - 1) {
      setStageIndex(stageIndex + 1);
      setBanner(true);
    } else {
      setTesting(true);
    }
  }, [stageIndex]);

  // Avanza cuando el jugador toca "Continuar", salvo que la etapa ya haya cambiado.
  const advanceWhenReady = useCallback(() => {
    const token = stageToken.current;
    setWaiting(true);
    askContinue(() => {
      if (stageToken.current === token) nextStage();
    });
  }, [askContinue, nextStage]);

  const handleStop = useCallback(
    (epoch: number) => {
      setStopEpoch(epoch);
      advanceWhenReady();
    },
    [advanceWhenReady],
  );
  const handleTestDone = useCallback(() => setFinished(true), []);

  // Al agotarse el tiempo de la etapa se toma lo que haya.
  useEffect(() => {
    if (endsAt === null || waiting) return;
    const timer = setTimeout(() => {
      if (stage.key === 'train' && stopEpoch === null) setStopEpoch(EPOCHS);
      nextStage();
    }, Math.max(0, endsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [endsAt, nextStage, stage.key, stopEpoch, waiting]);

  if (finished) {
    const accuracy = modelAccuracy(quality);
    return (
      <StationSummary
        title="Entrena la IA"
        total={labelPoints + filterPoints + trainPoints}
        message={`Tu modelo acertó ${Math.round(accuracy * 100)}% en imágenes nuevas.`}
        accent={ACCENT}
        rows={[
          { label: 'Datos bien etiquetados', value: labelPoints, max: LABEL_MAX, icon: 'image' },
          { label: 'Filtro elegido', value: filterPoints, max: FILTER_MAX, icon: 'eye' },
          { label: 'Momento de detener', value: trainPoints, max: TRAIN_MAX, icon: 'neural' },
        ]}
        learned="Un modelo de machine learning aprende de datos etiquetados: si las etiquetas están mal, aprende mal. Filtros como la detección de bordes resaltan formas, y hay que detener el entrenamiento antes del sobreajuste."
        onSubmit={() => onComplete({ score: labelPoints + filterPoints + trainPoints, accuracy })}
      />
    );
  }

  if (testing) {
    return <TestStage images={testSet} accuracy={modelAccuracy(quality)} filter={chosenFilter} onDone={handleTestDone} />;
  }

  const secondsLeft = endsAt && !waiting ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  return (
    <View style={styles.container}>
      <StationHud stage={stageIndex + 1} stages={STAGES.length} title={stage.title} score={total} secondsLeft={secondsLeft} totalSeconds={Math.round(stage.seconds * pace)} accent={ACCENT} />
      {endsAt && stage.key === 'label' && (
        <LabelStage
          images={dataset}
          labels={labels}
          onLabel={(species) => {
            const next = [...labels, species];
            setLabels(next);
            void feedbackTap();
            if (next.length >= LABEL_COUNT) nextStage();
          }}
        />
      )}
      {endsAt && stage.key === 'filter' && (
        <FilterStage
          image={dataset[0]}
          chosen={filter}
          onChoose={(kind) => {
            setFilter(kind);
            void feedbackSuccess();
            advanceWhenReady();
          }}
        />
      )}
      {endsAt && stage.key === 'train' && (
        <TrainStage
          best={best}
          stopped={stopEpoch}
          onStop={handleStop}
        />
      )}
      {banner && <StageBanner key={stage.key} index={stageIndex + 1} title={stage.title} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={startStage} />}
      {banner && <View style={styles.bannerSpace} />}
    </View>
  );
}

function SpeciesIcon({ species }: { species: Species }) {
  const [image] = useState(() => makeImage(0, species, () => 0));
  return <PixelGrid pixels={image.pixels} size={40} />;
}

function LabelStage({ images, labels, onLabel }: { images: PixelImage[]; labels: Species[]; onLabel: (species: Species) => void }) {
  const index = labels.length;
  const image = images[Math.min(index, images.length - 1)];
  return (
    <View style={styles.stageGap}>
      <GameBoard style={styles.centerBoard}>
        <TelText variant="small" color="accentSoft">
          IMAGEN {Math.min(index + 1, images.length)} DE {images.length}
        </TelText>
        <Animated.View key={image.id} entering={ZoomIn.duration(180)} style={styles.photo}>
          <PixelGrid pixels={image.pixels} size={176} />
        </Animated.View>
        <View style={styles.dots}>
          {images.map((item, position) => (
            <View key={item.id} style={[styles.dot, position < index && styles.dotDone, position === index && styles.dotNow]} />
          ))}
        </View>
      </GameBoard>
      <View style={styles.choiceRow}>
        {(['gato', 'perro'] as Species[]).map((species) => (
          <PressableScale
            key={species}
            accessibilityRole="button"
            accessibilityLabel={`Etiquetar como ${species}`}
            onPress={() => onLabel(species)}
            scaleTo={0.93}
            style={styles.choice}
          >
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

const FILTERS: { kind: FilterKind; label: string }[] = [
  { kind: 'original', label: 'Original' },
  { kind: 'bordes', label: 'Bordes' },
  { kind: 'desenfoque', label: 'Desenfoque' },
];

function FilterStage({ image, chosen, onChoose }: { image: PixelImage; chosen: FilterKind | null; onChoose: (kind: FilterKind) => void }) {
  const versions = useMemo(() => FILTERS.map((item) => ({ ...item, pixels: filtered(image, item.kind) })), [image]);
  return (
    <View style={styles.stageGap}>
      <View style={styles.filterRow}>
        {versions.map((version) => {
          const active = chosen === version.kind;
          return (
            <PressableScale
              key={version.kind}
              accessibilityRole="button"
              accessibilityLabel={`Filtro ${version.label}`}
              disabled={chosen !== null}
              onPress={() => onChoose(version.kind)}
              style={[styles.filterCard, active && styles.filterActive]}
            >
              <PixelGrid pixels={version.pixels} size={92} />
              <TelText variant="label" color="cream">
                {version.label}
              </TelText>
            </PressableScale>
          );
        })}
      </View>
      <Hint tone={chosen ? (chosen === 'bordes' ? 'good' : 'bad') : 'info'}>
        {chosen ? filterFeedback[chosen] : 'El filtro de bordes aplica la matriz de Sobel a cada píxel: calcula cuánto cambia la intensidad a su alrededor.'}
      </Hint>
    </View>
  );
}

const CHART_H = 170;

function TrainStage({ best, stopped, onStop }: { best: number; stopped: number | null; onStop: (epoch: number) => void }) {
  const [running, setRunning] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [width, setWidth] = useState(0);
  const stoppedRef = useRef(false);
  const pace = usePace();
  const onStopRef = useRef(onStop);
  useLayoutEffect(() => {
    onStopRef.current = onStop;
  });

  // El intervalo no depende de callbacks del padre para no reiniciarse en cada render.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setEpoch((value) => {
        const next = Math.min(EPOCHS, value + 1);
        if (next >= EPOCHS && !stoppedRef.current) {
          stoppedRef.current = true;
          setTimeout(() => onStopRef.current(EPOCHS), 0);
        }
        return next;
      });
    }, Math.round(300 * pace));
    return () => clearInterval(timer);
  }, [pace, running]);

  const shown = stopped ?? epoch;
  const x = (value: number) => 12 + (value / EPOCHS) * (width - 24);
  const y = (loss: number) => 12 + (1 - clamp(loss / 1.3, 0, 1)) * (CHART_H - 24);
  const points = (fn: (value: number) => number) =>
    Array.from({ length: shown + 1 }, (_, value) => `${x(value)},${y(fn(value))}`).join(' ');

  return (
    <View style={styles.stageGap}>
      <GameBoard>
        <View style={{ height: CHART_H }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
          {width > 0 && (
            <Svg width={width} height={CHART_H}>
              <Line x1={12} y1={CHART_H - 12} x2={width - 12} y2={CHART_H - 12} stroke={colors.accentSoft} strokeOpacity={0.4} />
              <Polyline points={points(trainLoss)} fill="none" stroke={colors.accent} strokeWidth={3} strokeLinejoin="round" />
              <Polyline points={points((value) => validationLoss(value, best))} fill="none" stroke={ACCENT} strokeWidth={3} strokeLinejoin="round" />
              {stopped !== null && <Line x1={x(stopped)} y1={10} x2={x(stopped)} y2={CHART_H - 12} stroke={colors.cream} strokeDasharray="5 5" strokeWidth={2} />}
            </Svg>
          )}
        </View>
      </GameBoard>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
        <TelText variant="caption" color="cream">
          Error de entrenamiento
        </TelText>
        <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
        <TelText variant="caption" color="cream">
          Error de validación
        </TelText>
      </View>
      <View style={styles.epochRow}>
        <TelText variant="heading" color="cream" tabular>
          Época {shown}/{EPOCHS}
        </TelText>
        {stopped === null ? (
          <TelButton
            label={running ? 'Detener aquí' : 'Entrenar'}
            variant={running ? 'danger' : 'cream'}
            icon={running ? 'pause' : 'play'}
            fullWidth={false}
            onPress={() => {
              if (!running) {
                setRunning(true);
                return;
              }
              stoppedRef.current = true;
              setRunning(false);
              onStop(epoch);
            }}
          />
        ) : null}
      </View>
      {stopped !== null && (
        <Hint tone={Math.abs(stopped - best) <= 3 ? 'good' : 'bad'}>
          {Math.abs(stopped - best) <= 3
            ? '¡Justo a tiempo! La validación estaba en su mínimo.'
            : stopped < best
              ? 'Muy pronto: el modelo todavía podía aprender más.'
              : 'Muy tarde: la validación subió, el modelo memorizó los datos (sobreajuste).'}
        </Hint>
      )}
    </View>
  );
}

function TestStage({ images, accuracy, filter, onDone }: { images: PixelImage[]; accuracy: number; filter: FilterKind; onDone: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const wrongCount = images.length - Math.round(accuracy * images.length);
  // El modelo falla en las últimas imágenes que evalúa, según su precisión.
  const wrong = new Set(images.slice(images.length - wrongCount).map((image) => image.id));

  const askContinue = useAskContinue();
  useEffect(() => {
    if (revealed >= images.length) {
      askContinue(onDone, 'Ver resultado');
      return;
    }
    const timer = setTimeout(() => setRevealed((value) => value + 1), 420);
    return () => clearTimeout(timer);
  }, [askContinue, images.length, onDone, revealed]);

  return (
    <View style={styles.container}>
      <TelText variant="overline" color="accent" align="center">
        Prueba con imágenes nuevas
      </TelText>
      <TelText variant="title" color="cream" align="center" tabular>
        {Math.round(accuracy * 100)}% de precisión
      </TelText>
      <View style={styles.testGrid}>
        {images.map((image, index) => {
          const shown = index < revealed;
          const ok = !wrong.has(image.id);
          const predicted = ok ? image.species : image.species === 'gato' ? 'perro' : 'gato';
          return (
            <View key={image.id} style={styles.testCell}>
              <PixelGrid pixels={filtered(image, filter)} size={82} />
              {shown && (
                <Animated.View entering={FadeInDown.duration(200)} style={[styles.testTag, { backgroundColor: ok ? colors.success : colors.danger }]}>
                  <TelIcon name={ok ? 'check' : 'close'} size={14} color={colors.white} />
                  <TelText variant="small" color="white">
                    {predicted}
                  </TelText>
                </Animated.View>
              )}
            </View>
          );
        })}
      </View>
      <Animated.View entering={FadeIn.delay(600)}>
        <Hint>El conjunto de prueba mide si el modelo generaliza a imágenes que nunca vio.</Hint>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    minHeight: 480,
  },
  bannerSpace: {
    height: 420,
  },
  stageGap: {
    gap: spacing.sm,
  },
  centerBoard: {
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
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
    minHeight: 96,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    borderWidth: 1.5,
    borderColor: 'rgba(167,212,237,0.35)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  filterCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterActive: {
    borderColor: colors.cream,
    backgroundColor: colors.secondary,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
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
  testGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  testCell: {
    alignItems: 'center',
    gap: 4,
    width: 96,
  },
  testTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.pill,
  },
});
