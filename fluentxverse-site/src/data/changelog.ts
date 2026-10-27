import feed from './changelogEntries.json';

export const appLabels = { student: 'Student app', tutor: 'Tutor app', backend: 'Backend', engine: 'Engine' } as const;
export const changeLabels = { added: 'Added', improved: 'Improved', fixed: 'Fixed', changed: 'Changed', removed: 'Removed' } as const;
export type ChangeApp = keyof typeof appLabels;
export type ChangeType = keyof typeof changeLabels;
export interface ChangeEntry {
  id: string;
  date: string;
  apps: ChangeApp[];
  type: ChangeType;
  title: string;
  summary: string;
  details: string[];
}

export function validateChangelog(value: unknown): ChangeEntry[] {
  const data = value as { schemaVersion?: unknown; entries?: unknown } | null;
  if (data?.schemaVersion !== 1 || !Array.isArray(data.entries)) throw Error('Invalid changelog feed');
  const ids = new Set<string>();
  const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
  for (const item of data.entries) {
    const entry = item as ChangeEntry;
    if (!entry || !/^FXV-\d{8}-\d{3}$/.test(entry.id) || ids.has(entry.id)) throw Error('Changelog IDs must be unique and permanent');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(Date.parse(entry.date))
      || new Date(entry.date).toISOString().slice(0, 10) !== entry.date
      || entry.id.slice(4, 12) !== entry.date.replaceAll('-', '')) throw Error('Changelog date must match its ID');
    if (!Array.isArray(entry.apps) || !entry.apps.length || new Set(entry.apps).size !== entry.apps.length
      || entry.apps.some(app => !Object.hasOwn(appLabels, app))) throw Error('Invalid changelog apps');
    if (typeof entry.type !== 'string' || !Object.hasOwn(changeLabels, entry.type) || !text(entry.title) || !text(entry.summary)
      || !Array.isArray(entry.details) || !entry.details.every(text)) throw Error('Invalid changelog content');
    ids.add(entry.id);
  }
  return [...data.entries].sort((a, b) => b.id.localeCompare(a.id));
}

export const changelog = validateChangelog(feed);

export function filterChangelog(entries: ChangeEntry[], app = '', type = '', query = '') {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry => (!app || entry.apps.includes(app as ChangeApp)) && (!type || entry.type === type)
    && words.every(word => [entry.id, entry.date, entry.title, entry.summary, ...entry.details,
      ...entry.apps.map(app => appLabels[app]), changeLabels[entry.type]].join(' ').toLowerCase().includes(word)));
}

export const changelogUrl = (id: string) => `https://fluentxverse.com/changelog#${id}`;
export const changeDate = (date: string) => new Intl.DateTimeFormat('en', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
}).format(new Date(date));
