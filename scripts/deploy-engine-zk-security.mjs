import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), engine = resolve(root, '../budol/gmr-engine');
const output = join(root, 'output/release/engine-zk-security-20261020');
const expected = 'sha256:ab0849eb8023174a86738fa055d3fee1fd850e8cbc8f2d7e8560fc1ae583f5bc';
const image = 'budol-gmr-engine:zk-security-20261020', baseTag = 'budol-gmr-engine:pre-zk-security-20261020';
const deploy = process.argv.includes('--deploy');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
  if (result.status !== 0) throw Error(`${cmd} ${args[0]} failed: ${(result.stderr || '').slice(-1200)}`);
  return result.stdout;
}
const docker = (args, options) => command('docker', args, options);
const live = () => JSON.parse(docker(['inspect', 'budol-gmr-engine-1']))[0];
const old = live(), preparation = JSON.parse(readFileSync(join(output, 'preparation.json')));
if (old.Image !== expected || !preparation.baselineMatched || preparation.baseImage !== expected
  || sha(readFileSync(join(output, 'previous-engine'))) !== preparation.currentBinarySHA256
  || sha(readFileSync(join(output, 'baseline-engine'))) !== preparation.currentBinarySHA256) throw Error('Reviewed binary baseline unavailable or runtime changed');
for (const file of preparation.files) {
  if (sha(readFileSync(join(engine, file.path))) !== file.sha256 || sha(readFileSync(join(output, 'source', file.path))) !== file.sha256)
    throw Error(`Source changed after preparation: ${file.path}`);
}
const context = join(output, 'image'); mkdirSync(context, { recursive: true });
copyFileSync(join(output, 'gmr-engine'), join(context, 'gmr-engine'));
const selected = ['scripts/zkverify.ts', 'scripts/groth16-key-safety.ts', 'scripts/screening.ts', 'scripts/screening-artifacts.ts',
  'scripts/screening-worker.ts', 'zk/payouts/tutor_payout.circom'];
const overlays = [];
for (const path of selected) {
  const destination = join(context, path); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(join(engine, path), destination);
  overlays.push({ path, sha256: sha(readFileSync(destination)) });
}
writeFileSync(join(context, 'scripts/screening-provision.ts'), "throw new Error('Custom screening deployment is archived; no RPC call or transaction was made');\n");
writeFileSync(join(context, 'retired-screening-provision'), "#!/bin/sh\nprintf '%s\\n' 'Custom screening deployment is archived; no transaction was made' >&2\nexit 1\n");
writeFileSync(join(context, 'Dockerfile'), `FROM ${baseTag}\nCOPY --chmod=0755 gmr-engine /usr/local/bin/gmr-engine\nCOPY scripts /app/scripts\nCOPY zk /app/zk\nCOPY --chmod=0755 retired-screening-provision /usr/local/bin/screening-provision\n`);
docker(['tag', expected, baseTag]);
docker(['build', '--network=none', '-t', image, context]);
const unsafe = { protocol: 'groth16', curve: 'bn128', vk_gamma_2: [['1', '2'], ['3', '4'], ['1', '0']], vk_delta_2: [['1', '2'], ['3', '4'], ['1', '0']] };
const blocked = spawnSync('docker', ['run', '--rm', '-i', '--network=none', image, 'node', 'scripts/zkverify.ts'], {
  input: JSON.stringify({ action: 'submitProof', proofSystem: 'groth16', vk: unsafe }), encoding: 'utf8', timeout: 20000 });
if (blocked.status !== 1 || !blocked.stderr.includes('uncontributed')) throw Error('Image did not reject unsafe keys before network/signing access');
const retired = spawnSync('docker', ['run', '--rm', '--network=none', image, 'screening-provision'], { encoding: 'utf8', timeout: 10000 });
if (retired.status !== 1 || !retired.stderr.includes('archived')) throw Error('Retired deployment CLI remains active');
const binaryHash = sha(readFileSync(join(output, 'gmr-engine')));
writeFileSync(join(output, 'image-manifest.json'), JSON.stringify({ image, baseImage: expected, baselineReproduced: true, binarySHA256: binaryHash,
  overlays, dependencyChanges: false, proofActivation: false }, null, 2) + '\n');
console.log('PASS Engine image built; unsafe keys and retired provisioning rejected without network access.');
if (!deploy) process.exit(0);

