import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRunnerCharacter, runnerCharacters } from '@/features/runner/characters';

// Progreso de TEL Runner: paquetes de datos guardados, récords y personajes desbloqueados.
const RUNNER_KEY = '@soytel/runner';

export interface RunnerSave {
  // Paquetes de datos disponibles para desbloquear personajes.
  data: number;
  // Paquetes recogidos en total (no baja al gastar).
  totalData: number;
  best: number;
  bestDistance: number;
  runs: number;
  unlocked: string[];
  selected: string;
}

export const defaultRunnerSave: RunnerSave = { data: 0, totalData: 0, best: 0, bestDistance: 0, runs: 0, unlocked: ['rutix'], selected: 'rutix' };

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

export function parseRunnerSave(raw: unknown): RunnerSave {
  if (!raw || typeof raw !== 'object') return { ...defaultRunnerSave, unlocked: ['rutix'] };
  const source = raw as Partial<Record<keyof RunnerSave, unknown>>;
  const known = runnerCharacters.map((character) => character.id as string);
  const unlocked = Array.isArray(source.unlocked) ? source.unlocked.filter((id): id is string => typeof id === 'string' && known.includes(id)) : [];
  if (!unlocked.includes('rutix')) unlocked.unshift('rutix');
  const selected = typeof source.selected === 'string' && unlocked.includes(source.selected) ? source.selected : 'rutix';
  return {
    data: count(source.data),
    totalData: Math.max(count(source.totalData), count(source.data)),
    best: count(source.best),
    bestDistance: count(source.bestDistance),
    runs: count(source.runs),
    unlocked,
    selected,
  };
}

export interface RunSummary {
  data: number;
  score: number;
  distance: number;
}

// Suma una carrera terminada: los paquetes van a la billetera y se actualizan los récords.
export function applyRun(save: RunnerSave, run: RunSummary): RunnerSave {
  const data = count(run.data);
  return {
    ...save,
    data: save.data + data,
    totalData: save.totalData + data,
    best: Math.max(save.best, count(run.score)),
    bestDistance: Math.max(save.bestDistance, count(run.distance)),
    runs: save.runs + 1,
  };
}

// Desbloquea un personaje si alcanzan los paquetes; si no, devuelve la partida sin cambios.
export function applyUnlock(save: RunnerSave, id: string): RunnerSave {
  const character = getRunnerCharacter(id);
  if (character.id !== id || save.unlocked.includes(id) || save.data < character.cost) return save;
  return { ...save, data: save.data - character.cost, unlocked: [...save.unlocked, id], selected: id };
}

export async function loadRunnerSave(): Promise<RunnerSave> {
  try {
    const raw = await AsyncStorage.getItem(RUNNER_KEY);
    return parseRunnerSave(raw ? JSON.parse(raw) : null);
  } catch {
    // Datos dañados: se parte de cero.
    return parseRunnerSave(null);
  }
}

async function store(save: RunnerSave): Promise<RunnerSave> {
  await AsyncStorage.setItem(RUNNER_KEY, JSON.stringify(save));
  return save;
}

export async function recordRun(run: RunSummary): Promise<RunnerSave> {
  return store(applyRun(await loadRunnerSave(), run));
}

// Paquetes de regalo (misiones de Rutix): van a la billetera sin contar como carrera.
export async function addRunnerData(amount: number): Promise<RunnerSave> {
  const save = await loadRunnerSave();
  const extra = count(amount);
  return store({ ...save, data: save.data + extra, totalData: save.totalData + extra });
}

export async function unlockRunnerCharacter(id: string): Promise<RunnerSave> {
  return store(applyUnlock(await loadRunnerSave(), id));
}

export async function selectRunnerCharacter(id: string): Promise<RunnerSave> {
  const save = await loadRunnerSave();
  return save.unlocked.includes(id) ? store({ ...save, selected: id }) : save;
}

export const RUNNER_KEYS = [RUNNER_KEY];
