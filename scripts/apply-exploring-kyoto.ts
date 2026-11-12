import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildKyotoLesson, chapter2Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-2/build';
import { buildEverydayLesson, chapter3Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-3/build';
import { buildCareerLesson, chapter4Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-4/build';
import { buildTwoCitiesLesson, chapter5Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-5/build';
import { storyLessonNumbers } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/new-beginning';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';

const referenceId = 'conversational-skills-L3-C1-4-speaking-ja-v1';
const chapter = Number(process.argv.find(arg => arg.startsWith('--chapter='))?.slice('--chapter='.length) || '2');
if (![2, 3, 4, 5].includes(chapter)) throw Error('Supported authoring chapters: 2, 3, 4 and 5.');
const definition = chapter === 2
  ? { title: 'Exploring Kyoto', theme: 'Travel, adventure and friendship in Kyoto', directory: 'exploring-kyoto', source: 'exploring-kyoto-ja-l3-c2-v1', build: buildKyotoLesson, id: chapter2Id }
  : chapter === 3
    ? { title: 'Everyday Life & Unexpected Moments', theme: 'Daily routines, work, friendship, problems and feelings', directory: 'everyday-life', source: 'everyday-life-ja-l3-c3-v1', build: buildEverydayLesson, id: chapter3Id }
    : chapter === 4
      ? { title: 'Work, Dreams & Decisions', theme: 'Professional goals, proposals, customer requests and decisions', directory: 'work-dreams-decisions', source: 'work-dreams-decisions-ja-l3-c4-v1', build: buildCareerLesson, id: chapter4Id }
      : { title: 'Two Cities, One Secret', theme: 'New work, communication, boundaries, honesty and consequences', directory: 'two-cities-one-secret', source: 'two-cities-one-secret-ja-l3-c5-v1', build: buildTwoCitiesLesson, id: chapter5Id };
const fields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
const output = resolve(import.meta.dir, `../output/${definition.directory}`);
const snapshotCode = `async function snapshot(runner) {
  const lessons=await runner.run('MATCH (l:LessonMaterial {course:"conversational-skills"}) WHERE l.level=3 AND l.chapter=${chapter} RETURN l ORDER BY l.id');
  const meta=await runner.run('MATCH (m:CourseMetadata {course:"conversational-skills",type:"chapter"}) WHERE m.level=3 AND m.chapter=${chapter} RETURN m');
  const refs=await runner.run('MATCH (l:LessonMaterial {id:$id}) RETURN l',{id:${JSON.stringify(referenceId)}});
  if(refs.records.length!==1 || meta.records.length>1) throw Error('Unexpected reference or metadata count');
  return {lessons:lessons.records.map(r=>r.get('l').properties),metadata:meta.records.map(r=>r.get('m').properties),reference:refs.records[0].get('l').properties};
}`;
const remote = (body: string, payload?: unknown) => {
  const code = `import neo4j from 'neo4j-driver'; import {createHash} from 'node:crypto'; import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
    const s=getDriver().session(); ${snapshotCode}
    try { ${payload === undefined ? '' : 'const payload=JSON.parse(await Bun.stdin.text());'} ${body} } finally {await s.close();await closeDriver();}`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, payload === undefined ? {} : { input: JSON.stringify(payload) });
  const line = result.split('\n').find(line => line.startsWith('KYOTO_RESULT '));
  if (!line) throw Error(result);
  return JSON.parse(line.slice('KYOTO_RESULT '.length));
};
const read = () => remote(`console.log('KYOTO_RESULT '+JSON.stringify(await snapshot(s)));`);
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const digest = (value: any) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const before = read();
const parse = (raw: any) => ({ ...raw, ...Object.fromEntries(fields.map(key => [key, raw[key] ? JSON.parse(raw[key]) : null])) });
const reference = parse(before.reference);
const numberOf = (record: any) => typeof record.lessonNumber === 'number' ? record.lessonNumber : record.lessonNumber?.low;
const candidates = storyLessonNumbers.map(number => {
  const matches = before.lessons.filter((record: any) => numberOf(record) === number);
  if (matches.length > 1) throw Error(`Duplicate Chapter ${chapter} lesson slot ${number}; review manually.`);
  const original = matches[0];
  if (original && original.status !== 'draft') throw Error(`Existing Lesson ${number} is not a draft. Review before replacing.`);
  const previous = original ? parse(original) : { feedbackData: reference.feedbackData };
  const lesson: any = { ...previous, ...definition.build(number, previous, reference), level: 3, chapter, lessonNumber: number };
  if (!original) { delete lesson.updatedAt; delete lesson.createdAt; }
  const errors = conversationalLessonErrors(lesson);
  if (errors.length) throw Error(`Lesson ${number}: ${errors.join(' ')}`);
  if (JSON.stringify(lesson).match(/https?:\/\/[^" ]+\.(?:webp|png|jpe?g)|[\uac00-\ud7af]/u)) throw Error('Unexpected inherited image or Korean content.');
  if (JSON.stringify(lesson.feedbackData.categories) !== JSON.stringify(previous.feedbackData.categories)) throw Error('Fixed feedback changed.');
  return { number, original, lesson };
});
await mkdir(output, { recursive: true });
for (const { number, lesson } of candidates) await writeFile(resolve(output, `lesson-${number}.json`), JSON.stringify(lesson, null, 2));
const expected = digest(before);
if (!process.argv.includes('--write')) console.log(JSON.stringify({ dryRun: true, expected, existingLessons: before.lessons.map((record: any) => ({ id: record.id, lessonNumber: numberOf(record), updatedAt: record.updatedAt })), referenceUpdatedAt: before.reference.updatedAt, metadata: before.metadata, lessons: candidates.map(({ number, lesson }) => ({ number, id: lesson.id, title: lesson.lessonName, skill: lesson.skill })), output }, null, 2));
else {
  if (process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length) !== expected) throw Error('Review the dry-run snapshot and supply its exact --expected digest.');
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, `../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-${chapter}/backups`);
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-${definition.directory}-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const items = candidates.map(({ number, original, lesson }) => {
    const properties = { ...lesson, id: original?.id || definition.id(number), updatedAt: now,
      ...(original ? {} : { createdAt: now, createdBy: 'codex', createdByName: 'Lesson Authoring', authoringSource: definition.source }) };
    for (const field of fields) properties[field] = properties[field] ? JSON.stringify(properties[field]) : '';
    return { properties, existing: Boolean(original) };
  });
  remote(`const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
    const tx=s.beginTransaction();try {
      const current=await snapshot(tx);
      const hash=createHash('sha256').update(JSON.stringify(stable(current))).digest('hex');
      if(hash!==payload.expected) throw Error('Concurrent edit detected; no lessons created or overwritten');
      for(const item of payload.items) {
        const props={...item.properties,level:neo4j.int(3),chapter:neo4j.int(payload.chapter),lessonNumber:neo4j.int(item.properties.lessonNumber)};
        const collision=await tx.run('MATCH (l:LessonMaterial {id:$id}) RETURN l',{id:props.id});
        if(item.existing) { if(collision.records.length!==1) throw Error('Missing existing lesson'); await tx.run('MATCH (l:LessonMaterial {id:$id}) SET l += $props',{id:props.id,props}); }
        else { if(collision.records.length) throw Error('ID collision'); await tx.run('CREATE (l:LessonMaterial) SET l=$props',{props}); }
      }
      await tx.run('MERGE (m:CourseMetadata {course:"conversational-skills",type:"chapter",level:$level,chapter:$chapter}) SET m.name=$name,m.theme=$theme,m.updatedAt=$now',{level:neo4j.int(3),chapter:neo4j.int(payload.chapter),name:payload.title,theme:payload.theme,now:payload.now});
      await tx.commit(); console.log('KYOTO_RESULT '+JSON.stringify({saved:true}));
    }catch(error){await tx.rollback();throw error;}`, { expected, items, now, chapter, title: definition.title, theme: definition.theme });
  const after = read();
  if (digest(after.reference) !== digest(before.reference)) throw Error('Reference changed during verification');
  for (const item of items) {
    const actual = after.lessons.find((record: any) => record.id === item.properties.id);
    if (!actual) throw Error('New lesson missing');
    const original = before.lessons.find((record: any) => record.id === actual.id);
    const wanted = { ...original, ...item.properties, level: actual.level, chapter: actual.chapter, lessonNumber: actual.lessonNumber };
    if (digest(actual) !== digest(wanted)) throw Error('Full record read-back mismatch');
  }
  for (const original of before.lessons.filter((record: any) => [5, 10].includes(numberOf(record)))) if (digest(after.lessons.find((record: any) => record.id === original.id)) !== digest(original)) throw Error('Checkpoint changed');
  if (after.lessons.length !== before.lessons.length + items.filter(item => !item.existing).length) throw Error('Unexpected chapter lesson count');
  if (after.metadata.length !== 1 || after.metadata[0].name !== definition.title) throw Error('Chapter metadata missing');
  console.log(JSON.stringify({ saved: true, verified: true, lessons: items.length, allDrafts: true, referenceAndCheckpointsUnchanged: true, backup, updatedAt: now }, null, 2));
}
