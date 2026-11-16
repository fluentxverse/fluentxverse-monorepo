import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { cleanLevel6Pronunciation } from '../fluentxverse-server/content/conversational-skills/en/natural-pronunciation';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';

const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const digest = (v: any) => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const snapshotCode = `const stable=${stable.toString()};
const digest=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
async function snapshot(runner){
 const selected=await runner.run('MATCH(l:LessonMaterial {course:"conversational-skills"}) WHERE l.level=6 AND NOT l.lessonNumber IN [5,10] AND l.skill<>"review" RETURN properties(l) AS props ORDER BY l.id');
 const ids=selected.records.map(r=>r.get('props').id);
 const meta=await runner.run('MATCH(m:CourseMetadata) RETURN properties(m) AS props ORDER BY id(m)');
 const other=await runner.run('MATCH(l:LessonMaterial) WHERE NOT l.id IN $ids RETURN id(l) AS id,properties(l) AS props ORDER BY id(l)',{ids});
 const evidence=await runner.run('MATCH(n) WHERE NOT n:LessonMaterial AND (n.lessonId IS NOT NULL OR n.materialId IS NOT NULL OR n.sourceLessonIds IS NOT NULL OR n.lastViewedLessonId IS NOT NULL OR n.materialJson IS NOT NULL OR n.snapshotJson IS NOT NULL) RETURN id(n) AS id,properties(n) AS props ORDER BY id(n)');
 return {lessons:selected.records.map(r=>r.get('props')),metadata:meta.records.map(r=>r.get('props')),otherLessonDigest:digest(other.records.map(r=>r.toObject())),evidenceDigest:digest(evidence.records.map(r=>r.toObject()))};
}`;
const remote = (body: string, input?: unknown) => {
  const code = `import {createHash} from 'node:crypto';import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
const session=getDriver().session();${snapshotCode}
try{${input === undefined ? '' : 'const input=JSON.parse(await Bun.stdin.text());'}${body}}
finally{await session.close();await closeDriver();}`;
  const out = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, input === undefined ? {} : { input: JSON.stringify(input) });
  const line = out.split('\n').find(s => s.startsWith('PRON_RESULT '));
  if (!line) throw Error(out);
  return JSON.parse(line.slice('PRON_RESULT '.length));
};
const before = remote(`console.log('PRON_RESULT '+JSON.stringify(await snapshot(session)));`);
if (!before.lessons.length || new Set(before.lessons.map((l: any) => l.id)).size !== before.lessons.length) throw Error('Expected distinct saved Level 6 story lessons');
const numberOf = (n: any) => typeof n === 'number' ? n : n.low;
const fields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
const updates = before.lessons.map((raw: any) => {
  const chapter = numberOf(raw.chapter), number = numberOf(raw.lessonNumber);
  if (numberOf(raw.level) !== 6 || [5, 10].includes(number)) throw Error('Unexpected placement');
  const previous = { ...raw, level: 6, chapter, lessonNumber: number,
    ...Object.fromEntries(fields.map(k => [k, raw[k] ? JSON.parse(raw[k]) : undefined])) };
  const lesson = cleanLevel6Pronunciation(previous);
  const errors = conversationalLessonErrors(lesson);
  if (errors.length) throw Error(`${raw.id}: ${errors.join('; ')}`);
  const props = { learnData: JSON.stringify(lesson.learnData), stepBData: JSON.stringify(lesson.stepBData) };
  const strip = ({ learnData, stepBData, ...rest }: any) => rest;
  if (digest(strip(previous)) !== digest(strip(lesson))) throw Error('Unrelated lesson properties changed');
  const oldLearn = structuredClone(previous.learnData), newLearn = structuredClone(lesson.learnData);
  for (const step of oldLearn.steps || []) { delete step.pronunciationPart; if (step.discussionPart) delete step.discussionPart.tutorSteps; }
  for (const step of newLearn.steps || []) { delete step.pronunciationPart; if (step.discussionPart) delete step.discussionPart.tutorSteps; }
  if (digest(oldLearn) !== digest(newLearn)) throw Error('Learn changed outside duplicate pronunciation and its transition');
  return { id: raw.id, chapter, number, props, lesson };
});
const changed = updates.filter((u: any) => {
  const original = before.lessons.find((l: any) => l.id === u.id);
  return original.learnData !== u.props.learnData || original.stepBData !== u.props.stepBData;
});
const expected = digest(before);
const output = resolve(import.meta.dir, '../output/level6-natural-pronunciation');
await mkdir(output, { recursive: true });
for (const u of updates) {
  await writeFile(resolve(output, `L6-C${u.chapter}-${u.number}.json`), JSON.stringify(u.lesson, null, 2));
  const directory = ({ 1: 'keeping-traditions-alive', 2: 'beyond-the-workshop', 3: 'the-taste-of-tradition' } as Record<number, string>)[u.chapter];
  if (!directory) continue;
  const fixtures = resolve(import.meta.dir, `../output/${directory}`);
  await mkdir(fixtures, { recursive: true });
  await writeFile(resolve(fixtures, `lesson-${u.number}.json`), JSON.stringify(u.lesson, null, 2));
}
if (!process.argv.includes('--write')) console.log(JSON.stringify({ dryRun: true, expected, lessons: updates.length,
  changed: changed.length, changes: ['remove learnData.steps[].pronunciationPart', 'Part II transition to Step B', 'remove pronunciation commentary', 'updatedAt'], output }, null, 2));
else {
  if (process.argv.find(a => a.startsWith('--expected='))?.slice(11) !== expected) throw Error('Review a fresh dry run and supply the exact --expected digest');
  const now = new Date().toISOString();
  const backupDirectory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/en/migrations/backups');
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  const backup = resolve(backupDirectory, `before-pronunciation-cleanup-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  remote(`const tx=session.beginTransaction();try{
 if(digest(await snapshot(tx))!==input.expected)throw Error('Concurrent lesson, metadata or learner-evidence change; nothing saved');
 for(const item of input.items){
  const result=await tx.run('MATCH(l:LessonMaterial {id:$id}) SET l.learnData=$learnData,l.stepBData=$stepBData,l.updatedAt=$now RETURN l.id AS id',{id:item.id,...item.props,now:input.now});
  if(result.records.length!==1)throw Error('Lesson missing or duplicated');
 }
 await tx.commit();console.log('PRON_RESULT '+JSON.stringify({saved:true}));
}catch(error){await tx.rollback();throw error;}`, { expected, items: changed.map(({ id, props }: any) => ({ id, props })), now });
  const after = remote(`console.log('PRON_RESULT '+JSON.stringify(await snapshot(session)));`);
  const wanted = before.lessons.map((l: any) => {
    const change = changed.find((u: any) => u.id === l.id);
    return change ? { ...l, ...change.props, updatedAt: now } : l;
  });
  if (digest(after.lessons) !== digest(wanted) || digest(after.metadata) !== digest(before.metadata) ||
    after.otherLessonDigest !== before.otherLessonDigest || after.evidenceDigest !== before.evidenceDigest) throw Error('Read-back mismatch; inspect the backup before further writes');
  console.log(JSON.stringify({ saved: true, verified: true, updated: changed.length,
    identitiesArtworkStatusFeedbackMetadataOtherLessonsAndLearnerEvidencePreserved: true, backup }, null, 2));
}
