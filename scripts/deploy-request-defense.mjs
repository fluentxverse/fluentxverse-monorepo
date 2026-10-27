import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudTarget, quote, ssh, sshOptions } from './lib/cloud-ssh.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'output/release/request-defense-20261024');
const manifest = JSON.parse(readFileSync(join(release, 'source-manifest.json')));
const configPath = '/opt/fluentxverse/releases/20261023/compose.private.json';
const stage = '/opt/fluentxverse/releases/request-defense-20261024';
const image = manifest.apiBaselineTag === 'fluentxverse-cloud/api:request-defense-multipart-20261024'
  ? 'fluentxverse-cloud/api:request-defense-sessions-20261024' : manifest.apiBaselineTag === 'fluentxverse-cloud/api:request-defense-policy-20261024'
  ? 'fluentxverse-cloud/api:request-defense-multipart-20261024' : manifest.apiBaselineTag === 'fluentxverse-cloud/api:request-defense-20261024'
    ? 'fluentxverse-cloud/api:request-defense-policy-20261024' : 'fluentxverse-cloud/api:request-defense-20261024';
const privateDir = join(homedir(), '.local/state/fluentxverse/request-defense-20261024');
const secretFile = join(privateDir, 'edge-secret.json');
const { EDGE_SHARED_SECRET } = JSON.parse(readFileSync(secretFile));
if (!/^[a-f0-9]{64}$/.test(EDGE_SHARED_SECRET)) throw Error('Invalid private edge configuration.');
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
const upload = (from, to) => run('scp', [...sshOptions, from, `${cloudTarget}:${to}`]);
const activeCheck = "import {db,closePool} from './src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classroom connections; defer release');console.log(JSON.stringify({activeClassroomConnections:r[0].n}));}finally{await closePool();}";

