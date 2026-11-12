import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildStepBTutorGuide } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/standardize-tutor-guides';

const id = 'conversational-skills-L3-C1-3-reading-ja-v1';
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('TIP_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('TIP_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l', {id:${JSON.stringify(id)}});
  if(result.records.length!==1) throw new Error('Expected exactly one Lesson 3.');
  console.log('TIP_RESULT '+JSON.stringify(result.records[0].get('l').properties));`);
const before = read();
const data = JSON.parse(before.stepBData);
if (data.grammarTip?.stepName !== 'STEP B: READING TIP') throw new Error('Unexpected Step B content.');
const original = data.grammarTip.tutorSteps;
const question = original.at(-1)?.script;
if (!question || !question.includes('basket')) throw new Error('Review the current checking question before replacing it.');
data.grammarTip.tutorSteps = buildStepBTutorGuide(
  question.startsWith('I have a question.') ? question : `I have a question. ${question}`,
  "Accept the student's own wording. Give one brief correction if needed.",
);
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ id, expectedUpdatedAt: before.updatedAt, tutorSteps: data.grammarTip.tutorSteps, dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  if (expected !== before.updatedAt) throw new Error(`Review current revision ${before.updatedAt} first.`);
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-3-reading-tip-guide-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const params = { id, expected, previous: before.stepBData, next: JSON.stringify(data), now };
  remote(`
    const result=await session.run('MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected AND l.stepBData=$previous SET l.stepBData=$next, l.updatedAt=$now RETURN l.id AS id', ${JSON.stringify(params)});
    if(result.records.length!==1) throw new Error('Concurrent edit detected; no content overwritten.');
    console.log('TIP_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  const expectedRecord = { ...before, stepBData: params.next, updatedAt: now };
  const keys = new Set([...Object.keys(after), ...Object.keys(expectedRecord)]);
  if ([...keys].some(key => JSON.stringify(after[key]) !== JSON.stringify(expectedRecord[key]))) throw new Error('Post-save verification mismatch.');
  console.log(JSON.stringify({ id, backup, verified: true }));
}
