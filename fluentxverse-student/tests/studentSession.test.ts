import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { AxiosError, type AxiosAdapter } from 'axios';
import { ensureStudentSession } from '../src/api/auth.api';
import { client, registerSessionRecoveryHandler, registerUnauthorizedHandler, setLoginInProgress } from '../src/api/utils';

const originalAdapter = client.defaults.adapter;
const student = { userId: 'session-test-student', role: 'student', email: 'student@example.invalid' };
let cleanup: Array<() => void> = [];

beforeEach(() => { setLoginInProgress(false); });
afterEach(() => {
  client.defaults.adapter = originalAdapter;
  for (const dispose of cleanup) dispose();
  cleanup = [];
  setLoginInProgress(false);
});

function adapter(handler: (url: string) => Promise<{ status: number; data: any }> | { status: number; data: any }) {
  client.defaults.adapter = (async config => {
    const result = await handler(config.url || '');
    const response = { ...result, headers: {}, config, statusText: String(result.status) };
    if (result.status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
    return response;
  }) as AxiosAdapter;
}

describe('student API session confirmation', () => {
  test('a valid cookie requires no OAuth exchange', async () => {
    let tokens = 0;
    adapter(() => ({ status: 200, data: { user: student } }));
    expect(await ensureStudentSession(async () => { tokens++; return 'test-token'; })).toEqual(student);
    expect(tokens).toBe(0);
  });

  test('expired cookie is exchanged and confirmed before success', async () => {
    const calls: string[] = [];
    let meCalls = 0;
    adapter(url => {
      calls.push(url);
      if (url === '/student/auth/privy') return { status: 200, data: { status: 'authenticated', user: student } };
      return ++meCalls === 1 ? { status: 401, data: {} } : { status: 200, data: { user: student } };
    });
    expect(await ensureStudentSession(async () => 'test-token', student.userId)).toEqual(student);
    expect(calls).toEqual(['/student/me', '/student/auth/privy', '/student/me']);
  });

  test('a rejected browser cookie never reports successful authentication', async () => {
    adapter(url => url === '/student/auth/privy'
      ? { status: 200, data: { status: 'authenticated', user: student } }
      : { status: 401, data: {} });
    await expect(ensureStudentSession(async () => 'test-token')).rejects.toMatchObject({ response: { status: 401 } });
  });

  test('temporary API failure does not exchange or erase identity', async () => {
    let tokens = 0;
    adapter(() => ({ status: 503, data: {} }));
    await expect(ensureStudentSession(async () => { tokens++; return 'test-token'; })).rejects.toMatchObject({ response: { status: 503 } });
    expect(tokens).toBe(0);
  });

  test('recovery cannot replay a booking under a different student', async () => {
    adapter(url => url === '/student/auth/privy'
      ? { status: 200, data: { status: 'authenticated', user: { ...student, userId: 'another-student' } } }
      : { status: 401, data: {} });
    await expect(ensureStudentSession(async () => 'test-token', student.userId)).rejects.toMatchObject({ response: { status: 401 } });
  });

  test('incomplete registration cannot authenticate a booking', async () => {
    adapter(url => url === '/student/auth/privy'
      ? { status: 200, data: { status: 'registration_required', profile: {} } }
      : { status: 401, data: {} });
    await expect(ensureStudentSession(async () => 'test-token')).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('student request recovery', () => {
  test('parallel denied requests share one recovery and replay once', async () => {
    const calls = new Map<string, number>();
    let recoveries = 0;
    adapter(url => {
      const count = (calls.get(url) || 0) + 1;
      calls.set(url, count);
      return { status: count === 1 ? 401 : 200, data: { success: true } };
    });
    cleanup.push(registerSessionRecoveryHandler(async () => {
      recoveries++;
      await new Promise(resolve => setTimeout(resolve, 20));
      return true;
    }));
    const responses = await Promise.all([client.post('/schedule/reserve'), client.get('/schedule/student-stats')]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(recoveries).toBe(1);
    expect([...calls.values()]).toEqual([2, 2]);
  });

  test('a feature-specific denial does not expire a valid login or loop', async () => {
    let calls = 0;
    let expired = 0;
    adapter(() => { calls++; return { status: 401, data: {} }; });
    cleanup.push(registerSessionRecoveryHandler(async () => true));
    cleanup.push(registerUnauthorizedHandler(() => { expired++; }));
    await expect(client.get('/schedule/student-stats')).rejects.toBeDefined();
    expect(calls).toBe(2);
    expect(expired).toBe(0);
  });

  test('only a confirmed missing session invokes the expiration handler', async () => {
    let expired = 0;
    adapter(() => ({ status: 401, data: {} }));
    cleanup.push(registerSessionRecoveryHandler(async () => false));
    cleanup.push(registerUnauthorizedHandler(() => { expired++; }));
    await expect(client.post('/schedule/reserve')).rejects.toBeDefined();
    expect(expired).toBe(1);
  });

  test('temporary recovery failure preserves login', async () => {
    let expired = 0;
    adapter(() => ({ status: 401, data: {} }));
    cleanup.push(registerSessionRecoveryHandler(async () => { throw new Error('Network offline'); }));
    cleanup.push(registerUnauthorizedHandler(() => { expired++; }));
    await expect(client.post('/schedule/reserve')).rejects.toBeDefined();
    expect(expired).toBe(0);
  });

  test('a late pre-login denial cannot clear the new session', async () => {
    let release: (() => void) | undefined;
    let recoveries = 0;
    adapter(async () => {
      await new Promise<void>(resolve => { release = resolve; });
      return { status: 401, data: {} };
    });
    cleanup.push(registerSessionRecoveryHandler(async () => { recoveries++; return false; }));
    const request = client.get('/schedule/student-stats').catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 5));
    setLoginInProgress(true);
    setLoginInProgress(false);
    release?.();
    await request;
    expect(recoveries).toBe(0);
  });
});
