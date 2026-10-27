import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { ssh, sshOptions, cloudTarget, quote } from './lib/cloud-ssh.mjs';

if (!process.argv.includes('--cutover')) throw Error('Use --cutover only after the staged cloud release is verified');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = join(homedir(), '.local/state/fluentxverse/cloud-20261023');
const output = join(root, 'output/cloud/20261023'), remote = '/opt/fluentxverse/releases/20261023';
const backups = join(state, 'backups'), compose = `docker compose -f ${quote(remote + '/compose.private.json')}`;
const originals = JSON.parse(readFileSync(join(state, 'inventory.private.json')));
const inventory = JSON.parse(readFileSync(join(output, 'inventory.json')));
const mounts = JSON.parse(readFileSync(join(state, 'mounts.json')));
const staged = JSON.parse(readFileSync(join(output, 'images-staged.json')));
assert(staged.imageIdsVerified);
if (existsSync(join(state, 'cutover-checkpoint.json'))) throw Error('A cutover checkpoint exists; reconcile it instead of blindly restarting');
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const runtime = container => Object.fromEntries(container.Config.Env.map(v => { const i = v.indexOf('='); return [v.slice(0, i), v.slice(i + 1)]; }));
const byRole = role => originals.find(x => x.Name === '/' + inventory.services.find(s => s.role === role).name);
const image = byRole('api').Image, tarImage = byRole('gmr-engine-memgraph').Image;
const env = runtime(byRole('api'));
const age = join(state, 'age'), keygen = join(state, 'age-keygen'), identity = join(state, 'backup-age.key');
const hostUnit = (...args) => docker(['run', '--rm', '--network=none', '--pid=host', '--privileged', '--user=0',
  '--entrypoint=/usr/bin/nsenter', tarImage, '-t', '1', '-m', '-u', '-i', '-n', '-p', '/usr/bin/systemctl', ...args]);
const checkpoint = phase => save(join(state, 'cutover-checkpoint.json'), { phase, at: new Date().toISOString() });
const exit = child => new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(Error('Migration stream subprocess failed'))); });
const digest = async path => { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); };

const graphProbe = `import neo4j from 'neo4j-driver'; const p=await Bun.stdin.json();const d=neo4j.driver(p.uri,neo4j.auth.basic(p.user,p.password));
const s=d.session();try{const n=await s.run('MATCH(n) RETURN labels(n) AS labels,count(n) AS n');const r=await s.run('MATCH()-[r]->() RETURN type(r) AS type,count(r) AS n');
console.log(JSON.stringify({nodes:n.records.map(x=>[x.get('labels').sort().join(':'),x.get('n').toNumber()]).sort((a,b)=>a[0].localeCompare(b[0])),relationships:r.records.map(x=>[x.get('type'),x.get('n').toNumber()]).sort((a,b)=>a[0].localeCompare(b[0]))}));}finally{await s.close();await d.close();}process.exit(0);`;
const sqlProbe = `import{SQL}from'bun'; const p=await Bun.stdin.json();const sql=new SQL(p.uri);try{const tables=await sql.unsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");const result=[];
for(const t of tables){const n=await sql.unsafe('SELECT count(*)::text AS n FROM public.'+'"'+t.tablename.replaceAll('"','""')+'"');result.push([t.tablename,n[0].n]);}console.log(JSON.stringify(result));}finally{await sql.close();}process.exit(0);`;
function probe(cloud, network, code, input) {
  const args = ['run', '--rm', '-i', '--network', network, '--no-healthcheck', '--entrypoint=bun', cloud ? 'fluentxverse-cloud/api:20261023' : image, '--no-env-file', '-e', code];
  const response = cloud ? ssh('docker ' + args.map(quote).join(' '), { input: JSON.stringify(input), timeout: 120_000 })
    : execFileSync('docker', args, { input: JSON.stringify(input), encoding: 'utf8', timeout: 120_000 });
  return JSON.parse(response);
}
function census(cloud) {
  const result = {};
  for (const [role, dbRole, prefix, network] of [
    ['api', 'memgraph', 'MEMGRAPH', 'app'], ['gmr-engine', 'gmr-engine-memgraph', 'GMR_ENGINE_MEMGRAPH', 'engine'],
    ['gmr-vault', 'gmr-vault-memgraph', 'GMR_VAULT_MEMGRAPH', 'vault'],
  ]) {
    const e = runtime(byRole(role));
    const uri = role === 'api' ? e.MEMGRAPH_URI : e[prefix + '_URI'];
    result[dbRole] = probe(cloud, cloud ? `fluentxverse-cloud_${network}` : Object.keys(byRole(dbRole).NetworkSettings.Networks)[0], graphProbe,
      { uri, user: e[prefix + '_USER'] || '', password: e[prefix + '_PASSWORD'] || '' });
  }
  result.postgres = probe(cloud, cloud ? 'fluentxverse-cloud_app' : Object.keys(byRole('postgres').NetworkSettings.Networks)[0], sqlProbe, { uri: env.DATABASE_URL });
  return result;
}

