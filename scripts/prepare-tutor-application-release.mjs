import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/release/tutor-application-20261022');
const baseline = join(root, 'output/release/tutor-knowledge-base-20261022');
const live = JSON.parse(execFileSync('docker', ['inspect', 'fluentxverse-server']))[0];
const tutorVersion = JSON.parse(readFileSync(join(baseline, 'deployment.json'))).version;
if (live.Config.Image !== 'fluentxverse-server:mail-composer-20261022') throw Error('Review the changed API baseline before preparing this release.');
if (existsSync(join(output, 'deployment.json'))) throw Error('This release was already deployed; prepare a new version.');
mkdirSync(output, { recursive: true });
rmSync(join(output, 'verification.json'), { force: true });
const manifest = { createdAt: new Date().toISOString(), previousImage: live.Config.Image, baseImageId: live.Image,
  previousTutor: tutorVersion, image: 'fluentxverse-server:tutor-application-20261022', files: {} };
const api = join(output, 'api');
const hash = value => createHash('sha256').update(value).digest('hex');
function copy(source, target) {
  mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target);
  manifest.files[target.slice(output.length + 1)] = hash(readFileSync(target));
}
for (const file of [
  'src/config/cors.ts', 'src/routes/exam.route.ts', 'src/routes/interview.route.ts',
  'src/routes/anonymousReviews.route.ts', 'src/routes/lessonPasses.route.ts',
  'src/services/exam.services/applicationPolicy.ts', 'src/services/exam.services/exam.interface.ts',
  'src/services/exam.services/exam.service.ts', 'src/services/exam.services/speaking.interface.ts',
  'src/services/exam.services/speaking.service.ts', 'src/services/exam.services/speakingQueue.ts',
  'src/services/interview.services/interview.service.ts', 'src/services/interview.services/interviewTime.ts',
  'src/services/schedule.services/schedule.service.ts', 'src/services/schedule.services/schedulingGuards.ts',
  'src/services/screening/evidence.ts', 'src/services/screening/storage.ts', 'src/services/screening/policy.ts',
]) copy(join(root, 'fluentxverse-server', file), join(api, file));

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Release baseline anchor changed; review the patch.');
  return source.replace(before, after);
}
let index = execFileSync('docker', ['exec', 'fluentxverse-server', 'cat', '/app/src/index.ts'], { encoding: 'utf8' });
index = replaceOnce(index, "import { startCancellationRefundJob } from './services/ticket.services/cancellationRefund.job';", "import { startCancellationRefundJob } from './services/ticket.services/cancellationRefund.job';\nimport { startSpeakingWorker } from './services/exam.services/speakingQueue';\nimport { applicationFailure } from './services/exam.services/applicationPolicy';");
index = replaceOnce(index, '    const requestId = (request as any).requestId;', `    const requestId = (request as any).requestId;
    if (path.startsWith('/exam/')) {
      const response = String(code) === 'VALIDATION' ? { status: 422, message: 'Invalid assessment request.' } : applicationFailure(error);
      set.status = response.status;
      set.headers['cache-control'] = 'private, no-store';
      return { success: false, message: response.message, error: response.message };
    }`);
index = replaceOnce(index, '  startCancellationRefundJob();', '  startCancellationRefundJob();\n  startSpeakingWorker();');
mkdirSync(join(api, 'src'), { recursive: true });
writeFileSync(join(api, 'src/index.ts'), index);
manifest.files['api/src/index.ts'] = hash(index);
let admin = execFileSync('docker', ['exec', 'fluentxverse-server', 'cat', '/app/src/services/admin.services/admin.service.ts'], { encoding: 'utf8' });
admin = replaceOnce(admin, "MATCH (u:User)-[:TAKES]->(e:Exam {type: 'speaking', status: 'processing'})", "MATCH (u:User)-[:TAKES]->(e:Exam {type: 'speaking'}) WHERE e.status IN ['queued','processing']");
const oldPending = "OPTIONAL MATCH (u)-[:TAKES]->(sp:Exam {type: 'speaking', status: 'processing'})";
if (admin.split(oldPending).length !== 3) throw Error('Review the changed admin queue baseline.');
admin = admin.replaceAll(oldPending, "OPTIONAL MATCH (u)-[:TAKES]->(sp:Exam {type: 'speaking'}) WHERE sp.status IN ['queued','processing']");
mkdirSync(join(api, 'src/services/admin.services'), { recursive: true });
writeFileSync(join(api, 'src/services/admin.services/admin.service.ts'), admin);
manifest.files['api/src/services/admin.services/admin.service.ts'] = hash(admin);
for (const file of ['application.fixtures.ts', 'application.persistence.ts', 'application.production.probe.ts', 'application.provider.probe.ts', 'applicationPolicy.test.ts', 'anonymousReviews.http.test.ts', 'lessonPasses.http.test.ts', 'screening.fixture.ts', 'screening.test.ts', 'screening.http.test.ts', 'zkSecurity.test.ts']) {
  copy(join(root, 'fluentxverse-server/tests', file), join(api, 'tests', file));
}
const baseTag = `fluentxverse-server:application-base-${live.Image.slice(7, 19)}`;
execFileSync('docker', ['tag', live.Image, baseTag]);
writeFileSync(join(api, 'Dockerfile'), `FROM ${baseTag} AS release\nCOPY --chown=appuser:appgroup src /app/src\nFROM release AS test\nCOPY --chown=appuser:appgroup tests /app/tests\n`);
execFileSync('docker', ['build', '--network=none', '--target', 'release', '-t', manifest.image, api], { stdio: 'inherit' });
execFileSync('docker', ['build', '--network=none', '--target', 'test', '-t', `${manifest.image}-test`, api], { stdio: 'inherit' });
execFileSync('docker', ['run', '--rm', '--network=none', manifest.image, 'bun', 'build', 'src/index.ts', '--target=bun', '--outfile=/tmp/application-api.js'], { stdio: 'inherit' });

for (const name of ['frontend', 'shared', 'fluentxverse-server', 'fluentxverse-student-solid-prototype', 'fluentxverse-tutor-solid-prototype']) {
  const target = join(output, name);
  if (!existsSync(target)) cpSync(join(baseline, name), target, { recursive: true, verbatimSymlinks: true,
    filter: path => !['dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env') });
}
for (const file of [
  'tutor/api/exam.api.ts', 'tutor/Components/Dashboard/DashboardOverview.tsx',
  'tutor/pages/ExamPage.tsx', 'tutor/pages/SpeakingExamPage.tsx', 'tutor/pages/HomePage.tsx', 'tutor/pages/InterviewBookingPage.tsx',
  'tests/browser/applicationFlow.cjs',
]) copy(join(root, 'fluentxverse-tutor-solid-prototype', file), join(output, 'frontend', file));
writeFileSync(join(output, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Prepared scoped tutor application API and frontend; current mail, knowledge base, auth and mobile API baselines preserved.');
