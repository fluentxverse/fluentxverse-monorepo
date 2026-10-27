import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { studentOverview } from '../src/data/studentOverview';

function text() { return JSON.stringify(studentOverview); }
test('student guide covers a distinct learner journey with valid reading blocks', () => {
  expect(studentOverview.path).toBe('/esl-student-app');
  expect(studentOverview.portalHref).toBe('https://student.fluentxverse.com');
  expect(studentOverview.chapters).toHaveLength(14);
  expect(new Set(studentOverview.chapters.map(chapter => chapter.id)).size).toBe(14);
  for (const id of ['find-a-tutor','booking-a-lesson','the-classroom','learning-materials','profile-and-notes','consent-and-privacy','feedback-and-proof']) expect(studentOverview.chapters.some(chapter => chapter.id === id)).toBe(true);
  for (const chapter of studentOverview.chapters) {
    expect(chapter.blocks.length).toBeGreaterThan(1);
    for (const block of chapter.blocks) if(block.kind === 'table') for(const row of block.rows) expect(row.length).toBe(block.headings.length);
  }
});
test('student claims retain eligibility, privacy and outcomes boundaries', () => {
  expect(text()).toContain('does not require a wallet');
  expect(text()).toContain('not a live service audit');
  expect(text()).toContain('do not mean every proposed collection is published');
  expect(text()).toContain('not published traction');
  expect(text()).toContain('Small groups and outside information');
  expect(text()).toContain('not a promise of guaranteed fluency');
  expect(text()).not.toMatch(/BEGIN (?:RSA )?PRIVATE KEY|0x[a-fA-F0-9]{40}|\.env\b/);
});
test('public guide only imports source types, never a protected student API or dashboard module', () => {
  const content = readFileSync(new URL('../src/data/studentOverview.ts',import.meta.url),'utf8');
  expect(content).not.toMatch(/from.*(?:student\/api|fluentxverse-dashboard|fluentxverse-server)/);
  const component = readFileSync(new URL('../src/components/PublicAppGuide.tsx',import.meta.url),'utf8');
  expect(component).not.toMatch(/fetch\(|axios|\.fluentxverse\.com\/api/);
});
