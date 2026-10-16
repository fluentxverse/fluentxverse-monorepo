import { expect, test } from 'bun:test';
import { canCancelLesson } from '../src/utils/lessonCancellation';

test('only confirmed lessons more than five minutes before start can be cancelled', () => {
  const start = Date.parse('2026-10-07T06:30:00Z');
  expect(canCancelLesson('confirmed', start, start - 5 * 60_000 - 1)).toBe(true);
  for (const now of [start - 5 * 60_000, start - 1, start, start + 1, start + 25 * 60_000]) {
    expect(canCancelLesson('confirmed', start, now)).toBe(false);
  }
  for (const status of ['completed', 'cancelled', 'pending', '']) {
    expect(canCancelLesson(status, start, start - 1)).toBe(false);
  }
  expect(canCancelLesson('confirmed', NaN, start)).toBe(false);
});
