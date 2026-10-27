import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cloudHost, cloudTarget, quote, ssh, sshOptions } from './lib/cloud-ssh.mjs';
const root = process.cwd(), release = join(root, 'output/release/operational-alerts-20261024');
const manifest = JSON.parse(readFileSync(join(release, 'source-manifest.json')));
const privateDir = join(homedir(), '.local/state/fluentxverse/operational-alerts-20261024');
const composePath = '/opt/fluentxverse/releases/20261023/compose.private.json';
const stage = '/opt/fluentxverse/releases/operational-alerts-20261024';
const image = 'fluentxverse-cloud/api:operational-alerts-20261024';
const run = (c, args, options = {}) => execFileSync(c, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
const upload = (from, to) => run('scp', [...sshOptions, from, `${cloudTarget}:${to}`]);
const rootSSH = command => run('ssh', [...sshOptions, `root@${cloudHost}`, command]);
if (process.argv.includes('--cloud')) {
  const config = JSON.parse(ssh(`cat ${composePath}`));
  const index = ssh('docker exec fluentxverse-server cat /app/src/index.ts');
  if (config.services.api.image !== manifest.apiImage || createHash('sha256').update(index).digest('hex') !== manifest.apiIndexHash) throw Error('Live API changed; re-review release.');
  const key = readFileSync(join(privateDir, 'monitor-key'), 'utf8').trim(); if (!/^[a-f0-9]{64}$/.test(key)) throw Error('Private monitor key missing.');
  run('go',['test','./...'],{cwd:join(root,'infra/container-metrics')});
  run('go',['build','-trimpath','-ldflags=-s -w','-o',join(release,'container-metrics'),'.'],{cwd:join(root,'infra/container-metrics'),env:{...process.env,CGO_ENABLED:'0',GOOS:'linux',GOARCH:'amd64'}});
  run('tar',['-czf',join(release,'api.tar.gz'),'-C',join(release,'api'),'.']); ssh(`mkdir -p ${stage}/api`);
  upload(join(release,'api.tar.gz'),`${stage}/api.tar.gz`); upload(join(release,'container-metrics'),`${stage}/container-metrics`);
  ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api`);
  console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/api`,{timeout:180000}));
  console.log(ssh(`docker run --rm --network none -e NODE_ENV=test --entrypoint bun ${image} test tests/operationalAlerts.test.ts tests/containerStats.test.ts tests/serverHealth.test.ts tests/requestDefense.test.ts`,{timeout:60000}));
  const active = "import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classrooms; defer release');console.log(JSON.stringify({activeClassrooms:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(active)}`));
  const stamp = Date.now(), backup = composePath + '.pre-alerts-' + stamp;
  ssh(`cp -p ${quote(composePath)} ${quote(backup)}`);
  rootSSH(`cp -p /usr/local/bin/fluentxverse-container-metrics ${stage}/container-metrics.previous`);
  config.services.api.image = image; config.services.api.environment.OPERATIONAL_ALERTS_KEY = key;
  mkdirSync(privateDir,{recursive:true,mode:0o700}); const local = join(privateDir,'compose.private.json'); writeFileSync(local,JSON.stringify(config,null,2),{mode:0o600});
  upload(local,composePath+'.alerts-next'); ssh(`chmod 600 ${quote(composePath+'.alerts-next')}`); ssh(`mv ${quote(composePath+'.alerts-next')} ${quote(composePath)}`);
  try {
    console.log(ssh(`docker compose -f ${quote(composePath)} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000}));
    rootSSH(`install -m 0755 ${stage}/container-metrics /usr/local/bin/fluentxverse-container-metrics`);
    rootSSH('restorecon /usr/local/bin/fluentxverse-container-metrics'); rootSSH('systemctl restart fluentxverse-container-metrics.service');
    await new Promise(r=>setTimeout(r,12000));
    const probe = "import{collectAlertTelemetry}from'./src/services/admin.services/operationalAlerts.service';import{initDriver,closeDriver}from'./src/db/memgraph';import{closePool}from'./src/db/postgres';try{await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const t=await collectAlertTelemetry();console.log(JSON.stringify({host:!!t.host,containers:t.containers?.length,metadataComplete:t.containers?.every(c=>c.restartCount!==null&&c.health!==null),recordings:t.recordings,proofs:t.proofs}));if(!t.host||!t.containers||t.containers.length!==11||t.containers.some(c=>c.restartCount===null||c.health===null)||!t.recordings||!t.proofs)throw Error('Incomplete monitoring sources');}finally{await closeDriver();await closePool();}";
    console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(probe)}`,{timeout:60000}));
    const r = await fetch('https://api.fluentxverse.com/internal/operational-alerts/telemetry',{headers:{'x-fxv-monitor-key':key},signal:AbortSignal.timeout(20000)});
    if(r.status!==200)throw Error('Watchdog cannot reach origin telemetry: '+r.status);await r.arrayBuffer();
  } catch(error) {
    rootSSH(`install -m 0755 ${stage}/container-metrics.previous /usr/local/bin/fluentxverse-container-metrics`);
    rootSSH('restorecon /usr/local/bin/fluentxverse-container-metrics');rootSSH('systemctl restart fluentxverse-container-metrics.service');
    ssh(`cp -p ${quote(backup)} ${quote(composePath)}`);ssh(`docker compose -f ${quote(composePath)} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000});throw error;
  }
  writeFileSync(join(release,'api-deployment.json'),JSON.stringify({image,previous:manifest.apiImage,backup,deployedAt:new Date().toISOString()},null,2));
  console.log('PASS protected alerts API, aggregate telemetry and restart collector deployed.');
} else if(process.argv.includes('--dashboard')) {
  JSON.parse(readFileSync(join(release,'api-deployment.json')));
  const cwd = join(release,'frontend/fluentxverse-dashboard');
  const wrangler = args => run('npx',['--yes','wrangler',...args,'--config','wrangler.jsonc'],{cwd,env:{...process.env,CI:'1'}});
  const versions=[...wrangler(['deployments','list']).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)];
  let previous = manifest.previousDashboard;
  try { previous = JSON.parse(readFileSync(join(release,'dashboard-deployment.json'))).version; } catch {}
  if(versions.at(-1)?.[1]!==previous)throw Error('Dashboard changed; review before replacing it.');
  const output=wrangler(['deploy']);console.log(output);
  const version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1]; if(!version)throw Error('Inspect dashboard deployment result.');
  writeFileSync(join(release,'dashboard-deployment.json'),JSON.stringify({version,previous,deployedAt:new Date().toISOString()},null,2));
} else throw Error('Use --cloud or --dashboard after tests.');
