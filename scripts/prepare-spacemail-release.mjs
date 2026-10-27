import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/release/spacemail-20261021');
const previous = 'fluentxverse-server:mail-20261021';
const live = JSON.parse(execFileSync('docker', ['inspect', 'fluentxverse-server'], { encoding: 'utf8' }))[0];
if (live.Config.Image !== previous) throw Error('Review the changed live API before preparing Spacemail.');
for (const path of ['src/services/mail/mailConfig.ts', 'src/services/mail/mailService.ts', 'tests/mail.test.ts']) {
  const target = join(output, 'api', path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, 'fluentxverse-server', path), target);
}
writeFileSync(join(output, 'source-manifest.json'), JSON.stringify({ previousImage: previous, baseImageId: live.Image, createdAt: new Date().toISOString() }, null, 2));
writeFileSync(join(output, 'api/Dockerfile'), `FROM ${previous} AS release
COPY --chown=appuser:appgroup src/services/mail/mailConfig.ts /app/src/services/mail/mailConfig.ts
COPY --chown=appuser:appgroup src/services/mail/mailService.ts /app/src/services/mail/mailService.ts
FROM release AS test
COPY --chown=appuser:appgroup tests/mail.test.ts /app/tests/mail.test.ts
RUN ln -s /app/src/services/mail/node_modules /app/tests/node_modules
`);
console.log('Prepared mail-access-only release; no secrets copied into build context.');
