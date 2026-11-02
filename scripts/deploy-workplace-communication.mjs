import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';

const id = 'workplace-communication-20261027';
const release = join(process.cwd(), 'output/release', id);
const app = join(release, 'frontend/fluentxverse-dashboard');
const stage = `/opt/fluentxverse/releases/${id}`;
const compose = '/opt/fluentxverse/releases/20261023/compose.private.json';
const previousAPI = 'fluentxverse-cloud/api:read-aloud-screening-20261026';
const previousDashboard = '2405d1eb-4d8c-4651-bc89-a14fc50e115a';
const image = `fluentxverse-cloud/api:${id}`;
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 8e6, ...options });
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd: app, env: { ...process.env, CI: '1' } });
const checkDashboard = () => {
  const latest = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
  if (latest.versions.length !== 1 || latest.versions[0].version_id !== previousDashboard || latest.versions[0].percentage !== 100) throw Error('Dashboard baseline changed');
};
const checkAPI = () => {
  if (ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim() !== previousAPI) throw Error('API baseline changed');
};
const apiFiles = ['src/routes/lessonMaterial.route.ts', 'src/services/lessonMaterial.service.ts', 'tests/workplaceCommunication.test.ts'];
const dashboardFiles = ['src/App.tsx', 'src/api/lessonMaterial.api.ts', 'src/pages/LessonMaterialMakerPage.tsx', 'src/pages/WorkplaceCommunicationPage.tsx', 'src/pages/WorkplaceCommunicationPage.css'];

if (process.argv.includes('--prepare')) {
  checkAPI(); checkDashboard();
  for (const path of apiFiles) copy(join('fluentxverse-server', path), join(release, 'api', path));
  copy('shared/workplaceCommunication.ts', join(release, 'api/shared/workplaceCommunication.ts'));
  writeFileSync(join(release, 'api/Dockerfile'), `FROM ${previousAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY --chown=appuser:appgroup shared/ /shared/\n`);
  for (const path of dashboardFiles) copy(join('fluentxverse-dashboard', path), join(app, path));
  copy('shared/workplaceCommunication.ts', join(release, 'frontend/shared/workplaceCommunication.ts'));
  run('bun', ['run', 'build'], { cwd: app, env: { ...process.env, VITE_API_URL: 'https://api.fluentxverse.com', VITE_SOCKET_URL: 'wss://api.fluentxverse.com' }, stdio: 'inherit' });
  run('tar', ['-czf', join(release, 'api.tar.gz'), '-C', join(release, 'api'), '.']);
  ssh(`mkdir -p ${stage}/api`);
  run('scp', [...sshOptions, join(release, 'api.tar.gz'), `${cloudTarget}:${stage}/api.tar.gz`]);
  ssh(`echo ${quote(hash(join(release, 'api.tar.gz')) + '  ' + stage + '/api.tar.gz')} | sha256sum -c -`);
  ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api`);
  console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/api`, { timeout: 180000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ./tests/workplaceCommunication.test.ts`, { timeout: 60000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/workplace-api.js`, { timeout: 60000 }));
  writeFileSync(join(release, 'manifest.json'), JSON.stringify({ image, previousAPI, previousDashboard, imageId: ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim(), htmlHash: hash(join(app, 'dist/index.html')), preparedAt: new Date().toISOString() }, null, 2));
} else if (process.argv.includes('--activate')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json')));
  if (manifest.htmlHash !== hash(join(app, 'dist/index.html')) || manifest.imageId !== ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim()) throw Error('Prepared artifacts changed');
  checkAPI(); checkDashboard();
  const active = "import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classrooms; defer release');console.log(JSON.stringify({activeClassrooms:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(active)}`));
  const backup = `${stage}/compose.rollback.private.json`;
  const configure = `import json,os,shutil\np=${JSON.stringify(compose)}\nb=${JSON.stringify(backup)}\nc=json.load(open(p))\nif c['services']['api']['image']!=${JSON.stringify(previousAPI)}: raise RuntimeError('Compose baseline changed')\nshutil.copy2(p,b)\nc['services']['api']['image']=${JSON.stringify(image)}\nfd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f: json.dump(c,f)\nos.replace(p+'.next',p)`;
  let deployedDashboard = false;
  try {
    ssh(`python3 -c ${quote(configure)}`);
    console.log(ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
    const health = run('curl', ['-fsS', '-A', 'Mozilla/5.0', 'https://api.fluentxverse.com/health']);
    if (!JSON.parse(health)) throw Error('API health check failed');
    const result = wrangler(['deploy']);
    deployedDashboard = true;
    console.log(result);
    const version = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if (!version) throw Error('Missing deployed dashboard version');
    for (const domain of ['dashboard.fluentxverse.com', 'dashboard.fluentxverse.xyz']) {
      const html = run('curl', ['-fsS', '-A', 'Mozilla/5.0', `https://${domain}/workplace-communication`]);
      // Cloudflare may inject security markup on custom domains. Verify app assets.
      const assets = value => [...value.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]).sort();
      if (!html.includes('<div id="app"></div>') || JSON.stringify(assets(html)) !== JSON.stringify(assets(readFileSync(join(app, 'dist/index.html'), 'utf8')))) throw Error('Published application assets differ: ' + domain);
    }
    writeFileSync(join(release, 'deployment.json'), JSON.stringify({ ...manifest, version, deployedAt: new Date().toISOString(), rollbackCompose: backup }, null, 2));
    console.log('Workplace Communication API and dashboard deployed.');
  } catch (error) {
    console.error('Restoring the previous release after a failed deployment check.');
    ssh(`test -f ${backup} && cp -p ${backup} ${compose} && docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 });
    if (deployedDashboard) wrangler(['rollback', previousDashboard, '--yes']);
    throw error;
  }
} else throw Error('Use --prepare or --activate');
