import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildLesson3Roleplay } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-3-roleplay';

const id = 'conversational-skills-L3-C1-3-reading-ja-v1';
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('ROLEPLAY_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('ROLEPLAY_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l', {id:${JSON.stringify(id)}});
  if(result.records.length!==1) throw new Error('Expected exactly one Lesson 3.');
  console.log('ROLEPLAY_RESULT '+JSON.stringify(result.records[0].get('l').properties));`);
const before = read();
const mission = JSON.parse(before.missionData);
if (mission.missionType !== 'reading' || mission.readingPassage?.title !== 'Riverside Cycle Kyoto') throw new Error('Review changed challenge before updating.');
const next = { ...mission, ...buildLesson3Roleplay() };
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ id, expectedUpdatedAt: before.updatedAt, changes: buildLesson3Roleplay(), dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  if (expected !== before.updatedAt) throw new Error(`Review current revision ${before.updatedAt} first.`);
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-3-roleplay-standard-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const params = { id, expected, previous: before.missionData, next: JSON.stringify(next), now };
  remote(`
    const result=await session.run('MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected AND l.missionData=$previous SET l.missionData=$next, l.updatedAt=$now RETURN l.id AS id', ${JSON.stringify(params)});
    if(result.records.length!==1) throw new Error('Concurrent edit detected; no content overwritten.');
    console.log('ROLEPLAY_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  const expectedRecord = { ...before, missionData: params.next, updatedAt: now };
  const keys = new Set([...Object.keys(after), ...Object.keys(expectedRecord)]);
  if ([...keys].some(key => JSON.stringify(after[key]) !== JSON.stringify(expectedRecord[key]))) throw new Error('Post-save verification mismatch.');
  console.log(JSON.stringify({ id, backup, verified: true }));
}
