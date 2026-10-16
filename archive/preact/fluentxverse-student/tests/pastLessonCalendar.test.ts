import { describe, expect, test } from 'bun:test';
import { calendarMonthDays, groupCalendarLessons, isCalendarMonth, shiftCalendarMonth } from '../src/utils/pastLessonCalendar';

describe('past lesson monthly calendar', () => {
  test('keeps six complete weeks, including leap days and neighboring dates', () => {
    const days = calendarMonthDays('2024-02');
    expect(days).toHaveLength(42);
    expect(days[0]?.key).toBe('2024-01-28');
    expect(days.at(-1)?.key).toBe('2024-03-09');
    expect(days.filter(day => day.inMonth)).toHaveLength(29);
    expect(days.find(day => day.key === '2024-02-29')?.inMonth).toBe(true);
    expect(days[0]?.inMonth).toBe(false);
  });
  test('month navigation crosses years and rejects malformed query months', () => {
    expect(shiftCalendarMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftCalendarMonth('2026-01', -1)).toBe('2025-12');
    expect(isCalendarMonth('2026-10')).toBe(true);
    for (const value of [null, '2026-00', '2026-13', '2026-1', 'wrong']) expect(isCalendarMonth(value)).toBe(false);
  });
  test('groups multiple lessons by their displayed day, not the browser timezone', () => {
    const lessons = [
      { id: 'later', dateStr: '2026-10-07', date: new Date('2026-10-07T03:00:00Z') },
      { id: 'midnight', dateStr: '2026-10-01', date: new Date('2026-09-30T15:30:00Z') },
      { id: 'earlier', dateStr: '2026-10-07', date: new Date('2026-10-07T01:00:00Z') },
    ];
    const grouped = groupCalendarLessons(lessons);
    expect(grouped.get('2026-10-07')?.map(lesson => lesson.id)).toEqual(['earlier', 'later']);
    expect(grouped.get('2026-10-01')?.[0]?.id).toBe('midnight');
    expect(grouped.has('2026-09-30')).toBe(false);
    expect(lessons.map(lesson => lesson.id)).toEqual(['later', 'midnight', 'earlier']);
    expect(groupCalendarLessons([]).size).toBe(0);
  });
});
