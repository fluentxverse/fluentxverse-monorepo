import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { lesson3Trivia, updateLesson3Trivia } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-3-trivia';

const id = 'conversational-skills-L3-C1-3-reading-ja-v1';
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('TRIVIA_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('TRIVIA_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l', {id:${JSON.stringify(id)}});
  if(result.records.length!==1) throw new Error('Expected exactly one Lesson 3.');
  console.log('TRIVIA_RESULT '+JSON.stringify(result.records[0].get('l').properties));`);
const before = read();
const next = updateLesson3Trivia(JSON.parse(before.applyData));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ id, expectedUpdatedAt: before.updatedAt, trivia: lesson3Trivia, dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  if (expected !== before.updatedAt) throw new Error(`Review current revision ${before.updatedAt} first.`);
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-3-white-bike-trivia-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const params = { id, expected, previous: before.applyData, next: JSON.stringify(next), now };
  remote(`
    const result=await session.run('MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected AND l.applyData=$previous SET l.applyData=$next, l.updatedAt=$now RETURN l.id AS id', ${JSON.stringify(params)});
    if(result.records.length!==1) throw new Error('Concurrent edit detected; no content overwritten.');
    console.log('TRIVIA_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  const expectedRecord = { ...before, applyData: params.next, updatedAt: now };
  const keys = new Set([...Object.keys(after), ...Object.keys(expectedRecord)]);
  if ([...keys].some(key => JSON.stringify(after[key]) !== JSON.stringify(expectedRecord[key]))) throw new Error('Post-save verification mismatch.');
  console.log(JSON.stringify({ id, backup, verified: true }));
}
