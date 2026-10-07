import type { GameResult } from '@/types/game';

// Resumen acumulado del progreso. El historial guarda solo las últimas 200 partidas; lo que sale de esa
// ventana se pliega en un resumen como este (en el perfil), así un logro o un paso de la guía ya
// cumplido no "se pierde" por seguir jugando otra cosa.
//
// Cada campo es combinable (suma, máximo, mínimo o unión), por lo que resumir dos tandas de resultados
// y combinarlas da lo mismo que resumirlas juntas.
export interface ProgressStats {
  // Partidas en total.
  total: number;
  // Partidas por modo de juego.
  byMode: Record<string, number>;
  // Microjuegos ganados en ráfagas (veces por microjuego).
  microWins: Record<string, number>;
  // Niveles distintos resueltos de cada desafío sin reloj.
  puzzleLevels: Record<string, number[]>;
  // Juegos de la ruta jugados (práctica o ruta en vivo).
  stations: string[];
  // Días con el desafío diario completado.
  dailyDays: string[];
  millionaireCorrect: number;
  millionaireBest: number;
  routesCompleted: number;
  bestRoute: number;
  // Mejor lugar en una ruta en vivo con grupo (null si no hay).
  liveBestRank: number | null;
  templeRestored: boolean;
  perfectRun: boolean;
  burstFlawless: boolean;
  storyChapter: number;
  runnerDistance: number;
  runnerData: number;
}

export function emptyStats(): ProgressStats {
  return {
    total: 0,
    byMode: {},
    microWins: {},
    puzzleLevels: {},
    stations: [],
    dailyDays: [],
    millionaireCorrect: 0,
    millionaireBest: 0,
    routesCompleted: 0,
    bestRoute: 0,
    liveBestRank: null,
    templeRestored: false,
    perfectRun: false,
    burstFlawless: false,
    storyChapter: 0,
    runnerDistance: 0,
    runnerData: 0,
  };
}

const PILLARS = ['datos', 'software', 'redes', 'teleco', 'hardware'];

const number = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const union = (left: readonly string[], right: readonly string[]): string[] => [...new Set([...left, ...right])];

function addCounts(left: Record<string, number>, right: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...left };
  Object.entries(right).forEach(([key, value]) => {
    out[key] = (Object.prototype.hasOwnProperty.call(out, key) ? out[key] : 0) + value;
  });
  return out;
}

export function combineStats(left: ProgressStats, right: ProgressStats): ProgressStats {
  const levels: Record<string, number[]> = { ...left.puzzleLevels };
  Object.entries(right.puzzleLevels).forEach(([game, list]) => {
    levels[game] = [...new Set([...(Object.prototype.hasOwnProperty.call(levels, game) ? levels[game] : []), ...list])];
  });
  const ranks = [left.liveBestRank, right.liveBestRank].filter((rank): rank is number => rank !== null);
  return {
    total: left.total + right.total,
    byMode: addCounts(left.byMode, right.byMode),
    microWins: addCounts(left.microWins, right.microWins),
    puzzleLevels: levels,
    stations: union(left.stations, right.stations),
    dailyDays: union(left.dailyDays, right.dailyDays),
    millionaireCorrect: left.millionaireCorrect + right.millionaireCorrect,
    millionaireBest: Math.max(left.millionaireBest, right.millionaireBest),
    routesCompleted: left.routesCompleted + right.routesCompleted,
    bestRoute: Math.max(left.bestRoute, right.bestRoute),
    liveBestRank: ranks.length ? Math.min(...ranks) : null,
    templeRestored: left.templeRestored || right.templeRestored,
    perfectRun: left.perfectRun || right.perfectRun,
    burstFlawless: left.burstFlawless || right.burstFlawless,
    storyChapter: Math.max(left.storyChapter, right.storyChapter),
    runnerDistance: Math.max(left.runnerDistance, right.runnerDistance),
    runnerData: left.runnerData + right.runnerData,
  };
}

function isResult(value: unknown): value is GameResult {
  return typeof value === 'object' && value !== null && typeof (value as GameResult).gameId === 'string';
}

