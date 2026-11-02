import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ssh, sshOptions, cloudTarget, quote } from './lib/cloud-ssh.mjs';

const root = process.cwd();
const release = join(root, 'output/release/arbitrum-migration-20261029');
const stage = '/opt/fluentxverse/releases/arbitrum-migration-20261029';
const compose = '/opt/fluentxverse/releases/20261023/compose.private.json';
const imageAPI = 'fluentxverse-cloud/api:arbitrum-migration-20261029';
const imageEngine = 'fluentxverse-cloud/gmr-engine:arbitrum-migration-20261029';
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 8e6, ...options });
const upload = (from, to) => run('scp', [...sshOptions, from, `${cloudTarget}:${to}`]);
const apiFiles = ['src/services/proof.services/horizenReceipt.ts', 'src/services/admin.services/tutorPayoutAuthorization.service.ts'];
const previousEngine = 'fluentxverse-cloud/gmr-engine:payout-activation-20261025';
mkdirSync(release, { recursive: true });

if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'prepared.json'))) throw Error('Already prepared');
  const previousAPI = ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim();
  if (ssh("docker inspect budol-gmr-engine-1 --format '{{.Config.Image}}'").trim() !== previousEngine) throw Error('Engine baseline changed');
  const engineSource = join(release, 'engine-source');
  cpSync(join(root, 'output/release/payout-activation-20261025/engine-source'), engineSource, { recursive: true, verbatimSymlinks: true, filter: p => !['node_modules', '.git'].includes(p.split('/').at(-1)) });
  cpSync(resolve(root, '../budol/gmr-engine/internal/config/config.go'), join(engineSource, 'internal/config/config.go'));
  cpSync(resolve(root, '../budol/gmr-engine/internal/config/proof_destination_rpc_test.go'), join(engineSource, 'internal/config/proof_destination_rpc_test.go'));
  run('go', ['test', './internal/config', './internal/httpapi'], { cwd: engineSource, stdio: 'inherit' });
  const engine = join(release, 'engine');
  mkdirSync(engine, { recursive: true });
  run('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', join(engine, 'gmr-engine'), './cmd/api'], { cwd: engineSource, env: { ...process.env, CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64' } });
  writeFileSync(join(engine, 'Dockerfile'), `FROM ${previousEngine}\nCOPY gmr-engine /usr/local/bin/gmr-engine\n`);
  const api = join(release, 'api');
  for (const file of apiFiles) {
    mkdirSync(join(api, file, '..'), { recursive: true });
    const baseline = ssh(`docker exec fluentxverse-server cat ${quote('/app/' + file)}`);
    writeFileSync(join(release, file.replaceAll('/', '_') + '.baseline'), baseline);
    cpSync(join(root, 'fluentxverse-server', file), join(api, file));
  }
  mkdirSync(join(api, 'tests'), { recursive: true });
  for (const file of ['receiptDestinations.test.ts', 'baseMigration.test.ts']) cpSync(join(root, 'fluentxverse-server/tests', file), join(api, 'tests', file));
  writeFileSync(join(api, 'Dockerfile'), `FROM ${previousAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
  ssh(`mkdir -p ${stage}/api ${stage}/engine`);
  for (const [name, image] of [['api', imageAPI], ['engine', imageEngine]]) {
    run('tar', ['-czf', join(release, name + '.tar.gz'), '-C', join(release, name), '.']);
    upload(join(release, name + '.tar.gz'), `${stage}/${name}.tar.gz`);
    ssh(`tar -xzf ${stage}/${name}.tar.gz -C ${stage}/${name}`);
    console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/${name}`, { timeout: 180000 }));
  }
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${imageAPI} --no-env-file test tests/receiptDestinations.test.ts tests/baseMigration.test.ts`, { timeout: 60000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${imageEngine} test scripts/payout-private-prover.test.ts scripts/screening-bridge-prover.test.ts scripts/horizen-receipt.test.ts`, { timeout: 120000 }));
  writeFileSync(join(release, 'prepared.json'), JSON.stringify({ previousAPI, previousEngine, imageAPI, imageEngine, preparedAt: new Date().toISOString() }, null, 2));
} else if (process.argv.includes('--activate')) {
  const prepared = JSON.parse(readFileSync(join(release, 'prepared.json')));
  for (const [name, expected] of [['fluentxverse-server', prepared.previousAPI], ['budol-gmr-engine-1', prepared.previousEngine]]) if (ssh(`docker inspect ${name} --format '{{.Config.Image}}'`).trim() !== expected) throw Error('Live image changed: ' + name);
  const active = "import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classrooms; defer migration');console.log(JSON.stringify({activeClassrooms:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(active)}`));
  upload(join(root, 'scripts/arbitrum-migrate-runtime.py'), `${stage}/migrate.py`);
  console.log(ssh(`python3 ${stage}/migrate.py preflight`, { timeout: 60000 }));
  // The application and Engine are fenced while policy files and graph settings change.
  console.log(ssh(`docker compose -f ${compose} stop api gmr-engine`, { timeout: 120000 }));
  try {
    console.log(ssh(`python3 ${stage}/migrate.py apply`, { timeout: 120000 }));
    console.log(ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 180 gmr-engine api`, { timeout: 240000 }));
    console.log(ssh(`python3 ${stage}/migrate.py verify`, { timeout: 120000 }));
  } catch (error) {
    console.log(ssh(`docker compose -f ${compose} stop api gmr-engine`, { timeout: 120000 }));
    console.log(ssh(`python3 ${stage}/migrate.py rollback`, { timeout: 120000 }));
    console.log(ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 180 gmr-engine api`, { timeout: 240000 }));
    throw error;
  }
  writeFileSync(join(release, 'deployment.json'), JSON.stringify({ ...prepared, deployedAt: new Date().toISOString(), chainId: 42161, domainId: 10, historicalProofsPreserved: true, fundsMoved: false }, null, 2));
} else throw Error('Use --prepare or --activate');
