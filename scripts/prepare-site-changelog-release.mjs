import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, symlinkSync, lstatSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd(), site = join(root, 'fluentxverse-site');
const release = join(root, 'output/release/site-changelog-20261024');
const baseline = join(release, 'baseline');
mkdirSync(baseline, { recursive: true });
for (const path of ['src', 'public', 'index.html', 'package.json', 'vite.config.ts', 'tsconfig.json']) {
  cpSync(join(site, path), join(baseline, path), { recursive: true });
}
const modules = join(baseline, 'node_modules');
if (lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink()) unlinkSync(modules);
symlinkSync(join(root, 'node_modules'), modules);
const undo = (path, before, after = '') => {
  const file = join(baseline, path), source = readFileSync(file, 'utf8');
  if (source.split(before).length !== 2) throw Error('Changelog-only baseline marker changed: ' + path);
  writeFileSync(file, source.replace(before, after));
};
undo('src/App.tsx', "const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));\n");
undo('src/App.tsx', "  '/changelog': {\n    title: 'Changelog | FluentXVerse',\n    description: 'Release notes for the FluentXVerse student app, tutor app, and backend, with permanent update IDs and app-specific filters.',\n  },\n");
undo('src/App.tsx', '      <Route path="/changelog" component={ChangelogPage} />\n');
undo('src/components/Navbar.tsx', '          <A href="/changelog" class="changelog-nav" activeClass="is-active">Changelog</A>\n');
undo('src/components/Footer.tsx', '            <A href="/changelog">Changelog</A>\n');
undo('src/styles/main.css', '  .primary-navigation .changelog-nav { display: none; }\n');
execFileSync(join(root, 'node_modules/.bin/vite'), ['build'], { cwd: baseline, stdio: 'inherit' });

const hash = data => createHash('sha256').update(data).digest('hex');
const get = async path => {
  const r = await fetch('https://fluentxverse.com/' + path, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Error('Live asset missing: ' + path);
  return { data: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' };
};
const builtAssets = dir => readdirSync(dir, { withFileTypes: true }).filter(item => item.isFile()).map(item => 'assets/' + item.name);
const baselineFiles = ['index.html', ...builtAssets(join(baseline, 'dist/assets'))];
for (const path of baselineFiles) {
  const deployed = await get(path);
  if (hash(deployed.data) !== hash(readFileSync(join(baseline, 'dist', path)))) throw Error('Local site differs from deployment outside changelog: ' + path);
}

// Fetch existing public assets from production, not from unrelated local edits.
const assets = join(release, 'assets');
mkdirSync(assets, { recursive: true });
mkdirSync(join(assets, 'assets'), { recursive: true });
for (const path of ['index.html', ...builtAssets(join(site, 'dist/assets'))]) cpSync(join(site, 'dist', path), join(assets, path));
const publicFiles = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory()
  ? publicFiles(join(dir, item.name), prefix + item.name + '/') : [prefix + item.name]);
for (const path of publicFiles(join(site, 'public'))) {
  if (path === 'changelog.json' || path.startsWith('_')) continue;
  const deployed = await get(path);
  if (deployed.type.includes('text/html')) continue;
  mkdirSync(join(assets, path, '..'), { recursive: true });
  writeFileSync(join(assets, path), deployed.data);
}
cpSync(join(site, 'dist/changelog.json'), join(assets, 'changelog.json'));
for (const path of ['_headers', '_redirects']) cpSync(join(site, 'public', path), join(assets, path));
writeFileSync(join(release, 'wrangler.toml'), readFileSync(join(site, 'wrangler.toml'), 'utf8').replace('directory = "./dist"', 'directory = "./assets"'));
writeFileSync(join(release, 'manifest.json'), JSON.stringify({ preparedAt: new Date().toISOString(),
  baselineAssetsMatched: baselineFiles.length, liveBaselineHash: hash(readFileSync(join(baseline, 'dist/index.html'))),
  changelogIDs: JSON.parse(readFileSync(join(site, 'src/data/changelogEntries.json'))).entries.map(entry => entry.id),
  unrelatedPublicAssetsTakenFromProduction: true }, null, 2));
console.log('PASS changelog-only release matches live baseline; existing public assets preserved.');
