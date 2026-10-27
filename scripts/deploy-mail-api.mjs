import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, chmodSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { literalComposeEnvironment, parseMailboxEnvironment } from './lib/mail-runtime-env.mjs';
import { dottedMailboxAccounts } from './lib/mailbox-addresses.mjs';
if (!process.argv.includes('--deploy')) throw Error('Use --deploy after the email-only production preview passes.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spacemail = process.argv.includes('--spacemail');
const layout = process.argv.includes('--mail-layout');
const addresses = process.argv.includes('--mail-addresses');
const images = process.argv.includes('--mail-images');
const composer = process.argv.includes('--mail-composer');
if ([layout, spacemail, addresses, images, composer].filter(Boolean).length > 1) throw Error('Select only one release mode.');
const output = join(root, composer ? 'output/release/dashboard-mail-composer-20261022' : images ? 'output/release/dashboard-mail-images-20261022' : addresses ? 'output/release/dashboard-mail-expanded-20261022' : layout ? 'output/release/dashboard-mail-layout-20261022' : spacemail ? 'output/release/spacemail-20261021' : 'output/release/dashboard-email-20261021');
const image = composer ? 'fluentxverse-server:mail-composer-20261022' : images ? 'fluentxverse-server:mail-images-20261022' : layout || addresses ? 'fluentxverse-server:mail-layout-20261022' : spacemail ? 'fluentxverse-server:spacemail-20261021' : 'fluentxverse-server:mail-20261021';
const previous = composer ? 'fluentxverse-server:mail-images-20261022' : images ? 'fluentxverse-server:mail-layout-20261022' : addresses ? image : layout ? 'fluentxverse-server:spacemail-20261021' : spacemail ? 'fluentxverse-server:mail-20261021' : 'fluentxverse-server:zk-security-20261020';
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw Error(`Docker ${args[0]} failed: ${result.stderr.slice(-1000)}`);
  return result.stdout;
}
const live = () => JSON.parse(docker(['inspect', 'fluentxverse-server']))[0];
const privateResponse = response => { const tokens = new Set((response.headers.get('cache-control') || '').split(',').map(value => value.trim().toLowerCase())); return tokens.has('private') && tokens.has('no-store'); };
const old = live(), manifest = JSON.parse(readFileSync(join(output, 'source-manifest.json')));
if (old.Config.Image !== previous || old.Image !== manifest.baseImageId) throw Error('The API base changed. Review before releasing.');
if (!addresses) {
  console.log(docker(['run', '--rm', '--network=none', '-e', 'NODE_ENV=test', composer ? 'fluentxverse-server:mail-composer-test-20261022' : images ? 'fluentxverse-server:mail-images-test-20261022' : layout ? 'fluentxverse-server:mail-layout-test-20261022' : spacemail ? 'fluentxverse-server:spacemail-test-20261021' : 'fluentxverse-server:mail-test-20261021', 'bun', 'test', 'tests/mail.test.ts', ...(layout || images || composer ? ['tests/mailHtml.test.ts'] : []), ...(composer ? ['tests/mailCompose.test.ts'] : [])]));
  docker(['run', '--rm', '--network=none', image, 'bun', 'build', 'src/index.ts', '--target=bun', '--outfile=/tmp/mail-api-check.js']);
}
const project = old.Config.Labels['com.docker.compose.project'], serviceName = old.Config.Labels['com.docker.compose.service'];
const networks = Object.keys(old.NetworkSettings.Networks);
if (!project || !serviceName || networks.length !== 1 || old.Config.Env.some(value => value.includes('\n'))) throw Error('Unexpected runtime layout.');
const runtime = Object.fromEntries(old.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
const previousRuntime = { ...runtime };
if (addresses) runtime.MAIL_ACCOUNTS_JSON = JSON.stringify(dottedMailboxAccounts(JSON.parse(runtime.MAIL_ACCOUNTS_JSON || '[]')));
if (spacemail) {
  // Read mailbox passwords literally: dotenv interpolation corrupts generated passwords containing '$'.
  const mailboxSecrets = parseMailboxEnvironment(readFileSync(join(root, 'fluentxverse-server/.env'), 'utf8'));
  if (runtime.MAIL_ACCOUNTS_JSON?.trim()) throw Error('Mailbox configuration already exists; review before merging.');
  const records = JSON.parse(docker(['exec', 'fluentxverse-server', 'bun', '-e', `
    import neo4j from 'neo4j-driver';
    const d=neo4j.driver(process.env.MEMGRAPH_URI,neo4j.auth.basic(process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD)),s=d.session();
    try { const r=await s.run('MATCH (a:Admin) RETURN a.id AS id,a.username AS username,a.role AS role');console.log(JSON.stringify(r.records.map(r=>r.toObject()))); }
    finally { await s.close(); await d.close(); }
  `]));
  const entries = [
    ['agnes', 'agnes.veloso', 'AGNES'], ['mark', 'mark.vibas', 'MARK'],
    ['paul', 'paul.arriola', 'PAUL'], ['yehna', 'yehna.lee', 'YEHNA'], ['support', 'support', 'SUPPORT'],
  ];
  runtime.MAIL_ACCOUNTS_JSON = JSON.stringify(entries.map(([id, local, source]) => {
    const password = mailboxSecrets[source];
    if (!password || /[\r\n\0]/.test(password)) throw Error(`Missing or invalid ${source} mailbox secret. Load the server .env securely.`);
    const passwordEnv = `MAIL_SPACEMAIL_${source}_PASSWORD`;
    runtime[passwordEnv] = password;
    const owners = records.filter(admin => admin.username === id && ['admin', 'superadmin'].includes(admin.role));
    if (id !== 'support' && owners.length !== 1) throw Error(`Mailbox owner mapping is ambiguous: ${id}`);
    const address = `${local}@fluentxverse.com`;
    return { id, label: id === 'support' ? 'FluentXVerse Support' : address, address,
      shared: id === 'support', adminIds: id === 'support' ? [] : [owners[0].id],
      imap: { host: 'mail.spacemail.com', port: 993, user: address, passwordEnv },
      smtp: { host: 'mail.spacemail.com', port: 465, secure: true, user: address, passwordEnv } };
  }));
}
const privateDir = join(homedir(), '.local/state/fluentxverse', `mail-release-${Date.now()}`);
mkdirSync(privateDir, { recursive: true, mode: 0o700 }); chmodSync(privateDir, 0o700);
const envFile = join(privateDir, 'preflight.env');
writeFileSync(envFile, Object.entries(runtime).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
async function api(path) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:8765${path}`, { headers: { Connection: 'close' }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('API compatibility check failed: ' + response.status);
      return await response.json();
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
const before = { passes: await api('/lesson-passes/mode'), issuer: await api('/lesson-privacy/issuer'), screening: await api('/screening/agent.json') };
const activeCheck = `import {db,closePool} from './src/db/postgres'; try { const r=await db\`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'\`; if(r[0].n>0)throw Error('Active classroom connections; defer release'); console.log(JSON.stringify({activeClassroomConnections:r[0].n})); } finally {await closePool();}`;
let preflight;
try {
  preflight = docker(['run', '--rm', '--network', networks[0], '--env-file', envFile, image, 'bun', '-e', `
    import Elysia from 'elysia';
    import {mailRoute} from './src/routes/mail.route';
    import {mailService} from './src/services/mail/mailService';
    import {mailRepository} from './src/services/mail/mailRepository';
    import {db,closePool} from './src/db/postgres';
    try {
      const r=await db\`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'\`;
      if(r[0].n>0)throw Error('Active classroom connections; defer release');
      const response=await new Elysia().use(mailRoute).handle(new Request('http://localhost/admin/mail/status'));
      if(response.status!==401 || response.headers.get('cache-control')!=='private, no-store')throw Error('Mail authentication boundary failed');
      const {mailConfigs}=await import('./src/services/mail/mailConfig');
      const accounts=mailConfigs();
      if(${spacemail || layout || addresses || images || composer}) {
        const {mailProvider}=await import('./src/services/mail/mailProvider');
        if(accounts.length!==5)throw Error('Expected five mailboxes');
        const shared=accounts.find(a=>a.id==='support');
        if(!shared?.shared || accounts.some(a=>a.id!=='support' && (a.shared || a.adminIds.length!==1)))throw Error('Mailbox privacy configuration failed');
        const outsider=mailService.status({userId:'deployment-preflight',role:'superadmin'});
        if(outsider.accounts.length!==1 || outsider.accounts[0].id!=='support')throw Error('Superadmin privacy boundary failed');
        for(const account of accounts) {
          if(!account.shared) {
            for(const role of ['admin','superadmin']) {
              const own=mailService.status({userId:account.adminIds[0],role});
              if(own.accounts.length!==2 || !own.accounts.some(a=>a.id===account.id))throw Error('Owner mailbox access failed');
            }
          }
          if(${spacemail || addresses}) {
            try { await mailProvider.verify(account); }
            catch { throw Error('Spacemail IMAP/SMTP verification failed for '+account.address); }
            console.log('VERIFIED '+account.address);
          }
        }
      }
      const preferences=await mailRepository.preferences('deployment-preflight-'+crypto.randomUUID());
      if(preferences.contacts.length || preferences.signature)throw Error('Unexpected preflight preferences');
      console.log(JSON.stringify({activeClassroomConnections:r[0].n,mailSchemaReady:true,mailAuthenticationEnforced:true,configuredMailboxes:accounts.length,providerConnectionsVerified:${spacemail || addresses}}));
    } finally {await closePool();}
  `]);
} finally { rmSync(envFile, { force: true }); }
const checks = JSON.parse(preflight.trim().split('\n').at(-1));
writeFileSync(join(output, 'api-preflight.json'), JSON.stringify(checks, null, 2));
console.log('PASS mail schema and authentication preflight; configured mailboxes:', checks.configuredMailboxes);
function service(selectedImage, environment = runtime) {
  return { image: selectedImage, container_name: old.Name.replace(/^\//, ''), restart: old.HostConfig.RestartPolicy.Name,
    environment: literalComposeEnvironment(environment),
    user: old.Config.User, working_dir: old.Config.WorkingDir, entrypoint: old.Config.Entrypoint, command: old.Config.Cmd,
    extra_hosts: old.HostConfig.ExtraHosts, logging: { driver: old.HostConfig.LogConfig.Type, options: old.HostConfig.LogConfig.Config },
    ports: Object.entries(old.HostConfig.PortBindings).flatMap(([port, bindings]) => bindings.map(binding => ({ target: Number(port.split('/')[0]), protocol: port.split('/')[1], published: binding.HostPort, ...(binding.HostIp ? { host_ip: binding.HostIp } : {}) }))),
    networks: Object.fromEntries(networks.map(name => [name, { aliases: (old.NetworkSettings.Networks[name].Aliases || []).filter(alias => !/^[a-f0-9]{12,64}$/.test(alias)) }])),
    volumes: old.Mounts.map(mount => ({ type: mount.Type, source: mount.Type === 'volume' ? mount.Name : mount.Source, target: mount.Destination, read_only: !mount.RW })),
    labels: Object.fromEntries(Object.entries(old.Config.Labels).filter(([key]) => !key.startsWith('com.docker.compose.'))),
    ...(old.HostConfig.ReadonlyRootfs ? { read_only: true } : {}), ...(old.HostConfig.SecurityOpt ? { security_opt: old.HostConfig.SecurityOpt } : {}),
    ...(old.HostConfig.CapDrop ? { cap_drop: old.HostConfig.CapDrop } : {}), ...(old.HostConfig.Init ? { init: true } : {}),
    ...(old.Config.Healthcheck ? { healthcheck: { test: old.Config.Healthcheck.Test, interval: '30s', timeout: '10s', start_period: '5s', retries: 3 } } : {}),
  };
}
function compose(selectedImage, environment = runtime) { return { name: project, services: { [serviceName]: service(selectedImage, environment) },
  networks: Object.fromEntries(networks.map(name => [name, { external: true, name }])),
  volumes: Object.fromEntries(old.Mounts.filter(mount => mount.Type === 'volume').map(mount => [mount.Name, { external: true, name: mount.Name }])) }; }
const target = join(privateDir, 'runtime-compose.json'), rollback = join(privateDir, 'rollback-compose.json');
writeFileSync(target, JSON.stringify(compose(image)), { mode: 0o600 });
writeFileSync(rollback, JSON.stringify(compose(old.Config.Image, previousRuntime)), { mode: 0o600 });
if (live().Id !== old.Id) throw Error('The live API changed during preflight.');
docker(['exec', 'fluentxverse-server', 'bun', '-e', activeCheck]);
try {
  docker(['compose', '-p', project, '-f', target, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', serviceName]);
  await api('/health');
  const after = { passes: await api('/lesson-passes/mode'), issuer: await api('/lesson-privacy/issuer'), screening: await api('/screening/agent.json') };
  if (after.passes.data?.mode !== before.passes.data?.mode || after.issuer.data?.keyId !== before.issuer.data?.keyId || after.screening.active !== before.screening.active) throw Error('Protected workflow compatibility check failed.');
  const response = await fetch('http://127.0.0.1:8765/admin/mail/status', { headers: { Connection: 'close' }, signal: AbortSignal.timeout(10000) });
  if (response.status !== 401 || !privateResponse(response)) throw Error('Live mail authentication check failed.');
  const current = live(), currentEnv = Object.fromEntries(current.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
  if (Object.entries(runtime).some(([key, value]) => currentEnv[key] !== value)) throw Error('Runtime environment changed unexpectedly.');
  writeFileSync(join(output, 'api-deployment.json'), JSON.stringify({ image, previousImage: old.Config.Image, deployedAt: new Date().toISOString(), checks,
    runtimeEnvironmentPreserved: true, privacyIssuerPreserved: true, bookingModePreserved: true, rollbackConfig: rollback }, null, 2));
  console.log('PASS email API deployed; health, authentication, runtime and protected workflows verified.');
} catch (error) {
  console.error('Activation failed; restoring the previous API image.');
  docker(['compose', '-p', project, '-f', rollback, 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', serviceName]);
  throw error;
}
