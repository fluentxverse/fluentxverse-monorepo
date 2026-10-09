import { expect, test } from 'bun:test';
import { canJoinClassroom as tutorJoin } from '../src/utils/classroomWindow';
import { canJoinClassroom as studentJoin } from '../../fluentxverse-student/src/utils/classroomWindow';

for (const [role, canJoin] of [['tutor', tutorJoin], ['student', studentJoin]] as const) {
  test(`${role} permits three minutes of wrap-up, including completed lessons, but not cancellation`, () => {
    const start = Date.parse('2026-10-08T10:00:00Z'), end = start + 1500000;
    expect(canJoin('confirmed', start, end, start - 300001)).toBe(false);
    expect(canJoin('confirmed', start, end, start - 300000)).toBe(true);
    expect(canJoin('completed', start, end, end)).toBe(true);
    expect(canJoin('completed', start, end, end + 179999)).toBe(true);
    expect(canJoin('confirmed', start, end, end + 180000)).toBe(false);
    expect(canJoin('cancelled', start, end, start)).toBe(false);
    expect(canJoin('confirmed', NaN, end, start)).toBe(false);
  });
}
