import { expect, test } from 'bun:test';
import { getMarkableExerciseItems } from '../src/utils/conversationalExerciseMarks';

test('maps choose and multiple-choice items to independent Step A and B marks', () => {
  const items = getMarkableExerciseItems({
    stepAType: 'choose',
    chooseItems: [{ sentence: 'I (go / went) yesterday.' }, { sentence: 'She (has / have) tea.' }],
    answers: [{ text: 'went' }, { text: 'has' }],
    hasStepB: true,
    stepBType: 'multiple-choice',
    multipleChoiceItems: [{ boldSentence: 'What changed?', optionA: 'The time', optionB: 'The place' }],
    stepBTutorSteps: [{ answerKey: [{ text: 'B - the place' }] }],
  });
  expect(items.A.map(item => item.answerKey)).toEqual(['went', 'has']);
  expect(items.B[0]).toMatchObject({ step: 'B', itemIndex: 0, itemType: 'multiple-choice', answerKey: 'B - the place' });
  expect(items.B[0].prompt).toContain('B. The place');
});

test('uses the selected exercise branches and omits disabled Step B', () => {
  const items = getMarkableExerciseItems({
    stepAType: 'change',
    exerciseItems: [{ sentence: 'Inactive rephrase' }],
    changeItems: [{ sentence: 'Change this' }],
    tutorSteps: [{ answerKey: [{ text: 'Changed' }] }],
    hasStepB: false,
    multipleChoiceItems: [{ boldSentence: 'Inactive', optionA: 'A', optionB: 'B' }],
  });
  expect(items.A).toHaveLength(1);
  expect(items.A[0].prompt).toBe('Change this');
  expect(items.B).toEqual([]);
});
