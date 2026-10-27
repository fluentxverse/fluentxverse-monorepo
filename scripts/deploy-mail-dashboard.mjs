import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
if (!process.argv.includes('--deploy')) throw Error('Use --deploy after the email production preview passes.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const interactions = process.argv.includes('--mail-interactions');
const layout = process.argv.includes('--mail-layout');
const spinner = process.argv.includes('--mail-spinner');
const expanded = process.argv.includes('--mail-expanded');
const images = process.argv.includes('--mail-images');
const header = process.argv.includes('--mail-header');
const theme = process.argv.includes('--admin-theme');
const composer = process.argv.includes('--mail-composer');
const calendar = process.argv.includes('--calendar-lines');
const darkBody = process.argv.includes('--composer-dark-body');
if ([layout, interactions, spinner, expanded, images, header, theme, composer, calendar, darkBody].filter(Boolean).length > 1) throw Error('Select only one dashboard release mode.');
const release = join(root, darkBody ? 'output/release/dashboard-compose-dark-20261022' : calendar ? 'output/release/dashboard-calendar-lines-20261022' : composer ? 'output/release/dashboard-mail-composer-20261022' : theme ? 'output/release/dashboard-admin-theme-20261022' : header ? 'output/release/dashboard-mail-header-20261022' : images ? 'output/release/dashboard-mail-images-20261022' : expanded ? 'output/release/dashboard-mail-expanded-20261022' : spinner ? 'output/release/dashboard-mail-spinner-20261022' : layout ? 'output/release/dashboard-mail-layout-20261022' : interactions ? 'output/release/dashboard-email-interactions-20261022' : 'output/release/dashboard-email-20261021');
const cwd = join(release, 'frontend/fluentxverse-dashboard');
const previous = darkBody ? '19b82164-414c-4df2-88b7-b79da48cbd44' : calendar ? 'b22590ba-a9a5-4ad3-a368-71f5cedc8103' : composer ? '7e760af7-b6b2-49e3-9b6d-d372ddfbd45a' : theme ? 'a2c27179-eae0-42ce-9d6b-33ef6783f150' : header ? '93d88887-6e3e-49c7-89a8-125e4ff10dc3' : images ? '0260c943-86ef-4bb7-ab70-a0da06bd886e' : expanded ? '0018e083-f3e2-4543-a01a-98d60d98f75e' : spinner ? '7401f058-3ead-491d-bd14-743e5568b580' : layout ? '58d621b9-4ffb-4189-b4e2-fadd204d2555' : interactions ? '8d08e070-0e40-4063-9b36-28f4ea5fa1d9' : '3415792b-75ce-4b5a-999e-18380e72b0a0';
const api = JSON.parse(readFileSync(join(calendar || darkBody ? join(root, 'output/release/dashboard-mail-composer-20261022') : header || theme ? join(root, 'output/release/dashboard-mail-images-20261022') : spinner ? join(root, 'output/release/dashboard-mail-layout-20261022') : interactions ? join(root, 'output/release/spacemail-20261021') : release, 'api-deployment.json')));
if (api.image !== (composer || calendar || darkBody ? 'fluentxverse-server:mail-composer-20261022' : images || header || theme ? 'fluentxverse-server:mail-images-20261022' : layout || spinner || expanded ? 'fluentxverse-server:mail-layout-20261022' : interactions ? 'fluentxverse-server:spacemail-20261021' : 'fluentxverse-server:mail-20261021')) throw Error('Review the deployed email API baseline.');
const status = await fetch('https://api.fluentxverse.com/admin/mail/status', { signal: AbortSignal.timeout(15000) });
const policy = new Set((status.headers.get('cache-control') || '').split(',').map(value => value.trim().toLowerCase()));
if (status.status !== 401 || !policy.has('private') || !policy.has('no-store')) throw Error('Public email API authentication check failed.');
function files(path) { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]); }
for (const path of files(join(cwd, 'dist'))) if (/imapPassword|smtpPassword|MAIL_SUPPORT_PASSWORD/.test(readFileSync(path, 'utf8'))) throw Error('Server mail configuration found in frontend output.');
function wrangler(args) {
  const result = spawnSync('bunx', ['--bun', 'wrangler@4.151.1', ...args, '--config', 'wrangler.jsonc'], { cwd, env: { ...process.env, CI: '1' }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw Error('Dashboard Cloudflare operation failed: ' + (result.stderr || result.stdout).slice(-1500));
  return result.stdout;
}
const versions = [...wrangler(['deployments', 'list']).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)];
if (versions.at(-1)?.[1] !== previous) throw Error('The dashboard deployment changed. Review before replacing it.');
const output = wrangler(['deploy']); console.log(output);
const version = output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
if (!version) throw Error('Inspect the deployed dashboard version before continuing.');
writeFileSync(join(release, 'dashboard-deployment.json'), JSON.stringify({ version, previous, deployedAt: new Date().toISOString(), emailApiImage: api.image }, null, 2));
console.log('PASS email dashboard deployed:', version);
