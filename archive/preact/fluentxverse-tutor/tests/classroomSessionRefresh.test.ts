import { afterEach, beforeEach, expect, mock, test } from 'bun:test';

let cleanups: Array<() => void> = [];
mock.module('preact/hooks', () => ({
  useRef: (current: any) => ({ current }),
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  },
}));
const implementations = {
  tutor: (await import('../src/hooks/useClassroomSessionRefresh')).useClassroomSessionRefresh,
  student: (await import('../../fluentxverse-student/src/hooks/useClassroomSessionRefresh')).useClassroomSessionRefresh,
};
const originals = { setTimeout, clearTimeout, now: Date.now, window: globalThis.window, document: globalThis.document };
let now = 0;
let id = 0;
let timers = new Map<number, { at: number; fn: () => void }>();
let wake: EventTarget;
let visibility: EventTarget;
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const advance = async (ms: number) => {
  now += ms;
  for (const [key, timer] of [...timers]) {
    if (timer.at <= now) { timers.delete(key); timer.fn(); }
  }
  await flush();
};

beforeEach(() => {
  now = 0;
  id = 0;
  timers = new Map();
  cleanups = [];
  wake = new EventTarget();
  visibility = new EventTarget();
  globalThis.window = wake as any;
  globalThis.document = Object.assign(visibility, { visibilityState: 'visible' }) as any;
  Date.now = () => now;
  globalThis.setTimeout = ((fn: () => void, ms: number) => { timers.set(++id, { at: now + ms, fn }); return id; }) as any;
  globalThis.clearTimeout = ((key: number) => { timers.delete(key); }) as any;
});
afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  globalThis.setTimeout = originals.setTimeout;
  globalThis.clearTimeout = originals.clearTimeout;
  Date.now = originals.now;
  globalThis.window = originals.window;
  globalThis.document = originals.document;
});

for (const [name, start] of Object.entries(implementations)) {
  test(`${name}: renews on entry and every ten minutes`, async () => {
    let calls = 0;
    let successes = 0;
    start(true, async () => { calls++; }, () => { successes++; });
    await flush();
    expect(calls).toBe(1);
    await advance(9 * 60000);
    expect(calls).toBe(1);
    await advance(60000);
    expect(calls).toBe(2);
    expect(successes).toBe(2);
  });
  test(`${name}: no requests outside an authenticated classroom`, async () => {
    let calls = 0;
    start(false, async () => { calls++; }, () => {});
    await advance(3600000);
    expect(calls).toBe(0);
  });
  test(`${name}: temporary failures retry silently after thirty seconds`, async () => {
    let calls = 0;
    start(true, async () => { if (++calls === 1) throw new Error('Offline'); }, () => {});
    await flush();
    await advance(29000);
    expect(calls).toBe(1);
    await advance(1000);
    expect(calls).toBe(2);
  });
  test(`${name}: confirmed unauthorized sessions stop renewal`, async () => {
    let calls = 0;
    start(true, async () => { calls++; throw { response: { status: 401 } }; }, () => {});
    await flush();
    await advance(3600000);
    wake.dispatchEvent(new Event('online'));
    await flush();
    expect(calls).toBe(1);
    expect(timers.size).toBe(0);
  });
  test(`${name}: wake events recover overdue timers without overlapping requests`, async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    start(true, async () => {
      if (++calls === 2) await new Promise<void>(resolve => { release = resolve; });
    }, () => {});
    await flush();
    now = 11 * 60000;
    wake.dispatchEvent(new Event('focus'));
    wake.dispatchEvent(new Event('online'));
    visibility.dispatchEvent(new Event('visibilitychange'));
    expect(calls).toBe(2);
    release?.();
    await flush();
    expect(timers.size).toBe(1);
  });
  test(`${name}: navigation stops timers and ignores late refresh responses`, async () => {
    let release: (() => void) | undefined;
    let successes = 0;
    start(true, () => new Promise<void>(resolve => { release = resolve; }), () => { successes++; });
    cleanups.forEach(cleanup => cleanup());
    release?.();
    await flush();
    await advance(3600000);
    wake.dispatchEvent(new Event('focus'));
    expect(successes).toBe(0);
    expect(timers.size).toBe(0);
  });
}
