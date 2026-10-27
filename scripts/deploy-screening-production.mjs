import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { literalComposeEnvironment } from './lib/mail-runtime-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), engine = resolve(root, '../budol/gmr-engine');
const state = join(homedir(), '.local/state/fluentxverse/screening-production-20261022');
const output = join(root, 'output/release/screening-production-20261022');
const backup = JSON.parse(readFileSync(join(state, 'runtime-backup.json'))), identity = JSON.parse(readFileSync(join(state, 'identity.json')));
const releaseRoot = join(engine, 'zk/screening/releases/self-operated-20261022');
const localConfig = JSON.parse(readFileSync(join(releaseRoot, 'operator-config.json')));
const releaseConfig = { ...localConfig, vkPath: '/app/zk/screening/releases/self-operated-20261022/verification-key.json',
  releaseManifestPath: '/app/zk/screening/releases/self-operated-20261022/manifest.json' };
const imageEngine = 'budol-gmr-engine:screening-self-operated-20261022', imageAPI = 'fluentxverse-server:screening-self-operated-20261022';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const command = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
const docker = args => command('docker', args);
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const env = c => Object.fromEntries(c.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true }); };
mkdirSync(output, { recursive: true });
if (process.argv.includes('--refresh-pilot')) {
  copy(join(root, 'fluentxverse-server/tests/screening.production.pilot.ts'), join(output, 'api-image/tests/screening.production.pilot.ts'));
  copy(join(root, 'fluentxverse-server/tests/screening.production.reconcile.ts'), join(output, 'api-image/tests/screening.production.reconcile.ts'));
  docker(['build', '--network=none', '--target', 'test', '-t', imageAPI + '-test', join(output, 'api-image')]);
  console.log('Refreshed isolated pilot harness only; production image unchanged.');
}
if (process.argv.includes('--prepare')) {
  for (const [name, previous] of [['budol-gmr-engine-1', backup.engine], ['fluentxverse-server', backup.api]]) {
    if (inspect(name).Image !== previous.Image) throw Error('Live baseline changed; prepare a new release');
  }
  const original = join(root, 'output/release/engine-zk-security-20261020/source');
  const source = join(output, 'engine-source'), base = join(output, 'engine-baseline');
  if (existsSync(source)) throw Error('Candidate already prepared; do not overwrite a reviewed snapshot');
  cpSync(original, source, { recursive: true }); cpSync(original, base, { recursive: true });
  const buildEnv = { ...process.env, GOTOOLCHAIN: 'go1.25.14', CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64', GOAMD64: 'v1' };
  command('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', join(output, 'baseline-engine'), './cmd/api'], { cwd: base, env: buildEnv });
  const liveBinary = command('docker', ['exec', 'budol-gmr-engine-1', 'sha256sum', '/usr/local/bin/gmr-engine']).split(' ')[0];
  if (hash(readFileSync(join(output, 'baseline-engine'))) !== liveBinary) throw Error('Cannot reproduce running Engine baseline');
  for (const name of ['internal/config/config.go', 'internal/httpapi/api.go', 'internal/httpapi/screening_prover.go',
    'internal/httpapi/screening_prover_test.go', 'internal/httpapi/zkverify_policy.go', 'internal/httpapi/zkverify_policy_test.go']) copy(join(engine, name), join(source, name));
  command('go', ['test', '-race', './internal/httpapi', './internal/config'], { cwd: source });
  command('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', join(output, 'gmr-engine'), './cmd/api'], { cwd: source, env: buildEnv });
  const ctx = join(output, 'engine-image'); copy(join(output, 'gmr-engine'), join(ctx, 'gmr-engine'));
  const scripts = ['screening-bridge-prover.ts', 'screening-release.ts', 'proving-release.ts', 'proving-circuits.ts',
    'screening-attestations.ts', 'screening-ceremony.ts', 'screening-artifacts.ts', 'screening-prove.ts', 'screening-worker.ts',
    'screening-proof-worker.mjs', 'screening-setup-worker.mjs', 'groth16-key-safety.ts', 'zkverify-network.ts'];
  for (const name of scripts) copy(join(engine, 'scripts', name), join(ctx, 'scripts', name));
  // Dependencies are identical to the running image. No archived deployment CLI is restored.
  const engineBase = `budol-gmr-engine:screening-base-${backup.engine.Image.slice(7, 19)}`;
  docker(['tag', backup.engine.Image, engineBase]);
  writeFileSync(join(ctx, 'Dockerfile'), `FROM ${engineBase}\nCOPY --chmod=0755 gmr-engine /usr/local/bin/gmr-engine\nCOPY scripts /app/scripts\n`);
  docker(['build', '--network=none', '-t', imageEngine, ctx]);
  const api = join(output, 'api-image');
  for (const name of readdirSync(join(root, 'fluentxverse-server/src/services/screening'))) {
    if (name.endsWith('.ts')) copy(join(root, 'fluentxverse-server/src/services/screening', name), join(api, 'src/services/screening', name));
  }
  for (const name of ['screening.engine.test.ts', 'screening.test.ts', 'screening.http.test.ts', 'screening.fixture.ts', 'application.fixtures.ts', 'zkSecurity.test.ts',
    'applicationPolicy.test.ts', 'screening.consent.integration.ts', 'screening.production.pilot.ts']) copy(join(root, 'fluentxverse-server/tests', name), join(api, 'tests', name));
  const apiBase = `fluentxverse-server:screening-base-${backup.api.Image.slice(7, 19)}`;
  docker(['tag', backup.api.Image, apiBase]);
  writeFileSync(join(api, 'Dockerfile'), `FROM ${apiBase} AS release\nCOPY --chown=appuser:appgroup src /app/src\nFROM release AS test\nCOPY --chown=appuser:appgroup tests /app/tests\n`);
  docker(['build', '--network=none', '--target', 'release', '-t', imageAPI, api]);
  docker(['build', '--network=none', '--target', 'test', '-t', imageAPI + '-test', api]);
  docker(['run', '--rm', '--network=none', imageAPI, 'bun', 'build', 'src/index.ts', '--target=bun', '--outfile=/tmp/api.js']);
  console.log(docker(['run', '--rm', '--network=none', imageAPI + '-test', 'bun', 'test', './tests/screening.engine.test.ts', './tests/screening.test.ts',
    './tests/screening.http.test.ts', './tests/zkSecurity.test.ts', './tests/applicationPolicy.test.ts']));
  save(join(output, 'candidate.json'), { baselineReproduced: true, engineImage: JSON.parse(docker(['image', 'inspect', imageEngine]))[0].Id,
    apiImage: JSON.parse(docker(['image', 'inspect', imageAPI]))[0].Id, manifestSHA256: releaseConfig.releaseManifestSHA256,
    preparedAt: new Date().toISOString(), independentAudit: false });
  console.log('PASS scoped Engine/API images prepared and tested; no runtime changed.');
}

