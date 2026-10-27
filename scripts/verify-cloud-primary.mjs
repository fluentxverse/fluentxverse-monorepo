import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ssh, quote, cloudHost } from './lib/cloud-ssh.mjs';
import { screeningStatusProbe } from './lib/cloud-verification.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/cloud/20261023');
const inventory = JSON.parse(readFileSync(join(output, 'inventory.json')));
const activation = JSON.parse(readFileSync(join(output, 'activation.json')));
assert.equal(activation.primary, cloudHost);
const services = JSON.parse(ssh('docker inspect ' + inventory.services.map(x => quote(x.name)).join(' ')));
const summarized = services.map(c => ({ name: c.Name, running: c.State.Running, health: c.State.Health?.Status,
  oomKilled: c.State.OOMKilled, memoryLimitMiB: c.HostConfig.Memory / 1048576, ports: c.NetworkSettings.Ports }));
for (const c of summarized) {
  assert(c.running && c.health === 'healthy' && !c.oomKilled, `Cloud service not healthy: ${c.name}`);
  for (const bindings of Object.values(c.ports || {}))
    for (const binding of bindings || []) assert.equal(binding.HostIp, '127.0.0.1', 'A container port is publicly bound');
}
const local = JSON.parse(execFileSync('docker', ['inspect', ...inventory.services.map(x => x.name)], { encoding: 'utf8' }));
assert(local.every(c => !c.State.Running && c.HostConfig.RestartPolicy.Name === 'no'));
const status = JSON.parse(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(screeningStatusProbe)}`));
assert.equal(status.http, 200); assert.equal(status.ready, true);
const checks = [];
for (const [url, expected] of [
  ['https://api.fluentxverse.com/health/detailed', 200], ['https://api.fluentxverse.com/screening/me', 401],
  ['https://engine-api.fluentxverse.com/healthz', 200], ['https://engine-api.fluentxverse.com/dashboard/projects', 401],
  ['https://student.fluentxverse.com/', 200], ['https://tutor.fluentxverse.com/', 200], ['https://dashboard.fluentxverse.com/', 200],
]) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  assert.equal(r.status, expected, `Unexpected status for ${url}`);
  if (url.endsWith('/health/detailed')) assert.equal((await r.json()).status, 'ok'); else await r.arrayBuffer();
  checks.push({ url, status: r.status });
}
for (const [origin, path, method] of [
  ['https://student.fluentxverse.com', '/student/auth/privy', 'POST'],
  ['https://tutor.fluentxverse.com', '/tutor/profile', 'GET'],
  ['https://dashboard.fluentxverse.com', '/admin/dashboard', 'GET'],
]) {
  const r = await fetch('https://api.fluentxverse.com' + path, { method: 'OPTIONS', signal: AbortSignal.timeout(15000),
    headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(r.headers.get('access-control-allow-origin'), origin); assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
  checks.push({ origin, path, cors: 'ok' });
}
const forbidden = await fetch('https://api.fluentxverse.com/student/auth/privy', { method: 'OPTIONS', signal: AbortSignal.timeout(15000),
  headers: { Origin: 'https://tutor.fluentxverse.com', 'Access-Control-Request-Method': 'POST' } });
assert.notEqual(forbidden.headers.get('access-control-allow-origin'), 'https://tutor.fluentxverse.com');
checks.push({ check: 'student auth rejects tutor origin', result: 'ok' });
await new Promise((resolve, reject) => {
  const ws = new WebSocket('wss://ws.fluentxverse.com/socket.io/?EIO=4&transport=websocket');
  const timer = setTimeout(() => { ws.close(); reject(Error('WebSocket handshake timeout')); }, 15000);
  ws.addEventListener('error', () => { clearTimeout(timer); reject(Error('WebSocket transport failed')); }, { once: true });
  ws.addEventListener('message', event => {
    clearTimeout(timer); ws.close();
    if (typeof event.data !== 'string' || !event.data.startsWith('0{')) reject(Error('Invalid Engine.IO handshake')); else resolve();
  }, { once: true });
});
const stats = ssh("docker stats --no-stream --format '{{json .}}'").trim().split('\n').map(line => JSON.parse(line));
const report = { verifiedAt: new Date().toISOString(), primary: cloudHost, services: summarized, checks,
  screeningReady: true, realWebSocketHandshake: true, localBackendsFenced: true, desktopRequiredForCoreBackend: false,
  browserAuthAndLiveLessonTested: false, stats, caveat: 'API protection/CORS and transport checks do not complete Google OAuth, authenticated booking, or a real media lesson.' };
writeFileSync(join(output, 'verification.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ primary: cloudHost, healthyServices: summarized.length, publicChecks: checks.length,
  screeningReady: true, realWebSocketHandshake: true, localBackendsFenced: true, browserAuthAndLiveLessonTested: false }));
console.log(`Verification: ${join(output, 'verification.json')}`);
