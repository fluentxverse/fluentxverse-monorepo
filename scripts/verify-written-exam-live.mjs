import { ssh, quote } from './lib/cloud-ssh.mjs';

if (!process.argv.includes('--generate-test-exam'))
  throw Error('Use --generate-test-exam to run a real-provider pilot with a temporary applicant.');

const code = String.raw`
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initDriver, getDriver, closeDriver } from './src/db/memgraph';
import { signAuthToken } from './src/utils/jwt';
import { validateNewWrittenContent, WRITTEN_QUALITY_VERSION } from './src/services/exam.services/writtenQuality';
const id = 'written-live-qa-' + randomUUID(), email = id + '@example.invalid';
await initDriver(process.env.MEMGRAPH_URI, process.env.MEMGRAPH_USER, process.env.MEMGRAPH_PASSWORD);
const db = getDriver().session();
try {
  await db.run('CREATE(:User {id:$id,email:$email,role:$role,verifiedEmail:true,verifiedEmailAddress:$email,createdAt:$at})',
    { id, email, role: 'tutor', at: new Date().toISOString() });
  const cookie = 'tutorAuth=' + await signAuthToken({ userId: id, email, role: 'tutor' });
  const request = (path, method = 'GET', body) => fetch('https://api.fluentxverse.com' + path, {
    method, headers: { cookie, origin: 'https://tutor.fluentxverse.com', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(110000) });
  const requestedAt = Date.now();
  const response = await request('/exam/written/generate', 'POST', {});
  assert.equal(response.status, 200, 'Live generation must succeed');
  const body = await response.json(), exam = body.exam;
  assert.equal(exam.questions.length, 30);
  assert.equal(exam.qualityPolicy, WRITTEN_QUALITY_VERSION);
  const publicText = JSON.stringify(exam);
  for (const key of ['correctAnswer', 'correctOption', 'validOptions', 'reviewerNotes'])
    assert(!publicText.includes(key), 'Answer material leaked into client response');
  const row = (await db.run('MATCH(:User {id:$id})-[:TAKES]->(e:Exam) RETURN e', { id })).records;
  assert.equal(row.length, 1);
  const stored = row[0].get('e').properties, content = JSON.parse(stored.content);
  validateNewWrittenContent(content);
  const positions = [0, 0, 0, 0];
  content.questions.forEach(q => positions[q.correctAnswer]++);
  assert(positions.filter(n => n > 0).length > 1, 'Answer positions must not all be identical');
  assert.deepEqual(exam.questions.map(q => q.options), content.questions.map(q => q.options), 'Published option order must match grading order');
  assert.equal(stored.status, 'active');
  const startedAt = Date.parse(stored.startedAt), now = Date.now();
  assert(startedAt >= requestedAt && now - startedAt < 15000, 'Timer must start after generation and review');
  assert.equal(Date.parse(stored.expiresAt) - startedAt, 25 * 60000);
  const active = await request('/exam/active');
  assert.equal(active.status, 200);
  assert.equal((await active.json()).exam.examId, exam.examId);
  const answers = Array(30).fill(-1); answers[12] = 0;
  const saved = await request('/exam/written/save', 'POST', { examId: exam.examId, answers, currentQuestion: 12 });
  assert.equal(saved.status, 200);
  const resumed = (await (await request('/exam/active')).json()).exam;
  assert.deepEqual(resumed.savedAnswers, answers);
  assert.equal(resumed.currentQuestion, 12);
  assert.equal(resumed.startedAt, exam.startedAt, 'Resume must not restart the timer');
  assert.deepEqual(resumed.questions, exam.questions, 'Resume must not reshuffle the options');
  console.log(JSON.stringify({ liveWrittenExamPassed: true, questions: 30, qualityPolicy: content.qualityPolicy,
    publicKeysHidden: true, timerStartsAfterReview: true, savedAnswersResume: true,
    answerPositions: positions, stableOptionOrder: true,
    generationAndChecksMs: Date.now() - requestedAt, noExamSubmitted: true }));
} finally {
  try {
    await db.executeWrite(async tx => {
      await tx.run('MATCH(:User {id:$id})-[:TAKES]->(e:Exam) DETACH DELETE e', { id });
      await tx.run('MATCH(u:User {id:$id,email:$email}) DETACH DELETE u', { id, email });
    });
    const remaining = await db.run('MATCH(u:User {id:$id}) RETURN count(u) AS n', { id });
    assert.equal(Number(remaining.records[0].get('n')), 0);
    console.log(JSON.stringify({ temporaryApplicantAndExamRemoved: true }));
  } finally { await db.close(); await closeDriver(); }
}
process.exit(0);
`;

try {
  process.stdout.write(ssh('docker exec fluentxverse-server bun --no-env-file -e ' + quote(code), { timeout: 180000 }));
} catch {
  console.error('Live written-exam check failed. Check sanitized assertions and temporary-account cleanup.');
  process.exitCode = 1;
}
