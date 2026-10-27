import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { cloudTarget, quote, ssh, sshOptions } from './lib/cloud-ssh.mjs';

const releaseID = process.env.ENGINE_DESTINATION_RELEASE || 'proof-destinations-20261025';
if (!/^proof-destinations-[a-z0-9-]+$/.test(releaseID)) throw Error('Invalid release ID');
const release = join(process.cwd(), 'output/release', releaseID);
const manifest = JSON.parse(readFileSync(join(release, 'manifest.json')));
const stage = '/opt/fluentxverse/releases/' + releaseID;
const configPath = '/opt/fluentxverse/releases/20261023/compose.private.json';
const image = 'fluentxverse-cloud/gmr-engine:' + releaseID;
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
const upload = (from, to) => run('scp', [...sshOptions, from, `${cloudTarget}:${to}`]);
const hash = value => createHash('sha256').update(value).digest('hex');
if (process.argv.includes('--build')) {
  if (JSON.parse(ssh("docker inspect budol-gmr-engine-1 --format '{{json .Config.Image}}'")) !== manifest.engineImage) throw Error('Engine baseline changed');
  run('tar', ['-czf', join(release, 'engine.tar.gz'), '-C', join(release, 'engine'), '.']);
  ssh(`mkdir -p ${stage}/engine`); upload(join(release, 'engine.tar.gz'), `${stage}/engine.tar.gz`);
  ssh(`tar -xzf ${stage}/engine.tar.gz -C ${stage}/engine`);
  console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/engine`, { timeout: 180000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} test ./scripts/horizen-receipt.test.ts ./scripts/screening-bridge-prover.test.ts`, { timeout: 60000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint node ${image} --test scripts/zkverify-node-runtime.test.mjs`, { timeout: 60000 }));
  writeFileSync(join(release, 'images-built.json'), JSON.stringify({ image, binarySHA256: hash(readFileSync(join(release, 'engine/gmr-engine'))), builtAt: new Date().toISOString() }, null, 2));
} else if (process.argv.includes('--activate')) {
  const built = JSON.parse(readFileSync(join(release, 'images-built.json')));
  if (built.binarySHA256 !== hash(readFileSync(join(release, 'engine/gmr-engine')))) throw Error('Built release changed');
  const original = ssh(`cat ${quote(configPath)}`), config = JSON.parse(original);
  if (config.services['gmr-engine'].image !== manifest.engineImage) throw Error('Live image changed');
  const processes = ssh('docker top budol-gmr-engine-1 -eo pid,comm').trim().split('\n').slice(1).map(v => v.trim().split(/\s+/).at(-1));
  if (processes.some(p => !['docker-init', 'gmr-engine', 'wget'].includes(p))) throw Error('Engine child operation running; defer restart');
  const active = "import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classroom connections');console.log(JSON.stringify({activeClassroomConnections:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(active)}`));
  config.services['gmr-engine'].image = image;
  const state = join(homedir(), '.local/state/fluentxverse', releaseID);
  mkdirSync(state, { recursive: true, mode: 0o700 });
  const local = join(state, 'compose.private.json'); writeFileSync(local, JSON.stringify(config, null, 2), { mode: 0o600 });
  const backup = configPath + '.pre-proof-destinations-' + Date.now();
  if (hash(ssh(`cat ${quote(configPath)}`)) !== hash(original)) throw Error('Compose changed during preparation');
  ssh(`cp -p ${quote(configPath)} ${quote(backup)}`);
  upload(local, configPath + '.dest-next');
  try {
    ssh(`chmod 600 ${quote(configPath + '.dest-next')}`);
    ssh(`mv ${quote(configPath + '.dest-next')} ${quote(configPath)}`);
    console.log(ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 gmr-engine`, { timeout: 180000 }));
    if (ssh('docker exec budol-gmr-engine-1 sha256sum /usr/local/bin/gmr-engine').split(/\s/)[0] !== built.binarySHA256) throw Error('Live Engine binary differs');
    const response = await fetch('https://engine.fluentxverse.com/healthz', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('Public Engine health failed');
    const protectedRoute = await fetch('https://engine.fluentxverse.com/dashboard/projects/unknown/zkverify/destination');
    if (protectedRoute.status !== 401) throw Error('Destination endpoint auth failed');
  } catch (error) {
    ssh(`cp -p ${quote(backup)} ${quote(configPath)}`);
    ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 gmr-engine`, { timeout: 180000 });
    throw error;
  }
  writeFileSync(join(release, 'deployment.json'), JSON.stringify({ deployedAt: new Date().toISOString(), image, previousCompose: backup, businessAPIUnchanged: true, existingProofPoliciesUnchanged: true }, null, 2));
  console.log('PASS Engine destination API deployed; business API and existing project policies unchanged.');
} else throw Error('Use --build or --activate');
