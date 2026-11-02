import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';

const root = process.cwd(), id = 'project-destinations-20261029';
const release = join(root, 'output/release', id), stage = '/opt/fluentxverse/releases/' + id;
const compose = '/opt/fluentxverse/releases/20261023/compose.private.json';
const baselineAPI = 'fluentxverse-cloud/api:arbitrum-receipts-20261029';
const baselineEngine = 'fluentxverse-cloud/gmr-engine:arbitrum-migration-20261029';
const imageAPI = 'fluentxverse-cloud/api:' + id, imageEngine = 'fluentxverse-cloud/gmr-engine:' + id;
const engineFiles = ['api.go', 'proof_destination.go', 'zkverify_policy.go', 'zkverify.go', 'dashboard_tools.go', 'screening_prover.go', 'payout_prover.go', 'dashboard_insights.go', 'portable_destination_test.go'];
const apiFiles = ['src/services/proof.services/projectDestination.ts', 'src/services/admin.services/tutorPayoutAuthorization.service.ts',
  'src/services/screening/prover.ts', 'src/services/screening/chain.ts', 'src/services/screening/service.ts', 'src/routes/screening.route.ts',
  ...['policy', 'chain', 'service', 'tally', 'tallySnapshot'].map(f => 'src/services/anonymousReviews/' + f + '.ts')];
const tests = ['projectDestination.test.ts', 'screening.engine.test.ts', 'reviewTally.test.ts', 'reviewTally.fixture.ts', 'gmrProofReceipt.test.ts', 'receiptDestinations.test.ts', 'baseMigration.test.ts', 'bridgeOnlyPrivacy.test.ts', 'horizenMainnet.test.ts', 'tutorPayoutRecovery.test.ts'];
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 8e6, ...options });
const write = (file, text) => { mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, text); };
const copy = (from, to) => { mkdirSync(join(to, '..'), { recursive: true }); cpSync(from, to); };
const upload = (from, to) => run('scp', [...sshOptions, from, `${cloudTarget}:${to}`]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const guard = () => {
  for (const [container, image] of [['fluentxverse-server', baselineAPI], ['budol-gmr-engine-1', baselineEngine]])
    if (ssh(`docker inspect ${container} --format '{{.Config.Image}}'`).trim() !== image) throw Error('Live baseline changed: ' + container);
};
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.json'], { cwd: join(release, 'frontend'), env: { ...process.env, CI: '1' } });

mkdirSync(release, { recursive: true });
if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'prepared.json'))) throw Error('Release already prepared');
  guard();
  const source = join(release, 'engine-source');
  cpSync(join(root, 'output/release/arbitrum-migration-20261029/engine-source'), source, { recursive: true, filter: p => !['node_modules', '.git'].includes(p.split('/').at(-1)) });
  for (const file of engineFiles) copy(resolve(root, '../budol/gmr-engine/internal/httpapi', file), join(source, 'internal/httpapi', file));
  run('go', ['test', './internal/httpapi', './internal/config'], { cwd: source, stdio: 'inherit' });
  mkdirSync(join(release, 'engine'), { recursive: true });
  run('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', join(release, 'engine/gmr-engine'), './cmd/api'], { cwd: source, env: { ...process.env, CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64' } });
  write(join(release, 'engine/Dockerfile'), `FROM ${baselineEngine}\nCOPY gmr-engine /usr/local/bin/gmr-engine\n`);
  for (const file of [...apiFiles, ...tests.map(f => 'tests/' + f)]) copy(join(root, 'fluentxverse-server', file), join(release, 'api', file));
  write(join(release, 'api/Dockerfile'), `FROM ${baselineAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
  ssh(`mkdir -p ${stage}/api ${stage}/engine`);
  for (const [name, image] of [['api', imageAPI], ['engine', imageEngine]]) {
    run('tar', ['-czf', join(release, name + '.tar.gz'), '-C', join(release, name), '.']);
    upload(join(release, name + '.tar.gz'), `${stage}/${name}.tar.gz`);
    console.log(ssh(`tar -xzf ${stage}/${name}.tar.gz -C ${stage}/${name} && docker build --pull=false --network=none -t ${image} ${stage}/${name}`, { timeout: 180000 }));
  }
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${imageAPI} --no-env-file test ${tests.filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f).join(' ')}`, { timeout: 120000 }));
  write(join(release, 'prepared.json'), JSON.stringify({ id, imageAPI, imageEngine, baselineAPI, baselineEngine, preparedAt: new Date().toISOString() }, null, 2));
} else if (process.argv.includes('--enrollment')) {
  const baseline = imageAPI, image = imageAPI + '-enrollment', directory = join(release, 'enrollment');
  if (ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim() !== baseline) throw Error('Enrollment API baseline changed');
  for (const file of ['src/services/anonymousReviews/repository.ts', 'src/services/anonymousReviews/service.ts', 'tests/projectDestination.test.ts', 'tests/projectDestination.persistence.ts']) copy(join(root, 'fluentxverse-server', file), join(directory, file));
  write(join(directory, 'Dockerfile'), `FROM ${baseline}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
  run('tar', ['-czf', directory + '.tar.gz', '-C', directory, '.']);
  ssh(`mkdir -p ${stage}/enrollment`); upload(directory + '.tar.gz', `${stage}/enrollment.tar.gz`);
  console.log(ssh(`tar -xzf ${stage}/enrollment.tar.gz -C ${stage}/enrollment && docker build --pull=false --network=none -t ${image} ${stage}/enrollment`, { timeout: 120000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ${tests.filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f).join(' ')}`, { timeout: 120000 }));
  const fixture = 'fluentxverse-destination-enrollment-qa';
  try {
    ssh(`docker run -d --rm --network none --name ${fixture} fluentxverse-cloud/memgraph:20261023 --bolt-port=17739`);
    console.log(ssh(`docker run --rm --network container:${fixture} -e PROJECT_DESTINATION_TEST_URI=bolt://127.0.0.1:17739 --entrypoint bun ${image} --no-env-file tests/projectDestination.persistence.ts`, { timeout: 120000 }));
  } finally { ssh('docker stop ' + fixture); }
  const update = `import json,os\np=${JSON.stringify(compose)}\nc=json.load(open(p))\nif c['services']['api']['image']!=${JSON.stringify(baseline)}: raise RuntimeError('API changed')\nc['services']['api']['image']=${JSON.stringify(image)}\nfd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f: json.dump(c,f)\nos.replace(p+'.next',p)`;
  ssh('python3 -c ' + quote(update));
  console.log(ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
  write(join(directory, 'deployment.json'), JSON.stringify({ image, deployedAt: new Date().toISOString(), crossDestinationRaceTests: 10 }, null, 2));
} else if (process.argv.includes('--activate')) {
  if (!existsSync(join(release, 'prepared.json'))) throw Error('Prepare and test first');
  guard();
  const idle = `import{db,closePool}from'./src/db/postgres';try{const r=await db\`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'\`;if(r[0].n)throw Error('Active classrooms; defer restart');console.log('No active classrooms');}finally{await closePool();}`;
  console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(idle)}`));
  const activate = `import json,os,subprocess
