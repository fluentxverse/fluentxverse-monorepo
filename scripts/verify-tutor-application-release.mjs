import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/release/tutor-application-20261022');
const manifest = JSON.parse(readFileSync(join(output, 'source-manifest.json')));
const frontend = join(output, 'frontend');
const hash = value => createHash('sha256').update(value).digest('hex');
for (const [file, expected] of Object.entries(manifest.files)) if (hash(readFileSync(join(output, file))) !== expected) throw Error('Prepared source changed.');
const live = JSON.parse(execFileSync('docker', ['inspect', 'fluentxverse-server']))[0];
if (live.Image !== manifest.baseImageId) throw Error('Live API baseline changed.');
const env = Object.fromEntries(live.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
if (!env.OPENAI_API_KEY) throw Error('A configured transcription/grading provider is required.');
const net = 'fxv-application-release-qa', mg = 'fxv-application-qa-memgraph', pg = 'fxv-application-qa-postgres';
const privateDir = join(homedir(), '.local/state/fluentxverse', `application-qa-${Date.now()}`);
mkdirSync(privateDir, { recursive: true, mode: 0o700 }); chmodSync(privateDir, 0o700);
const envFile = join(privateDir, 'provider.env');
const provider = { NODE_ENV: 'test', APPLICATION_RELEASE_PROBE: 'isolated-real-provider', MEMGRAPH_URI: 'bolt://127.0.0.1:17706',
  MEMGRAPH_USER: '', MEMGRAPH_PASSWORD: 'qa', DATABASE_URL: `postgresql://fixture:fixture@${pg}:5432/unused`,
  JWT_SECRET: randomBytes(32).toString('hex'), SCREENING_EVIDENCE_KEY_HEX: randomBytes(32).toString('hex'),
  OPENAI_API_KEY: env.OPENAI_API_KEY, SCREENING_ENABLED: 'false', LESSON_PASSES_ENABLED: 'false', ANONYMOUS_REVIEW_TALLY_ENABLED: 'false',
  LESSON_BOOKING_MODE: 'paid', QA_RECORDING_ENABLED: 'false', TURN_PROVIDER: 'none', API_PUBLIC_URL: 'http://127.0.0.1:8765',
  GMR_ENGINE_BASE_URL: 'http://127.0.0.1:1', CLASSROOM_MEDIA_PROVIDER: 'webrtc' };
writeFileSync(envFile, Object.entries(provider).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
execFileSync('espeak-ng', ['-w', join(privateDir, 'response.wav'), 'The past tense describes an action that happened before now. For example, yesterday I walked to school. Regular verbs often add the letters E and D. I would ask the student to give an example and offer supportive feedback.']);
const results = [];
async function run(label, command, args, cwd = root, overrides = {}) {
  console.log(`[release] ${label}`); const started = Date.now();
  const code = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...overrides }, stdio: 'inherit' });
    child.once('error', reject); child.once('exit', code => resolve(code));
  });
  results.push({ label, passed: code === 0, durationMs: Date.now() - started });
  if (code !== 0) throw Error(`Release check failed: ${label}`);
}
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
let preview, createdNetwork = false, createdMg = false, createdPg = false;
try {
  docker(['network', 'create', net]); createdNetwork = true;
  docker(['run', '-d', '--rm', '--name', mg, '--network', net, '--label', 'fluentxverse.qa=tutor-application-release', 'memgraph/memgraph:latest', '--bolt-port=17706']); createdMg = true;
  docker(['run', '-d', '--rm', '--name', pg, '--network', net, '--label', 'fluentxverse.qa=tutor-application-release',
    '-e', 'POSTGRES_USER=fixture', '-e', 'POSTGRES_PASSWORD=fixture', '-e', 'POSTGRES_DB=unused',
    '-v', `${join(root, 'fluentxverse-server/init.sql')}:/docker-entrypoint-initdb.d/init.sql:ro`, 'postgres:16-alpine']); createdPg = true;
  await run('release-image policy and cryptographic regression tests', 'docker', ['run', '--rm', '--network=none', '-e', 'NODE_ENV=test', `${manifest.image}-test`, 'bun', 'test',
    'tests/applicationPolicy.test.ts', 'tests/screening.test.ts', 'tests/screening.http.test.ts', 'tests/zkSecurity.test.ts', 'tests/anonymousReviews.http.test.ts', 'tests/lessonPasses.http.test.ts']);
  await run('release-image persistence, fault injection, concurrency and HTTP tests', 'docker', ['run', '--rm', '--network', `container:${mg}`, '-e', 'NODE_ENV=test',
    '-e', 'APPLICATION_TEST_URI=bolt://127.0.0.1:17706', `${manifest.image}-test`, 'bun', 'test', './tests/application.persistence.ts']);
  await run('clear disposable fixtures before the independent provider pilot', 'docker', ['run', '--rm', '--network', `container:${mg}`, `${manifest.image}-test`, 'bun', '-e',
    "import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver('bolt://127.0.0.1:17706','','',1);const s=getDriver().session();try{await s.run('MATCH(n) DETACH DELETE n');}finally{await s.close();await closeDriver();}"]);
  await run('real provider and automatic worker pilot on isolated synthetic data', 'docker', ['run', '--rm', '--network', `container:${mg}`, '--env-file', envFile,
    '-v', `${join(privateDir, 'response.wav')}:/probe/response.wav:ro`, `${manifest.image}-test`, 'bun', 'run', 'tests/application.production.probe.ts']);
  await run('tutor frontend unit tests', 'bun', ['run', 'test'], frontend);
  await run('tutor production build', 'bun', ['run', 'build'], frontend, { VITE_TUTOR_API_URL: 'https://api.fluentxverse.com', VITE_SOCKET_URL: 'https://ws.fluentxverse.com' });
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  preview = spawn('bunx', ['--no-install', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: frontend, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; ; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* Wait for the built frontend. */ }
    if (i >= 100 || preview.exitCode !== null) throw Error('Release preview did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await run('production-build desktop/mobile application flow', 'node', ['tests/browser/applicationFlow.cjs'], frontend, { TUTOR_TEST_URL: url });
  await run('production hosting and anonymous-auth boundaries', 'node', ['tests/production-hosting.cjs'], frontend, { TUTOR_TEST_URL: url, TUTOR_HOSTING_FIXTURES: 'true' });
  await run('existing knowledge-base regression', 'node', ['tests/browser/knowledgeBase.cjs'], frontend, { TUTOR_TEST_URL: url, KB_TEST_WIDTHS: '1440,375,320' });
  const index = readFileSync(join(frontend, 'dist/index.html'));
  writeFileSync(join(output, 'verification.json'), JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), imageId: JSON.parse(docker(['image', 'inspect', manifest.image]))[0].Id,
    frontendIndexSha256: hash(index), results }, null, 2));
  console.log('PASS exact release image, real provider pipeline and built frontend verified.');
} finally {
  if (preview && preview.exitCode === null) { const stopped = new Promise(resolve => preview.once('exit', resolve)); preview.kill('SIGTERM'); await stopped; }
  if (createdPg) docker(['stop', pg]);
  if (createdMg) docker(['stop', mg]);
  if (createdNetwork) docker(['network', 'rm', net]);
  rmSync(envFile, { force: true }); rmSync(join(privateDir, 'response.wav'), { force: true });
}