async function backupVolume(mount) {
  const path = join(backups, mount.target + '.tar.gz.age');
  const tar = spawn('docker', ['run', '--rm', '--network=none', '--user=0', '--entrypoint=/usr/bin/tar',
    '--mount', `type=volume,source=${mount.source},target=/source,readonly`, tarImage, '--numeric-owner', '--sparse', '-C', '/source', '-cf', '-', '.'],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  const encrypt = spawn(age, ['-r', recipient, '-o', path], { stdio: ['pipe', 'ignore', 'inherit'] });
  await Promise.all([exit(tar), exit(encrypt), pipeline(tar.stdout, createGzip({ level: 1 }), encrypt.stdin)]);
  execFileSync(age, ['-d', '-i', identity, path], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 120_000 });
  return { ...mount, filename: mount.target + '.tar.gz.age', sha256: await digest(path) };
}
async function restoreVolume(backup) {
  ssh(`docker volume create ${quote(backup.target)}`);
  const decrypt = spawn(age, ['-d', '-i', identity, join(backups, backup.filename)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const args = ['run', '--rm', '-i', '--network=none', '--user=0', '--entrypoint=/usr/bin/tar',
    '--mount', `type=volume,source=${backup.target},target=/destination`, 'fluentxverse-cloud/gmr-engine-memgraph:20261023', '-xzf', '-', '-C', '/destination'];
  const restore = spawn('ssh', [...sshOptions, cloudTarget, 'docker ' + args.map(quote).join(' ')], { stdio: ['pipe', 'ignore', 'inherit'] });
  await Promise.all([exit(decrypt), exit(restore), pipeline(decrypt.stdout, restore.stdin)]);
}

for (const old of originals) {
  const current = JSON.parse(docker(['inspect', old.Name]))[0];
  if (current.Image !== old.Image || JSON.stringify(current.Config.Env) !== JSON.stringify(old.Config.Env) || !current.State.Running)
    throw Error('A local baseline changed; prepare a new release before migration');
}
for (const volume of mounts) {
  if (ssh(`docker volume ls --filter name=${quote('^' + volume.target + '$')} --format '{{.Name}}'`).trim())
    throw Error('Cloud target volume already exists; reconcile before restoring');
}
execFileSync('node', [join(root, 'scripts/screening-engine-maintenance.mjs')], { stdio: 'inherit' });
docker(['exec', 'fluentxverse-server', 'bun', '--no-env-file', '-e', `import{query,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{const r=await query("SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
const e=await s.run("MATCH(e:Exam) WHERE e.status IN ['active','queued','processing','generating'] AND e.createdAt >= $cutoff RETURN count(e) AS n",{cutoff:new Date(Date.now()-3600000).toISOString()});if(r.rows[0].n>0||Number(e.records[0].get('n'))>0)throw Error('Active lessons or assessments; defer cutover');}finally{await s.close();await closeDriver();await closePool();}`]);
mkdirSync(backups, { mode: 0o700 });
if (!existsSync(identity)) execFileSync(keygen, ['-o', identity], { stdio: ['ignore', 'ignore', 'inherit'] });
const recipient = execFileSync(keygen, ['-y', identity], { encoding: 'utf8' }).trim();
save(join(state, 'backup-recipient.json'), { recipient });
let fenced = false, cloudWritersStarted = false;
try {
  checkpoint('fencing-local');
  hostUnit('disable', '--now', 'cloudflared'); fenced = true;
  docker(['update', '--restart=no', ...originals.map(c => c.Name.slice(1))]);
  docker(['stop', '--time=60', ...['api', 'gmr-engine', 'gmr-vault'].map(role => byRole(role).Name.slice(1))]);
  const before = census(false); save(join(output, 'source-census.json'), before);
  const databases = ['seaweed-filer', 'seaweed-volume', 'seaweed-master', 'redis', 'postgres', 'memgraph', 'gmr-engine-memgraph', 'gmr-vault-memgraph'];
  docker(['stop', '--time=60', ...databases.map(role => byRole(role).Name.slice(1))]);
  checkpoint('local-stopped-consistent-backup');
  const backupRecords = [];
  for (const mount of mounts) { backupRecords.push(await backupVolume(mount)); console.log(`Encrypted consistent backup: ${mount.role} ${mount.destination}`); }
  save(join(backups, 'manifest.json'), { createdAt: new Date().toISOString(), format: 'GNU-tar+gzip+age', volumes: backupRecords });
  // Include private runtime configuration, encryption keys and proving/config binds in the encrypted recovery set.
  const bundle = spawn('tar', ['-C', state, '-cf', '-', 'package'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const encrypt = spawn(age, ['-r', recipient, '-o', join(backups, 'runtime.tar.gz.age')], { stdio: ['pipe', 'ignore', 'inherit'] });
  await Promise.all([exit(bundle), exit(encrypt), pipeline(bundle.stdout, createGzip({ level: 1 }), encrypt.stdin)]);
  execFileSync(age, ['-d', '-i', identity, join(backups, 'runtime.tar.gz.age')], { stdio: ['ignore', 'ignore', 'inherit'] });
  ssh('install -d -m 700 /opt/fluentxverse/backups/migration-20261023');
  execFileSync('rsync', ['-a', '-e', ['ssh', ...sshOptions.map(quote)].join(' '), backups + '/', `${cloudTarget}:/opt/fluentxverse/backups/migration-20261023/`], { stdio: 'inherit' });
  for (const backup of backupRecords) {
    if (ssh(`sha256sum ${quote('/opt/fluentxverse/backups/migration-20261023/' + backup.filename)}`).split(' ')[0] !== backup.sha256)
      throw Error('Encrypted backup transfer checksum mismatch');
    await restoreVolume(backup); console.log(`Restored private cloud volume: ${backup.role} ${backup.destination}`);
  }
  checkpoint('cloud-data-restored');
  ssh(`${compose} up -d --no-deps --wait --wait-timeout 180 postgres redis memgraph gmr-engine-memgraph gmr-vault-memgraph seaweed-master`, { stdio: 'inherit', timeout: 240_000 });
  ssh(`${compose} up -d --no-deps --wait --wait-timeout 180 seaweed-volume seaweed-filer`, { stdio: 'inherit', timeout: 240_000 });
  const after = census(true); save(join(output, 'cloud-census.json'), after); assert.deepEqual(after, before, 'Restored database counts differ');
  checkpoint('database-restore-verified');
  // From here cloud jobs may write. A stale-local automatic rollback would lose those writes.
  cloudWritersStarted = true; checkpoint('cloud-writers-starting');
  ssh(`${compose} up -d --wait --wait-timeout 300`, { stdio: 'inherit', timeout: 360_000 });
  execFileSync('node', [join(root, 'scripts/activate-cloud-primary.mjs')], { stdio: 'inherit', timeout: 12 * 60_000 });
} catch (error) {
  save(join(output, 'migration-failure.json'), { failedAt: new Date().toISOString(), cloudWritersStarted,
    error: String(error.message).slice(0, 300), staleLocalMustNotRestart: cloudWritersStarted });
  if (!cloudWritersStarted && fenced) {
    for (const c of originals) docker(['update', `--restart=${c.HostConfig.RestartPolicy.Name}`, c.Name.slice(1)]);
    for (const role of ['memgraph', 'postgres', 'redis', 'gmr-engine-memgraph', 'gmr-vault-memgraph', 'seaweed-master', 'seaweed-volume', 'seaweed-filer', 'gmr-vault', 'gmr-engine', 'api'])
      docker(['start', byRole(role).Name.slice(1)]);
    hostUnit('enable', '--now', 'cloudflared'); checkpoint('rolled-back-before-cloud-writes');
  }
  throw error;
}