stage=${JSON.stringify(stage)};compose=${JSON.stringify(compose)}
c=json.load(open(compose))
e=c['services']['gmr-engine']['environment']
container=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
mount=next(m['Source'] for m in container['Mounts'] if m['Destination']=='/app/config')
paths=[mount+e[k][len('/app/config'):] for k in ['GMR_ENGINE_ZKVERIFY_POLICY_PATH','GMR_ENGINE_SCREENING_PROVER_PATH','GMR_ENGINE_PAYOUT_PROVER_PATH']]
if os.path.exists(stage+'/rollback.private.json'): raise RuntimeError('Backup already exists')
def save(p,data):
 fd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w') as f: json.dump(data,f)
 os.replace(p+'.next',p)
files={p:json.load(open(p)) for p in paths}
save(stage+'/rollback.private.json',{'compose':c,'files':files})
ids=['b89ee4cb-625d-41af-b56e-ac7744fce805','683a093b-10fb-44d9-9ca4-e268f3e0ce5d','ee2dd009-1cee-4ade-ae3c-13535004ee1d','55e96ef6-0cb5-4d64-b369-8c7fec976188','6360e46f-96c6-4935-8344-b5375155ae3c']
for p,data in files.items():
 for app,policy in data.items():
  if app not in ids: continue
  target=policy['config'] if 'config' in policy else policy
  if target.get('network',target.get('verificationNetwork'))!='zkVerify': raise RuntimeError('Only approved mainnet policies can be portable')
  target['receiptDestinationMode']='project'
 save(p,data)
