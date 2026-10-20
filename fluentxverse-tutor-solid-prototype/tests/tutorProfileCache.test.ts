import { expect, test } from 'bun:test';
import { changesTutorProfile, createTutorProfileCache } from '../tutor/utils/tutorProfileCache';

const profile = { firstName: 'Test', lastName: 'Tutor', email: 'test@example.test', bio: 'Private profile' };
test('profile cache is account-scoped, bounded and expires after thirty seconds', () => {
  let now = 100;
  const cache = createTutorProfileCache(() => now);
  expect(cache.write('one', profile, cache.revision)).toBe(true);
  expect(cache.read('one')).toBe(profile);
  expect(cache.read('two')).toBeNull();
  now += 30000;
  expect(cache.read('one')).toBeNull();
  cache.write('two', profile, cache.revision);
  expect(cache.read('one')).toBeNull();
});
test('auth or edit invalidation prevents an older request from repopulating the cache', () => {
  const cache = createTutorProfileCache();
  const before = cache.revision;
  cache.write('one', profile, before);
  cache.clear();
  expect(cache.read('one')).toBeNull();
  expect(cache.write('one', profile, before)).toBe(false);
  expect(cache.write('one', profile, cache.revision)).toBe(true);
});
test('all profile-affecting writes invalidate; unrelated reads are not profile mutations', () => {
  for (const url of ['/tutor/profile', '/tutor/profile/submit', '/tutor/profile-picture', '/tutor/intro-video', '/tutor/user/personal-info', '/tutor/user/email']) expect(changesTutorProfile(url)).toBe(true);
  for (const url of ['/tutor/profile-status', '/tutor/performance', '/schedule/book', '/student/profile']) expect(changesTutorProfile(url)).toBe(false);
});
