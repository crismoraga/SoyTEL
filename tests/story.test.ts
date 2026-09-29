import { journeyStations } from '@/data/journey';
import { getChapter, storyChapters } from '@/data/story';
import { medallionGlyphs } from '@/graphics/medallions';
import { telixExpressions } from '@/graphics/telix';

describe('story mode data', () => {
  it('has five ordered chapters', () => {
    expect(storyChapters).toHaveLength(5);
    expect(storyChapters.map((chapter) => chapter.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every chapter has Telix dialogue and a valid challenge', () => {
    for (const chapter of storyChapters) {
      expect(chapter.title.length).toBeGreaterThan(3);
      expect(chapter.dialogue.length).toBeGreaterThanOrEqual(2);
      chapter.dialogue.forEach((line) => {
        expect(telixExpressions).toContain(line.mood);
        expect(line.text.length).toBeGreaterThan(10);
      });
      expect(chapter.challenge.options).toHaveLength(4);
      expect(chapter.challenge.answerIndex).toBeGreaterThanOrEqual(0);
      expect(chapter.challenge.answerIndex).toBeLessThan(4);
      expect(chapter.challenge.explanation.length).toBeGreaterThan(20);
      expect(chapter.challenge.hint.length).toBeGreaterThan(5);
      expect(medallionGlyphs[chapter.glyph]).toBeDefined();
    }
  });

  it('places every chapter inside the campus map', () => {
    for (const chapter of storyChapters) {
      expect(chapter.map.x).toBeGreaterThan(0);
      expect(chapter.map.x).toBeLessThan(100);
      expect(chapter.map.y).toBeGreaterThan(0);
      expect(chapter.map.y).toBeLessThan(100);
    }
  });

  it('rewards increase with chapter difficulty', () => {
    storyChapters.slice(1).forEach((chapter, index) => {
      expect(chapter.rewardXp).toBeGreaterThan(storyChapters[index].rewardXp);
    });
  });

  it('finds chapters by id', () => {
    expect(getChapter('chapter-2')?.title).toBe('Interferencia en el laboratorio');
    expect(getChapter('nope')).toBeUndefined();
  });
});

describe('journey stations', () => {
  it('has five numbered stations with a group task and a challenge', () => {
    expect(journeyStations.map((station) => station.number)).toEqual([1, 2, 3, 4, 5]);
    for (const station of journeyStations) {
      expect(station.task.length).toBeGreaterThan(20);
      expect(station.challenge.options).toHaveLength(4);
      expect(station.points).toBeGreaterThan(0);
      expect(medallionGlyphs[station.glyph]).toBeDefined();
    }
  });
});
