import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { buildKyotoLesson, chapter2Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-2/build';
import { buildEverydayLesson, chapter3Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-3/build';
import { buildCareerLesson, chapter4Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-4/build';
import { buildTwoCitiesLesson, chapter5Id } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-5/build';
import { buildAfterTruthLesson, afterTruthId } from '../fluentxverse-server/content/conversational-skills/ja/level-4-chapter-1/build';
import { buildNewPathsLesson, newPathsId } from '../fluentxverse-server/content/conversational-skills/ja/level-4-chapter-2/build';
import { buildLittleCloserLesson, littleCloserId } from '../fluentxverse-server/content/conversational-skills/ja/level-4-chapter-3/build';
import { buildDreamsInMotionLesson, dreamsInMotionId } from '../fluentxverse-server/content/conversational-skills/ja/level-4-chapter-4/build';
import { buildWhereWeBelongLesson, whereWeBelongId } from '../fluentxverse-server/content/conversational-skills/ja/level-4-chapter-5/build';
import { buildFirstImpressionsLesson, firstImpressionsId } from '../fluentxverse-server/content/conversational-skills/ja/level-5-chapter-1/build';
import { buildMissingProposalLesson, missingProposalId } from '../fluentxverse-server/content/conversational-skills/ja/level-5-chapter-3/build';
import { buildDifficultChoicesLesson, difficultChoicesId } from '../fluentxverse-server/content/conversational-skills/ja/level-5-chapter-4/build';
import { buildPriceOfTruthLesson, priceOfTruthId } from '../fluentxverse-server/content/conversational-skills/ja/level-5-chapter-5/build';
import { buildTraditionsLesson, traditionsId } from '../fluentxverse-server/content/conversational-skills/en/level-6-chapter-1/build';
import { buildBeyondWorkshopLesson, beyondWorkshopId } from '../fluentxverse-server/content/conversational-skills/en/level-6-chapter-2/build';
import { buildTasteTraditionLesson, tasteTraditionId } from '../fluentxverse-server/content/conversational-skills/en/level-6-chapter-3/build';
import { buildLeaveBehindLesson, leaveBehindId } from '../fluentxverse-server/content/conversational-skills/en/level-6-chapter-5/build';
import { buildSpotlightLesson, spotlightId } from '../fluentxverse-server/content/conversational-skills/en/level-7-chapter-1/build';
import { buildAlgorithmLesson, algorithmId } from '../fluentxverse-server/content/conversational-skills/en/level-7-chapter-2/build';
import { buildContractLesson, contractId } from '../fluentxverse-server/content/conversational-skills/en/level-7-chapter-3/build';
import { buildFameLesson, fameId } from '../fluentxverse-server/content/conversational-skills/en/level-7-chapter-4/build';
import { buildEncoreLesson, encoreId } from '../fluentxverse-server/content/conversational-skills/en/level-7-chapter-5/build';
import { buildSmilesLesson, smilesId } from '../fluentxverse-server/content/conversational-skills/en/level-8-chapter-1/build';
import { buildClosedDoorsLesson, closedDoorsId } from '../fluentxverse-server/content/conversational-skills/en/level-8-chapter-2/build';
import { buildBelongingLesson, belongingId } from '../fluentxverse-server/content/conversational-skills/en/level-8-chapter-3/build';
import { buildCourageLesson, courageId } from '../fluentxverse-server/content/conversational-skills/en/level-8-chapter-5/build';
import { clearConversationalTranslations } from '../shared/conversationalLanguage';
import { storyLessonNumbers } from '../fluentxverse-server/content/conversational-skills/ja/level-3-chapter-1/new-beginning';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';
import { buildToeicLesson } from '../fluentxverse-server/content/conversational-skills/ja/toeic-language';

const referenceId = 'conversational-skills-L3-C1-4-speaking-ja-v1';
const level = Number(process.argv.find(arg => arg.startsWith('--level='))?.slice('--level='.length) || '3');
const chapter = Number(process.argv.find(arg => arg.startsWith('--chapter='))?.slice('--chapter='.length) || '2');
const definitions = {
  '3:2': { title: 'Exploring Kyoto', theme: 'Travel, adventure and friendship in Kyoto', directory: 'exploring-kyoto', source: 'exploring-kyoto-ja-l3-c2-v1', build: buildKyotoLesson, id: chapter2Id },
  '3:3': { title: 'Everyday Life & Unexpected Moments', theme: 'Daily routines, work, friendship, problems and feelings', directory: 'everyday-life', source: 'everyday-life-ja-l3-c3-v1', build: buildEverydayLesson, id: chapter3Id },
  '3:4': { title: 'Work, Dreams & Decisions', theme: 'Professional goals, proposals, customer requests and decisions', directory: 'work-dreams-decisions', source: 'work-dreams-decisions-ja-l3-c4-v1', build: buildCareerLesson, id: chapter4Id },
  '3:5': { title: 'Two Cities, One Secret', theme: 'New work, communication, boundaries, honesty and consequences', directory: 'two-cities-one-secret', source: 'two-cities-one-secret-ja-l3-c5-v1', build: buildTwoCitiesLesson, id: chapter5Id },
  '4:1': { title: 'After the Truth', theme: 'Consequences, empathy, professional boundaries and moving forward', directory: 'after-the-truth', source: 'after-the-truth-ja-l4-c1-v1', build: buildAfterTruthLesson, id: afterTruthId },
  '4:2': { title: 'New Paths, Unexpected Feelings', theme: 'New opportunities, friendship, professional confidence and community', directory: 'new-paths', source: 'new-paths-ja-l4-c2-v1', build: buildNewPathsLesson, id: newPathsId },
  '4:3': { title: 'A Little Closer', theme: 'New relationships, unexpected encounters, friendship and shared achievements', directory: 'a-little-closer', source: 'a-little-closer-ja-l4-c3-v1', build: buildLittleCloserLesson, id: littleCloserId },
  '4:4': { title: 'Dreams in Motion', theme: 'Ambitions, practical planning, teamwork and new opportunities', directory: 'dreams-in-motion', source: 'dreams-in-motion-ja-l4-c4-v1', build: buildDreamsInMotionLesson, id: dreamsInMotionId },
  '4:5': { title: 'Where We Belong', theme: 'Shared achievements, careful decisions, gratitude and belonging', directory: 'where-we-belong', source: 'where-we-belong-ja-l4-c5-v1', build: buildWhereWeBelongLesson, id: whereWeBelongId },
  '5:1': { title: 'First Impressions', theme: 'Introductions', mainTopic: 'Tokyo After Hours', directory: 'first-impressions', source: 'first-impressions-ja-l5-c1-v1', build: buildFirstImpressionsLesson, id: firstImpressionsId },
  '5:3': { title: 'The Missing Proposal', theme: 'Complaints, workplace trust, checking facts and accountability', mainTopic: 'Tokyo After Hours', directory: 'the-missing-proposal', source: 'missing-proposal-ja-l5-c3-v1', build: buildMissingProposalLesson, id: missingProposalId },
  '5:4': { title: 'Difficult Choices', theme: 'Professional warnings, conflicting instructions, evidence and accountability', mainTopic: 'Tokyo After Hours', directory: 'difficult-choices', source: 'difficult-choices-ja-l5-c4-v1', build: buildDifficultChoicesLesson, id: difficultChoicesId },
  '5:5': { title: 'The Price of Truth', theme: 'Accountability, rebuilding trust and new beginnings', mainTopic: 'Tokyo After Hours', directory: 'the-price-of-truth', source: 'price-of-truth-ja-l5-c5-v1', build: buildPriceOfTruthLesson, id: priceOfTruthId },
  '6:1': { title: 'Keeping Traditions Alive', theme: 'Cultural exploration, friendship and sharing heritage respectfully', mainTopic: 'Threads of Tradition', directory: 'keeping-traditions-alive', source: 'keeping-traditions-alive-en-l6-c1-v1', build: buildTraditionsLesson, id: traditionsId },
  '6:2': { title: 'Beyond the Workshop', theme: 'Craft journeys, cultural perspectives and accurate documentary storytelling', mainTopic: 'Threads of Tradition', directory: 'beyond-the-workshop', source: 'beyond-the-workshop-en-l6-c2-v1', build: buildBeyondWorkshopLesson, id: beyondWorkshopId },
  '6:3': { title: 'The Taste of Tradition', theme: 'Culinary heritage, voluntary sharing, family memories and respectful choices', mainTopic: 'Threads of Tradition', directory: 'the-taste-of-tradition', source: 'taste-of-tradition-en-l6-c3-v1', build: buildTasteTraditionLesson, id: tasteTraditionId },
  '6:5': { title: 'What We Leave Behind', theme: 'Shared responsibility, cultural legacy and welcoming a new generation', mainTopic: 'Threads of Tradition', directory: 'what-we-leave-behind', source: 'what-we-leave-behind-en-l6-c5-v1', build: buildLeaveBehindLesson, id: leaveBehindId },
  '7:1': { title: 'Before the Spotlight', theme: 'Creative teamwork, music promotion, online reactions and missing context', mainTopic: 'Beyond the Spotlight', directory: 'before-the-spotlight', source: 'before-the-spotlight-en-l7-c1-v1', build: buildSpotlightLesson, id: spotlightId },
  '7:2': { title: 'The Algorithm Never Sleeps', theme: 'Publicity responses, online evidence, interviews and new music opportunities', mainTopic: 'Beyond the Spotlight', directory: 'the-algorithm-never-sleeps', source: 'algorithm-never-sleeps-en-l7-c2-v1', build: buildAlgorithmLesson, id: algorithmId },
  '7:3': { title: 'Behind the Contract', theme: 'Music proposals, creative control, negotiating terms and team relationships', mainTopic: 'Beyond the Spotlight', directory: 'behind-the-contract', source: 'behind-the-contract-en-l7-c3-v1', build: buildContractLesson, id: contractId },
  '7:4': { title: 'The Price of Fame', theme: 'Workload, personal boundaries, creative range and team communication', mainTopic: 'Beyond the Spotlight', directory: 'the-price-of-fame', source: 'the-price-of-fame-en-l7-c4-v1', build: buildFameLesson, id: fameId },
  '7:5': { title: 'One Last Encore', theme: 'Festival preparation, creative collaboration, gratitude and welcoming new talent', mainTopic: 'Beyond the Spotlight', directory: 'one-last-encore', source: 'one-last-encore-en-l7-c5-v1', build: buildEncoreLesson, id: encoreId },
  '8:1': { title: 'Behind the Smiles', theme: 'Social expectations, voluntary participation, careful listening and publication choices', mainTopic: 'The Things We Don’t Say', directory: 'behind-the-smiles', source: 'behind-the-smiles-en-l8-c1-v1', build: buildSmilesLesson, id: smilesId },
  '8:2': { title: 'Behind Closed Doors', theme: 'Family and financial pressure, private support, participation choices and possible redevelopment', mainTopic: 'The Things We Don’t Say', directory: 'behind-closed-doors', source: 'behind-closed-doors-en-l8-c2-v1', build: buildClosedDoorsLesson, id: closedDoorsId },
  '8:3': { title: 'The Price of Belonging', theme: 'Unequal resources, housing, redevelopment and fair public representation', mainTopic: 'The Things We Don’t Say', directory: 'the-price-of-belonging', source: 'the-price-of-belonging-en-l8-c3-v1', build: buildBelongingLesson, id: belongingId },
  '8:5': { title: 'The Courage to Speak', theme: 'Accountability, constructive community discussion, partial progress and dignity', mainTopic: 'The Things We Don’t Say', directory: 'the-courage-to-speak', source: 'the-courage-to-speak-en-l8-c5-v1', build: buildCourageLesson, id: courageId },
};
const definition = definitions[`${level}:${chapter}` as keyof typeof definitions];
if (!definition) throw Error('Supported authoring slots: Level 3 Chapters 2-5; Level 4 Chapters 1-5; Level 5 Chapters 1, 3, 4 and 5; Level 6 Chapters 1-3 and 5; Level 7 Chapters 1-5; Level 8 Chapters 1-3 and 5. Use --level and --chapter.');
const mainTopic = 'mainTopic' in definition ? definition.mainTopic : undefined;
const fields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
const output = resolve(import.meta.dir, `../output/${definition.directory}`);
const snapshotCode = `async function snapshot(runner) {
  const lessons=await runner.run('MATCH (l:LessonMaterial {course:"conversational-skills"}) WHERE l.level=${level} AND l.chapter=${chapter} RETURN l ORDER BY l.id');
  const meta=await runner.run('MATCH (m:CourseMetadata {course:"conversational-skills",type:"chapter"}) WHERE m.level=${level} AND m.chapter=${chapter} RETURN m');
  const levelMeta=await runner.run('MATCH (m:CourseMetadata {course:"conversational-skills",type:"level"}) WHERE m.level=${level} RETURN m');
  const refs=await runner.run('MATCH (l:LessonMaterial {id:$id}) RETURN l',{id:${JSON.stringify(referenceId)}});
  if(refs.records.length!==1 || meta.records.length>1 || levelMeta.records.length>1) throw Error('Unexpected reference or metadata count');
  return {lessons:lessons.records.map(r=>r.get('l').properties),metadata:meta.records.map(r=>r.get('m').properties),levelMetadata:levelMeta.records.map(r=>r.get('m').properties),reference:refs.records[0].get('l').properties};
}`;
const remote = (body: string, payload?: unknown) => {
  const code = `import neo4j from 'neo4j-driver'; import {createHash} from 'node:crypto'; import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
    await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
    const s=getDriver().session(); ${snapshotCode}
    try { ${payload === undefined ? '' : 'const payload=JSON.parse(await Bun.stdin.text());'} ${body} } finally {await s.close();await closeDriver();}`;
  const result = ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`, payload === undefined ? {} : { input: JSON.stringify(payload) });
  const line = result.split('\n').find(line => line.startsWith('KYOTO_RESULT '));
  if (!line) throw Error(result);
  return JSON.parse(line.slice('KYOTO_RESULT '.length));
};
const read = () => remote(`console.log('KYOTO_RESULT '+JSON.stringify(await snapshot(s)));`);
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const digest = (value: any) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const before = read();
const parse = (raw: any) => ({ ...raw, ...Object.fromEntries(fields.map(key => [key, raw[key] ? JSON.parse(raw[key]) : null])) });
const reference = parse(before.reference);
const numberOf = (record: any) => typeof record.lessonNumber === 'number' ? record.lessonNumber : record.lessonNumber?.low;
const candidates = storyLessonNumbers.map(number => {
  const matches = before.lessons.filter((record: any) => numberOf(record) === number);
  if (matches.length > 1) throw Error(`Duplicate Chapter ${chapter} lesson slot ${number}; review manually.`);
  const original = matches[0];
  if (original && original.status !== 'draft') throw Error(`Existing Lesson ${number} is not a draft. Review before replacing.`);
  const previous = original ? parse(original) : { feedbackData: reference.feedbackData };
  const built = level >= 6 ? definition.build(number, previous, reference) : level === 5 && [3, 4, 5].includes(chapter) ? definition.build(number, previous, reference) : buildToeicLesson(level, chapter, number, previous, reference);
  const lesson: any = { ...previous, ...built, level, chapter, lessonNumber: number };
  if (!original) { delete lesson.updatedAt; delete lesson.createdAt; }
  const errors = conversationalLessonErrors(lesson);
  if (errors.length) throw Error(`Lesson ${number}: ${errors.join(' ')}`);
  if (JSON.stringify(lesson).match(/[\uac00-\ud7af]/u)) throw Error('Unexpected Korean content.');
  if (!((level >= 6 || level === 5 && chapter === 5) && original) && JSON.stringify(lesson).match(/https?:\/\/[^" ]+\.(?:webp|png|jpe?g)/u)) throw Error('Unexpected inherited image.');
  const fixedCategories = level >= 6 ? clearConversationalTranslations(previous.feedbackData.categories) : previous.feedbackData.categories;
  if (JSON.stringify(lesson.feedbackData.categories) !== JSON.stringify(fixedCategories)) throw Error('Fixed English feedback changed.');
  return { number, original, lesson };
});
await mkdir(output, { recursive: true });
for (const { number, lesson } of candidates) await writeFile(resolve(output, `lesson-${number}.json`), JSON.stringify(lesson, null, 2));
const expected = digest(before);
if (!process.argv.includes('--write')) console.log(JSON.stringify({ dryRun: true, level, chapter, expected, existingLessons: before.lessons.map((record: any) => ({ id: record.id, lessonNumber: numberOf(record), updatedAt: record.updatedAt })), referenceUpdatedAt: before.reference.updatedAt, metadata: before.metadata, levelMetadata: before.levelMetadata, mainTopic, lessons: candidates.map(({ number, lesson }) => ({ number, id: lesson.id, title: lesson.lessonName, skill: lesson.skill })), output }, null, 2));
else {
  if (process.argv.find(arg => arg.startsWith('--expected='))?.slice('--expected='.length) !== expected) throw Error('Review the dry-run snapshot and supply its exact --expected digest.');
  const now = new Date().toISOString();
  const directory = resolve(import.meta.dir, `../fluentxverse-server/content/conversational-skills/${level >= 6 ? 'en' : 'ja'}/level-${level}-chapter-${chapter}/backups`);
  await mkdir(directory, { recursive: true });
  const backup = resolve(directory, `before-${definition.directory}-${now.replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
  const items = candidates.map(({ number, original, lesson }) => {
    const properties = { ...lesson, id: original?.id || definition.id(number), updatedAt: now,
      ...(original ? {} : { createdAt: now, createdBy: 'codex', createdByName: 'Lesson Authoring', authoringSource: definition.source }) };
    for (const field of fields) properties[field] = properties[field] ? JSON.stringify(properties[field]) : '';
    return { properties, existing: Boolean(original) };
  });
  remote(`const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
    const tx=s.beginTransaction();try {
      const current=await snapshot(tx);
      const hash=createHash('sha256').update(JSON.stringify(stable(current))).digest('hex');
      if(hash!==payload.expected) throw Error('Concurrent edit detected; no lessons created or overwritten');
      for(const item of payload.items) {
        const props={...item.properties,level:neo4j.int(payload.level),chapter:neo4j.int(payload.chapter),lessonNumber:neo4j.int(item.properties.lessonNumber)};
        const collision=await tx.run('MATCH (l:LessonMaterial {id:$id}) RETURN l',{id:props.id});
        if(item.existing) { if(collision.records.length!==1) throw Error('Missing existing lesson'); await tx.run('MATCH (l:LessonMaterial {id:$id}) SET l += $props',{id:props.id,props}); }
        else { if(collision.records.length) throw Error('ID collision'); await tx.run('CREATE (l:LessonMaterial) SET l=$props',{props}); }
      }
      await tx.run('MERGE (m:CourseMetadata {course:"conversational-skills",type:"chapter",level:$level,chapter:$chapter}) SET m.name=$name,m.theme=$theme,m.updatedAt=$now',{level:neo4j.int(payload.level),chapter:neo4j.int(payload.chapter),name:payload.title,theme:payload.theme,now:payload.now});
      if(payload.mainTopic) await tx.run('MERGE (m:CourseMetadata {course:"conversational-skills",type:"level",level:$level}) SET m.mainTopic=$mainTopic,m.updatedAt=$now',{level:neo4j.int(payload.level),mainTopic:payload.mainTopic,now:payload.now});
      await tx.commit(); console.log('KYOTO_RESULT '+JSON.stringify({saved:true}));
    }catch(error){await tx.rollback();throw error;}`, { expected, items, now, level, chapter, title: definition.title, theme: definition.theme, mainTopic });
  const after = read();
  if (digest(after.reference) !== digest(before.reference)) throw Error('Reference changed during verification');
  for (const item of items) {
    const actual = after.lessons.find((record: any) => record.id === item.properties.id);
    if (!actual) throw Error('New lesson missing');
    const original = before.lessons.find((record: any) => record.id === actual.id);
    const wanted = { ...original, ...item.properties, level: actual.level, chapter: actual.chapter, lessonNumber: actual.lessonNumber };
    if (digest(actual) !== digest(wanted)) throw Error('Full record read-back mismatch');
  }
  for (const original of before.lessons.filter((record: any) => [5, 10].includes(numberOf(record)))) if (digest(after.lessons.find((record: any) => record.id === original.id)) !== digest(original)) throw Error('Checkpoint changed');
  if (after.lessons.length !== before.lessons.length + items.filter(item => !item.existing).length) throw Error('Unexpected chapter lesson count');
  if (after.metadata.length !== 1 || after.metadata[0].name !== definition.title) throw Error('Chapter metadata missing');
  if (mainTopic) {
    const actual = after.levelMetadata[0];
    if (after.levelMetadata.length !== 1 || digest(actual) !== digest({ ...(before.levelMetadata[0] || { course: 'conversational-skills', type: 'level', level: actual?.level }), mainTopic, updatedAt: now })) throw Error('Level topic read-back mismatch');
  } else if (digest(after.levelMetadata) !== digest(before.levelMetadata)) throw Error('Unrelated level metadata changed');
  console.log(JSON.stringify({ saved: true, verified: true, lessons: items.length, allDrafts: true, referenceAndCheckpointsUnchanged: true, backup, updatedAt: now }, null, 2));
}
