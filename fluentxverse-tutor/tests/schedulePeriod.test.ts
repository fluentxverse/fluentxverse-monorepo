import { describe, expect, test } from 'bun:test';
import { getSchedulePeriod } from '../src/utils/schedulePeriod';

describe('getSchedulePeriod', () => {
  test.each([
    ['before the first morning slot', '2026-10-03T20:59:00Z', 'morning'],
    ['morning begins', '2026-10-03T21:00:00Z', 'morning'],
    ['before noon', '2026-10-04T03:59:00Z', 'morning'],
    ['noon', '2026-10-04T04:00:00Z', 'afternoon'],
    ['before evening', '2026-10-04T09:59:00Z', 'afternoon'],
    ['evening begins', '2026-10-04T10:00:00Z', 'evening'],
    ['before midnight', '2026-10-04T15:59:00Z', 'evening'],
    ['midnight', '2026-10-04T16:00:00Z', 'morning'],
  ])('%s', (_label, timestamp, expected) => {
    expect(getSchedulePeriod(Date.parse(timestamp))).toBe(expected);
  });
});
