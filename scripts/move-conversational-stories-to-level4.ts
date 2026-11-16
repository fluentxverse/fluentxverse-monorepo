import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { planConversationalLevel4Move, type CurriculumSnapshot } from './lib/conversational-level4-plan';

const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const numberOf = (value: any) => typeof value === 'number' ? value : value?.low;
const snapshotCode = `const stable=${stable.toString()};
async function snapshot(runner) {
  const lessons=await runner.run('MATCH(l:LessonMaterial {course:"conversational-skills"}) WHERE l.level IN [3,4] RETURN l ORDER BY l.id');
  const metadata=await runner.run('MATCH(m:CourseMetadata {course:"conversational-skills"}) WHERE m.level IN [3,4] RETURN m ORDER BY m.type,m.level,m.chapter');
  const refs=await runner.run('MATCH(n) WHERE n.lessonId IS NOT NULL OR n.materialId IS NOT NULL OR n.sourceLessonIds IS NOT NULL OR n.lastViewedLessonId IS NOT NULL OR n.materialJson IS NOT NULL OR n.snapshotJson IS NOT NULL RETURN id(n) AS id,n.lessonId AS lessonId,n.materialId AS materialId,n.sourceLessonIds AS sourceLessonIds,n.lastViewedLessonId AS lastViewedLessonId,n.materialJson AS materialJson,n.snapshotJson AS snapshotJson ORDER BY id');
  const hits=refs.records.map(r=>r.toObject()).filter(row=>/conversational-skills-L3-C(?:6|7|8|9|10)-/.test(JSON.stringify(row)));
  return {lessons:lessons.records.map(r=>r.get('l').properties),metadata:metadata.records.map(r=>r.get('m').properties),evidence:{count:hits.length,digest:createHash('sha256').update(JSON.stringify(stable(hits))).digest('hex')}};
}`;
const remote = (body: string, input?: unknown): any => {
  const code = `import neo4j from 'neo4j-driver';import {createHash} from 'node:crypto';import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();${snapshotCode}
    try {${input === undefined ? '' : 'const input=JSON.parse(await Bun.stdin.text());'}${body}}finally{await s.close();await closeDriver();}`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, input === undefined ? {} : { input: JSON.stringify(input) });
  const line = result.split('\n').find(line => line.startsWith('MOVE_RESULT '));
  if (!line) throw Error('Missing migration result.');
  return JSON.parse(line.slice('MOVE_RESULT '.length));
};
const read = (): CurriculumSnapshot => remote(`console.log('MOVE_RESULT '+JSON.stringify(await snapshot(s)));`);
const before = read(), expected = digest(before), now = new Date().toISOString();
const plan = planConversationalLevel4Move(before, now);
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ dryRun: true, expected, lessons: plan.lessons.length, mapping: plan.metadata.map(row => ({ from: `Level 3 Chapter ${row.fromChapter}`, to: `Level 4 Chapter ${row.patch.chapter}` })), stableIds: true, learnerReferences: before.evidence.count }, null, 2));
} else {
  if (process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length) !== expected) throw Error('Review a fresh dry run and provide its exact --expected digest.');
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/migrations/backups');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const backup = resolve(directory, `before-level4-move-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  remote(`const tx=s.beginTransaction();try {
    const current=await snapshot(tx);
    if(createHash('sha256').update(JSON.stringify(stable(current))).digest('hex')!==input.expected)throw Error('Concurrent curriculum/evidence change; nothing moved.');
    for(const move of input.plan.lessons){
      const patch={...move.patch,level:neo4j.int(move.patch.level),chapter:neo4j.int(move.patch.chapter)};
      const result=await tx.run('MATCH(l:LessonMaterial {id:$id,course:"conversational-skills",level:3,chapter:$fromChapter,status:"draft"}) SET l += $patch RETURN l',{id:move.id,fromChapter:neo4j.int(move.fromChapter),patch});
      if(result.records.length!==1)throw Error('Source draft changed or duplicated.');
    }
    for(const move of input.plan.metadata){
      const patch={...move.patch,level:neo4j.int(move.patch.level),chapter:neo4j.int(move.patch.chapter)};
      const result=await tx.run('MATCH(m:CourseMetadata {course:"conversational-skills",type:"chapter",level:3,chapter:$fromChapter}) SET m += $patch RETURN m',{fromChapter:neo4j.int(move.fromChapter),patch});
      if(result.records.length!==1)throw Error('Source chapter metadata changed or duplicated.');
    }
    await tx.commit();console.log('MOVE_RESULT '+JSON.stringify({saved:true}));
  }catch(error){await tx.rollback();throw error;}`, { expected, plan });
  const after = read();
  const wantedLessons = before.lessons.map(row => {
    const move = plan.lessons.find(move => move.id === row.id);
    const actual = after.lessons.find(item => item.id === row.id);
    return move ? { ...row, ...move.patch, level: actual?.level, chapter: actual?.chapter } : row;
  });
  const wantedMetadata = before.metadata.map(row => {
    const move = numberOf(row.level) === 3 && row.type === 'chapter' ? plan.metadata.find(move => move.fromChapter === numberOf(row.chapter)) : undefined;
    if (!move) return row;
    const actual = after.metadata.find(item => item.type === 'chapter' && numberOf(item.level) === 4 && numberOf(item.chapter) === move.patch.chapter);
    return { ...row, ...move.patch, level: actual?.level, chapter: actual?.chapter };
  });
  const byId = (rows: any[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const bySlot = (rows: any[]) => [...rows].sort((a, b) => `${a.type}:${numberOf(a.level)}:${numberOf(a.chapter)}`.localeCompare(`${b.type}:${numberOf(b.level)}:${numberOf(b.chapter)}`));
  if (digest(byId(after.lessons)) !== digest(byId(wantedLessons)) || digest(bySlot(after.metadata)) !== digest(bySlot(wantedMetadata)) || digest(after.evidence) !== digest(before.evidence)) throw Error('Read-back verification failed; inspect backup before any further changes.');
  console.log(JSON.stringify({ saved: true, verified: true, lessonsMoved: plan.lessons.length, chapterMetadataMoved: plan.metadata.length, idsAndLessonContentPreserved: true, earlierChaptersAndEvidenceUnchanged: true, backup }, null, 2));
}
