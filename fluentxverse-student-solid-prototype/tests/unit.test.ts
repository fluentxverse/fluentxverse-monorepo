import { describe, expect, test } from 'bun:test';
import { createSession, validateStudent } from '../src/session';
import { createApi } from '../src/api';
import { createSimulation, type Scenario } from '../src/simulation';
import { readCallback } from '../src/identity';
import { connectWallet } from '../src/wallet';
import type { Api, SessionState, Student } from '../src/types';
import { privateKeyToAccount } from 'viem/accounts';
import type { EIP1193Provider } from 'viem';
import { isPrivyOriginAllowed, originError } from '../src/origin';
import { createLabHandler } from '../backend/handler';
import { LAB_ORIGIN, LAB_COOKIE } from '../backend/policy';
import { permittedApplicationRoute } from '../backend/application-policy';
import { fetchNotificationFeed } from '../student/utils/notificationFeed';

describe('notification feed recovery', () => {
  const feed = { data: { success: true, data: { notifications: [] } } };
  test('retries a temporary failure once and returns the feed', async () => {
    let calls = 0;
    const result = await fetchNotificationFeed(async () => {
      if (++calls === 1) throw Object.assign(new Error('Unavailable'), { response: { status: 503 } });
      return feed;
    }, new AbortController().signal, async () => {});
    expect(result).toEqual([]);
    expect(calls).toBe(2);
  });
  test('bounds retries and rejects malformed success responses', async () => {
    let calls = 0;
    await expect(fetchNotificationFeed(async () => { calls++; return { data: { success: true } }; }, new AbortController().signal, async () => {})).rejects.toThrow();
    expect(calls).toBe(2);
  });
  test('does not retry authorization failures', async () => {
    let calls = 0;
    await expect(fetchNotificationFeed(async () => { calls++; throw { response: { status: 401 } }; }, new AbortController().signal)).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
  test('cancellation prevents the next request after a failed fetch', async () => {
    const controller = new AbortController();
    let calls = 0;
    await expect(fetchNotificationFeed(async () => { calls++; throw new Error('Offline'); }, controller.signal, async () => { controller.abort(); })).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
});

const student: Student = { userId: 'student-1', role: 'student' };
const unauthorized = () => Promise.reject(Object.assign(new Error('Expired session'), { status: 401 }));
function setup(overrides: Partial<Api> = {}) {
  const states: SessionState[] = [];
  const api = { ...createSimulation(() => 'existing'), ...overrides };
  const controller = createSession(api, state => states.push(state));
  return { api, controller, states };
}

describe('student session boundary', () => {
  test('requires role, ID, and consistent identity', () => {
    expect(validateStudent(student, student.userId)).toBe(student);
    expect(() => validateStudent({ ...student, role: 'tutor' })).toThrow();
    expect(() => validateStudent({ ...student, userId: '' })).toThrow();
    expect(() => validateStudent(student, 'different-student')).toThrow();
  });
  for (const [scenario, phase] of [['existing', 'authenticated'], ['new', 'registration_required'], ['rejected-cookie', 'error'], ['wrong-role', 'error'], ['offline', 'error']] as const) {
    test(`exchange: ${scenario}`, async () => {
      const states: SessionState[] = [];
      const session = createSession(createSimulation(() => scenario as Scenario), state => states.push(state));
      await session.exchange('test-token');
      expect(states.at(-1)?.phase).toBe(phase);
      if (phase !== 'authenticated') expect(states.at(-1)?.user).toBeNull();
    });
  }
  test('does not trust exchange response when /me has a different student', async () => {
    const { controller, states } = setup({ exchange: async () => ({ status: 'authenticated', user: student }), me: async () => ({ ...student, userId: 'other' }) });
    await controller.exchange('test-token');
    expect(states.at(-1)?.phase).toBe('error');
  });
  test('single-flights concurrent recovery and verifies cookie after refresh', async () => {
    let meCalls = 0; let refreshCalls = 0;
    const { controller, states } = setup({ me: async () => { if (++meCalls === 1) return unauthorized(); return student; }, refresh: async () => { refreshCalls++; } });
    const first = controller.recover(async () => null);
    expect(controller.recover(async () => null)).toBe(first);
    await first;
    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(2);
    expect(states.at(-1)?.phase).toBe('authenticated');
  });
  test('uses identity only after cookie recovery returns unauthorized', async () => {
    let authenticated = false; let exchangeCalls = 0;
    const { controller, states } = setup({ me: async () => authenticated ? student : unauthorized(), refresh: unauthorized, exchange: async () => { exchangeCalls++; authenticated = true; return { status: 'authenticated', user: student }; } });
    await controller.recover(async () => 'test-token');
    expect(exchangeCalls).toBe(1);
    expect(states.at(-1)?.phase).toBe('authenticated');
  });
  test('network error is not treated as an expired session', async () => {
    let refreshCalls = 0; let tokenCalls = 0;
    const { controller, states } = setup({ me: async () => { throw new Error('Offline'); }, refresh: async () => { refreshCalls++; } });
    await controller.recover(async () => { tokenCalls++; return 'token'; });
    expect(refreshCalls).toBe(0); expect(tokenCalls).toBe(0);
    expect(states.at(-1)?.message).toBe('Offline');
  });
  test('late response cannot restore session after logout', async () => {
    let resolve!: (user: Student) => void;
    const { controller, states } = setup({ me: () => new Promise(done => { resolve = done; }) });
    const pending = controller.check();
    await controller.logout();
    resolve(student); await pending;
    expect(states.at(-1)?.phase).toBe('guest');
  });
  test('disposal prevents post-unmount updates', async () => {
    let resolve!: (user: Student) => void;
    const { controller, states } = setup({ me: () => new Promise(done => { resolve = done; }) });
    const pending = controller.check(); const count = states.length;
    controller.dispose(); resolve(student); await pending;
    expect(states.length).toBe(count);
  });
  test('wallet authentication verifies the returned student cookie', async () => {
    const { controller, states } = setup({ wallet: async () => ({ status: 'authenticated', user: student }), me: unauthorized });
    await controller.wallet('address', 'signature', 'message');
    expect(states.at(-1)?.phase).toBe('error');
  });
});

describe('HTTP and callback contracts', () => {
  test('treats HTTP 200 success:false as an authentication failure', async () => {
    const api = createApi('', (async () => Response.json({ success: false, error: 'Invalid email or password' })) as typeof fetch);
    await expect(api.password('demo@example.test', 'invalid')).rejects.toThrow('Invalid email or password');
  });
  test('sends cookie credentials and keeps identity token in Authorization', async () => {
    let received: RequestInit | undefined; let url = '';
    const api = createApi('https://api.example.test/', (async (input, options) => {
      url = String(input); received = options;
      return Response.json({ status: 'registration_required' });
    }) as typeof fetch);
    await api.exchange('private-test-token');
    expect(url).toBe('https://api.example.test/student/auth/privy');
    expect(received?.credentials).toBe('include');
    expect(received?.cache).toBe('no-store');
    expect(received?.body).toBe('{}');
    expect((received?.headers as Record<string, string>).Authorization).toBe('Bearer private-test-token');
    expect(url).not.toContain('private-test-token');
  });
  test('preserves HTTP status for recovery decisions', async () => {
    const api = createApi('', (async () => Response.json({ error: 'Unauthorized' }, { status: 401 })) as typeof fetch);
    try { await api.me(); throw new Error('Expected rejection'); }
    catch (error) { expect((error as { status: number }).status).toBe(401); }
  });
  test('accepts only complete supported OAuth callbacks', () => {
    expect(readCallback(new URL('http://localhost/'))).toBeNull();
    expect(readCallback(new URL('http://localhost/?privy_oauth_code=code&privy_oauth_state=state&privy_oauth_provider=google'))).toEqual({ code: 'code', state: 'state', provider: 'google' });
    for (const query of ['privy_oauth_code=code', 'privy_oauth_code=undefined&privy_oauth_state=s&privy_oauth_provider=google', 'privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=unknown']) expect(() => readCallback(new URL(`http://localhost/?${query}`))).toThrow();
  });
});

describe('prototype origin and cookie isolation', () => {
  test('checks exact origin including port and does not guess wildcard approvals', () => {
    expect(isPrivyOriginAllowed(['http://127.0.0.1:5176'], LAB_ORIGIN)).toBe(true);
    expect(isPrivyOriginAllowed(['http://127.0.0.1:5174'], LAB_ORIGIN)).toBe(false);
    expect(isPrivyOriginAllowed(['https://student.fluentxverse.com'], LAB_ORIGIN)).toBe(false);
    expect(isPrivyOriginAllowed(['https://*.example.test'], 'https://test.example.test')).toBeUndefined();
    expect(isPrivyOriginAllowed([], LAB_ORIGIN)).toBe(true);
    expect(originError(LAB_ORIGIN).message).toContain(LAB_ORIGIN);
  });
  test('blocks unapproved, prefix-spoofed, and missing origins before the handler', async () => {
    let called = false;
    const handle = createLabHandler(async () => { called = true; return Response.json({}); });
    for (const origin of ['', 'https://student.fluentxverse.com', 'http://127.0.0.1:5176.evil.test', 'http://127.0.0.1:5174']) {
      const result = await handle(new Request('http://127.0.0.1:8776/student/login', { method: 'POST', headers: origin ? { Origin: origin } : {} }));
      expect(result.status).toBe(403); expect(result.headers.has('Access-Control-Allow-Origin')).toBe(false);
    }
    expect(called).toBe(false);
  });
  test('denies registration, profile edits, admin actions, and non-auth routes', async () => {
    let called = false;
    const handle = createLabHandler(async () => { called = true; return Response.json({}); });
    for (const path of ['/student/register', '/student/register/privy', '/student/register/wallet', '/admin/users', '/student/user/personal-info', '/schedule']) {
      const result = await handle(new Request(`http://127.0.0.1:8776${path}`, { method: 'POST', headers: { Origin: LAB_ORIGIN } }));
      expect(result.status).toBe(404);
    }
    expect(called).toBe(false);
  });
  test('preflight approves only the exact lab origin and auth methods', async () => {
    const handle = createLabHandler(async () => Response.json({}));
    const allowed = await handle(new Request('http://127.0.0.1:8776/student/login', { method: 'OPTIONS', headers: { Origin: LAB_ORIGIN, 'Access-Control-Request-Method': 'POST' } }));
    expect(allowed.status).toBe(204); expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(LAB_ORIGIN);
    const denied = await handle(new Request('http://127.0.0.1:8776/student/register', { method: 'OPTIONS', headers: { Origin: LAB_ORIGIN, 'Access-Control-Request-Method': 'POST' } }));
    expect(denied.status).toBe(403);
  });
  test('never accepts or emits production cookies', async () => {
    let cookie = '';
    const handle = createLabHandler(async request => {
      cookie = request.headers.get('Cookie') || '';
      return Response.json({ success: true }, { headers: { 'Set-Cookie': 'studentAuth=test-token; HttpOnly; Path=/; SameSite=Lax', Vary: 'Cookie' } });
    });
    const response = await handle(new Request('http://127.0.0.1:8776/student/me', { headers: { Origin: LAB_ORIGIN, Cookie: `studentAuth=real-session; ${LAB_COOKIE}=lab-session` } }));
    expect(cookie).toBe('studentAuth=lab-session');
    expect(response.headers.get('Set-Cookie')).toBe(`${LAB_COOKIE}=test-token; HttpOnly; Path=/; SameSite=Lax`);
    expect(response.headers.get('Vary')).toBe('Origin, Cookie');
    await handle(new Request('http://127.0.0.1:8776/student/me', { headers: { Origin: LAB_ORIGIN, Cookie: 'studentAuth=real-session' } }));
    expect(cookie).toBe('');
  });
});

describe('recreated student API boundary', () => {
  test('allows student reads but gates each mutation behind test database mode', () => {
    for (const path of ['/schedule/student-bookings', '/schedule/available/tutor-1', '/schedule/lesson/booking-1/survey', '/student/profile', '/notifications', '/notifications/', '/lesson/published/business-english']) {
      expect(permittedApplicationRoute('GET', path)).toBe(true);
    }
    for (const [method, path] of [
      ['POST', '/schedule/book'], ['POST', '/schedule/cancel'],
      ['POST', '/schedule/lesson/booking-1/issue-report'], ['POST', '/schedule/lesson/booking-1/survey'],
      ['PUT', '/student/preferences'], ['PUT', '/student/user/email'],
      ['POST', '/student/register/privy'], ['POST', '/tickets/purchase'],
      ['POST', '/notifications/read-all'], ['DELETE', '/student/favorites/tutor-1'],
    ]) {
      expect(permittedApplicationRoute(method, path)).toBe(false);
      expect(permittedApplicationRoute(method, path, true)).toBe(true);
    }
  });
  test('never exposes admin, tutor mutations, or lesson authoring endpoints', () => {
    for (const path of ['/admin/users', '/schedule/debug/reset', '/tutor/profile/submit', '/lesson/list', '/lesson/my-lessons', '/lesson/search', '/lesson/save']) {
      expect(permittedApplicationRoute('GET', path, true)).toBe(false);
      expect(permittedApplicationRoute('POST', path, true)).toBe(false);
    }
    expect(permittedApplicationRoute('POST', '/schedule/tutor-cancel', true)).toBe(false);
    expect(permittedApplicationRoute('DELETE', '/schedule/book', true)).toBe(false);
  });
  test('application cookie is isolated from both the original app and compatibility lab', async () => {
    let cookie = '';
    const handle = createLabHandler(async request => {
      cookie = request.headers.get('Cookie') || '';
      return Response.json({}, { headers: { 'Set-Cookie': 'studentAuth=renewed; HttpOnly; Path=/; SameSite=Lax' } });
    }, { cookieName: 'fxvSolidStudentAuth', permittedRoute: permittedApplicationRoute });
    const response = await handle(new Request('http://127.0.0.1:8780/student/me', { headers: { Origin: LAB_ORIGIN, Cookie: 'studentAuth=production; fxvSolidLabAuth=lab; fxvSolidStudentAuth=app' } }));
    expect(cookie).toBe('studentAuth=app');
    expect(response.headers.get('Set-Cookie')).toBe('fxvSolidStudentAuth=renewed; HttpOnly; Path=/; SameSite=Lax');
    await handle(new Request('http://127.0.0.1:8780/student/me', { headers: { Origin: LAB_ORIGIN, Cookie: 'studentAuth=production; fxvSolidLabAuth=lab' } }));
    expect(cookie).toBe('');
  });
  test('pass wallet routes retain test-only mutations and exclude every finance action', () => {
    const id = `0x${'a'.repeat(64)}`;
    for (const path of ['/lesson-passes/mode','/lesson-passes/me',`/lesson-passes/batch/${id}`]) expect(permittedApplicationRoute('GET',path)).toBe(true);
    for (const [method,path] of [['PUT','/lesson-passes/vault'],['POST','/lesson-passes/orders'],['POST','/lesson-passes/reservations'],['POST',`/lesson-passes/reservations/${id}/proof`]]) {
      expect(permittedApplicationRoute(method,path)).toBe(false); expect(permittedApplicationRoute(method,path,true)).toBe(true);
    }
    expect(permittedApplicationRoute('GET','/lesson-passes/admin/queue',true)).toBe(false);
    expect(permittedApplicationRoute('POST',`/lesson-passes/admin/orders/${id}/approve`,true)).toBe(false);
  });
  test('only public lesson media may omit Origin, never protected reads or writes', async () => {
    let calls = 0;
    const handle = createLabHandler(async () => { calls++; return Response.json({}); }, {
      permittedRoute: permittedApplicationRoute, publicRead: path => path.startsWith('/lesson/files/'),
    });
    expect((await handle(new Request('http://127.0.0.1:8780/lesson/files/image.webp'))).status).toBe(200);
    for (const path of ['/student/me', '/schedule/student-bookings']) {
      expect((await handle(new Request(`http://127.0.0.1:8780${path}`))).status).toBe(403);
    }
    expect((await handle(new Request('http://127.0.0.1:8780/lesson/files/image.webp', { headers: { Origin: 'https://unapproved.example' } }))).status).toBe(403);
    expect((await handle(new Request('http://127.0.0.1:8780/lesson/files/image.webp', { method: 'POST' }))).status).toBe(403);
    expect(calls).toBe(1);
  });
  test('rejects disabled mutation preflights before reaching the backend', async () => {
    const handle = createLabHandler(async () => { throw new Error('Must not execute'); }, { permittedRoute: permittedApplicationRoute });
    const response = await handle(new Request('http://127.0.0.1:8780/schedule/book', { method: 'OPTIONS', headers: { Origin: LAB_ORIGIN, 'Access-Control-Request-Method': 'POST' } }));
    expect(response.status).toBe(403);
  });
  test('local lesson renderer origins may read public media only, without credentialed CORS', async () => {
    const origin = 'http://127.0.0.1:5175';
    const handle = createLabHandler(async () => Response.json({}), {
      permittedRoute: permittedApplicationRoute,
      publicRead: path => path.startsWith('/lesson/files/'), publicReadOrigins: [origin],
    });
    const response = await handle(new Request('http://127.0.0.1:8780/lesson/files/lessons/fixture/student-data.json', { headers: { Origin: origin } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.has('Access-Control-Allow-Credentials')).toBe(false);
    for (const [method, path] of [['GET', '/student/me'], ['POST', '/schedule/book'], ['POST', '/lesson/files/example.png']]) {
      expect((await handle(new Request(`http://127.0.0.1:8780${path}`, { method, headers: { Origin: origin } }))).status).toBe(403);
    }
    expect((await handle(new Request('http://127.0.0.1:8780/lesson/files/example.png', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } }))).status).toBe(204);
    expect((await handle(new Request('http://127.0.0.1:8780/lesson/files/example.png', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } }))).status).toBe(403);
  });
});

describe('viem without a UI framework', () => {
  const account = privateKeyToAccount(`0x${'1'.repeat(64)}`);
  function provider() {
    let chain = '0x1'; let added = false; let changed = false;
    const methods: string[] = [];
    const rpc = { request: async ({ method, params }: { method: string; params?: any }) => {
      methods.push(method);
      if (method === 'eth_requestAccounts') return [account.address];
      if (method === 'eth_accounts') return changed ? [] : [account.address];
      if (method === 'wallet_switchEthereumChain') { if (!added) throw Object.assign(new Error('Unknown chain'), { code: 4902 }); chain = params[0].chainId; return null; }
      if (method === 'wallet_addEthereumChain') { added = true; return null; }
      if (method === 'eth_chainId') return chain;
      if (method === 'personal_sign') return account.signMessage({ message: { raw: params[0] } });
      throw new Error(`Unexpected wallet request: ${method}`);
    } } as EIP1193Provider;
    return { rpc, methods, change: () => { changed = true; } };
  }
  test('connects, adds missing test chain, and verifies a real cryptographic signature', async () => {
    const { rpc, methods } = provider();
    const wallet = await connectWallet(rpc);
    expect(wallet.chainId).toBe(84532); expect(wallet.address).toBe(account.address);
    expect(await wallet.sign('Solid wallet compatibility check')).toMatch(/^0x/);
    expect(methods.filter(method => method === 'wallet_switchEthereumChain').length).toBe(2);
    expect(methods).not.toContain('eth_sendTransaction');
  });
  test('rejects signing after account change', async () => {
    const { rpc, change } = provider(); const wallet = await connectWallet(rpc); change();
    await expect(wallet.sign('test')).rejects.toThrow('Wallet account changed');
  });
  test('handles missing wallet and unsupported network', async () => {
    await expect(connectWallet(undefined)).rejects.toThrow('No browser wallet');
    await expect(connectWallet(provider().rpc, 1)).rejects.toThrow('Unsupported');
  });
  test('never adds a chain after user rejects switching', async () => {
    let add = false;
    const rpc = { request: async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') return [account.address];
      if (method === 'wallet_addEthereumChain') add = true;
      throw Object.assign(new Error('User rejected'), { code: 4001 });
    } } as EIP1193Provider;
    await expect(connectWallet(rpc)).rejects.toThrow('User rejected'); expect(add).toBe(false);
  });
});
