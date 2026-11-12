import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const november7 = process.argv.includes('--nov07');
const root = process.cwd(), release = resolve(`output/release/site-changelog-${november7 ? '20261107' : '20261105'}`), cwd = join(release, 'site');
const baseline = resolve(november7 ? 'output/release/site-changelog-20261105/site' : 'output/release/site-web3-ecosystem-20261105/site');
const previous = november7 ? '404708da-681f-4a84-ab38-00458582eea3' : '6e78498f-ef2f-4382-95c2-a84694c66c34';
const sources = ['src/data/changelogEntries.json', 'src/data/changelog.ts', 'tests/changelog.test.ts'];
const hash = value => createHash('sha256').update(value).digest('hex');
const fileHash = file => hash(readFileSync(file));
const run = (command, args, options = {}) => execFileSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, CI: '1' }, timeout: 240000, maxBuffer: 5e6, ...options });
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.toml']);
const record = (file, value) => writeFileSync(join(release, file), JSON.stringify(value, null, 2) + '\n');
function guard() {
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== previous) throw Error('Live website changed; review the baseline before publishing');
}
async function publicHash(domain, file) {
  const response = await fetch(`https://${domain}/${file}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error(`Published file unavailable: ${domain}/${file} (${response.status})`);
  return hash(Buffer.from(await response.arrayBuffer()));
}
const browserTest = base => console.log(run('node', ['tests/browser/changelog.cjs'], { cwd: resolve('fluentxverse-site'), env: { ...process.env, SITE_URL: base } }));
const manifest = () => JSON.parse(readFileSync(join(release, 'manifest.json'), 'utf8'));
function verifySources() {
  const m = manifest();
  for (const [file, sha] of Object.entries(m.sources)) if (fileHash(join(cwd, file)) !== sha) throw Error('Release source changed: ' + file);
  if (fileHash(join(cwd, 'dist/index.html')) !== m.html || fileHash(join(cwd, 'dist/changelog.json')) !== m.feed) throw Error('Release build changed');
  return m;
}

if (process.argv.includes('--prepare')) {
  if (existsSync(release)) throw Error('Release already exists; do not overwrite verified files');
  mkdirSync(release, { recursive: true });
  cpSync(baseline, cwd, { recursive: true, verbatimSymlinks: true, filter: file => !['node_modules', 'dist', '.wrangler', '.git'].includes(file.split('/').at(-1)) && !file.split('/').at(-1).startsWith('.env') });
  symlinkSync(resolve('node_modules'), join(cwd, 'node_modules'), 'dir');
  guard();
  for (const file of ['index.html', 'changelog.json']) if (await publicHash('fluentxverse.com', file) !== fileHash(join(baseline, 'dist', file))) throw Error('Live baseline mismatch: ' + file);
  const old = JSON.parse(readFileSync(join(baseline, 'dist/changelog.json'), 'utf8'));
  const next = JSON.parse(readFileSync(resolve('fluentxverse-site/src/data/changelogEntries.json'), 'utf8'));
  for (const entry of old.entries) if (JSON.stringify(next.entries.find(value => value.id === entry.id)) !== JSON.stringify(entry)) throw Error('Published entry changed: ' + entry.id);
  for (const file of sources) cpSync(resolve('fluentxverse-site', file), join(cwd, file));
  console.log(run('bun', ['run', 'build']));
  record('manifest.json', { previous, entries: next.entries.length, added: next.entries.length - old.entries.length, publishedHistoryPreserved: true, scope: november7 ? 'Changelog content only; excludes lesson-material authoring updates' : 'Changelog content and Website/Dashboard filters only', sources: Object.fromEntries(sources.map(file => [file, fileHash(join(cwd, file))])), html: fileHash(join(cwd, 'dist/index.html')), feed: fileHash(join(cwd, 'dist/changelog.json')) });
} else if (process.argv.includes('--verify')) {
  const m = verifySources();
  const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5350', '--strictPort'], { cwd, detached: true, stdio: 'ignore' });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5350/changelog')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
    if (!ready) throw Error('Preview unavailable');
    browserTest('http://127.0.0.1:5350');
    record('verification.json', { passed: true, html: m.html, feed: m.feed, at: new Date().toISOString() });
  } finally { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--deploy')) {
  const m = verifySources(), v = JSON.parse(readFileSync(join(release, 'verification.json'), 'utf8'));
  if (!v.passed || v.html !== m.html || v.feed !== m.feed) throw Error('Verify the exact release first');
  guard();
  let version;
  try {
    const output = wrangler(['deploy']); console.log(output);
    version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if (!version) throw Error('Deployment version missing');
    record('deployment-progress.json', { previous, version });
    const assets = ['index.html', 'changelog.json', ...readdirSync(join(cwd, 'dist/assets')).filter(file => /\.(js|css)$/.test(file)).map(file => 'assets/' + file)];
    for (const domain of ['fluentxverse.com', 'www.fluentxverse.com']) for (const file of assets) {
      if (await publicHash(domain, file) !== fileHash(join(cwd, 'dist', file))) throw Error('Published asset mismatch: ' + domain + '/' + file);
    }
    browserTest('https://fluentxverse.com');
    record('deployment.json', { previous, version, entries: m.entries, added: m.added, assetsVerified: true, browserTestsPassed: true, url: 'https://fluentxverse.com/changelog', at: new Date().toISOString() });
  } catch (error) {
    if (version) console.log(wrangler(['rollback', previous, '--yes']));
    throw error;
  }
} else throw Error('Use --prepare, --verify, or --deploy');
