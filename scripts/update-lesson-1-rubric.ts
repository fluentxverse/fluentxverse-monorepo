import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { lesson1Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-1-trivia';

const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('RUBRIC_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('RUBRIC_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l', {id:${JSON.stringify(lesson1Id)}});
  if(result.records.length!==1) throw new Error('Expected exactly one Lesson 1.');
  console.log('RUBRIC_RESULT '+JSON.stringify(result.records[0].get('l').properties));`);

const before = read();
const feedback = JSON.parse(before.feedbackData);
const title = 'LESSON OBJECTIVE ACHIEVEMENT';
if (feedback.rubricTitle === title) {
  console.log(JSON.stringify({ id: lesson1Id, title, alreadyUpdated: true }));
} else {
  if (feedback.rubricTitle !== 'LESSON GOAL ACHIEVEMENT') throw new Error('Unexpected rubric title; review before updating.');
  feedback.rubricTitle = title;
  if (!process.argv.includes('--write')) {
    console.log(JSON.stringify({ id: lesson1Id, title, expectedUpdatedAt: before.updatedAt, dryRun: true }));
  } else {
    const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
    if (expected !== before.updatedAt) throw new Error(`Review current revision ${before.updatedAt} first.`);
    const now = new Date().toISOString();
    const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
    await mkdir(directory, { recursive: true });
    const backup = resolve(directory, `before-lesson-1-rubric-title-${now.replace(/[:.]/g, '-')}.json`);
    await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
    const params = { id: lesson1Id, expected, previous: before.feedbackData, next: JSON.stringify(feedback), now };
    remote(`
      const result=await session.run(
        'MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected AND l.feedbackData=$previous SET l.feedbackData=$next, l.updatedAt=$now RETURN l.id AS id',
        ${JSON.stringify(params)});
      if(result.records.length!==1) throw new Error('Concurrent edit detected; no content overwritten.');
      console.log('RUBRIC_RESULT '+JSON.stringify({saved:true}));`);
    const after = read();
    const expectedRecord = { ...before, feedbackData: params.next, updatedAt: now };
    const keys = new Set([...Object.keys(after), ...Object.keys(expectedRecord)]);
    if ([...keys].some(key => JSON.stringify(after[key]) !== JSON.stringify(expectedRecord[key]))) throw new Error('Post-save verification mismatch.');
    console.log(JSON.stringify({ id: lesson1Id, title, backup, verified: true }));
  }
}
