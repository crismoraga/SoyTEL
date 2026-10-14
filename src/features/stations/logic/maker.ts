import type { IconName } from '@/graphics/icons';

// Lógica de "Placas maker": elegir placa, cablear un LED y programar su parpadeo.

export type BoardId = 'arduino' | 'esp32' | 'rpi';

export const boardInfo: Record<BoardId, { name: string; detail: string; color: string }> = {
  arduino: { name: 'Arduino Uno', detail: 'Placa simple: controla LEDs, sensores y motores. No trae Wi-Fi.', color: '#1C8C93' },
  esp32: { name: 'ESP32', detail: 'Como un Arduino, pero con Wi-Fi y Bluetooth incorporados.', color: '#2B3440' },
  rpi: { name: 'Raspberry Pi', detail: 'Mini computador con Linux: cámara, IA y servidores.', color: '#2E8B57' },
};

export interface Scenario {
  id: string;
  text: string;
  answer: BoardId;
  // Una línea que empieza por el nombre de la placa correcta y dice por qué.
  why: string;
}

// Regla del juego: gana la placa MÁS SIMPLE que cumple lo que pide el proyecto
// (Arduino < ESP32 < Raspberry Pi). Así cada proyecto tiene una sola respuesta.
export const scenarios: Scenario[] = [
  { id: 'semaforo', text: 'Un semáforo de maqueta con 3 LEDs', answer: 'arduino', why: 'Arduino basta: solo enciende LEDs, sin Wi-Fi.' },
  { id: 'riego', text: 'Un sensor de humedad que avisa al celular por Wi-Fi', answer: 'esp32', why: 'ESP32: trae Wi-Fi incorporado; el Arduino Uno no.' },
  { id: 'rostros', text: 'Una cámara que analiza video con inteligencia artificial', answer: 'rpi', why: 'Raspberry Pi: es un computador con Linux y procesa video.' },
  { id: 'pulsera', text: 'Una pulsera que manda tus pasos al celular por Bluetooth', answer: 'esp32', why: 'ESP32: trae Bluetooth y gasta poca energía.' },
  { id: 'servidor', text: 'Un servidor web que corre Linux en la sala', answer: 'rpi', why: 'Raspberry Pi: es un computador con Linux completo.' },
  { id: 'robot', text: 'Un robot seguidor de línea con sensores y motores', answer: 'arduino', why: 'Arduino basta: lee sensores y maneja motores, sin Wi-Fi.' },
];

// Elige `count` proyectos con la semilla, y siempre al menos uno de cada placa (así se repasan las tres).
export function pickScenarios(random: () => number, count = 4): Scenario[] {
  const shuffle = <T,>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const boards: BoardId[] = ['arduino', 'esp32', 'rpi'];
  const firsts = boards.map((board) => shuffle(scenarios.filter((item) => item.answer === board))[0]);
  const rest = shuffle(scenarios.filter((item) => !firsts.includes(item)));
  return shuffle([...firsts, ...rest].slice(0, count));
}

export type Pin = '5V' | 'GND' | 'D13' | 'D2';
export type Terminal = 'resistor' | 'cathode';

export const pins: Pin[] = ['5V', 'GND', 'D13', 'D2'];

export const requiredWires: Record<Terminal, Pin> = {
  resistor: 'D13',
  cathode: 'GND',
};

// Una línea que dice por qué ese cable no va y dónde sí.
export function wireHint(pin: Pin, terminal: Terminal): string {
  if (terminal === 'cathode') return pin === '5V' ? '5V es el lado positivo: la pata corta (−) del LED va a GND.' : 'La pata corta (−) del LED se conecta a GND (tierra).';
  if (pin === 'GND') return 'Así el LED no recibe voltaje: la resistencia va al pin D13.';
  if (pin === '5V') return 'Con 5V el LED quedaría siempre encendido: usa el pin D13.';
  return 'El programa controlará el pin 13: conecta ahí la resistencia.';
}

export const CHOOSE_MAX = 200;
export const WIRE_MAX = 300;
export const CODE_MAX = 500;

export function wireScore(mistakes: number): number {
  return Math.max(100, WIRE_MAX - mistakes * 50);
}

// Puntos del cableado con lo hecho hasta ahora: cada cable bien puesto suma, y el circuito completo vale `wireScore`.
export function wirePoints(correctWires: number, mistakes: number): number {
  return correctWires >= 2 ? wireScore(mistakes) : correctWires * 60;
}

