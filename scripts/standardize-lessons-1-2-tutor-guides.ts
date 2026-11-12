import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { guideFields, standardizeTutorGuides } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/standardize-tutor-guides';

const ids = [
  'conversational-skills-L3-C1-1-speaking-1774155960030',
  'conversational-skills-L3-C1-2-listening-ja-v1',
  'conversational-skills-L3-C1-3-reading-ja-v1',
];
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('GUIDE_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('GUIDE_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial) WHERE l.id IN $ids RETURN l', {ids:${JSON.stringify(ids)}});
  if(result.records.length!==3) throw new Error('Expected exactly three lessons.');
  console.log('GUIDE_RESULT '+JSON.stringify(result.records.map(row=>row.get('l').properties)));`);
const raw = read();
const before = ids.map(id => raw.find((lesson: any) => lesson.id === id));
const lessons = before.map((lesson: any) => ({ ...lesson, ...Object.fromEntries(guideFields.map(key => [key, JSON.parse(lesson[key])])) }));
const candidates = [standardizeTutorGuides(lessons[0], lessons[2], 1), standardizeTutorGuides(lessons[1], lessons[2], 2), lessons[2]];
const directory = resolve(import.meta.dir, '../output/lesson-guide-standardization');
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'preview.json'), JSON.stringify(candidates.map((lesson, index) => ({ ...lesson, level: 3, chapter: 1, lessonNumber: index + 1, levelBadge: 'L3' })), null, 2));
const revisions = before.map((lesson: any, index: number) => ({ lesson: index + 1, id: lesson.id, revision: lesson.updatedAt }));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ dryRun: true, revisions, preview: resolve(directory, 'preview.json') }, null, 2));
} else {
  for (const [index, lesson] of before.entries()) {
    const expected = process.argv.find(arg => arg.startsWith(`--expected-${index + 1}=`))?.split('=').slice(1).join('=');
    if (expected !== lesson.updatedAt) throw new Error(`Review Lesson ${index + 1} revision ${lesson.updatedAt} first.`);
  }
  const now = new Date().toISOString();
  const backupDirectory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(backupDirectory, { recursive: true });
  const backup = resolve(backupDirectory, `before-lessons-1-2-tutor-standard-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const changes = candidates.slice(0, 2).map((lesson: any, index: number) => ({
    id: lesson.id, expected: before[index].updatedAt,
    updates: { ...Object.fromEntries(guideFields.map(key => [key, JSON.stringify(lesson[key])])), updatedAt: now },
    previous: Object.fromEntries(guideFields.map(key => [key, before[index][key]])),
  }));
  const guard = guideFields.map(key => `l.${key}=$previous.${key}`).join(' AND ');
  remote(`
    const tx=session.beginTransaction();
    try {
      for(const change of ${JSON.stringify(changes)}) {
        const result=await tx.run(
          'MATCH (l:LessonMaterial {id:$id}), (reference:LessonMaterial {id:$referenceId}) WHERE l.updatedAt=$expected AND reference.updatedAt=$referenceRevision AND ${guard} SET l += $updates RETURN l.id AS id',
          {...change,referenceId:${JSON.stringify(ids[2])},referenceRevision:${JSON.stringify(before[2].updatedAt)}});
        if(result.records.length!==1) throw new Error('Concurrent edit detected; both lesson updates cancelled.');
      }
      await tx.commit();
    } catch(error) {await tx.rollback();throw error;}
    console.log('GUIDE_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  for (const [index, lesson] of before.entries()) {
    const expected = index < 2 ? { ...lesson, ...changes[index].updates } : lesson;
    const actual = after.find((item: any) => item.id === lesson.id);
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    if ([...keys].some(key => JSON.stringify(actual[key]) !== JSON.stringify(expected[key]))) throw new Error('Post-save verification mismatch: ' + lesson.id);
  }
  console.log(JSON.stringify({ verified: true, updated: ids.slice(0, 2), referenceUnchanged: ids[2], backup }, null, 2));
}
