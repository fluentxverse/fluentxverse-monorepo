import { expect, test } from 'bun:test';
import { slotNotesIndicator } from '../tutor/utils/slotNotesIndicator';

const endsAt = '2026-10-28T13:25:00Z';
const end = Date.parse(endsAt);

test('attendance stays unchanged until the scheduled end, including during a lesson', () => {
  for (const status of ['draft', 'changes_pending', 'submitted', 'not_required'] as const) {
    expect(slotNotesIndicator(endsAt, status, end - 1)).toBe('attendance');
  }
});

test('ended lessons distinguish submitted notes, unsent drafts and exemptions', () => {
  expect(slotNotesIndicator(endsAt, 'draft', end)).toBe('incomplete');
  expect(slotNotesIndicator(endsAt, 'changes_pending', end)).toBe('incomplete');
  expect(slotNotesIndicator(endsAt, 'submitted', end)).toBe('complete');
  expect(slotNotesIndicator(endsAt, 'not_required', end)).toBe('not_required');
});

test('missing or invalid server state never produces a false success or failure', () => {
  expect(slotNotesIndicator(undefined, 'draft', end)).toBe('attendance');
  expect(slotNotesIndicator('invalid', 'submitted', end)).toBe('attendance');
  expect(slotNotesIndicator(endsAt, undefined, end)).toBe('attendance');
});
