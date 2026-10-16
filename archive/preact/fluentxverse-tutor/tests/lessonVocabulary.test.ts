import { expect, test } from 'bun:test';
import { getLessonVocabularyMeaning } from '../src/utils/lessonVocabulary';

const definitions = [
  {meaning: 'Border between two regions', partOfSpeech: 'noun'},
  {meaning: ' A new area of knowledge or development ', partOfSpeech: 'noun'},
];

test('uses the meaning selected by the tutor and trims surrounding whitespace', () => {
  expect(getLessonVocabularyMeaning({definitions, selectedDefinitionIndex: 1})).toBe('A new area of knowledge or development');
});

test('handles legacy missing definitions without generating or inventing a meaning', () => {
  expect(getLessonVocabularyMeaning({})).toBe('No definition recorded.');
  expect(getLessonVocabularyMeaning({definitions: []})).toBe('No definition recorded.');
  expect(getLessonVocabularyMeaning({definitions: [{meaning: ' ', partOfSpeech: 'noun'}]})).toBe('No definition recorded.');
});

test('keeps invalid saved selection indices within the available definitions', () => {
  expect(getLessonVocabularyMeaning({definitions})).toBe('Border between two regions');
  expect(getLessonVocabularyMeaning({definitions, selectedDefinitionIndex: -1})).toBe('Border between two regions');
  expect(getLessonVocabularyMeaning({definitions, selectedDefinitionIndex: 99})).toBe('A new area of knowledge or development');
  expect(getLessonVocabularyMeaning({definitions, selectedDefinitionIndex: NaN})).toBe('Border between two regions');
});
