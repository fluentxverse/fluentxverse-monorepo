import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';

const root = process.cwd(), release = join(root, 'output/release/dispatch-standard-20261105');
const apps = [
  { role: 'student', name: 'fluentxverse-student-solid-prototype', baseline: 'output/release/dispatch-brand-sources-20261105/student/frontend', previous: '710398ec-40f8-4948-a785-f36ffc6179fd', port: 5362,
    files: ['student/pages/DailyDispatchArticlePage.tsx', 'student/pages/DailyDispatchPage.tsx', 'public/_headers'] },
  { role: 'tutor', name: 'fluentxverse-tutor-solid-prototype', baseline: 'output/release/dispatch-brand-sources-20261105/tutor/frontend', previous: '49517808-5d7a-4d9e-a5c7-c1d87399a048', port: 5363,
    files: ['tutor/pages/DailyDispatchArticlePage.tsx', 'tutor/pages/DailyDispatchArchivePage.tsx'] },
  { role: 'dashboard', name: 'fluentxverse-dashboard', baseline: 'output/release/dispatch-brand-sources-20261105/dashboard/frontend', previous: 'cc8ab848-85ab-426d-8315-99b70e0cbe57', port: 5364,
    files: ['src/pages/DailyDispatchPreviewPage.tsx', 'src/pages/DailyDispatchStudentPage.tsx', 'src/components/DispatchArticleMaterial.tsx', 'src/pages/DailyDispatchEditorPage.tsx', 'src/pages/DailyDispatchPreviewPage.css', 'public/_headers'] },
];
const shared = ['shared/appArtwork.ts', 'shared/dispatchSources.ts', 'shared/ui/dispatch-sources.css', 'shared/ui/daily-dispatch-article.css', 'shared/ui/dispatchArticle.ts'];
const logo = 'public/assets/img/home-icons/dispatch-v2.png';
const front = app => join(release, app.role, 'frontend');
const cwd = app => join(front(app), app.name);
const env = app => ({ ...process.env, CI: '1', ...(app.role === 'student' ? studentPublicBuildEnv(root) : {}) });
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 10e6, ...options });
const wrangler = (app, args) => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd: cwd(app), env: env(app) });
const sha = data => createHash('sha256').update(data).digest('hex');
const hash = file => sha(readFileSync(file));
const record = (file, data) => writeFileSync(join(release, file), JSON.stringify(data, null, 2));
const read = file => JSON.parse(readFileSync(join(release, file)));
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true, verbatimSymlinks: true }); };
function guard(app) {
  const versions = JSON.parse(wrangler(app, ['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== app.previous || versions[0].percentage !== 100) throw Error('Production baseline changed: ' + app.role);
}
function prepared() {
  const manifest = read('manifest.json');
  for (const [path, expected] of Object.entries(manifest.files)) if (hash(join(release, path)) !== expected) throw Error('Prepared source changed: ' + path);
  for (const app of apps) if (hash(join(cwd(app), 'dist/index.html')) !== manifest.html[app.role]) throw Error('Prepared build changed: ' + app.role);
  return manifest;
}
const suites = ['dispatch-standard.cjs', 'dispatch-brand-sources.cjs', 'daily-dispatch-renderer.cjs', 'tutor-dispatch-tools.cjs', 'dispatch-archive-sidebar.cjs'];
const suite = process.argv.find(arg => arg.startsWith('--suite='))?.slice(8);
if (suite && !suites.includes(suite)) throw Error('Unknown verification suite');
function tests(live = false) {
  const testEnv = { ...process.env, ...Object.fromEntries(apps.map(app => [app.role.toUpperCase() + '_TEST_URL', live ? `https://${app.role}.fluentxverse.com` : `http://127.0.0.1:${app.port}`])) };
  for (const file of suite ? [suite] : suites) console.log(run('node', ['scripts/tests/' + file], { env: testEnv }));
}
if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'deployment-progress.json')) || (existsSync(join(release, 'manifest.json')) && !process.argv.includes('--refresh'))) throw Error('Release already prepared');
  mkdirSync(release, { recursive: true });
  const files = {}, html = {}, assets = {};
  for (const app of apps) {
    if (!existsSync(join(cwd(app), 'package.json'))) cpSync(join(root, app.baseline), front(app), { recursive: true, verbatimSymlinks: true, filter: p => !['node_modules','dist','.wrangler','.git'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
    if (!existsSync(join(cwd(app), 'node_modules'))) symlinkSync(realpathSync(join(root, app.name, 'node_modules')), join(cwd(app), 'node_modules'), 'dir');
    guard(app);
    for (const file of [...app.files, logo]) copy(join(root, app.name, file), join(cwd(app), file));
    for (const file of shared) copy(join(root, file), join(front(app), file));
    console.log(run('bun', ['run', 'build'], { cwd: cwd(app), env: env(app) }));
    for (const file of [...app.files.map(p => app.name + '/' + p), app.name + '/' + logo, ...shared]) files[`${app.role}/frontend/${file}`] = hash(join(front(app), file));
    html[app.role] = hash(join(cwd(app), 'dist/index.html'));
    assets[app.role] = readdirSync(join(cwd(app), 'dist/assets')).filter(file => /\.(js|css)$/.test(file)).filter(file => {
      const old = join(root, app.baseline, app.name, 'dist/assets', file);
      return !existsSync(old) || hash(old) !== hash(join(cwd(app), 'dist/assets', file));
    });
  }
  record('manifest.json', { files, html, assets, apps, apiChanged: false, preparedAt: new Date().toISOString() });
} else if (process.argv.includes('--verify')) {
  if (!suite) throw Error('Verify one named --suite at a time');
  const manifest = prepared(), children = [];
  try {
    for (const app of apps) {
      const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(app.port), '--strictPort'], { cwd: cwd(app), env: env(app), detached: true, stdio: 'ignore' });
      children.push(child);
      let ready = false;
      for (let i = 0; i < 80; i++) { if (child.exitCode !== null) throw Error('Preview exited: ' + app.role); try { if ((await fetch(`http://127.0.0.1:${app.port}`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 150)); }
      if (!ready) throw Error('Preview did not start: ' + app.role);
    }
    tests();
    record('verification-' + suite + '.json', { html: manifest.html, passed: true, at: new Date().toISOString() });
    if (suites.every(name => existsSync(join(release, 'verification-' + name + '.json')) && JSON.stringify(read('verification-' + name + '.json').html) === JSON.stringify(manifest.html))) record('verification.json', { html: manifest.html, passed: true, suites, at: new Date().toISOString() });
  } finally { children.forEach(child => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }); }
} else if (process.argv.includes('--deploy')) {
  const manifest = prepared(), verification = read('verification.json'), deployed = [];
  if (!verification.passed || JSON.stringify(verification.html) !== JSON.stringify(manifest.html)) throw Error('Verify the exact build first');
  apps.forEach(guard);
  try {
    for (const app of apps) {
      const output = wrangler(app, ['deploy']); console.log(output);
      const version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
      if (!version) throw Error('Missing deployed version: ' + app.role);
      deployed.push({ role: app.role, previous: app.previous, version });
      record('deployment-progress.json', { deployed });
      for (const file of [...manifest.assets[app.role].map(p => 'assets/' + p), 'assets/img/home-icons/dispatch-v2.png']) {
        let matched = false;
        for (let attempt = 0; attempt < 4 && !matched; attempt++) {
          const response = await fetch(`https://${app.role}.fluentxverse.com/${file}`, { signal: AbortSignal.timeout(25000) });
          matched = response.ok && sha(Buffer.from(await response.arrayBuffer())) === hash(join(cwd(app), 'dist', file));
          if (!matched) await new Promise(resolve => setTimeout(resolve, 1500));
        }
        if (!matched) throw Error('Published asset mismatch: ' + app.role + '/' + file);
      }
    }
    record('deployment.json', { deployed, verified: false, assetsVerified: true, apiChanged: false, at: new Date().toISOString() });
  } catch (error) {
    for (const item of deployed.reverse()) console.log(wrangler(apps.find(app => app.role === item.role), ['rollback', item.previous, '--yes']));
    throw error;
  }
} else if (process.argv.includes('--verify-live')) {
  if (!suite) throw Error('Verify one named --suite at a time');
  const manifest = prepared(), deployment = read('deployment.json');
  try {
    tests(true);
    record('live-' + suite + '.json', { html: manifest.html, passed: true, at: new Date().toISOString() });
    if (suites.every(name => existsSync(join(release, 'live-' + name + '.json')) && JSON.stringify(read('live-' + name + '.json').html) === JSON.stringify(manifest.html))) record('deployment.json', { ...deployment, verified: true, at: new Date().toISOString() });
  } catch (error) {
    for (const item of [...deployment.deployed].reverse()) console.log(wrangler(apps.find(app => app.role === item.role), ['rollback', item.previous, '--yes']));
    throw error;
  }
} else throw Error('Use --prepare, --verify --suite=..., --deploy or --verify-live --suite=...');
