import type { IconName } from '@/graphics/icons';
import type { PuzzleId } from '@/storage/puzzles';

export interface PuzzleInfo {
  id: PuzzleId;
  title: string;
  subtitle: string;
  how: string;
  learned: string;
  icon: IconName;
  color: string;
  maxLevel: number;
  levelName: (level: number) => string;
}

// Desafíos sin reloj: se resuelven pensando, a tu ritmo, y suben de nivel.
export const puzzles: PuzzleInfo[] = [
  {
    id: 'red',
    title: 'Conecta la red',
    subtitle: 'Gira los cables hasta que la señal del servidor llegue a todos los equipos.',
    how: 'Toca una pieza para girarla. Los cables encendidos ya reciben señal del servidor.',
    learned: 'Una red sin lazos donde todos los equipos quedan conectados se llama árbol: es la base de cómo los switches evitan bucles (Spanning Tree).',
    icon: 'network',
    color: '#4FB38A',
    maxLevel: 10,
    levelName: (level) => (level <= 1 ? '3×3' : level <= 3 ? '4×4' : level <= 6 ? '5×5' : '6×6'),
  },
  {
    id: 'binario',
    title: 'Binario',
    subtitle: 'Convierte números entre decimal y binario encendiendo bits.',
    how: 'Cada bit encendido suma su valor. Combínalos para formar el número pedido.',
    learned: 'Los computadores guardan todo en bits. Con 8 bits (un byte) se cuentan 256 valores: por eso cada parte de una dirección IP va de 0 a 255.',
    icon: 'hash',
    color: '#9B8AE6',
    maxLevel: 6,
    levelName: (level) => (level <= 1 ? '4 bits' : level === 2 ? '5 bits' : level === 3 ? '6 bits' : '8 bits'),
  },
  {
    id: 'cifrado',
    title: 'Mensaje cifrado',
    subtitle: 'Descifra mensajes secretos moviendo el alfabeto, como en el cifrado César.',
    how: 'Cambia el desplazamiento hasta que el texto tenga sentido y luego compruébalo.',
    learned: 'Probar todos los desplazamientos es un ataque de fuerza bruta. El cifrado César cae en 25 intentos; el cifrado moderno (AES) tiene más claves que átomos hay en el universo.',
    icon: 'key',
    color: '#E58A5A',
    maxLevel: 6,
    levelName: (level) => (level <= 2 ? 'Palabras' : 'Frases'),
  },
];

export function getPuzzle(id: string): PuzzleInfo | undefined {
  return puzzles.find((puzzle) => puzzle.id === id);
}
