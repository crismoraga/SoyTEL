import { fireEvent, render } from '@testing-library/react-native';
import { getMicroGame } from '@/features/burst/registry';
import * as gens from '@/features/burst/packs/quickRounds';
import { b215Rounds, pickB215Rounds, roundTrack } from '@/features/stations/b215/pool';
import { antenaApunta, armaApp, armaPc, cazaBug, enciendeLed, radioSintoniza, robotCodigo } from '@/features/stations/b215/rounds/QuickRounds';
import { mulberry32 } from '@/route/random';

// Microjuegos de elección rápida y rondas nuevas del circuito B215.
describe('microjuegos de elección rápida', () => {
  const all = { ...gens, antenaApunta, armaApp, armaPc, cazaBug, enciendeLed, radioSintoniza, robotCodigo };
  it.each(Object.entries(all))('%s siempre tiene una sola respuesta válida', (_, generate) => {
    for (let seed = 1; seed <= 80; seed += 1) {
      for (const level of [0, 2, 3]) {
        const round = generate(level, mulberry32(seed * 7 + level));
        expect(round.answer).toBeGreaterThanOrEqual(0);
        expect(round.answer).toBeLessThan(round.options.length);
        expect(new Set(round.options).size).toBe(round.options.length);
        expect(round.note.length).toBeGreaterThan(5);
      }
    }
  });

  it('un microjuego llama a onAnswer una sola vez', () => {
    const game = getMicroGame('logic-gate');
    if (!game) throw new Error('falta logic-gate');
    const onAnswer = jest.fn();
    const screen = render(<game.Component durationSeconds={10} level={0} pace={1} active onAnswer={onAnswer} />);
    fireEvent.press(screen.getByText('Sí, se enciende (1)'));
    fireEvent.press(screen.getByText('No, queda apagado (0)'));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});

describe('circuito B215: redes, hardware/telecom y software', () => {
  it('cada ruta toca un lado distinto de la carrera y varía con la semilla', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const picked = pickB215Rounds(3, seed);
      expect(picked.map(roundTrack)).toEqual(['redes', expect.stringMatching(/hardware|telecom/), 'software']);
      seen.add(picked.map((round) => round.id).join());
    }
    expect(seen.size).toBeGreaterThan(15);
    expect(b215Rounds.filter((round) => round.id.startsWith('rafaga-'))).toHaveLength(4);
  });
});
