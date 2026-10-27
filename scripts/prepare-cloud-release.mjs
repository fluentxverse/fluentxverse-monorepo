import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, createReadStream, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { literalComposeEnvironment } from './lib/mail-runtime-env.mjs';
import { ssh, sshOptions, cloudTarget, quote } from './lib/cloud-ssh.mjs';
import { imageContentIdentity } from './lib/cloud-verification.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = '20261023', state = join(homedir(), `.local/state/fluentxverse/cloud-${release}`);
const output = join(root, 'output/cloud', release), pkg = join(state, 'package');
const remote = `/opt/fluentxverse/releases/${release}`;
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
mkdirSync(state, { recursive: true, mode: 0o700 }); chmodSync(state, 0o700);
mkdirSync(output, { recursive: true });
const roles = [
  ['api', 'fluentxverse-server', 1024, 'app'], ['gmr-engine', 'budol-gmr-engine-1', 2048, 'engine'],
  ['gmr-vault', 'budol-gmr-vault-1', 128, 'vault'], ['memgraph', 'fluentxverse-memgraph', 1536, 'app'],
  ['postgres', 'fluentxverse-postgres', 384, 'app'], ['redis', 'fluentxverse-redis', 128, 'app'],
  ['seaweed-master', 'fluentxverse-seaweed-master', 96, 'app'], ['seaweed-volume', 'fluentxverse-seaweed-volume', 192, 'app'],
  ['seaweed-filer', 'fluentxverse-seaweed-filer', 192, 'app'],
  ['gmr-engine-memgraph', 'budol-gmr-engine-memgraph-1', 384, 'engine'], ['gmr-vault-memgraph', 'budol-gmr-vault-memgraph-1', 384, 'vault'],
];
if (process.argv.includes('--capture')) {
  if (existsSync(join(state, 'inventory.private.json'))) throw Error('Release exists; inspect it instead of overwriting');
  mkdirSync(pkg, { mode: 0o700 });
  const originals = JSON.parse(docker(['inspect', ...roles.map(x => x[1])]));
  save(join(state, 'inventory.private.json'), originals);
  const compose = { name: 'fluentxverse-cloud', services: {}, volumes: {}, networks: { app: {}, engine: {}, vault: {} } };
  const mounts = [], images = [], summary = [];
  for (const [index, [role, name, memory, network]] of roles.entries()) {
    const old = originals[index];
    if (old.State.Running !== true) throw Error(`Baseline container ${name} is not running`);
    const image = `fluentxverse-cloud/${role}:${release}`;
    docker(['tag', old.Image, image]); images.push(image);
    const runtime = Object.fromEntries(old.Config.Env.map(v => { const i = v.indexOf('='); return [v.slice(0, i), v.slice(i + 1)]; }));
    for (const [key, value] of Object.entries(runtime)) {
      if (key.endsWith('API_BASE')) runtime[key] = value.replace('host.docker.internal:8090', 'gmr-engine:8090');
    }
    if (role === 'api') runtime.ANONYMOUS_REVIEW_TALLY_ENABLED = 'false';
    const aliases = [...new Set([name, ...Object.values(old.NetworkSettings.Networks).flatMap(n => n.Aliases || [])])]
      .filter(x => !/^[a-f0-9]{12,64}$/.test(x));
    const serviceNetworks = { [network]: { aliases } };
    if (role === 'api') serviceNetworks.engine = {};
    if (role === 'gmr-engine') serviceNetworks.vault = {};
    const service = { image, container_name: name, restart: 'unless-stopped', init: true,
      environment: literalComposeEnvironment(runtime), mem_limit: `${memory}m`, memswap_limit: `${memory}m`,
      pids_limit: role === 'gmr-engine' ? 192 : 128, security_opt: ['no-new-privileges:true'],
      logging: { driver: 'local', options: { 'max-size': '10m', 'max-file': '3' } },
      networks: serviceNetworks, volumes: [],
      ...(old.Config.User ? { user: old.Config.User } : {}),
      ...(old.Config.WorkingDir ? { working_dir: old.Config.WorkingDir } : {}),
      ...(old.Config.Entrypoint ? { entrypoint: old.Config.Entrypoint } : {}),
      ...(old.Config.Cmd ? { command: old.Config.Cmd } : {}) };
    if (role.includes('memgraph')) service.command = [`--memory-limit=${role === 'memgraph' ? 1024 : 256}`, '--log-level=WARNING'];
    if (old.Config.Healthcheck) service.healthcheck = { test: old.Config.Healthcheck.Test, interval: '30s', timeout: '10s', start_period: '60s', retries: 5 };
    else if (role.includes('memgraph')) service.healthcheck = { test: ['CMD-SHELL', "timeout 2 bash -c '</dev/tcp/127.0.0.1/7687'"], interval: '10s', timeout: '3s', retries: 12 };
    if (role === 'api') service.ports = ['127.0.0.1:8765:8765', '127.0.0.1:8767:8767'];
    if (role === 'gmr-engine') service.ports = ['127.0.0.1:8090:8090'];
    if (role === 'api') service.depends_on = Object.fromEntries(['memgraph', 'postgres', 'redis', 'seaweed-filer', 'gmr-engine'].map(x => [x, { condition: 'service_healthy' }]));
    if (role === 'gmr-engine') service.depends_on = { 'gmr-engine-memgraph': { condition: 'service_healthy' }, 'gmr-vault': { condition: 'service_healthy' } };
    if (role === 'gmr-vault') service.depends_on = { 'gmr-vault-memgraph': { condition: 'service_healthy' } };
    if (role === 'seaweed-volume') service.depends_on = { 'seaweed-master': { condition: 'service_healthy' } };
    if (role === 'seaweed-filer') service.depends_on = { 'seaweed-master': { condition: 'service_healthy' }, 'seaweed-volume': { condition: 'service_healthy' } };
    for (const [i, mount] of old.Mounts.entries()) {
      if (mount.Type === 'volume') {
        const volume = `fxv-cloud-${role}-${i}`;
        compose.volumes[volume] = { external: true, name: volume };
        service.volumes.push({ type: 'volume', source: volume, target: mount.Destination, read_only: !mount.RW });
        mounts.push({ role, source: mount.Name, target: volume, destination: mount.Destination });
      } else if (mount.Type === 'bind') {
        const relative = `shared/${role}-${i}`, target = join(pkg, relative);
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
        if (statSync(mount.Source).isDirectory()) {
          mkdirSync(target, { recursive: true, mode: 0o700 });
          const helper = ['run', '--rm', '--network=none', '--user=0', '--security-opt=label=disable',
            '--mount', `type=bind,source=${mount.Source},target=/source,readonly`,
            '--mount', `type=bind,source=${target},target=/destination`, 'redis:7-alpine'];
          docker([...helper, 'cp', '-a', '/source/.', '/destination/']);
          docker([...helper, 'chown', '-R', `${process.getuid()}:${process.getgid()}`, '/destination']);
        } else cpSync(mount.Source, target);
        service.volumes.push({ type: 'bind', source: './' + relative, target: mount.Destination,
          read_only: !mount.RW || mount.Destination === '/app/config' || mount.Destination.endsWith('/releases'),
          bind: { create_host_path: false, selinux: 'Z' } });
      } else throw Error('Unsupported mount; inspect before migration');
    }
    compose.services[role] = service;
    summary.push({ role, name, image, imageId: old.Image, memoryLimitMiB: memory });
  }
  save(join(pkg, 'compose.private.json'), compose);
  save(join(state, 'mounts.json'), mounts);
  save(join(state, 'images.json'), images);
  save(join(output, 'inventory.json'), { capturedAt: new Date().toISOString(), release, host: '185.184.223.23',
    services: summary, memoryLimitsMiB: roles.reduce((n, x) => n + x[2], 0),
    localDataVolumeCount: mounts.length, reviewProverOnCloud: false, publicTrafficChanged: false });
  docker(['compose', '-f', join(pkg, 'compose.private.json'), 'config', '--quiet']);
  console.log(`Captured ${roles.length} running services and ${mounts.length} data mounts; no application state changed.`);
}
if (process.argv.includes('--images')) {
  if (existsSync(join(state, 'images.tar.gz'))) throw Error('Image archive already exists');
  const child = spawn('docker', ['image', 'save', ...JSON.parse(readFileSync(join(state, 'images.json')))], { stdio: ['ignore', 'pipe', 'inherit'] });
  const exited = new Promise((resolve, reject) => child.on('close', code => code === 0 ? resolve() : reject(Error('Image export failed'))));
  await Promise.all([pipeline(child.stdout, createGzip({ level: 1 }), createWriteStream(join(state, 'images.tar.gz'), { mode: 0o600, flags: 'wx' })), exited]);
  console.log('Pinned image archive prepared privately.');
}
if (process.argv.includes('--send')) {
  ssh(`install -d -m 700 ${quote(remote)}`);
  execFileSync('rsync', ['-a', '--info=stats2', '-e', ['ssh', ...sshOptions.map(quote)].join(' '), pkg + '/', `${cloudTarget}:${remote}/`], { stdio: 'inherit' });
  execFileSync('rsync', ['-a', '--info=stats2', '-e', ['ssh', ...sshOptions.map(quote)].join(' '), join(state, 'images.tar.gz'), `${cloudTarget}:${remote}/images.tar.gz`], { stdio: 'inherit' });
  const archiveHash = createHash('sha256');
  for await (const chunk of createReadStream(join(state, 'images.tar.gz'))) archiveHash.update(chunk);
  const digest = archiveHash.digest('hex');
  const remoteDigest = ssh(`sha256sum ${quote(remote + '/images.tar.gz')}`).split(' ')[0];
  if (digest !== remoteDigest) throw Error('Image transfer checksum mismatch');
  ssh(`docker load --input ${quote(remote + '/images.tar.gz')}`, { stdio: 'inherit', timeout: 20 * 60_000 });
  save(join(state, 'archive-transfer.json'), { archiveSHA256: digest });
}
if (process.argv.includes('--send') || process.argv.includes('--verify-staged')) {
  if (!existsSync(join(state, 'archive-transfer.json'))) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(join(state, 'images.tar.gz'))) hash.update(chunk);
    const archiveSHA256 = hash.digest('hex');
    if (ssh(`sha256sum ${quote(remote + '/images.tar.gz')}`).split(' ')[0] !== archiveSHA256) throw Error('Image transfer checksum mismatch');
    save(join(state, 'archive-transfer.json'), { archiveSHA256 });
  }
  const expected = JSON.parse(readFileSync(join(output, 'inventory.json'))), verified = [];
  for (const service of expected.services) {
    const local = JSON.parse(docker(['image', 'inspect', service.image]))[0];
    const cloud = JSON.parse(ssh(`docker image inspect ${quote(service.image)}`))[0];
    if (imageContentIdentity(local) !== imageContentIdentity(cloud)) throw Error(`Image content/config mismatch for ${service.role}`);
    verified.push({ role: service.role, sourceImageId: local.Id, cloudImageId: cloud.Id,
      contentSHA256: createHash('sha256').update(imageContentIdentity(local)).digest('hex') });
  }
  ssh(`docker compose -f ${quote(remote + '/compose.private.json')} config --quiet`);
  save(join(output, 'images-staged.json'), { stagedAt: new Date().toISOString(),
    archiveSHA256: JSON.parse(readFileSync(join(state, 'archive-transfer.json'))).archiveSHA256,
    imageIdsVerified: true, note: 'Docker classic vs containerd image stores may expose different manifest IDs; exact layers and runtime image configuration verified.',
    verified, publicTrafficChanged: false, dataRestored: false });
  console.log('Exact running image contents and private runtime configuration staged on cloud; no services started.');
}
