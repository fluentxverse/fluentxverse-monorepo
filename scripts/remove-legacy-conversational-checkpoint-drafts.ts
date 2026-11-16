import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const ids = ['conversational-skills-L3-C1-5-speaking-ja-v1', 'conversational-skills-L3-C1-10-speaking-ja-v1'];
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const snapshotCode = `const ids=${JSON.stringify(ids)};const stable=${stable.toString()};
async function snapshot(runner){
  const lessons=await runner.run('MATCH(l:LessonMaterial {course:"conversational-skills"}) RETURN l ORDER BY l.id');
  const links=await runner.run('MATCH(l:LessonMaterial)-[r]-() WHERE l.id IN $ids RETURN count(r) AS count',{ids});
  const refs=await runner.run('MATCH(n) WHERE n.lessonId IS NOT NULL OR n.materialId IS NOT NULL OR n.sourceLessonIds IS NOT NULL OR n.lastViewedLessonId IS NOT NULL OR n.materialJson IS NOT NULL OR n.snapshotJson IS NOT NULL RETURN id(n) AS id,n.lessonId AS lessonId,n.materialId AS materialId,n.sourceLessonIds AS sourceLessonIds,n.lastViewedLessonId AS lastViewedLessonId,n.materialJson AS materialJson,n.snapshotJson AS snapshotJson ORDER BY id');
  const rows=refs.records.map(r=>r.toObject());
  const hits=rows.filter(row=>ids.some(id=>JSON.stringify(row).includes(id)));
  return {lessons:lessons.records.map(r=>r.get('l').properties),relationships:links.records[0].get('count').toNumber(),references:hits.length,evidenceDigest:createHash('sha256').update(JSON.stringify(stable(rows))).digest('hex')};
}`;
const remote = (body: string, input?: unknown): any => {
  const code = `import {createHash} from 'node:crypto';import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();${snapshotCode}
    try{${input === undefined ? '' : 'const input=JSON.parse(await Bun.stdin.text());'}${body}}finally{await s.close();await closeDriver();}`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, input === undefined ? {} : { input: JSON.stringify(input) });
  const line = result.split('\n').find(line => line.startsWith('REMOVE_RESULT '));
  if (!line) throw Error('Missing cleanup result.');
  return JSON.parse(line.slice('REMOVE_RESULT '.length));
};
const read = () => remote(`console.log('REMOVE_RESULT '+JSON.stringify(await snapshot(s)));`);
const before = read(), expected = digest(before);
const targets = before.lessons.filter((l: any) => ids.includes(l.id));
if (targets.length !== 2 || targets.some((l: any) => l.status !== 'draft' || (l.level.low ?? l.level) !== 3 || (l.chapter.low ?? l.chapter) !== 1)) throw Error('Expected exactly the two legacy Level 3 Chapter 1 drafts; nothing removed.');
if (before.references || before.relationships) throw Error('Legacy drafts have saved references or relationships; review before removal.');
if (!process.argv.includes('--write')) console.log(JSON.stringify({ dryRun: true, expected, lessons: targets.map((l: any) => ({ id: l.id, title: l.lessonName })), references: before.references, relationships: before.relationships }, null, 2));
else {
  if (process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length) !== expected) throw Error('Supply the exact reviewed --expected digest.');
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/migrations/backups');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const backup = resolve(directory, `before-legacy-checkpoint-removal-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify({ ...before, removedIds: ids }, null, 2), { flag: 'wx', mode: 0o600 });
  remote(`const tx=s.beginTransaction();try{
    if(createHash('sha256').update(JSON.stringify(stable(await snapshot(tx)))).digest('hex')!==input.expected)throw Error('Concurrent curriculum or learner-evidence change.');
    await tx.run('MATCH(l:LessonMaterial {course:"conversational-skills",level:3,chapter:1,status:"draft"}) WHERE l.id IN $ids DELETE l',{ids});
    await tx.commit();console.log('REMOVE_RESULT '+JSON.stringify({saved:true}));
  }catch(error){await tx.rollback();throw error;}`, { expected });
  const after = read();
  if (digest(after.lessons) !== digest(before.lessons.filter((l: any) => !ids.includes(l.id))) || after.evidenceDigest !== before.evidenceDigest) throw Error('Read-back mismatch; inspect backup.');
  console.log(JSON.stringify({ removed: ids, verified: true, otherLessonsAndEvidenceUnchanged: true, backup }, null, 2));
}