c['services']['gmr-engine']['image']=${JSON.stringify(imageEngine)}
c['services']['api']['image']=${JSON.stringify(imageAPI)}
c['services']['api']['environment']['PROOF_DESTINATION_MODE']='project'
save(compose,c)
print('Approved project-selectable routing; cryptographic pins unchanged.')`;
  console.log(ssh(`docker compose -f ${compose} stop api gmr-engine`, { timeout: 120000 }));
  try {
    console.log(ssh('python3 -c ' + quote(activate)));
    console.log(ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 180 gmr-engine api`, { timeout: 240000 }));
    write(join(release, 'deployment.json'), JSON.stringify({ imageAPI, imageEngine, deployedAt: new Date().toISOString() }, null, 2));
  } catch (error) {
    const rollback = `import json,os\nb=json.load(open(${JSON.stringify(stage + '/rollback.private.json')}))\nfor p,data in {**b['files'],${JSON.stringify(compose)}:b['compose']}.items():\n fd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\n with os.fdopen(fd,'w') as f: json.dump(data,f)\n os.replace(p+'.next',p)`;
    ssh(`docker compose -f ${compose} stop api gmr-engine`);
    ssh('python3 -c ' + quote(rollback));
    ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 180 gmr-engine api`, { timeout: 240000 });
    throw error;
  }
} else if (process.argv.includes('--frontend')) {
  const frontend = join(release, 'frontend'), baseline = join(root, 'output/release/engine-compact-save-20261025/frontend');
  mkdirSync(frontend, { recursive: true });
  for (const dir of ['gmr-dashboard', 'public', 'src']) cpSync(join(baseline, dir), join(frontend, dir), { recursive: true });
  if (!existsSync(join(frontend, 'node_modules'))) symlinkSync(resolve(root, '../budol/node_modules'), join(frontend, 'node_modules'));
  const build = output => run('bun', ['build', './gmr-dashboard/index.html', '--outdir=' + output, '--public-path=/', '--production', '--minify'], { cwd: frontend, stdio: 'inherit' });
  build('baseline-dist');
  const html = await (await fetch('https://engine.fluentxverse.com/')).text();
  for (const file of readdirSync(join(frontend, 'baseline-dist')).filter(f => /\.(js|css)$/.test(f))) {
    if (!html.includes('/' + file)) throw Error('Frontend source baseline changed: ' + file);
    if (hash(Buffer.from(await (await fetch('https://engine.fluentxverse.com/' + file)).arrayBuffer())) !== hash(readFileSync(join(frontend, 'baseline-dist', file)))) throw Error('Live frontend differs: ' + file);
  }
  for (const file of ['App.tsx', 'EngineTools.tsx', 'ProofDestinationPanel.tsx', 'operations.css']) copy(resolve(root, '../budol/gmr-dashboard/src', file), join(frontend, 'gmr-dashboard/src', file));
  build('dist');
  const prior = join(root, 'output/release/engine-favicon-20261025/frontend');
  for (const file of ['_headers', 'public/client-env.js', 'engine-favicon-v1.svg']) copy(join(prior, 'dist', file), join(frontend, 'dist', file));
  let next = readFileSync(join(frontend, 'dist/index.html'), 'utf8').replaceAll('href="./', 'href="/').replaceAll('src="./', 'src="/');
  next = next.replace('</head>', '<script src="/public/client-env.js"></script><link rel="icon" type="image/svg+xml" href="/engine-favicon-v1.svg">\n</head>');
  write(join(frontend, 'dist/index.html'), next);
  for (const file of ['worker.ts', 'wrangler.json']) copy(join(prior, file), join(frontend, file));
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on));
  write(join(frontend, 'prepared.json'), JSON.stringify({ preparedAt: new Date().toISOString(), previousVersions: versions[0].versions, baselineMatched: true }, null, 2));
} else if (process.argv.includes('--publish')) {
  if (!existsSync(join(release, 'frontend/verified.json'))) throw Error('Browser verification required before publishing');
  const prepared = JSON.parse(readFileSync(join(release, 'frontend/prepared.json')));
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on));
  if (JSON.stringify(versions[0].versions) !== JSON.stringify(prepared.previousVersions)) throw Error('Worker baseline changed');
  console.log(wrangler(['deploy']));
} else throw Error('Use --prepare, --activate, --frontend or --publish');
