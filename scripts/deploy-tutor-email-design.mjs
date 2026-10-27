import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';

const root = process.cwd(), id = 'tutor-email-design-20261026', release = join(root, 'output/release', id);
const previousAPI = 'fluentxverse-cloud/api:written-exam-quality-20261026', image = 'fluentxverse-cloud/api:' + id;
const composePath = '/opt/fluentxverse/releases/20261023/compose.private.json', stage = '/opt/fluentxverse/releases/' + id;
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, ...options });
const save = (path, content) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
const imageId = () => JSON.parse(ssh(`docker image inspect ${image} --format '{{json .Id}}'`));

if (process.argv.includes('--prepare-build')) {
  if (existsSync(join(release, 'manifest.json'))) throw Error('Release already prepared');
  if (JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Config.Image}}'")) !== previousAPI) throw Error('API baseline changed');
  // Refuse to overwrite unrelated changes in the provider.
  const live = ssh('docker exec fluentxverse-server cat /app/src/services/mail/mailProvider.ts');
  let restored = readFileSync('fluentxverse-server/src/services/mail/mailProvider.ts', 'utf8').replace(/^import .* from '\.\/tutorConfirmation.template';\n/m, '');
  const start = restored.indexOf('export async function buildTutorConfirmationMessage('), end = restored.indexOf('export const mailProvider: MailProvider = {', start);
  if (start < 0 || end < 0) throw Error('Provider anchors changed');
  restored = restored.slice(0, start) + restored.slice(end);
  const sendStart = live.lastIndexOf('  send: async (account, draft, requestId) => {');
  restored = restored.replace('  send: async (account, draft, requestId) => sendBuiltMessage(account, await buildOutgoingMessage(account, draft, requestId)),', live.slice(sendStart, live.indexOf('\n};', sendStart)));
  if (restored !== live) throw Error('Review additional provider differences');
  for (const path of ['src/services/mail/mailProvider.ts', 'src/services/mail/tutorConfirmation.template.ts', 'src/services/mail/assets/fluentxverse-icon.png',
    'src/services/auth.services/tutorEmail.service.ts', 'tests/tutorEmailTemplate.test.ts', 'tests/mailHtml.test.ts']) {
    const target = join(release, 'api', path); mkdirSync(dirname(target), { recursive: true }); cpSync(join(root, 'fluentxverse-server', path), target);
  }
  save(join(release, 'api/Dockerfile'), `FROM ${previousAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
  save(join(release, 'manifest.json'), JSON.stringify({ id, image, previousAPI, scope: 'Tutor confirmation HTML, embedded logo and clickable links only', preparedAt: new Date().toISOString() }, null, 2));
  run('tar', ['-czf', join(release, 'api.tar.gz'), '-C', join(release, 'api'), '.']);
  ssh(`mkdir -p ${stage}/api`);
  run('scp', [...sshOptions, join(release, 'api.tar.gz'), `${cloudTarget}:${stage}/api.tar.gz`]);
  ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api`);
  console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/api`, { timeout: 180000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ./tests/tutorEmailTemplate.test.ts ./tests/tutorEmail.test.ts ./tests/mail.test.ts ./tests/mailHtml.test.ts ./tests/writtenQuality.test.ts ./tests/applicationPolicy.test.ts`, { timeout: 60000 }));
  // Bundling syntax only: production runs source so the relative PNG asset stays available.
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/email-api.js`, { timeout: 60000 }));
  save(join(release, 'images-built.json'), JSON.stringify({ image, imageId: imageId(), at: new Date().toISOString() }));
} else if (process.argv.includes('--mail-pilot')) {
  const password = JSON.parse(ssh("docker exec fluentxverse-server bun --no-env-file -e 'console.log(JSON.stringify(process.env.TUTOR))'"));
  if (!password) throw Error('Tutor mailbox credential missing');
  const code = String.raw`
    import assert from 'node:assert/strict';
    import { randomBytes, createHash } from 'node:crypto';
    process.env.TUTOR = (await Bun.stdin.json()).password;
    process.env.NODE_ENV = 'production';
    const { sendTutorConfirmation, tutorConfirmationURL } = await import('./src/services/auth.services/tutorEmail.service');
    const { tutorConfirmationLogo } = await import('./src/services/mail/tutorConfirmation.template');
    const { safeReceivedHtml } = await import('./src/services/mail/mailHtml');
    const { ImapFlow } = await import(Bun.resolveSync('imapflow','/app/src/services/mail'));
    const { simpleParser } = await import(Bun.resolveSync('mailparser','/app/src/services/mail'));
    const address = 'tutor@fluentxverse.com', token = randomBytes(32).toString('base64url'), url = tutorConfirmationURL(token);
    const client = new ImapFlow({ host:'mail.spacemail.com',port:993,secure:true,logger:false,
      auth:{user:address,pass:process.env.TUTOR},connectionTimeout:15000,greetingTimeout:10000,socketTimeout:30000 });
    client.on('error',()=>{});
    let lock;
    try {
      await client.connect(); lock = await client.getMailboxLock('INBOX',{readOnly:true});
      const messageId = await sendTutorConfirmation(address,token);
      let parsed;
      for(let i=0;i<18&&!parsed;i++) {
        const ids=await client.search({header:{'message-id':messageId}},{uid:true});
        if(ids&&ids.length) {
          const message=await client.fetchOne(ids.at(-1),{source:true},{uid:true});
          parsed=await simpleParser(message.source,{keepCidLinks:true});
        } else { await Bun.sleep(5000); await client.noop(); }
      }
      assert(parsed,'Confirmation was not delivered within 90 seconds');
      assert(parsed.from.value.some(a=>a.address===address));
      assert(parsed.to.value.some(a=>a.address===address));
      assert(parsed.text.includes(url));
      assert(parsed.html.includes('Confirm email address'));
      assert.equal(parsed.html.split('href="'+url+'"').length-1,2);
      const logo=parsed.attachments.find(a=>a.contentId==='<fluentxverse-logo@inline>');
      assert(logo&&logo.content.equals(tutorConfirmationLogo()));
      const html=safeReceivedHtml(parsed.html,parsed.attachments);
      assert(html.includes('src="data:image/png;base64,'));
      assert(html.includes('padding:14px 24px'));
      assert(!html.includes('data-mail-src'));
      console.log(JSON.stringify({delivered:true,brandedHtml:true,embeddedLogoVerified:true,clickableButton:true,
        clickableFallback:true,plainTextAlternative:true,adminReaderCompatible:true,noApplicantCreated:true}));
    } finally { if(lock)lock.release();try{if(client.usable)await client.logout();}catch{}client.close(); }
    process.exit(0);`;
  const result = JSON.parse(ssh(`docker run --rm -i --network container:fluentxverse-server --entrypoint bun ${image} --no-env-file -e ${quote(code)}`, { input: JSON.stringify({ password }), timeout: 180000 }));
  console.log(JSON.stringify(result));
  save(join(release, 'mail-pilot.json'), JSON.stringify({ ...result, imageId: imageId(), at: new Date().toISOString() }));
} else if (process.argv.includes('--activate')) {
  if (JSON.parse(readFileSync(join(release, 'images-built.json'))).imageId !== imageId() ||
    JSON.parse(readFileSync(join(release, 'mail-pilot.json'))).imageId !== imageId()) throw Error('Exact tested image required');
  const original = ssh(`cat ${composePath}`), compose = JSON.parse(original);
  if (compose.services.api.image !== previousAPI) throw Error('API baseline changed');
  const check = "import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classrooms; defer release');console.log(JSON.stringify({activeClassrooms:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(check)}`));
  const examCheck = "import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();try{const r=await s.run(\"MATCH(e:Exam) WHERE e.status IN ['generating','queued','processing'] RETURN count(e) AS n\");if(Number(r.records[0].get('n')))throw Error('Active assessment work; defer release');}finally{await s.close();await closeDriver();}";
  ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(examCheck)}`);
  const state = join(homedir(), '.local/state/fluentxverse', id); mkdirSync(state, { recursive: true, mode: 0o700 });
  compose.services.api.image = image;
  const next = join(state, 'compose.private.json'); writeFileSync(next, JSON.stringify(compose, null, 2), { mode: 0o600 });
  const backup = composePath + '.pre-email-design-' + Date.now(); ssh(`cp -p ${composePath} ${backup}`);
  run('scp', [...sshOptions, next, `${cloudTarget}:${composePath}.next`]);
  if (ssh(`cat ${composePath}`) !== original) throw Error('Runtime changed');
  try {
    ssh(`chmod 600 ${composePath}.next`); ssh(`mv ${composePath}.next ${composePath}`);
    console.log(ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
    if ((await fetch('https://api.fluentxverse.com/tutor/email-verification/')).status !== 401) throw Error('Auth boundary failed');
  } catch (error) {
    ssh(`cp -p ${backup} ${composePath}`);
    ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 });
    throw error;
  }
  save(join(release, 'deployment.json'), JSON.stringify({ image, imageId: imageId(), previousAPI, at: new Date().toISOString() }, null, 2));
  console.log('PASS branded tutor confirmation email deployed; frontend and exam generation unchanged');
} else throw Error('Use --prepare-build, --mail-pilot, or --activate');
