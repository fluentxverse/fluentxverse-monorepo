import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { directRoleplayCopy } from '../fluentxverse-server/content/conversational-skills/ja/direct-roleplay-copy';

const fields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'missionData3', 'feedbackData', 'storyData'];
const remote = (body: string, payload?: unknown) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();try{${payload === undefined ? '' : 'const payload=JSON.parse(await Bun.stdin.text());'}${body}}finally{await s.close();await closeDriver();}`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, payload === undefined ? {} : { input: JSON.stringify(payload) });
  const line = result.split('\n').find(line => line.startsWith('COPY_RESULT '));
  if (!line) throw Error(result);
  return JSON.parse(line.slice('COPY_RESULT '.length));
};
const read = () => remote(`const r=await s.run('MATCH (l:LessonMaterial {course:"conversational-skills"}) WHERE l.level=3 AND l.chapter IN [1,2] AND l.lessonNumber IN [1,2,3,4,6,7,8,9] RETURN l ORDER BY l.id');console.log('COPY_RESULT '+JSON.stringify(r.records.map(r=>r.get('l').properties)));`);
const before = read();
const expected = createHash('sha256').update(JSON.stringify(before)).digest('hex');
const changes: any[] = [];
const output = resolve(import.meta.dir, '../output/direct-roleplay-copy');
await mkdir(output, { recursive: true });
for (const raw of before) {
  const updates: Record<string, string> = {};
  const preview: any = { ...raw, level: 3, chapter: typeof raw.chapter === 'number' ? raw.chapter : raw.chapter.low, lessonNumber: typeof raw.lessonNumber === 'number' ? raw.lessonNumber : raw.lessonNumber.low };
  for (const key of fields) {
    if (!raw[key]) continue;
    const parsed = JSON.parse(raw[key]);
    const next = directRoleplayCopy(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(next)) updates[key] = JSON.stringify(next);
    preview[key] = next;
  }
  if (Object.keys(updates).length) changes.push({ id: raw.id, expected: raw.updatedAt, updates });
  await writeFile(resolve(output, `${raw.id}.json`), JSON.stringify(preview, null, 2));
}
if (!process.argv.includes('--write')) console.log(JSON.stringify({ dryRun: true, expected, checked: before.length, changes: changes.map(change => ({ id: change.id, fields: Object.keys(change.updates) })) }, null, 2));
else {
  if (process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length) !== expected) throw Error('Review and pass the current snapshot digest.');
  if (!changes.length) { console.log(JSON.stringify({ alreadyCorrect: true })); process.exit(0); }
  const now = new Date().toISOString();
  const backupDirectory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/backups');
  await mkdir(backupDirectory, { recursive: true });
  const backup = resolve(backupDirectory, `before-direct-roleplay-copy-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const items = changes.map(change => ({ ...change, updates: { ...change.updates, updatedAt: now } }));
  remote(`const r=await s.run('UNWIND $items AS item MATCH (l:LessonMaterial {id:item.id}) WHERE l.updatedAt=item.expected WITH collect({lesson:l,updates:item.updates}) AS matched WHERE size(matched)=$count UNWIND matched AS pair WITH pair.lesson AS l,pair.updates AS updates SET l += updates RETURN count(l) AS updated',payload);if(r.records[0]?.get('updated').toNumber()!==payload.count)throw Error('Concurrent edit detected; no copy overwritten');console.log('COPY_RESULT '+JSON.stringify({saved:true}));`, { items, count: items.length });
  const after = read();
  if (after.length !== before.length) throw Error('Lesson count changed');
  for (const original of before) {
    const actual = after.find((raw: any) => raw.id === original.id);
    const wanted = { ...original, ...(items.find(item => item.id === original.id)?.updates || {}) };
    if ([...new Set([...Object.keys(actual), ...Object.keys(wanted)])].some(key => JSON.stringify(actual[key]) !== JSON.stringify(wanted[key]))) throw Error('Full record read-back mismatch');
  }
  console.log(JSON.stringify({ verified: true, checked: before.length, corrected: items.length, imageReferencesAndStatusesPreserved: true, backup }, null, 2));
}
