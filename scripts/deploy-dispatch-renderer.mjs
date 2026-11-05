import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';

const root = process.cwd(), release = join(root, 'output/release/daily-dispatch-renderer-20261105');
const apps = [
  { role: 'student', name: 'fluentxverse-student-solid-prototype', baseline: 'output/release/student-hide-feedback-20261105/frontend', previous: 'fc809525-34b9-4af1-b160-3336b1c1b14c', port: 5352,
    files: ['student/pages/DailyDispatchArticlePage.css', 'student/assets/css/app-theme.css', 'student/assets/css/student-secondary.css'] },
  { role: 'tutor', name: 'fluentxverse-tutor-solid-prototype', baseline: 'output/release/tutor-reward-claims-20261105/frontend', previous: '229bf017-1508-4510-83dd-d1b07c186fd0', port: 5351,
    files: ['tutor/pages/DailyDispatchArticlePage.css'] },
];
const front = app => join(release, app.role, 'frontend');
const cwd = app => join(front(app), app.name);
const env = app => ({ ...process.env, CI: '1', ...(app.role === 'student' ? studentPublicBuildEnv(root) : {}) });
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 8e6, ...options });
const wrangler = (app, args) => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd: cwd(app), env: env(app) });
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = file => sha(readFileSync(file));
const record = (name, value) => writeFileSync(join(release, name), JSON.stringify(value, null, 2));
const read = name => JSON.parse(readFileSync(join(release, name)));
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true, verbatimSymlinks: true }); };
function guard(app) {
  const latest = JSON.parse(wrangler(app, ['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
  if (latest.length !== 1 || latest[0].version_id !== app.previous || latest[0].percentage !== 100) throw Error('Production baseline changed: ' + app.role);
}
function checkPrepared() {
  const manifest = read('manifest.json');
  for (const [path, expected] of Object.entries(manifest.files)) if (hash(join(release, path)) !== expected) throw Error('Prepared source changed: ' + path);
  for (const app of apps) if (hash(join(cwd(app), 'dist/index.html')) !== manifest.html[app.role]) throw Error('Prepared build changed: ' + app.role);
  return manifest;
}
if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'manifest.json'))) throw Error('Release already prepared');
  mkdirSync(release, { recursive: true });
  const files = {}, html = {};
  for (const app of apps) {
    cpSync(join(root, app.baseline), front(app), { recursive: true, verbatimSymlinks: true, filter: p => !['node_modules','dist','.wrangler','.git'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
    symlinkSync(realpathSync(join(root, app.name, 'node_modules')), join(cwd(app), 'node_modules'), 'dir');
    guard(app);
    for (const file of app.files) copy(join(root, app.name, file), join(cwd(app), file));
    const shared = 'shared/ui/daily-dispatch-article.css';
    copy(join(root, shared), join(front(app), shared));
    if (app.role === 'tutor') {
      // Apply just the article overrides to the deployed tutor stylesheet.
      const file = 'tutor/assets/css/tutor-design.css';
      const old = run('git', ['show', 'HEAD:' + app.name + '/' + file]).split('\n').filter(line => line.startsWith('.App.tutor-workspace') && line.includes('.ddp-'));
      const next = readFileSync(join(root, app.name, file), 'utf8').split('\n').filter(line => line.startsWith('.App.tutor-workspace') && line.includes('.ddp-'));
      if (old.length !== next.length) throw Error('Review tutor article style anchors');
      let source = readFileSync(join(cwd(app), file), 'utf8');
      old.forEach((line, index) => { if (line === next[index]) return; if (source.split(line).length !== 2) throw Error('Tutor style baseline differs'); source = source.replace(line, next[index]); });
      writeFileSync(join(cwd(app), file), source);
      app.files.push(file);
    }
    run('bun', ['run', 'build'], { cwd: cwd(app), env: env(app), stdio: 'inherit' });
    for (const file of [...app.files.map(path => app.name + '/' + path), shared]) files[`${app.role}/frontend/${file}`] = hash(join(front(app), file));
    html[app.role] = hash(join(cwd(app), 'dist/index.html'));
  }
  record('manifest.json', { files, html, apps, apiChanged: false, preparedAt: new Date().toISOString() });
} else if (process.argv.includes('--verify')) {
  const manifest = checkPrepared(), children = [];
  try {
    for (const app of apps) {
      children.push(spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(app.port), '--strictPort'], { cwd: cwd(app), env: env(app), detached: true, stdio: 'ignore' }));
      let ready = false;
      for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${app.port}`)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 150)); }
      if (!ready) throw Error('Preview did not start: ' + app.role);
    }
    console.log(run('node', ['scripts/tests/daily-dispatch-renderer.cjs'], { env: { ...process.env, STUDENT_TEST_URL: 'http://127.0.0.1:5352', TUTOR_TEST_URL: 'http://127.0.0.1:5351' } }));
    record('verification.json', { html: manifest.html, passed: true, at: new Date().toISOString() });
  } finally { children.forEach(child => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }); }
} else if (process.argv.includes('--deploy')) {
  const manifest = checkPrepared(), verified = read('verification.json'), deployed = [];
  if (!verified.passed || JSON.stringify(verified.html) !== JSON.stringify(manifest.html)) throw Error('Verify exact builds before deploying');
  apps.forEach(guard);
  try {
    for (const app of apps) {
      const result = wrangler(app, ['deploy']); console.log(result);
      const version = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
      if (!version) throw Error('Missing deployed version');
      deployed.push({ role: app.role, previous: app.previous, version });
      record('deployment-progress.json', { deployed });
      for (const file of readdirSync(join(cwd(app), 'dist/assets')).filter(file => /\.(js|css)$/.test(file))) {
        const url = `https://${app.role}.fluentxverse.com/assets/${file}`;
        const published = run('curl', ['-fsS', '--max-time', '25', '-A', 'Mozilla/5.0', url], { encoding: null });
        if (sha(published) !== hash(join(cwd(app), 'dist/assets', file))) throw Error('Published asset differs: ' + url);
      }
    }
    console.log(run('node', ['scripts/tests/daily-dispatch-renderer.cjs'], { env: { ...process.env, STUDENT_TEST_URL: 'https://student.fluentxverse.com', TUTOR_TEST_URL: 'https://tutor.fluentxverse.com' } }));
    record('deployment.json', { deployed, verified: true, apiChanged: false, at: new Date().toISOString() });
  } catch (error) {
    for (const item of deployed.reverse()) { const app = apps.find(app => app.role === item.role); console.log(wrangler(app, ['rollback', app.previous, '--yes'])); }
    throw error;
  }
} else throw Error('Use --prepare, --verify or --deploy');
