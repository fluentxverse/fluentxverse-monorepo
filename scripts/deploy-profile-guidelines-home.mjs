import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';

const root = process.cwd(), id = 'profile-guidelines-home-20261028';
const release = join(root, 'output/release', id), stage = `/opt/fluentxverse/releases/${id}`;
const previousAPI = 'fluentxverse-cloud/api:intro-video-limit-20261028';
const previousImageId = 'sha256:111a36d2d3991836300f2759723236c7151cfba6cea68efeaa653b45a359c08a';
const image = `fluentxverse-cloud/api:${id}`;
const compose = '/opt/fluentxverse/releases/20261023/compose.private.json';
const apps = [
  { name: 'tutor', directory: 'fluentxverse-tutor-solid-prototype', previous: 'c4dc386d-a531-4ede-b4ea-fb265a78fc8f',
    domains: ['tutor.fluentxverse.com'],
    files: ['tutor/pages/HomePage.tsx', 'tutor/Components/Dashboard/TeachingDesk.css',
      'tutor/pages/MyProfilePage.tsx', 'tutor/Components/Common/ImageCropper.tsx',
      'tutor/Components/Common/ProfileGuidelines.tsx', 'tutor/Components/Common/ProfileGuidelines.css',
      'tutor/Components/Settings/SettingsModal.tsx', 'tutor/api/tutor.api.ts', 'tutor/utils/profilePhoto.ts',
      'tests/browser/profileGuidelines.cjs', 'tests/browser/profileMedia.cjs', 'tests/browser/interviewProgress.cjs', 'tests/browser/teachingDesk.cjs'] },
];
const apiFiles = ['src/routes/tutor.route.ts', 'src/config/constant.ts'];
const apiNewFiles = ['src/utils/profilePhoto.ts'];
const apiTests = ['tests/profileGuidelines.test.ts'];
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 12e6, ...options });
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = (path, content) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to); };
const appPath = app => join(release, app.name, 'frontend', app.directory);
const wrangler = (app, args) => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd: appPath(app), env: { ...process.env, CI: '1' } });
const latest = app => JSON.parse(wrangler(app, ['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
const guardApps = () => { for (const app of apps) { const versions = latest(app); if (versions.length !== 1 || versions[0].version_id !== app.previous || versions[0].percentage !== 100) throw Error(`${app.name} baseline changed`); } };
const guardAPI = () => {
  const actual = ssh("docker inspect fluentxverse-server --format '{{.Config.Image}} {{.Image}}'").trim();
  if (actual !== `${previousAPI} ${previousImageId}`) throw Error('API baseline changed');
};

if (process.argv.includes('--prepare')) {
  if (existsSync(release)) throw Error('Release directory already exists');
  guardAPI();
  for (const app of apps) {
    cpSync(join(root, 'output/release/intro-video-limit-20261028', app.name, 'frontend'), join(release, app.name, 'frontend'), {
      recursive: true, verbatimSymlinks: true, filter: path => !['dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env'),
    });
    for (const path of app.files) {
      const target = join(appPath(app), path);
      if (existsSync(target)) copy(target, join(release, 'baseline', app.directory, path));
      copy(join(root, app.directory, path), target);
    }
  }
  copy(join(root, 'shared/profileGuidelines.ts'), join(release, 'tutor/frontend/shared/profileGuidelines.ts'));
  guardApps();
  for (const path of apiFiles) {
    save(join(release, 'baseline/fluentxverse-server', path), ssh(`docker exec fluentxverse-server cat ${quote('/app/' + path)}`));
    copy(join(root, 'fluentxverse-server', path), join(release, 'api', path));
  }
  for (const path of apiNewFiles) copy(join(root, 'fluentxverse-server', path), join(release, 'api', path));
  for (const path of apiTests) copy(join(root, 'fluentxverse-server', path), join(release, 'api', path));
  copy(join(root, 'shared/profileGuidelines.ts'), join(release, 'api/shared/profileGuidelines.ts'));
  save(join(release, 'api/Dockerfile'), `FROM ${previousAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY --chown=appuser:appgroup shared/ /shared/\n`);
  const files = Object.fromEntries([...apiFiles, ...apiNewFiles, ...apiTests].map(path => ['api/' + path, hash(join(release, 'api', path))]));
  for (const app of apps) for (const path of app.files) files[`${app.name}/frontend/${app.directory}/${path}`] = hash(join(appPath(app), path));
  files['api/shared/profileGuidelines.ts'] = hash(join(release, 'api/shared/profileGuidelines.ts'));
  files['tutor/frontend/shared/profileGuidelines.ts'] = hash(join(release, 'tutor/frontend/shared/profileGuidelines.ts'));
  files['api/Dockerfile'] = hash(join(release, 'api/Dockerfile'));
  save(join(release, 'manifest.json'), JSON.stringify({ id, image, previousAPI, previousImageId, apps, files, preparedAt: new Date().toISOString() }, null, 2));
  console.log('Prepared scoped source snapshots. Review baseline diffs before building.');
} else if (process.argv.includes('--build')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json')));
  for (const [path, expected] of Object.entries(manifest.files)) if (hash(join(release, path)) !== expected) throw Error('Prepared source changed: ' + path);
  guardAPI(); guardApps();
  for (const app of apps) run('bun', ['run', 'build'], { cwd: appPath(app), stdio: 'inherit' });
  run('tar', ['-czf', join(release, 'api.tar.gz'), '-C', join(release, 'api'), '.']);
  ssh(`mkdir -p ${stage}/api`);
  run('scp', [...sshOptions, join(release, 'api.tar.gz'), `${cloudTarget}:${stage}/api.tar.gz`]);
  ssh(`echo ${quote(hash(join(release, 'api.tar.gz')) + '  ' + stage + '/api.tar.gz')} | sha256sum -c -`);
  ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api`);
  console.log(ssh(`docker build --pull=false -t ${image} ${stage}/api`, { timeout: 180000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/interview-api.js`, { timeout: 90000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ./tests/applicationPolicy.test.ts ./tests/introVideo.test.ts ./tests/profileGuidelines.test.ts`, { timeout: 60000 }));
  save(join(release, 'built.json'), JSON.stringify({ imageId: ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim(), apps: Object.fromEntries(apps.map(app => [app.name, hash(join(appPath(app), 'dist/index.html'))])), builtAt: new Date().toISOString() }, null, 2));
} else if (process.argv.includes('--activate')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'))), built = JSON.parse(readFileSync(join(release, 'built.json')));
  if (!JSON.parse(readFileSync(join(release, 'verification.json'))).passed) throw Error('Verify the exact scoped frontends first');
  for (const [path, expected] of Object.entries(manifest.files)) if (hash(join(release, path)) !== expected) throw Error('Prepared source changed');
  if (built.imageId !== ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim()) throw Error('Prepared image changed');
  for (const app of apps) if (built.apps[app.name] !== hash(join(appPath(app), 'dist/index.html'))) throw Error('Built frontend changed');
  guardAPI(); guardApps();
  const activity = String.raw`import{db,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{
    const r=await db.unsafe("SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
    const q=await s.run("MATCH(e:Exam) WHERE e.status IN ['generating','queued','processing'] RETURN count(e) AS n");
    const c=await s.run("MATCH(s:InterviewSlot {status:'booked'}) WHERE s.mediaClosedAt IS NULL AND s.date=$today RETURN count(s) AS n",{today:new Date(Date.now()+8*3600000).toISOString().slice(0,10)});
    if(r[0].n||Number(q.records[0].get('n'))||Number(c.records[0].get('n')))throw Error('Active classrooms, assessments or today\'s unfinished interviews; defer release');
    await s.run('CREATE SNAPSHOT;');console.log(JSON.stringify({activeClassrooms:r[0].n,activeAssessmentJobs:Number(q.records[0].get('n')),unfinishedInterviewsToday:Number(c.records[0].get('n')),graphSnapshotCreated:true}));
    }finally{await s.close();await closeDriver();await closePool();}`.replaceAll('\\`', '`');
  console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(activity)}`));
  const backup = `${stage}/compose.rollback.private.json`;
  const configure = `import json,os,shutil\np=${JSON.stringify(compose)}\nc=json.load(open(p))\nif c['services']['api']['image']!=${JSON.stringify(previousAPI)}: raise RuntimeError('Compose baseline changed')\nshutil.copy2(p,${JSON.stringify(backup)})\nc['services']['api']['image']=${JSON.stringify(image)}\nfd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f: json.dump(c,f)\nos.replace(p+'.next',p)`;
  const deployed = [];
  try {
    ssh(`python3 -c ${quote(configure)}`);
    console.log(ssh(`docker compose -f ${quote(compose)} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
    const health = await fetch('https://api.fluentxverse.com/health', { signal: AbortSignal.timeout(20000) });
    if (!health.ok) throw Error('API health check failed');
    const catalogCheck = `import{initDriver,closeDriver}from'./src/db/memgraph';import{AdminService}from'./src/services/admin.services/admin.service';
      await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);try{
      const service=new AdminService();const all=await service.getApplications();
      for(const [filter,key]of [['interview_passed','interviewPassed'],['interview_failed','interviewFailed'],['pending_profile','pendingProfile'],['certified','certified']]){
        const page=await service.getApplications(filter);if(page.total!==all.counts[key])throw Error('Application count mismatch: '+filter);}
      console.log(JSON.stringify({productionCatalogVerified:true,counts:all.counts}));}finally{await closeDriver();}`;
    console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(catalogCheck)}`, { timeout: 60000 }));
    for (const app of apps) {
      const result = wrangler(app, ['deploy']); console.log(result);
      const version = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
      if (!version) throw Error('Deployment version missing');
      deployed.push({ name: app.name, version });
    }
    for (const path of ['/interview/my-booking', '/interview/result/test', '/proof/tutor-certification/me', '/admin/applications']) {
      const response = await fetch('https://api.fluentxverse.com' + path, { headers: { Origin: 'https://dashboard.fluentxverse.com' }, signal: AbortSignal.timeout(15000) });
      if (![401, 403].includes(response.status)) throw Error('Anonymous interview access was not rejected: ' + path);
    }
    for (const app of apps) {
      const dist = join(appPath(app), 'dist');
      const assets = readdirSync(join(dist, 'assets')).filter(file => /\.(js|css)$/.test(file));
      for (const domain of app.domains) {
        const response = await fetch(`https://${domain}/interview`, { signal: AbortSignal.timeout(20000) });
        const html = await response.text(), expected = readFileSync(join(dist, 'index.html'), 'utf8');
        const refs = value => [...value.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1]).sort();
        if (!response.ok || JSON.stringify(refs(html)) !== JSON.stringify(refs(expected))) throw Error('Published HTML differs: ' + domain);
        for (const file of assets) {
          const remote = await fetch(`https://${domain}/assets/${file}`, { signal: AbortSignal.timeout(20000) });
          if (!remote.ok || createHash('sha256').update(Buffer.from(await remote.arrayBuffer())).digest('hex') !== hash(join(dist, 'assets', file))) throw Error('Live asset mismatch: ' + domain + '/' + file);
        }
      }
    }
    save(join(release, 'deployment.json'), JSON.stringify({ image, imageId: built.imageId, previousAPI, deployed, deployedAt: new Date().toISOString(), rollbackCompose: backup, publicAssetsVerified: true }, null, 2));
    console.log('PASS: Profile guidelines API and tutor home frontend activated and live assets verified.');
  } catch (error) {
    for (const app of apps.slice().reverse()) if (deployed.some(item => item.name === app.name)) wrangler(app, ['rollback', app.previous, '--yes']);
    ssh(`test -f ${quote(backup)} && cp -p ${quote(backup)} ${quote(compose)} && docker compose -f ${quote(compose)} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 });
    save(join(release, 'last-rollback.json'), JSON.stringify({ rolledBackAt: new Date().toISOString(), reason: error.message, cause: error.cause?.message, deployed }, null, 2));
    throw error;
  }
} else throw Error('Use --prepare, --build or --activate');
