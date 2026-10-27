import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const release=join(root,'output/release/dashboard-mail-composer-20261022');
const baseline=join(root,'output/release/dashboard-admin-theme-20261022');
const deployed=JSON.parse(readFileSync(join(baseline,'dashboard-deployment.json')));
const previous='fluentxverse-server:mail-images-20261022';
const live=JSON.parse(execFileSync('docker',['inspect','fluentxverse-server'],{encoding:'utf8'}))[0];
if(live.Config.Image!==previous || deployed.version!=='7e760af7-b6b2-49e3-9b6d-d372ddfbd45a')throw Error('Review changed composer baselines.');
mkdirSync(release,{recursive:true});
if(!existsSync(join(release,'frontend')))cpSync(join(baseline,'frontend'),join(release,'frontend'),{recursive:true,dereference:false,verbatimSymlinks:true,filter:source=>!['dist','.wrangler'].includes(source.split('/').at(-1))});
const manifest={baseImageId:live.Image,previousImage:previous,previousDashboard:deployed.version,createdAt:new Date().toISOString(),files:{}};
function copy(source,target){const from=join(root,source),to=join(release,target);mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to);manifest.files[source]=createHash('sha256').update(readFileSync(from)).digest('hex');}
for(const file of ['MailUi.tsx','MailEditor.tsx','MailComposer.tsx','MailComposer.css','mailCompose.ts'])copy(`fluentxverse-dashboard/src/components/mail/${file}`,`frontend/fluentxverse-dashboard/src/components/mail/${file}`);
for(const file of ['src/pages/EmailPage.tsx','tests/browser/email.cjs','tests/browser/mail-composer.cjs','tests/mailCompose.test.ts'])copy(`fluentxverse-dashboard/${file}`,`frontend/fluentxverse-dashboard/${file}`);
for(const file of ['src/services/mail/mailPolicy.ts','src/services/mail/mailProvider.ts','src/services/mail/mailCompose.ts','tests/mail.test.ts','tests/mailHtml.test.ts','tests/mailCompose.test.ts'])copy(`fluentxverse-server/${file}`,`api/${file}`);
writeFileSync(join(release,'api/Dockerfile'),`FROM ${previous} AS release
COPY --chown=appuser:appgroup src/services/mail/mailPolicy.ts /app/src/services/mail/mailPolicy.ts
COPY --chown=appuser:appgroup src/services/mail/mailProvider.ts /app/src/services/mail/mailProvider.ts
COPY --chown=appuser:appgroup src/services/mail/mailCompose.ts /app/src/services/mail/mailCompose.ts
FROM release AS test
COPY --chown=appuser:appgroup tests /app/tests
RUN test -e /app/tests/node_modules || ln -s /app/src/services/mail/node_modules /app/tests/node_modules
`);
writeFileSync(join(release,'source-manifest.json'),JSON.stringify(manifest,null,2));
console.log('Prepared isolated composer frontend and API overlay; no credentials or unrelated source copied.');
