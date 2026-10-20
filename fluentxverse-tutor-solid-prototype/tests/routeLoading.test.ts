import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('route recovery does not add a second page-loading screen', () => {
  const source = readFileSync(new URL('../../shared/ui/lazyRoute.tsx', import.meta.url), 'utf8');
  expect(source).not.toContain('Opening page...');
  expect(source).not.toContain('<Suspense');
  expect(source).toContain('<ErrorBoundary');
});

test('existing application and authentication loaders are retained', () => {
  const student = readFileSync(new URL('../../fluentxverse-student-solid-prototype/student/App.tsx', import.meta.url), 'utf8');
  const tutor = readFileSync(new URL('../tutor/Components/ProtectedRoute.tsx', import.meta.url), 'utf8');
  expect(student).toContain('<Suspense fallback={<LoadingSpinner />}');
  expect(tutor).toContain('fallback={<LoadingSpinner />}');
});
