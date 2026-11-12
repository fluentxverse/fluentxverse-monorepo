import { expect, test } from 'bun:test';
import { buildKyotoChapter, buildKyotoLesson, chapter2Episodes, chapter2Id } from '../content/conversational-skills/ja/level-3-chapter-2/build';
import { buildChapter } from '../content/conversational-skills/ja/level-3-chapter-1/build';
import { storyLessonNumbers } from '../content/conversational-skills/ja/level-3-chapter-1/new-beginning';
import { conversationalLessonErrors } from '../src/utils/conversationalLessonValidation';
import { addAvailableCheckpoints } from '../src/services/checkpointLesson.service';

const lessons: any[] = buildKyotoChapter();
test('the supplied story maps to the eight requested Chapter 2 slots', () => {
  expect(lessons.map(l => l.lessonNumber)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
  expect(lessons.map(l => l.lessonName)).toEqual(['A Weekend Adventure', 'The Wrong Train', 'Lost in Gion', 'A Taste of Kyoto', 'The Bamboo Forest', 'Rain at Kiyomizu-dera', 'A Special Souvenir', 'An Evening by the River']);
  expect(lessons.map(l => l.skill)).toEqual(['speaking', 'listening', 'reading', 'speaking', 'speaking', 'speaking', 'reading', 'speaking']);
  expect(new Set(lessons.map(l => l.id)).size).toBe(8);
  for (const l of lessons) {
    expect(l.course).toBe('conversational-skills');
    expect(l.level).toBe(3);
    expect(l.chapter).toBe(2);
    expect(l.chapterName).toBe('Exploring Kyoto');
    expect(l.status).toBe('draft');
    expect(l.id).toBe(chapter2Id(l.lessonNumber));
    expect(conversationalLessonErrors(l)).toEqual([]);
    expect(l.applyData.activityType).toBe(l.skill);
    expect(l.missionData.missionType).toBe(l.skill);
    expect(l.backgroundImage).toBe('');
    expect(JSON.stringify(l)).not.toMatch(/https?:|Gojo Art Room|old poster|missing cups|Yuki|Aisha|[\uac00-\ud7af]/u);
    expect(l.storyData.characters.map((c: any) => c.name)).toEqual(['Emma', 'Claire', 'Leo', 'Nao']);
  }
});
test('story continuity includes the train mistake, shared umbrella, blue cup, and accepted invitation', () => {
  expect(lessons[1].applyData.tutorSteps[0].listeningScript).toContain('other platform');
  expect(lessons[3].storyData.currentEpisodeSummary).toContain('offers one to Leo');
  expect(lessons[4].storyData.currentEpisodeSummary).toContain('saves her favorite');
  expect(lessons[5].storyData.currentEpisodeSummary).toContain('share');
  expect(lessons[6].storyData.nextEpisodeHook).toContain('gives Emma the blue cup');
  expect(lessons[7].storyData.currentEpisodeSummary).toContain('says yes');
  expect(lessons[7].storyData.nextEpisodeHook).toContain('Lesson 10');
  for (let i = 1; i < lessons.length; i++) expect(lessons[i].storyData.previousSummary).toBe(chapter2Episodes[storyLessonNumbers[i - 1]].closing);
  expect(lessons[3].storyData.nextEpisodeHook).toContain('Lesson 5 checkpoint');
});
test('every lesson has the standard guide structure, complete Japanese support, and assessment-ready exercises', () => {
  for (const l of lessons) {
    const learn = l.learnData.steps[0];
    expect(l.introductionData.lessonGoalSteps).toHaveLength(4);
    expect(l.introductionData.lessonGoalSteps[0].script).toStartWith('Our lesson objective today is to');
    expect(learn.vocabularyItems).toHaveLength(6);
    expect(learn.tutorSteps).toHaveLength(5);
    expect(learn.discussionPart.tutorSteps).toHaveLength(5);
    expect(learn.pronunciationPart.tutorSteps).toHaveLength(5);
    expect(l.stepBData.grammarTip.explanations).toHaveLength(2);
    expect(l.stepBData.grammarTip.tutorSteps).toHaveLength(2);
    expect(l.applyData.tutorSteps).toHaveLength(2);
    expect(l.applyData.triviaTutorSteps).toHaveLength(4);
    expect(l.missionData.tutorSteps).toHaveLength(l.skill === 'speaking' ? 3 : 4);
    expect(l.feedbackData.tutorSteps).toHaveLength(6);
    expect(l.feedbackData.rubricTitle).toBe('LESSON OBJECTIVE ACHIEVEMENT');
    expect(l.feedbackData.rubricLevels.map((r: any) => r.score)).toEqual([4, 3, 2, 1]);
    expect(l.feedbackData.categories.map((c: any) => c.title)).toEqual(['RANGE', 'ACCURACY', 'FLUENCY']);
    expect(l.exerciseData.stepAType).toBe('choose');
    expect(l.exerciseData.chooseItems).toHaveLength(6);
    expect(l.exerciseData.answers).toHaveLength(6);
    expect(l.exerciseData.multipleChoiceItems).toHaveLength(4);
    expect(l.exerciseData.stepBTutorSteps[1].answerKey).toHaveLength(4);
    expect(l.exerciseData.tutorSteps[0].tips[0].text).toContain('incorrect');
    expect(l.missionData2.topics).toHaveLength(3);
    for (const text of [l.goalTextJp, l.introductionData.introTexts[1].text, l.applyData.situationTranslation, l.missionData.situationTranslation, l.missionData.instructionTranslation, l.applyData.triviaTranslation, ...learn.vocabularyItems.map((v: any) => v.translation)]) expect(text).toMatch(/[ぁ-んァ-ン]/u);
    for (const [sentence, answer] of chapter2Episodes[l.lessonNumber as 1].choose) {
      const choice = sentence.match(/\(([^)]+)\)/)?.[1].split(' / ');
      expect(choice).toBeDefined();
      expect(choice).toContain(answer);
    }
    for (const choice of chapter2Episodes[l.lessonNumber as 1].choices) expect(choice[choice[3] === 'A' ? 1 : 2]).not.toBe(choice[choice[3] === 'A' ? 2 : 1]);
  }
});
test('speaking is short and interactive; student listening surfaces never contain the transcript', () => {
  for (const l of lessons.filter(l => l.skill === 'speaking')) {
    const lines = l.applyData.dialogueLines;
    expect(lines).toHaveLength(10);
    expect(lines.map((line: any) => line.text).join(' ').split(/\s+/).length).toBeLessThan(150);
    for (let i = 1; i < lines.length; i++) expect(lines[i].speaker).not.toBe(lines[i - 1].speaker);
    expect(l.missionData.tutorSteps[1].instruction).toContain('tutor speaks first');
    expect(l.missionData.tutorSteps[1].scripts[1].text).toStartWith('1.');
    expect(l.missionData.instruction).not.toMatch(/monologue|90.second|uninterrupted/);
    expect(l.missionData.readingPassage).toBeUndefined();
  }
  const l = lessons[1];
  expect(l.applyData.dialogueLines).toEqual([]);
  expect(l.applyData.readingText).toBe('');
  expect(l.missionData.readingPassage).toBeUndefined();
  expect(l.missionData.listeningScript).toBeUndefined();
  for (const script of [l.applyData.tutorSteps[0].listeningScript, l.missionData.tutorSteps[1].listeningScript]) expect(script.replace(/<[^>]*>/g, '').split(/\s+/).length).toBeLessThan(85);
  expect(l.missionData.tutorSteps[1].tips[0].text).toContain('Only the tutor');
});
test('reading challenges introduce new evidence with clear practice-only travel and product conditions', () => {
  for (const l of lessons.filter(l => l.skill === 'reading')) {
    const text = l.missionData.readingPassage.blocks[0].content;
    expect(text).not.toBe(l.applyData.readingText);
    expect(l.missionData.tutorSteps[1].tips[0].text).toContain('visible');
    expect(l.missionData.tutorSteps[2].instruction).toContain('tutor speaks first');
  }
  expect(lessons[2].applyData.situationText).toContain('not a real navigation guide');
  expect(lessons[2].missionData.readingPassage.blocks[0].content).toContain('Practice route');
  expect(lessons[6].applyData.readingText).toContain('Prices and product rules are fictional');
  expect(lessons[6].missionData.readingPassage.blocks[0].content).toContain('fictional practice conditions');
  expect(lessons[6].missionData.tutorSteps[2].tips[1].text).toContain('2,700');
});
test('role assignments are direct without invented-character or personal-information disclaimers', () => {
  expect(lessons[5].missionData.situation).toStartWith('You are Emma.');
  expect(lessons[7].missionData.situation).toBe('You are Emma. Your tutor is Leo. You are planning another outing together.');
  expect(lessons[7].missionData.tutorSteps[1].scripts[0].text).toContain('Please be Emma.');
  for (const lesson of lessons) expect(JSON.stringify(lesson)).not.toMatch(/invented adult character|No personal or romantic|personal romantic disclosures|roles remain optional|Please be Emma or/);
});
test('checkpoint slots are available only from the published chapter groups, without static checkpoint lessons', () => {
  const published = lessons.map(l => ({ ...l, status: 'published' }));
  expect(addAvailableCheckpoints(published).filter(l => [5, 10].includes(l.lessonNumber)).map(l => l.id)).toEqual(['conversational-skills-L3-C2-5-review', 'conversational-skills-L3-C2-10-review']);
  expect(addAvailableCheckpoints(published.slice(0, 3)).some(l => l.lessonNumber === 5)).toBe(false);
});
test('a custom chapter configuration does not change Chapter 1, fixed feedback or supplied existing identity', () => {
  const firstBefore = buildChapter('https://api.fluentxverse.com');
  const reference: any = firstBefore[3];
  const previous: any = { id: 'existing-c2-id', status: 'draft', feedbackData: { ...reference.feedbackData, categories: [{ title: 'fixed-example' }] } };
  const frozen = JSON.stringify(previous);
  const result = buildKyotoLesson(1, previous, reference);
  expect(previous.id).toBe('existing-c2-id');
  expect(JSON.stringify(previous)).toBe(frozen);
  expect(result.id).toBe(previous.id);
  expect(result.feedbackData.categories).toEqual(previous.feedbackData.categories);
  expect(result.chapter).toBe(2);
  expect(result.backgroundImage).toBe('');
  expect(buildChapter('https://api.fluentxverse.com')).toEqual(firstBefore);
});
