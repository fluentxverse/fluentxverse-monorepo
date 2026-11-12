import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { lesson6Id as id, lesson6ListeningChanges } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-6-listening';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';

const fields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('SIMPLE_RESULT '));
  if (!line) throw new Error(output);
  return JSON.parse(line.slice('SIMPLE_RESULT '.length));
};
const read = () => remote(`const r=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l',{id:${JSON.stringify(id)}});
  if(r.records.length!==1) throw Error('Expected one Lesson 6');
  console.log('SIMPLE_RESULT '+JSON.stringify(r.records[0].get('l').properties));`);
const before = read();
if (before.skill !== 'listening') throw new Error('Lesson 6 is now speaking. This historical listening-only updater cannot change it.');
const parsed = { ...before, level: 3, chapter: 1, ...Object.fromEntries(fields.map(key => [key, before[key] ? JSON.parse(before[key]) : null])) };
const changes = lesson6ListeningChanges(parsed);
const candidate = { ...parsed, ...changes };
const errors = conversationalLessonErrors(candidate);
if (errors.length) throw new Error(errors.join(' '));
const wordCount = (text: string) => text.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
const transcripts = (lesson: any) => [lesson.applyData.tutorSteps.find((step: any) => step.listeningScript).listeningScript, lesson.missionData.tutorSteps.find((step: any) => step.listeningScript).listeningScript];
const summary = { id, expectedUpdatedAt: before.updatedAt, oldWords: transcripts(parsed).map(wordCount), newWords: transcripts(candidate).map(wordCount) };
const output = resolve(import.meta.dir, '../output/lesson6-please-dont-cancel');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'preview.json'), JSON.stringify(candidate, null, 2));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ ...summary, dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  if (expected !== before.updatedAt) throw new Error('Review the current revision before writing.');
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-6-short-listening-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const updates = { applyData: JSON.stringify(changes.applyData), missionData: JSON.stringify(changes.missionData), updatedAt: now };
  remote(`const r=await session.run('MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected SET l += $updates RETURN l.id AS id',${JSON.stringify({ id, expected, updates })});
    if(r.records.length!==1) throw Error('Concurrent edit detected; nothing overwritten.');
    console.log('SIMPLE_RESULT '+JSON.stringify({saved:true}));`);
  const after = read(), wanted = { ...before, ...updates };
  if ([...new Set([...Object.keys(after), ...Object.keys(wanted)])].some(key => JSON.stringify(after[key]) !== JSON.stringify(wanted[key]))) throw new Error('Read-back mismatch.');
  console.log(JSON.stringify({ ...summary, updatedAt: now, backup, verified: true }, null, 2));
}
