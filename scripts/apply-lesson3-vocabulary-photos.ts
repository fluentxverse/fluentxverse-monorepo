import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const selectedChapter = process.argv.find(arg => arg.startsWith('--chapter='))?.slice('--chapter='.length);
if (selectedChapter && !['1', '2'].includes(selectedChapter)) throw Error('Only Chapters 1 and 2 are supported');
const chapter = selectedChapter === '2' ? 2 : 1;
const selectedLesson = process.argv.find(arg => arg.startsWith('--lesson='))?.slice('--lesson='.length);
if (chapter === 2 ? !['1', '2', '3', '4', '6', '7', '8', '9'].includes(selectedLesson || '') : selectedLesson && !['3', '4', '6', '7', '8', '9'].includes(selectedLesson)) throw Error('Supported: Chapter 1 Lessons 3, 4 and 6-9; Chapter 2 requires an explicit --lesson=1, 2, 3, 4, 6, 7, 8 or 9');
const number = chapter === 2 ? Number(selectedLesson) as 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9 : selectedLesson === '9' ? 9 : selectedLesson === '8' ? 8 : selectedLesson === '7' ? 7 : selectedLesson === '6' ? 6 : selectedLesson === '4' ? 4 : 3;
const chapter2Ids = { 1: 'conversational-skills-L3-C2-1-speaking-ja-v1', 2: 'conversational-skills-L3-C2-2-listening-ja-v1', 3: 'conversational-skills-L3-C2-3-reading-ja-v1', 4: 'conversational-skills-L3-C2-4-speaking-ja-v1', 6: 'conversational-skills-L3-C2-6-speaking-ja-v1', 7: 'conversational-skills-L3-C2-7-speaking-ja-v1', 8: 'conversational-skills-L3-C2-8-reading-ja-v1', 9: 'conversational-skills-L3-C2-9-speaking-ja-v1' };
const id = chapter === 2 ? chapter2Ids[number as 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9] : number === 9 ? 'conversational-skills-L3-C1-9-listening-ja-v1' : number === 8 ? 'conversational-skills-L3-C1-8-speaking-ja-v1' : number === 7 ? 'conversational-skills-L3-C1-7-reading-ja-v1' : number === 6 ? 'conversational-skills-L3-C1-6-listening-ja-v1' : number === 4 ? 'conversational-skills-L3-C1-4-speaking-ja-v1' : 'conversational-skills-L3-C1-3-reading-ja-v1';
const directory = resolve(import.meta.dir, `../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-${chapter}`);
const output = resolve(import.meta.dir, `../output/${chapter === 2 ? 'chapter2-' : ''}lesson${number}-vocabulary-photos`);
mkdirSync(output, { recursive: true });
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const phrases = chapter === 2 && number === 9 ? [
  ['Would you like', 'would-you-like'], ['would love to', 'would-love-to'], ['free', 'free'],
  ['meet', 'meet'], ['How about', 'how-about'], ['sounds good', 'sounds-good'],
] : chapter === 2 && number === 8 ? [
  ['costs', 'costs'], ['included', 'included'], ['extra', 'extra'],
  ['hand wash', 'hand-wash'], ['receipt', 'receipt'], ['collect', 'collect'],
] : chapter === 2 && number === 7 ? [
  ['raining', 'raining'], ['forgot', 'forgot'], ['share', 'share'],
  ['inside', 'inside'], ['waiting', 'waiting'], ['later', 'later'],
] : chapter === 2 && number === 6 ? [
  ['tall', 'tall'], ['path', 'path'], ['light', 'light'],
  ['take a photo', 'take-a-photo'], ['include', 'include'], ['see', 'see'],
] : chapter === 2 && number === 4 ? [
  ['How much', 'how-much'], ['each', 'each'], ['inside', 'inside'],
  ['would like', 'would-like'], ['pay by card', 'pay-by-card'], ['bag', 'bag'],
] : chapter === 2 && number === 3 ? [
  ['go straight', 'go-straight'], ['turn left', 'turn-left'], ['turn right at', 'turn-right-at'],
  ['walk past', 'walk-past'], ['opposite', 'opposite'], ['beside', 'beside'],
] : chapter === 2 && number === 2 ? [
  ['ticket', 'ticket'], ['platform', 'platform'], ['right train', 'right-train'],
  ['destination', 'destination'], ['change trains', 'change-trains'], ['get off', 'get-off'],
] : chapter === 2 ? [
  ['explore', 'explore'], ['day trip', 'day-trip'], ['go first', 'go-first'],
  ['free on Saturday', 'free-on-saturday'], ['meet at', 'meet-at'], ['sounds perfect', 'sounds-perfect'],
] : number === 9 ? [
  ['proud of', 'proud-of'], ['special memory', 'special-memory'], ['at first', 'at-first'],
  ['belong here', 'belong-here'], ['your support', 'your-support'], ['looking forward to', 'looking-forward-to'],
] : number === 8 ? [
  ['exhibition', 'exhibition'], ['on display', 'on-display'],
  ['ceramic cups and bowls', 'ceramic-cups-and-bowls'], ['free', 'free'],
  ['welcomes visitors', 'welcomes-visitors'], ['guest book', 'guest-book'],
] : number === 7 ? [
  ['is broken', 'is-broken'], ['worried about', 'worried-about'], ['enough', 'enough'],
  ['instead', 'instead'], ['Could you help me', 'could-you-help-me'], ['finish by', 'finish-by'],
] : number === 6 ? [
  ['organize an exhibition', 'organize-an-exhibition'], ['display our photos', 'display-our-photos'],
  ['bring her ceramic pieces', 'bring-her-ceramic-pieces'], ['prepare snacks', 'prepare-snacks'],
  ['make a poster', 'make-a-poster'], ['invite the neighbors', 'invite-the-neighbors'],
] : number === 4 ? [
  ['walked through', 'walked-through'], ['visited', 'visited'], ['photos', 'photos'],
  ['peaceful', 'peaceful'], ['favorite place', 'favorite-place'], ['feel at home', 'feel-at-home'],
] : [
  ['shared hobby', 'shared-hobby'], ['ceramics', 'ceramics'], ['free time', 'free-time'],
  ['explore', 'explore'], ['cafe entrance', 'cafe-entrance'], ['bring your camera', 'bring-your-camera'],
];
const assets = phrases.map(([phrase, slug]) => {
  const version = (chapter === 1 && number === 7 && slug === 'worried-about') || (chapter === 2 && number === 7 && slug === 'share') ? 'v3' : chapter === 2 && number === 8 && slug === 'costs' ? 'v2' : 'v1';
  const filename = `lesson${number}-vocabulary-${slug}-photo-${version}.webp`;
  const file = resolve(directory, 'images', filename);
  if (execFileSync('identify', ['-format', '%w %h', file], { encoding: 'utf8' }) !== '1536 1024') throw Error(`Unexpected dimensions: ${filename}`);
  const bytes = readFileSync(file);
  const path = `/lessons/conversational-skills/ja/l3-c${chapter}/vocabulary-photos-v1/${filename}`;
  return { phrase, filename, path, url: `https://api.fluentxverse.com/lesson/files${path}`, bytes, sha256: hash(bytes) };
});
const remote = (body: string, payload?: unknown) => {
  const code = `import{initDriver,getDriver,closeDriver}from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
    const session=getDriver().session();
    try{${payload === undefined ? '' : 'const payload=JSON.parse(await Bun.stdin.text());'}${body}}
    finally{await session.close();await closeDriver();}`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, {
    maxBuffer: 32 * 1024 * 1024, ...(payload === undefined ? {} : { input: JSON.stringify(payload) }),
  });
  const line = result.split('\n').find(line => line.startsWith('PHOTO_RESULT '));
  if (!line) throw Error('Missing remote result');
  return JSON.parse(line.slice('PHOTO_RESULT '.length));
};
const read = () => remote(`const r=await session.run('MATCH(l:LessonMaterial{id:$id}) RETURN l',{id:${JSON.stringify(id)}});
  if(r.records.length!==1)throw Error('Expected exactly one lesson');
  console.log('PHOTO_RESULT '+JSON.stringify(r.records[0].get('l').properties));`);
