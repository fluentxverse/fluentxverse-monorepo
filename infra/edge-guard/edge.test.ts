import { expect, test } from 'bun:test';
import { handle } from './src/index';
const allow = { async limit() { return { success: true }; } }, deny = { async limit() { return { success: false }; } };
const env = () => ({ EDGE_SHARED_SECRET: 'a'.repeat(48), GENERAL: allow, AUTH: allow, UPLOAD: allow, COMPUTE: allow, PUBLIC_PROOF: allow });
const request = (path: string, headers: Record<string, string> = {}, method = 'POST') => new Request('https://api.fluentxverse.com' + path, { method, headers: { 'cf-connecting-ip': '1.2.3.4', ...headers } });
test('adds a private origin marker, preserves cookies, overwrites forged proxy headers', async () => {
  let seen: Request | undefined;
  const response = await handle(request('/ai/grammar-check', { cookie: 'tutorAuth=token', 'x-fxv-edge-token': 'forged', 'x-forwarded-for': 'forged', 'x-real-ip': 'forged' }), env(), async req => { seen = req as Request; return new Response('ok'); });
  expect(response.status).toBe(200); expect(seen!.headers.get('x-fxv-edge-token')).toBe('a'.repeat(48)); expect(seen!.headers.get('cookie')).toBe('tutorAuth=token'); expect(seen!.headers.get('x-forwarded-for')).toBe('1.2.3.4'); expect(response.headers.get('x-fxv-edge-guard')).toBe('active');
});
test('blocks large, unauthenticated, or throttled work before forwarding; sends CORS and retry delay', async () => {
  let forwarded = 0; const origin = async () => { forwarded++; return new Response('bad'); };
  expect((await handle(request('/tutor/intro-video'), env(), origin)).status).toBe(401);
  expect((await handle(request('/tutor/intro-video', { cookie: 'tutorAuth=t', 'content-length': String(101 * 1024 ** 2) }), env(), origin)).status).toBe(413);
  const response = await handle(request('/student/auth/privy', { origin: 'https://student.fluentxverse.com' }), { ...env(), AUTH: deny }, origin);
  expect(response.status).toBe(429); expect(response.headers.get('access-control-allow-origin')).toBe('https://student.fluentxverse.com'); expect(response.headers.get('retry-after')).toBe('60'); expect(forwarded).toBe(0);
});
test('anonymous proofs and preflight remain anonymous; bindings failing do not fail open', async () => {
  let forwarded = 0; const origin = async () => { forwarded++; return new Response('ok'); };
  expect((await handle(request('/anonymous-reviews/public/submit'), env(), origin)).status).toBe(200);
  expect((await handle(request('/ai/grammar-check', {}, 'OPTIONS'), { ...env(), GENERAL: deny }, origin)).status).toBe(200);
  expect(forwarded).toBe(2);
  expect((await handle(request('/ai/grammar-check', { cookie: 'tutorAuth=t' }), { ...env(), COMPUTE: { async limit() { throw Error('private'); } } }, origin)).status).toBe(503);
  expect(forwarded).toBe(2);
});
test('the live tutor login and registration endpoints use the authentication rate binding', async () => {
  let forwarded = 0;
  for (const path of ['/tutor/login', '/tutor/register']) {
    const response = await handle(request(path, { origin: 'https://tutor.fluentxverse.com' }), { ...env(), AUTH: deny }, async () => { forwarded++; return new Response('unexpected'); });
    expect(response.status).toBe(429);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://tutor.fluentxverse.com');
  }
  expect(forwarded).toBe(0);
});
