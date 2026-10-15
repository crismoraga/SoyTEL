import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { ChoiceTile, TileGrid, type TileState } from '@/features/burst/parts';
import { Bars, Mono, shuffleRound, type QuickGenerator } from '@/features/burst/quickpick';
import { getMicroGame } from '@/features/burst/registry';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { mulberry32, seededShuffle } from '@/route/random';
import { spacing } from '@/theme';
import type { RoundProps } from '../types';

// Rondas rápidas del circuito B215: preguntas con dibujo (hardware, telecomunicaciones, software) y
// "ráfagas relámpago" que juegan microjuegos de la Ráfaga TEL elegidos por la semilla: cada ruta
// toca otros.

const QUESTIONS = 4;

export function makeQuizRound(generators: QuickGenerator[]): ComponentType<RoundProps> {
  return function QuizRound({ seed, level, timeUp, onDone }: RoundProps) {
    const rounds = useMemo(() => {
      const random = mulberry32(seed);
      return Array.from({ length: QUESTIONS }, (_, index) => shuffleRound(generators[index % generators.length](level, random), random));
    }, [seed, level]);
    const [index, setIndex] = useState(0);
    const [picked, setPicked] = useState<number | null>(null);
    const [right, setRight] = useState(0);
    const done = useRef(false);
    const round = rounds[index];

    const finish = (correct: number, answered: number) => {
      if (done.current) return;
      done.current = true;
      onDone({ score: correct / QUESTIONS, accuracy: answered ? correct / answered : 0, detail: `${correct} de ${QUESTIONS} correctas` });
    };

    useEffect(() => {
      if (timeUp) finish(right, index + (picked === null ? 0 : 1));
    });

    function choose(option: number) {
      if (picked !== null || done.current) return;
      setPicked(option);
      if (option === round.answer) {
        void feedbackSuccess();
        setRight(right + 1);
      } else {
        void feedbackWarning();
      }
    }

    function next() {
      if (index + 1 >= QUESTIONS) {
        finish(right, QUESTIONS);
        return;
      }
      setIndex(index + 1);
      setPicked(null);
    }

    const state = (option: number): TileState => (picked === null ? 'idle' : option === round.answer ? 'correct' : option === picked ? 'wrong' : 'dimmed');
    return (
      <View style={styles.root}>
        <TelText variant="caption" color="accentSoft" align="center">
          Pregunta {index + 1} de {QUESTIONS}
        </TelText>
        {round.visual ? <View style={styles.visual}>{round.visual}</View> : null}
        <TelText variant="bodyStrong" color="cream" align="center">
          {round.prompt}
        </TelText>
        <TileGrid>
          {round.options.map((option, at) => (
            <ChoiceTile key={option} label={option} state={state(at)} disabled={picked !== null} onPress={() => choose(at)} />
          ))}
        </TileGrid>
        {picked !== null && (
          <View style={styles.after}>
            <TelText variant="caption" color={picked === round.answer ? 'cream' : 'dangerLight'} align="center">
              {picked === round.answer ? '¡Bien! ' : 'Ojo: '}
              {round.note}
            </TelText>
            <TelButton label={index + 1 >= QUESTIONS ? 'Terminar ronda' : 'Siguiente'} variant="cream" size="md" iconRight="arrowRight" onPress={next} />
          </View>
        )}
      </View>
    );
  };
}

const MICRO_COUNT = 3;

