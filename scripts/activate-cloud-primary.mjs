import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ssh, sshOptions, cloudHost } from './lib/cloud-ssh.mjs';
import { screeningStatusProbe } from './lib/cloud-verification.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = join(homedir(), '.local/state/fluentxverse/cloud-20261023'), output = join(root, 'output/cloud/20261023');
const phasePath = join(state, 'cutover-checkpoint.json');
const checkpoint = JSON.parse(readFileSync(phasePath));
assert(['cloud-writers-starting', 'ready-to-route'].includes(checkpoint.phase), 'Only resume a restored, fenced migration');
const inventory = JSON.parse(readFileSync(join(output, 'inventory.json')));
for (const service of inventory.services) {
  const local = JSON.parse(execFileSync('docker', ['inspect', service.name], { encoding: 'utf8' }))[0];
  assert(!local.State.Running && local.HostConfig.RestartPolicy.Name === 'no', 'Local writer or automatic restart is still enabled');
}
for (const command of ['is-active', 'is-enabled']) {
  let status;
  try { status = execFileSync('systemctl', [command, 'cloudflared'], { encoding: 'utf8' }).trim(); }
  catch (error) { status = String(error.stdout).trim(); }
  assert(['inactive', 'disabled'].includes(status), 'Local public connector is not fenced');
}
assert.deepEqual(JSON.parse(readFileSync(join(output, 'cloud-census.json'))), JSON.parse(readFileSync(join(output, 'source-census.json'))));
const rootSSH = (command, options = {}) => execFileSync('ssh', [...sshOptions, `root@${cloudHost}`, command], { encoding: 'utf8', ...options });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let ready = false;
const { quote } = await import('./lib/cloud-ssh.mjs');
for (let i = 0; i < 90; i++) {
  const status = JSON.parse(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(screeningStatusProbe)}`, { timeout: 20_000 }));
  if (status.http !== 200) throw Error('Cloud Engine authentication failed');
  if (status.ready) { ready = true; break; }
  if (status.state === 'blocked') throw Error('Cloud proving release rejected');
  if (i % 6 === 0) console.log(JSON.stringify({ event: 'cloud-screening-setup', ...status }));
  await sleep(5000);
}
if (!ready) throw Error('Cloud setup verification not ready; keep public routing disabled');
const health = JSON.parse(ssh('curl --fail --silent --max-time 15 http://127.0.0.1:8765/health/detailed'));
assert.equal(health.status, 'ok');
const agent = JSON.parse(ssh('curl --fail --silent --max-time 15 http://127.0.0.1:8765/screening/agent.json'));
assert.equal(agent.active, true);
assert.equal(ssh("curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8765/screening/me").trim(), '401');
assert(ssh("curl --fail --silent --max-time 15 'http://127.0.0.1:8767/socket.io/?EIO=4&transport=polling'").startsWith('0{'));
rootSSH('systemctl enable --now fluentxverse-backend.service', { stdio: 'inherit', timeout: 360_000 });
writeFileSync(phasePath, JSON.stringify({ phase: 'ready-to-route', at: new Date().toISOString() }), { mode: 0o600 });
rootSSH('systemctl enable --now fluentxverse-tunnel.service', { stdio: 'inherit', timeout: 60_000 });
let live = false;
for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch('https://api.fluentxverse.com/health/detailed', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (r.ok && (await r.json()).status === 'ok') { live = true; break; }
  } catch {}
  await sleep(2000);
}
if (!live) throw Error('Public health check failed after routing; recover cloud rather than restart stale local data');
writeFileSync(phasePath, JSON.stringify({ phase: 'cloud-primary', at: new Date().toISOString() }), { mode: 0o600 });
writeFileSync(join(output, 'activation.json'), JSON.stringify({ activatedAt: new Date().toISOString(), primary: cloudHost,
  imageContentsVerified: true, graphAndSQLCountsMatched: true, backupsEncrypted: true, backupIdentityStoredOnlyLocally: true,
  privateHealth: 'ok', screeningSetupVerified: true, anonymousScreeningHTTP: 401, socketTransportVerified: true, publicHealth: 'ok',
  localWritersStopped: true, localAutomaticRestartDisabled: true, localTunnelDisabled: true, reviewTallyEnabled: false,
  autonomousFailoverConfigured: false, fullBrowserLessonRetestRequired: true }, null, 2), { mode: 0o600 });
console.log('PASS cloud primary activated; local writer/tunnel remain fenced. Browser login and full lesson retest remain required.');
