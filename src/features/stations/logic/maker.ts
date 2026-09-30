// Lógica de "Placas maker": elegir placa, cablear un LED y programar su parpadeo.

export type BoardId = 'arduino' | 'esp32' | 'rpi';

export const boardInfo: Record<BoardId, { name: string; detail: string; color: string }> = {
  arduino: { name: 'Arduino Uno', detail: 'Microcontrolador simple para sensores, LEDs y motores.', color: '#1C8C93' },
  esp32: { name: 'ESP32', detail: 'Microcontrolador con Wi-Fi y Bluetooth: ideal para IoT.', color: '#2B3440' },
  rpi: { name: 'Raspberry Pi', detail: 'Computador completo con Linux: cámaras, IA y servidores.', color: '#2E8B57' },
};

export interface Scenario {
  id: string;
  text: string;
  answer: BoardId;
  why: string;
}

export const scenarios: Scenario[] = [
  { id: 'semaforo', text: 'Un semáforo con 3 LEDs para una maqueta', answer: 'arduino', why: 'Basta un microcontrolador simple que encienda y apague pines.' },
  { id: 'riego', text: 'Un sensor de humedad que avisa al celular por Wi-Fi', answer: 'esp32', why: 'El ESP32 trae Wi-Fi incorporado.' },
  { id: 'rostros', text: 'Una cámara que reconoce rostros con inteligencia artificial', answer: 'rpi', why: 'La visión por computador necesita un procesador potente y Linux.' },
  { id: 'pulsera', text: 'Una pulsera que envía tus pasos al teléfono por Bluetooth', answer: 'esp32', why: 'Bluetooth integrado y bajo consumo.' },
  { id: 'servidor', text: 'Un pequeño servidor web con Linux para la sala', answer: 'rpi', why: 'Es un computador: puede ejecutar un servidor web completo.' },
  { id: 'robot', text: 'Un robot seguidor de línea con sensores y motores', answer: 'arduino', why: 'Controlar motores y leer sensores es lo típico de Arduino.' },
];

export function pickScenarios(random: () => number, count = 4): Scenario[] {
  const copy = [...scenarios];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export type Pin = '5V' | 'GND' | 'D13' | 'D2';
export type Terminal = 'resistor' | 'cathode';

export const pins: Pin[] = ['5V', 'GND', 'D13', 'D2'];

export const requiredWires: Record<Terminal, Pin> = {
  resistor: 'D13',
  cathode: 'GND',
};

export function wireHint(pin: Pin, terminal: Terminal): string {
  if (terminal === 'cathode') return pin === '5V' ? '¡Cortocircuito! La pata negativa del LED va a tierra (GND).' : 'La pata corta (−) del LED debe ir a GND.';
  if (pin === 'GND') return 'Así el LED nunca recibe voltaje: la resistencia va al pin que programarás (D13).';
  if (pin === '5V') return 'Con 5V el LED quedaría siempre encendido: usa un pin digital programable.';
  return 'Casi: el programa controlará el pin 13, conecta ahí la resistencia.';
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

export const CHOOSE_MAX = 200;
export const WIRE_MAX = 300;
export const CODE_MAX = 500;

export function wireScore(mistakes: number): number {
  return Math.max(100, WIRE_MAX - mistakes * 50);
}

export function codeScore(attempt: number, success: boolean): number {
  if (!success) return 100;
  return attempt <= 1 ? CODE_MAX : 300;
}
