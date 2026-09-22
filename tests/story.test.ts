import { storyChapters, getChapter } from '@/data/story';

describe('story mode data', () => {
  it('has three ordered chapters', () => {
    expect(storyChapters).toHaveLength(3);
    expect(storyChapters.map((chapter) => chapter.number)).toEqual([1, 2, 3]);
  });

  it('every chapter has dialogue and a valid challenge', () => {
    for (const chapter of storyChapters) {
      expect(chapter.id).toBeTruthy();
      expect(chapter.title.length).toBeGreaterThan(3);
      expect(chapter.dialogue.length).toBeGreaterThanOrEqual(2);
      expect(chapter.challenge.options).toHaveLength(4);
      expect(chapter.challenge.answerIndex).toBeGreaterThanOrEqual(0);
      expect(chapter.challenge.answerIndex).toBeLessThan(4);
      expect(chapter.challenge.explanation.length).toBeGreaterThan(20);
      expect(chapter.rewardXp).toBeGreaterThan(0);
    }
  });

  it('rewards increase with chapter difficulty', () => {
    expect(storyChapters[0].rewardXp).toBeLessThan(storyChapters[1].rewardXp);
    expect(storyChapters[1].rewardXp).toBeLessThan(storyChapters[2].rewardXp);
  });

  it('finds chapters by id', () => {
    expect(getChapter('chapter-2')?.title).toBe('Interferencia en el laboratorio');
    expect(getChapter('nope')).toBeUndefined();
  });
});
