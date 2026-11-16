/** Compile direct authorship and persist only reviewed Discussion Questions drafts. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { discussionTopics } from '../fluentxverse-server/content/discussion-questions/topics';
import { buildDiscussionMaterial, discussionMaterialErrors, discussionSource } from '../fluentxverse-server/content/discussion-questions/build';

const output = resolve(import.meta.dir, '../output/discussion-questions');
const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const digest = (v: any) => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const snapshotCode = `async function snapshot(runner){const r=await runner.run('MATCH (l:LessonMaterial {course:"discussion-questions"}) RETURN l ORDER BY l.id');const m=await runner.run('MATCH (m:CourseMetadata {course:"discussion-questions"}) RETURN m ORDER BY m.type,m.level,m.chapter');return {lessons:r.records.map(r=>r.get('l').properties),metadata:m.records.map(r=>r.get('m').properties)};}`;
function remote(body: string, payload?: any) {
  const code = `import neo4j from 'neo4j-driver';import {createHash} from 'node:crypto';import {initDriver,getDriver,closeDriver} from './src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();${snapshotCode}try{${payload ? 'const payload=JSON.parse(await Bun.stdin.text());' : ''}${body}}finally{await s.close();await closeDriver();}`;
  const out = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, payload ? { input: JSON.stringify(payload) } : {});
  const line = out.split('\n').find(l => l.startsWith('DQ_RESULT '));
  if (!line) throw Error('Missing Discussion Questions result');
  return JSON.parse(line.slice('DQ_RESULT '.length));
}
const read = () => remote(`console.log('DQ_RESULT '+JSON.stringify(await snapshot(s)));`);
const numberOf = (n: any) => typeof n === 'number' ? n : n?.low;
const before = read();
if (before.lessons.length > 50) throw Error('More than fifty existing topics; review slots first');
for (const row of before.lessons) {
  if (!discussionTopics.some(t => t.level === numberOf(row.level) && t.number === numberOf(row.lessonNumber)) || numberOf(row.chapter) !== 1 || row.skill !== 'speaking') throw Error('Unexpected occupied topic slot');
}
const candidates = discussionTopics.map(topic => {
  const matches = before.lessons.filter((l: any) => numberOf(l.level) === topic.level && numberOf(l.lessonNumber) === topic.number);
  if (matches.length > 1) throw Error('Duplicate topic slot');
  const original = matches[0];
  if (original && (original.status !== 'draft' || original.lessonName !== topic.title)) throw Error('Existing topic is not a matching draft; preserve it for review');
  const oldData = original?.discussionQuestionsData ? JSON.parse(original.discussionQuestionsData) : undefined;
  if (oldData?.questions?.some((q: any) => q.question?.trim()) && original.authoringSource !== discussionSource) throw Error('Existing manually filled topic requires review before replacement');
  const previous = original ? { ...original, discussionQuestionsData: oldData, ...(original.feedbackData ? { feedbackData: JSON.parse(original.feedbackData) } : {}) } : {};
  const lesson = buildDiscussionMaterial(topic, previous);
  const errors = discussionMaterialErrors(lesson);
  if (errors.length) throw Error(`${topic.level}:${topic.number}: ${errors.join('; ')}`);
  return { original, lesson };
});
await mkdir(output, { recursive: true });
for (const { lesson } of candidates) await writeFile(resolve(output, `level-${lesson.level}-topic-${lesson.lessonNumber}.json`), JSON.stringify(lesson, null, 2));
await writeFile(resolve(output, 'materials.json'), JSON.stringify(candidates.map(c => c.lesson), null, 2));
const snapshotDigest = digest(before), expected = digest({ snapshotDigest, topics: discussionTopics });
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ dryRun: true, expected, total: 50, perLevel: [1,2,3,4,5].map(level => ({ level, topics: candidates.filter(c => c.lesson.level === level).length })), questions: 1000, create: candidates.filter(c => !c.original).length, completeExisting: candidates.filter(c => c.original).map(c => ({ id: c.lesson.id, title: c.lesson.lessonName })), allDrafts: true, output }, null, 2));
} else {
  if (process.argv.find(a => a.startsWith('--expected='))?.slice(11) !== expected) throw Error('Review the dry-run and supply its exact --expected digest');
  const now = new Date().toISOString();
  const backupDir = resolve(import.meta.dir, '../fluentxverse-server/content/discussion-questions/backups');
  await mkdir(backupDir, { recursive: true });
  const backup = resolve(backupDir, `before-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const items = candidates.map(({ original, lesson }) => ({ existing: Boolean(original), props: {
    ...(original || {}), id: lesson.id, course: lesson.course, level: lesson.level, chapter: 1,
    chapterName: lesson.chapterName, lessonNumber: lesson.lessonNumber, lessonName: lesson.lessonName,
    skill: lesson.skill, goalTextEn: lesson.goalTextEn, goalTextJp: lesson.goalTextJp,
    backgroundImage: lesson.backgroundImage, overlayColor: lesson.overlayColor, status: lesson.status,
    discussionQuestionsData: JSON.stringify(lesson.discussionQuestionsData), supportLanguage: 'en',
    updatedAt: now, authoringSource: discussionSource,
    ...(original ? {} : { createdAt: now, createdBy: 'codex', createdByName: 'Lesson Authoring' }),
  } }));
  remote(`const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;const tx=s.beginTransaction();try{const current=await snapshot(tx);if(createHash('sha256').update(JSON.stringify(stable(current))).digest('hex')!==payload.snapshotDigest)throw Error('Concurrent edit detected; no topics changed');for(const item of payload.items){const props={...item.props,level:neo4j.int(item.props.level),chapter:neo4j.int(1),lessonNumber:neo4j.int(item.props.lessonNumber)};const found=await tx.run('MATCH (l:LessonMaterial {id:$id}) RETURN l',{id:props.id});if(item.existing){if(found.records.length!==1)throw Error('Existing topic missing');await tx.run('MATCH (l:LessonMaterial {id:$id}) SET l += $props',{id:props.id,props});}else{if(found.records.length)throw Error('Topic ID collision');await tx.run('CREATE (l:LessonMaterial) SET l=$props',{props});}}await tx.commit();console.log('DQ_RESULT '+JSON.stringify({saved:true}));}catch(e){await tx.rollback();throw e;}`, { snapshotDigest, items });
  const after = read();
  if (after.lessons.length !== 50 || digest(after.metadata) !== digest(before.metadata)) throw Error('Unexpected topic count or changed course metadata');
  for (const item of items) {
    const actual = after.lessons.find((l: any) => l.id === item.props.id);
    if (!actual || digest(actual) !== digest({ ...item.props, level: actual.level, chapter: actual.chapter, lessonNumber: actual.lessonNumber })) throw Error('Full record read-back mismatch');
  }
  console.log(JSON.stringify({ saved: true, verified: true, total: after.lessons.length, perLevel: [1,2,3,4,5].map(level => ({ level, topics: after.lessons.filter((l: any) => numberOf(l.level) === level).length })), questions: 1000, allDrafts: after.lessons.every((l: any) => l.status === 'draft'), existingIdentityAndPropertiesPreserved: true, metadataUnchanged: true, backup, updatedAt: now }, null, 2));
}
