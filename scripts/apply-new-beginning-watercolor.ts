import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { newBeginningIds, newBeginningWatercolor } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/new-beginning';

const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1');
const output = resolve(import.meta.dir, '../output/new-beginning-watercolor');
mkdirSync(output, { recursive: true });
const prompts = JSON.parse(readFileSync(resolve(directory, 'new-beginning-watercolor-prompts.json'), 'utf8'));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const assets = prompts.scenes.map((scene: any) => {
  const filename = scene.file.replace(/\.png$/, '.webp');
  const source = resolve(directory, 'images', scene.file), file = resolve(directory, 'images', filename);
  if (!existsSync(file)) execFileSync('magick', [source, '-quality', '88', file]);
  const dimensions = execFileSync('identify', ['-format', '%w %h', file], { encoding: 'utf8' }).trim();
  if (dimensions !== '1536 1024') throw Error(`Unexpected image dimensions: ${filename}: ${dimensions}`);
  const bytes = readFileSync(file);
  const url = newBeginningWatercolor(scene.lesson, 'https://api.fluentxverse.com')[scene.section as 'introduce' | 'apply' | 'challenge1'];
  const path = new URL(url).pathname.replace('/lesson/files', '');
  return { ...scene, filename, bytes, path, url, sha256: hash(bytes) };
});
const remote = (body: string, payload?: unknown) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
    const session=getDriver().session();
    try { ${payload === undefined ? '' : 'const payload=JSON.parse(await Bun.stdin.text());'} ${body} } finally { await session.close(); await closeDriver(); }`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, payload === undefined ? {} : { input: JSON.stringify(payload) });
  const line = result.split('\n').find(line => line.startsWith('ART_RESULT '));
  if (!line) throw Error(result);
  return JSON.parse(line.slice('ART_RESULT '.length));
};
const ids = [newBeginningIds[1], newBeginningIds[2]];
const read = () => remote(`const r=await session.run('MATCH (l:LessonMaterial) WHERE l.id IN $ids RETURN l',{ids:${JSON.stringify(ids)}}); if(r.records.length!==2) throw Error('Expected Lessons 1 and 2'); console.log('ART_RESULT '+JSON.stringify(r.records.map(row=>row.get('l').properties)));`);
const before = read();
const changes = [1, 2].map(number => {
  const original = before.find((record: any) => record.id === newBeginningIds[number as 1 | 2]);
  const fields: any = {};
  for (const asset of assets.filter((asset: any) => asset.lesson === number)) {
    const [property, image] = asset.section === 'introduce' ? ['introductionData', 'introImage'] : asset.section === 'apply' ? ['applyData', 'situationImage'] : ['missionData', 'image'];
    fields[property] = JSON.stringify({ ...JSON.parse(original[property]), [image]: asset.url });
    if (asset.section === 'introduce') fields.backgroundImage = asset.url;
  }
  const jsonFields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
  const merged = { ...original, ...fields };
  const preview = { ...merged, level: 3, chapter: 1, lessonNumber: number, ...Object.fromEntries(jsonFields.map(key => [key, merged[key] ? JSON.parse(merged[key]) : null])) };
  writeFileSync(resolve(output, `lesson-${number}.json`), JSON.stringify(preview, null, 2));
  return { id: original.id, expected: original.updatedAt, updates: fields };
});
const revisions = Object.fromEntries(changes.map((change, i) => [i + 1, change.expected]));
const manifest = assets.map(({ lesson, section, filename, url, sha256, bytes }: any) => ({ lesson, section, filename, url, sha256, bytes: bytes.length }));
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
if (!process.argv.includes('--write')) console.log(JSON.stringify({ dryRun: true, revisions, assets: manifest }, null, 2));
else {
  const expected = process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length);
  if (!expected || JSON.stringify(JSON.parse(expected)) !== JSON.stringify(revisions)) throw Error('Review and supply the exact revision map.');
  const now = new Date().toISOString();
  const backup = resolve(directory, 'backups', `before-new-beginning-watercolor-${now.replace(/[:.]/g, '-')}.json`);
  writeFileSync(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  for (const asset of assets) {
    const code = `const body=await Bun.stdin.arrayBuffer(); const r=await fetch((process.env.SEAWEED_FILER_URL||'http://localhost:8888')+${JSON.stringify(asset.path)},{method:'PUT',body,headers:{'Content-Type':'image/webp'}}); if(!r.ok) throw Error('Upload failed '+r.status); console.log('uploaded');`;
    ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, { input: asset.bytes });
    const response = await fetch(asset.url);
    if (!response.ok || !response.headers.get('content-type')?.includes('image/webp')) throw Error(`Public image unavailable: ${asset.filename}`);
    if (hash(Buffer.from(await response.arrayBuffer())) !== asset.sha256) throw Error('Public asset hash mismatch');
  }
  const items = changes.map(change => ({ ...change, updates: { ...change.updates, updatedAt: now } }));
  remote(`const r=await session.run('UNWIND $items AS item MATCH (l:LessonMaterial {id:item.id}) WHERE l.updatedAt=item.expected WITH collect({lesson:l,updates:item.updates}) AS matched WHERE size(matched)=2 UNWIND matched AS pair WITH pair.lesson AS l,pair.updates AS updates SET l += updates RETURN count(l) AS updated',payload); if(r.records[0]?.get('updated').toNumber()!==2) throw Error('Concurrent edit detected; no lesson references changed'); console.log('ART_RESULT '+JSON.stringify({saved:true}));`, { items });
  const after = read();
  for (const original of before) {
    const actual = after.find((record: any) => record.id === original.id);
    const wanted = { ...original, ...items.find(item => item.id === original.id)!.updates };
    if ([...new Set([...Object.keys(actual), ...Object.keys(wanted)])].some(key => JSON.stringify(actual[key]) !== JSON.stringify(wanted[key]))) throw Error('Full read-back mismatch');
  }
  console.log(JSON.stringify({ saved: true, verified: true, images: assets.length, textAndStatusPreserved: true, updatedAt: now, backup, assets: manifest }, null, 2));
}
