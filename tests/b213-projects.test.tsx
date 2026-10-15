import { render } from '@testing-library/react-native';
import { AquaSenseGame, PosturaGame, WifiTrampaGame, b213Specs } from '@/features/stations/games/B213Projects';
import { mulberry32 } from '@/route/random';

// Juegos de los proyectos reales de B213: Aqua Sense, corrector de postura y Wi-Fi trampa.
describe('juegos de los proyectos de B213', () => {
  it('cada etapa de preguntas tiene una respuesta válida y opciones distintas, con cualquier semilla', () => {
    for (const spec of Object.values(b213Specs)) {
      expect(spec.stages).toHaveLength(3);
      for (const stage of spec.stages) {
        if (stage.kind !== 'quiz') {
          expect(stage.target[0]).toBeGreaterThanOrEqual(stage.min);
          expect(stage.target[1]).toBeLessThanOrEqual(stage.max);
          expect((stage.target[0] - stage.start) % stage.step).toBe(0);
          continue;
        }
        for (let seed = 1; seed <= 60; seed += 1) {
          const questions = stage.questions(mulberry32(seed));
          expect(questions.length).toBeGreaterThanOrEqual(3);
          for (const question of questions) {
            expect(question.answer).toBeGreaterThanOrEqual(0);
            expect(question.answer).toBeLessThan(question.options.length);
            expect(new Set(question.options).size).toBe(question.options.length);
            expect(question.why.length).toBeGreaterThan(10);
          }
        }
      }
    }
  });

  it('la alarma de postura suena solo sobre 20°', () => {
    const stage = b213Specs.postura.stages[0];
    if (stage.kind !== 'quiz') throw new Error('etapa inesperada');
    for (const question of stage.questions(mulberry32(7))) {
      const angle = Number(/(\d+)°/.exec(question.prompt)?.[1]);
      expect(question.options[question.answer]).toBe(angle > 20 ? '¡Suena la alarma!' : 'Se queda en silencio');
    }
  });

  it.each([
    ['Aqua Sense', AquaSenseGame],
    ['Postura', PosturaGame],
    ['Wi-Fi trampa', WifiTrampaGame],
  ])('%s abre con la presentación de la primera etapa', (_, Game) => {
    const screen = render(<Game seed={3} onComplete={jest.fn()} />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