// Resume una lista de resultados. Las entradas que no son resultados (datos dañados) se ignoran.
export function summarize(results: readonly unknown[]): ProgressStats {
  const stats = emptyStats();
  const stations = new Set<string>();
  const daily = new Set<string>();
  for (const result of results) {
    if (!isResult(result)) continue;
    const meta = result.metadata ?? {};
    stats.total += 1;
    stats.byMode[result.gameId] = (Object.prototype.hasOwnProperty.call(stats.byMode, result.gameId) ? stats.byMode[result.gameId] : 0) + 1;
    switch (result.gameId) {
      case 'burst': {
        if (typeof meta.won === 'string') {
          meta.won
            .split(',')
            .filter(Boolean)
            .forEach((id) => {
              stats.microWins[id] = (Object.prototype.hasOwnProperty.call(stats.microWins, id) ? stats.microWins[id] : 0) + 1;
            });
        }
        if (typeof meta.daily === 'string' && meta.daily) daily.add(meta.daily);
        if (number(result.accuracy) >= 1) stats.perfectRun = true;
        if (!meta.focus && number(meta.lives) >= 3 && number(meta.rounds) >= 5) stats.burstFlawless = true;
        break;
      }
      case 'millionaire': {
        const correct = number(meta.correctAnswers);
        stats.millionaireCorrect += correct;
        stats.millionaireBest = Math.max(stats.millionaireBest, correct);
        if (number(result.accuracy) >= 1) stats.perfectRun = true;
        break;
      }
      case 'route': {
        stats.bestRoute = Math.max(stats.bestRoute, number(result.score));
        stations.add('red-b215');
        if (number(meta.pillars) >= 5) PILLARS.forEach((id) => stations.add(id));
        if (meta.completed === true) {
          stats.routesCompleted += 1;
          if (number(meta.pillars) >= 5) stats.templeRestored = true;
          // El podio solo cuenta en rutas en vivo con grupo (no en el modo individual).
          if (meta.solo !== true && number(meta.players) >= 3) {
            const rank = meta.rank === undefined ? 99 : number(meta.rank) || 99;
            stats.liveBestRank = stats.liveBestRank === null ? rank : Math.min(stats.liveBestRank, rank);
          }
        }
        break;
      }
      case 'station':
        if (typeof meta.game === 'string') stations.add(meta.game);
        break;
      case 'story':
        stats.storyChapter = Math.max(stats.storyChapter, number(meta.chapter));
        break;
      case 'puzzle': {
        const game = String(meta.game);
        const list = Object.prototype.hasOwnProperty.call(stats.puzzleLevels, game) ? stats.puzzleLevels[game] : [];
        const level = number(meta.level);
        if (!list.includes(level)) stats.puzzleLevels[game] = [...list, level];
        break;
      }
      case 'runner':
        stats.runnerDistance = Math.max(stats.runnerDistance, number(meta.distance));
        stats.runnerData += number(meta.data);
        break;
      default:
        break;
    }
  }
  stats.stations = [...stations];
  stats.dailyDays = [...daily];
  return stats;
}

// Lee un resumen guardado, tolerando campos faltantes o dañados.
export function parseStats(raw: unknown): ProgressStats {
  const base = emptyStats();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base;
  const source = raw as Record<string, unknown>;
  const counts = (value: unknown): Record<string, number> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, amount]) => (typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? [[key, Math.floor(amount)]] : [])));
  };
  const strings = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : []);
  const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);
  const levels: Record<string, number[]> = {};
  if (typeof source.puzzleLevels === 'object' && source.puzzleLevels !== null && !Array.isArray(source.puzzleLevels)) {
    Object.entries(source.puzzleLevels as Record<string, unknown>).forEach(([game, list]) => {
      if (Array.isArray(list)) levels[game] = [...new Set(list.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)))];
    });
  }
  return {
    total: Math.floor(count(source.total)),
    byMode: counts(source.byMode),
    microWins: counts(source.microWins),
    puzzleLevels: levels,
    stations: strings(source.stations),
    dailyDays: strings(source.dailyDays),
    millionaireCorrect: count(source.millionaireCorrect),
    millionaireBest: count(source.millionaireBest),
    routesCompleted: Math.floor(count(source.routesCompleted)),
    bestRoute: count(source.bestRoute),
    liveBestRank: typeof source.liveBestRank === 'number' && Number.isFinite(source.liveBestRank) && source.liveBestRank >= 1 ? source.liveBestRank : null,
    templeRestored: source.templeRestored === true,
    perfectRun: source.perfectRun === true,
    burstFlawless: source.burstFlawless === true,
    storyChapter: count(source.storyChapter),
    runnerDistance: count(source.runnerDistance),
    runnerData: count(source.runnerData),
  };
}
