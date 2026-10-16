import { expect, test } from 'bun:test';
import { lessonMaterialPosition } from '../src/utils/lessonMaterialPosition';

test('Conversational Skills includes level and chapter when available', () => {
  expect(lessonMaterialPosition({ materialType: 'conversational-skills', materialLevel: 3, materialChapter: 1 })).toBe('Level 3 \u00b7 Chapter 1');
});

test('missing or invalid curriculum metadata is not invented', () => {
  expect(lessonMaterialPosition({ materialType: 'conversational-skills' })).toBe('');
  expect(lessonMaterialPosition({ materialType: 'conversational-skills', materialLevel: 3, materialChapter: null })).toBe('Level 3');
  expect(lessonMaterialPosition({ materialType: 'conversational-skills', materialLevel: 0, materialChapter: NaN })).toBe('');
});

test('other curriculum labels stay unchanged', () => {
  for (const materialType of ['daily-dispatch', 'business-english']) {
    expect(lessonMaterialPosition({ materialType, materialLevel: 3, materialChapter: 1 })).toBe('');
  }
});
