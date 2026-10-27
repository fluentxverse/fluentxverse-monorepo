import { test, expect } from 'bun:test';
import { boundedJSON, collectMonitorSample } from './src/probe';
const telemetry = () => ({ version: 1, sampledAt: new Date().toISOString(), host: { diskUsedPercent: 30, diskAvailableBytes: 30 * 1024 ** 3 },
  containers: [], recordings: { failed: 0, overdue: 0 }, proofs: { pending: 0, oldestAt: null, missingTimestamp: 0 } });

test('Cloudflare-compatible probes reject redirects without sending secrets to arbitrary destinations', async () => {
  const calls: { url: string; headers: Headers }[] = [];
  const fetcher = (async (url, init) => {
    expect(init?.redirect).toBe('manual');
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    return Response.json(calls.length === 1 ? { status: 'ok' } : telemetry());
  }) as typeof fetch;
  const result = await collectMonitorSample('monitor-secret', fetcher);
  expect(result.apiAvailable).toBe(true); expect(result.telemetry?.recordings?.failed).toBe(0);
  expect(calls[0]!.headers.has('x-fxv-monitor-key')).toBe(false);
  expect(calls[1]!.headers.get('x-fxv-monitor-key')).toBe('monitor-secret');
  expect(calls[1]!.url).toBe('https://api.fluentxverse.com/internal/operational-alerts/telemetry');
  let redirects = 0;
  const redirected = await collectMonitorSample('secret', (async (_url, init) => {
    expect(init?.redirect).toBe('manual'); redirects++;
    return new Response(null, { status: 302, headers: { location: 'https://untrusted.example/' } });
  }) as typeof fetch);
  expect(redirects).toBe(1); expect(redirected.apiAvailable).toBe(false); expect(redirected.telemetry).toBeNull();
});
test('network, oversized and malformed responses fail closed; telemetry failure does not fabricate an API outage', async () => {
  expect(await collectMonitorSample('secret', (async () => { throw Error('offline'); }) as typeof fetch)).toEqual({ apiAvailable: false, telemetry: null });
  const malformed = await collectMonitorSample('secret', (async () => new Response('not json')) as typeof fetch);
  expect(malformed.apiAvailable).toBe(false);
  await expect(boundedJSON(new Response(' '.repeat(65537)))).rejects.toThrow('Response too large');
  let calls = 0;
  const partial = await collectMonitorSample('secret', (async () => ++calls === 1 ? Response.json({ status: 'ok' }) : new Response(null, { status: 401 })) as typeof fetch);
  expect(partial.apiAvailable).toBe(true); expect(partial.telemetry).toBeNull();
});
