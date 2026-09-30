import {
  crimpRound,
  firewallRound,
  needlePosition,
  passwordStrength,
  pingLines,
  shuffle,
  signalBars,
  t568b,
  wifiSignal,
} from '@/features/burst/logic';
import { seededRandom } from '@/graphics/shapes';

describe('password strength', () => {
  it('rates short or predictable passwords as weak', () => {
    expect(passwordStrength('nube4', 1).level).toBe(0);
    expect(passwordStrength('123456', 0).level).toBe(0);
  });

  it('rewards length and random words', () => {
    expect(passwordStrength('nubefaro', 2).level).toBe(1);
    expect(passwordStrength('nube-faro!', 2).level).toBe(2);
    expect(passwordStrength('nube-faro-cable', 3).level).toBe(3);
  });
});

describe('wifi boost', () => {
  const size = { width: 300, height: 300 };
  const laptop = { x: 50, y: 50 };
  const microwave = { x: 250, y: 250 };

  it('gets stronger as the router approaches the laptop', () => {
    const far = wifiSignal({ x: 280, y: 60 }, laptop, microwave, size);
    const near = wifiSignal({ x: 60, y: 60 }, laptop, microwave, size);
    expect(near.strength).toBeGreaterThan(far.strength);
    expect(near.strength).toBeGreaterThan(0.92);
  });

  it('penalizes routers next to the microwave', () => {
    const result = wifiSignal({ x: 240, y: 240 }, laptop, microwave, size);
    expect(result.interference).toBe(true);
    expect(result.strength).toBeLessThan(0.3);
  });

  it('maps strength to four signal bars', () => {
    expect(signalBars(0.95)).toBe(4);
    expect(signalBars(0.75)).toBe(3);
    expect(signalBars(0.5)).toBe(2);
    expect(signalBars(0.2)).toBe(1);
    expect(signalBars(0.05)).toBe(0);
  });
});

describe('signal timing needle', () => {
  it('moves as a triangle wave between 0 and 1', () => {
    expect(needlePosition(0, 1000)).toBe(0);
    expect(needlePosition(250, 1000)).toBeCloseTo(0.5);
    expect(needlePosition(500, 1000)).toBeCloseTo(1);
    expect(needlePosition(750, 1000)).toBeCloseTo(0.5);
    expect(needlePosition(1000, 1000)).toBe(0);
  });
});

describe('RJ45 crimping', () => {
  it('follows the T568B order', () => {
    expect(t568b.map((wire) => wire.id)).toEqual(['wo', 'o', 'wg', 'b', 'wb', 'g', 'wbr', 'br']);
  });

  it('always offers the missing wire among four unique options', () => {
    const random = seededRandom(3);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const round = crimpRound(random);
      const ids = round.options.map((wire) => wire.id);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toContain(t568b[round.missing].id);
    }
  });
});

describe('firewall rounds', () => {
  it('mixes legitimate and malicious packets', () => {
    const round = firewallRound(4, seededRandom(9));
    expect(round).toHaveLength(4);
    expect(round.filter((packet) => packet.malicious)).toHaveLength(2);
  });
});

describe('ping terminal', () => {
  it('shows replies only when there is connectivity', () => {
    expect(pingLines('ok').some((line) => line.includes('bytes'))).toBe(true);
    expect(pingLines('timeout').some((line) => line.includes('bytes'))).toBe(false);
    expect(pingLines('unreachable').join(' ')).toContain('inaccesible');
  });
});

describe('shuffle', () => {
  it('keeps every element', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffle(items, seededRandom(1)).sort()).toEqual(items);
  });
});
