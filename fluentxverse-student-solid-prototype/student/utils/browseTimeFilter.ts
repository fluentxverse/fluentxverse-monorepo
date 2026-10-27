const MINUTE_MS = 60_000;
const PHT_OFFSET_MS = 8 * 60 * MINUTE_MS;
// Confirmed slots remain bookable through five minutes before class.
const MINIMUM_BOOKING_LEAD_MS = 5 * MINUTE_MS;
const formatMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export const BROWSE_START_TIMES = Array.from({ length: 38 }, (_, index) => formatMinutes(300 + index * 30));
export const BROWSE_END_TIMES = BROWSE_START_TIMES.map(time => formatMinutes(toMinutes(time) + 30));

export interface BrowseTimeRange {
  date: string;
  startTime: string;
  endTime: string;
}

export const browseOperationalDate = (now: number) => new Date(now + PHT_OFFSET_MS).toISOString().slice(0, 10);
export const nextBrowseDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
export const nextBrowseBoundary = (time: string) => formatMinutes(toMinutes(time) + 30);

export function bookableBrowseStarts(date: string, now: number): string[] {
  const midnight = Date.parse(`${date}T00:00:00+08:00`);
  return BROWSE_START_TIMES.filter(time => midnight + toMinutes(time) * MINUTE_MS - MINIMUM_BOOKING_LEAD_MS >= now);
}

export function defaultBrowseTimeRange(now: number): BrowseTimeRange {
  let date = browseOperationalDate(now);
  let startTime = bookableBrowseStarts(date, now)[0];
  if (!startTime) {
    date = nextBrowseDate(date);
    startTime = BROWSE_START_TIMES[0];
  }
  return { date, startTime, endTime: nextBrowseBoundary(startTime) };
}

export function normalizeBrowseTimeRange(range: BrowseTimeRange, now: number): BrowseTimeRange {
  const starts = bookableBrowseStarts(range.date, now);
  if (!starts.length) return defaultBrowseTimeRange(now);
  const startTime = starts.includes(range.startTime) ? range.startTime : starts[0];
  const endTime = BROWSE_END_TIMES.includes(range.endTime) && range.endTime > startTime
    ? range.endTime : nextBrowseBoundary(startTime);
  return { date: range.date, startTime, endTime };
}

export function browseTimeLabel(time: string): string {
  const jstMinutes = toMinutes(time) + 60;
  return `${formatMinutes(jstMinutes % 1440)}${jstMinutes >= 1440 ? ' (+1 day)' : ''}`;
}
