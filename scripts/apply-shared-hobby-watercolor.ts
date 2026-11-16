import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { newBeginningIds, newBeginningWatercolor } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/new-beginning';
import { chapter2Id, chapter2Watercolor } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-2/build';

const selectedChapter = process.argv.find(arg => arg.startsWith('--chapter='))?.slice('--chapter='.length);
if (selectedChapter && !['1', '2'].includes(selectedChapter)) throw Error('Only Chapters 1 and 2 are supported');
const chapter = selectedChapter === '2' ? 2 : 1;
const directory = resolve(import.meta.dir, `../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-${chapter}`);
const selectedLesson = process.argv.find(arg => arg.startsWith('--lesson='))?.slice('--lesson='.length);
if (chapter === 2 ? !['1', '2', '3', '4', '6', '7', '8', '9'].includes(selectedLesson || '') : selectedLesson && !['3', '4', '6', '7', '8', '9'].includes(selectedLesson)) throw Error('Use Chapter 2 Lessons 1-4 and 6-9 or Chapter 1 Lessons 3, 4 and 6-9');
const number = chapter === 2 ? Number(selectedLesson) as 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9 : selectedLesson === '9' ? 9 : selectedLesson === '8' ? 8 : selectedLesson === '7' ? 7 : selectedLesson === '6' ? 6 : selectedLesson === '4' ? 4 : 3;
const output = resolve(import.meta.dir, chapter === 2 ? number !== 1 ? `../output/chapter2-lesson${number}-artwork` : '../output/weekend-adventure-watercolor' : number === 9 ? '../output/place-to-call-home-watercolor' : number === 8 ? '../output/exhibition-watercolor' : number === 7 ? '../output/unexpected-problem-watercolor' : number === 6 ? '../output/interesting-idea-watercolor' : number === 4 ? '../output/walk-through-kyoto-watercolor' : '../output/shared-hobby-watercolor');
mkdirSync(output, { recursive: true });
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const urls = chapter === 2 ? chapter2Watercolor(number as 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9, 'https://api.fluentxverse.com') : newBeginningWatercolor(number as 3 | 4 | 6 | 7 | 8 | 9, 'https://api.fluentxverse.com');
const id = chapter === 2 ? chapter2Id(number) : newBeginningIds[number];
const slots = [
  { section: 'introduce', property: 'introductionData', field: 'introImage' },
  { section: 'apply', property: 'applyData', field: 'situationImage' },
  { section: 'challenge1', property: 'missionData', field: 'image' },
] as const;
const assets = slots.map(slot => {
  const filename = new URL(urls[slot.section]).pathname.split('/').pop()!;
  const file = resolve(directory, 'images', filename);
  const dimensions = execFileSync('identify', ['-format', '%w %h', file], { encoding: 'utf8' });
  if (dimensions !== '1536 1024') throw Error(`Unexpected dimensions: ${filename}`);
  const bytes = readFileSync(file);
  const url = urls[slot.section];
  return { ...slot, filename, bytes, url, path: new URL(url).pathname.replace('/lesson/files', ''), sha256: digest(bytes) };
});
const remote = (body: string, payload?: unknown) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
    const session=getDriver().session();
    try { ${payload === undefined ? '' : 'const payload=JSON.parse(await Bun.stdin.text());'} ${body} }
    finally { await session.close(); await closeDriver(); }`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, {
    maxBuffer: 32 * 1024 * 1024, ...(payload === undefined ? {} : { input: JSON.stringify(payload) }),
  });
  const line = result.split('\n').find(line => line.startsWith('ART_RESULT '));
  if (!line) throw Error('Missing remote result');
  return JSON.parse(line.slice('ART_RESULT '.length));
};
const read = () => remote(`const r=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l',{id:${JSON.stringify(id)}});
  if(r.records.length!==1)throw Error('Expected exactly one lesson');
  console.log('ART_RESULT '+JSON.stringify(r.records[0].get('l').properties));`);
const before = read();
const titles = { 1: 'A Weekend Adventure', 3: 'A Shared Hobby', 4: 'A Walk Through Kyoto', 6: 'An Interesting Idea', 7: 'An Unexpected Problem', 8: 'The Exhibition', 9: 'A Place to Call Home' };
const chapter2Titles = { 1: 'A Weekend Adventure', 2: 'The Wrong Train', 3: 'Lost in Gion', 4: 'A Taste of Kyoto', 6: 'The Bamboo Forest', 7: 'Rain at Kiyomizu-dera', 8: 'A Special Souvenir', 9: 'An Evening by the River' };
if (before.lessonName !== (chapter === 2 ? chapter2Titles[number as 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9] : titles[number])) throw Error('Unexpected story; review the live lesson first');
const updates: Record<string, string> = {};
for (const asset of assets) {
  updates[asset.property] = JSON.stringify({ ...JSON.parse(before[asset.property]), [asset.field]: asset.url });
}
// Reading missions render image blocks, rather than the general mission image.
const mission = JSON.parse(updates.missionData!);
if (mission.missionType === 'reading') {
  if (!Array.isArray(mission.readingPassage?.blocks)) throw Error('Missing reading passage');
  if (!mission.readingPassage.blocks.some((block: any) => block.type === 'images' && block.images?.includes(urls.challenge1))) {
    mission.readingPassage.blocks.push({ type: 'images', images: [urls.challenge1] });
  }
  updates.missionData = JSON.stringify(mission);
}
updates.backgroundImage = urls.introduce;
const manifest = assets.map(({ section, filename, url, sha256, bytes }) => ({ section, filename, url, sha256, bytes: bytes.length }));
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ id: before.id, expected: before.updatedAt, assets: manifest }, null, 2));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ dryRun: true, id: before.id, expected: before.updatedAt, assets: manifest }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length);
  if (!expected || expected !== before.updatedAt) throw Error('Supply the reviewed exact revision');
  const now = new Date().toISOString();
  const backupDirectory = resolve(directory, 'backups');
  mkdirSync(backupDirectory, { recursive: true });
  const backup = resolve(backupDirectory, `before-lesson${number}-watercolor-${now.replace(/[:.]/g, '-')}.json`);
  writeFileSync(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  for (const asset of assets) {
    const code = `const bytes=await Bun.stdin.arrayBuffer();
      const url=(process.env.SEAWEED_FILER_URL||'http://localhost:8888')+${JSON.stringify(asset.path)};
      const existing=await fetch(url);
      if(existing.ok){
        const hash=new Bun.CryptoHasher('sha256').update(await existing.arrayBuffer()).digest('hex');
        if(hash!==${JSON.stringify(asset.sha256)})throw Error('Refusing to overwrite a different asset');
      }else{
        if(existing.status!==404)throw Error('Asset lookup failed '+existing.status);
        const r=await fetch(url,{method:'PUT',body:bytes,headers:{'Content-Type':'image/webp'}});
        if(!r.ok)throw Error('Upload failed '+r.status);
      }
      console.log('Asset ready');`;
    ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, { input: asset.bytes });
    const response = await fetch(asset.url);
    if (!response.ok || !response.headers.get('content-type')?.includes('image/webp')) throw Error(`Public asset unavailable: ${asset.filename}`);
    if (digest(Buffer.from(await response.arrayBuffer())) !== asset.sha256) throw Error('Public asset hash mismatch');
  }
  updates.updatedAt = now;
  const guarded = ['introductionData', 'applyData', 'missionData', 'backgroundImage'];
  const condition = guarded.map(key => `l.${key}=$before.${key}`).join(' AND ');
  remote(`const r=await session.run('MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected AND ${condition} SET l += $updates RETURN count(l) AS updated',payload);
    if(r.records[0]?.get('updated').toNumber()!==1)throw Error('Concurrent edit detected; lesson unchanged');
    console.log('ART_RESULT '+JSON.stringify({saved:true}));`, { id: before.id, expected, before, updates });
  const after = read();
  const wanted = { ...before, ...updates };
  if ([...new Set([...Object.keys(wanted), ...Object.keys(after)])].some(key => JSON.stringify(after[key]) !== JSON.stringify(wanted[key]))) throw Error('Full-record read-back mismatch');
  const preview = { ...after, level: 3, chapter, lessonNumber: number };
  for (const key of ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData']) {
    if (preview[key]) preview[key] = JSON.parse(preview[key]);
  }
  writeFileSync(resolve(output, `lesson-${number}.json`), JSON.stringify(preview, null, 2));
  console.log(JSON.stringify({ saved: true, verified: true, id: before.id, status: after.status, textAndOtherPropertiesPreserved: true, backup, assets: manifest }, null, 2));
}
