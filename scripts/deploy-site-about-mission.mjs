import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd(), release = resolve('output/release/site-about-mission-20261105'), cwd = join(release, 'site');
const baseline = resolve('output/release/learning-terminology-20261104/site/frontend/fluentxverse-site');
const previous = 'ff71f400-e92e-4bd0-8cde-ca76c204e747';
const file = 'src/pages/AboutPage.tsx', hash = x => createHash('sha256').update(x).digest('hex');
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, CI: '1' }, timeout: 240000, maxBuffer: 5e6, ...options });
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.toml']);
const record = (file, data) => writeFileSync(join(release, file), JSON.stringify(data, null, 2));
const guard = () => {
  const v = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
  if (v.length !== 1 || v[0].version_id !== previous) throw Error('Site production baseline changed');
};
const checkPublic = async () => {
  for (const domain of ['fluentxverse.com', 'www.fluentxverse.com']) {
    for (const path of ['index.html', 'changelog.json', ...readdirSync(join(cwd, 'dist/assets')).filter(f => /\.(js|css)$/.test(f)).map(f => 'assets/' + f)]) {
      let matched = false;
      for (let i = 0; i < 12; i++) {
        const r = await fetch(`https://${domain}/${path}`, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
        if (r.ok && hash(Buffer.from(await r.arrayBuffer())) === hash(readFileSync(join(cwd, 'dist', path)))) { matched = true; break; }
        await new Promise(r => setTimeout(r, 2000));
      }
      if (!matched) throw Error('Published asset mismatch: ' + domain + '/' + path);
    }
  }
};
if (process.argv.includes('--prepare')) {
  if (!existsSync(cwd)) cpSync(baseline, cwd, { recursive: true, verbatimSymlinks: true,
    filter: p => !['node_modules', 'dist', '.wrangler', '.git'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
  if (!existsSync(join(cwd, 'node_modules'))) symlinkSync(resolve('fluentxverse-site/node_modules'), join(cwd, 'node_modules'), 'dir');
  guard(); cpSync(join(root, 'fluentxverse-site', file), join(cwd, file));
  console.log(run('bun', ['run', 'build']));
  record('manifest.json', { previous, source: hash(readFileSync(join(cwd, file))), html: hash(readFileSync(join(cwd, 'dist/index.html'))), scope: 'About page mission paragraph only; preserve production baseline' });
} else if (process.argv.includes('--verify')) {
  const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5341', '--strictPort'], { cwd, detached: true, stdio: 'ignore' });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5341')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 250)); }
    if (!ready) throw Error('Preview unavailable');
    console.log(run('node', ['tests/browser/aboutMission.cjs'], { cwd: resolve('fluentxverse-site'), env: { ...process.env, SITE_URL: 'http://127.0.0.1:5341' } }));
    record('verification.json', { passed: true, html: hash(readFileSync(join(cwd, 'dist/index.html'))) });
  } finally { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--deploy')) {
  const m = JSON.parse(readFileSync(join(release, 'manifest.json'))), v = JSON.parse(readFileSync(join(release, 'verification.json')));
  if (!v.passed || v.html !== m.html || m.html !== hash(readFileSync(join(cwd, 'dist/index.html'))) || m.source !== hash(readFileSync(join(cwd, file)))) throw Error('Verified release changed');
  guard(); let version;
  try {
    const output = wrangler(['deploy']); console.log(output); version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1]; if (!version) throw Error('Missing deployment version');
    record('deployment-progress.json', { previous, version });
    await checkPublic();
    console.log(run('node', ['tests/browser/aboutMission.cjs'], { cwd: resolve('fluentxverse-site'), env: { ...process.env, SITE_URL: 'https://fluentxverse.com' } }));
    record('deployment.json', { previous, version, assetsVerified: true, browserTestsPassed: true, url: 'https://fluentxverse.com/about', at: new Date().toISOString() });
  } catch (error) { if (version) console.log(wrangler(['rollback', previous, '--yes'])); throw error; }
} else throw Error('Use --prepare, --verify, or --deploy');
