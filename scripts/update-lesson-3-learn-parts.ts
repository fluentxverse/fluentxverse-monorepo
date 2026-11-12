import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildLesson3LearnParts } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-3-learn-parts';

const id = 'conversational-skills-L3-C1-3-reading-ja-v1';
const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('LEARN_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('LEARN_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l', {id:${JSON.stringify(id)}});
  if(result.records.length!==1) throw new Error('Expected exactly one Lesson 3.');
  console.log('LEARN_RESULT '+JSON.stringify(result.records[0].get('l').properties));`);
const before = read();
const learn = JSON.parse(before.learnData);
const steps = learn.steps.filter((step: any) => step.stepType === 'vocabulary');
if (steps.length !== 1) throw new Error('Expected one vocabulary step.');
const step = steps[0];
const simplifyPronunciation = process.argv.includes('--simplify-pronunciation');
if (simplifyPronunciation) {
  const current = step.pronunciationPart;
  if (JSON.stringify(current?.leftColumn?.words?.map((word: any) => word.word)) !== JSON.stringify(['thirteen', 'fourteen', 'fifteen']) ||
      JSON.stringify(current?.rightColumn?.words?.map((word: any) => word.word)) !== JSON.stringify(['thirty', 'forty', 'fifty'])) {
    throw new Error('Expected the existing number pronunciation activity; review changed content first.');
  }
  step.pronunciationPart = buildLesson3LearnParts({ cityBike: '', electricBike: '', extras: '' }).pronunciationPart;
} else {
  if (step.discussionPart || step.pronunciationPart) throw new Error('A part already exists; review it rather than overwriting.');
  const image = (phrase: string) => {
    const item = step.vocabularyItems.find((item: any) => item.highlightedWord === phrase);
    if (!item?.image?.startsWith('https://')) throw new Error(`Missing existing picture for ${phrase}.`);
    return item.image;
  };
  Object.assign(step, buildLesson3LearnParts({ cityBike: image('city bike'), electricBike: image('electric-assist bike'), extras: image('additional fee') }));
}
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ id, expectedUpdatedAt: before.updatedAt, discussionPart: step.discussionPart, pronunciationPart: step.pronunciationPart, dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  if (expected !== before.updatedAt) throw new Error(`Review current revision ${before.updatedAt} first.`);
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-3-${simplifyPronunciation ? 'basic-pronunciation' : 'learn-parts'}-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const params = { id, expected, previous: before.learnData, next: JSON.stringify(learn), now };
  remote(`
    const result=await session.run(
      'MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected AND l.learnData=$previous SET l.learnData=$next, l.updatedAt=$now RETURN l.id AS id',
      ${JSON.stringify(params)});
    if(result.records.length!==1) throw new Error('Concurrent edit detected; no content overwritten.');
    console.log('LEARN_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  const expectedRecord = { ...before, learnData: params.next, updatedAt: now };
  const keys = new Set([...Object.keys(after), ...Object.keys(expectedRecord)]);
  if ([...keys].some(key => JSON.stringify(after[key]) !== JSON.stringify(expectedRecord[key]))) throw new Error('Post-save verification mismatch.');
  console.log(JSON.stringify({ id, backup, verified: true }));
}