async function replaceConfig(config, label) {
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(activeCheck)}`));
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const file = join(privateDir, 'compose.private.json');
  writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
  const backup = configPath + `.pre-${label}-` + Date.now();
  ssh(`cp -p ${quote(configPath)} ${quote(backup)}`);
  upload(file, configPath + '.defense-next');
  ssh(`chmod 600 ${quote(configPath + '.defense-next')}`);
  ssh(`mv ${quote(configPath + '.defense-next')} ${quote(configPath)}`);
  try {
    console.log(ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
    const response = await fetch('https://api.fluentxverse.com/health', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('API health failed after activation.');
  } catch (error) {
    ssh(`cp -p ${quote(backup)} ${quote(configPath)}`);
    ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 });
    throw error;
  }
  return backup;
}

if (process.argv.includes('--origin')) {
  const actual = JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Image}}'"));
  const index = ssh('docker exec fluentxverse-server cat /app/src/index.ts');
  if (actual !== manifest.apiBaselineImage || createHash('sha256').update(index).digest('hex') !== manifest.apiBaselineIndexHash) throw Error('Live API changed since preparation.');
  for(const [name, hash] of Object.entries(manifest.apiBaselineRoutes || {})) {
    if(createHash('sha256').update(ssh(`docker exec fluentxverse-server cat /app/src/routes/${name}.route.ts`)).digest('hex')!==hash) throw Error('Live multipart route changed since preparation.');
  }
  if (JSON.parse(ssh(`docker image inspect ${quote(manifest.apiBaselineTag)} --format '{{json .Id}}'`)) !== actual) throw Error('Baseline tag changed.');
  const config = JSON.parse(ssh(`cat ${quote(configPath)}`));
  if (config.services.api.image !== manifest.apiBaselineTag) throw Error('Unexpected API configuration.');
  run('tar', ['-czf', join(release, 'api-overlay.tar.gz'), '-C', join(release, 'api'), '.']);
  ssh(`mkdir -p ${stage}`); upload(join(release, 'api-overlay.tar.gz'), stage + '/api-overlay.tar.gz');
  ssh(`tar -xzf ${stage}/api-overlay.tar.gz -C ${stage}`);
  console.log(ssh(`docker build --network=none --pull=false -t ${image} ${stage}`, { timeout: 180000 }));
  console.log(ssh(`docker run --rm --network none -e NODE_ENV=test --entrypoint bun ${image} test ./tests/atomicRateLimit.test.ts ./tests/requestDefense.test.ts ./tests/serverHealth.test.ts ./tests/containerStats.test.ts`, { timeout: 60000 }));
  config.services.api.image = image;
  const edgeEnforced = config.services.api.environment.REQUIRE_EDGE_GUARD === 'true';
  Object.assign(config.services.api.environment, { TRUST_CLOUDFLARE_TUNNEL: 'true', EDGE_SHARED_SECRET, REQUIRE_EDGE_GUARD: String(edgeEnforced) });
  const backup = await replaceConfig(config, 'request-defense');
  console.log(ssh(`docker exec fluentxverse-server bun tests/atomicRateLimit.redis.ts`));
  writeFileSync(join(release, 'origin-deployment.json'), JSON.stringify({ image, previousImage: actual, backup, deployedAt: new Date().toISOString(), edgeEnforced }, null, 2));
  console.log('PASS origin admission deployed; edge enforcement: ' + edgeEnforced);
} else if (process.argv.includes('--edge')) {
  JSON.parse(readFileSync(join(release, 'origin-deployment.json')));
  const cwd = join(release, 'edge/infra/edge-guard');
  const full = JSON.parse(readFileSync(join(cwd, 'wrangler.jsonc')));
  writeFileSync(join(cwd, 'wrangler.bootstrap.json'), JSON.stringify({ ...full, routes: [] }, null, 2));
  const wrangler = (args, config) => {
    const result = spawnSync('npx', ['--yes', 'wrangler', ...args, '--config', config], { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: '1' } });
    if (result.status !== 0) throw Error((result.stderr || result.stdout).slice(-4000));
    console.log(result.stdout);
    return result.stdout;
  };
  // Bootstrap has no public route: no request can reach a worker missing its secret.
  if (!existsSync(join(release, 'edge-deployment.json'))) {
    wrangler(['deploy'], 'wrangler.bootstrap.json');
    wrangler(['secret', 'bulk', secretFile], 'wrangler.bootstrap.json');
  }
  const output = wrangler(['deploy'], 'wrangler.jsonc');
  const version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
  if (!version) throw Error('Inspect the edge deployment version.');
  writeFileSync(join(release, 'edge-deployment.json'), JSON.stringify({ version, deployedAt: new Date().toISOString(), routes: full.routes.map(r => r.pattern) }, null, 2));
} else if (process.argv.includes('--enforce')) {
  JSON.parse(readFileSync(join(release, 'edge-deployment.json')));
  const response = await fetch('https://api.fluentxverse.com/tutor/intro-video', { method: 'POST', headers: { origin: 'https://tutor.fluentxverse.com' }, signal: AbortSignal.timeout(15000) });
  if (response.status !== 401 || response.headers.get('x-fxv-edge-guard') !== 'active') throw Error('Edge admission not verified; do not enforce.');
  const config = JSON.parse(ssh(`cat ${quote(configPath)}`));
  if (config.services.api.image !== image || config.services.api.environment.EDGE_SHARED_SECRET !== EDGE_SHARED_SECRET) throw Error('Origin configuration changed.');
  config.services.api.environment.REQUIRE_EDGE_GUARD = 'true';
  const backup = await replaceConfig(config, 'edge-enforcement');
  writeFileSync(join(release, 'enforcement-deployment.json'), JSON.stringify({ image, backup, enforcedAt: new Date().toISOString() }, null, 2));
  console.log('PASS protected mutations now require the edge origin marker.');
} else throw Error('Use --origin, --edge, or --enforce, in that order.');
