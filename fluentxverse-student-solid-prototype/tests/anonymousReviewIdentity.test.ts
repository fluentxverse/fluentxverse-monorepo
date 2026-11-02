import { afterEach, expect, test } from 'bun:test';
import { loadReviewIdentity, restoreReviewIdentity } from '../student/utils/anonymousReviewIdentity';
import { REVIEW_PROTOCOL } from '../student/shared/anonymousReviews';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
afterEach(() => {
  values.clear();
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
test('two lessons in one tutor group use different keys; retries restore the same lesson key', () => {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  const first = loadReviewIdentity('student', 'group', null, 'lesson-entitlement-a');
  const second = loadReviewIdentity('student', 'group', null, 'lesson-entitlement-b');
  expect(first.commitment).not.toBe(second.commitment);
  expect(loadReviewIdentity('student', 'group', first.commitment.toString(), 'lesson-entitlement-a').commitment).toBe(first.commitment);
  expect(() => loadReviewIdentity('student', 'group', first.commitment.toString(), 'lesson-entitlement-b')).toThrow();
  expect(() => loadReviewIdentity('different-student', 'group', first.commitment.toString(), 'lesson-entitlement-a')).toThrow();
});
test('backups are bound to the lesson entitlement; old monthly backups still restore', () => {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  const first = loadReviewIdentity('student', 'group', null, 'lesson-a');
  const backup = JSON.stringify({ protocol: REVIEW_PROTOCOL, groupId: 'group', entitlementId: 'lesson-a', privateKey: first.export() });
  expect(() => restoreReviewIdentity('student', 'group', first.commitment.toString(), backup, 'lesson-b')).toThrow();
  values.clear(); restoreReviewIdentity('student', 'group', first.commitment.toString(), backup, 'lesson-a');
  expect(loadReviewIdentity('student', 'group', first.commitment.toString(), 'lesson-a').commitment).toBe(first.commitment);
  const legacy = loadReviewIdentity('student', 'legacy-group', null);
  const legacyBackup = JSON.stringify({ protocol: REVIEW_PROTOCOL, groupId: 'legacy-group', privateKey: legacy.export() });
  values.clear(); restoreReviewIdentity('student', 'legacy-group', legacy.commitment.toString(), legacyBackup);
  expect(loadReviewIdentity('student', 'legacy-group', legacy.commitment.toString()).commitment).toBe(legacy.commitment);
});
