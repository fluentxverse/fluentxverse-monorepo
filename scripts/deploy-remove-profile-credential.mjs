import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd(), id = 'remove-profile-credential-20261028';
const release = join(root, 'output/release', id);
const apps = [
  { name: 'tutor', directory: 'fluentxverse-tutor-solid-prototype', previous: '3c2bceba-b6d7-42d8-9a57-df9c0f909170',
    domains: ['tutor.fluentxverse.com'], files: ['tutor/pages/MyProfilePage.tsx', 'tests/browser/profileEducation.cjs'] },

];
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 10e6, env: { ...process.env, CI: '1' } });
const cwd = app => join(release, app.name, 'frontend', app.directory);
const wrangler = (app, args) => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], cwd(app));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const guard = app => {
  const latest = JSON.parse(wrangler(app, ['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
  if (latest.versions.length !== 1 || latest.versions[0].version_id !== app.previous || latest.versions[0].percentage !== 100) throw Error(`${app.name} baseline changed`);
};
if (existsSync(release)) throw Error('Release already exists');
mkdirSync(release, { recursive: true });
const sources = {};
for (const app of apps) {
  cpSync(join(root, 'output/release/profile-education-20261028', app.name, 'frontend'), join(release, app.name, 'frontend'), {
    recursive: true, verbatimSymlinks: true, filter: path => !['dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env'),
  });
  guard(app);
  for (const file of app.files) {
    const target = join(cwd(app), file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, app.directory, file), target);
    sources[`${app.name}/${file}`] = hash(readFileSync(target));
  }
  console.log(run('bun', ['run', 'build'], cwd(app)));
}
writeFileSync(join(release, 'manifest.json'), JSON.stringify({ id, apps, sources, preparedAt: new Date().toISOString(), apiUnchanged: true }, null, 2));
const deployed = [];
try {
  for (const app of apps) {
    guard(app);
    const result = wrangler(app, ['deploy']); console.log(result);
    const version = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if (!version) throw Error('Missing deployment version');
    deployed.push({ name: app.name, version, previous: app.previous });
  }
  for (const app of apps) {
    const dist = join(cwd(app), 'dist');
    for (const domain of app.domains) {
      const response = await fetch(`https://${domain}/${app.name === 'dashboard' ? 'applications' : 'home'}`, { signal: AbortSignal.timeout(20000) });
      const html = await response.text();
      const refs = text => [...text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]).sort();
      if (!response.ok || JSON.stringify(refs(html)) !== JSON.stringify(refs(readFileSync(join(dist, 'index.html'), 'utf8')))) throw Error(`HTML mismatch: ${domain}`);
      for (const file of readdirSync(join(dist, 'assets')).filter(file => /\.(js|css)$/.test(file))) {
        const asset = await fetch(`https://${domain}/assets/${file}`, { signal: AbortSignal.timeout(20000) });
        if (!asset.ok || hash(Buffer.from(await asset.arrayBuffer())) !== hash(readFileSync(join(dist, 'assets', file)))) throw Error(`Asset mismatch: ${domain}/${file}`);
      }
    }
  }
  console.log(run('env', ['TUTOR_TEST_URL=https://tutor.fluentxverse.com', 'node', 'tests/browser/profileEducation.cjs'], cwd(apps[0])));
  writeFileSync(join(release, 'deployment.json'), JSON.stringify({ deployed, deployedAt: new Date().toISOString(), publicAssetsVerified: true, apiUnchanged: true }, null, 2));
  console.log('PASS: Screening Credential removed; live assets and profile workflows verified.');
} catch (error) {
  for (const app of apps.slice().reverse()) if (deployed.some(item => item.name === app.name)) console.log(wrangler(app, ['rollback', app.previous, '--yes']));
  writeFileSync(join(release, 'rollback.json'), JSON.stringify({ reason: error.message, deployed, at: new Date().toISOString() }, null, 2));
  throw error;
}
