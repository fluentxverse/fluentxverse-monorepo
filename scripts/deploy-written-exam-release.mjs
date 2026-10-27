import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';

const root = process.cwd(), id = 'written-exam-quality-20261026', release = join(root, 'output/release', id);
const prior = join(root, 'output/release/tutor-email-confirmation-20261026');
const tutor = 'fluentxverse-tutor-solid-prototype', previousAPI = 'fluentxverse-cloud/api:tutor-email-confirmation-20261026';
const previousTutor = 'f888302b-cbb6-415c-acfb-dae6d4273232', image = 'fluentxverse-cloud/api:' + id;
const stage = '/opt/fluentxverse/releases/' + id, composePath = '/opt/fluentxverse/releases/20261023/compose.private.json';
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, ...options });
const save = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true }); };
const wrangler = args => run('npx', ['wrangler', ...args, '--config', 'wrangler.jsonc'], { cwd: join(release, 'frontend', tutor), env: { ...process.env, CI: '1' } });
const currentTutor = () => [...wrangler(['deployments', 'list']).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)].at(-1)?.[1];
const imageId = () => JSON.parse(ssh(`docker image inspect ${image} --format '{{json .Id}}'`));

if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'manifest.json'))) throw Error('Release already prepared');
  if (JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Config.Image}}'")) !== previousAPI) throw Error('API baseline changed');
  const path = 'src/services/exam.services/exam.service.ts';
  if (ssh('docker exec fluentxverse-server cat ' + quote('/app/' + path)) !== readFileSync(join(prior, 'api', path), 'utf8')) throw Error('Exam baseline changed');
  for (const path of ['src/services/exam.services/exam.service.ts', 'src/services/exam.services/applicationPolicy.ts', 'src/services/exam.services/writtenQuality.ts', 'tests/writtenQuality.test.ts', 'tests/application.fixtures.ts', 'tests/applicationPolicy.test.ts'])
    copy(join(root, 'fluentxverse-server', path), join(release, 'api', path));
  save(join(release, 'api/Dockerfile'), `FROM ${previousAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
  const frontend = join(release, 'frontend');
  cpSync(join(prior, 'frontend'), frontend, { recursive: true, verbatimSymlinks: true,
    filter: path => !['node_modules', 'dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env') });
  for (const path of [frontend, join(frontend, tutor)]) symlinkSync(join(root, 'node_modules'), join(path, 'node_modules'));
  for (const path of ['tutor/pages/ExamPage.tsx', 'tutor/pages/WrittenExamPage.css', 'tests/browser/writtenExam.cjs']) copy(join(root, tutor, path), join(frontend, tutor, path));
  if (currentTutor() !== previousTutor) throw Error('Tutor baseline changed');
  run('bun', ['run', 'build'], { cwd: join(frontend, tutor), stdio: 'inherit' });
  save(join(release, 'manifest.json'), JSON.stringify({ id, previousAPI, previousTutor, image, scope: 'Written assessment UI and generation quality gate only', preparedAt: new Date().toISOString() }, null, 2));
} else if (process.argv.includes('--refresh')) {
  for (const path of ['src/services/exam.services/exam.service.ts', 'src/services/exam.services/applicationPolicy.ts', 'src/services/exam.services/writtenQuality.ts', 'tests/writtenQuality.test.ts', 'tests/applicationPolicy.test.ts'])
    copy(join(root, 'fluentxverse-server', path), join(release, 'api', path));
  for (const path of ['tutor/pages/ExamPage.tsx', 'tutor/pages/WrittenExamPage.css', 'tests/browser/writtenExam.cjs'])
    copy(join(root, tutor, path), join(release, 'frontend', tutor, path));
  run('bun', ['run', 'build'], { cwd: join(release, 'frontend', tutor), stdio: 'inherit' });
} else if (process.argv.includes('--build')) {
  run('tar', ['-czf', join(release, 'api.tar.gz'), '-C', join(release, 'api'), '.']);
  ssh(`mkdir -p ${stage}/api`);
  run('scp', [...sshOptions, join(release, 'api.tar.gz'), `${cloudTarget}:${stage}/api.tar.gz`]);
  ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api`);
  console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/api`, { timeout: 180000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ./tests/writtenQuality.test.ts ./tests/applicationPolicy.test.ts ./tests/tutorEmail.test.ts ./tests/mail.test.ts`, { timeout: 60000 }));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/exam-api.js`, { timeout: 60000 }));
  save(join(release, 'images-built.json'), JSON.stringify({ image, imageId: imageId(), at: new Date().toISOString() }));
} else if (process.argv.includes('--pilot')) {
  const key = JSON.parse(ssh("docker exec fluentxverse-server bun --no-env-file -e 'console.log(JSON.stringify(process.env.OPENAI_API_KEY))'"));
  if (!key) throw Error('Assessment provider is not configured');
  const code = String.raw`
    import assert from 'node:assert/strict';
    process.env.OPENAI_API_KEY = (await Bun.stdin.json()).key;
    const { generateReviewedWrittenContent } = await import('./src/services/exam.services/exam.service');
    const { createAgent } = await import('./src/services/agentFactory');
    const { writtenReviewInstructions, writtenReviewSchema, writtenReviewInput, validateWrittenReview, WRITTEN_MODEL } = await import('./src/services/exam.services/writtenQuality');
    const started = Date.now(), content = await generateReviewedWrittenContent();
    const bad = structuredClone(content);
    Object.assign(bad.questions[12], { sentence: 'The old building was scheduled to be ____ next month.', options: ['construct', 'destroy', 'create', 'design'], correctAnswer: 1 });
    const reviewer = createAgent({ name: 'Written Quality Regression Pilot', model: WRITTEN_MODEL,
      defaultOptions: { modelSettings: { temperature: 0 } }, instructions: writtenReviewInstructions });
    const reviewed = await reviewer.generate(writtenReviewInput(bad), { abortSignal: AbortSignal.timeout(60000), structuredOutput: { schema: writtenReviewSchema } });
    const item = reviewed.object.reviews.find(r => r.id === 13);
    assert(item && (item.issue !== 'none' || item.validOptions.length !== 1), 'Bad passive-voice question passed review');
    assert.throws(() => validateWrittenReview(bad, reviewed.object));
    console.log(JSON.stringify({ realProviderPilotPassed: true, reviewedQuestions: content.questions.length, invalidPassiveVoiceRejected: true, elapsedMs: Date.now() - started, applicantDataUsed: false }));
    process.exit(0);`;
  const result = JSON.parse(ssh(`docker run --rm -i --network container:fluentxverse-server --entrypoint bun ${image} --no-env-file -e ${quote(code)}`, { input: JSON.stringify({ key }), timeout: 240000 }));
  console.log(JSON.stringify(result));
  save(join(release, 'provider-pilot.json'), JSON.stringify({ ...result, imageId: imageId(), at: new Date().toISOString() }));
} else if (process.argv.includes('--activate')) {
  if (JSON.parse(readFileSync(join(release, 'images-built.json'))).imageId !== imageId() ||
    JSON.parse(readFileSync(join(release, 'provider-pilot.json'))).imageId !== imageId()) throw Error('Exact tested image required');
  if (currentTutor() !== previousTutor) throw Error('Tutor baseline changed');
  const original = ssh(`cat ${composePath}`), compose = JSON.parse(original);
  if (compose.services.api.image !== previousAPI) throw Error('API baseline changed');
  const check = "import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classrooms; defer release');console.log(JSON.stringify({activeClassrooms:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(check)}`));
  const assessments = "import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();try{const r=await s.run(\"MATCH(e:Exam) WHERE e.status IN ['generating','queued','processing'] RETURN count(e) AS n\");const n=Number(r.records[0].get('n'));if(n)throw Error('Active assessment work; defer release');console.log(JSON.stringify({activeAssessmentJobs:n}));}finally{await s.close();await closeDriver();}";
  console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(assessments)}`));
  const state = join(homedir(), '.local/state/fluentxverse', id); mkdirSync(state, { recursive: true, mode: 0o700 });
  compose.services.api.image = image;
  const next = join(state, 'compose.private.json'); writeFileSync(next, JSON.stringify(compose, null, 2), { mode: 0o600 });
  const backup = composePath + '.pre-written-exam-' + Date.now(); ssh(`cp -p ${composePath} ${backup}`);
  run('scp', [...sshOptions, next, `${cloudTarget}:${composePath}.next`]);
  if (ssh(`cat ${composePath}`) !== original) throw Error('Runtime changed');
  let workerVersion = '';
  try {
    ssh(`chmod 600 ${composePath}.next`);
    ssh(`mv ${composePath}.next ${composePath}`);
    console.log(ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
    const result = wrangler(['deploy']); console.log(result);
    workerVersion = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1] || '';
    if (!workerVersion) throw Error('Confirm Worker deployment');
    if ((await fetch('https://api.fluentxverse.com/tutor/email-verification/')).status !== 401) throw Error('Auth boundary failed');
  } catch (error) {
    ssh(`cp -p ${backup} ${composePath}`);
    ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 });
    if (workerVersion) wrangler(['rollback', previousTutor, '--yes']);
    throw error;
  }
  save(join(release, 'deployment.json'), JSON.stringify({ image, workerVersion, previousAPI, previousTutor, at: new Date().toISOString() }, null, 2));
} else throw Error('Use --prepare, --refresh, --build, --pilot, or --activate');
