import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildLesson6, lesson6Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-6-listening';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';

const id = lesson6Id, referenceId = 'conversational-skills-L3-C1-2-listening-ja-v1';
const jsonFields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('STORY_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('STORY_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial) WHERE l.id IN $ids RETURN l', {ids:${JSON.stringify([id, referenceId])}});
  if(result.records.length!==2) throw new Error('Expected Lessons 2 and 6.');
  console.log('STORY_RESULT '+JSON.stringify(result.records.map(row=>row.get('l').properties)));`);
const records = read();
const before = records.find((lesson: any) => lesson.id === id), rawReference = records.find((lesson: any) => lesson.id === referenceId);
const parse = (raw: any) => ({ ...raw, level: 3, chapter: 1, ...Object.fromEntries(jsonFields.map(key => [key, raw[key] ? JSON.parse(raw[key]) : null])) });
const previous = parse(before), reference = parse(rawReference);
if (previous.skill !== 'listening') throw new Error('This listening updater is retired after the skill-pattern correction. Use scripts/correct-exhibition-skill-pattern.ts.');
const changes = buildLesson6(previous, 'https://api.fluentxverse.com', reference);
const candidate = { ...previous, ...changes, lessonNumber: 6 };
const errors = conversationalLessonErrors(candidate);
if (errors.length) throw new Error(errors.join(' '));
if (JSON.stringify(candidate.feedbackData.categories) !== JSON.stringify(previous.feedbackData.categories)) throw new Error('Fixed feedback changed.');
const images = (value: any): string[] => !value || typeof value !== 'object' ? [] : Object.entries(value).flatMap(([key, item]) => /^(?:image|introImage|situationImage|triviaImage|backgroundImage)$/.test(key) && typeof item === 'string' && item ? [item] : images(item));
if (JSON.stringify(images(changes).sort()) !== JSON.stringify(images(Object.fromEntries(Object.keys(changes).map(key => [key, previous[key]]))).sort())) throw new Error('Existing images changed.');
const output = resolve(import.meta.dir, '../output/lesson6-please-dont-cancel');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'preview.json'), JSON.stringify(candidate, null, 2));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ id, status: before.status, expectedUpdatedAt: before.updatedAt, referenceUpdatedAt: rawReference.updatedAt, title: candidate.lessonName, preview: resolve(output, 'preview.json'), dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  const expectedReference = process.argv.find(arg => arg.startsWith('--expected-reference='))?.slice('--expected-reference='.length);
  if (expected !== before.updatedAt || expectedReference !== rawReference.updatedAt) throw new Error('Review the current lesson and template revisions first.');
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-6-please-dont-cancel-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(records, null, 2), { flag: 'wx', mode: 0o600 });
  const updates = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, jsonFields.includes(key) ? JSON.stringify(value) : value]));
  updates.updatedAt = now;
  const params = { id, expected, referenceId, expectedReference, updates };
  remote(`
    const result=await session.run('MATCH (l:LessonMaterial {id:$id}), (reference:LessonMaterial {id:$referenceId}) WHERE l.updatedAt=$expected AND reference.updatedAt=$expectedReference SET l += $updates RETURN l.id AS id', ${JSON.stringify(params)});
    if(result.records.length!==1) throw new Error('Concurrent edit detected; no content overwritten.');
    console.log('STORY_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  for (const original of records) {
    const actual = after.find((lesson: any) => lesson.id === original.id);
    const expectedRecord = original.id === id ? { ...original, ...updates } : original;
    const keys = new Set([...Object.keys(actual), ...Object.keys(expectedRecord)]);
    if ([...keys].some(key => JSON.stringify(actual[key]) !== JSON.stringify(expectedRecord[key]))) throw new Error('Post-save verification mismatch.');
  }
  console.log(JSON.stringify({ id, updatedAt: now, backup, verified: true, referenceUnchanged: true }, null, 2));
}