const before = read();
const titles = { 3: 'A Shared Hobby', 4: 'A Walk Through Kyoto', 6: 'An Interesting Idea', 7: 'An Unexpected Problem', 8: 'The Exhibition', 9: 'A Place to Call Home' };
const chapter2Titles = { 1: 'A Weekend Adventure', 2: 'The Wrong Train', 3: 'Lost in Gion', 4: 'A Taste of Kyoto', 6: 'The Bamboo Forest', 7: 'Rain at Kiyomizu-dera', 8: 'A Special Souvenir', 9: 'An Evening by the River' };
if (before.lessonName !== (chapter === 2 ? chapter2Titles[number as 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9] : titles[number])) throw Error('Unexpected lesson story');
const learn = JSON.parse(before.learnData);
const steps = learn.steps.filter((step: any) => step.stepType === 'vocabulary');
if (steps.length !== 1 || steps[0].vocabularyItems?.length !== 6) throw Error('Expected one six-item vocabulary step');
for (const asset of assets) {
  const matches = steps[0].vocabularyItems.filter((item: any) => item.highlightedWord === asset.phrase);
  if (matches.length !== 1) throw Error(`Missing or duplicate vocabulary: ${asset.phrase}`);
  matches[0].image = asset.url;
}
const manifest = assets.map(({ phrase, filename, url, sha256, bytes }) => ({ phrase, filename, url, sha256, bytes: bytes.length }));
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ id, expected: before.updatedAt, assets: manifest }, null, 2));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ dryRun: true, id, expected: before.updatedAt, assets: manifest }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length);
  if (!expected || expected !== before.updatedAt) throw Error('Supply the reviewed exact revision');
  const now = new Date().toISOString();
  mkdirSync(resolve(directory, 'backups'), { recursive: true });
  const backup = resolve(directory, 'backups', `before-lesson${number}-vocabulary-photos-${now.replace(/[:.]/g, '-')}.json`);
  writeFileSync(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  for (const asset of assets) {
    const code = `const bytes=await Bun.stdin.arrayBuffer();
      const url=(process.env.SEAWEED_FILER_URL||'http://localhost:8888')+${JSON.stringify(asset.path)};
      const existing=await fetch(url);
      if(existing.ok){
        const hash=new Bun.CryptoHasher('sha256').update(await existing.arrayBuffer()).digest('hex');
        if(hash!==${JSON.stringify(asset.sha256)})throw Error('Refusing to replace a different asset');
      }else{
        if(existing.status!==404)throw Error('Asset lookup failed '+existing.status);
        const r=await fetch(url,{method:'PUT',body:bytes,headers:{'Content-Type':'image/webp'}});
        if(!r.ok)throw Error('Upload failed '+r.status);
      }console.log('Asset ready');`;
    ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, { input: asset.bytes });
    const response = await fetch(asset.url);
    if (!response.ok || !response.headers.get('content-type')?.includes('image/webp')) throw Error(`Public image unavailable: ${asset.filename}`);
    if (hash(Buffer.from(await response.arrayBuffer())) !== asset.sha256) throw Error('Public image hash mismatch');
  }
  const updates = { learnData: JSON.stringify(learn), updatedAt: now };
  remote(`const r=await session.run('MATCH(l:LessonMaterial{id:$id}) WHERE l.updatedAt=$expected AND l.learnData=$original SET l += $updates RETURN count(l) AS updated',payload);
    if(r.records[0]?.get('updated').toNumber()!==1)throw Error('Concurrent edit detected; lesson unchanged');
    console.log('PHOTO_RESULT '+JSON.stringify({saved:true}));`, { id, expected, original: before.learnData, updates });
  const after = read(), wanted = { ...before, ...updates };
  if ([...new Set([...Object.keys(wanted), ...Object.keys(after)])].some(key => JSON.stringify(after[key]) !== JSON.stringify(wanted[key]))) throw Error('Full-record read-back mismatch');
  const preview = { ...after, level: 3, chapter, lessonNumber: number };
  for (const key of ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData']) {
    if (preview[key]) preview[key] = JSON.parse(preview[key]);
  }
  writeFileSync(resolve(output, `lesson-${number}.json`), JSON.stringify(preview, null, 2));
  console.log(JSON.stringify({ saved: true, verified: true, id, status: after.status, textAndWatercolorPreserved: true, backup, assets: manifest }, null, 2));
}
