import type { IconName } from '@/graphics/icons';

// "Parejas TEL": memoria de conceptos. Cada pareja une un equipo o idea con lo que hace.
export interface MemoryConcept {
  id: string;
  term: string;
  icon: IconName;
  clue: string;
}

export const memoryConcepts: MemoryConcept[] = [
  { id: 'router', term: 'Router', icon: 'router', clue: 'Elige el camino de cada paquete' },
  { id: 'switch', term: 'Switch', icon: 'lanSwitch', clue: 'Une equipos por cable' },
  { id: 'antena', term: 'Antena', icon: 'antenna', clue: 'Emite ondas de radio' },
  { id: 'firewall', term: 'Firewall', icon: 'shieldCheck', clue: 'Bloquea los ataques' },
  { id: 'servidor', term: 'Servidor', icon: 'server', clue: 'Guarda y entrega datos' },
  { id: 'fibra', term: 'Fibra óptica', icon: 'fiber', clue: 'Lleva datos como luz' },
  { id: 'nube', term: 'La nube', icon: 'cloud', clue: 'Servidores lejos de ti' },
  { id: 'bit', term: 'Bit', icon: 'hash', clue: 'Un 1 o un 0' },
  { id: 'wifi', term: 'Wi-Fi', icon: 'wifi', clue: 'Red sin cables' },
  { id: 'paquete', term: 'Paquete', icon: 'packet', clue: 'Un trozo de datos' },
  { id: 'dns', term: 'DNS', icon: 'globe', clue: 'Traduce nombres a IP' },
  { id: 'clave', term: 'Contraseña', icon: 'key', clue: 'Tu llave secreta' },
  { id: 'codigo', term: 'Código', icon: 'code', clue: 'Instrucciones del software' },
  { id: 'chip', term: 'Procesador', icon: 'cpu', clue: 'El cerebro del equipo' },
];

export interface MemoryCard {
  key: number;
  pair: string;
  // Cara del concepto (ícono y nombre) o cara de lo que hace.
  side: 'term' | 'clue';
}

export const MEMORY_MAX_LEVEL = 5;

// Parejas por nivel: 4, 6, 8, 10 y 12.
export function memoryPairsForLevel(level: number): number {
  return 4 + 2 * (Math.min(MEMORY_MAX_LEVEL, Math.max(1, Math.floor(level))) - 1);
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export function createMemoryDeck(level: number, random: () => number = Math.random): MemoryCard[] {
  const concepts = shuffled(memoryConcepts, random).slice(0, memoryPairsForLevel(level));
  const cards = concepts.flatMap((concept) => [
    { pair: concept.id, side: 'term' as const },
    { pair: concept.id, side: 'clue' as const },
  ]);
  return shuffled(cards, random).map((card, key) => ({ ...card, key }));
}

export function isMemoryMatch(first: MemoryCard, second: MemoryCard): boolean {
  return first.key !== second.key && first.pair === second.pair;
}

// 1.000 puntos con memoria perfecta; cada intento de más resta 40 (mínimo 300).
export function memoryScore(pairs: number, attempts: number): number {
  return Math.max(300, 1000 - Math.max(0, attempts - pairs) * 40);
}

export function getMemoryConcept(id: string): MemoryConcept | undefined {
  return memoryConcepts.find((concept) => concept.id === id);
}
