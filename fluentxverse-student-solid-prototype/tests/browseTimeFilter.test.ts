import { describe, expect, test } from 'bun:test';
import { BROWSE_START_TIMES, BROWSE_END_TIMES, bookableBrowseStarts, browseOperationalDate, browseTimeLabel, defaultBrowseTimeRange, normalizeBrowseTimeRange } from '../student/utils/browseTimeFilter';

describe('bookable browse time windows', () => {
  for (const [iso, date, startTime, endTime] of [
    ['2026-10-22T16:00:00Z', '2026-10-23', '05:00', '05:30'],
    ['2026-10-23T03:12:00Z', '2026-10-23', '11:30', '12:00'],
    ['2026-10-23T03:25:00Z', '2026-10-23', '11:30', '12:00'],
    ['2026-10-23T03:25:00.001Z', '2026-10-23', '12:00', '12:30'],
    ['2026-10-23T15:25:00Z', '2026-10-23', '23:30', '24:00'],
    ['2026-10-23T15:25:00.001Z', '2026-10-24', '05:00', '05:30'],
    ['2026-10-23T16:00:00Z', '2026-10-24', '05:00', '05:30'],
  ]) test(`${iso}: next eligible half-hour`, () => {
    expect(defaultBrowseTimeRange(Date.parse(iso))).toEqual({ date, startTime, endTime });
  });

  test('elapsed periods disappear only for the applicable date', () => {
    const now = Date.parse('2026-10-23T03:26:00Z');
    expect(bookableBrowseStarts('2026-10-23', now)[0]).toBe('12:00');
    expect(bookableBrowseStarts('2026-10-24', now)).toEqual(BROWSE_START_TIMES);
    expect(bookableBrowseStarts('2026-10-22', now)).toEqual([]);
    expect(BROWSE_START_TIMES.at(-1)).toBe('23:30');
    expect(BROWSE_END_TIMES.at(-1)).toBe('24:00');
  });

  test('stale selections advance without overwriting valid future selections', () => {
    const now = Date.parse('2026-10-23T03:26:00Z');
    expect(normalizeBrowseTimeRange({ date: '2026-10-23', startTime: '11:30', endTime: '12:00' }, now)).toEqual({ date: '2026-10-23', startTime: '12:00', endTime: '12:30' });
    const future = { date: '2026-10-24', startTime: '05:00', endTime: '08:30' };
    expect(normalizeBrowseTimeRange(future, now)).toEqual(future);
    expect(normalizeBrowseTimeRange({ date: '2026-10-22', startTime: '05:00', endTime: '05:30' }, now)).toEqual(defaultBrowseTimeRange(now));
  });

  test('date and JST labels do not depend on the browser timezone', () => {
    expect(browseOperationalDate(Date.parse('2026-10-23T16:00:00Z'))).toBe('2026-10-24');
    expect(browseTimeLabel('05:00')).toBe('06:00');
    expect(browseTimeLabel('23:30')).toBe('00:30 (+1 day)');
    expect(browseTimeLabel('24:00')).toBe('01:00 (+1 day)');
  });
});
