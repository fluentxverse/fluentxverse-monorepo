/** Insert the owner's approved 72 previews without rebuilding lesson content. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { chapter3ApprovedArtwork, chapter3ArtworkSlots, chapter3ArtworkUpdates } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-3/artwork';

const root = resolve(import.meta.dir, '..');
const directory = resolve(root, 'fluentxverse-server/content/conversational-skills/ja/level-3-chapter-3');
const output = resolve(root, 'output/chapter3-artwork');
mkdirSync(output, { recursive: true });
const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const digest = (v: any) => createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(stable(v))).digest('hex');
const snapshotCode = `async function snapshot(runner){const r=await runner.run('MATCH(l:LessonMaterial {course:"conversational-skills"}) WHERE l.level=3 AND l.chapter=3 RETURN l ORDER BY l.id');const m=await runner.run('MATCH(m:CourseMetadata {course:"conversational-skills"}) WHERE m.level=3 RETURN m ORDER BY m.type,m.chapter');return {lessons:r.records.map(r=>r.get('l').properties),metadata:m.records.map(r=>r.get('m').properties)};}`;
function remote(body: string, payload?: any) {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';import {createHash} from 'node:crypto';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const session=getDriver().session();${snapshotCode}try{${payload ? 'const payload=JSON.parse(await Bun.stdin.text());' : ''}${body}}finally{await session.close();await closeDriver();}`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, { maxBuffer: 32*1024*1024, ...(payload ? { input: JSON.stringify(payload) } : {}) });
  const line = result.split('\n').find(l => l.startsWith('CH3_ART '));
  if (!line) throw Error('Missing guarded artwork result');
  return JSON.parse(line.slice(8));
}
const numberOf = (v: any) => typeof v === 'number' ? v : v?.low;
const read = () => remote(`console.log('CH3_ART '+JSON.stringify(await snapshot(session)));`);
const assets = chapter3ApprovedArtwork.map(a => {
  const path = resolve(directory, 'images', a.filename), bytes = readFileSync(path);
  if (digest(bytes) !== a.webpSha256) throw Error(`Approved asset hash changed: ${a.filename}`);
  return { ...a, path, bytes };
});
if (assets.length !== 72) throw Error('Expected 72 approved assets');
const before = read();
const changes = chapter3ArtworkSlots.map(n => {
  const rows = before.lessons.filter((l: any) => numberOf(l.lessonNumber) === n);
  if (rows.length !== 1) throw Error(`Missing or duplicate lesson slot ${n}`);
  const original = rows[0], updates = chapter3ArtworkUpdates(original);
  return { id: original.id, number: n, before: original, updates };
});
const expected = digest({ snapshot: before, artwork: chapter3ApprovedArtwork });
const jsonFields = ['introductionData','learnData','stepBData','applyData','exerciseData','missionData','missionData2','feedbackData','storyData'];
function fixture(row: any) {
  return { ...row, level: numberOf(row.level), chapter: numberOf(row.chapter), lessonNumber: numberOf(row.lessonNumber), ...Object.fromEntries(jsonFields.filter(k => row[k]).map(k => [k, JSON.parse(row[k])])) };
}
for (const c of changes) writeFileSync(resolve(output, `lesson-${c.number}.json`), JSON.stringify(fixture({ ...c.before, ...c.updates }), null, 2));
const summary = { expected, lessons: changes.map(c => ({ id: c.id, lesson: c.number, status: c.before.status, images: 9 })), images: 72, watercolors: 24, realistic: 48 };
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ ...summary, assets: assets.map(({ bytes, ...a }) => a) }, null, 2));
if (!process.argv.includes('--write')) console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
else {
  if (process.argv.find(a => a.startsWith('--expected='))?.slice(11) !== expected) throw Error('Supply exact reviewed snapshot and artwork digest');
  const now = new Date().toISOString(), backups = resolve(directory, 'backups');
  mkdirSync(backups, { recursive: true });
  const backup = resolve(backups, `before-all-artwork-${now.replace(/[:.]/g, '-')}.json`);
  writeFileSync(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  // Upload immutable new objects together, avoiding 72 SSH round trips. No database mutation here.
  const uploadCode = `const items=JSON.parse(await Bun.stdin.text());const out=[];for(const a of items){const bytes=Buffer.from(a.base64,'base64');if(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')!==a.hash)throw Error('Upload input mismatch');const url=(process.env.SEAWEED_FILER_URL||'http://localhost:8888')+a.path;const existing=await fetch(url);if(existing.ok){if(new Bun.CryptoHasher('sha256').update(await existing.arrayBuffer()).digest('hex')!==a.hash)throw Error('Refusing to overwrite a different asset');}else{if(existing.status!==404)throw Error('Asset lookup failed');const r=await fetch(url,{method:'PUT',body:bytes,headers:{'Content-Type':'image/webp'}});if(!r.ok)throw Error('Upload failed '+r.status);}const verify=await fetch(url);if(!verify.ok||new Bun.CryptoHasher('sha256').update(await verify.arrayBuffer()).digest('hex')!==a.hash)throw Error('Stored asset mismatch');out.push(a.path);}console.log('UPLOADED '+out.length);`;
  const upload = ssh(`docker exec -i fluentxverse-server bun -e ${quote(uploadCode)}`, { input: JSON.stringify(assets.map(a => ({ path: a.storagePath, hash: a.webpSha256, base64: a.bytes.toString('base64') }))), maxBuffer: 1024*1024 });
  if (!upload.includes('UPLOADED 72')) throw Error('Upload result missing');
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < assets.length) {
      const a = assets[next++]!;
      const response = await fetch(a.url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok || !response.headers.get('content-type')?.includes('image/webp') || digest(Buffer.from(await response.arrayBuffer())) !== a.webpSha256) throw Error(`Public asset verification failed: ${a.filename}`);
    }
  }));
  const items = changes.map(c => ({ ...c, updates: { ...c.updates, updatedAt: now } }));
  const guards = ['introductionData','applyData','missionData','learnData','backgroundImage','status','updatedAt'].map(k => `l.${k}=$before.${k}`).join(' AND ');
  remote(`const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;const tx=session.beginTransaction();try{const current=await snapshot(tx);if(createHash('sha256').update(JSON.stringify(stable(current))).digest('hex')!==payload.snapshotDigest)throw Error('Concurrent edit detected; no references changed');for(const item of payload.items){const r=await tx.run('MATCH(l:LessonMaterial {id:$id}) WHERE ${guards} SET l += $updates RETURN count(l) AS n',{id:item.id,before:item.before,updates:item.updates});if(r.records[0]?.get('n').toNumber()!==1)throw Error('Concurrent edit detected; rollback all image references');}await tx.commit();console.log('CH3_ART '+JSON.stringify({saved:true}));}catch(e){await tx.rollback();throw e;}`, { snapshotDigest: digest(before), items });
  const after = read();
  if (after.lessons.length !== before.lessons.length || digest(after.metadata) !== digest(before.metadata)) throw Error('Unexpected chapter count or metadata change');
  for (const old of before.lessons) {
    const actual = after.lessons.find((l: any) => l.id === old.id), change = items.find(c => c.id === old.id);
    if (digest(actual) !== digest({ ...old, ...(change?.updates || {}) })) throw Error('Full-record read-back mismatch');
    if (change) writeFileSync(resolve(output, `lesson-${change.number}.json`), JSON.stringify(fixture(actual), null, 2));
  }
  console.log(JSON.stringify({ saved: true, verified: true, images: 72, lessons: 8, publicAssetsVerified: true, textStatusIdentityFeedbackAndLearnerPropertiesPreserved: true, checkpointsAndMetadataUnchanged: true, backup, updatedAt: now }, null, 2));
}
