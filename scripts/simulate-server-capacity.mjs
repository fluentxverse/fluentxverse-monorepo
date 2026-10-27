import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = resolve(root, '../budol/gmr-engine');
const artifactPath = join(engine, 'zk/screening/releases/self-operated-20261022');
const output = join(root, 'output/capacity', new Date().toISOString().replaceAll(':', '-'));
mkdirSync(output, { recursive: true });
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const image = docker(['inspect', 'fluentxverse-server', '--format', '{{.Image}}']).trim();
const network = `capacity-${process.pid}`;
const created = [], volumes = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mib = n => Math.round(n / 1024 / 1024 * 10) / 10;
function stats(name) {
  return new Promise((resolve, reject) => {
    const request = http.get({ socketPath: '/var/run/docker.sock', path: `/containers/${name}/stats?stream=false&one-shot=true` }, response => {
      let body = ''; response.on('data', chunk => body += chunk);
      response.on('end', () => { try { if (response.statusCode !== 200) throw Error('Docker stats unavailable'); resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    request.setTimeout(3000, () => request.destroy(Error('Docker stats timeout'))); request.on('error', reject);
  });
}
function run(name, args) {
  docker(['run', '-d', '--name', name, '--network', network, '--network-alias', name, ...args]);
  created.push(name);
}
function remove() {
  for (const name of created.splice(0).reverse()) docker(['rm', '-f', name]);
  for (const name of volumes.splice(0)) docker(['volume', 'rm', name]);
}
const disk = docker(['system', 'df']);
const results = [];
docker(['network', 'create', '--internal', network]);
try {
  for (const rooms of [0, 10, 25, 50]) {
    const names = ['capacity-memgraph', 'capacity-postgres', 'capacity-workload'];
    for (const suffix of ['mg', 'pg']) { const name = `${network}-${rooms}-${suffix}`; docker(['volume', 'create', name]); volumes.push(name); }
    run(names[0], ['--cpus=.35', '--memory=512m', '--memory-swap=512m', '--mount', `type=volume,source=${volumes[0]},target=/var/lib/memgraph`,
      'memgraph/memgraph:latest', '--memory-limit=384', '--log-level=WARNING']);
    run(names[1], ['--cpus=.15', '--memory=256m', '--memory-swap=256m',
      '-e', 'POSTGRES_USER=capacity', '-e', 'POSTGRES_PASSWORD=capacity', '-e', 'POSTGRES_DB=capacity',
      '--mount', `type=volume,source=${volumes[1]},target=/var/lib/postgresql/data`, 'postgres:16-alpine']);
    let ready = false;
    for (let n = 0; n < 60; n++) {
      try { docker(['exec', names[1], 'pg_isready', '-h', '127.0.0.1', '-U', 'capacity', '-d', 'capacity']); ready = true; break; } catch { await sleep(500); }
    }
    if (!ready) throw Error('Isolated PostgreSQL failed to start');
    const mounts = [
      ['fluentxverse-server/tests/capacity.workload.ts', '/app/tests/capacity.workload.ts'],
      ['fluentxverse-server/tests/screening.fixture.ts', '/app/tests/screening.fixture.ts'],
      ['fluentxverse-server/tests/application.fixtures.ts', '/app/tests/application.fixtures.ts'],
    ].flatMap(([source, target]) => ['--mount', `type=bind,source=${join(root, source)},target=${target},readonly`]);
    for (const [source, target] of [[join(engine, 'scripts'), '/engine/scripts'], [join(engine, 'node_modules'), '/engine/node_modules'], [artifactPath, '/artifacts']])
      mounts.push('--mount', `type=bind,source=${source},target=${target},readonly`);
    // No production environment, credentials, network membership, or published ports.
    run(names[2], ['--cpus=1.5', '--memory=1536m', '--memory-swap=1536m', '--no-healthcheck', '--user', `${process.getuid()}:${process.getgid()}`,
      '-e', 'CAPACITY_ISOLATED=yes', '-e', `CAPACITY_ROOMS=${rooms}`, '-e', 'CAPACITY_SECONDS=30',
      '-e', 'DATABASE_URL=postgres://capacity:capacity@capacity-postgres:5432/capacity',
      '-e', 'MEMGRAPH_URI=bolt://capacity-memgraph:7687', '-e', 'MEMGRAPH_USER=', '-e', 'MEMGRAPH_PASSWORD=',
      ...mounts, image, 'bun', '--no-env-file', '/app/tests/capacity.workload.ts']);
    const samples = [], previous = new Map();
    const wait = spawn('docker', ['wait', names[2]], { stdio: ['ignore', 'pipe', 'pipe'] });
    let done = false, exitCode = '';
    wait.stdout.on('data', data => exitCode += data); wait.on('close', () => done = true);
    const timeout = Date.now() + 240_000;
    while (!done && Date.now() < timeout) {
      const perContainer = {};
      for (const name of names) {
        const s = await stats(name), at = Date.now();
        const before = previous.get(name), cpu = s.cpu_stats.cpu_usage.total_usage;
        const cpuCores = before ? Math.max(0, (cpu - before.cpu) / ((at - before.at) * 1e6)) : 0;
        previous.set(name, { cpu, at });
        const io = s.blkio_stats?.io_service_bytes_recursive || [];
        perContainer[name] = { memoryBytes: s.memory_stats.usage || 0,
          workingSetBytes: Math.max(0, (s.memory_stats.usage || 0) - (s.memory_stats.stats?.inactive_file || s.memory_stats.stats?.total_inactive_file || 0)),
          cpuCores, readBytes: io.filter(x => x.op === 'read' || x.op === 'Read').reduce((n, x) => n + x.value, 0),
          writeBytes: io.filter(x => x.op === 'write' || x.op === 'Write').reduce((n, x) => n + x.value, 0) };
      }
      samples.push({ at: new Date().toISOString(), containers: perContainer }); await sleep(250);
    }
    if (!done) { wait.kill(); throw Error('Workload timed out'); }
    const logs = docker(['logs', names[2]]);
    writeFileSync(join(output, `${rooms}-rooms.log`), logs);
    writeFileSync(join(output, `${rooms}-samples.json`), JSON.stringify(samples, null, 2));
    const workload = logs.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).find(x => x?.event === 'result');
    const states = JSON.parse(docker(['inspect', ...names])).map(x => ({ name: x.Name, oomKilled: x.State.OOMKilled, exitCode: x.State.ExitCode }));
    const sum = (sample, field) => Object.values(sample.containers).reduce((n, s) => n + s[field], 0);
    const resourcePeaks = { sampledMemoryMiB: mib(Math.max(...samples.map(s => sum(s, 'memoryBytes')))),
      sampledWorkingSetMiB: mib(Math.max(...samples.map(s => sum(s, 'workingSetBytes')))),
      sampledCpuCores: Math.max(...samples.map(s => sum(s, 'cpuCores'))),
      blockReadMiB: mib(Math.max(...samples.map(s => sum(s, 'readBytes')))),
      blockWriteMiB: mib(Math.max(...samples.map(s => sum(s, 'writeBytes')))) };
    const stored = docker(['exec', names[0], 'du', '-sk', '/var/lib/memgraph']).trim();
    const result = { rooms, resourcePeaks, states, workload, memgraphDisk: stored, success: exitCode.trim() === '0' && Boolean(workload) };
    results.push(result); console.log(JSON.stringify(result));
    writeFileSync(join(output, 'report.json'), JSON.stringify({ image, output, cpuQuotaCores: 2, containerMemoryLimitsMiB: 2304,
      host: { cpu: readFileSync('/proc/cpuinfo', 'utf8').match(/model name\s+: (.+)/)?.[1], kernel: execFileSync('uname', ['-r'], { encoding: 'utf8' }).trim() },
      baselineDockerDisk: disk, productionArtifactDirectoryKiB: execFileSync('du', ['-sk', artifactPath], { encoding: 'utf8' }).trim(),
      workloadDescription: 'Real production-image classroom service methods plus three sequential real Groth16 proofs per phase. 5s reads/presence, 10s notes/marks, one reconnect per student. No media/auth/Socket.IO or external requests.',
      samplingIntervalMs: 250, results }, null, 2));
    remove();
    if (!result.success) throw Error(`Workload failed at ${rooms} rooms; inspect saved logs`);
  }
  console.log(`Report: ${join(output, 'report.json')}`);
} finally { remove(); docker(['network', 'rm', network]); }
