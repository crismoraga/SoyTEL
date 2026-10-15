import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { mulberry32, seededShuffle } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import { StageBanner, StationHud, StationSummary, clamp, useDeadline, useGameTimeout, useNow, usePace, useStageFlow, useSubmitOnce, type StationGameProps } from '../kit';

// Motor de los juegos de los proyectos de B213: cada juego son tres etapas cortas, de preguntas con un
// dibujo (lecturas, pantallas, redes Wi-Fi…) o de ajustar un valor con − / +. Nada depende del ritmo
// de los dedos: se puntúa lo que se elige.

export interface ProjectQuestion {
  // El dibujo o los datos que hay que mirar (se dibuja con piezas simples).
  visual?: ReactNode;
  prompt: string;
  options: string[];
  // Índice de la opción correcta en `options` (antes de mezclar).
  answer: number;
  // Por qué, en una línea (se muestra después de responder).
  why: string;
}

export type ProjectStage =
  | { kind: 'quiz'; key: string; title: string; goal: string; body: string; icon: IconName; seconds: number; label: string; questions: (random: () => number) => ProjectQuestion[] }
  | {
      kind: 'dial';
      key: string;
      title: string;
      goal: string;
      body: string;
      icon: IconName;
      seconds: number;
      label: string;
      unit: string;
      min: number;
      max: number;
      step: number;
      start: number;
      // Rango aceptado (incluido).
      target: [number, number];
      // Dibujo según el valor actual.
      visual: (value: number) => ReactNode;
      // Mensaje según el valor (qué está pasando).
      status: (value: number) => string;
    };

export interface ProjectSpec {
  title: string;
  accent: string;
  learned: string;
  stages: ProjectStage[];
}

const STAGE_MAX = [333, 333, 334];

export function ProjectGame({ spec, seed, deadline, onComplete }: StationGameProps & { spec: ProjectSpec }) {
  const pace = usePace();
  const seconds = useMemo(() => spec.stages.map((stage) => stage.seconds), [spec]);
  const flow = useStageFlow(seconds, pace);
  const [points, setPoints] = useState<number[]>(() => spec.stages.map(() => 0));
  const now = useNow(flow.endsAt !== null, 250);
  const stage = spec.stages[flow.index];
  const total = points.reduce((sum, value) => sum + value, 0);
  const submit = useSubmitOnce(onComplete);
  useDeadline(deadline, () => submit({ score: total, accuracy: clamp(total / 1000, 0, 1) }));

  const setStagePoints = useCallback((index: number, value: number) => {
    setPoints((current) => (current[index] === value ? current : current.map((item, at) => (at === index ? value : item))));
  }, []);

  if (flow.finished) {
    return (
      <StationSummary
        title={spec.title}
        total={total}
        message={total >= 800 ? '¡Proyecto funcionando!' : total >= 450 ? '¡Bien! El prototipo ya responde.' : 'Buen intento: así se aprende en el laboratorio.'}
        accent={spec.accent}
        rows={spec.stages.map((item, index) => ({ label: item.label, value: points[index], max: STAGE_MAX[index] ?? 333, icon: item.icon }))}
        learned={spec.learned}
        onSubmit={() => submit({ score: total, accuracy: clamp(total / 1000, 0, 1) })}
      />
    );
  }

  const stageSeconds = Math.round(stage.seconds * pace);
  const secondsLeft = flow.endsAt !== null ? clamp(Math.ceil((flow.endsAt - now) / 1000), 0, stageSeconds) : null;
  const max = STAGE_MAX[flow.index] ?? 333;

  return (
    <View style={styles.root}>
      <StationHud stage={flow.index + 1} stages={spec.stages.length} title={stage.title} score={total} secondsLeft={secondsLeft} totalSeconds={stageSeconds} accent={spec.accent} />
      {flow.endsAt !== null && stage.kind === 'quiz' && (
        <QuizStage key={stage.key} stage={stage} seed={seed + flow.index * 101} endsAt={flow.endsAt} max={max} accent={spec.accent} onPoints={(value) => setStagePoints(flow.index, value)} onFinish={() => flow.finish(flow.index)} />
      )}
      {flow.endsAt !== null && stage.kind === 'dial' && (
        <DialStage key={stage.key} stage={stage} endsAt={flow.endsAt} max={max} accent={spec.accent} onPoints={(value) => setStagePoints(flow.index, value)} onFinish={() => flow.finish(flow.index)} />
      )}
      {flow.banner && <StageBanner key={stage.key} index={flow.index + 1} title={stage.title} goal={stage.goal} body={stage.body} icon={stage.icon} accent={spec.accent} onDone={flow.start} />}
    </View>
  );
}