const networks = Object.keys(old.NetworkSettings.Networks), project = old.Config.Labels['com.docker.compose.project'], serviceName = old.Config.Labels['com.docker.compose.service'];
if (networks.length !== 1 || !project || !serviceName || old.Config.Env.some(value => value.includes('\n'))) throw Error('Unexpected Engine runtime layout');
const env = Object.fromEntries(old.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
const state = join(homedir(), '.local/state/fluentxverse', `engine-zk-security-${Date.now()}`);
mkdirSync(state, { recursive: true, mode: 0o700 }); chmodSync(state, 0o700);
writeFileSync(join(state, 'previous-container.json'), JSON.stringify(old), { mode: 0o600, flag: 'wx' });
const envFile = join(state, 'runtime.env');
writeFileSync(envFile, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
const configCheck = `const fs=require('fs'),crypto=require('crypto');const result={};for(const name of ['GMR_ENGINE_SCREENING_CONFIG_PATH','GMR_ENGINE_ZKVERIFY_POLICY_PATH']){
const path=process.env[name];if(!path)throw Error('Missing project policy path');const bytes=fs.readFileSync(path);const entries=Object.values(JSON.parse(bytes));
if(name.includes('SCREENING')&&entries.some(c=>c.enabled===true||c.registrationEnabled===true))throw Error('Active screening pilot; review before release');
result[name]={sha256:crypto.createHash('sha256').update(bytes).digest('hex'),projects:entries.length};}console.log(JSON.stringify(result));`;
const policyBefore = docker(['exec', 'budol-gmr-engine-1', 'node', '-e', configCheck]).trim();
const dbCheck = `import neo4j from 'neo4j-driver';
const d=neo4j.driver(process.env.GMR_ENGINE_MEMGRAPH_URI||process.env.ENGINE_MEMGRAPH_URI,neo4j.auth.basic(process.env.GMR_ENGINE_MEMGRAPH_USER||process.env.ENGINE_MEMGRAPH_USER||'',process.env.GMR_ENGINE_MEMGRAPH_PASSWORD||process.env.ENGINE_MEMGRAPH_PASSWORD||''));
const s=d.session();try{const r=await s.run("MATCH(n) WHERE n:EngineTransaction OR n:ZKProofSubmission OR any(label IN labels(n) WHERE label ENDS WITH 'Deployment') RETURN labels(n)[0] AS kind,n.status AS status,count(n) AS n ORDER BY kind,status");
const counts=r.records.map(row=>({kind:row.get('kind'),status:row.get('status'),count:row.get('n').toNumber()}));
const historical=await s.run("MATCH(n:ZKProofSubmission {status:'submitted'}) RETURN n.updatedAt AS updatedAt,n.transactionResult AS result");
let completedHistoricalJournals=0;
for(const row of historical.records){let result={};try{result=JSON.parse(row.get('result')||'{}');}catch{}
if(result.status==='finalized'&&/^0x[0-9a-f]{64}$/i.test(result.txHash||'')&&/^0x[0-9a-f]{64}$/i.test(result.blockHash||'')
  &&Date.parse(row.get('updatedAt'))<${JSON.stringify(Date.parse(old.State.StartedAt))})completedHistoricalJournals++;}
// Old synchronous submissions can retain a pre-fix journal label. They are not
// restartable jobs; leave them unchanged rather than relabeling historical evidence.
if(counts.some(c=>['queued','signing','deploying','processing','pending','submitting','submitted'].includes(c.status)
  &&!(c.kind==='ZKProofSubmission'&&c.status==='submitted'&&c.count===completedHistoricalJournals)))throw Error('Unsettled Engine operations; defer restart');
console.log(JSON.stringify(counts));}finally{await s.close();await d.close();}`;
function inspectDatabase() { return JSON.parse(docker(['run', '--rm', '--network', networks[0], '--env-file', envFile,
  'fluentxverse-server:zk-security-20261020', 'bun', '-e', dbCheck]).trim()); }
function inspectProcesses() {
  const processes = docker(['top', 'budol-gmr-engine-1', '-eo', 'pid,comm']).trim().split('\n').slice(1).map(value => value.trim().split(/\s+/).at(-1));
  if (processes.some(name => !['docker-init', 'gmr-engine', 'wget'].includes(name))) throw Error('Engine child operation is running; defer restart');
}
const checkClassrooms = () => docker(['exec', 'fluentxverse-server', 'bun', '-e', `import {query,closePool} from './src/db/postgres';try{
const r=await query("SELECT COUNT(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
if(r.rows[0].n>0)throw Error('Active classrooms; defer Engine restart');}finally{await closePool();}`]);
const countsBefore = inspectDatabase(); inspectProcesses(); checkClassrooms();
const fxCheck = `const raw=process.env.GMR_ENGINE_API_BASE||process.env.GMR_ENGINE_BASE_URL||'';const base=raw.endsWith('/')?raw.slice(0,-1):raw;
const r=await fetch(base+'/v1/auth/me',{headers:{'X-GMR-Engine-Key':process.env.GMR_ENGINE_API_KEY},signal:AbortSignal.timeout(15000)});
if(!r.ok)throw Error('FluentXVerse Engine authentication failed');console.log('PASS FluentXVerse Engine authentication');`;
docker(['exec', 'fluentxverse-server', 'bun', '-e', fxCheck]);

function service(selectedImage) {
  return { image: selectedImage, container_name: 'budol-gmr-engine-1', restart: old.HostConfig.RestartPolicy.Name,
    environment: Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v.replaceAll('$', '$$')])),
    user: old.Config.User, working_dir: old.Config.WorkingDir, entrypoint: old.Config.Entrypoint, command: old.Config.Cmd,
    extra_hosts: old.HostConfig.ExtraHosts, logging: { driver: old.HostConfig.LogConfig.Type, options: old.HostConfig.LogConfig.Config },
    ports: Object.entries(old.HostConfig.PortBindings).flatMap(([port, bindings]) => bindings.map(binding => ({ target: Number(port.split('/')[0]), protocol: port.split('/')[1],
      published: binding.HostPort, ...(binding.HostIp ? { host_ip: binding.HostIp } : {}) }))),
    networks: Object.fromEntries(networks.map(name => [name, { aliases: (old.NetworkSettings.Networks[name].Aliases || []).filter(a => !/^[a-f0-9]{12,64}$/.test(a)) }])),
    volumes: old.Mounts.map(m => ({ type: m.Type, source: m.Type === 'volume' ? m.Name : m.Source, target: m.Destination, read_only: !m.RW })),
    labels: Object.fromEntries(Object.entries(old.Config.Labels).filter(([k]) => !k.startsWith('com.docker.compose.'))),
    ...(old.HostConfig.ReadonlyRootfs ? { read_only: true } : {}), ...(old.HostConfig.SecurityOpt ? { security_opt: old.HostConfig.SecurityOpt } : {}),
    ...(old.HostConfig.CapDrop ? { cap_drop: old.HostConfig.CapDrop } : {}), ...(old.HostConfig.Init ? { init: true } : {}),
    healthcheck: { test: old.Config.Healthcheck.Test, interval: `${old.Config.Healthcheck.Interval / 1e9}s`,
      timeout: `${old.Config.Healthcheck.Timeout / 1e9}s`, start_period: `${old.Config.Healthcheck.StartPeriod / 1e9}s`, retries: old.Config.Healthcheck.Retries } };
}
const compose = image => ({ name: project, services: { [serviceName]: service(image) },
  networks: Object.fromEntries(networks.map(name => [name, { external: true, name }])),
  volumes: Object.fromEntries(old.Mounts.filter(m => m.Type === 'volume').map(m => [m.Name, { external: true, name: m.Name }])) });
