import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { root as cloud } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';

const root = process.cwd(), id = 'learning-terminology-20261104';
const release = join(root, 'output/release', id), remote = `/opt/fluentxverse/releases/${id}`;
const previousAPI = 'fluentxverse-cloud/api:attendance-recovery-grid-20261103';
const previousImageId = 'sha256:09b271087cdb8e850494da0afac3e872c27f7f47deebcdb780748eb3f24e15fe';
const image = `fluentxverse-cloud/api:${id}`;
const apps = [
  { role: 'site', app: 'fluentxverse-site', baseline: 'output/release/site-changelog-20261103/site', version: 'ff843e95-8673-4e28-9e07-a81c4cc80d66', config: 'wrangler.toml', port: 5320, domains: ['fluentxverse.com', 'www.fluentxverse.com'] },
  { role: 'student', app: 'fluentxverse-student-solid-prototype', baseline: 'output/release/attendance-recovery-20261103/frontend', version: 'f060ef5f-190a-4483-885a-187a8dbf3b58', config: 'wrangler.jsonc', port: 5321, domains: ['student.fluentxverse.com'] },
  { role: 'tutor', app: 'fluentxverse-tutor-solid-prototype', baseline: 'output/release/dispute-mainnet-20261103/frontends/tutor/frontend', version: 'e82202c7-8c3d-482c-92e8-75ae2ad2736f', config: 'wrangler.jsonc', port: 5322, domains: ['tutor.fluentxverse.com'] },
  { role: 'dashboard', app: 'fluentxverse-dashboard', baseline: 'output/release/dispute-mainnet-20261103/frontends/admin/frontend', version: '30f30365-e66a-4036-be18-7f21edd5c49f', config: 'wrangler.jsonc', port: 5323, domains: ['dashboard.fluentxverse.com'] },
];
const apiFiles = ['src/routes/tutor.route.ts', 'src/services/admin.services/admin.service.ts'];
const front = app => join(release, app.role, 'frontend');
const cwd = app => join(front(app), app.app);
const env = app => ({ ...process.env, CI: '1', ...(app.role === 'student' ? studentPublicBuildEnv(root) : {}) });
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 10e6, ...options });
const wrangler = (app, args) => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', app.config], { cwd: cwd(app), env: env(app) });
const sha = value => createHash('sha256').update(value).digest('hex');
const fileHash = file => sha(readFileSync(file));
const save = (file, value) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); };
const read = file => JSON.parse(readFileSync(join(release, file), 'utf8'));
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true, verbatimSymlinks: true }); };
const filter = file => !['node_modules', 'dist', '.wrangler', '.git', 'output', 'cache'].includes(file.split('/').at(-1)) && !file.split('/').at(-1).startsWith('.env');
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(directory, entry.name)] : []);
}
function oldTerms(file) {
  const values = [];
  const visit = node => {
    if ((ts.isStringLiteralLike(node) || ts.isJsxText(node)) && /\b(?:education|educational)\b/i.test(node.text)) values.push(node.text.trim());
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true));
  return values;
}
function auditCopy(app) {
  const directory = app.role === 'site' || app.role === 'dashboard' ? 'src' : app.role;
  for (const file of sourceFiles(join(cwd(app), directory))) {
    const current = join(root, app.app, file.slice(cwd(app).length + 1));
    if (!existsSync(current)) continue;
    const intentional = new Set(oldTerms(current));
    for (const value of oldTerms(file)) if (!intentional.has(value)) throw Error(`Old copy remains in ${app.role}/${file.slice(cwd(app).length + 1)}: ${value.slice(0, 120)}`);
  }
}
function replace(source, before, after, file) {
  if (source.split(before).length !== 2) throw Error(`Ambiguous or missing terminology anchor in ${file}: ${before.slice(0, 120)}`);
  return source.replace(before, after);
}
function guardAPI() {
  if (cloud("docker inspect fluentxverse-server --format '{{.Config.Image}} {{.Image}}'").trim() !== `${previousAPI} ${previousImageId}`) throw Error('Production API baseline changed');
}
function guard(app) {
  const deployments = JSON.parse(wrangler(app, ['deployments', 'list', '--json']));
  const versions = deployments.sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== app.version || versions[0].percentage !== 100) throw Error('Production baseline changed: ' + app.role);
}
function terminologyHunks(file) {
  const diff = run('git', ['diff', '--unified=0', '--', file]);
  return diff.split(/^@@.*@@.*\n/m).slice(1).map(block => {
    const lines = block.split('\n');
    return { before: lines.filter(line => line.startsWith('-')).map(line => line.slice(1)).join('\n'), after: lines.filter(line => line.startsWith('+')).map(line => line.slice(1)).join('\n') };
  }).filter(hunk => /\b(?:Education|Educational|educational)\b|[ >]education[ .,;:<]|Edit education/.test(hunk.before) || hunk.after.includes('learningCategoryLabel'));
}
function verifyPrepared() {
  const manifest = read('manifest.json');
  for (const [file, hash] of Object.entries(manifest.files)) if (fileHash(join(release, file)) !== hash) throw Error('Prepared file changed: ' + file);
  return manifest;
}
async function publicHash(domain, file) {
  const response = await fetch(`https://${domain}/${file}`, { signal: AbortSignal.timeout(25000), cache: 'no-store' });
  if (!response.ok) throw Error(`Published file unavailable: ${domain}/${file}: ${response.status}`);
  return sha(Buffer.from(await response.arrayBuffer()));
}
async function authContract() {
  const result = {};
  for (const path of ['/tutor/profile', '/admin/applications']) {
    const response = await fetch('https://api.fluentxverse.com' + path, { signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (path === '/tutor/profile') {
      if (response.status !== 200 || body.success !== false || body.error !== 'Not authenticated' || 'data' in body || 'user' in body) throw Error('Tutor endpoint did not deny anonymous access');
    } else if (![401, 403].includes(response.status) || body.success === true || 'data' in body || 'user' in body) throw Error('Admin endpoint did not deny anonymous access');
    result[path] = { status: response.status, body };
  }
  return result;
}
async function testFrontends(siteBase, bases) {
  console.log(run('node', ['fluentxverse-site/tests/browser/technology.cjs'], { env: { ...process.env, SITE_URL: siteBase, SITE_WIDTHS: '1440,390,320', SITE_SCREENSHOTS: join(release, 'screenshots') } }));
  console.log(run('node', ['scripts/tests/learning-terminology.cjs'], { env: { ...process.env, STUDENT_TEST_URL: bases.student, TUTOR_TEST_URL: bases.tutor, DASHBOARD_TEST_URL: bases.dashboard } }));
  console.log(run('node', ['tests/browser/profileEducation.cjs'], { cwd: join(root, 'fluentxverse-tutor-solid-prototype'), env: { ...process.env, TUTOR_TEST_URL: bases.tutor } }));
}

if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'deployment-progress.json')) || (existsSync(join(release, 'manifest.json')) && !process.argv.includes('--refresh'))) throw Error('Release already prepared; do not overwrite');
  guardAPI();
  const changed = run('git', ['diff', '--name-only']).trim().split('\n');
  const files = {}, changes = [];
  for (const app of apps) {
    if (existsSync(front(app))) rmSync(front(app), { recursive: true });
    mkdirSync(front(app), { recursive: true });
    if (app.role === 'site') cpSync(join(root, app.baseline), cwd(app), { recursive: true, verbatimSymlinks: true, filter });
    else cpSync(join(root, app.baseline), front(app), { recursive: true, verbatimSymlinks: true, filter });
    if (app.role === 'site') copy(join(root, app.app, app.config), join(cwd(app), app.config));
    if (!existsSync(join(cwd(app), 'node_modules'))) symlinkSync(realpathSync(join(root, app.app, 'node_modules')), join(cwd(app), 'node_modules'), 'dir');
    guard(app);
    const siteFiles = changed.filter(file => file.startsWith(app.app + '/') && (file.includes('/src/') || file === app.app + '/index.html' || file === app.app + '/public/_redirects') && !file.endsWith('/changelogEntries.json'));
    if (app.role === 'site') {
      for (const file of siteFiles) {
        const target = join(cwd(app), file.slice(app.app.length + 1));
        changes.push({ role: app.role, file, baseline: fileHash(target), updated: fileHash(join(root, file)) });
        copy(join(root, file), target);
      }
      // Keep every published historical changelog entry byte-for-byte intact.
      if (fileHash(join(cwd(app), 'src/data/changelogEntries.json')) !== fileHash(join(root, app.app, 'src/data/changelogEntries.json'))) throw Error('Changelog differs from live release; review before publishing');
    } else {
      for (const file of changed.filter(file => file.startsWith(app.app + '/') && /\.(tsx|ts)$/.test(file) && !file.includes('/tests/'))) {
        const hunks = terminologyHunks(file);
        if (!hunks.length) continue;
        const target = join(cwd(app), file.slice(app.app.length + 1));
        let source = readFileSync(target, 'utf8');
        const original = source;
        for (const hunk of hunks) source = hunk.before ? replace(source, hunk.before, hunk.after, file) : hunk.after + '\n' + source;
        save(target, source);
        changes.push({ role: app.role, file, baseline: sha(original), updated: sha(source), hunks });
      }
      copy(join(root, 'shared/learningTerminology.ts'), join(front(app), 'shared/learningTerminology.ts'));
    }
    auditCopy(app);
    console.log(run('bun', ['run', 'build'], { cwd: cwd(app), env: env(app) }));
    for (const change of changes.filter(change => change.role === app.role)) {
      const file = join(app.role, 'frontend', change.file);
      files[file] = fileHash(join(release, file));
    }
    if (app.role !== 'site') files[join(app.role, 'frontend/shared/learningTerminology.ts')] = fileHash(join(front(app), 'shared/learningTerminology.ts'));
  }
  for (const file of apiFiles) {
    let source = cloud(`docker exec fluentxverse-server cat ${quote('/app/' + file)}`);
    const original = source;
    if (file.endsWith('tutor.route.ts')) source = replace(source, "missingFields.push('Education')", "missingFields.push('Qualifications')", file);
    else for (const key of ['education', 'schoolAttended', 'major']) source = replace(source, `'${key}': 'Education'`, `'${key}': 'Qualifications'`, file);
    save(join(release, 'api', file), source);
    save(join(release, 'baseline-api', file), original);
    files[join('api', file)] = sha(source);
    changes.push({ role: 'api', file, baseline: sha(original), updated: sha(source) });
  }
  save(join(release, 'api/Dockerfile'), `FROM ${previousAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\n`);
  files['api/Dockerfile'] = fileHash(join(release, 'api/Dockerfile'));
  save(join(release, 'manifest.json'), { id, previousAPI, previousImageId, image, apps, files, changes, html: Object.fromEntries(apps.map(app => [app.role, fileHash(join(cwd(app), 'dist/index.html'))])), at: new Date().toISOString() });
  console.log('PASS: isolated terminology snapshots built; unrelated local edits excluded.');
} else if (process.argv.includes('--verify')) {
  verifyPrepared();
  for (const app of apps) auditCopy(app);
  const children = apps.map(app => spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(app.port), '--strictPort'], { cwd: cwd(app), env: env(app), detached: true, stdio: 'ignore' }));
  try {
    for (const app of apps) {
      let ready = false;
      for (let attempt = 0; attempt < 80; attempt++) { try { if ((await fetch(`http://127.0.0.1:${app.port}`)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
      if (!ready) throw Error('Preview unavailable: ' + app.role);
    }
    await testFrontends('http://127.0.0.1:5320', Object.fromEntries(apps.map(app => [app.role, `http://127.0.0.1:${app.port}`])));
    cloud(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`, { input: execFileSync('tar', ['-czf', '-', '-C', join(release, 'api'), '.']) });
    console.log(cloud(`docker build --network none -t ${image} ${remote}/api`, { timeout: 180000 }));
    console.log(cloud(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/learning-terminology.js`, { timeout: 120000 }));
    save(join(release, 'verification.json'), { passed: true, html: read('manifest.json').html, imageId: cloud(`docker image inspect ${image} --format '{{.Id}}'`).trim(), at: new Date().toISOString() });
  } finally { for (const child of children) try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--deploy')) {
  const manifest = verifyPrepared(), verified = read('verification.json');
  if (!verified.passed) throw Error('Verify the release first');
  for (const app of apps) { if (fileHash(join(cwd(app), 'dist/index.html')) !== verified.html[app.role]) throw Error('Verified build changed'); guard(app); }
  guardAPI();
  const baselineAuth = await authContract();
  save(join(release, 'auth-contract-baseline.json'), baselineAuth);
  if (cloud(`docker image inspect ${image} --format '{{.Id}}'`).trim() !== verified.imageId) throw Error('Verified API image changed');
  const activity = `import{db,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{const r=await db.unsafe("SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");const q=await s.run("MATCH(e:Exam) WHERE e.status IN ['generating','queued','processing'] RETURN count(e) AS n");if(r[0].n||Number(q.records[0].get('n')))throw Error('Active classroom or assessment; defer API restart');console.log(JSON.stringify({activeClassrooms:r[0].n,activeAssessmentJobs:Number(q.records[0].get('n'))}));}finally{await s.close();await closeDriver();await closePool();}`;
  console.log(cloud(`docker exec fluentxverse-server bun --no-env-file -e ${quote(activity)}`));
  const interviews = `import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{const r=await s.run("MATCH(s:InterviewSlot {status:'booked'}) WHERE s.mediaClosedAt IS NULL AND s.date=$today RETURN count(s) AS n",{today:new Date(Date.now()+8*3600000).toISOString().slice(0,10)});const n=Number(r.records[0].get('n'));if(n)throw Error('Unfinished interviews today; defer API restart');console.log(JSON.stringify({unfinishedInterviewsToday:n}));}finally{await s.close();await closeDriver();}`;
  console.log(cloud(`docker exec fluentxverse-server bun --no-env-file -e ${quote(interviews)}`));
  const configure = `import json,subprocess\nfrom pathlib import Path\nc=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nif c['Config']['Image']!=${JSON.stringify(previousAPI)}:raise RuntimeError('API baseline changed')\nfiles=c['Config']['Labels']['com.docker.compose.project.config_files'].split(',');project=c['Config']['Labels']['com.docker.compose.project']\nargs=['docker','compose','-p',project]+[s for f in files for s in ['-f',f]]\nPath('${remote}/rollback-command.json').write_text(json.dumps(args))\np=Path('${remote}/override.json');p.write_text(json.dumps({'services':{'api':{'image':${JSON.stringify(image)}}}}))\ntry:subprocess.run(args+['-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\nexcept Exception:\n subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True);raise\nprint(json.dumps({'apiUpdated':True,'productionSettingsPreserved':True}))`;
  const deployed = [];
  let apiActivated = false;
  try {
    console.log(cloud('python3 -c ' + quote(configure), { timeout: 180000 }));
    apiActivated = true;
    const health = await fetch('https://api.fluentxverse.com/health', { signal: AbortSignal.timeout(20000) });
    if (!health.ok) throw Error('API health check failed');
    for (const app of apps) {
      guard(app);
      const output = wrangler(app, ['deploy']); console.log(output);
      const version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
      if (!version) throw Error('Deployment version missing: ' + app.role);
      deployed.push({ role: app.role, previous: app.version, version });
      save(join(release, 'deployment-progress.json'), { apiActivated, deployed });
      const assets = ['index.html', ...readdirSync(join(cwd(app), 'dist/assets')).filter(file => /\.(?:js|css)$/.test(file)).map(file => 'assets/' + file)];
      if (app.role === 'site') assets.push('changelog.json');
      for (const domain of app.domains) for (const file of assets) if (await publicHash(domain, file) !== fileHash(join(cwd(app), 'dist', file))) throw Error(`Published asset differs: ${domain}/${file}`);
    }
    const redirect = await fetch('https://fluentxverse.com/onchain-education?source=legacy', { redirect: 'manual' });
    if (redirect.status !== 301 || !redirect.headers.get('location')?.includes('/onchain-learning')) throw Error('Legacy route redirect missing');
    await testFrontends('https://fluentxverse.com', Object.fromEntries(apps.map(app => [app.role, 'https://' + app.domains[0]])));
    if (JSON.stringify(await authContract()) !== JSON.stringify(baselineAuth)) throw Error('Anonymous access contract changed');
    save(join(release, 'deployment.json'), { deployed, image, imageId: verified.imageId, previousAPI, assetsVerified: true, browserChecksPassed: true, checkedDomains: apps.flatMap(app => app.domains), legacyXYZAliases: 'Existing Worker routes preserved; legacy aliases are not active verification targets (student alias has no DNS record).', at: new Date().toISOString() });
  } catch (error) {
    for (const entry of deployed.toReversed()) console.log(wrangler(apps.find(app => app.role === entry.role), ['rollback', entry.previous, '--yes']));
    if (apiActivated) {
      const rollback = `import json,subprocess\nfrom pathlib import Path\na=json.loads(Path('${remote}/rollback-command.json').read_text())\nsubprocess.run(a+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)`;
      console.log(cloud('python3 -c ' + quote(rollback), { timeout: 180000 }));
    }
    save(join(release, 'rollback.json'), { reason: error.message, deployed, at: new Date().toISOString() });
    throw error;
  }
} else throw Error('Use --prepare, --verify, or --deploy');
