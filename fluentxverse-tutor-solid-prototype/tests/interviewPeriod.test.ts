import { expect, test } from 'bun:test';
import { currentInterviewPeriod } from '../tutor/utils/interviewPeriod';

test('interview periods follow Manila boundaries, independent of device timezone', () => {
  for (const [time, period] of [
    ['00:00:00', 'morning'], ['04:59:59', 'morning'],
    ['05:00:00', 'morning'], ['11:59:59', 'morning'],
    ['12:00:00', 'afternoon'], ['17:59:59', 'afternoon'],
    ['18:00:00', 'evening'], ['23:59:59', 'evening'],
  ] as const) {
    expect(currentInterviewPeriod(new Date(`2026-10-27T${time}+08:00`))).toBe(period);
  }
  expect(currentInterviewPeriod(new Date('2026-10-27T04:00:00Z'))).toBe('afternoon');
  expect(currentInterviewPeriod(new Date('2026-10-27T16:00:00Z'))).toBe('morning');
});
