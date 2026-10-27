import { expect, test } from 'bun:test';
import { appLabels, changelog, changelogUrl, changeDate, filterChangelog, validateChangelog } from '../src/data/changelog';

const fixture = () => ({ schemaVersion: 1, entries: [
  { id: 'FXV-20261024-002', date: '2026-10-24', apps: ['student', 'tutor', 'backend'] as const, type: 'fixed' as const, title: 'Session handling', summary: 'Student and tutor sessions.', details: [] },
  { id: 'FXV-20261024-001', date: '2026-10-24', apps: ['backend'] as const, type: 'changed' as const, title: 'Base receipts', summary: 'Destination updated.', details: [] },
].map(entry => ({ ...entry, apps: [...entry.apps] })) });

test('published updates have unique stable IDs, valid dates, apps and descending order', () => {
  expect(validateChangelog({ schemaVersion: 1, entries: changelog })).toEqual(changelog);
  expect(new Set(changelog.map(entry => entry.id)).size).toBe(changelog.length);
  expect(changelog.map(entry => entry.id)).toEqual(changelog.map(entry => entry.id).sort().reverse());
  for (const app of Object.keys(appLabels)) expect(filterChangelog(changelog, app).length).toBeGreaterThan(0);
});

test('invalid feed records fail the release build instead of publishing ambiguous IDs', () => {
  for (const alter of [
    (v: any) => v.entries.push(v.entries[0]),
    (v: any) => v.entries[0].id = 'update-1',
    (v: any) => v.entries[0].date = '2026-02-30',
    (v: any) => v.entries[0].date = '2026-10-23',
    (v: any) => v.entries[0].apps = [],
    (v: any) => v.entries[0].apps = ['student', 'student'],
    (v: any) => v.entries[0].apps = ['admin'],
    (v: any) => v.entries[0].type = 'planned',
    (v: any) => v.entries[0].title = '  ',
    (v: any) => v.entries[0].details = [null],
  ]) {
    const input = fixture(); alter(input);
    expect(() => validateChangelog(input)).toThrow();
  }
  expect(() => validateChangelog(null)).toThrow();
  expect(() => validateChangelog({ schemaVersion: 2, entries: [] })).toThrow();
});

test('filters combine app, type and case-insensitive multiword search', () => {
  const entries = validateChangelog(fixture());
  expect(filterChangelog(entries, 'student', 'fixed', 'SESSION tutor')).toHaveLength(1);
  expect(filterChangelog(entries, 'tutor', 'changed')).toHaveLength(0);
  expect(filterChangelog(entries, '', '', 'fxv-20261024-001')).toHaveLength(1);
  expect(filterChangelog(entries, '', '', 'no-matching-update')).toHaveLength(0);
  expect(filterChangelog(entries, '', '', '   ')).toEqual(entries);
});

test('permalinks do not inherit filters and release dates cannot shift with viewer timezone', () => {
  expect(changelogUrl(changelog[0]!.id)).toBe(`https://fluentxverse.com/changelog#${changelog[0]!.id}`);
  expect(changeDate('2026-10-24')).toBe('October 24, 2026');
});

test('Engine has its own filter, searchable label and permanent released updates', () => {
  expect(appLabels.engine).toBe('Engine');
  const entries = filterChangelog(changelog, 'engine');
  expect(entries).toHaveLength(3);
  expect(entries.every(entry => entry.apps.includes('engine'))).toBe(true);
  expect(entries.some(entry => entry.type === 'added')).toBe(true);
  expect(filterChangelog(changelog, 'engine', 'fixed', 'mainnet account')).toHaveLength(1);
  expect(filterChangelog(changelog, 'backend').some(entry => entry.apps.includes('engine'))).toBe(false);
  expect(filterChangelog(changelog, '', '', 'Engine').length).toBeGreaterThanOrEqual(entries.length);
  expect(changelog.filter(entry => entry.id.startsWith('FXV-20261024-'))).toHaveLength(3);
});
