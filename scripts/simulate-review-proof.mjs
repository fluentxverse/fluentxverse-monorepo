import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/capacity', `review-${new Date().toISOString().replaceAll(':', '-')}`);
mkdirSync(output, { recursive: true });
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const image = docker(['inspect', 'fluentxverse-server', '--format', '{{.Image}}']).trim();
const proverImage = docker(['inspect', 'fluentxverse-server-review-tally-prover-1', '--format', '{{.Image}}']).trim();
const name = `capacity-review-${process.pid}`;
const memoryMiB = Number(process.env.CAPACITY_REVIEW_MEMORY_MIB || 1536);
if (![1536, 2048, 3072, 4096, 6144].includes(memoryMiB)) throw Error('Use an approved bounded memory limit');
const witness = docker(['run', '--rm', '--network=none', '--no-healthcheck', '--cpus=.5', '--memory=512m', '--memory-swap=512m',
  '--mount', `type=bind,source=${join(root, 'fluentxverse-server/tests/reviewTally.fixture.ts')},target=/app/tests/reviewTally.fixture.ts,readonly`,
  image, 'bun', '--no-env-file', '/app/tests/reviewTally.fixture.ts']);
writeFileSync(join(output, 'synthetic-input.json'), witness, { mode: 0o600 });
const script = `
const start = performance.now();
const child = Bun.spawn(['/app/review-tally-host', 'prove'], {
  stdin: Bun.file('/input.json'), stdout: 'pipe', stderr: 'pipe',
  env: { PATH: process.env.PATH, HOME: '/tmp', RISC0_DEV_MODE: '0', RAYON_NUM_THREADS: '2' }
});
const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
const cgroupMemoryEvents = await Bun.file('/sys/fs/cgroup/memory.events').text();
const cgroupPeakMemoryBytes = Number(await Bun.file('/sys/fs/cgroup/memory.peak').text());
if (code !== 0) { console.log(JSON.stringify({ event: 'result', success: false, code, cgroupMemoryEvents, cgroupPeakMemoryBytes, durationMs: performance.now() - start })); process.exit(1); }
const proof = JSON.parse(stdout);
if (proof.localVerified !== true || proof.proofSystem !== 'risc0' || proof.version !== 'V2_3') process.exit(2);
console.log(JSON.stringify({ event: 'result', success: true, durationMs: performance.now() - start,
  cgroupMemoryEvents, cgroupPeakMemoryBytes,
  proofSystem: proof.proofSystem, localVerified: proof.localVerified, proofBytes: (proof.proof.length - 2) / 2 }));`;
function stats() {
  return new Promise((resolve, reject) => {
    const r = http.get({ socketPath: '/var/run/docker.sock', path: `/containers/${name}/stats?stream=false&one-shot=true` }, response => {
      let body = ''; response.on('data', x => body += x);
      response.on('end', () => { try { if (response.statusCode !== 200) throw Error('Stats unavailable'); resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    r.setTimeout(3000, () => r.destroy(Error('Stats timeout'))); r.on('error', reject);
  });
}
let created = false;
try {
  docker(['run', '-d', '--name', name, '--network=none', '--no-healthcheck', '--cpus=1.5', `--memory=${memoryMiB}m`, `--memory-swap=${memoryMiB}m`,
    '--read-only', '--tmpfs', '/tmp:rw,size=128m', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--user', `${process.getuid()}:${process.getgid()}`,
    '--mount', `type=bind,source=${join(output, 'synthetic-input.json')},target=/input.json,readonly`,
    proverImage, 'bun', '--no-env-file', '-e', script]);
  created = true;
  const samples = [];
  let done = false, timeout = false, prior, exitCode = '';
  const wait = spawn('docker', ['wait', name]);
  wait.stdout.on('data', x => exitCode += x); wait.on('close', () => done = true);
  const deadline = Date.now() + 180_000;
  while (!done) {
    if (Date.now() > deadline) { timeout = true; docker(['kill', name]); break; }
    const s = await stats(), at = Date.now(), cpu = s.cpu_stats.cpu_usage.total_usage;
    samples.push({ at, memoryBytes: s.memory_stats.usage || 0,
      workingSetBytes: Math.max(0, (s.memory_stats.usage || 0) - (s.memory_stats.stats?.inactive_file || 0)),
      cpuCores: prior ? Math.max(0, (cpu - prior.cpu) / ((at - prior.at) * 1e6)) : 0 });
    prior = { at, cpu }; await new Promise(resolve => setTimeout(resolve, 250));
  }
  await new Promise(resolve => { if (done) resolve(); else wait.once('close', resolve); });
  const logs = docker(['logs', name]);
  const state = JSON.parse(docker(['inspect', name]))[0].State;
  const result = logs.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).find(x => x?.event === 'result');
  const report = { inputReviews: 5, image: proverImage, cpuLimit: 1.5, memoryLimitMiB: memoryMiB, timeout, exitCode: exitCode.trim(),
    oomKilled: state.OOMKilled, result, sampledPeakMemoryMiB: Math.max(...samples.map(x => x.memoryBytes)) / 1048576,
    sampledPeakWorkingSetMiB: Math.max(...samples.map(x => x.workingSetBytes)) / 1048576,
    sampledPeakCpuCores: Math.max(...samples.map(x => x.cpuCores)),
    limitations: ['Smallest valid synthetic five-review tally; not a full monthly tally', 'Proof only, not concurrent classroom activity', '180 second wall-clock bound; timeout does not mean the proof is mathematically invalid'] };
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(output, 'samples.json'), JSON.stringify(samples));
  writeFileSync(join(output, 'workload.log'), logs);
  console.log(JSON.stringify(report)); console.log(`Report: ${join(output, 'report.json')}`);
} finally { if (created) docker(['rm', '-f', name]); }