function compose(old, image, runtime) {
  const networks = Object.keys(old.NetworkSettings.Networks), project = old.Config.Labels['com.docker.compose.project'], name = old.Config.Labels['com.docker.compose.service'];
  if (!project || !name || networks.length !== 1) throw Error('Unexpected runtime layout');
  return { name: project, services: { [name]: { image, container_name: old.Name.slice(1), restart: old.HostConfig.RestartPolicy.Name,
    environment: literalComposeEnvironment(runtime), user: old.Config.User, working_dir: old.Config.WorkingDir,
    entrypoint: old.Config.Entrypoint, command: old.Config.Cmd, extra_hosts: old.HostConfig.ExtraHosts,
    logging: { driver: old.HostConfig.LogConfig.Type, options: old.HostConfig.LogConfig.Config },
    ports: Object.entries(old.HostConfig.PortBindings).flatMap(([port, bindings]) => bindings.map(binding => ({ target: Number(port.split('/')[0]),
      protocol: port.split('/')[1], published: binding.HostPort, ...(binding.HostIp ? { host_ip: binding.HostIp } : {}) }))),
    networks: Object.fromEntries(networks.map(n => [n, { aliases: (old.NetworkSettings.Networks[n].Aliases || []).filter(a => !/^[a-f0-9]{12,64}$/.test(a)) }])),
    volumes: old.Mounts.map(m => ({ type: m.Type, source: m.Type === 'volume' ? m.Name : m.Source, target: m.Destination, read_only: !m.RW })),
    labels: Object.fromEntries(Object.entries(old.Config.Labels).filter(([k]) => !k.startsWith('com.docker.compose.'))),
    ...(old.HostConfig.ReadonlyRootfs ? { read_only: true } : {}), ...(old.HostConfig.SecurityOpt ? { security_opt: old.HostConfig.SecurityOpt } : {}),
    ...(old.HostConfig.CapDrop ? { cap_drop: old.HostConfig.CapDrop } : {}), ...(old.HostConfig.Init ? { init: true } : {}),
    healthcheck: { test: old.Config.Healthcheck.Test, interval: '30s', timeout: '10s', start_period: '5s', retries: 3 },
  } }, networks: Object.fromEntries(networks.map(n => [n, { external: true, name: n }])),
    volumes: Object.fromEntries(old.Mounts.filter(m => m.Type === 'volume').map(m => [m.Name, { external: true, name: m.Name }])) };
}
const engineRuntime = { ...env(backup.engine), GMR_ENGINE_SCREENING_PROVER_PATH: '/app/config/screening-prover.production.json' };
const apiRuntime = { ...env(backup.api), SCREENING_ENABLED: 'false', SCREENING_ARTIFACTS_APPROVED: 'true', SCREENING_RELEASE_POLICY: 'self-operated',
  SCREENING_CHAIN_ID: '26514', SCREENING_RPC_URL: 'https://horizen.calderachain.xyz/http', SCREENING_RECEIPT_BRIDGE: releaseConfig.bridge,
  SCREENING_ISSUER_KEY_HEX: identity.issuerSeed, SCREENING_ISSUER_HASH: releaseConfig.issuerHash,
  SCREENING_ZKVERIFY_VK_HASH: releaseConfig.vkHash, SCREENING_ZKVERIFY_DOMAIN_ID: '3', SCREENING_RELEASE_MANIFEST_SHA256: releaseConfig.releaseManifestSHA256,
  GMR_SCREENING_ENGINE_API_BASE: 'http://host.docker.internal:8090', GMR_SCREENING_ENGINE_API_KEY: identity.apiKey };
