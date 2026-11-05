import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const releaseDate = process.env.CHANGELOG_RELEASE_DATE || '20261102';
const baselineDate = process.env.CHANGELOG_BASELINE_DATE || '20261031';
if (!/^\d{8}$/.test(releaseDate) || !/^\d{8}$/.test(baselineDate) || releaseDate <= baselineDate) throw Error('Invalid release dates');
const baseline = join(root, `output/release/site-changelog-${baselineDate}`);
const release = join(root, `output/release/site-changelog-${releaseDate}`);
const cwd = join(release, 'site');
const previous = JSON.parse(readFileSync(join(baseline, 'deployment.json'))).version;
const env = { ...process.env, CI: '1', WRANGLER_LOG_PATH: '/tmp/fxv-changelog-nov02-wrangler.log' };
const hash = data => createHash('sha256').update(data).digest('hex');
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', env, maxBuffer: 5e6, ...options });
const save = (name, data) => writeFileSync(join(release, name), JSON.stringify(data, null, 2) + '\n');
const wrangler = args => run(process.execPath, ['/tmp/bunx-1000-wrangler@4.152.0/node_modules/wrangler/bin/wrangler.js', ...args, '--config', 'wrangler.toml'], { cwd: release });
const guard = () => {
  const deployments = JSON.parse(wrangler(['deployments', 'list', '--json']));
  const versions = deployments.sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== previous) throw Error('Live site changed; review before publishing');
};
const publicBytes = async (domain, file) => {
  const response = await fetch(`https://${domain}/${file}`, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw Error(`HTTP ${response.status}: ${domain}/${file}`);
  return Buffer.from(await response.arrayBuffer());
};

if (process.argv.includes('--prepare')) {
  mkdirSync(release, { recursive: true });
  cpSync(join(baseline, 'site'), cwd, {
    recursive: true, verbatimSymlinks: true,
    filter: path => !['node_modules', 'dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env'),
  });
  if (!existsSync(join(cwd, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(cwd, 'node_modules'), 'dir');
  cpSync(join(baseline, 'assets'), join(release, 'assets'), { recursive: true });
  cpSync(join(baseline, 'wrangler.toml'), join(release, 'wrangler.toml'));
  guard();
  for (const file of ['index.html', 'changelog.json']) {
    if (hash(await publicBytes('fluentxverse.com', file)) !== hash(readFileSync(join(baseline, 'assets', file)))) throw Error('Live baseline mismatch: ' + file);
  }
  const source = join(root, 'fluentxverse-site/src/data/changelogEntries.json');
  const next = JSON.parse(readFileSync(source));
  const old = JSON.parse(readFileSync(join(baseline, 'assets/changelog.json')));
  for (const entry of old.entries) {
    if (JSON.stringify(next.entries.find(item => item.id === entry.id)) !== JSON.stringify(entry)) throw Error('Existing entry changed: ' + entry.id);
  }
  cpSync(source, join(cwd, 'src/data/changelogEntries.json'));
  cpSync(join(root, 'fluentxverse-site/tests/changelog.test.ts'), join(cwd, 'tests/changelog.test.ts'));
  console.log(run('bun', ['run', 'build'], { cwd }));
  for (const file of ['index.html', 'changelog.json', 'assets']) cpSync(join(cwd, 'dist', file), join(release, 'assets', file), { recursive: true });
  save('manifest.json', { previous, feedHash: hash(readFileSync(source)), htmlHash: hash(readFileSync(join(cwd, 'dist/index.html'))), entries: next.entries.length, added: next.entries.length - old.entries.length, existingEntriesUnchanged: true, unrelatedSourcePreserved: true });
} else if (process.argv.includes('--verify')) {
  const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5215', '--strictPort'], { cwd, env, stdio: 'ignore', detached: true });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch('http://127.0.0.1:5215/changelog')).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw Error('Preview unavailable');
    console.log(run('node', ['tests/browser/changelog.cjs'], { cwd, env: { ...env, SITE_URL: 'http://127.0.0.1:5215' } }));
    save('verification.json', { passed: true, htmlHash: hash(readFileSync(join(cwd, 'dist/index.html'))), verifiedAt: new Date().toISOString() });
  } finally {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  }
} else if (process.argv.includes('--activate')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json')));
  const verified = JSON.parse(readFileSync(join(release, 'verification.json')));
  if (!verified.passed || verified.htmlHash !== manifest.htmlHash || hash(readFileSync(join(release, 'assets/index.html'))) !== manifest.htmlHash || hash(readFileSync(join(release, 'assets/changelog.json'))) !== manifest.feedHash) throw Error('Verified build changed');
  guard();
  let version;
  try {
    const output = wrangler(['deploy']);
    console.log(output);
    version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if (!version) throw Error('Missing deployed version');
    const files = ['index.html', 'changelog.json', ...readdirSync(join(cwd, 'dist/assets')).filter(file => /\.(js|css)$/.test(file)).map(file => 'assets/' + file)];
    for (const domain of ['fluentxverse.com', 'www.fluentxverse.com']) {
      for (const file of files) {
        if (hash(await publicBytes(domain, file)) !== hash(readFileSync(join(release, 'assets', file)))) throw Error(`Live asset mismatch: ${domain}/${file}`);
      }
    }
    console.log(run('node', ['tests/browser/changelog.cjs'], { cwd, env: { ...env, SITE_URL: 'https://fluentxverse.com' } }));
    save('deployment.json', { version, previous, entries: manifest.entries, added: manifest.added, verifiedAt: new Date().toISOString() });
  } catch (error) {
    if (version) console.log(wrangler(['rollback', previous, '--yes']));
    throw error;
  }
} else {
  throw Error('Use --prepare, --verify or --activate');
}
