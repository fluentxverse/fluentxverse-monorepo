import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildArcLesson, exhibitionArcIds, exhibitionArcSkills } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lessons-6-9';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';

const available = [6, 7, 8, 9] as const;
const selected = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length);
const numbers = selected ? selected.split(',').map(Number) as (typeof available[number])[] : [...available];
if (!numbers.length || new Set(numbers).size !== numbers.length || numbers.some(number => !available.includes(number))) throw Error('Use --only with unique lesson numbers from 6 to 9.');
const referenceId = 'conversational-skills-L3-C1-4-speaking-ja-v1';
const jsonFields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('PATTERN_RESULT '));
  if (!line) throw new Error(output);
  return JSON.parse(line.slice('PATTERN_RESULT '.length));
};
const read = () => remote(`const r=await session.run('MATCH (l:LessonMaterial) WHERE l.id IN $ids RETURN l',{ids:${JSON.stringify([...numbers.map(number => exhibitionArcIds[number]), referenceId])}});
  if(r.records.length!==${numbers.length + 1}) throw Error('Expected the selected lessons and the Lesson 4 guide reference');
  console.log('PATTERN_RESULT '+JSON.stringify(r.records.map(row=>row.get('l').properties)));`);
const parse = (raw: any) => ({ ...raw, level: 3, chapter: 1, ...Object.fromEntries(jsonFields.map(key => [key, raw[key] ? JSON.parse(raw[key]) : null])) });
const images = (value: any): string[] => !value || typeof value !== 'object' ? [] : Object.entries(value).flatMap(([key, item]) => /^(?:image|introImage|situationImage|triviaImage|backgroundImage)$/.test(key) && typeof item === 'string' && item ? [item] : images(item));
const records = read(), rawReference = records.find((raw: any) => raw.id === referenceId), reference = parse(rawReference);
const output = resolve(import.meta.dir, '../output/exhibition-skill-pattern');
await mkdir(output, { recursive: true });
const items = numbers.map(number => {
  const before = records.find((raw: any) => raw.id === exhibitionArcIds[number]);
  if (before.status !== 'draft') throw Error(`Lesson ${number} is not a draft; review publication before rewriting it.`);
  const previous = parse(before), changes = buildArcLesson(number, previous, 'https://api.fluentxverse.com', reference);
  const candidate = { ...previous, ...changes, lessonNumber: number };
  const errors = conversationalLessonErrors(candidate);
  if (errors.length) throw Error(`Lesson ${number}: ${errors.join(' ')}`);
  if (candidate.id !== before.id || candidate.skill !== exhibitionArcSkills[number]) throw Error('Identity or skill mismatch');
  if (JSON.stringify(candidate.feedbackData.categories) !== JSON.stringify(previous.feedbackData.categories)) throw Error('Fixed feedback categories changed');
  const oldImages = images(Object.fromEntries(Object.keys(changes).map(key => [key, previous[key]]))).sort();
  if (JSON.stringify(images(changes).sort()) !== JSON.stringify(oldImages)) throw Error(`Lesson ${number}: an existing image changed`);
  return { number, before, candidate, changes };
});
for (const item of items) await writeFile(resolve(output, `lesson-${item.number}.json`), JSON.stringify(item.candidate, null, 2));
const revisions = Object.fromEntries([...items.map(item => [item.number, item.before.updatedAt]), ['reference', rawReference.updatedAt]]);
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ dryRun: true, revisions, lessons: items.map(item => ({ number: item.number, id: item.before.id, skill: item.candidate.skill, title: item.candidate.lessonName })), output }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length);
  if (!expected || JSON.stringify(JSON.parse(expected)) !== JSON.stringify(revisions)) throw Error('Review and pass the complete --expected revision map from the dry run.');
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-exhibition-skill-pattern-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(records, null, 2), { flag: 'wx', mode: 0o600 });
  const updates = items.map(item => ({ id: item.before.id, expected: item.before.updatedAt, updates: { ...Object.fromEntries(Object.entries(item.changes).map(([key, value]) => [key, jsonFields.includes(key) ? JSON.stringify(value) : value])), updatedAt: now } }));
  remote(`const r=await session.run(
    'MATCH (reference:LessonMaterial {id:$referenceId}) WHERE reference.updatedAt=$expectedReference WITH reference UNWIND $items AS item MATCH (l:LessonMaterial {id:item.id}) WHERE l.updatedAt=item.expected AND l.status="draft" WITH collect({lesson:l,updates:item.updates}) AS matched WHERE size(matched)=$count UNWIND matched AS pair WITH pair.lesson AS l,pair.updates AS updates SET l += updates RETURN count(l) AS updated',
    ${JSON.stringify({ referenceId, expectedReference: rawReference.updatedAt, items: updates, count: numbers.length })});
    if(r.records[0]?.get('updated').toNumber()!==${numbers.length}) throw Error('Concurrent edit detected; no lesson content overwritten.');
    console.log('PATTERN_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  for (const original of records) {
    const actual = after.find((raw: any) => raw.id === original.id);
    const wanted = { ...original, ...(updates.find(update => update.id === original.id)?.updates || {}) };
    if ([...new Set([...Object.keys(actual), ...Object.keys(wanted)])].some(key => JSON.stringify(actual[key]) !== JSON.stringify(wanted[key]))) throw Error('Read-back mismatch');
  }
  console.log(JSON.stringify({ verified: true, idsPreserved: true, referenceUnchanged: true, updatedAt: now, backup, skills: Object.fromEntries(items.map(item => [item.number, item.candidate.skill])) }, null, 2));
}
