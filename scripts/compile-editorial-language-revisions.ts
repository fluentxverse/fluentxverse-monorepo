import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { languageSlots } from '../fluentxverse-server/content/conversational-skills/ja/language-catalog';
import { directRoleplayCopy } from '../fluentxverse-server/content/conversational-skills/ja/direct-roleplay-copy';
import { languageEpisodeErrors } from '../fluentxverse-server/content/conversational-skills/ja/language-validation';
import { editSimpleLesson } from '../fluentxverse-server/content/conversational-skills/ja/editorial-lesson';
import { chapter2Simple } from '../fluentxverse-server/content/conversational-skills/ja/editorial-chapter2';
import { chapter3Simple } from '../fluentxverse-server/content/conversational-skills/ja/editorial-chapter3';
import { chapter4Simple } from '../fluentxverse-server/content/conversational-skills/ja/editorial-chapter4';
import { chapter5Simple } from '../fluentxverse-server/content/conversational-skills/ja/editorial-chapter5';
import { editorialCorrections } from '../fluentxverse-server/content/conversational-skills/ja/editorial-corrections';

// This compiler has no network or model client. All new wording is authored in source.
const directory = resolve(import.meta.dir, '../fluentxverse-server/content/conversational-skills/ja/toeic-revisions-v1');
const output = resolve(import.meta.dir, '../output/toeic-language-revisions/editorial');
await mkdir(output, { recursive: true });
const goals: Record<string, [string, string]> = {
  '4:2:4': ['I can propose an event and confirm who will help.', 'イベントを提案し、誰が手伝うか確認できる。'],
  '4:2:6': ['I can explain a cooking mistake and choose a better plan.', '料理の失敗を説明し、よりよい計画を選べる。'],
  '4:2:9': ['I can celebrate progress and discuss a possible next step.', '進歩を祝い、次の行動の可能性を話し合える。'],
  '4:3:8': ['I can read a work message and check facts before guessing.', '仕事の連絡を読み、推測する前に事実を確認できる。'],
  '4:3:9': ['I can talk about feelings and agree on a simple plan.', '気持ちを話し、簡単な予定に合意できる。'],
  '4:4:9': ['I can discuss an opportunity and ask what needs checking.', '新しい機会について話し、確認すべきことを尋ねられる。'],
  '4:5:4': ['I can greet a host and talk about my work and plans.', '迎えてくれた人に挨拶し、仕事と計画を話せる。'],
  '4:5:6': ['I can explain a shop budget and check costs before deciding.', '店舗の予算を説明し、決める前に費用を確認できる。'],
  '4:5:7': ['I can suggest a small trial and check the conditions.', '小さな試行を提案し、条件を確認できる。'],
  '4:5:9': ['I can celebrate, thank a friend, and welcome a new resident.', 'お祝いと友人への感謝を伝え、新しい住人を迎えられる。'],
};
const specs: Record<number, Record<number, any>> = { 2: chapter2Simple, 3: chapter3Simple, 4: chapter4Simple, 5: chapter5Simple };
function normalize(raw: any, skill: string): any {
  const e = structuredClone(raw);
  const name = (v: string) => (v.match(/^(?:Tutor|Teacher|Student|Learner)\s*\(([^)]+)\)/i)?.[1] || v.replace(/^(?:Tutor|Teacher|Student|Learner)\s*:\s*/i, '')).replace(/\s*\([^)]*\)\s*$/, '').trim();
  e.skill = skill;
  e.goal[0] = e.goal[0].replace(/^You can /, 'I can ');
  e.mission.roles = e.mission.roles.map(name);
  if (e.apply.roles) e.apply.roles = e.apply.roles.map(name);
  if (skill === 'speaking') {
    e.apply.dialogue = e.apply.dialogue.map(([speaker, text]: string[]) => [/^(tutor|teacher)$/i.test(speaker!) ? e.apply.roles[0] : /^(student|learner)$/i.test(speaker!) ? e.apply.roles[1] : name(speaker!), text]);
    delete e.apply.text; delete e.mission.text;
  } else { delete e.apply.roles; delete e.apply.dialogue; }
  e.topics = e.topics.map((t: any) => Array.isArray(t) ? t : [t.title, t.questions]);
  return directRoleplayCopy(e);
}
const candidates: any[] = [];
const failures: any[] = [];
for (const slot of languageSlots) {
  const file = `L${slot.level}-C${slot.chapter}-${slot.number}.json`;
  const path = resolve(directory, file);
  const oldText = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  const saved = oldText ? JSON.parse(oldText) : undefined;
  const source = directRoleplayCopy(structuredClone(slot.episodes[slot.number]));
  let e: any;
  const spec = slot.level === 3 ? specs[slot.chapter]?.[slot.number] : undefined;
  if (saved) {
    e = editorialCorrections(slot.key, saved.episode);
    if (JSON.stringify(e) === JSON.stringify(saved.episode)) continue;
  } else if (spec) e = editSimpleLesson(source, slot.chapter, spec);
  else {
    const rawPath = resolve(import.meta.dir, `../output/toeic-language-revisions/drafts/${file}`);
    if (!existsSync(rawPath)) throw Error(`Missing directly authored revision ${slot.key}`);
    e = normalize(JSON.parse(readFileSync(rawPath, 'utf8')), source.skill);
    if (goals[slot.key]) e.goal = goals[slot.key];
    if (slot.key === '3:1:2') e.apply.text = "<p>Hi, I'm Leo. I grew up in Bristol. I moved to Kyoto last spring because I got a bakery job. I used to work in a hotel kitchen. Now I make bread early in the morning. Every Sunday, I help Claire at this cafe. I brought fresh bread. Please try some!</p>";
    if (slot.key === '3:1:6') e.apply.dialogue = ['I have an idea. Let’s have an exhibition.', 'What can we show?', 'Your Kyoto photos. Nao offered her ceramics too.', 'Great. Leo will prepare snacks.', 'Yes. What can you do?', 'I can make a poster and choose photos.', 'Let’s hold it on Sunday, two to four.', 'Good. Who can we invite?', 'Our neighbors. Can you help?', 'Yes. I can invite them.'].map((text, i) => [i % 2 ? 'Emma' : 'Claire', text]);
    if (slot.key === '3:2:3') e.mission.text = source.mission.text;
  }
  e = editorialCorrections(slot.key, e);
  if (slot.level === 3 && slot.chapter === 2 && slot.number === 9) e.mission.roles = ['Leo', 'Emma'];
  const errors = languageEpisodeErrors(e, slot.level, source.skill);
  if (e.title !== source.title) errors.push('Title changed');
  if (errors.length) failures.push({slot: slot.key, errors});
  const candidate = {version: 'toeic-v1', level: slot.level, chapter: slot.chapter, number: slot.number,
    sourceDigest: createHash('sha256').update(JSON.stringify(source)).digest('hex'), episode: e,
    review: {approved: false, issues: errors, method: 'direct-editorial', note: 'Edited locally against the existing story. No model API calls.'}};
  candidates.push({candidate, path, oldText});
  await writeFile(resolve(output, file), JSON.stringify(candidate, null, 2));
}
console.log(JSON.stringify({candidates:candidates.length, failures, output, modelApiCalls:0}, null, 2));
if (failures.length) process.exitCode = 1;
else if (process.argv.includes('--approve')) {
  for (const {candidate,path,oldText} of candidates) {
    candidate.review.approved = true;
    if (oldText !== undefined && readFileSync(path,'utf8') !== oldText) throw Error('Concurrent local editorial change');
    await writeFile(path, JSON.stringify(candidate, null, 2), {flag:oldText === undefined?'wx':'w'});
  }
  console.log(`Saved ${candidates.length} directly reviewed revisions.`);
}