export function makeMicroRound(ids: string[]): ComponentType<RoundProps> {
  return function MicroRound({ seed, level, pace, timeUp, onDone }: RoundProps) {
    const games = useMemo(() => seededShuffle(ids, mulberry32(seed)).flatMap((id) => (getMicroGame(id) ? [getMicroGame(id)!] : [])).slice(0, MICRO_COUNT), [seed]);
    const [index, setIndex] = useState(0);
    const [results, setResults] = useState<boolean[]>([]);
    const [note, setNote] = useState<string | null>(null);
    const done = useRef(false);
    const game = games[index];

    const finish = (list: boolean[]) => {
      if (done.current) return;
      done.current = true;
      const right = list.filter(Boolean).length;
      onDone({ score: right / Math.max(1, games.length), accuracy: list.length ? right / list.length : 0, detail: `${right} de ${games.length} microjuegos ganados` });
    };

    useEffect(() => {
      if (timeUp) finish(results);
    });

    if (!game) return null;
    const answered = results.length > index;
    const Game = game.Component;

    function next() {
      setNote(null);
      if (index + 1 >= games.length) finish(results);
      else setIndex(index + 1);
    }

    return (
      <View style={styles.root}>
        <TelText variant="caption" color="accentSoft" align="center">
          Microjuego {index + 1} de {games.length} · {game.title}
        </TelText>
        <TelText variant="bodyStrong" color="cream" align="center">
          {game.instruction}
        </TelText>
        <View style={styles.game}>
          <Game
            key={game.id}
            durationSeconds={game.durationSeconds}
            level={level}
            pace={pace}
            active={!answered && !timeUp}
            onAnswer={(correct, _bonus, text) => {
              if (answered) return;
              setResults((list) => [...list, correct]);
              setNote(correct ? '¡Ganaste este microjuego!' : (text ?? 'Esta vez no. ¡Al siguiente!'));
            }}
          />
        </View>
        {answered && (
          <View style={styles.after}>
            <TelText variant="caption" color={results[index] ? 'cream' : 'dangerLight'} align="center">
              {note}
            </TelText>
            <TelButton label={index + 1 >= games.length ? 'Terminar ronda' : 'Siguiente microjuego'} variant="cream" size="md" iconRight="arrowRight" onPress={next} />
          </View>
        )}
      </View>
    );
  };
}

// ——— Preguntas de hardware, telecomunicaciones y software ———

const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];

const PC_PARTS: [string, string, string][] = [
  ['Hace los cálculos: es el cerebro del computador.', 'CPU', 'La CPU ejecuta las instrucciones.'],
  ['Recuerda lo que estás usando mientras trabajas.', 'RAM', 'La RAM es la memoria de trabajo: se borra al apagar.'],
  ['Guarda tus archivos aunque apagues el equipo.', 'Disco SSD', 'El disco guarda los datos para siempre.'],
  ['Le da energía a todas las piezas.', 'Fuente de poder', 'La fuente convierte la corriente del enchufe.'],
  ['Conecta el computador al Wi-Fi.', 'Tarjeta de red', 'La tarjeta de red habla con el router.'],
  ['Dibuja las imágenes y los juegos en la pantalla.', 'Tarjeta gráfica', 'La GPU procesa gráficos muy rápido.'],
];

export const armaPc: QuickGenerator = (_level, random) => {
  const [task, part, note] = pick(PC_PARTS, random);
  const others = seededShuffle(PC_PARTS.map((item) => item[1]).filter((name) => name !== part), random).slice(0, 3);
  return { prompt: `Armando el PC: ¿qué pieza hace esto? «${task}»`, options: [part, ...others], answer: 0, note };
};

const LED_CASES: { lines: string[]; ok: boolean; why: string }[] = [
  { lines: ['Batería (+) → resistencia → LED → Batería (−)'], ok: true, why: 'El camino está cerrado y la resistencia protege al LED.' },
  { lines: ['Batería (+) → LED → (cable suelto)'], ok: false, why: 'El circuito está abierto: la corriente no vuelve a la batería.' },
  { lines: ['Batería (+) → resistencia → LED al revés → Batería (−)'], ok: false, why: 'El LED solo deja pasar corriente en un sentido: está al revés.' },
  { lines: ['Interruptor abierto → resistencia → LED → Batería'], ok: false, why: 'Con el interruptor abierto el circuito queda cortado.' },
  { lines: ['Interruptor cerrado → resistencia → LED → Batería'], ok: true, why: 'Interruptor cerrado: la corriente circula y el LED brilla.' },
];

export const enciendeLed: QuickGenerator = (_level, random) => {
  const item = pick(LED_CASES, random);
  return { visual: <Mono lines={item.lines} />, prompt: '¿Se enciende el LED?', options: ['¡Sí, brilla!', 'No, queda apagado'], answer: item.ok ? 0 : 1, note: item.why };
};

const DIRECTIONS = ['Norte', 'Este', 'Sur', 'Oeste'];

