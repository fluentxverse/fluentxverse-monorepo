import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildNewBeginningLesson, newBeginningIds, storyLessonNumbers } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/new-beginning';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';

const jsonFields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
const remote = (body: string, payload?: unknown) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${payload === undefined ? '' : 'const payload=JSON.parse(await Bun.stdin.text());'} ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, payload === undefined ? {} : { input: JSON.stringify(payload) });
  const line = output.split('\n').find(line => line.startsWith('BEGINNING_RESULT '));
  if (!line) throw Error(output);
  return JSON.parse(line.slice('BEGINNING_RESULT '.length));
};
const read = () => remote(`const r=await session.run('MATCH (l:LessonMaterial) WHERE l.id IN $ids RETURN l',{ids:${JSON.stringify(Object.values(newBeginningIds))}});
  if(r.records.length!==8) throw Error('Expected all eight existing story lessons');
  console.log('BEGINNING_RESULT '+JSON.stringify(r.records.map(row=>row.get('l').properties)));`);
const parse = (raw: any) => ({ ...raw, level: 3, chapter: 1, ...Object.fromEntries(jsonFields.map(key => [key, raw[key] ? JSON.parse(raw[key]) : null])) });
const records = read();
const reference = parse(records.find((record: any) => record.id === newBeginningIds[4]));
const output = resolve(import.meta.dir, '../output/new-beginning-story');
await mkdir(output, { recursive: true });
const items = storyLessonNumbers.map(number => {
  const before = records.find((record: any) => record.id === newBeginningIds[number]);
  const previous = parse(before);
  const changes = buildNewBeginningLesson(number, previous, 'https://api.fluentxverse.com', reference);
  const candidate = { ...previous, ...changes, lessonNumber: number };
  const errors = conversationalLessonErrors(candidate);
  if (errors.length) throw Error(`Lesson ${number}: ${errors.join(' ')}`);
  if (candidate.id !== before.id || candidate.status !== before.status) throw Error('Identity/status changed');
  for (const key of ['categories', 'rubricLevels']) if (JSON.stringify(candidate.feedbackData[key]) !== JSON.stringify(previous.feedbackData[key])) throw Error('Fixed feedback changed');
  return { number, before, changes, candidate };
});
for (const item of items) await writeFile(resolve(output, `lesson-${item.number}.json`), JSON.stringify(item.candidate, null, 2));
const revisions = Object.fromEntries(items.map(item => [item.number, item.before.updatedAt]));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ dryRun: true, revisions, lessons: items.map(item => ({ number: item.number, title: item.candidate.lessonName, skill: item.candidate.skill, status: item.before.status })), output }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length);
  if (!expected || JSON.stringify(JSON.parse(expected)) !== JSON.stringify(revisions)) throw Error('Review and pass the exact revision map from the dry run.');
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-new-beginning-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(records, null, 2), { flag: 'wx', mode: 0o600 });
  const updates = items.map(item => ({ id: item.before.id, expected: item.before.updatedAt, status: item.before.status, updates: { ...Object.fromEntries(Object.entries(item.changes).map(([key, value]) => [key, jsonFields.includes(key) ? JSON.stringify(value) : value])), updatedAt: now } }));
  remote(`const r=await session.run(
    'UNWIND $items AS item MATCH (l:LessonMaterial {id:item.id}) WHERE l.updatedAt=item.expected AND l.status=item.status WITH collect({lesson:l,updates:item.updates}) AS matched WHERE size(matched)=8 UNWIND matched AS pair WITH pair.lesson AS l,pair.updates AS updates SET l += updates RETURN count(l) AS updated',
    payload);
    if(r.records[0]?.get('updated').toNumber()!==8) throw Error('Concurrent edit detected; no content overwritten.');
    console.log('BEGINNING_RESULT '+JSON.stringify({saved:true}));`, { items: updates });
  const after = read();
  for (const item of items) {
    const actual = after.find((record: any) => record.id === item.before.id);
    const wanted = { ...item.before, ...updates.find(update => update.id === item.before.id)!.updates };
    if ([...new Set([...Object.keys(actual), ...Object.keys(wanted)])].some(key => JSON.stringify(actual[key]) !== JSON.stringify(wanted[key]))) throw Error('Full record read-back mismatch');
  }
  console.log(JSON.stringify({ verified: true, idsAndStatusesPreserved: true, updatedAt: now, backup, lessons: storyLessonNumbers }, null, 2));
}
