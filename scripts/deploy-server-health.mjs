import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudHost, cloudTarget, quote, ssh, sshOptions } from './lib/cloud-ssh.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'output/release/server-health-20261023');
const manifest = JSON.parse(readFileSync(join(release, 'source-manifest.json')));
const remoteRelease = '/opt/fluentxverse/releases/20261023';
const configPath = `${remoteRelease}/compose.private.json`;
const stage = '/opt/fluentxverse/releases/server-health-20261023';
const image = 'fluentxverse-cloud/api:server-health-20261023';
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 8*1024*1024, ...options });
const rootSSH = command => run('ssh', [...sshOptions, `root@${cloudHost}`, command]);
const upload = (from, to, rootUser = false) => run('scp', [...sshOptions, from, `${rootUser ? `root@${cloudHost}` : cloudTarget}:${to}`]);

if (process.argv.includes('--cloud')) {
  const actual = JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Image}}'"));
  const index = ssh('docker exec fluentxverse-server cat /app/src/index.ts');
  if (actual !== manifest.apiBaselineImage || createHash('sha256').update(index).digest('hex') !== manifest.apiBaselineIndexHash) throw Error('Cloud API changed since preparation; review first.');
  const baseImage = JSON.parse(ssh("docker image inspect fluentxverse-cloud/api:20261023 --format '{{json .Id}}'"));
  if (baseImage !== actual) throw Error('Base image content changed.');
  const privateDir = join(homedir(), '.local/state/fluentxverse/cloud-metrics-20261023');
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const config = JSON.parse(ssh(`cat ${quote(configPath)}`));
  const before = JSON.stringify(config);
  if (!config.services?.api || config.services.api.image !== 'fluentxverse-cloud/api:20261023') throw Error('Unexpected live Compose configuration.');
  const volume = { type: 'bind', source: '/var/lib/fluentxverse-metrics', target: '/run/fluentxverse-metrics', read_only: true, bind: { create_host_path: false, selinux: 'z' } };
  if (config.services.api.volumes?.some(v => typeof v === 'object' && v.target === volume.target)) throw Error('Metrics already mounted; review first.');
  config.services.api.image = image;
  config.services.api.volumes = [...(config.services.api.volumes || []), volume];
  const verifyConfig = structuredClone(config);
  verifyConfig.services.api.image = 'fluentxverse-cloud/api:20261023';
  verifyConfig.services.api.volumes.pop();
  if (JSON.stringify(verifyConfig) !== before) throw Error('Unexpected unrelated config change.');
  const privateFile = join(privateDir, 'compose.private.json');
  writeFileSync(privateFile, JSON.stringify(config, null, 2), { mode: 0o600 });
  run('go', ['test','./...'], { cwd: join(root,'infra/host-metrics') });
  run('go', ['build','-trimpath','-ldflags=-s -w','-o',join(release,'host-metrics'),'.'], { cwd: join(root,'infra/host-metrics'), env:{...process.env,CGO_ENABLED:'0',GOOS:'linux',GOARCH:'amd64'} });
  run('tar', ['-czf',join(release,'api-overlay.tar.gz'),'-C',join(release,'api'),'.']);
  ssh(`mkdir -p ${quote(stage)}`);
  upload(join(release,'host-metrics'), `${stage}/host-metrics`);
  upload(join(root,'infra/cloud/fluentxverse-metrics.service'), `${stage}/fluentxverse-metrics.service`);
  upload(join(release,'api-overlay.tar.gz'), `${stage}/api-overlay.tar.gz`);
  ssh(`tar -xzf ${stage}/api-overlay.tar.gz -C ${stage}`);
  console.log(ssh(`docker build --network=none --pull=false -t ${image} ${stage}`));
  console.log(ssh(`docker run --rm --network none -e NODE_ENV=test --entrypoint bun ${image} test tests/serverHealth.test.ts`));
  // Install a locked, unprivileged host service. Snapshot contains metrics only.
  rootSSH('id fluentxverse-metrics >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin fluentxverse-metrics');
  rootSSH(`install -m 0755 ${stage}/host-metrics /usr/local/bin/fluentxverse-host-metrics`);
  rootSSH('restorecon /usr/local/bin/fluentxverse-host-metrics');
  rootSSH(`install -m 0644 ${stage}/fluentxverse-metrics.service /etc/systemd/system/fluentxverse-metrics.service`);
  rootSSH('systemctl daemon-reload');
  rootSSH('systemctl enable --now fluentxverse-metrics.service');
  let sample;
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise(resolve=>setTimeout(resolve,2000));
    try { sample = JSON.parse(ssh('cat /var/lib/fluentxverse-metrics/host-metrics.json')); } catch { continue; }
    if (sample.cpu?.usagePercent !== null && Date.now()-Date.parse(sample.sampledAt) < 30000) break;
  }
  if (!sample || Date.now()-Date.parse(sample.sampledAt) > 30000) throw Error('Host collector did not publish a fresh sample.');
  if (sample.version !== 1 || sample.cpu.usagePercent === null || sample.network.interface !== 'ens3' || sample.memory.totalBytes < 7*1024**3) throw Error('Host collector verification failed.');
  // Refuse to restart the API while any lesson/interview transport is active.
  const activeCheck = "import {db,closePool} from './src/db/postgres'; try { const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`; if(r[0].n>0)throw Error('Active classroom connections; defer release'); console.log(JSON.stringify({activeClassroomConnections:r[0].n})); } finally {await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(activeCheck)}`));
  const backupPath = configPath + '.pre-server-health-' + Date.now();
  ssh(`cp -p ${quote(configPath)} ${quote(backupPath)}`);
  upload(privateFile, configPath+'.metrics-next');
  ssh(`chmod 600 ${quote(configPath+'.metrics-next')}`);
  ssh(`mv ${quote(configPath+'.metrics-next')} ${quote(configPath)}`);
  try {
    console.log(ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 api`, { timeout:180000 }));
    const verify = "import {readServerHealth} from './src/services/admin.services/serverHealth.service'; const r=await readServerHealth(); if(r.status!=='live'||r.snapshot.cpu.usagePercent===null)throw Error('Host metrics not live'); console.log(JSON.stringify({status:r.status,cpu:r.snapshot.cpu.usagePercent,memoryGiB:r.snapshot.memory.totalBytes/1024**3,interface:r.snapshot.network.interface}));";
    console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(verify)}`));
    const response = await fetch('https://api.fluentxverse.com/admin/server-health', {signal:AbortSignal.timeout(15000)});
    if (response.status !== 401 || response.headers.get('cache-control') !== 'private, no-store') throw Error(`Public auth/cache verification failed (HTTP ${response.status}, cache: ${response.headers.get('cache-control')}).`);
  } catch (error) {
    ssh(`cp -p ${quote(backupPath)} ${quote(configPath)}`);
    ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 api`, { timeout:180000 });
    throw error;
  }
  writeFileSync(join(release,'api-deployment.json'), JSON.stringify({image,previousImage:actual,deployedAt:new Date().toISOString(),host:cloudHost},null,2));
  console.log('PASS host collector and authenticated metrics API deployed; unrelated services/config unchanged.');
} else if (process.argv.includes('--dashboard')) {
  JSON.parse(readFileSync(join(release,'api-deployment.json')));
  const cwd = join(release, 'frontend/fluentxverse-dashboard');
  const wrangler = args => {
    const r = spawnSync('npx', ['--yes','wrangler',...args,'--config','wrangler.jsonc'], {cwd,encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,CI:'1'}});
    if (r.status !== 0) throw Error((r.stderr||r.stdout).slice(-2000));
    return r.stdout;
  };
  const versions = [...wrangler(['deployments','list']).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)];
  if (versions.at(-1)?.[1] !== manifest.previousDashboard) throw Error('Dashboard changed; review before deployment.');
  run('bun',['run','build'],{cwd});
  const output = wrangler(['deploy']); console.log(output);
  const version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
  if (!version) throw Error('Inspect deployment version.');
  writeFileSync(join(release,'dashboard-deployment.json'),JSON.stringify({version,previous:manifest.previousDashboard,deployedAt:new Date().toISOString(),url:'https://dashboard.fluentxverse.com/server-health'},null,2));
} else throw Error('Use --cloud or --dashboard after tests and UI review.');
