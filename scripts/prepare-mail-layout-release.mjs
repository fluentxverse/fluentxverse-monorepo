import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'output/release/dashboard-mail-layout-20261022');
const baseline = join(root, 'output/release/dashboard-email-interactions-20261022');
const deployed = JSON.parse(readFileSync(join(baseline, 'dashboard-deployment.json')));
const previous = 'fluentxverse-server:spacemail-20261021';
const live = JSON.parse(execFileSync('docker', ['inspect', 'fluentxverse-server'], { encoding: 'utf8' }))[0];
if (live.Config.Image !== previous || deployed.version !== '58d621b9-4ffb-4189-b4e2-fadd204d2555') throw Error('Review changed mail release baselines.');
mkdirSync(release, { recursive: true });
if (!existsSync(join(release, 'frontend'))) cpSync(join(baseline, 'frontend'), join(release, 'frontend'), { recursive: true, dereference: false, verbatimSymlinks: true, filter: source => !['dist', '.wrangler'].includes(source.split('/').at(-1)) });
const manifest = { baseImageId: live.Image, previousImage: previous, previousDashboard: deployed.version, createdAt: new Date().toISOString(), files: {} };
function copy(source, target) {
  const from = join(root, source), to = join(release, target);
  mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to);
  manifest.files[source] = createHash('sha256').update(readFileSync(from)).digest('hex');
}
for (const path of ['src/pages/EmailPage.tsx', 'src/pages/EmailPage.css', 'src/components/mail/MailContent.tsx', 'src/components/mail/mailDocument.ts', 'tests/browser/email.cjs']) copy(`fluentxverse-dashboard/${path}`, `frontend/fluentxverse-dashboard/${path}`);
for (const path of ['src/services/mail/mailPolicy.ts', 'src/services/mail/mailProvider.ts', 'src/services/mail/mailHtml.ts', 'tests/mail.test.ts', 'tests/mailHtml.test.ts']) copy(`fluentxverse-server/${path}`, `api/${path}`);
writeFileSync(join(release, 'api/Dockerfile'), `FROM ${previous} AS release
COPY --chown=appuser:appgroup src/services/mail /app/src/services/mail
FROM release AS test
COPY --chown=appuser:appgroup tests /app/tests
RUN ln -s /app/src/services/mail/node_modules /app/tests/node_modules
`);
writeFileSync(join(release, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Prepared isolated mail layout/rendering release; no credentials or unrelated code copied.');
