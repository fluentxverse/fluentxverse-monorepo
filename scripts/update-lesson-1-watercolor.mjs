import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const id = 'conversational-skills-L3-C1-1-speaking-1774155960030';
const directory = resolve('fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1');
const marker = 'WATERCOLOR_RESULT ';
const remote = body => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith(marker));
  if (!line) throw new Error(output);
  return JSON.parse(line.slice(marker.length));
};
const read = () => remote(`const r=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l',{id:${JSON.stringify(id)}});
  if(r.records.length!==1) throw Error('Expected one lesson');
  console.log(${JSON.stringify(marker)}+JSON.stringify(r.records[0].get('l').properties));`);
const challengeOnly = process.argv.includes('--challenge-only');
const fields = challengeOnly
  ? [{section:'challenge1', property:'missionData', image:'image'}]
  : [{section:'introduce', property:'introductionData', image:'introImage'}, {section:'apply', property:'applyData', image:'situationImage'}];
const assets = fields.map(({section,property,image}) => {
  const filename = section === 'challenge1' && process.argv.includes('--backpack')
    ? 'lesson1-challenge1-watercolor-backpack-v2.png'
    : `lesson1-${section}-watercolor-v1.png`;
  const bytes = readFileSync(resolve(directory, 'images', filename));
  const path = `/lessons/conversational-skills/ja/l3-c1/watercolor-v1/${filename}`;
  return { section, property, image, filename, bytes, path, url: `https://api.fluentxverse.com/lesson/files${path}` };
});
const before = read();
const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({dryRun:true, updatedAt:before.updatedAt, assets:assets.map(({section,url})=>({section,url}))},null,2));
} else {
  if (!expected || expected !== before.updatedAt) throw Error(`Review revision ${before.updatedAt} first`);
  const now = new Date().toISOString();
  const backup = resolve(directory, 'backups', `before-lesson-1-watercolor-${now.replace(/[:.]/g,'-')}.json`);
  writeFileSync(backup, JSON.stringify(before,null,2), {flag:'wx',mode:0o600});
  for (const asset of assets) {
    const code = `const body=await Bun.stdin.arrayBuffer(); const response=await fetch((process.env.SEAWEED_FILER_URL||'http://localhost:8888')+${JSON.stringify(asset.path)},{method:'PUT',body,headers:{'Content-Type':'image/png'}}); if(!response.ok) throw Error('Upload failed '+response.status); console.log('uploaded');`;
    ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, {input:asset.bytes});
    const response = await fetch(asset.url);
    if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) throw Error('Public image unavailable');
    const downloaded = Buffer.from(await response.arrayBuffer());
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    if (hash(downloaded) !== hash(asset.bytes)) throw Error('Public asset hash mismatch');
  }
  const changes = Object.fromEntries(assets.map(asset => {
    const data = JSON.parse(before[asset.property]);
    data[asset.image] = asset.url;
    return [asset.property, JSON.stringify(data)];
  }));
  const params = {id,expected,changes:{...changes,updatedAt:now}};
  remote(`const r=await session.run('MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected SET l += $changes RETURN l.id AS id',${JSON.stringify(params)});
    if(r.records.length!==1) throw Error('Concurrent edit detected');
    console.log(${JSON.stringify(marker)}+JSON.stringify({saved:true}));`);
  const after = read();
  const wanted = {...before,...params.changes};
  if ([...new Set([...Object.keys(after),...Object.keys(wanted)])].some(key=>JSON.stringify(after[key])!==JSON.stringify(wanted[key]))) throw Error('Read-back mismatch');
  console.log(JSON.stringify({saved:true,verified:true,updatedAt:now,backup,assets:assets.map(({section,url})=>({section,url}))},null,2));
}
