import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = join(root, 'output/release/dashboard-email-20261021');
const release = join(root, 'output/release/dashboard-email-interactions-20261022');
const deployed = JSON.parse(readFileSync(join(baseline, 'dashboard-deployment.json')));
if (deployed.version !== '80ceb7e8-ca18-4b1b-bcc0-14ed34aca0ff') throw Error('Review the changed frontend baseline.');
mkdirSync(release, { recursive: true });
if (!existsSync(join(release, 'frontend'))) cpSync(join(baseline, 'frontend'), join(release, 'frontend'), {
  recursive: true, dereference: false, verbatimSymlinks: true,
  filter: source => !['dist', '.wrangler'].includes(source.split('/').at(-1)),
});
const manifest = { baselineVersion: deployed.version, createdAt: new Date().toISOString(), files: {} };
for (const path of ['src/pages/EmailPage.tsx', 'src/components/mail/mailViewState.ts', 'tests/browser/email.cjs', 'tests/mailViewState.test.ts']) {
  const source = join(root, 'fluentxverse-dashboard', path), target = join(release, 'frontend/fluentxverse-dashboard', path);
  mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target);
  manifest.files[path] = createHash('sha256').update(readFileSync(source)).digest('hex');
}
writeFileSync(join(release, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Prepared email-only frontend updates over the deployed dashboard snapshot.');
