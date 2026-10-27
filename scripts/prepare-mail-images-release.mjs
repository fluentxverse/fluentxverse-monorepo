import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'output/release/dashboard-mail-images-20261022');
const baseline = join(root, 'output/release/dashboard-mail-expanded-20261022');
const deployed = JSON.parse(readFileSync(join(baseline, 'dashboard-deployment.json')));
const previous = 'fluentxverse-server:mail-layout-20261022';
const live = JSON.parse(execFileSync('docker', ['inspect', 'fluentxverse-server'], { encoding: 'utf8' }))[0];
if (live.Config.Image !== previous || deployed.version !== '0260c943-86ef-4bb7-ab70-a0da06bd886e') throw Error('Review changed mail release baselines.');
mkdirSync(release, { recursive: true });
if (!existsSync(join(release, 'frontend'))) cpSync(join(baseline, 'frontend'), join(release, 'frontend'), { recursive: true, dereference: false, verbatimSymlinks: true, filter: source => !['dist', '.wrangler'].includes(source.split('/').at(-1)) });
const manifest = { baseImageId: live.Image, previousImage: previous, previousDashboard: deployed.version, createdAt: new Date().toISOString(), files: {} };
function copy(source, target) {
  const from = join(root, source), to = join(release, target);
  mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to);
  manifest.files[source] = createHash('sha256').update(readFileSync(from)).digest('hex');
}
for (const path of ['src/pages/EmailPage.css', 'src/components/mail/MailContent.tsx', 'src/components/mail/mailDocument.ts', 'tests/browser/email.cjs', 'tests/browser/email-rendering.cjs']) copy(`fluentxverse-dashboard/${path}`, `frontend/fluentxverse-dashboard/${path}`);
for (const path of ['src/services/mail/mailHtml.ts', 'tests/mail.test.ts', 'tests/mailHtml.test.ts']) copy(`fluentxverse-server/${path}`, `api/${path}`);
const dependency = join(root, 'node_modules/postcss-value-parser');
if (JSON.parse(readFileSync(join(dependency, 'package.json'))).version !== '4.2.0') throw Error('Unexpected CSS value parser version.');
cpSync(dependency, join(release, 'api/dependency/postcss-value-parser'), { recursive: true });
writeFileSync(join(release, 'api/Dockerfile'), `FROM ${previous} AS release
COPY --chown=appuser:appgroup dependency/postcss-value-parser /app/src/services/mail/node_modules/postcss-value-parser
COPY --chown=appuser:appgroup src/services/mail/mailHtml.ts /app/src/services/mail/mailHtml.ts
FROM release AS test
COPY --chown=appuser:appgroup tests /app/tests
RUN test -e /app/tests/node_modules || ln -s /app/src/services/mail/node_modules /app/tests/node_modules
`);
writeFileSync(join(release, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Prepared isolated email image-rendering release; no mailbox data or credentials copied.');
