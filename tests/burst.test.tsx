import { microGameRegistry, pickBurstGames } from '@/features/burst/registry';

describe('burst registry', () => {
  it('has eight unique microgames', () => {
    const ids = microGameRegistry.map((game) => game.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('every microgame has title, instruction, duration and component', () => {
    for (const game of microGameRegistry) {
      expect(game.title.length).toBeGreaterThan(2);
      expect(game.instruction.length).toBeGreaterThan(5);
      expect(game.durationSeconds).toBeGreaterThanOrEqual(8);
      expect(game.durationSeconds).toBeLessThanOrEqual(15);
      expect(typeof game.Component).toBe('function');
    }
  });

  it('picks the requested amount without duplicates', () => {
    const picked = pickBurstGames(6);
    expect(picked).toHaveLength(6);
    expect(new Set(picked.map((game) => game.id)).size).toBe(6);
  });

  it('caps the pick at the registry size', () => {
    expect(pickBurstGames(99)).toHaveLength(microGameRegistry.length);
  });
});
