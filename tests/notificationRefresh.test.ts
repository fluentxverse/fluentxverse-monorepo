import { expect, test } from 'bun:test';
import { createNotificationRefresh as studentRefresh } from '../fluentxverse-student/src/utils/notificationRefresh';
import { createNotificationRefresh as tutorRefresh } from '../fluentxverse-tutor/src/utils/notificationRefresh';

for (const [app, createRefresh] of [['student', studentRefresh], ['tutor', tutorRefresh]] as const) {
  test(`${app}: duplicate refreshes share one request`, async () => {
    let finish!: () => void;
    let calls = 0;
    const refresh = createRefresh(() => { calls++; return new Promise<void>(resolve => { finish = resolve; }); });
    const first = refresh();
    expect(refresh(true)).toBe(first);
    await Promise.resolve();
    expect(calls).toBe(1);
    finish();
    await first;
  });

  test(`${app}: offline refreshes are skipped, including manual retry`, async () => {
    let online = false;
    let calls = 0;
    const refresh = createRefresh(async () => { calls++; }, { available: () => online });
    await refresh(true);
    expect(calls).toBe(0);
    online = true;
    await refresh(true);
    expect(calls).toBe(1);
  });

  test(`${app}: focus bursts are throttled but explicit retry can run`, async () => {
    let now = 0;
    let calls = 0;
    const refresh = createRefresh(async () => { calls++; }, { now: () => now });
    await refresh();
    await refresh();
    expect(calls).toBe(1);
    now = 5000;
    await refresh();
    await refresh(true);
    expect(calls).toBe(3);
  });

  test(`${app}: failures back off up to five minutes without an overlapping retry loop`, async () => {
    let now = 0;
    let calls = 0;
    const refresh = createRefresh(async () => { calls++; throw new Error('network unavailable'); }, { now: () => now });
    for (let attempt = 0; attempt < 7; attempt++) {
      await expect(refresh()).rejects.toThrow('network unavailable');
      const delay = Math.min(300_000, 30_000 * 2 ** Math.min(attempt, 4));
      now += delay - 1;
      await refresh();
      expect(calls).toBe(attempt + 1);
      now++;
    }
  });

  test(`${app}: a successful recovery resets the failure delay`, async () => {
    let now = 0;
    let fail = true;
    let calls = 0;
    const refresh = createRefresh(async () => { calls++; if (fail) throw new Error('offline'); }, { now: () => now });
    await expect(refresh()).rejects.toThrow();
    now = 30000;
    await expect(refresh()).rejects.toThrow();
    now = 90000;
    fail = false;
    await refresh();
    now = 95000;
    fail = true;
    await expect(refresh()).rejects.toThrow();
    now = 125000;
    await expect(refresh()).rejects.toThrow();
    expect(calls).toBe(5);
  });
}
