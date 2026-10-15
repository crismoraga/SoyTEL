import AsyncStorage from '@react-native-async-storage/async-storage';
import { microGameRegistry, pickBurstGames } from '@/features/burst/registry';
import { mulberry32 } from '@/route/random';
import { getRecentBurstGames, parseRecentGames, rememberBurstGames, RECENT_LIMIT } from '@/storage/burstHistory';

// La Ráfaga TEL elige de una "pool" grande: prefiere lo que no se jugó hace poco y alterna áreas.
describe('pool de microjuegos', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('no repite juegos dentro de una ráfaga y es determinista con la misma semilla', () => {
    const first = pickBurstGames(6, mulberry32(42)).map((game) => game.id);
    expect(new Set(first).size).toBe(6);
    expect(pickBurstGames(6, mulberry32(42)).map((game) => game.id)).toEqual(first);
  });

  it('prefiere los juegos que no salieron hace poco', () => {
    const recent = microGameRegistry.slice(0, microGameRegistry.length - 8).map((game) => game.id);
    for (let seed = 1; seed <= 30; seed += 1) {
      const picked = pickBurstGames(6, mulberry32(seed), recent).map((game) => game.id);
      expect(picked.filter((id) => recent.includes(id))).toHaveLength(0);
    }
  });

  it('si hay de dónde elegir, dos juegos seguidos no son de la misma área', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const picked = pickBurstGames(6, mulberry32(seed));
      for (let index = 1; index < picked.length; index += 1) expect(picked[index].area).not.toBe(picked[index - 1].area);
    }
  });

  it('recuerda las ráfagas recientes sin duplicados y con un tope', async () => {
    await rememberBurstGames(['a', 'b', 'c']);
    await rememberBurstGames(['d', 'a']);
    expect(await getRecentBurstGames()).toEqual(['d', 'a', 'b', 'c']);
    const many = Array.from({ length: 40 }, (_, index) => `j${index}`);
    await rememberBurstGames(many);
    expect(await getRecentBurstGames()).toHaveLength(RECENT_LIMIT);
    expect(parseRecentGames('basura')).toEqual([]);
    expect(parseRecentGames(['x', 3, 'x', ''])).toEqual(['x']);
  });
});