export const antenaApunta: QuickGenerator = (_level, random) => {
  const values = seededShuffle([1, 2, 3, 5], random);
  const best = values.indexOf(5);
  return { visual: <Bars values={values} labels={DIRECTIONS} />, prompt: 'Barras de señal según hacia dónde apunta la antena. ¿Hacia dónde la dejas?', options: DIRECTIONS, answer: best, note: `Hacia el ${DIRECTIONS[best]}: ahí llega más señal del satélite.` };
};

const STATIONS = ['88.5', '93.3', '97.1', '101.7', '105.9'];

export const radioSintoniza: QuickGenerator = (_level, random) => {
  const options = seededShuffle(STATIONS, random).slice(0, 4);
  const target = options[0];
  const noise = options.map((freq) => (freq === target ? 1 : 3 + Math.floor(random() * 6)));
  return { visual: <Bars values={noise} labels={options} />, prompt: 'Ruido en cada frecuencia (MHz). ¿Dónde está la radio que buscas?', options, answer: 0, note: `En ${target} MHz el ruido es mínimo: ahí se escucha clara.` };
};

export const robotCodigo: QuickGenerator = (_level, random) => {
  const dx = 1 + Math.floor(random() * 3);
  const dy = 1 + Math.floor(random() * 2);
  const right = `${'→ '.repeat(dx)}${'↑ '.repeat(dy)}`.trim();
  const wrong = [`${'→ '.repeat(dx)}${'↓ '.repeat(dy)}`.trim(), `${'→ '.repeat(dx + 1)}${'↑ '.repeat(dy)}`.trim(), `${'← '.repeat(dx)}${'↑ '.repeat(dy)}`.trim()];
  const grid = Array.from({ length: dy + 1 }, (_, row) =>
    Array.from({ length: dx + 1 }, (_, col) => (row === 0 && col === dx ? '📶' : row === dy && col === 0 ? '🤖' : '·')).join(' '),
  );
  return { visual: <Mono lines={grid} />, prompt: '¿Qué programa lleva al robot hasta el Wi-Fi?', options: [right, ...wrong], answer: 0, note: `${dx} a la derecha y ${dy} hacia arriba: ${right}.` };
};

const TRAFFIC: { lines: string[]; bug: number; why: string }[] = [
  { lines: ['luz roja 30 s', 'luz verde 30 s', 'luz verde 3 s'], bug: 2, why: 'Después del verde va el amarillo, no otro verde.' },
  { lines: ['si botón presionado:', '  luz verde para autos', '  esperar 20 s'], bug: 1, why: 'Al presionar el botón, los autos deben ver rojo.' },
  { lines: ['repetir siempre:', '  luz roja 30 s', '  luz verde 0 s'], bug: 2, why: 'Un verde de 0 segundos nunca deja pasar a nadie.' },
];

export const cazaBug: QuickGenerator = (_level, random) => {
  const item = pick(TRAFFIC, random);
  return { visual: <Mono lines={['Programa del semáforo', ...item.lines.map((line, index) => `${index + 1}  ${line}`)]} />, prompt: '¿Qué línea tiene el bug?', options: item.lines.map((_, index) => `Línea ${index + 1}`), answer: item.bug, note: item.why };
};

const APPS: [string, string, string][] = [
  ['App del casino: falta el botón para pedir.', 'Botón «Pedir»', 'Sin botón, nadie puede pedir su almuerzo.'],
  ['App de música: falta dónde escribir la canción.', 'Campo de búsqueda', 'El campo de texto permite buscar.'],
  ['App de fotos: falta mostrar las fotos.', 'Galería de imágenes', 'Una lista de imágenes muestra las fotos.'],
  ['App del clima: falta el nombre de la ciudad arriba.', 'Título', 'El título dice de qué trata la pantalla.'],
];

export const armaApp: QuickGenerator = (_level, random) => {
  const [problem, piece, note] = pick(APPS, random);
  const others = seededShuffle(APPS.map((item) => item[1]).filter((name) => name !== piece), random).slice(0, 3);
  return { prompt: `${problem} ¿Qué pieza agregas?`, options: [piece, ...others], answer: 0, note };
};

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  visual: { alignItems: 'center', alignSelf: 'stretch' },
  game: { flex: 1, minHeight: 0 },
  after: { gap: spacing.xs },
});
