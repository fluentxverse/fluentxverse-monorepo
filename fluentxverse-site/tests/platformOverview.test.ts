import { expect, test } from 'bun:test';
import { filterOverview, overviewChapters, overviewGlossary, overviewReadingMinutes, overviewText } from '../src/data/platformOverview';

test('public chapters are unique, complete, self-contained and searchable', () => {
  expect(overviewChapters.length).toBe(14);
  expect(new Set(overviewChapters.map(chapter => chapter.id)).size).toBe(14);
  expect(overviewReadingMinutes).toBeGreaterThan(5);
  for (const chapter of overviewChapters) {
    expect(chapter.blocks.length).toBeGreaterThan(1);
    expect(overviewText(chapter).length).toBeGreaterThan(300);
    for (const block of chapter.blocks) if (block.kind === 'table') {
      for (const row of block.rows) expect(row.length).toBe(block.headings.length);
    }
  }
  expect(overviewGlossary.length).toBe(6);
});
test('search covers prose, tables and caveats; topic and words combine', () => {
  expect(filterOverview('TRANSCRIPT', 'Technology').map(chapter => chapter.id)).toContain('materials-ai');
  expect(filterOverview('trial wallet', 'Business').map(chapter => chapter.id)).toContain('commercial-model');
  expect(filterOverview('receipt destination').map(chapter => chapter.id)).toContain('networks-status');
  expect(filterOverview('nothing-matches-this')).toHaveLength(0);
  expect(filterOverview('  ', 'All')).toHaveLength(14);
});
test('public version retains claims boundaries without private records or dashboard imports', () => {
  const text = overviewChapters.map(overviewText).join(' ');
  expect(text).toContain('not a live deployment audit');
  expect(text).toContain('not published traction');
  expect(text).toContain('not a claim that automatic earnings and payroll are running');
  expect(text).toContain('does not prove correct AI execution');
  expect(text).not.toMatch(/(?:BEGIN (?:RSA )?PRIVATE KEY|0x[a-fA-F0-9]{40}|api[_-]?key\s*[:=]|\.env\b)/);
});
