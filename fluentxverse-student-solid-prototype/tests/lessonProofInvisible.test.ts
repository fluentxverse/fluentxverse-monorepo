import { expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';

test('student schedule has no ZK lesson proof actions, status polling or public links', () => {
  const source = readFileSync(new URL('../student/pages/SchedulePage.tsx', import.meta.url), 'utf8');
  for (const forbidden of ['lessonProofApi', 'Claim proof', 'Submit proof', 'Retry proof', '/proof/student-lessons', 'proofLoading', 'setLessonProofs']) {
    expect(source).not.toContain(forbidden);
  }
  expect(existsSync(new URL('../student/api/lessonProof.api.ts', import.meta.url))).toBe(false);
});
