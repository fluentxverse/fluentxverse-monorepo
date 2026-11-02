import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const release = join(root, 'output/release/business-footer-20261027');
const apps = [
  { name: 'dashboard', directory: 'fluentxverse-dashboard', baseline: 'dashboard-auth-20261027', path: 'src/pages/BusinessEnglishVisualEditor.css', version: '37f35b1f-3ddb-4020-aa41-fce5da9b2639' },
  { name: 'tutor', directory: 'fluentxverse-tutor-solid-prototype', baseline: 'applicant-tabs-20261027', path: 'tutor/pages/BusinessEnglishVisualEditor.css', version: '4bd3ccc8-80a9-46b9-8417-9865ebe60f2b' },
  { name: 'student', directory: 'fluentxverse-student-solid-prototype', baseline: 'student-social-links-20261023', path: 'student/pages/BusinessEnglishVisualEditor.css', version: '8460f99c-3cb6-4948-b170-a5b1e9718458' },
];
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 8e6, env: { ...process.env, CI: '1' } });
for (const app of apps) {
  const target = join(release, app.name, 'frontend');
  const cwd = join(target, app.directory);
  if (existsSync(target)) throw Error(`Release already exists: ${target}`);
  mkdirSync(target, { recursive: true });
  cpSync(join(root, 'output/release', app.baseline, 'frontend'), target, { recursive: true, verbatimSymlinks: true });
  cpSync(join(root, app.directory, app.path), join(cwd, app.path));
  const latest = JSON.parse(run('bunx', ['wrangler@4.152.0', 'deployments', 'list', '--json', '--config', 'wrangler.jsonc'], cwd)).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
  if (latest.versions.length !== 1 || latest.versions[0].version_id !== app.version || latest.versions[0].percentage !== 100) throw Error(`${app.name} deployment changed`);
  run('bun', ['run', 'build'], cwd);
  const result = run('bunx', ['wrangler@4.152.0', 'deploy', '--config', 'wrangler.jsonc'], cwd);
  const version = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
  if (!version) throw Error(`Missing ${app.name} version`);
  writeFileSync(join(release, app.name, 'deployment.json'), JSON.stringify({ version, previous: app.version, path: app.path, deployedAt: new Date().toISOString() }, null, 2));
  console.log(`${app.name}: ${version}`);
}
