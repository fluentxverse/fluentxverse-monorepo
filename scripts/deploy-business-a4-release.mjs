import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'output/release/business-a4-pilot-20261024');
const cwd = join(release, 'frontend/fluentxverse-dashboard');
const manifest = JSON.parse(readFileSync(join(release, 'source-manifest.json'), 'utf8'));
const deploymentFile = join(release, 'dashboard-deployment.json');
const previousDashboard = existsSync(deploymentFile)
  ? JSON.parse(readFileSync(deploymentFile, 'utf8')).version : manifest.previousDashboard;
for (const [path, hash] of Object.entries(manifest.files)) {
  if (createHash('sha256').update(readFileSync(join(cwd, path))).digest('hex') !== hash) {
    throw Error('The prepared A4 source changed. Rebuild and verify it before deploying.');
  }
}
function wrangler(args) {
  const result = spawnSync('bunx', ['--bun', 'wrangler@4.151.1', ...args, '--config', 'wrangler.jsonc'], {
    cwd, env: { ...process.env, CI: '1' }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw Error((result.stderr || result.stdout).slice(-2000));
  return result.stdout;
}
const versions = [...wrangler(['deployments', 'list']).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)];
if (versions.at(-1)?.[1] !== previousDashboard) {
  throw Error('The live dashboard changed after the A4 snapshot was prepared. Review the baseline before deploying.');
}
const output = wrangler(['deploy']);
console.log(output);
const version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
if (!version) throw Error('Inspect the Cloudflare deployment before continuing.');
writeFileSync(join(release, 'dashboard-deployment.json'), JSON.stringify({
  version, previous: previousDashboard, deployedAt: new Date().toISOString(),
  scope: 'Business English Level 3 Chapter 1 Lesson 1 A4 layout pilot',
}, null, 2));