// ——— Preguntas ———

function QuizStage({ stage, seed, endsAt, max, accent, onPoints, onFinish }: { stage: Extract<ProjectStage, { kind: 'quiz' }>; seed: number; endsAt: number; max: number; accent: string; onPoints: (value: number) => void; onFinish: () => void }) {
  const questions = useMemo(() => {
    const random = mulberry32(seed);
    return stage.questions(random).map((question) => {
      const order = seededShuffle(question.options.map((_, index) => index), random);
      return { ...question, order };
    });
  }, [seed, stage]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const done = useRef(false);
  const question = questions[index];

  const end = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onFinish();
  }, [onFinish]);
  useGameTimeout(endsAt, end);

  function choose(option: number) {
    if (picked !== null || done.current) return;
    setPicked(option);
    const ok = option === question.answer;
    const nextRight = right + (ok ? 1 : 0);
    if (ok) {
      void feedbackSuccess();
      setRight(nextRight);
    } else {
      void feedbackWarning();
    }
    onPoints(Math.round((nextRight / questions.length) * max));
  }

  function next() {
    void feedbackTap();
    if (index + 1 >= questions.length) {
      end();
      return;
    }
    setIndex(index + 1);
    setPicked(null);
  }

  if (!question) return null;
  const answered = picked !== null;
  const ok = picked === question.answer;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.stage} keyboardShouldPersistTaps="handled">
      <TelText variant="caption" color="accentSoft" align="center">
        {index + 1} de {questions.length}
      </TelText>
      {question.visual ? <View style={styles.visual}>{question.visual}</View> : null}
      <TelText variant="bodyStrong" color="cream" align="center">
        {question.prompt}
      </TelText>
      <View style={styles.options}>
        {question.order.map((option) => {
          const isAnswer = option === question.answer;
          const state = !answered ? 'idle' : isAnswer ? 'right' : option === picked ? 'wrong' : 'dim';
          return (
            <PressableScale
              key={option}
              accessibilityRole="button"
              accessibilityLabel={question.options[option]}
              accessibilityState={{ disabled: answered }}
              disabled={answered}
              onPress={() => choose(option)}
              style={[styles.option, state === 'right' && styles.right, state === 'wrong' && styles.wrong, state === 'dim' && styles.dim, !answered && { borderColor: accent }]}
            >
              <TelText variant="bodyStrong" color="cream" style={styles.optionText}>
                {question.options[option]}
              </TelText>
              {state === 'right' && <TelIcon name="checkCircle" size={22} color={colors.white} />}
              {state === 'wrong' && <TelIcon name="closeCircle" size={22} color={colors.white} />}
            </PressableScale>
          );
        })}
      </View>
      {answered && (
        <Animated.View entering={FadeIn.duration(160)} style={[styles.why, { backgroundColor: ok ? '#1F5E43' : '#6E2A2A' }]}>
          <TelText variant="caption" color="cream" align="center">
            {ok ? '¡Bien! ' : 'Ojo: '}
            {question.why}
          </TelText>
          <TelButton label={index + 1 >= questions.length ? 'Terminar etapa' : 'Siguiente'} variant="cream" size="md" iconRight="arrowRight" onPress={next} />
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ——— Ajustar un valor ———

function DialStage({ stage, endsAt, max, accent, onPoints, onFinish }: { stage: Extract<ProjectStage, { kind: 'dial' }>; endsAt: number; max: number; accent: string; onPoints: (value: number) => void; onFinish: () => void }) {
  const [value, setValue] = useState(stage.start);
  const [tries, setTries] = useState(0);
  const [locked, setLocked] = useState(false);
  const [miss, setMiss] = useState(false);
  const done = useRef(false);
  const inside = value >= stage.target[0] && value <= stage.target[1];

  const end = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onFinish();
  }, [onFinish]);
  useGameTimeout(endsAt, end);

  function move(delta: number) {
    if (locked) return;
    void feedbackTap();
    setMiss(false);
    setValue((current) => clamp(current + delta, stage.min, stage.max));
  }

  function check() {
    if (locked) return;
    if (inside) {
      void feedbackSuccess();
      setLocked(true);
      onPoints(Math.round(max * Math.max(0.4, 1 - tries * 0.2)));
    } else {
      void feedbackWarning();
      setTries(tries + 1);
      setMiss(true);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.stage}>
      <View style={styles.visual}>{stage.visual(value)}</View>
      <TelText variant="bodyStrong" color="cream" align="center">
        {stage.status(value)}
      </TelText>
      <View style={styles.dialRow}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Bajar" onPress={() => move(-stage.step)} style={[styles.dialButton, { borderColor: accent }]} disabled={locked}>
          <TelIcon name="minus" size={28} color={colors.cream} />
        </PressableScale>
        <View style={styles.dialValue}>
          <TelText variant="title" color="cream" tabular>
            {value}
            {stage.unit}
          </TelText>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Subir" onPress={() => move(stage.step)} style={[styles.dialButton, { borderColor: accent }]} disabled={locked}>
          <TelIcon name="plus" size={28} color={colors.cream} />
        </PressableScale>
      </View>
      {locked ? (
        <Animated.View entering={ZoomIn.duration(220)} style={[styles.why, { backgroundColor: '#1F5E43' }]}>
          <TelText variant="caption" color="cream" align="center">
            ¡Calibrado! El prototipo quedó listo.
          </TelText>
          <TelButton label="Terminar etapa" variant="cream" size="md" iconRight="arrowRight" onPress={end} />
        </Animated.View>
      ) : (
        <>
          {miss && (
            <TelText variant="caption" color="dangerLight" align="center">
              Todavía no: mira cómo reacciona el prototipo y ajusta.
            </TelText>
          )}
          <TelButton label="Probar este valor" variant="cream" iconRight="check" onPress={check} />
        </>
      )}
    </ScrollView>
  );
}

