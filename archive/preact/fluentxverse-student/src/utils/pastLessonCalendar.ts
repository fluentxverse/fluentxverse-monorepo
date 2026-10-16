export function isCalendarMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

export function calendarDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function calendarMonthDays(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const start = first.getTime() - first.getUTCDay() * 86_400_000;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start + index * 86_400_000);
    const key = calendarDayKey(date);
    return { key, day: date.getUTCDate(), inMonth: key.startsWith(`${month}-`) };
  });
}

export function shiftCalendarMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function groupCalendarLessons<T extends { dateStr: string; date: Date }>(lessons: T[]) {
  const grouped = new Map<string, T[]>();
  for (const lesson of lessons) {
    const group = grouped.get(lesson.dateStr) || [];
    group.push(lesson);
    grouped.set(lesson.dateStr, group);
  }
  for (const group of grouped.values()) group.sort((a, b) => a.date.getTime() - b.date.getTime());
  return grouped;
}
