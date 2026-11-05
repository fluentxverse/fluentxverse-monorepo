import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd(), name = 'fluentxverse-tutor-solid-prototype';
const release = resolve('output/release/tutor-reward-claims-20261105'), front = join(release, 'frontend'), cwd = join(front, name);
const base = resolve('output/release/learning-terminology-20261104/tutor/frontend');
const previous = '58f1ece2-88d0-4a9a-8847-7bc235210d25';
const files = ['tutor/pages/RewardsPage.tsx', 'tutor/pages/RewardsPage.css', 'tutor/Components/IndexOne/SideBar.tsx', 'tutor/pages/HomePage.tsx', 'tutor/assets/css/tutor-design.css', 'tutor/index.tsx'];
const hash = x => createHash('sha256').update(x).digest('hex');
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd, env: { ...process.env, CI: '1' }, encoding: 'utf8', maxBuffer: 8e6, timeout: 240000, ...options });
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc']);
const record = (file, data) => writeFileSync(join(release, file), JSON.stringify(data, null, 2));
const guard = () => {
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== previous) throw Error('Tutor deployment baseline changed');
};
if (process.argv.includes('--prepare')) {
  if (!existsSync(cwd)) cpSync(base, front, { recursive: true, verbatimSymlinks: true,
    filter: p => !['node_modules', 'dist', '.wrangler', '.git'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
  if (!existsSync(join(cwd, 'node_modules'))) symlinkSync(resolve(name, 'node_modules'), join(cwd, 'node_modules'), 'dir');
  guard(); const sources = {};
  for (const file of files) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    let content = readFileSync(join(root, name, file), 'utf8');
    if (file === 'tutor/index.tsx') content = content.replace(/^ +(<Route path="\/interview-guide")/m, '$1');
    writeFileSync(join(cwd, file), content); sources[file] = hash(content);
  }
  console.log(run('bun', ['run', 'build']));
  record('manifest.json', { previous, sources, html: hash(readFileSync(join(cwd, 'dist/index.html'))), scope: 'Tutor rewards page and navigation only' });
} else if (process.argv.includes('--verify')) {
  const child = spawn(process.execPath, [join(cwd, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5340', '--strictPort'], { cwd, stdio: 'ignore', detached: true });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5340')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 250)); }
    if (!ready) throw Error('Preview unavailable');
    console.log(run('node', ['tests/browser/tutorRewards.cjs'], { cwd: resolve(name), env: { ...process.env, TUTOR_TEST_URL: 'http://127.0.0.1:5340' } }));
    record('verification.json', { passed: true, html: hash(readFileSync(join(cwd, 'dist/index.html'))) });
  } finally { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--deploy') || process.argv.includes('--verify-published')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'))), verified = JSON.parse(readFileSync(join(release, 'verification.json')));
  if (!verified.passed || verified.html !== manifest.html || verified.html !== hash(readFileSync(join(cwd, 'dist/index.html')))) throw Error('Exact build must pass verification');
  for (const [file, expected] of Object.entries(manifest.sources)) if (hash(readFileSync(join(cwd, file))) !== expected) throw Error('Source changed');
  const published = process.argv.includes('--verify-published');
  let version;
  if (published) {
    const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
    if (versions.length !== 1 || versions[0].version_id !== '229bf017-1508-4510-83dd-d1b07c186fd0') throw Error('Published version changed');
    version = versions[0].version_id;
  } else guard();
  try {
    if (!published) {
      const output = wrangler(['deploy']); console.log(output);
      version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1]; if (!version) throw Error('Missing deployment version');
    }
    for (const file of readdirSync(join(cwd, 'dist/assets')).filter(f => /\.(js|css)$/.test(f))) {
      let matched = false;
      for (let i = 0; i < 15; i++) {
        const r = await fetch('https://tutor.fluentxverse.com/assets/' + file, { signal: AbortSignal.timeout(20000), headers: { 'Cache-Control': 'no-cache' } });
        if (r.ok && hash(Buffer.from(await r.arrayBuffer())) === hash(readFileSync(join(cwd, 'dist/assets', file)))) { matched = true; break; }
        await new Promise(r => setTimeout(r, 3000));
      }
      if (!matched) throw Error('Public asset mismatch: ' + file);
    }
    console.log(run('node', ['tests/browser/tutorRewards.cjs'], { cwd: resolve(name), env: { ...process.env, TUTOR_TEST_URL: 'https://tutor.fluentxverse.com' } }));
    record('deployment.json', { previous, version, assetsVerified: true, browserTestsPassed: true, at: new Date().toISOString() });
  } catch (error) { if (version) console.log(wrangler(['rollback', previous, '--yes'])); throw error; }
} else throw Error('Use --prepare, --verify, or --deploy');
