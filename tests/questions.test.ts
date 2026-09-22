import { quizQuestions } from '@/data/questions';

describe('quiz questions', () => {
  it('has ten playable questions', () => {
    expect(quizQuestions).toHaveLength(10);
  });

  it('has valid options, answer index and explanation', () => {
    for (const question of quizQuestions) {
      expect(question.id).toBeTruthy();
      expect(question.prompt.length).toBeGreaterThan(10);
      expect(question.options).toHaveLength(4);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(4);
      expect(question.explanation.length).toBeGreaterThan(20);
    }
  });

  it('covers all knowledge areas and increases difficulty', () => {
    const areas = new Set(quizQuestions.map((question) => question.area));
    expect(areas).toEqual(new Set(['redes', 'software', 'hardware', 'teleco', 'seguridad']));
    expect(quizQuestions[0].difficulty).toBeLessThan(quizQuestions[quizQuestions.length - 1].difficulty);
  });
});
