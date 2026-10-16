import { test, expect } from 'bun:test';
import { incomingCookie, outgoingCookie, permittedRoute } from '../backend/policy';
import { createHandler } from '../backend/handler';
test('compatibility API denies all application writes and privileged reads', () => {
  for (const [method, path] of [['POST', '/schedule/attendance'], ['POST', '/schedule/open'], ['PUT', '/tutor/classroom-notes/one'], ['POST', '/exam/written/start'], ['GET', '/interview/pending'], ['GET', '/admin/me'], ['GET', '/student/me']]) expect(permittedRoute(method, path)).toBe(false);
  for (const path of ['/tutor/me', '/tutor/profile', '/schedule/week', '/schedule/tutor-lesson/one', '/notifications/', '/proof/tutor-certification/me']) expect(permittedRoute('GET', path)).toBe(true);
});
test('tutor prototype never reads existing app cookies', () => {
  expect(incomingCookie('tutorAuth=live; studentAuth=live')).toBe('');
  expect(incomingCookie('tutorAuth=live; fxvSolidTutorAuth=test')).toBe('tutorAuth=test');
  expect(outgoingCookie('tutorAuth=test; Path=/; HttpOnly; Domain=.fluentxverse.com')).toBe('fxvSolidTutorAuth=test; Path=/; HttpOnly');
  expect(outgoingCookie('studentAuth=test')).toBeNull();
});
test('origin checks and write denial happen before the backend runs', async () => {
  let calls = 0;
  const handler = createHandler(async () => { calls++; return Response.json({ success: true }); });
  expect((await handler(new Request('http://127.0.0.1:8782/tutor/me', { headers: { Origin: 'http://localhost:5173' } }))).status).toBe(403);
  expect((await handler(new Request('http://127.0.0.1:8782/schedule/open', { method: 'POST', headers: { Origin: 'http://127.0.0.1:5177' } }))).status).toBe(403);
  expect(calls).toBe(0);
});
