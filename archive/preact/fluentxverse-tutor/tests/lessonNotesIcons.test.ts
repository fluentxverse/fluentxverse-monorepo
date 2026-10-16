import { expect, test } from 'bun:test';
import { lessonNotesIcons, lessonMaterialNotesIcon } from '../src/data/lessonNotesIcons';

test('lesson notes use the classroom widget section icons', () => {
  expect(lessonNotesIcons).toMatchObject({
    words: 'fi fi-sr-book-alt', vocabulary: 'fi fi-sr-book-alt', grammar: 'fi fi-sr-text',
    pronunciation: 'fi fi-sr-microphone', studentFeedback: 'fas fa-comment-dots', tutorHandoff: 'fas fa-sticky-note',
  });
});

test('material headings use the widget curriculum icons and fallback', () => {
  expect(lessonMaterialNotesIcon('daily-dispatch')).toBe('fas fa-newspaper');
  expect(lessonMaterialNotesIcon('business-english')).toBe('fas fa-briefcase');
  expect(lessonMaterialNotesIcon('conversational-skills')).toBe('fas fa-comments');
  expect(lessonMaterialNotesIcon(null)).toBe(lessonNotesIcons.notes);
});
