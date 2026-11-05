import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, realpathSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd(), app = 'fluentxverse-dashboard';
const release = join(root, 'output/release/tutor-table-compact-20261103');
const baseline = join(root, 'output/release/tutor-table-spacing-20261103/frontend');
const cwd = join(release, 'frontend', app), file = 'src/styles/admin-workspace.css';
const files = [file, 'src/pages/TutorsPage.tsx'];
const previous = '4736caf6-1266-4eb2-a6e2-658bfdd792a5';
const sha = value => createHash('sha256').update(value).digest('hex');
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 8e6, ...options });
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc']);
const guard = () => {
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== previous) throw Error('Dashboard baseline changed');
};
const record = (name, data) => writeFileSync(join(release, name), JSON.stringify(data, null, 2));
const test = base => console.log(run('node', ['scripts/tests/tutor-table-spacing.cjs'], { cwd: root, env: { ...process.env, ADMIN_TEST_URL: base } }));

if (process.argv.includes('--prepare')) {
  mkdirSync(release, { recursive: true });
  if (!existsSync(cwd)) cpSync(baseline, join(release, 'frontend'), { recursive: true, verbatimSymlinks: true, filter: p => !['node_modules', 'dist', '.wrangler'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
  if (!existsSync(join(cwd, 'node_modules'))) symlinkSync(realpathSync(join(baseline, app, 'node_modules')), join(cwd, 'node_modules'), 'dir');
  guard();
  for (const source of files) cpSync(join(root, app, source), join(cwd, source));
  console.log(run('bun', ['run', 'build']));
  record('manifest.json', { previous, sources: Object.fromEntries(files.map(source => [source, sha(readFileSync(join(cwd, source)))])), html: sha(readFileSync(join(cwd, 'dist/index.html'))) });
} else if (process.argv.includes('--verify')) {
  const child = spawn(process.execPath, [join(cwd, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5308', '--strictPort'], { cwd, detached: true, stdio: 'ignore' });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5308')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 250)); }
    if (!ready) throw Error('Preview unavailable');
    test('http://127.0.0.1:5308');
    record('verification.json', { passed: true, html: sha(readFileSync(join(cwd, 'dist/index.html'))) });
  } finally { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--deploy')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'))), verified = JSON.parse(readFileSync(join(release, 'verification.json')));
  if (!verified.passed || verified.html !== manifest.html || manifest.html !== sha(readFileSync(join(cwd, 'dist/index.html'))) || files.some(source => manifest.sources[source] !== sha(readFileSync(join(cwd, source))))) throw Error('Verify exact build first');
  guard();
  let version;
  try {
    const output = wrangler(['deploy']); console.log(output);
    version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if (!version) throw Error('Missing deployment version');
    for (const asset of readdirSync(join(cwd, 'dist/assets')).filter(f => /\.(js|css)$/.test(f))) {
      const expected = sha(readFileSync(join(cwd, 'dist/assets', asset)));
      const response = await fetch('https://dashboard.fluentxverse.com/assets/' + asset);
      if (!response.ok || sha(Buffer.from(await response.arrayBuffer())) !== expected) throw Error('Published asset mismatch: ' + asset);
    }
    test('https://dashboard.fluentxverse.com');
    record('deployment.json', { previous, version, verified: true, apiUnchanged: true, at: new Date().toISOString() });
  } catch (error) { if (version) console.log(wrangler(['rollback', previous, '--yes'])); throw error; }
} else throw Error('Use --prepare, --verify or --deploy');
