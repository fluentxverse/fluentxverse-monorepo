export function createNotificationRefresh(task: () => Promise<void>, options: {
  now?: () => number;
  available?: () => boolean;
} = {}) {
  const now = options.now || Date.now;
  const available = options.available || (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  let pending: Promise<void> | undefined;
  let nextAttempt = 0;
  let failures = 0;
  return (force = false): Promise<void> => {
    if (pending) return pending;
    if (!available() || (!force && now() < nextAttempt)) return Promise.resolve();
    pending = Promise.resolve().then(task).then(() => {
      failures = 0;
      nextAttempt = now() + 5000;
    }, error => {
      nextAttempt = now() + Math.min(300_000, 30_000 * 2 ** Math.min(failures++, 4));
      throw error;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}
