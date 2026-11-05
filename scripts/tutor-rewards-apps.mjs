import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';

const release = resolve('output/release/tutor-rewards-20261104');
const remote = '/opt/fluentxverse/releases/tutor-rewards-20261104';
const revision = process.argv.includes('--repair-r6') ? '-r6' : process.argv.includes('--repair-r5') ? '-r5' : process.argv.includes('--repair-r4') ? '-r4' : process.argv.includes('--repair-r3') ? '-r3' : process.argv.includes('--repair-r2') ? '-r2' : '';
const apiBaseline = revision === '-r6' ? 'fluentxverse-cloud/api:tutor-rewards-20261104-r5' : revision === '-r5' ? 'fluentxverse-cloud/api:tutor-rewards-20261104-r4'
  : revision === '-r4' ? 'fluentxverse-cloud/api:tutor-rewards-20261104-r3'
  : revision === '-r3' ? 'fluentxverse-cloud/api:tutor-rewards-20261104-r2'
  : revision === '-r2' ? 'fluentxverse-cloud/api:tutor-rewards-20261104' : 'fluentxverse-cloud/api:lesson-registry-mainnet-20261104';
const apiImage = 'fluentxverse-cloud/api:tutor-rewards-20261104' + revision;
const previousDashboard = '6c836124-a1aa-4f92-9be9-7a136366d76c';
const app = join(release, 'frontend/fluentxverse-dashboard');
const hash = value => createHash('sha256').update(value).digest('hex');
const edit = (s, before, after) => { if (s.split(before).length !== 2) throw Error('Ambiguous release anchor: ' + before); return s.replace(before, after); };
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 5e6, timeout: 240000, ...options });
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd: app });
const dashboardGuard = () => {
  const latest = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  if (latest.versions.length !== 1 || latest.versions[0].version_id !== previousDashboard) throw Error('Dashboard baseline changed');
};
const record = (name, data) => writeFileSync(join(release, name), JSON.stringify(data, null, 2));
const mode = process.argv[2];
if (mode === '--prepare-api') {
  mkdirSync(join(release, 'live-api'), { recursive: true });
  const actual = root("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim();
  if (actual !== apiBaseline) throw Error('Live API baseline changed');
  const archive = root('docker exec fluentxverse-server tar -czf - -C /app src/index.ts', { encoding: null });
  execFileSync('tar', ['-xzf', '-', '-C', join(release, 'live-api')], { input: archive });
  const api = join(release, 'api');
  mkdirSync(join(api, 'src'), { recursive: true }); mkdirSync(join(api, 'shared'), { recursive: true });
  const files = ['src/routes/tutorRewards.route.ts', 'src/services/tutorRewards/gateway.ts', 'src/services/tutorRewards/policy.ts', 'src/services/tutorRewards/service.ts',
    'src/services/tutorRewards/alchemy.ts', 'src/services/tutorRewards/aero.ts', 'src/services/tutorRewards/pricePublisher.ts',
    'src/services/tutorRewards/claims.ts', 'src/routes/tutorRewardClaims.route.ts',
    'tests/tutorRewards.test.ts', 'tests/tutorRewards.aero.test.ts', 'tests/tutorRewards.http.ts', 'tests/tutorRewards.claims.http.ts'];
  for (const file of files) { mkdirSync(dirname(join(api, file)), { recursive: true }); cpSync('fluentxverse-server/' + file, join(api, file)); }
  let index = readFileSync(join(release, 'live-api/src/index.ts'), 'utf8');
  if (!index.includes("import { tutorRewardsRoute }")) {
    index = "import { tutorRewardsRoute } from './routes/tutorRewards.route';\nimport { startTutorRewardsMonitor } from './services/tutorRewards/service';\n" + index;
    index = edit(index, '.use(adminOperationsRoute)', '.use(adminOperationsRoute)\n  .use(tutorRewardsRoute)');
    index = edit(index, 'await dbInitPromise;', 'await dbInitPromise;\n  startTutorRewardsMonitor();');
  }
  if (!index.includes("import { tutorRewardClaimsRoute }")) {
    index = "import { tutorRewardClaimsRoute } from './routes/tutorRewardClaims.route';\n" + index;
    index = edit(index, '.use(tutorRewardsRoute)', '.use(tutorRewardsRoute)\n  .use(tutorRewardClaimsRoute)');
  }
  writeFileSync(join(api, 'src/index.ts'), index);
  for (const file of ['tutorRewards.ts', 'tutorRewardsDeployment.json', 'tutorRewardsArtifact.json', 'tutorRewardsAero.json', 'tutorRewardsAeroArtifact.json', 'tutorRewardClaim.ts']) cpSync('shared/' + file, join(api, 'shared', file));
  writeFileSync(join(api, 'Dockerfile'), `FROM ${apiBaseline}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup shared/ /shared/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
  root(`install -d ${remote}/api && tar -xzf - -C ${remote}/api`, { input: execFileSync('tar', ['-czf', '-', '-C', api, '.']) });
  console.log(root(`docker build --network none -t ${apiImage} ${remote}/api`));
  console.log(root(`docker run --rm --network none --entrypoint bun ${apiImage} --no-env-file build src/index.ts --target=bun --outfile=/tmp/rewards-api-build.js`));
  for (const file of ['tests/tutorRewards.test.ts', 'tests/tutorRewards.aero.test.ts', './tests/tutorRewards.http.ts', './tests/tutorRewards.claims.http.ts']) console.log(root(`docker run --rm --network none --entrypoint bun ${apiImage} --no-env-file test ${file}`));
  record('api-prepared.json', { baseline: apiBaseline, image: apiImage, sourceFiles: files, scope: 'Add rewards route and monitor only; preserve every existing API module' });
} else if (mode === '--prepare-dashboard') {
  if (!existsSync(join(release, 'frontend'))) cpSync('output/release/learning-terminology-20261104/dashboard/frontend', join(release, 'frontend'), {
    recursive: true, verbatimSymlinks: true, filter: p => !['node_modules', 'dist', '.wrangler', '.git'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
  if (!existsSync(join(app, 'node_modules'))) symlinkSync(resolve('fluentxverse-dashboard/node_modules'), join(app, 'node_modules'), 'dir');
  for (const file of ['src/components/TutorRewardsPanel.tsx', 'src/components/TutorRewardsPanel.css', 'src/pages/LessonOperationsPage.tsx']) cpSync('fluentxverse-dashboard/' + file, join(app, file));
  cpSync('shared/tutorRewards.ts', join(release, 'frontend/shared/tutorRewards.ts'));
  dashboardGuard();
  console.log(run('bun', ['run', 'build'], { cwd: app }));
  record('dashboard-prepared.json', { previous: previousDashboard, htmlSHA256: hash(readFileSync(join(app, 'dist/index.html'))), scope: 'Payments reward panel and shared types only' });
} else if (mode === '--deploy-api') {
  const py = `import json,subprocess,os
from pathlib import Path
r=Path('${remote}/private');c=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
if c['Config']['Image']!='${apiBaseline}' or c['State']['Health']['Status']!='healthy':raise RuntimeError('API baseline changed')
def private(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(value,f);f.flush();os.fsync(f.fileno())
backup=r/'api-rollback${revision}.private.json'
if backup.exists():raise RuntimeError('API activation already started; inspect before retrying')
private(backup,c)
connection=json.loads((r/'connection.private.json').read_text());env=dict(x.split('=',1) for x in c['Config']['Env'])
base=env.get('TUTOR_IDENTITY_ENGINE_API_BASE')
if not base:raise RuntimeError('Existing private Engine network address missing')
override=r/'api${revision}.override.json';private(override,{'services':{'api':{'image':'${apiImage}','environment':{'TUTOR_REWARDS_ENABLED':'true','TUTOR_REWARDS_ENGINE_API_BASE':base,'TUTOR_REWARDS_ENGINE_API_KEY':connection['key'],'TUTOR_REWARDS_CLAIMS_APPROVED':'false','TUTOR_REWARDS_APPROVED_ADAPTERS':env.get('TUTOR_REWARDS_APPROVED_ADAPTERS','') if '${revision}'=='-r6' else ''}}}})
labels=c['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',')
if not all(Path(f).is_file() for f in files):raise RuntimeError('Missing API compose baseline')
args=['docker','compose','-p',labels['com.docker.compose.project']]+[v for f in files for v in ['-f',f]]
subprocess.run(args+['-f',str(override),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)
print(json.dumps({'image':'${apiImage}','claimsApproved':False,'approvedAdaptersPreserved':'${revision}'=='-r6','health':'healthy'}))`;
  const result = root('python3 -c ' + quote(py), { timeout: 300000 }); console.log(result); record('api-deployment.json', { at: new Date().toISOString(), result });
} else if (mode === '--deploy-dashboard') {
  dashboardGuard();
  const prepared = JSON.parse(readFileSync(join(release, 'dashboard-prepared.json')));
  if (hash(readFileSync(join(app, 'dist/index.html'))) !== prepared.htmlSHA256) throw Error('Dashboard build changed');
  let version;
  try {
    const output = wrangler(['deploy']); console.log(output); version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if (!version) throw Error('Missing published dashboard version');
    for (const file of readdirSync(join(app, 'dist/assets')).filter(f => /\.(js|css)$/.test(f))) {
      let matched = false;
      const expected = hash(readFileSync(join(app, 'dist/assets', file)));
      for (let attempt = 0; attempt < 10; attempt++) {
        const r = await fetch('https://dashboard.fluentxverse.com/assets/' + file, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
        if (r.ok && hash(Buffer.from(await r.arrayBuffer())) === expected) { matched = true; break; }
        if (attempt === 0) console.log('Waiting for dashboard asset propagation: ' + file);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (!matched) throw Error('Published dashboard asset mismatch after propagation retries: ' + file);
    }
    record('dashboard-deployment.json', { at: new Date().toISOString(), previous: previousDashboard, version, assetsVerified: true });
  } catch (error) { if (version) console.log(wrangler(['rollback', previousDashboard, '--yes'])); throw error; }
} else throw Error('Use --prepare-api, --prepare-dashboard, --deploy-api or --deploy-dashboard');
