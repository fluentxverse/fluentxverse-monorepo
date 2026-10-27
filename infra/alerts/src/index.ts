import { DurableObject } from 'cloudflare:workers';
import { acknowledge, evaluate, initialState, parseTelemetry, snapshot } from './policy';
import type { MonitorState } from './policy';
import { collectMonitorSample } from './probe';

interface Env { MONITOR: DurableObjectNamespace; MONITOR_KEY: string }
const json = (value: unknown, status = 200, headers = {}) => Response.json(value, { status, headers: { 'cache-control': 'no-store', ...headers } });
async function authorized(request: Request, key: string) {
  if (!key || key.length < 32) return false;
  const supplied = request.headers.get('authorization') || '';
  const hash = (v: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  const a = new Uint8Array(await hash(supplied)), b = new Uint8Array(await hash(`Bearer ${key}`));
  let mismatch = 0; for (let i = 0; i < a.length; i++) mismatch |= a[i]! ^ b[i]!;
  return mismatch === 0;
}
const stub = (env: Env) => env.MONITOR.get(env.MONITOR.idFromName('fluentxverse-primary'));
async function runCheck(env: Env) {
  const sample = await collectMonitorSample(env.MONITOR_KEY);
  console.log(JSON.stringify({ probe: 'operational', apiHealthy: sample.apiAvailable, telemetryAvailable: !!sample.telemetry }));
  const response = await stub(env).fetch('https://monitor/tick', { method: 'POST', body: JSON.stringify(sample) });
  if (!response.ok) throw Error('Monitor update failed');
}
export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCheck(env));
  },
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    const origin = request.headers.get('origin');
    const cors = origin === 'https://dashboard.fluentxverse.com' || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '') ? { 'access-control-allow-origin': origin!, vary: 'Origin' } : {};
    if (path === '/availability' && request.method === 'GET') {
      const response = await stub(env).fetch('https://monitor/snapshot'); const s = await response.json() as ReturnType<typeof snapshot>;
      return json({ checkedAt: s.checkedAt, apiAvailable: s.apiAvailable, incidentActive: s.incidents.some(i => i.key === 'api' && !i.resolvedAt) }, 200, cors);
    }
    if (!await authorized(request, env.MONITOR_KEY)) return json({ error: 'Unauthorized' }, 401);
    if (path === '/check' && request.method === 'POST') {
      await runCheck(env);
      return stub(env).fetch('https://monitor/snapshot');
    }
    if (path === '/snapshot' && request.method === 'GET') return stub(env).fetch('https://monitor/snapshot');
    if (path === '/acknowledge' && request.method === 'POST') {
      const body = await request.text(); if (body.length > 1024) return json({ error: 'Too large' }, 413);
      return stub(env).fetch('https://monitor/acknowledge', { method: 'POST', body });
    }
    return json({ error: 'Not found' }, 404);
  },
};

export class AlertMonitor extends DurableObject<Env> {
  async fetch(request: Request) {
    // A storage transaction serializes acknowledgement and scheduled evaluations.
    return this.ctx.storage.transaction(async storage => {
      const state = await storage.get<MonitorState>('state') || initialState();
      const path = new URL(request.url).pathname;
      if (path === '/tick' && request.method === 'POST') {
        const data = await request.json() as { apiAvailable: boolean; telemetry: unknown };
        evaluate(state, data.apiAvailable === true, data.telemetry ? parseTelemetry(data.telemetry, Date.now()) : null, Date.now(), () => crypto.randomUUID());
        await storage.put('state', state);
      } else if (path === '/acknowledge' && request.method === 'POST') {
        const data = await request.json() as { id: string; actor: string };
        if (!/^[a-f0-9-]{36}$/.test(data.id) || !/^[a-zA-Z0-9_:@.-]{1,128}$/.test(data.actor)) return json({ error: 'Invalid acknowledgement' }, 400);
        try { acknowledge(state, data.id, data.actor, Date.now()); } catch { return json({ error: 'Active incident not found' }, 409); }
        await storage.put('state', state);
      } else if (path !== '/snapshot' || request.method !== 'GET') return json({ error: 'Not found' }, 404);
      return json(snapshot(state));
    });
  }
}
