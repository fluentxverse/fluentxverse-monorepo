import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildLesson4 } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-4-speaking';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';

const id = 'conversational-skills-L3-C1-4-speaking-ja-v1', referenceId = 'conversational-skills-L3-C1-3-reading-ja-v1';
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
  if(result.records.length!==2) throw new Error('Expected Lessons 3 and 4.');
  console.log('STORY_RESULT '+JSON.stringify(result.records.map(row=>row.get('l').properties)));`);
const records = read();
const before = records.find((lesson: any) => lesson.id === id), rawReference = records.find((lesson: any) => lesson.id === referenceId);
const parse = (raw: any) => ({ ...raw, level: 3, chapter: 1, ...Object.fromEntries(jsonFields.map(key => [key, raw[key] ? JSON.parse(raw[key]) : null])) });
const previous = parse(before), reference = parse(rawReference);
const changes = buildLesson4(previous, 'https://api.fluentxverse.com', reference);
const candidate = { ...previous, ...changes, lessonNumber: 4 };
const errors = conversationalLessonErrors(candidate);
if (errors.length) throw new Error(errors.join(' '));
if (JSON.stringify(changes).match(/https?:\/\/[^" ]+\.(?:webp|png|jpe?g)|[\uac00-\ud7af]/u)) throw new Error('Unexpected image or Korean content.');
if (JSON.stringify(candidate.feedbackData.categories) !== JSON.stringify(previous.feedbackData.categories)) throw new Error('Fixed feedback changed.');
const output = resolve(import.meta.dir, '../output/lesson4-change-of-plans');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'preview.json'), JSON.stringify(candidate, null, 2));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ id, expectedUpdatedAt: before.updatedAt, referenceUpdatedAt: rawReference.updatedAt, title: candidate.lessonName, dialogueLines: candidate.applyData.dialogueLines.length, preview: resolve(output, 'preview.json'), dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  const expectedReference = process.argv.find(arg => arg.startsWith('--expected-reference='))?.slice('--expected-reference='.length);
  if (expected !== before.updatedAt || expectedReference !== rawReference.updatedAt) throw new Error('Review the current lesson and template revisions first.');
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-4-change-of-plans-${now.replace(/[:.]/g, '-')}.json`);
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
  console.log(JSON.stringify({ id, backup, verified: true, referenceUnchanged: true }, null, 2));
}
