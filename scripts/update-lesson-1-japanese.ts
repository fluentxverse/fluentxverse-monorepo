import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { lesson1Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/lesson-1-trivia';

const objective = '自分について詳しく紹介し、相手の話を受けてさらに質問できる。';
const previousObjective = '自分について少し詳しく紹介し、相手の話に続けて質問できる。';
const edits = [
  { field: 'goalTextJp', path: [], before: previousObjective, after: objective },
  { field: 'feedbackData', path: ['goalJp'], before: previousObjective, after: objective },
  { field: 'learnData', path: ['steps', 0, 'vocabularyItems', 3, 'translation'], before: '誰かと知り合う', after: '相手のことを知る' },
  {
    field: 'stepBData', path: ['grammarTip', 'explanations', 0, 'ruleTranslation'],
    before: "引っ越した時点を言うときは「I moved to Kyoto last month.」を使います。今も続いていることは「I've been living ...」の形で表します。期間には for、始まった時点には since を使います。",
    after: '過去に完了した引っ越しには過去形を使います。過去から今まで続いている活動には「have / has been ＋ 動詞の-ing形」を使います。期間には for、始まった時点には since を使います。',
  },
  {
    field: 'exerciseData', path: ['stepBInstructionTranslation'],
    before: '新しい住人として、自分の情報または考えた情報で会話を完成させましょう。理由と期間を伝え、クレアにも質問しましょう。',
    after: '新しい住人のせりふを、自分の情報や架空の設定で完成させましょう。理由と期間を伝え、クレアの話を受けてさらに質問しましょう。',
  },
];

const remote = (body: string) => {
  const code = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
    const session=getDriver().session();
    try { ${body} } finally { await session.close(); await closeDriver(); }`;
  const output = ssh(`docker exec fluentxverse-server bun -e ${quote(code)}`);
  const line = output.split('\n').find(line => line.startsWith('JAPANESE_RESULT '));
  if (!line) throw new Error(`Missing database result: ${output}`);
  return JSON.parse(line.slice('JAPANESE_RESULT '.length));
};
const read = () => remote(`
  const result=await session.run('MATCH (l:LessonMaterial {id:$id}) RETURN l', {id:${JSON.stringify(lesson1Id)}});
  if(result.records.length!==1) throw new Error('Expected exactly one Lesson 1.');
  console.log('JAPANESE_RESULT '+JSON.stringify(result.records[0].get('l').properties));`);

const before = read();
const updates: Record<string, string> = {};
for (const edit of edits) {
  if (!edit.path.length) {
    if (before[edit.field] !== edit.before) throw new Error(`Unexpected current text in ${edit.field}.`);
    updates[edit.field] = edit.after;
    continue;
  }
  const data = JSON.parse(updates[edit.field] ?? before[edit.field]);
  let parent = data;
  for (const key of edit.path.slice(0, -1)) parent = parent[key];
  const key = edit.path.at(-1)!;
  if (parent[key] !== edit.before) throw new Error(`Unexpected current text in ${edit.field}.${edit.path.join('.')}.`);
  parent[key] = edit.after;
  updates[edit.field] = JSON.stringify(data);
}

if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ id: lesson1Id, expectedUpdatedAt: before.updatedAt, edits, dryRun: true }, null, 2));
} else {
  const expected = process.argv.find(arg => arg.startsWith('--expected-updated-at='))?.slice('--expected-updated-at='.length);
  if (!expected || expected !== before.updatedAt) throw new Error(`Review revision ${before.updatedAt} and pass --expected-updated-at explicitly.`);
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/backups');
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-lesson-1-japanese-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  updates.updatedAt = now;
  const params = { id: lesson1Id, expected, updates, previous: Object.fromEntries(Object.keys(updates).filter(key => key !== 'updatedAt').map(key => [key, before[key]])) };
  const guard = Object.keys(params.previous).map(key => `l.${key}=$previous.${key}`).join(' AND ');
  remote(`
    const result=await session.run(
      'MATCH (l:LessonMaterial {id:$id}) WHERE l.updatedAt=$expected AND ${guard} SET l += $updates RETURN l.id AS id',
      ${JSON.stringify(params)});
    if(result.records.length!==1) throw new Error('Concurrent edit detected; no lesson content overwritten.');
    console.log('JAPANESE_RESULT '+JSON.stringify({saved:true}));`);
  const after = read();
  const expectedRecord = { ...before, ...updates };
  const keys = new Set([...Object.keys(after), ...Object.keys(expectedRecord)]);
  if ([...keys].some(key => JSON.stringify(after[key]) !== JSON.stringify(expectedRecord[key]))) {
    throw new Error('Post-save verification mismatch; inspect the live record and backup.');
  }
  console.log(JSON.stringify({ id: lesson1Id, updatedAt: now, translationsChanged: edits.length, backup, verified: true }, null, 2));
}
