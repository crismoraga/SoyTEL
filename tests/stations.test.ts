import { checkinCopy, pillarIds, pillars, routeStops } from '@/route/content';
import { mulberry32 } from '@/route/random';
import { acceptanceAngle, decodeBits, fiberLevels, toBits, traceRay } from '@/features/stations/logic/fiber';
import { codeScore, pickScenarios, requiredWires, simulate, wireScore } from '@/features/stations/logic/maker';
import { interference, initialChannels, makePacket, packetTtlMs, routeFor, slotNeeds, wifiScore } from '@/features/stations/logic/network';
import { maxScore, pickCards, securityCards, segmentCard } from '@/features/stations/logic/security';
import { blur, filtered, grayscale, GRID, makeDataset, modelAccuracy, modelQuality, sobel, stopQuality, validationLoss } from '@/features/stations/logic/vision';
import { dialScore, jitterScore, mosScore, PHRASE, schedulePackets, sipScore } from '@/features/stations/logic/voip';

describe('route content', () => {
  it('follows stand → B215 → B213 → pasillo', () => {
    expect(routeStops.map((stop) => stop.id)).toEqual(['stand', 'b215', 'b213', 'hall']);
    expect(Object.keys(checkinCopy)).toEqual(['b215', 'b213', 'hall']);
  });

  it('has the five pillars of Didactic-Tel', () => {
    expect(pillars.map((pillar) => pillar.pillar)).toEqual(['Datos', 'Software', 'Redes', 'Telecomunicaciones', 'Hardware']);
    expect(new Set(pillarIds).size).toBe(5);
  });
});

describe('B215 network logic', () => {
  it('routes with the most specific match and a default route', () => {
    expect(routeFor('192.168.1.40')).toBe('lan');
    expect(routeFor('192.168.2.40')).toBe('internet');
    expect(routeFor('10.0.0.9')).toBe('servers');
    expect(routeFor('10.0.3.9')).toBe('internet');
    expect(routeFor('8.8.8.8')).toBe('internet');
  });

  it('generates packets whose answer matches the table', () => {
    const random = mulberry32(7);
    for (let i = 0; i < 50; i += 1) {
      const packet = makePacket(i, random);
      expect(packet.answer).toBe(routeFor(packet.ip));
    }
    expect(packetTtlMs(0)).toBeGreaterThan(packetTtlMs(20));
  });

  it('knows which device goes where and when Wi-Fi channels interfere', () => {
    expect(slotNeeds).toEqual({ edge: 'router', core: 'switch', wifi: 'ap' });
    expect(interference([1, 6, 11])).toBe(0);
    expect(interference([5, 6, 7])).toBeGreaterThan(0);
    expect(interference(initialChannels(mulberry32(3)))).toBeGreaterThan(0);
    expect(wifiScore(true, 1, 0)).toBe(250);
    expect(wifiScore(false, 0, 15)).toBe(0);
  });
});

describe('B213 datos · vision logic', () => {
  it('builds balanced 16×16 datasets', () => {
    const images = makeDataset(10, mulberry32(1));
    expect(images).toHaveLength(10);
    expect(images.filter((image) => image.species === 'gato')).toHaveLength(5);
    images.forEach((image) => expect(image.pixels).toHaveLength(GRID * GRID));
  });

  it('applies real edge and blur filters', () => {
    const [image] = makeDataset(1, mulberry32(2));
    const gray = grayscale(image);
    const edges = sobel(gray);
    const smooth = blur(gray);
    expect(Math.max(...edges)).toBeGreaterThan(0.5);
    const variance = (values: number[]) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    };
    expect(variance(smooth)).toBeLessThan(variance(gray));
    expect(filtered(image, 'bordes')[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('overfits after the best epoch and rewards good choices', () => {
    expect(validationLoss(25, 12)).toBeGreaterThan(validationLoss(12, 12));
    expect(stopQuality(12, 12)).toBe(1);
    expect(modelAccuracy(modelQuality(1, 'bordes', 1))).toBe(1);
    expect(modelAccuracy(modelQuality(0.5, 'desenfoque', 0))).toBeLessThan(0.75);
  });
});

describe('B213 software · security logic', () => {
  it('picks six threats and four legit messages', () => {
    const cards = pickCards(mulberry32(4));
    expect(cards.filter((card) => card.threat)).toHaveLength(6);
    expect(cards.filter((card) => !card.threat)).toHaveLength(4);
    expect(maxScore(cards)).toBeGreaterThan(900);
  });

  it('marks every red flag inside its message', () => {
    securityCards.forEach((card) => {
      const segments = segmentCard(card);
      expect(segments.body.map((segment) => segment.text).join('')).toBe(card.body);
      expect(segments.from.map((segment) => segment.text).join('')).toBe(card.from);
      const marked = [...segments.from, ...segments.body].filter((segment) => segment.flag !== null);
      expect(marked).toHaveLength(card.flags.length);
    });
  });
});

describe('B213 teleco · fiber logic', () => {
  const geometry = { laserX: 30, laserY: 112, entryX: 140, exitX: 330, coreTop: 95, coreBottom: 129 };

  it('computes the acceptance angle from the refractive indexes', () => {
    expect(acceptanceAngle(fiberLevels[0].cladding)).toBeCloseTo(14.03, 1);
    expect(acceptanceAngle(fiberLevels[2].cladding)).toBeLessThan(acceptanceAngle(fiberLevels[0].cladding));
  });

  it('delivers small angles, leaks steep ones and misses the core', () => {
    expect(traceRay(geometry, 8, 1.46).outcome).toBe('delivered');
    expect(traceRay(geometry, 8, 1.46).bounces).toBeGreaterThan(0);
    expect(traceRay({ ...geometry, laserY: 100 }, 5, 1.475).outcome).not.toBe('missed');
    expect(traceRay(geometry, 30, 1.46).outcome).toBe('missed');
    expect(traceRay({ ...geometry, entryX: 60 }, 25, 1.46).outcome).toBe('leaked');
  });

  it('encodes words as ASCII bits', () => {
    expect(toBits('A')).toEqual([0, 1, 0, 0, 0, 0, 0, 1]);
    expect(decodeBits(toBits('HOLA'))).toBe('HOLA');
  });
});

describe('B213 redes · VoIP logic', () => {
  it('schedules jittered packets and scores the call', () => {
    const packets = schedulePackets(mulberry32(5), 0);
    expect(packets).toHaveLength(PHRASE.length);
    const order = [...packets].sort((a, b) => a.arrivesAt - b.arrivesAt).map((packet) => packet.seq);
    expect(order).not.toEqual(packets.map((packet) => packet.seq));
    expect(jitterScore(10, 0)).toBe(550);
    expect(mosScore(10)).toBe(4.5);
    expect(sipScore(0)).toBe(300);
    expect(dialScore(0, 0)).toBe(150);
  });
});

describe('B213 hardware · maker logic', () => {
  it('simulates the blink program', () => {
    expect(simulate(['high', 'delay', 'low', 'delay2']).blinks).toBe(true);
    expect(simulate(['delay', 'high', 'delay2', 'low']).blinks).toBe(true);
    expect(simulate(['high', 'low', 'delay', 'delay2']).blinks).toBe(false);
    expect(simulate(['high', 'delay', 'delay2', 'low']).message).toContain('siempre encendido');
  });

  it('wires the LED to pin 13 and ground', () => {
    expect(requiredWires).toEqual({ resistor: 'D13', cathode: 'GND' });
    expect(wireScore(0)).toBe(300);
    expect(codeScore(1, true)).toBe(500);
    expect(pickScenarios(mulberry32(6))).toHaveLength(4);
  });
});
