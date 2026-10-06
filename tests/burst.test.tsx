import { microGameCatalog } from '@/features/burst/catalog';
import { getMicroGame, microGameRegistry, pickBurstGames, roundDuration } from '@/features/burst/registry';
import { icons } from '@/graphics/icons';
import type { MicroGameId } from '@/types/game';

const expectedIds: MicroGameId[] = [
  'connect-network',
  'clean-signal',
  'ping-check',
  'color-code',
  'firewall',
  'signal-timing',
  'sequence-memory',
  'packet-rush',
  'cable-connect',
  'packet-catch',
  'wifi-boost',
  'password-strong',
  'binary-bits',
  'layer-order',
  'ip-valid',
  'fast-route',
  'safe-url',
  'unit-order',
];

describe('burst registry', () => {
  it('has eighteen unique microgames', () => {
    const ids = microGameRegistry.map((game) => game.id);
    expect(new Set(ids).size).toBe(18);
    expect([...ids].sort()).toEqual([...expectedIds].sort());
  });

  it('every microgame has metadata, a known icon and a component', () => {
    for (const game of microGameRegistry) {
      expect(game.title.length).toBeGreaterThan(2);
      expect(game.instruction.length).toBeGreaterThan(5);
      expect(game.durationSeconds).toBeGreaterThanOrEqual(8);
      expect(game.durationSeconds).toBeLessThanOrEqual(15);
      expect(icons[game.icon]).toBeDefined();
      expect(typeof game.Component).toBe('function');
    }
  });

  it('keeps the catalog and the registry in sync', () => {
    expect(microGameCatalog.map((game) => game.id)).toEqual(microGameRegistry.map((game) => game.id));
  });

  it('picks the requested amount without duplicates', () => {
    const picked = pickBurstGames(6);
    expect(picked).toHaveLength(6);
    expect(new Set(picked.map((game) => game.id)).size).toBe(6);
  });

  it('caps the pick at the registry size', () => {
    expect(pickBurstGames(99)).toHaveLength(microGameRegistry.length);
  });

  it('finds games by id', () => {
    expect(getMicroGame('wifi-boost')?.title).toBe('Wi-Fi Boost');
    expect(getMicroGame('nope')).toBeUndefined();
  });

  it('speeds up each round but never below six seconds', () => {
    expect(roundDuration(12, 0)).toBe(12);
    expect(roundDuration(12, 3)).toBeLessThan(12);
    expect(roundDuration(8, 5)).toBe(6);
    expect(roundDuration(12, 4, true)).toBe(12);
  });
});
