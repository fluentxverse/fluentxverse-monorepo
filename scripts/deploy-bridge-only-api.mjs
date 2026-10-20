import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/release/bridge-only-archive-20261019');
const image = 'fluentxverse-server:bridge-only-archive-20261019';
const expectedPrevious = 'fluentxverse-server:lesson-disputes-20261018';
const deploy = process.argv.includes('--deploy');
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw Error(`Docker ${args[0]} failed: ${result.stderr.slice(-800)}`);
  return result.stdout;
}
function live() { return JSON.parse(docker(['inspect', 'fluentxverse-server']))[0]; }
async function readApi(path) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:8765${path}`, {
        headers: { Connection: 'close' }, signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error(`API read failed (${response.status})`);
      return await response.json();
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
const old = live();
if (old.Config.Image !== expectedPrevious) throw Error('The running API changed; review the release instead of overwriting it.');
mkdirSync(output, { recursive: true });
const selected = ['src/services/anonymousReviews', 'src/services/screening', 'src/services/proof.services/horizenReceipt.ts',
  'src/services/web3.services/gmrProofReceipt.service.ts', 'src/services/web3.services/gmrScreeningEngine.service.ts',
  'src/services/lessonPasses/policy.ts', 'src/services/lessonPasses/service.ts',
  'src/services/lessonPasses/chain.ts', 'src/services/schedule.services/trialPolicy.ts',
  'src/routes/anonymousReviews.route.ts', 'src/routes/screening.route.ts'];
const source = join(root, 'fluentxverse-server'), context = join(output, 'image');
const files = [];
function copy(path) {
  let entries;
  try { entries = readdirSync(join(source, path), { withFileTypes: true }); }
  catch (error) { if (error.code !== 'ENOTDIR') throw error; }
  if (entries) { for (const entry of entries) { if (entry.isSymbolicLink()) throw Error('Review source symlinks first'); copy(`${path}/${entry.name}`); } return; }
  if (!/\.(ts|mjs)$/.test(path)) throw Error(`Unexpected overlay file: ${path}`);
  const target = join(context, path); mkdirSync(dirname(target), { recursive: true }); copyFileSync(join(source, path), target);
  files.push({ path, sha256: createHash('sha256').update(readFileSync(target)).digest('hex') });
}
for (const path of selected) copy(path);
writeFileSync(join(context, 'Dockerfile'), `FROM ${expectedPrevious}\nCOPY --chown=appuser:appgroup src /app/src\n`);
docker(['build', '--network=none', '-t', image, context]);
docker(['run', '--rm', '--network=none', image, 'bun', 'build', 'src/index.ts', '--target=bun', '--outfile=/tmp/bridge-api-check.js']);
writeFileSync(join(output, 'source-manifest.json'), JSON.stringify({ image, previousImage: expectedPrevious,
  baseImageId: old.Image, files }, null, 2) + '\n');
console.log(`Prepared ${image}: ${files.length} scoped source files; no dependency or frontend update.`);
if (!deploy) process.exit(0);
if (live().Image !== old.Image) throw Error('The running API changed during preparation');
const project = old.Config.Labels['com.docker.compose.project'], serviceName = old.Config.Labels['com.docker.compose.service'];
const networks = Object.keys(old.NetworkSettings.Networks);
if (!project || !serviceName || networks.length !== 1 || old.Config.Env.some(value => value.includes('\n'))) throw Error('Unexpected runtime layout');
const runtime = Object.fromEntries(old.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
const mode = await readApi('/lesson-passes/mode');
if (!mode.success || !['trial', 'legacy_erc1155'].includes(mode.data?.mode)) throw Error('Resolve active private passes before retiring their adapter');
const issuerBefore = await readApi('/lesson-privacy/issuer');
if (!issuerBefore.success || !issuerBefore.data?.keyId) throw Error('The current lesson-evidence issuer is unavailable');
const configured = { ...runtime, PRIVACY_INFRA_MODE: 'bridge_only', SCREENING_ENABLED: 'false',
  LESSON_PASSES_ENABLED: 'false', ANONYMOUS_REVIEW_TALLY_ENABLED: 'false',
  LESSON_BOOKING_MODE: runtime.LESSON_BOOKING_MODE || (mode.data.mode === 'trial' ? 'trial' : 'paid') };
const privateDir = join(homedir(), '.local/state/fluentxverse', `bridge-only-archive-${Date.now()}`);
mkdirSync(privateDir, { recursive: true, mode: 0o700 }); chmodSync(privateDir, 0o700);
writeFileSync(join(privateDir, 'previous-container.json'), JSON.stringify(old), { mode: 0o600, flag: 'wx' });
const envFile = join(privateDir, 'preflight.env');
writeFileSync(envFile, Object.entries(configured).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
const preflight = `
import neo4j from 'neo4j-driver';
import {query,closePool} from './src/db/postgres';
import {reviewConfig,reviewGroupId} from './src/services/anonymousReviews/policy';
import {AnonymousReviewChain} from './src/services/anonymousReviews/chain';
import {privacyInfrastructure} from './src/services/proof.services/horizenReceipt';
import {LessonPrivacyCrypto} from './src/services/lessonPrivacy/crypto';
import {publicPassMode,privatePassMode} from './src/services/lessonPasses/policy';
const driver=neo4j.driver(process.env.MEMGRAPH_URI,neo4j.auth.basic(process.env.MEMGRAPH_USER||'',process.env.MEMGRAPH_PASSWORD||''));
const session=driver.session();
try{
  const active=await query("SELECT COUNT(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
  if(active.rows[0].n>0)throw Error('Active classroom connections; defer release');
  const counts={};
  for(const label of ['AnonymousReviewCohort','AnonymousReviewEnrollment','AnonymousReviewSubmission','AnonymousReviewTally','TutorScreeningCredential','LessonPassOrder','LessonPassReservation','LessonPass']){
    const result=await session.run('MATCH(n:'+label+') RETURN count(n) AS n');counts[label]=Number(result.records[0].get('n').toString());
    if(counts[label]!==0)throw Error('Historical privacy records require a reviewed migration; no records were changed');
  }
  const config=reviewConfig();await new AnonymousReviewChain().check();
  if(privacyInfrastructure()!=='bridge_only'||config.contract.toLowerCase()!==config.bridge.toLowerCase()||privatePassMode())throw Error('Wrong infrastructure');
  const crypto=new LessonPrivacyCrypto();if(!crypto.evidenceEnabled)throw Error('Private lesson evidence keys are unavailable');
  console.log(JSON.stringify({mode:privacyInfrastructure(),counts,activeClassroomConnections:active.rows[0].n,
    recordingEnabled:process.env.QA_RECORDING_ENABLED==='true',recordingKeyConfigured:/^[a-f0-9]{64}$/i.test(process.env.QA_RECORDING_ENCRYPTION_KEY||''),
    evidenceIssuer:crypto.issuer().keyId,bookingMode:publicPassMode().mode,reviewBridge:config.bridge,reviewChain:config.chainId}));
}finally{await session.close();await driver.close();await closePool();}
`;
const preflightResult = JSON.parse(docker(['run', '--rm', '--network', networks[0], '--env-file', envFile, image, 'bun', '-e', preflight]).trim());
if (preflightResult.evidenceIssuer !== issuerBefore.data.keyId || preflightResult.bookingMode !== mode.data.mode
  || !preflightResult.recordingEnabled || !preflightResult.recordingKeyConfigured) throw Error('A protected live workflow would change');
writeFileSync(join(output, 'preflight.json'), JSON.stringify(preflightResult, null, 2) + '\n');
function service(env, selectedImage) {
  return { image: selectedImage, container_name: 'fluentxverse-server', restart: old.HostConfig.RestartPolicy.Name,
    environment: Object.fromEntries(Object.entries(env).map(([key, value]) => [key, value.replaceAll('$', '$$')])),
    user: old.Config.User, working_dir: old.Config.WorkingDir, entrypoint: old.Config.Entrypoint, command: old.Config.Cmd,
    extra_hosts: old.HostConfig.ExtraHosts, logging: { driver: old.HostConfig.LogConfig.Type, options: old.HostConfig.LogConfig.Config },
    ports: Object.entries(old.HostConfig.PortBindings).flatMap(([port, bindings]) => bindings.map(binding => ({ target: Number(port.split('/')[0]),
      protocol: port.split('/')[1], published: binding.HostPort, ...(binding.HostIp ? { host_ip: binding.HostIp } : {}) }))),
    networks: Object.fromEntries(networks.map(name => [name, { aliases: (old.NetworkSettings.Networks[name].Aliases || []).filter(alias => !/^[a-f0-9]{12,64}$/.test(alias)) }])),
    volumes: old.Mounts.map(m => ({ type: m.Type, source: m.Type === 'volume' ? m.Name : m.Source, target: m.Destination, read_only: !m.RW })),
    labels: Object.fromEntries(Object.entries(old.Config.Labels).filter(([key]) => !key.startsWith('com.docker.compose.'))),
    ...(old.HostConfig.ReadonlyRootfs ? { read_only: true } : {}), ...(old.HostConfig.SecurityOpt ? { security_opt: old.HostConfig.SecurityOpt } : {}),
    ...(old.HostConfig.CapDrop ? { cap_drop: old.HostConfig.CapDrop } : {}), ...(old.HostConfig.Init ? { init: true } : {}),
    ...(old.Config.Healthcheck ? { healthcheck: { test: old.Config.Healthcheck.Test, interval: '30s', timeout: '10s', start_period: '5s', retries: 3 } } : {}),
  };
}
function compose(svc) { return { name: project, services: { [serviceName]: svc },
  networks: Object.fromEntries(networks.map(name => [name, { external: true, name }])),
  volumes: Object.fromEntries(old.Mounts.filter(m => m.Type === 'volume').map(m => [m.Name, { external: true, name: m.Name }])) }; }
const targetFile = join(privateDir, 'runtime-compose.json'), rollbackFile = join(privateDir, 'rollback-compose.json');
writeFileSync(targetFile, JSON.stringify(compose(service(configured, image))), { mode: 0o600 });
writeFileSync(rollbackFile, JSON.stringify(compose(service(runtime, old.Config.Image))), { mode: 0o600 });
if (live().Id !== old.Id) throw Error('The live container changed; defer release');
docker(['exec', 'fluentxverse-server', 'bun', '-e', `
    import {query,closePool} from './src/db/postgres';
    try{const r=await query("SELECT COUNT(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
      if(r.rows[0].n>0)throw Error('Active classroom connections; defer release');}
    finally{await closePool();}`]);
try {
  docker(['compose', '-p', project, '-f', targetFile, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', serviceName]);
  await readApi('/health');
  const metadata = await readApi('/screening/agent.json');
  const currentMode = await readApi('/lesson-passes/mode');
  const issuer = await readApi('/lesson-privacy/issuer');
  if (metadata.type !== 'fluentxverse.screening-service.v1' || metadata.active || metadata.registrations?.length !== 0
    || currentMode.data?.mode !== mode.data.mode || issuer.data?.keyId !== issuerBefore.data.keyId) throw Error('Live compatibility check failed');
  writeFileSync(join(output, 'deployment.json'), JSON.stringify({ image, previousImage: old.Config.Image,
    deployedAt: new Date().toISOString(), mode: 'bridge_only', bookingMode: currentMode.data.mode,
    lessonEvidenceIssuerUnchanged: true, noFrontendDeployment: true, chainTransactions: 0, entitlementMigration: false }, null, 2) + '\n');
  console.log('PASS bridge-only API deployed. Existing booking policy, recording keys, evidence issuer, ports and volumes preserved.');
  console.log(`Protected rollback configuration: ${rollbackFile}`);
} catch (error) {
  console.error('Activation failed; restoring the previous runtime.');
  docker(['compose', '-p', project, '-f', rollbackFile, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', serviceName]);
  throw error;
}
