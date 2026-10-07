// Lógica pura de los desafíos "Binario" y "Mensaje cifrado".

type Random = () => number;

function shuffled<T>(items: T[], random: Random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// ——— Binario ———

export type BinaryChallenge =
  | { kind: 'toBits'; value: number; bits: number }
  | { kind: 'toDecimal'; value: number; bits: number; options: number[] };

export const BINARY_ROUNDS = 5;

export function binaryBitsForLevel(level: number): number {
  if (level <= 1) return 4;
  if (level === 2) return 5;
  if (level === 3) return 6;
  return 8;
}

export function toBitString(value: number, bits: number): string {
  return value.toString(2).padStart(bits, '0');
}

// Suma explicada: "128 + 32 + 4 = 164".
export function explainBinary(value: number, bits: number): string {
  const weights = Array.from({ length: bits }, (_, index) => 2 ** (bits - 1 - index)).filter((weight) => value & weight);
  return weights.length ? `${weights.join(' + ')} = ${value}` : `Todos los bits en 0 = ${value}`;
}

export function binaryChallenges(level: number, random: Random = Math.random): BinaryChallenge[] {
  const bits = binaryBitsForLevel(level);
  const max = 2 ** bits - 1;
  const used = new Set<number>();
  const next = () => {
    for (;;) {
      const value = 1 + Math.floor(random() * max);
      if (!used.has(value)) {
        used.add(value);
        return value;
      }
    }
  };
  return Array.from({ length: BINARY_ROUNDS }, (_, index) => {
    const value = next();
    if (index % 2 === 0) return { kind: 'toBits', value, bits } as BinaryChallenge;
    // Distractores cercanos: un bit de diferencia o ±1.
    const candidates = new Set<number>();
    for (let bit = 0; bit < bits; bit += 1) candidates.add(value ^ (1 << bit));
    candidates.add(value + 1);
    candidates.add(value - 1);
    const distractors = shuffled([...candidates].filter((item) => item > 0 && item <= max && item !== value), random).slice(0, 3);
    return { kind: 'toDecimal', value, bits, options: shuffled([value, ...distractors], random) } as BinaryChallenge;
  });
}

// ——— Mensaje cifrado (César) ———

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CIPHER_ROUNDS = 3;

export function caesar(text: string, shift: number): string {
  const size = ALPHABET.length;
  return text
    .toUpperCase()
    .split('')
    .map((character) => {
      const index = ALPHABET.indexOf(character);
      return index < 0 ? character : ALPHABET[(((index + shift) % size) + size) % size];
    })
    .join('');
}

const WORDS = ['FIBRA', 'ROUTER', 'ANTENA', 'SWITCH', 'PAQUETE', 'SERVIDOR', 'FIREWALL', 'PROTOCOLO', 'SATELITE', 'TELEMATICA', 'INTERNET', 'BINARIO', 'SENSOR', 'ARDUINO', 'LATENCIA'];
const PHRASES = ['CONECTANDO IDEAS', 'LA RED NOS UNE', 'DATOS EN LA NUBE', 'FIBRA HASTA LA CASA', 'CLAVE SEGURA', 'SOY TELEMATICO', 'PING AL SERVIDOR', 'ONDAS EN EL AIRE', 'CODIGO ABIERTO', 'LUZ POR EL VIDRIO'];

export interface CipherRound {
  plain: string;
  cipher: string;
  shift: number;
  maxShift: number;
}

export function cipherMaxShift(level: number): number {
  if (level <= 1) return 5;
  if (level === 2) return 9;
  if (level === 3) return 13;
  return 25;
}

export function cipherRounds(level: number, random: Random = Math.random): CipherRound[] {
  const maxShift = cipherMaxShift(level);
  const pool = shuffled(level <= 2 ? WORDS : PHRASES, random).slice(0, CIPHER_ROUNDS);
  return pool.map((plain) => {
    const shift = 1 + Math.floor(random() * maxShift);
    return { plain, cipher: caesar(plain, shift), shift, maxShift };
  });
}

// Reparte 1000 puntos entre `rounds` rondas sin perder el resto de la división: las primeras se llevan
// el punto que sobra, así una partida perfecta suma exactamente 1000.
function roundShare(rounds: number, index: number): number {
  return Math.floor(1000 / rounds) + (index < 1000 % rounds ? 1 : 0);
}

// Puntaje de un mensaje: su parte de los 1000, menos por cada comprobación fallida.
export function cipherPoints(wrongChecks: number, round = 0): number {
  return Math.max(120, roundShare(CIPHER_ROUNDS, round) - wrongChecks * 60);
}

export function binaryPoints(wrongChecks: number, round = 0): number {
  return Math.max(60, roundShare(BINARY_ROUNDS, round) - wrongChecks * 50);
}
