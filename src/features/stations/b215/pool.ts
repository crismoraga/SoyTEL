import { rounds as equipos } from './parts/equipos';
import { rounds as hardware } from './parts/hardware';
import { rounds as rafagas } from './parts/rafagas';
import { rounds as red } from './parts/red';
import { rounds as ruta } from './parts/ruta';
import { rounds as software } from './parts/software';
import type { B215Round, B215Track } from './types';

// Todas las rondas que puede tocar en la sala B215.
export const b215Rounds: B215Round[] = [...ruta, ...equipos, ...red, ...rafagas, ...hardware, ...software];

export function getB215Round(id: string): B215Round | undefined {
  return b215Rounds.find((round) => round.id === id);
}

export function roundTrack(round: B215Round): B215Track {
  return round.track ?? 'redes';
}

// Un circuito muestra los tres lados de la carrera, en este orden: redes, hardware o telecomunicaciones,
// y software. Si un lado no tiene rondas, se completa con las que queden.
const TRACK_ORDER: B215Track[][] = [['redes'], ['hardware', 'telecom'], ['software']];

// Elige `count` rondas distintas con una semilla: la misma semilla da las mismas rondas (en la ruta en
// vivo todo el grupo juega el mismo circuito) y semillas distintas varían las rondas de cada lado.
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
  const picked: B215Round[] = [];
  for (const tracks of TRACK_ORDER) {
    if (picked.length >= count) break;
    const found = items.find((round) => !picked.includes(round) && tracks.includes(roundTrack(round)));
    if (found) picked.push(found);
  }
  for (const round of items) {
    if (picked.length >= Math.min(count, items.length)) break;
    if (!picked.includes(round)) picked.push(round);
  }
  return picked;
}
