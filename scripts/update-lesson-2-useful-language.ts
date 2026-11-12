import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { lesson2UsefulLanguage } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-2-listening';

const id = 'conversational-skills-L3-C1-2-listening-ja-v1';
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('LANGUAGE_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('LANGUAGE_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l', {id:${JSON.stringify(id)}});
  if(result.records.length!==1) throw new Error('Expected exactly one Lesson 2.');
  console.log('LANGUAGE_RESULT '+JSON.stringify(result.records[0].get('l').properties));`);

const before = read();
const mission = JSON.parse(before.missionData);
if (mission.missionType !== 'listening' || mission.challengeNumber !== 1) throw new Error('Unexpected challenge.');
if (mission.showGrammarTip || mission.grammarTipItems?.length) throw new Error('Useful language already exists; review before replacing.');
const next = { ...mission, ...lesson2UsefulLanguage };
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ id, expectedUpdatedAt: before.updatedAt, ...lesson2UsefulLanguage, dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  if (expected !== before.updatedAt) throw new Error(`Review current revision ${before.updatedAt} first.`);
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-2-useful-language-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const params = { id, expected, previous: before.missionData, next: JSON.stringify(next), now };
  remote(`
    const result=await session.run(
      'MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected AND l.missionData=$previous SET l.missionData=$next, l.updatedAt=$now RETURN l.id AS id',
      ${JSON.stringify(params)});
    if(result.records.length!==1) throw new Error('Concurrent edit detected; no content overwritten.');
    console.log('LANGUAGE_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  const expectedRecord = { ...before, missionData: params.next, updatedAt: now };
  const keys = new Set([...Object.keys(after), ...Object.keys(expectedRecord)]);
  if ([...keys].some(key => JSON.stringify(after[key]) !== JSON.stringify(expectedRecord[key]))) throw new Error('Post-save verification mismatch.');
  console.log(JSON.stringify({ id, backup, verified: true }));
}
