import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';

const root = process.cwd(), release = join(root, 'output/release/dispatch-archive-sidebar-20261105');
const name = 'fluentxverse-student-solid-prototype';
const baseline = join(root, 'output/release/daily-dispatch-renderer-20261105/student/frontend');
const cwd = join(release, 'frontend', name), previous = '7603790f-f878-491c-aca3-7c7b4b5dd5c1';
const files = ['student/pages/DailyDispatchArchivePage.tsx', 'student/pages/DailyDispatchArticlePage.css'];
const env = { ...process.env, CI: '1', ...studentPublicBuildEnv(root) };
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', timeout: 240000, maxBuffer: 6e6, ...options });
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc']);
const sha = data => createHash('sha256').update(data).digest('hex');
const hash = file => sha(readFileSync(file));
const record = (file, data) => writeFileSync(join(release, file), JSON.stringify(data, null, 2));
const read = file => JSON.parse(readFileSync(join(release, file)));
const guard = () => {
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== previous || versions[0].percentage !== 100) throw Error('Student production baseline changed');
};
const prepared = () => {
  const manifest = read('manifest.json');
  for (const [path, expected] of Object.entries(manifest.files)) if (hash(join(cwd, path)) !== expected) throw Error('Prepared source changed');
  if (hash(join(cwd, 'dist/index.html')) !== manifest.html) throw Error('Prepared build changed');
  return manifest;
};
const test = base => console.log(run('node', ['scripts/tests/dispatch-archive-sidebar.cjs'], { cwd: root, env: { ...process.env, STUDENT_TEST_URL: base } }));

if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'deployment-progress.json')) || (existsSync(join(release, 'manifest.json')) && !process.argv.includes('--refresh'))) throw Error('Release already prepared');
  mkdirSync(release, { recursive: true });
  cpSync(baseline, join(release, 'frontend'), { recursive: true, verbatimSymlinks: true, filter: path => !['node_modules','dist','.wrangler','.git'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env') });
  if (!existsSync(join(cwd, 'node_modules'))) symlinkSync(realpathSync(join(root, name, 'node_modules')), join(cwd, 'node_modules'), 'dir');
  guard();
  for (const path of files) cpSync(join(root, name, path), join(cwd, path));
  console.log(run('bun', ['run', 'build']));
  const changedAssets = readdirSync(join(cwd, 'dist/assets')).filter(file => /\.(js|css)$/.test(file)).filter(file => {
    const old = join(baseline, name, 'dist/assets', file);
    return !existsSync(old) || hash(old) !== hash(join(cwd, 'dist/assets', file));
  });
  record('manifest.json', { previous, files: Object.fromEntries(files.map(path => [path, hash(join(cwd, path))])), html: hash(join(cwd, 'dist/index.html')), changedAssets, preparedAt: new Date().toISOString() });
} else if (process.argv.includes('--verify')) {
  const manifest = prepared();
  const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5354', '--strictPort'], { cwd, env, detached: true, stdio: 'ignore' });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5354')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 150)); }
    if (!ready) throw Error('Preview did not start');
    test('http://127.0.0.1:5354');
    record('verification.json', { passed: true, html: manifest.html });
  } finally { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--deploy')) {
  const manifest = prepared(), verification = read('verification.json');
  if (!verification.passed || verification.html !== manifest.html) throw Error('Verify the exact build first');
  guard(); let version;
  try {
    const result = wrangler(['deploy']); console.log(result);
    version = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if (!version) throw Error('Missing deployed version');
    record('deployment-progress.json', { previous, version });
    for (const file of manifest.changedAssets) {
      const published = run('curl', ['-fsS', '--max-time', '25', '-A', 'Mozilla/5.0', 'https://student.fluentxverse.com/assets/' + file], { encoding: null });
      if (sha(published) !== hash(join(cwd, 'dist/assets', file))) throw Error('Published asset mismatch: ' + file);
    }
    const html = run('curl', ['-fsS', '--max-time', '25', '-A', 'Mozilla/5.0', 'https://student.fluentxverse.com/materials/daily-dispatch/archives/November%202026']);
    const script = readFileSync(join(cwd, 'dist/index.html'), 'utf8').match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
    if (!script || !html.includes(script)) throw Error('Published HTML is stale');
    test('https://student.fluentxverse.com');
    record('deployment.json', { previous, version, verified: true, apiChanged: false, tutorChanged: false, at: new Date().toISOString() });
  } catch (error) { if (version) console.log(wrangler(['rollback', previous, '--yes'])); throw error; }
} else throw Error('Use --prepare, --verify or --deploy');