const target = join(state, 'runtime-compose.json'), rollback = join(state, 'rollback-compose.json');
writeFileSync(target, JSON.stringify(compose(image)), { mode: 0o600 });
writeFileSync(rollback, JSON.stringify(compose(baseTag)), { mode: 0o600 });
if (live().Id !== old.Id) throw Error('The running Engine changed during release preparation');
inspectDatabase(); inspectProcesses(); checkClassrooms();
try {
  docker(['compose', '-p', project, '-f', target, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', serviceName]);
  const current = live();
  if (current.Config.Image !== image || current.State.Health.Status !== 'healthy'
    || JSON.stringify([...current.Config.Env].sort()) !== JSON.stringify([...old.Config.Env].sort())
    || JSON.stringify(current.HostConfig.PortBindings) !== JSON.stringify(old.HostConfig.PortBindings)) throw Error('Engine runtime configuration drift');
  const hash = docker(['exec', 'budol-gmr-engine-1', 'sha256sum', '/usr/local/bin/gmr-engine']).split(' ')[0];
  if (hash !== binaryHash) throw Error('Wrong Engine binary');
  if (docker(['exec', 'budol-gmr-engine-1', 'node', '-e', configCheck]).trim() !== policyBefore) throw Error('Project policies changed');
  if (JSON.stringify(inspectDatabase()) !== JSON.stringify(countsBefore)) throw Error('Engine financial/proof records changed');
  docker(['exec', 'fluentxverse-server', 'bun', '-e', fxCheck]);
  writeFileSync(join(output, 'deployment.json'), JSON.stringify({ deployedAt: new Date().toISOString(), image, previousImageId: expected,
    binarySHA256: binaryHash, baselineReproduced: true, policiesUnchanged: true, environmentUnchanged: true,
    financialAndProofRecordCountsUnchanged: true, proofActivation: false, chainTransactions: 0 }, null, 2) + '\n');
  console.log('PASS Engine security release deployed healthy; existing configuration and financial/proof records preserved.');
  console.log(`Protected rollback configuration: ${rollback}`);
} catch (error) {
  console.error('Engine release check failed; restoring the previous runtime.');
  docker(['compose', '-p', project, '-f', rollback, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', serviceName]);
  throw error;
}