export interface WireLayout {
  // Medidas exactas (px) del tablero de cableado: pines a la izquierda, extremos del circuito a la derecha.
  width: number;
  height: number;
  pad: number;
  boardW: number;
  pinW: number;
  pinH: number;
  pinTop: Record<Pin, number>;
  terminalSize: number;
  terminalX: number;
  // Centro vertical de cada extremo del circuito.
  terminalY: Record<Terminal, number>;
}

// Cada pin mide 44 px o más de alto y los extremos del circuito son círculos de 44 px: ningún blanco se solapa.
export function wireLayout(size: { width: number; height: number }): WireLayout {
  const pad = 6;
  const gap = 6;
  const terminalSize = 44;
  const width = Math.max(240, size.width);
  const pinH = Math.max(44, Math.min(54, Math.floor((size.height - 2 * pad - 3 * gap) / 4)));
  const height = 2 * pad + 4 * pinH + 3 * gap;
  const pinTop = {} as Record<Pin, number>;
  pins.forEach((pin, index) => {
    pinTop[pin] = pad + index * (pinH + gap);
  });
  const half = terminalSize / 2;
  return {
    width,
    height,
    pad,
    boardW: 68 + 2 * pad,
    pinW: 68,
    pinH,
    pinTop,
    terminalSize,
    terminalX: width - 70,
    terminalY: { resistor: pad + half + 2, cathode: height - pad - half - 2 },
  };
}

export type BlockId = 'high' | 'low' | 'delay' | 'delay2' | 'pin2' | 'serial';

export const codeBlocks: { id: BlockId; code: string }[] = [
  { id: 'high', code: 'digitalWrite(13, HIGH);' },
  { id: 'delay', code: 'delay(500);' },
  { id: 'low', code: 'digitalWrite(13, LOW);' },
  { id: 'delay2', code: 'delay(500);' },
  { id: 'pin2', code: 'digitalWrite(2, HIGH);' },
  { id: 'serial', code: 'Serial.println("Hola");' },
];

// Las piezas que se ofrecen al jugador: se pueden usar las veces que haga falta (como en un programa de verdad).
// `delay2` es el mismo delay(500) y solo existe para simular programas armados con dos copias.
export const paletteBlocks: { id: BlockId; label: string; code: string; icon: IconName }[] = [
  { id: 'high', label: 'Prender', code: 'digitalWrite(13, HIGH);', icon: 'lightbulb' },
  { id: 'delay', label: 'Esperar', code: 'delay(500);', icon: 'timer' },
  { id: 'low', label: 'Apagar', code: 'digitalWrite(13, LOW);', icon: 'moon' },
  { id: 'pin2', label: 'Pin 2', code: 'digitalWrite(2, HIGH);', icon: 'bolt' },
  { id: 'serial', label: 'Texto', code: 'Serial.println("Hola");', icon: 'terminal' },
];

export function blockCode(id: BlockId): string {
  return codeBlocks.find((block) => block.id === id)?.code ?? '';
}

export const SLOTS = 4;

// Simula loop() dos vueltas y mide cuánto tiempo pasa el LED 13 encendido y apagado.
export function simulate(program: BlockId[]): { blinks: boolean; onMs: number; offMs: number; message: string } {
  let led = false;
  let onMs = 0;
  let offMs = 0;
  for (let round = 0; round < 2; round += 1) {
    program.forEach((block) => {
      if (block === 'high') led = true;
      else if (block === 'low') led = false;
      else if (block === 'delay' || block === 'delay2') {
        if (round === 1) {
          if (led) onMs += 500;
          else offMs += 500;
        }
      }
    });
  }
  const blinks = onMs > 0 && offMs > 0;
  let message = '¡El LED parpadea cada medio segundo!';
  if (!blinks) {
    if (onMs > 0) message = 'El LED queda siempre encendido: falta apagarlo y esperar.';
    else if (!program.includes('high')) message = 'El LED nunca se enciende: falta digitalWrite(13, HIGH).';
    else message = 'Cambia tan rápido que no se alcanza a ver: agrega un delay después de cada cambio.';
  }
  return { blinks, onMs, offMs, message };
}

export function codeScore(attempt: number, success: boolean): number {
  if (!success) return 100;
  return attempt <= 1 ? CODE_MAX : 300;
}
