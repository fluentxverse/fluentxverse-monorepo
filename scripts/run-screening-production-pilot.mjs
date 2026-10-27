import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = join(homedir(), '.local/state/fluentxverse/screening-production-20261022');
const output = join(root, 'output/release/screening-production-20261022');
const runtime = JSON.parse(readFileSync(join(state, 'api-runtime.json')));
const identity = JSON.parse(readFileSync(join(state, 'identity.json')));
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const preflight = process.argv.includes('--preflight');
const reconcile = process.argv.includes('--reconcile');
if (!preflight && !reconcile && !process.argv.includes('--live')) throw Error('Use --live to authorize one actual zkVerify mainnet proof submission and its network fee');
if (!reconcile && existsSync(join(output, 'pilot.json'))) throw Error('A pilot record exists. Reconcile it; never blindly resubmit');
for (let i = 0; ; i++) {
  const r = await fetch(runtime.GMR_SCREENING_ENGINE_API_BASE.replace('host.docker.internal', '127.0.0.1') + '/v1/screening/prover', {
    headers: { 'X-GMR-Engine-Key': identity.apiKey }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!r.ok) throw Error('Production Engine readiness request failed');
  const status = await r.json();
  if (status.ready === true) {
    if (status.release?.releaseManifestSHA256 !== runtime.SCREENING_RELEASE_MANIFEST_SHA256 || status.release.independentlyReviewed !== false) throw Error('Unexpected production release');
    console.log('PASS production Engine cryptographic setup readiness and self-operated assurance.'); break;
  }
  if (status.state === 'blocked' || i >= 180) throw Error('Production screening setup verification blocked or timed out');
  if (i % 3 === 0) console.log(JSON.stringify({ event: 'production-setup-verification', state: status.state }));
  await new Promise(resolve => setTimeout(resolve, 10000));
}
const image = 'fluentxverse-server:screening-self-operated-20261022-test';
const container = 'screening-pilot-memgraph';
docker(['run', '-d', '--rm', '--name', container, '--network', 'budol_default', 'memgraph/memgraph:latest']);
const privateEnv = join(state, 'pilot.env');
const selected = Object.fromEntries(Object.entries(runtime).filter(([k]) => k.startsWith('SCREENING_') || k.startsWith('GMR_SCREENING_') || k === 'PRIVACY_INFRA_MODE'));
Object.assign(selected, { RUN_LIVE_SCREENING_PILOT: 'authorized', TEST_MEMGRAPH_URI: 'bolt://screening-pilot-memgraph:7687',
  SCREENING_PILOT_OFFLINE_ONLY: String(preflight), SCREENING_PILOT_REPORT: preflight ? '/pilot/pilot-preflight.json' : '/pilot/pilot.json' });
writeFileSync(privateEnv, Object.entries(selected).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
try {
  await new Promise(resolve => setTimeout(resolve, 3000));
  execFileSync('docker', ['run', '--rm', '--no-healthcheck', '--name', 'screening-production-pilot', '--network', 'budol_default',
    '--add-host', 'host.docker.internal:host-gateway', '--user', `${process.getuid()}:${process.getgid()}`,
    '--env-file', privateEnv, '--mount', `type=bind,source=${output},target=/pilot`, image,
    'bun', '--no-env-file', reconcile ? 'tests/screening.production.reconcile.ts' : 'tests/screening.production.pilot.ts'], { stdio: 'inherit', timeout: 90 * 60 * 1000 });
  const result = JSON.parse(readFileSync(join(output, preflight ? 'pilot-preflight.json' : 'pilot.json')));
  console.log(preflight ? 'PASS preflight completed without a chain submission.' : result.verifiedOnHorizen
    ? 'PASS live pilot and privacy lifecycle checks completed.' : 'Receipt still pending; no proof was resubmitted and certification remains disabled.');
} finally {
  rmSync(privateEnv, { force: true });
  docker(['stop', container]);
}
