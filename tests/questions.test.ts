import { pickMillionaireQuestions, pickPracticeQuestions, quizQuestions, shuffleOptions } from '@/data/questions';
import { seededRandom } from '@/graphics/shapes';
import type { KnowledgeArea } from '@/types/game';

const areas: KnowledgeArea[] = ['redes', 'software', 'hardware', 'teleco', 'seguridad'];

describe('quiz questions', () => {
  it('has a bank of at least forty questions with unique ids', () => {
    expect(quizQuestions.length).toBeGreaterThanOrEqual(40);
    expect(new Set(quizQuestions.map((question) => question.id)).size).toBe(quizQuestions.length);
  });

  it('has valid options, answer index and explanation', () => {
    for (const question of quizQuestions) {
      expect(question.prompt.length).toBeGreaterThan(10);
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(4);
      expect(question.explanation.length).toBeGreaterThan(20);
    }
  });

  it('covers every area with at least six questions and all difficulties', () => {
    for (const area of areas) {
      expect(quizQuestions.filter((question) => question.area === area).length).toBeGreaterThanOrEqual(6);
    }
    expect(new Set(quizQuestions.map((question) => question.difficulty))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('builds a ten-step ladder of growing difficulty', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const ladder = pickMillionaireQuestions(seededRandom(seed));
      expect(ladder).toHaveLength(10);
      expect(new Set(ladder.map((question) => question.id)).size).toBe(10);
      ladder.slice(1).forEach((question, index) => {
        expect(question.difficulty).toBeGreaterThanOrEqual(ladder[index].difficulty);
      });
    }
  });

  it('builds practice rounds from a single area', () => {
    const round = pickPracticeQuestions('seguridad', 5, seededRandom(4));
    expect(round).toHaveLength(5);
    expect(round.every((question) => question.area === 'seguridad')).toBe(true);
  });

  it('keeps the right answer when shuffling options', () => {
    const question = quizQuestions[0];
    const shuffled = shuffleOptions(question, seededRandom(7));
    expect(shuffled.options[shuffled.answerIndex]).toBe(question.options[question.answerIndex]);
  });
});