// ——— Piezas de dibujo compartidas ———

export function Readings({ items }: { items: { icon: IconName; label: string; value: string; tone?: 'ok' | 'bad' | 'plain' }[] }) {
  return (
    <View style={styles.readings}>
      {items.map((item) => (
        <View key={item.label} style={[styles.reading, item.tone === 'bad' && styles.readingBad]}>
          <TelIcon name={item.icon} size={22} color={colors.accentSoft} />
          <TelText variant="caption" color="accentSoft">
            {item.label}
          </TelText>
          <TelText variant="subtitle" color="cream" tabular>
            {item.value}
          </TelText>
        </View>
      ))}
    </View>
  );
}

export function MiniBars({ values, labels, unit, highlight }: { values: number[]; labels: string[]; unit: string; highlight?: number }) {
  const top = Math.max(...values);
  return (
    <View style={styles.bars}>
      {values.map((value, index) => (
        <View key={labels[index]} style={styles.barColumn}>
          <TelText variant="caption" color="cream" tabular>
            {value}
            {unit}
          </TelText>
          <View style={[styles.bar, { height: 14 + (value / top) * 70 }, index === highlight && styles.barHot]} />
          <TelText variant="caption" color="accentSoft">
            {labels[index]}
          </TelText>
        </View>
      ))}
    </View>
  );
}

export function Panel({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'warn' }) {
  return <View style={[styles.panel, tone === 'warn' && styles.panelWarn]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.xs },
  flex: { flex: 1 },
  stage: { gap: spacing.sm, paddingBottom: spacing.md, paddingTop: spacing.xs },
  visual: { alignItems: 'center' },
  options: { gap: spacing.xs },
  option: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(167,212,237,0.35)',
    backgroundColor: 'rgba(167,212,237,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionText: { flex: 1 },
  right: { backgroundColor: '#2E8B62', borderColor: '#6BC59A' },
  wrong: { backgroundColor: '#9C3B3B', borderColor: '#E07A7A' },
  dim: { opacity: 0.45 },
  why: { borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
  dialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  dialButton: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(167,212,237,0.1)' },
  dialValue: { minWidth: 96, alignItems: 'center' },
  readings: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  reading: { minWidth: 96, alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(167,212,237,0.1)', gap: 2 },
  readingBad: { backgroundColor: 'rgba(224,122,122,0.25)' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.sm, height: 130 },
  barColumn: { alignItems: 'center', gap: 2 },
  bar: { width: 26, borderRadius: 6, backgroundColor: colors.accent },
  barHot: { backgroundColor: '#E07A7A' },
  panel: { alignSelf: 'stretch', borderRadius: radius.md, padding: spacing.sm, backgroundColor: 'rgba(167,212,237,0.1)', gap: spacing.xs },
  panelWarn: { backgroundColor: 'rgba(229,138,90,0.22)' },
});
