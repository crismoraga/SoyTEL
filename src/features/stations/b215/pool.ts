import { rounds as equipos } from './parts/equipos';
import { rounds as red } from './parts/red';
import { rounds as ruta } from './parts/ruta';
import type { B215Round } from './types';

// Todas las rondas que puede tocar en la sala B215.
export const b215Rounds: B215Round[] = [...ruta, ...equipos, ...red];

export function getB215Round(id: string): B215Round | undefined {
  return b215Rounds.find((round) => round.id === id);
}

// Elige `count` rondas distintas con una semilla (la misma semilla da las mismas rondas: en la ruta en
// vivo todo el grupo juega el mismo circuito). La ruta del paquete siempre va primero si sale.
export function pickB215Rounds(count: number, seed: number, pool: B215Round[] = b215Rounds): B215Round[] {
  const items = [...pool];
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items.slice(0, Math.min(count, items.length));
}
