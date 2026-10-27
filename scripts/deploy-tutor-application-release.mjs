import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { literalComposeEnvironment } from './lib/mail-runtime-env.mjs';

if (!process.argv.includes('--deploy')) throw Error('Use --deploy after the exact release passes verification.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/release/tutor-application-20261022');
const frontend = join(output, 'frontend');
const manifest = JSON.parse(readFileSync(join(output, 'source-manifest.json')));
const verified = JSON.parse(readFileSync(join(output, 'verification.json')));
const hash = value => createHash('sha256').update(value).digest('hex');
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const inspect = () => JSON.parse(docker(['inspect', 'fluentxverse-server']))[0];
const old = inspect();
if (old.Image !== manifest.baseImageId || old.Config.Image !== manifest.previousImage) throw Error('The production API changed. Rebase this release first.');
if (!verified.passed || verified.imageId !== JSON.parse(docker(['image', 'inspect', manifest.image]))[0].Id || verified.frontendIndexSha256 !== hash(readFileSync(join(frontend, 'dist/index.html')))) throw Error('The verified build changed.');
for (const [file, expected] of Object.entries(manifest.files)) if (hash(readFileSync(join(output, file))) !== expected) throw Error('Prepared source changed.');
function wrangler(args) {
  return execFileSync('bunx', ['--bun', 'wrangler@4.151.1', ...args, '--config', 'wrangler.jsonc'], {
    cwd: frontend, env: { ...process.env, CI: '1' }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
}
function currentTutor() {
  return [...wrangler(['deployments', 'list']).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)].at(-1)?.[1];
}
if (currentTutor() !== manifest.previousTutor) throw Error('The tutor deployment changed; do not replace another release.');
const runtime = Object.fromEntries(old.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
if (runtime.SCREENING_ENABLED === 'true' || runtime.LESSON_PASSES_ENABLED === 'true') throw Error('Review enabled cryptographic workflows before changing the screening policy.');
if (Object.values(runtime).some(value => /[\r\n\0]/.test(value))) throw Error('Review multiline runtime variables first.');
const project = old.Config.Labels['com.docker.compose.project'], serviceName = old.Config.Labels['com.docker.compose.service'];
const networks = Object.keys(old.NetworkSettings.Networks);
if (!project || !serviceName || networks.length !== 1) throw Error('Unexpected production runtime layout.');
const privateDir = join(homedir(), '.local/state/fluentxverse', `application-release-${Date.now()}`);
const keyDir = join(homedir(), '.local/state/fluentxverse/application-recordings');
for (const dir of [privateDir, keyDir]) { mkdirSync(dir, { recursive: true, mode: 0o700 }); chmodSync(dir, 0o700); }
const keyFile = join(keyDir, 'evidence-key.hex');
let key = runtime.SCREENING_EVIDENCE_KEY_HEX || '';
if (key && !/^[a-f0-9]{64}$/i.test(key)) throw Error('An existing recording key is invalid. Do not replace it automatically.');
if (existsSync(keyFile)) {
  const saved = readFileSync(keyFile, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(saved) || (key && key !== saved)) throw Error('Resolve the recording key backup mismatch.');
  key ||= saved;
}
key ||= randomBytes(32).toString('hex');
if (!existsSync(keyFile)) writeFileSync(keyFile, key + '\n', { mode: 0o600, flag: 'wx' });
chmodSync(keyFile, 0o600);
runtime.SCREENING_EVIDENCE_KEY_HEX = key;
writeFileSync(join(privateDir, 'previous-container.json'), JSON.stringify(old), { mode: 0o600, flag: 'wx' });
const envFile = join(privateDir, 'preflight.env');
writeFileSync(envFile, Object.entries(runtime).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
const secrets = Object.entries(runtime).filter(([name, value]) => /SECRET|PASSWORD|PRIVATE|TOKEN|KEY/i.test(name) && !/PUBLIC|_ID$/i.test(name) && value.length >= 24).map(([, value]) => Buffer.from(value));
for (const file of files(join(frontend, 'dist'))) if (secrets.some(secret => readFileSync(file).includes(secret))) throw Error('A server secret appears in frontend output.');
async function api(path, base = 'http://127.0.0.1:8765') {
  for (let i = 0; ; i++) {
    try {
      const response = await fetch(base + path, { headers: { Connection: 'close' }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('API check failed');
      return await response.json();
    } catch (error) { if (i >= 10) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
}
const before = { health: await api('/health/detailed'), mode: await api('/lesson-passes/mode'), issuer: await api('/lesson-privacy/issuer'), screening: await api('/screening/agent.json') };
if (before.health.checks?.memgraph?.status !== 'ok' || before.health.checks?.postgres?.status !== 'ok') throw Error('Resolve existing database health problems before deploying.');
const activityCheck = `import {db,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';
 await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();
 try{const rows=await db\`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'\`;
 const recent=await s.run("MATCH(e:Exam) WHERE e.status IN ['active','queued','processing','generating'] AND e.createdAt >= $cutoff RETURN count(e) AS n",{cutoff:new Date(Date.now()-3600000).toISOString()});
 if(rows[0].n>0||Number(recent.records[0].get('n'))>0)throw Error('Active classrooms or assessments; defer release');
 console.log(JSON.stringify({activeClassrooms:rows[0].n,activeAssessments:Number(recent.records[0].get('n'))}));
 }finally{await s.close();await closeDriver();await closePool();}`;
console.log(docker(['exec', 'fluentxverse-server', 'bun', '-e', activityCheck]).trim());
let preflight;
try {
  const probe = `import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';import{ensureApplicationSchema}from'./src/services/exam.services/applicationPolicy';import{ensureInterviewCalendar}from'./src/services/interview.services/interviewTime';import{sealPrivateEvidence,openPrivateEvidence}from'./src/services/screening/storage';
 await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();
 try{for(const label of ['Exam','SpeakingRecording','InterviewCalendar']){const r=await s.run('MATCH(n:'+label+') WITH n.id AS id,count(n) AS n WHERE n>1 RETURN count(*) AS duplicates');if(Number(r.records[0].get('duplicates'))>0)throw Error('Duplicate identifiers require manual review');}
 await s.run('CREATE SNAPSHOT;');
 const value=sealPrivateEvidence(Buffer.from('deployment-self-check'),'release-context');if(openPrivateEvidence(value,'release-context').toString()!=='deployment-self-check')throw Error('Recording encryption self-check failed');
 await ensureApplicationSchema();await ensureInterviewCalendar();console.log(JSON.stringify({snapshotCreated:true,recordingEncryptionVerified:true,assessmentConstraintsReady:true}));
 }finally{await s.close();await closeDriver();}`;
  preflight = JSON.parse(docker(['run', '--rm', '--network', networks[0], '--env-file', envFile, manifest.image, 'bun', '-e', probe]).trim().split('\n').at(-1));
} finally { rmSync(envFile, { force: true }); }
const snapshot = docker(['exec', 'fluentxverse-memgraph', 'ls', '-1t', '/var/lib/memgraph/snapshots']).trim().split('\n')[0];
if (!/^[a-zA-Z0-9_.:-]+$/.test(snapshot || '')) throw Error('Could not identify the new graph snapshot.');
docker(['cp', `fluentxverse-memgraph:/var/lib/memgraph/snapshots/${snapshot}`, join(privateDir, 'memgraph.snapshot')]);
chmodSync(join(privateDir, 'memgraph.snapshot'), 0o600);
function service(image) {
  return { image, container_name: old.Name.replace(/^\//, ''), restart: old.HostConfig.RestartPolicy.Name,
    environment: literalComposeEnvironment(runtime), user: old.Config.User, working_dir: old.Config.WorkingDir,
    entrypoint: old.Config.Entrypoint, command: old.Config.Cmd, extra_hosts: old.HostConfig.ExtraHosts,
    logging: { driver: old.HostConfig.LogConfig.Type, options: old.HostConfig.LogConfig.Config },
    ports: Object.entries(old.HostConfig.PortBindings).flatMap(([port, bindings]) => bindings.map(binding => ({ target: Number(port.split('/')[0]), protocol: port.split('/')[1], published: binding.HostPort, ...(binding.HostIp ? { host_ip: binding.HostIp } : {}) }))),
    networks: Object.fromEntries(networks.map(name => [name, { aliases: (old.NetworkSettings.Networks[name].Aliases || []).filter(alias => !/^[a-f0-9]{12,64}$/.test(alias)) }])),
    volumes: old.Mounts.map(m => ({ type: m.Type, source: m.Type === 'volume' ? m.Name : m.Source, target: m.Destination, read_only: !m.RW })),
    labels: Object.fromEntries(Object.entries(old.Config.Labels).filter(([k]) => !k.startsWith('com.docker.compose.'))),
    ...(old.HostConfig.ReadonlyRootfs ? { read_only: true } : {}), ...(old.HostConfig.SecurityOpt ? { security_opt: old.HostConfig.SecurityOpt } : {}),
    ...(old.HostConfig.CapDrop ? { cap_drop: old.HostConfig.CapDrop } : {}), ...(old.HostConfig.Init ? { init: true } : {}),
    ...(old.Config.Healthcheck ? { healthcheck: { test: old.Config.Healthcheck.Test, interval: '30s', timeout: '10s', start_period: '5s', retries: 3 } } : {}),
  };
}
const compose = image => ({ name: project, services: { [serviceName]: service(image) }, networks: Object.fromEntries(networks.map(name => [name, { external: true, name }])),
  volumes: Object.fromEntries(old.Mounts.filter(m => m.Type === 'volume').map(m => [m.Name, { external: true, name: m.Name }])) });
const target = join(privateDir, 'runtime-compose.json'), rollback = join(privateDir, 'rollback-compose.json');
for (const [file, image] of [[target, manifest.image], [rollback, manifest.previousImage]]) writeFileSync(file, JSON.stringify(compose(image)), { mode: 0o600, flag: 'wx' });
if (inspect().Id !== old.Id || currentTutor() !== manifest.previousTutor) throw Error('Another production release started during preflight.');
docker(['exec', 'fluentxverse-server', 'bun', '-e', activityCheck]);
let apiActivated = false, tutorVersion;
try {
  apiActivated = true;
  console.log('[release] Activating the verified API image.');
  console.log(docker(['compose', '-p', project, '-f', target, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', serviceName]));
  const health = await api('/health/detailed');
  if (health.checks?.memgraph?.status !== 'ok' || health.checks?.postgres?.status !== 'ok') throw Error('New API dependencies are unhealthy.');
  const auth = await fetch('http://127.0.0.1:8765/exam/speaking/active');
  if (auth.status !== 401 || auth.headers.get('cache-control') !== 'private, no-store') throw Error('Production assessment authentication failed.');
  if (currentTutor() !== manifest.previousTutor) throw Error('Tutor assets changed during API activation.');
  console.log('[release] Publishing verified tutor assets to Cloudflare.');
  const result = wrangler(['deploy', '--message', 'Tutor application: resumable encrypted recordings and durable grading']);
  console.log(result);
  tutorVersion = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
  if (!tutorVersion) throw Error('Inspect the uploaded tutor version before continuing.');
  const after = { mode: await api('/lesson-passes/mode'), issuer: await api('/lesson-privacy/issuer'), screening: await api('/screening/agent.json') };
  if (after.mode.data?.mode !== before.mode.data?.mode || after.issuer.data?.keyId !== before.issuer.data?.keyId || after.screening.active !== before.screening.active) throw Error('Protected workflow compatibility check failed.');
  const current = inspect(), actualEnv = Object.fromEntries(current.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
  if (current.Image !== verified.imageId || Object.entries(runtime).some(([k, v]) => actualEnv[k] !== v)) throw Error('The production image or runtime differs from the verified deployment.');
  const publicHealth = await api('/health/detailed', 'https://api.fluentxverse.com');
  if (publicHealth.checks?.memgraph?.status !== 'ok') throw Error('Public API tunnel check failed.');
  const html = await (await fetch('https://tutor.fluentxverse.com/', { cache: 'no-store', signal: AbortSignal.timeout(15000) })).text();
  const expectedIndex = readFileSync(join(frontend, 'dist/index.html'), 'utf8');
  const asset = expectedIndex.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
  if (!asset || !html.includes(asset)) throw Error('Public tutor HTML is not the new release.');
  const remote = await fetch('https://tutor.fluentxverse.com' + asset, { signal: AbortSignal.timeout(15000) });
  if (!remote.ok || hash(Buffer.from(await remote.arrayBuffer())) !== hash(readFileSync(join(frontend, 'dist', asset.slice(1))))) throw Error('Public tutor entry bundle verification failed.');
  writeFileSync(join(output, 'deployment.json'), JSON.stringify({ deployedAt: new Date().toISOString(), image: manifest.image, imageId: current.Image,
    previousImage: manifest.previousImage, tutorVersion, previousTutor: manifest.previousTutor, preflight,
    secretBackupConfigured: true, graphSnapshotBackedUp: true, runtimePreserved: true, mailPreserved: true,
    bookingModePreserved: true, lessonEvidenceIssuerPreserved: true, chainTransactions: 0, rollbackConfig: rollback }, null, 2));
  console.log('PASS production API, public tunnel, encryption and Cloudflare tutor release verified.');
} catch (error) {
  console.error('Release verification failed; restoring the previous application versions.');
  try {
    if (tutorVersion && currentTutor() === tutorVersion) wrangler(['rollback', manifest.previousTutor, '--message', 'Restore tutor after incomplete application release']);
  } catch {
    console.error('Cloudflare rollback needs operator attention; API rollback will still be attempted.');
  } finally {
    if (apiActivated) docker(['compose', '-p', project, '-f', rollback, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', serviceName]);
  }
  throw error;
}
