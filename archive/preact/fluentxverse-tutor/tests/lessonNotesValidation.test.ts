import { expect, test } from 'bun:test';
import type { ClassroomNotesRecord } from '../src/api/tutor.api';
import { validateLessonNotesEditor, validateLessonFeedback, STUDENT_FEEDBACK_MIN_LENGTH, TUTOR_HANDOFF_MAX_LENGTH } from '../src/utils/lessonNotesValidation';
import { assertLessonFeedback, STUDENT_FEEDBACK_MIN_LENGTH as serverMin, TUTOR_HANDOFF_MAX_LENGTH as serverMax } from '../../fluentxverse-server/src/utils/lessonFeedbackValidation';
import { ENGLISH_LEVELS } from '../src/data/englishLevels';
import { ENGLISH_LEVELS as studentLevels } from '../../fluentxverse-student/src/data/japanProfileOptions';

const material = (type: string, status: 'in_progress' | 'completed', stoppedAt: string | null) => ({
  materialType: type, completionStatus: status, stoppedAt, stoppedAtLabel: stoppedAt?.trim() ? 'Exercise' : null,
} as ClassroomNotesRecord);

test('all in-progress curriculum materials require a stopping point', () => {
  const business = material('business-english', 'in_progress', null);
  const conversation = material('conversational-skills', 'in_progress', '  ');
  const result = validateLessonNotesEditor({ studentComment: 'a'.repeat(100), tutorMemo: '', materials: [
    material('daily-dispatch', 'in_progress', null), business, conversation,
    material('business-english', 'completed', null),
    material('conversational-skills', 'in_progress', 'exerciseData.stepA'),
  ] });
  expect(result.stoppingPoints).toEqual([business, conversation]);
  expect(result.studentFeedback).toBe(false);
});

test('a stopping point needs its saved label, matching submission validation', () => {
  const incomplete = { ...material('business-english', 'in_progress', 'practice'), stoppedAtLabel: null };
  expect(validateLessonNotesEditor({ materials: [incomplete], studentComment: 'a'.repeat(100), tutorMemo: '' }).stoppingPoints).toEqual([incomplete]);
});

test('student feedback needs 100 characters excluding surrounding whitespace', () => {
  for (const studentComment of ['', '  \n\t', 'a'.repeat(99), ` ${'a'.repeat(99)} `]) {
    expect(validateLessonNotesEditor({ materials: [], studentComment, tutorMemo: '' }).studentFeedback).toBe(true);
  }
  expect(validateLessonFeedback({ studentComment: ` ${'a'.repeat(100)} `, tutorMemo: '' }).studentFeedback).toBe(false);
});

test('feedback-only lessons need neither a handoff nor an assessment', () => {
  expect(validateLessonNotesEditor({ materials: [], studentComment: 'a'.repeat(100), tutorMemo: '' })).toEqual({
    stoppingPoints: [], studentFeedback: false, tutorHandoff: false,
  });
});

test('handoff is optional and allows at most 150 characters, matching the server', () => {
  expect(STUDENT_FEEDBACK_MIN_LENGTH).toBe(serverMin);
  expect(TUTOR_HANDOFF_MAX_LENGTH).toBe(serverMax);
  for (const length of [0, 149, 150, 151]) {
    const notes = { studentComment: 'a'.repeat(100), tutorMemo: 'b'.repeat(length) };
    expect(validateLessonFeedback(notes).tutorHandoff).toBe(length > 150);
    if (length > 150) expect(() => assertLessonFeedback(notes.studentComment, notes.tutorMemo)).toThrow('150 characters');
    else expect(() => assertLessonFeedback(notes.studentComment, notes.tutorMemo)).not.toThrow();
  }
  expect(() => assertLessonFeedback('a'.repeat(99), '')).toThrow('100 characters');
});

test('assessment choices exactly match the student edit-profile levels', () => {
  expect(ENGLISH_LEVELS).toEqual(studentLevels);
  expect(ENGLISH_LEVELS).toHaveLength(10);
});