if (process.argv.includes('--verify-image')) {
  const raw = command('docker', ['run', '--rm', '-i', '--mount',
    `type=bind,source=${join(engine, 'zk/screening/releases')},target=/app/zk/screening/releases,readonly`,
    imageEngine, 'bun', '--no-env-file', 'scripts/screening-bridge-prover.ts'], {
    input: JSON.stringify({ action: 'verify', config: releaseConfig }), timeout: 1800000,
  });
  const verified = JSON.parse(raw);
  if (verified.cryptographicSetupVerified !== true || verified.independentlyReviewed !== false || verified.releaseManifestSHA256 !== releaseConfig.releaseManifestSHA256) throw Error('Engine image setup verification failed');
  save(join(output, 'image-verification.json'), { imageId: JSON.parse(docker(['image', 'inspect', imageEngine]))[0].Id,
    manifestSHA256: releaseConfig.releaseManifestSHA256, verifiedAt: new Date().toISOString(), cryptographicSetupVerified: true, independentlyAudited: false });
  console.log('PASS isolated production Engine image verifies the exact setup without signer credentials.');
}
function install(name, old, image, runtime) {
  const path = join(state, name + '-compose.json'); save(path, compose(old, image, runtime));
  const service = old.Config.Labels['com.docker.compose.service'], project = old.Config.Labels['com.docker.compose.project'];
  docker(['compose', '-p', project, '-f', path, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', service]);
}
function noActivity() {
  command('node', [join(root, 'scripts/screening-engine-maintenance.mjs')]);
  docker(['exec', 'fluentxverse-server', 'bun', '-e', `import{query,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();
try{const r=await query("SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
const exams=await s.run("MATCH(e:Exam) WHERE e.status IN ['active','queued','processing','generating'] AND e.createdAt >= $cutoff RETURN count(e) AS n",{cutoff:new Date(Date.now()-3600000).toISOString()});
if(r.rows[0].n>0||Number(exams.records[0].get('n'))>0)throw Error('Active classrooms or assessments; defer deployment');}finally{await s.close();await closeDriver();await closePool();}`]);
  const processes = docker(['top', 'budol-gmr-engine-1', '-eo', 'pid,comm']).trim().split('\n').slice(1).map(v => v.trim().split(/\s+/).at(-1));
  if (processes.some(n => !['docker-init', 'gmr-engine', 'wget'].includes(n))) throw Error('An Engine operation is running; defer deployment');
}
if (process.argv.includes('--deploy-disabled')) {
  const candidate = JSON.parse(readFileSync(join(output, 'candidate.json')));
  const verification = JSON.parse(readFileSync(join(output, 'image-verification.json')));
  if (verification.imageId !== candidate.engineImage || verification.manifestSHA256 !== candidate.manifestSHA256) throw Error('Exact image cryptographic verification required');
  if (candidate.manifestSHA256 !== releaseConfig.releaseManifestSHA256 || inspect('budol-gmr-engine-1').Image !== backup.engine.Image
    || inspect('fluentxverse-server').Image !== backup.api.Image) throw Error('Production or artifacts changed after preparation');
  if (candidate.engineImage !== JSON.parse(docker(['image', 'inspect', imageEngine]))[0].Id || candidate.apiImage !== JSON.parse(docker(['image', 'inspect', imageAPI]))[0].Id) throw Error('Candidate image changed');
  noActivity();
  const policyPath = join(engine, 'config/zkverify-projects.json'), policies = JSON.parse(readFileSync(policyPath));
  if (policies[identity.projectId]) throw Error('Dedicated project already configured');
  save(join(state, 'previous-zkverify-policy.json'), policies);
  policies[identity.projectId] = { network: 'zkVerify', proofSystem: 'groth16', domainId: 3, vkHash: releaseConfig.vkHash, publicInputs: 15,
    statementType: 'fluentxverse.tutor-screening.v2', methods: [], bindings: { valid: '1', policyHash: releaseConfig.policyHash,
      schemaHash: releaseConfig.schemaHash, issuerHash: releaseConfig.issuerHash, issuerAx: releaseConfig.issuerAx, issuerAy: releaseConfig.issuerAy,
      chainId: '26514', agentId: '0', adapterAddress: BigInt(releaseConfig.bridge).toString() } };
  save(join(engine, 'config/screening-prover.production.json'), { [identity.projectId]: { enabled: true, config: releaseConfig } });
  save(policyPath, policies);
  save(join(state, 'api-runtime.json'), apiRuntime);
  save(join(state, 'engine-rollback-compose.json'), compose(backup.engine, backup.engine.Config.Image, env(backup.engine)));
  save(join(state, 'api-rollback-compose.json'), compose(backup.api, backup.api.Config.Image, env(backup.api)));
  try {
    install('engine', backup.engine, imageEngine, engineRuntime);
    install('api', backup.api, imageAPI, apiRuntime);
    const health = await (await fetch('http://127.0.0.1:8765/health/detailed')).json();
    if (health.status !== 'ok') throw Error('API health check failed');
    save(join(output, 'deployment.json'), { deployedAt: new Date().toISOString(), state, engineImage: candidate.engineImage,
      apiImage: candidate.apiImage, certificationEnabled: false, releasePolicy: 'self-operated', independentlyAudited: false });
    console.log('PASS production Engine/API installed healthy; certification remains disabled until the live pilot passes.');
  } catch (error) {
    install('api-rollback', backup.api, backup.api.Config.Image, env(backup.api));
    install('engine-rollback', backup.engine, backup.engine.Config.Image, env(backup.engine));
    save(policyPath, JSON.parse(readFileSync(join(state, 'previous-zkverify-policy.json'))));
    throw error;
  }
}
if (process.argv.includes('--enable')) {
  const pilot = JSON.parse(readFileSync(join(output, 'pilot.json')));
  if (!pilot.verifiedOnHorizen || !pilot.negativeTestsPassed || pilot.manifestSHA256 !== releaseConfig.releaseManifestSHA256) throw Error('Exact release live pilot and negative tests required');
  if (inspect('fluentxverse-server').Config.Image !== imageAPI) throw Error('API image changed');
  const currentRuntime = env(inspect('fluentxverse-server'));
  if (Object.entries(apiRuntime).some(([k, v]) => currentRuntime[k] !== v)) throw Error('Production environment changed; review before activation');
  noActivity();
  apiRuntime.SCREENING_ENABLED = 'true';
  install('api-enabled', backup.api, imageAPI, apiRuntime);
  save(join(state, 'api-runtime.json'), apiRuntime);
  const health = await (await fetch('https://api.fluentxverse.com/health/detailed')).json();
  const agent = await (await fetch('https://api.fluentxverse.com/screening/agent.json')).json();
  if (health.status !== 'ok' || agent.active !== true) {
    apiRuntime.SCREENING_ENABLED = 'false'; install('api-disabled', backup.api, imageAPI, apiRuntime);
    save(join(state, 'api-runtime.json'), apiRuntime);
    throw Error('Activation health check failed; certification disabled again');
  }
  save(join(output, 'activation.json'), { enabledAt: new Date().toISOString(), releasePolicy: 'self-operated', independentlyAudited: false,
    manifestSHA256: releaseConfig.releaseManifestSHA256, zkVerifyTx: pilot.zkVerifyTx, receipt: pilot.receipt });
  console.log('PASS production screening certification enabled after the exact-release live proof and rejection tests passed.');
}
