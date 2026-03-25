/**
 * Generate the missing Business English Level 3 extension lessons.
 *
 * What this script does:
 * 1. Writes source JSON files for Chapter 2-5, Lessons 6-10
 * 2. Upserts the same lessons into Memgraph as draft LessonMaterial nodes
 * 3. Updates Lesson 5 handoff labels so each chapter flows into Lesson 6
 * 4. Expands the local syllabus file to include the new lessons
 *
 * Run with:
 *   bun run scripts/generate-business-english-level3.ts
 */

import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import neo4j from 'neo4j-driver';
import { initDriver, getDriver, closeDriver } from '../src/db/memgraph';

type Skill = 'listening' | 'reading' | 'speaking' | 'review';
type LessonType = 'LISTENING' | 'READING' | 'SPEAKING' | 'REVIEW';
type TutorNoteType = 'script' | 'instruction' | 'tip';

type TutorNote = { type: TutorNoteType; text: string };
type Pair = { en: string; kr: string };
type DialogueTurn = { role: 'tutor' | 'student'; en: string; kr: string };
type VocabItem = {
  word: string;
  pos: string;
  translation: string;
  definition: string;
  pronunciation: string;
};
type PronunciationWord = { en: string; kr: string };
type PronunciationSide = { symbol: string; words: PronunciationWord[] };
type PatternDrill = {
  label: string;
  labelKr: string;
  template: string;
  examples: Pair[];
};
type DiscussionCategory = { title: string; questions: string[] };
type RoleplayTable = { you: string; coworkers: string[] };
type FeedbackTarget = { nextLessonLabel: string; nextLessonName: string };

type LessonSpec = {
  chapter: number;
  lessonNumber: number;
  skill: Skill;
  lessonType: LessonType;
  slug: string;
  chapterName: string;
  lessonName: string;
  goalEn: string;
  goalKr: string;
  situationEn: string;
  situationKr: string;
  pronunciationShort: string;
  patterns: Pair[];
  vocabulary: VocabItem[];
  pronunciation: {
    instruction: string;
    instructionKr: string;
    left: PronunciationSide;
    right: PronunciationSide;
  };
  fillRows: Array<{ answer: string; suffix: string }>;
  patternDrills: PatternDrill[];
  practice: {
    repeatLines: string[];
    completeTitle?: string;
    completeInstructionEn?: string;
    completeInstructionKr?: string;
    completeLines: string[];
    dialogueTitle?: string;
    dialogueInstructionEn?: string;
    dialogueInstructionKr?: string;
    dialogue: DialogueTurn[];
    freeTitle?: string;
    freeInstructionEn?: string;
    freeInstructionKr?: string;
    freePromptItems: string[];
  };
  challenge: {
    scenarioEn: string;
    scenarioKr: string;
    guideQuestions: string[];
    roleplayTable?: RoleplayTable;
    tutorTip?: string;
  };
  discussion: {
    instructionEn?: string;
    instructionKr?: string;
    categories: DiscussionCategory[];
  };
  feedback: FeedbackTarget;
  reviewScope?: string;
  isDynamicFallback?: boolean;
};

const COURSE = 'business-english';
const LEVEL = 3;
const CREATED_BY = 'codex';
const CREATED_BY_NAME = 'Codex';
const OVERLAY_COLOR = '#0369a1cc';
const SOURCE_DIR = path.resolve(
  import.meta.dir,
  '../../docs/lesson-materials/business-conversation/level-03/lesson-data'
);
const SYLLABUS_PATH = path.resolve(
  import.meta.dir,
  '../../docs/lesson-materials/business-conversation/level-03/syllabus-level-03.json'
);

const CHAPTER_LABELS: Record<number, string> = {
  2: 'CHAPTER 2: OFFICE BASICS',
  3: 'CHAPTER 3: TIME AND SCHEDULES',
  4: 'CHAPTER 4: REQUESTS AND HELP',
  5: 'CHAPTER 5: PHONE AND EMAIL COMMUNICATION',
};

const KOREAN_NAMES = {
  office: ['Minji Kim', 'Jisoo Park', 'Taemin Choi'],
  schedule: ['Sujin Lee', 'Minho Han', 'Yuna Seo'],
  request: ['Jiho Kim', 'Haneul Park', 'Seojun Lee'],
  phone: ['Jiyoon Choi', 'Minseo Kang', 'Taeyang Yoo'],
};

const FEEDBACK_TEMPLATE =
  '*OVERALL SCORE*<br>Overall: (score)<br>- comment<br><br>*Goal Check*<br>- Achieved lesson goal: (yes/partially/no)<br><br>*Pattern Usage*<br>- pattern 1<br>- pattern 2<br><br>*Vocabulary*<br>- word/phrase<br>- word/phrase<br><br>*Pronunciation*<br>- issue<br>- issue<br><br>*Next Steps*<br>- recommendation';

function loadEnvFile(): Promise<void> {
  const envPath = path.resolve(import.meta.dir, '../.env');
  const envFile = Bun.file(envPath);

  return (async () => {
    if (!(await envFile.exists())) return;

    const envContent = await envFile.text();
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...valueParts] = trimmed.split('=');
      if (!key || valueParts.length === 0) continue;

      let value = valueParts.join('=');
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key.trim()] = value;
    }
  })();
}

function note(type: TutorNoteType, text: string): TutorNote {
  return { type, text };
}

function numberedHtml(lines: string[]): string {
  return lines.map((line, index) => `${index + 1}. ${line}`).join('<br>');
}

function includeHtml(lines: string[]): string {
  return `Include:<br>- ${lines.join('<br>- ')}`;
}

function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIntroTutorNotes(goalEn: string): TutorNote[] {
  return [
    note('script', `"Today, we're going to work on this goal: ${stripHtml(goalEn)}."`),
    note('instruction', 'Read the lesson goal aloud and ask the student to repeat it.'),
    note('instruction', 'Read the situation clearly and confirm that the student understands the task.'),
    note('script', '"Is it clear? Great. Let’s move to the next part."'),
  ];
}

function buildPresentTutorNotes(): TutorNote[] {
  return [
    note('script', "\"Let's look at today's key expressions.\""),
    note('instruction', 'Read each pattern aloud and ask the student to repeat it.'),
    note('instruction', 'Connect each expression to a realistic office example.'),
    note('script', "\"Now, let's practice the target sounds.\""),
    note('tip', 'Correct only one or two points at a time and keep the pace supportive.'),
  ];
}

function buildUnderstandTutorNotes(): TutorNote[] {
  return [
    note('instruction', 'Ask the student to complete the blanks first.'),
    note('instruction', 'Run the pattern drills with substitutions and short follow-up questions.'),
    note('tip', 'If the student gets stuck, give the first key word as a hint.'),
  ];
}

function buildPracticeSteps(spec: LessonSpec) {
  return [
    {
      title: 'Step 1 - Repeat After Me',
      instructionEn: 'Listen and repeat each sentence.',
      instructionKr: '문장을 듣고 따라 하세요.',
      content: numberedHtml(spec.practice.repeatLines),
      tutorNotes: [
        note('instruction', 'Read each line clearly and ask the student to repeat with natural rhythm.'),
        note('instruction', 'Fix one pronunciation point after every two or three lines.'),
        note('tip', 'Keep the student speaking more than the tutor.'),
      ],
    },
    {
      title: spec.practice.completeTitle || 'Step 2 - Complete the Key Lines',
      instructionEn:
        spec.practice.completeInstructionEn ||
        'Complete the key lines using your own workplace context.',
      instructionKr:
        spec.practice.completeInstructionKr ||
        '자신의 직장 상황에 맞게 핵심 문장을 완성하세요.',
      content: numberedHtml(spec.practice.completeLines),
      tutorNotes: [
        note('instruction', 'Ask the student to complete all lines first, then read them aloud.'),
        note('instruction', 'Use one or two follow-up questions to extend the answers.'),
        note('tip', 'Encourage realistic workplace details instead of generic answers.'),
      ],
    },
    {
      title: spec.practice.dialogueTitle || 'Step 3 - Dialogue Practice',
      instructionEn: spec.practice.dialogueInstructionEn || 'Practice this dialogue with your tutor.',
      instructionKr: spec.practice.dialogueInstructionKr || '선생님과 대화를 연습하세요.',
      dialogue: spec.practice.dialogue,
      tutorNotes: [
        note('instruction', 'Do one guided round first, then one more natural round without heavy prompting.'),
        note('instruction', 'Switch roles if time allows.'),
        note('tip', 'Focus on smooth communication before perfect grammar.'),
      ],
    },
    {
      title: spec.practice.freeTitle || 'Step 4 - Free Practice',
      instructionEn:
        spec.practice.freeInstructionEn || 'Speak freely using at least 5 sentences.',
      instructionKr:
        spec.practice.freeInstructionKr || '5문장 이상으로 자유롭게 말하세요.',
      content: includeHtml(spec.practice.freePromptItems),
      tutorNotes: [
        note('script', '"Now speak without notes. Try to connect your ideas naturally."'),
        note('instruction', 'Let the student finish before giving corrections.'),
        note('instruction', 'Give concise feedback on one grammar point and one pronunciation point.'),
      ],
    },
  ];
}

function buildChallengeTutorNotes(spec: LessonSpec): TutorNote[] {
  const notes = [
    note('script', '"Challenge time. Use today’s language in a realistic office situation."'),
    note('instruction', 'Act as the coworker, client, or teammate and ask one or two follow-up questions.'),
    note('instruction', 'Let the student finish the task before correcting.'),
  ];

  if (spec.isDynamicFallback) {
    notes.push(
      note(
        'tip',
        'This is the fallback version of the future dynamic review slot. Focus on the student’s repeated issues from Lessons 1 to 9.'
      )
    );
  } else {
    notes.push(
      note(
        'tip',
        spec.challenge.tutorTip ||
          'Success means the student communicates clearly, uses the key patterns, and stays polite.'
      )
    );
  }

  return notes;
}

function buildDiscussionTutorNotes(): TutorNote[] {
  return [
    note('script', "\"Now let's have a short discussion.\""),
    note('instruction', 'Ask the student to choose one category and discuss it for 3 to 5 minutes.'),
    note('tip', 'Encourage the student to reuse today’s target expressions naturally.'),
  ];
}

function buildFeedbackTutorNotes(spec: LessonSpec): TutorNote[] {
  return [
    note('script', '"Great work today. Let’s review your progress."'),
    note('instruction', 'Ask the student to read the lesson goal one more time.'),
    note('instruction', 'Complete and share the feedback template.'),
    note(
      'tip',
      spec.isDynamicFallback
        ? 'Use the student’s recurring correction points from this chapter when filling in the feedback.'
        : 'Keep feedback specific, short, and actionable.'
    ),
  ];
}

function buildLessonPayload(spec: LessonSpec) {
  return {
    chapterName: spec.chapterName,
    lessonName: spec.lessonName,
    goalTextEn: spec.goalEn,
    goalTextKr: spec.goalKr,
    beData: {
      lessonType: spec.lessonType,
      hiddenBlocks: [],
      introduce: {
        goalEn: spec.goalEn,
        goalKr: spec.goalKr,
        situationEn: spec.situationEn,
        situationKr: spec.situationKr,
        taskEn: '',
        taskKr: '',
        tutorNotes: buildIntroTutorNotes(spec.goalEn),
      },
      present: {
        patterns: spec.patterns,
        vocabulary: spec.vocabulary,
        pronunciation: spec.pronunciation,
        tutorNotes: buildPresentTutorNotes(),
      },
      understand: {
        instruction: 'Fill in the blanks with the correct pattern. Then practice the pattern drills.',
        instructionKr: '빈칸에 알맞은 표현을 넣고 패턴 드릴을 연습하세요.',
        fillRows: spec.fillRows.map((row) => ({
          parts: [
            { text: row.answer, isBlank: true },
            { text: row.suffix, isBlank: false },
          ],
        })),
        patternDrills: spec.patternDrills,
        activityBlocks: [],
        tutorNotes: buildUnderstandTutorNotes(),
      },
      practice: {
        steps: buildPracticeSteps(spec),
        activityBlocks: [],
      },
      challenge: {
        scenarioEn: spec.challenge.scenarioEn,
        scenarioKr: spec.challenge.scenarioKr,
        roleplayTable: spec.challenge.roleplayTable,
        guideQuestions: spec.challenge.guideQuestions.map((text) => ({ text })),
        activityBlocks: [],
        tutorNotes: buildChallengeTutorNotes(spec),
      },
      discussion: {
        instructionEn: spec.discussion.instructionEn || 'Choose one category and answer the questions.',
        instructionKr: spec.discussion.instructionKr || '카테고리를 하나 고르고 질문에 답하세요.',
        categories: spec.discussion.categories,
        activityBlocks: [],
        tutorNotes: buildDiscussionTutorNotes(),
      },
      feedback: {
        goalReviewEn: spec.goalEn,
        goalReviewKr: spec.goalKr,
        feedbackTemplate: FEEDBACK_TEMPLATE,
        nextLessonLabel: spec.feedback.nextLessonLabel,
        nextLessonName: spec.feedback.nextLessonName,
        tutorNotes: buildFeedbackTutorNotes(spec),
      },
    },
  };
}

function buildSyllabusLesson(spec: LessonSpec) {
  return {
    lesson: spec.lessonNumber,
    skill: spec.skill,
    name: spec.lessonName,
    goalEn: spec.goalEn,
    targetPatterns: spec.patterns.map((pattern) => stripHtml(pattern.en)),
    vocabulary: spec.vocabulary.map((item) => item.word),
    pronunciation: spec.pronunciationShort,
    situation: spec.situationEn,
    goalKr: spec.goalKr,
    ...(spec.reviewScope ? { reviewScope: spec.reviewScope } : {}),
  };
}

async function upsertLesson(session: neo4j.Session, spec: LessonSpec, sourceJson: any) {
  const now = new Date().toISOString();
  const beDataString = JSON.stringify(sourceJson.beData);
  const result = await session.run(
    `MATCH (l:LessonMaterial {
      course: $course,
      level: $level,
      chapter: $chapter,
      lessonNumber: $lessonNumber,
      skill: $skill
    })
    RETURN l.id AS id`,
    {
      course: COURSE,
      level: neo4j.int(LEVEL),
      chapter: neo4j.int(spec.chapter),
      lessonNumber: neo4j.int(spec.lessonNumber),
      skill: spec.skill,
    }
  );

  if (result.records.length > 0) {
    const id = result.records[0]?.get('id');
    await session.run(
      `MATCH (l:LessonMaterial {id: $id})
      SET
        l.chapterName = $chapterName,
        l.lessonName = $lessonName,
        l.goalTextEn = $goalTextEn,
        l.goalTextJp = $goalTextJp,
        l.beData = $beData,
        l.updatedAt = $updatedAt
      RETURN l`,
      {
        id,
        chapterName: spec.chapterName,
        lessonName: spec.lessonName,
        goalTextEn: spec.goalEn,
        goalTextJp: spec.goalKr,
        beData: beDataString,
        updatedAt: now,
      }
    );
    return { id, action: 'updated' as const };
  }

  const id = `${COURSE}-L${LEVEL}-C${spec.chapter}-${spec.lessonNumber}-${spec.skill}-${Date.now()}`;
  await session.run(
    `CREATE (l:LessonMaterial {
      id: $id,
      course: $course,
      level: $level,
      chapter: $chapter,
      lessonNumber: $lessonNumber,
      skill: $skill,
      chapterName: $chapterName,
      lessonName: $lessonName,
      goalTextEn: $goalTextEn,
      goalTextJp: $goalTextJp,
      backgroundImage: '',
      overlayColor: $overlayColor,
      status: 'draft',
      createdBy: $createdBy,
      createdByName: $createdByName,
      beData: $beData,
      createdAt: $createdAt,
      updatedAt: $updatedAt
    })
    RETURN l`,
    {
      id,
      course: COURSE,
      level: neo4j.int(LEVEL),
      chapter: neo4j.int(spec.chapter),
      lessonNumber: neo4j.int(spec.lessonNumber),
      skill: spec.skill,
      chapterName: spec.chapterName,
      lessonName: spec.lessonName,
      goalTextEn: spec.goalEn,
      goalTextJp: spec.goalKr,
      overlayColor: OVERLAY_COLOR,
      createdBy: CREATED_BY,
      createdByName: CREATED_BY_NAME,
      beData: beDataString,
      createdAt: now,
      updatedAt: now,
    }
  );
  return { id, action: 'created' as const };
}

async function updateLessonFiveHandoffs(session: neo4j.Session) {
  const handoffs = [
    {
      chapter: 2,
      skill: 'review' as const,
      file: path.join(SOURCE_DIR, 'ch02-L5-office-tour.json'),
      label: CHAPTER_LABELS[2],
      name: 'Lesson 6: How Does This Work?',
    },
    {
      chapter: 3,
      skill: 'review' as const,
      file: path.join(SOURCE_DIR, 'ch03-L5-time-management.json'),
      label: CHAPTER_LABELS[3],
      name: 'Lesson 6: The Morning Meeting',
    },
    {
      chapter: 4,
      skill: 'review' as const,
      file: path.join(SOURCE_DIR, 'ch04-L5-happy-to-help.json'),
      label: CHAPTER_LABELS[4],
      name: 'Lesson 6: Coffee for the Meeting',
    },
    {
      chapter: 5,
      skill: 'review' as const,
      file: path.join(SOURCE_DIR, 'ch05-L5-ring-ring.json'),
      label: CHAPTER_LABELS[5],
      name: 'Lesson 6: Please Hold and Transfer',
    },
  ];

  for (const handoff of handoffs) {
    const source = await Bun.file(handoff.file).json();
    source.beData.feedback.nextLessonLabel = handoff.label;
    source.beData.feedback.nextLessonName = handoff.name;
    await Bun.write(handoff.file, `${JSON.stringify(source, null, 2)}\n`);

    const existing = await session.run(
      `MATCH (l:LessonMaterial {
        course: $course,
        level: $level,
        chapter: $chapter,
        lessonNumber: 5,
        skill: $skill
      })
      RETURN l.id AS id, l.beData AS beData`,
      {
        course: COURSE,
        level: neo4j.int(LEVEL),
        chapter: neo4j.int(handoff.chapter),
        skill: handoff.skill,
      }
    );

    if (existing.records.length === 0) continue;

    const id = existing.records[0]?.get('id');
    const raw = existing.records[0]?.get('beData');
    let beData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    beData = beData || {};
    beData.feedback = beData.feedback || {};
    beData.feedback.nextLessonLabel = handoff.label;
    beData.feedback.nextLessonName = handoff.name;

    await session.run(
      `MATCH (l:LessonMaterial {id: $id})
      SET l.beData = $beData, l.updatedAt = $updatedAt
      RETURN l`,
      {
        id,
        beData: JSON.stringify(beData),
        updatedAt: new Date().toISOString(),
      }
    );
  }
}

async function updateSyllabus(specs: LessonSpec[]) {
  const syllabus = await Bun.file(SYLLABUS_PATH).json();
  const chapters = Array.isArray(syllabus.chapters) ? syllabus.chapters : [];

  for (const chapter of chapters) {
    const chapterSpecs = specs
      .filter((spec) => spec.chapter === chapter.chapter)
      .sort((a, b) => a.lessonNumber - b.lessonNumber);

    if (chapterSpecs.length === 0) continue;

    const existingLessons = Array.isArray(chapter.lessons) ? chapter.lessons : [];
    const lessonMap = new Map<number, any>(existingLessons.map((lesson: any) => [lesson.lesson, lesson]));

    for (const spec of chapterSpecs) {
      lessonMap.set(spec.lessonNumber, buildSyllabusLesson(spec));
    }

    chapter.lessons = Array.from(lessonMap.values()).sort((a, b) => a.lesson - b.lesson);
  }

  await Bun.write(SYLLABUS_PATH, `${JSON.stringify(syllabus, null, 2)}\n`);
}

const lessonSpecs: LessonSpec[] = [
  {
    chapter: 2,
    lessonNumber: 6,
    skill: 'listening',
    lessonType: 'LISTENING',
    slug: 'how-does-this-work',
    chapterName: 'Office Basics',
    lessonName: 'How Does This Work?',
    goalEn: 'Can understand simple explanations about office equipment.',
    goalKr: '사무실 기기 사용에 대한 간단한 설명을 이해할 수 있다.',
    situationEn: 'A coworker explains how to use the printer and scanner on your new floor.',
    situationKr: '동료가 새 층의 프린터와 스캐너 사용법을 설명해 줍니다.',
    pronunciationShort: '/p/ vs /b/',
    patterns: [
      { en: '<b>Press</b> this button first.', kr: '먼저 이 버튼을 누르세요.' },
      { en: '<b>Put the paper in</b> the tray.', kr: '용지함에 종이를 넣으세요.' },
      { en: '<b>Select</b> color or black and white.', kr: '컬러 또는 흑백을 선택하세요.' },
      { en: '<b>If it jams</b>, call Minji from IT support.', kr: '용지가 걸리면 IT 지원팀 민지에게 연락하세요.' },
    ],
    vocabulary: [
      {
        word: 'scanner',
        pos: 'noun',
        translation: '스캐너',
        definition: 'a machine that copies a document into a digital file',
        pronunciation: '/ˈskænər/',
      },
      {
        word: 'tray',
        pos: 'noun',
        translation: '용지함',
        definition: 'the part of a printer where paper is placed',
        pronunciation: '/treɪ/',
      },
      {
        word: 'jam',
        pos: 'noun/verb',
        translation: '걸림 / 걸리다',
        definition: 'when paper gets stuck inside a machine',
        pronunciation: '/dʒæm/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /p/ and /b/ in equipment words.",
      instructionKr: '기기 관련 단어에서 /p/와 /b/를 연습합시다.',
      left: {
        symbol: '/p/',
        words: [
          { en: 'press', kr: '누르다' },
          { en: 'paper', kr: '종이' },
          { en: 'printer', kr: '프린터' },
          { en: 'copy', kr: '복사하다' },
          { en: 'panel', kr: '패널' },
        ],
      },
      right: {
        symbol: '/b/',
        words: [
          { en: 'button', kr: '버튼' },
          { en: 'black', kr: '흑백' },
          { en: 'before', kr: '전에' },
          { en: 'board', kr: '보드' },
          { en: 'bin', kr: '함' },
        ],
      },
    },
    fillRows: [
      { answer: 'Press', suffix: ' this button first.' },
      { answer: 'Put the paper in', suffix: ' the tray.' },
      { answer: 'Select', suffix: ' color or black and white.' },
      { answer: 'If it jams', suffix: ', call Minji from IT support.' },
    ],
    patternDrills: [
      {
        label: 'Simple machine steps',
        labelKr: '기기 사용 단계',
        template: 'First, ___. Then, ___.',
        examples: [
          { en: 'First, press the power button. Then, choose copy.', kr: '먼저 전원 버튼을 누른 다음 복사를 선택하세요.' },
          { en: 'First, open the cover. Then, place the paper.', kr: '먼저 덮개를 연 다음 종이를 놓으세요.' },
        ],
      },
      {
        label: 'Paper instructions',
        labelKr: '용지 관련 안내',
        template: 'Put the ___ in the ___.',
        examples: [
          { en: 'Put the paper in the tray.', kr: '용지함에 종이를 넣으세요.' },
          { en: 'Put the ID card on the glass.', kr: '유리판 위에 신분증을 놓으세요.' },
        ],
      },
      {
        label: 'Trouble support',
        labelKr: '문제 발생 시 지원',
        template: 'If it ___, call ___.',
        examples: [
          { en: 'If it jams, call Minji.', kr: '걸리면 민지에게 연락하세요.' },
          { en: 'If it stops, call the help desk.', kr: '멈추면 헬프데스크에 연락하세요.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Press this button first.',
        'Put the paper in the tray.',
        'Select black and white.',
        'The scanner is next to the printer.',
        'If it jams, call Minji from IT support.',
        'The copy job finishes in one minute.',
      ],
      completeTitle: 'Step 2 - Complete the Instructions',
      completeInstructionEn: 'Complete the machine instructions with the missing words.',
      completeInstructionKr: '빠진 단어를 넣어 기기 사용 안내를 완성하세요.',
      completeLines: [
        'First, _______________ this button.',
        'Put the paper in the _______________.',
        'Select color or _______________.',
        'If it _______________, call IT support.',
        'The scanner is next to the _______________.',
        'Wait for the _______________ to finish.',
      ],
      dialogue: [
        { role: 'tutor', en: "Hi, I'm new here. How does this printer work?", kr: '안녕하세요, 여기 처음인데요. 이 프린터는 어떻게 사용하나요?' },
        { role: 'student', en: 'First, press the green button.', kr: '먼저 초록색 버튼을 누르세요.' },
        { role: 'tutor', en: 'OK. What should I do next?', kr: '알겠어요. 다음에는 무엇을 하나요?' },
        { role: 'student', en: 'Put the paper in the tray and select black and white.', kr: '용지함에 종이를 넣고 흑백을 선택하세요.' },
        { role: 'tutor', en: 'What if the paper gets stuck?', kr: '용지가 걸리면 어떻게 하죠?' },
        { role: 'student', en: 'If it jams, call Minji from IT support.', kr: '걸리면 IT 지원팀 민지에게 연락하세요.' },
      ],
      freePromptItems: [
        'Explain one machine step by step',
        'Mention where the scanner is',
        'Use one trouble sentence with if',
        'Give at least one follow-up tip',
        'Speak calmly and clearly',
      ],
    },
    challenge: {
      scenarioEn: 'A new teammate asks you how to use the office printer and scanner before a meeting.',
      scenarioKr: '새 팀원이 회의 전에 프린터와 스캐너 사용법을 묻습니다.',
      guideQuestions: [
        'Explain the first step clearly.',
        'Tell them where to put the paper.',
        'Tell them what setting to choose.',
        'Explain what to do if something goes wrong.',
        'Finish with one helpful reminder.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.office },
    },
    discussion: {
      categories: [
        {
          title: 'OFFICE TOOLS',
          questions: [
            'Which office machine do you use most often?',
            'Which machine is difficult for you?',
            'What machine should every office explain clearly?',
          ],
        },
        {
          title: 'NEW EMPLOYEES',
          questions: [
            'What should a new employee learn first?',
            'Who usually helps new staff in your office?',
            'Is it better to explain by speaking or by memo?',
          ],
        },
        {
          title: 'WORK SUPPORT',
          questions: [
            'Who do you contact when equipment is broken?',
            'What common office problem happens often?',
            'How can a company reduce small equipment problems?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[2],
      nextLessonName: 'Lesson 7: Office Memo Board',
    },
  },
  {
    chapter: 2,
    lessonNumber: 7,
    skill: 'reading',
    lessonType: 'READING',
    slug: 'office-memo-board',
    chapterName: 'Office Basics',
    lessonName: 'Office Memo Board',
    goalEn: 'Can read and understand short office notices and reminders.',
    goalKr: '짧은 사무실 공지와 리마인더를 읽고 이해할 수 있다.',
    situationEn: 'You check the memo board near reception for office updates and reminders.',
    situationKr: '사무실 업데이트와 리마인더를 확인하기 위해 리셉션 옆 메모 보드를 봅니다.',
    pronunciationShort: '/r/ in office notice words',
    patterns: [
      { en: '<b>Please refill</b> the copier paper by 3 PM.', kr: '오후 3시까지 복사용지를 보충해 주세요.' },
      { en: '<b>The meeting room is reserved</b> from 2 to 4.', kr: '회의실은 2시부터 4시까지 예약되어 있습니다.' },
      { en: '<b>The printer is out of order</b> today.', kr: '프린터는 오늘 고장 상태입니다.' },
      { en: '<b>Please submit</b> the visitor list before noon.', kr: '정오 전에 방문자 명단을 제출해 주세요.' },
    ],
    vocabulary: [
      {
        word: 'notice',
        pos: 'noun',
        translation: '공지',
        definition: 'a short message that gives important information',
        pronunciation: '/ˈnoʊtɪs/',
      },
      {
        word: 'reserved',
        pos: 'adjective',
        translation: '예약된',
        definition: 'booked for a specific time or person',
        pronunciation: '/rɪˈzɜːrvd/',
      },
      {
        word: 'out of order',
        pos: 'phrase',
        translation: '고장 난',
        definition: 'not working correctly',
        pronunciation: '/aʊt əv ˈɔːrdər/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /r/ in common notice words.",
      instructionKr: '공지에서 자주 나오는 /r/ 소리를 연습합시다.',
      left: {
        symbol: '/r/',
        words: [
          { en: 'reserved', kr: '예약된' },
          { en: 'reminder', kr: '리마인더' },
          { en: 'report', kr: '보고서' },
          { en: 'printer', kr: '프린터' },
          { en: 'order', kr: '정리 / 고장 상태' },
        ],
      },
      right: {
        symbol: 'soft',
        words: [
          { en: 'notice', kr: '공지' },
          { en: 'copy', kr: '복사' },
          { en: 'submit', kr: '제출하다' },
          { en: 'paper', kr: '종이' },
          { en: 'today', kr: '오늘' },
        ],
      },
    },
    fillRows: [
      { answer: 'Please refill', suffix: ' the copier paper by 3 PM.' },
      { answer: 'The meeting room is reserved', suffix: ' from 2 to 4.' },
      { answer: 'The printer is out of order', suffix: ' today.' },
      { answer: 'Please submit', suffix: ' the visitor list before noon.' },
    ],
    patternDrills: [
      {
        label: 'Simple notices',
        labelKr: '간단한 공지',
        template: 'Please ___ by ___.',
        examples: [
          { en: 'Please return the key by 5 PM.', kr: '오후 5시까지 열쇠를 반납해 주세요.' },
          { en: 'Please check the list by noon.', kr: '정오 전까지 명단을 확인해 주세요.' },
        ],
      },
      {
        label: 'Room booking',
        labelKr: '공간 예약',
        template: 'The ___ is reserved from ___ to ___.',
        examples: [
          { en: 'The small room is reserved from 10 to 11.', kr: '소회의실은 10시부터 11시까지 예약되어 있습니다.' },
          { en: 'The training room is reserved this afternoon.', kr: '교육실은 오늘 오후에 예약되어 있습니다.' },
        ],
      },
      {
        label: 'Machine status',
        labelKr: '기기 상태',
        template: 'The ___ is out of order.',
        examples: [
          { en: 'The scanner is out of order today.', kr: '스캐너는 오늘 고장 상태입니다.' },
          { en: 'The coffee machine is out of order.', kr: '커피 머신이 고장 났습니다.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Please refill the copier paper by 3 PM.',
        'The meeting room is reserved from 2 to 4.',
        'The printer is out of order today.',
        'Please submit the visitor list before noon.',
        'The pantry fridge will be cleaned at 6 PM.',
        'Contact Jisoo at reception for questions.',
      ],
      completeTitle: 'Step 2 - Complete the Notice Board',
      completeInstructionEn: 'Complete each office notice with the missing information.',
      completeInstructionKr: '빠진 정보를 넣어 사무실 공지를 완성하세요.',
      completeLines: [
        'Please _______________ the copier paper by 3 PM.',
        'The _______________ room is reserved from 2 to 4.',
        'The printer is out of _______________ today.',
        'Please submit the visitor list before _______________.',
        'The pantry fridge will be cleaned at _______________.',
        'Contact _______________ at reception for questions.',
      ],
      dialogue: [
        { role: 'tutor', en: 'What does the first notice say?', kr: '첫 번째 공지는 뭐라고 하나요?' },
        { role: 'student', en: 'It says to refill the copier paper by 3 PM.', kr: '오후 3시까지 복사용지를 보충하라고 합니다.' },
        { role: 'tutor', en: 'Is the big meeting room free at 3 PM?', kr: '오후 3시에 큰 회의실이 비어 있나요?' },
        { role: 'student', en: 'No. The meeting room is reserved from 2 to 4.', kr: '아니요. 2시부터 4시까지 예약되어 있습니다.' },
        { role: 'tutor', en: 'Why can’t I use the printer today?', kr: '오늘 프린터를 왜 사용할 수 없나요?' },
        { role: 'student', en: 'Because it is out of order today.', kr: '오늘 고장 상태이기 때문입니다.' },
      ],
      freePromptItems: [
        'Read two notices aloud',
        'Explain one deadline',
        'Explain one room reservation',
        'Explain one machine problem',
        'Add one action you need to take',
      ],
    },
    challenge: {
      scenarioEn: 'You are helping a new coworker understand the office memo board before the afternoon shift.',
      scenarioKr: '오후 근무 전에 새 동료가 사무실 메모 보드를 이해하도록 도와주고 있습니다.',
      guideQuestions: [
        'Which notice is the most urgent?',
        'Which room is not available?',
        'Which machine is broken?',
        'What must staff submit today?',
        'What action will you take first?',
      ],
    },
    discussion: {
      categories: [
        {
          title: 'OFFICE NOTICES',
          questions: [
            'What notices do you see often at work?',
            'What makes a notice easy to understand?',
            'Should office notices be short or detailed?',
          ],
        },
        {
          title: 'DEADLINES',
          questions: [
            'Do you usually check deadlines carefully?',
            'How do you remember important deadlines?',
            'Which deadline is easiest to miss?',
          ],
        },
        {
          title: 'WORKPLACE RULES',
          questions: [
            'What small office rule is important?',
            'What notice would you put near reception?',
            'Do you prefer printed notices or chat messages?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[2],
      nextLessonName: 'Lesson 8: Finding the Finance Team',
    },
  },
  {
    chapter: 2,
    lessonNumber: 8,
    skill: 'speaking',
    lessonType: 'SPEAKING',
    slug: 'finding-the-finance-team',
    chapterName: 'Office Basics',
    lessonName: 'Finding the Finance Team',
    goalEn: 'Can ask for a department and find the right person in the office.',
    goalKr: '사무실에서 부서를 찾고 담당자를 찾을 수 있다.',
    situationEn: 'You need to submit an expense form, so you ask where the Finance Team sits and who handles it.',
    situationKr: '경비 정산서를 제출해야 해서 재무팀 위치와 담당자를 묻습니다.',
    pronunciationShort: '/f/ vs /p/',
    patterns: [
      { en: '<b>I am looking for</b> the Finance Team.', kr: '재무팀을 찾고 있습니다.' },
      { en: '<b>Which floor are they on?</b>', kr: '그들은 몇 층에 있나요?' },
      { en: '<b>You can find them near</b> the meeting rooms.', kr: '회의실 근처에서 찾을 수 있습니다.' },
      { en: '<b>Ms. Choi handles</b> expense reports.', kr: '최 대리가 경비 정산서를 담당합니다.' },
    ],
    vocabulary: [
      {
        word: 'department',
        pos: 'noun',
        translation: '부서',
        definition: 'a division of a company',
        pronunciation: '/dɪˈpɑːrtmənt/',
      },
      {
        word: 'expense report',
        pos: 'noun',
        translation: '경비 정산서',
        definition: 'a document used to claim work-related costs',
        pronunciation: '/ɪkˈspens rɪˌpɔːrt/',
      },
      {
        word: 'reception',
        pos: 'noun',
        translation: '리셉션',
        definition: 'the front desk area of an office',
        pronunciation: '/rɪˈsepʃn/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /f/ and /p/ in office words.",
      instructionKr: '사무실 단어에서 /f/와 /p/를 연습합시다.',
      left: {
        symbol: '/f/',
        words: [
          { en: 'finance', kr: '재무' },
          { en: 'floor', kr: '층' },
          { en: 'form', kr: '서식' },
          { en: 'find', kr: '찾다' },
          { en: 'office', kr: '사무실' },
        ],
      },
      right: {
        symbol: '/p/',
        words: [
          { en: 'person', kr: '사람' },
          { en: 'paper', kr: '종이' },
          { en: 'place', kr: '장소' },
          { en: 'please', kr: '부탁합니다' },
          { en: 'report', kr: '보고서' },
        ],
      },
    },
    fillRows: [
      { answer: 'I am looking for', suffix: ' the Finance Team.' },
      { answer: 'Which floor are', suffix: ' they on?' },
      { answer: 'You can find them near', suffix: ' the meeting rooms.' },
      { answer: 'Ms. Choi handles', suffix: ' expense reports.' },
    ],
    patternDrills: [
      {
        label: 'Looking for a department',
        labelKr: '부서 찾기',
        template: 'I am looking for ___.',
        examples: [
          { en: 'I am looking for the HR Team.', kr: '인사팀을 찾고 있습니다.' },
          { en: 'I am looking for the sales office.', kr: '영업 사무실을 찾고 있습니다.' },
        ],
      },
      {
        label: 'Asking location',
        labelKr: '위치 묻기',
        template: 'Which floor is ___ on?',
        examples: [
          { en: 'Which floor is Finance on?', kr: '재무팀은 몇 층에 있나요?' },
          { en: 'Which floor is reception on?', kr: '리셉션은 몇 층에 있나요?' },
        ],
      },
      {
        label: 'Finding the right person',
        labelKr: '담당자 찾기',
        template: '___ handles ___.',
        examples: [
          { en: 'Ms. Choi handles expense reports.', kr: '최 대리가 경비 정산서를 담당합니다.' },
          { en: 'Minho handles visitor badges.', kr: '민호가 방문 배지를 담당합니다.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'I am looking for the Finance Team.',
        'Which floor are they on?',
        'You can find them near the meeting rooms.',
        'Ms. Choi handles expense reports.',
        'Reception is on the first floor.',
        'The forms are on Minji’s desk.',
      ],
      completeLines: [
        'I am looking for the _______________ Team.',
        'Which _______________ are they on?',
        'You can find them near the _______________.',
        'Ms. _______________ handles expense reports.',
        'Reception is on the _______________ floor.',
        'The forms are on _______________ desk.',
      ],
      dialogue: [
        { role: 'tutor', en: 'Hi, can I help you?', kr: '안녕하세요, 도와드릴까요?' },
        { role: 'student', en: 'Yes, I am looking for the Finance Team.', kr: '네, 재무팀을 찾고 있습니다.' },
        { role: 'tutor', en: 'Which document do you need to submit?', kr: '어떤 서류를 제출해야 하나요?' },
        { role: 'student', en: 'I need to submit an expense report.', kr: '경비 정산서를 제출해야 합니다.' },
        { role: 'tutor', en: 'They are on the third floor near the meeting rooms. Ms. Choi handles that.', kr: '그들은 3층 회의실 근처에 있고, 최 대리가 담당합니다.' },
        { role: 'student', en: 'Great. Thank you for your help.', kr: '좋습니다. 도와주셔서 감사합니다.' },
      ],
      freePromptItems: [
        'Ask for one department',
        'Ask which floor it is on',
        'Ask who handles one task',
        'Respond with one clear route',
        'Finish with a polite thank-you',
      ],
    },
    challenge: {
      scenarioEn: 'You are a new employee on your first week at Haneul Systems. You need to find the Finance Team and the right person for your expense form.',
      scenarioKr: '한울시스템즈에 입사한 첫 주입니다. 재무팀과 경비 정산서 담당자를 찾아야 합니다.',
      guideQuestions: [
        'Ask where the Finance Team is.',
        'Ask which floor they are on.',
        'Ask who handles the form.',
        'Confirm the location one more time.',
        'End politely.',
      ],
      roleplayTable: {
        you: 'Your own name',
        coworkers: ['Minji Kim', 'Sujin Choi', 'Jisoo Park'],
      },
    },
    discussion: {
      categories: [
        {
          title: 'DEPARTMENTS',
          questions: [
            'Which department do you contact most often?',
            'Which department is easiest to find?',
            'Which department helps visitors the most?',
          ],
        },
        {
          title: 'FRONT DESK',
          questions: [
            'What questions do people ask at reception?',
            'What makes reception staff helpful?',
            'Do you like asking for directions in person?',
          ],
        },
        {
          title: 'WORK TASKS',
          questions: [
            'What document do you submit often?',
            'Who helps you with forms at work?',
            'What task takes the longest in your office?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[2],
      nextLessonName: 'Lesson 9: Need More Supplies',
    },
  },
  {
    chapter: 2,
    lessonNumber: 9,
    skill: 'speaking',
    lessonType: 'SPEAKING',
    slug: 'need-more-supplies',
    chapterName: 'Office Basics',
    lessonName: 'Need More Supplies',
    goalEn: 'Can request office supplies and explain what is needed.',
    goalKr: '사무용품을 요청하고 무엇이 필요한지 설명할 수 있다.',
    situationEn: 'Your team is preparing for a workshop and the supply cabinet is almost empty.',
    situationKr: '팀이 워크숍을 준비하고 있는데 비품함이 거의 비어 있습니다.',
    pronunciationShort: '/s/ vs /ʃ/',
    patterns: [
      { en: '<b>We need more</b> sticky notes.', kr: '포스트잇이 더 필요합니다.' },
      { en: '<b>Could you order</b> more pens?', kr: '펜을 더 주문해 주실 수 있나요?' },
      { en: '<b>We are out of</b> toner.', kr: '토너가 다 떨어졌습니다.' },
      { en: '<b>I need twenty folders</b> for tomorrow’s workshop.', kr: '내일 워크숍을 위해 폴더 20개가 필요합니다.' },
    ],
    vocabulary: [
      {
        word: 'toner',
        pos: 'noun',
        translation: '토너',
        definition: 'the colored powder used inside some printers',
        pronunciation: '/ˈtoʊnər/',
      },
      {
        word: 'folder',
        pos: 'noun',
        translation: '폴더 / 파일철',
        definition: 'a cover used to hold papers together',
        pronunciation: '/ˈfoʊldər/',
      },
      {
        word: 'sticky notes',
        pos: 'noun',
        translation: '포스트잇',
        definition: 'small notes with adhesive on the back',
        pronunciation: '/ˈstɪki noʊts/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /s/ and /ʃ/ in supply words.",
      instructionKr: '비품 단어에서 /s/와 /ʃ/를 연습합시다.',
      left: {
        symbol: '/s/',
        words: [
          { en: 'supplies', kr: '비품' },
          { en: 'sticky', kr: '끈적한' },
          { en: 'pens', kr: '펜들' },
          { en: 'send', kr: '보내다' },
          { en: 'stock', kr: '재고' },
        ],
      },
      right: {
        symbol: '/ʃ/',
        words: [
          { en: 'sheet', kr: '용지' },
          { en: 'shelf', kr: '선반' },
          { en: 'short', kr: '부족한' },
          { en: 'shipment', kr: '배송' },
          { en: 'share', kr: '공유하다' },
        ],
      },
    },
    fillRows: [
      { answer: 'We need more', suffix: ' sticky notes.' },
      { answer: 'Could you order', suffix: ' more pens?' },
      { answer: 'We are out of', suffix: ' toner.' },
      { answer: 'I need twenty folders', suffix: ' for tomorrow’s workshop.' },
    ],
    patternDrills: [
      {
        label: 'Supply request',
        labelKr: '비품 요청',
        template: 'We need more ___.',
        examples: [
          { en: 'We need more markers.', kr: '마커가 더 필요합니다.' },
          { en: 'We need more printing paper.', kr: '출력용 종이가 더 필요합니다.' },
        ],
      },
      {
        label: 'Order request',
        labelKr: '주문 부탁',
        template: 'Could you order ___?',
        examples: [
          { en: 'Could you order more pens?', kr: '펜을 더 주문해 주실 수 있나요?' },
          { en: 'Could you order more labels?', kr: '라벨을 더 주문해 주실 수 있나요?' },
        ],
      },
      {
        label: 'Quantity + purpose',
        labelKr: '수량 + 목적',
        template: 'I need ___ for ___.',
        examples: [
          { en: 'I need ten folders for the client packets.', kr: '고객 자료를 위해 폴더 10개가 필요합니다.' },
          { en: 'I need five name tags for the workshop.', kr: '워크숍을 위해 이름표 5개가 필요합니다.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'We need more sticky notes.',
        'Could you order more pens?',
        'We are out of toner.',
        'I need twenty folders for tomorrow’s workshop.',
        'The supply cabinet is almost empty.',
        'Please send the order today.',
      ],
      completeLines: [
        'We need more _______________.',
        'Could you order more _______________?',
        'We are out of _______________.',
        'I need _______________ for tomorrow’s workshop.',
        'The supply cabinet is almost _______________.',
        'Please send the order _______________.',
      ],
      dialogue: [
        { role: 'tutor', en: 'How is the workshop preparation going?', kr: '워크숍 준비는 어떻게 되고 있나요?' },
        { role: 'student', en: 'We need more sticky notes and folders.', kr: '포스트잇과 폴더가 더 필요합니다.' },
        { role: 'tutor', en: 'Do you have enough toner for the handouts?', kr: '자료 인쇄용 토너는 충분한가요?' },
        { role: 'student', en: 'No. We are out of toner.', kr: '아니요. 토너가 다 떨어졌습니다.' },
        { role: 'tutor', en: 'OK. What should I order today?', kr: '알겠습니다. 오늘 무엇을 주문해야 하나요?' },
        { role: 'student', en: 'Could you order more pens and twenty folders?', kr: '펜을 더 주문하고 폴더 20개를 준비해 주실 수 있나요?' },
      ],
      freePromptItems: [
        'Say what item is missing',
        'Ask for one order politely',
        'Give one quantity',
        'Explain why the item is needed',
        'Finish with a deadline',
      ],
    },
    challenge: {
      scenarioEn: 'You are talking to the office administrator before a workshop. Explain what supplies your team still needs.',
      scenarioKr: '워크숍 전에 사무실 관리자와 이야기하고 있습니다. 팀에 어떤 비품이 더 필요한지 설명하세요.',
      guideQuestions: [
        'What item is completely out?',
        'What item do you need more of?',
        'How many do you need?',
        'What is the purpose of the supplies?',
        'When should the order be placed?',
      ],
      roleplayTable: {
        you: 'Your own name',
        coworkers: ['Jiho Kim', 'Haneul Park', 'Minji Kim'],
      },
    },
    discussion: {
      categories: [
        {
          title: 'OFFICE SUPPLIES',
          questions: [
            'Which office supply runs out most often?',
            'What supply is essential for your work?',
            'Who orders supplies in your workplace?',
          ],
        },
        {
          title: 'WORKSHOPS',
          questions: [
            'What do you need to prepare before a workshop?',
            'Do workshops need many printed materials?',
            'What makes workshop preparation stressful?',
          ],
        },
        {
          title: 'PLANNING AHEAD',
          questions: [
            'Is it better to order supplies early?',
            'How do you track what is missing?',
            'Do you prefer digital or paper materials?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[2],
      nextLessonName: 'Lesson 10: Chapter 2 Personal Review',
    },
  },
  {
    chapter: 2,
    lessonNumber: 10,
    skill: 'review',
    lessonType: 'REVIEW',
    slug: 'chapter-2-personal-review',
    chapterName: 'Office Basics',
    lessonName: 'Chapter 2 Personal Review',
    goalEn: 'Can handle office navigation, equipment instructions, and supply requests more confidently.',
    goalKr: '사무실 길 안내, 기기 설명, 비품 요청을 더 자신 있게 할 수 있다.',
    situationEn: 'You help a new teammate on the office floor: explain a machine, direct them to the right team, and solve one supply problem.',
    situationKr: '사무실 층에서 새 팀원을 돕습니다. 기기 사용법을 설명하고, 올바른 팀으로 안내하고, 비품 문제 하나를 해결하세요.',
    pronunciationShort: 'Review: office tools, directions, and supply language',
    patterns: [
      { en: '<b>Press</b> this button first.', kr: '먼저 이 버튼을 누르세요.' },
      { en: '<b>I am looking for</b> the Finance Team.', kr: '재무팀을 찾고 있습니다.' },
      { en: '<b>We are out of</b> toner.', kr: '토너가 다 떨어졌습니다.' },
      { en: '<b>Could you order</b> more pens?', kr: '펜을 더 주문해 주실 수 있나요?' },
    ],
    vocabulary: [
      {
        word: 'scanner',
        pos: 'noun',
        translation: '스캐너',
        definition: 'a machine that creates a digital copy of a document',
        pronunciation: '/ˈskænər/',
      },
      {
        word: 'department',
        pos: 'noun',
        translation: '부서',
        definition: 'a division of a company',
        pronunciation: '/dɪˈpɑːrtmənt/',
      },
      {
        word: 'toner',
        pos: 'noun',
        translation: '토너',
        definition: 'printer powder used for printing',
        pronunciation: '/ˈtoʊnər/',
      },
    ],
    pronunciation: {
      instruction: 'Review the key sounds from this chapter clearly and slowly.',
      instructionKr: '이번 장의 핵심 발음을 천천히 또박또박 복습합시다.',
      left: {
        symbol: 'Review A',
        words: [
          { en: 'press', kr: '누르다' },
          { en: 'finance', kr: '재무' },
          { en: 'folder', kr: '폴더' },
          { en: 'scanner', kr: '스캐너' },
          { en: 'supply', kr: '비품' },
        ],
      },
      right: {
        symbol: 'Review B',
        words: [
          { en: 'button', kr: '버튼' },
          { en: 'printer', kr: '프린터' },
          { en: 'meeting room', kr: '회의실' },
          { en: 'department', kr: '부서' },
          { en: 'toner', kr: '토너' },
        ],
      },
    },
    fillRows: [
      { answer: 'Press', suffix: ' this button first.' },
      { answer: 'I am looking for', suffix: ' the Finance Team.' },
      { answer: 'We are out of', suffix: ' toner.' },
      { answer: 'Could you order', suffix: ' more pens?' },
    ],
    patternDrills: [
      {
        label: 'Equipment help',
        labelKr: '기기 도움',
        template: 'First, ___. Then, ___.',
        examples: [
          { en: 'First, press the button. Then, place the paper.', kr: '먼저 버튼을 누른 뒤 종이를 놓으세요.' },
          { en: 'First, scan the page. Then, save the file.', kr: '먼저 페이지를 스캔한 뒤 파일을 저장하세요.' },
        ],
      },
      {
        label: 'Department guidance',
        labelKr: '부서 안내',
        template: 'I am looking for ___. / You can find them near ___.',
        examples: [
          { en: 'I am looking for Finance. You can find them near reception.', kr: '재무팀을 찾고 있습니다. 리셉션 근처에서 찾을 수 있습니다.' },
        ],
      },
      {
        label: 'Supply problem',
        labelKr: '비품 문제',
        template: 'We are out of ___. Could you order ___?',
        examples: [
          { en: 'We are out of toner. Could you order more today?', kr: '토너가 없습니다. 오늘 더 주문해 주실 수 있나요?' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Press this button first.',
        'The Finance Team is on the third floor.',
        'Ms. Choi handles expense reports.',
        'We are out of toner.',
        'Could you order more pens?',
        'The memo says the room is reserved.',
      ],
      completeTitle: 'Step 2 - Repair and Personalize',
      completeInstructionEn: 'Complete the lines with the expressions that are still difficult for you.',
      completeInstructionKr: '아직 어려운 표현을 넣어 문장을 완성하세요.',
      completeLines: [
        'First, _______________ this button.',
        'I am looking for _______________.',
        'You can find them near _______________.',
        'We are out of _______________.',
        'Could you order _______________?',
        'Please read the _______________ on the memo board.',
      ],
      dialogueTitle: 'Step 3 - Review Role-play',
      dialogueInstructionEn: 'Review the chapter through one connected office support dialogue.',
      dialogueInstructionKr: '하나의 연결된 사무실 지원 대화로 장 전체를 복습하세요.',
      dialogue: [
        { role: 'tutor', en: 'Hi, I am new here and I need help on this floor.', kr: '안녕하세요, 여기 처음인데 이 층에서 도움이 필요해요.' },
        { role: 'student', en: 'Sure. First, press this button if you need to print.', kr: '물론이죠. 인쇄가 필요하면 먼저 이 버튼을 누르세요.' },
        { role: 'tutor', en: 'Thanks. I also need the Finance Team.', kr: '감사합니다. 재무팀도 찾아야 해요.' },
        { role: 'student', en: 'They are on the third floor near the meeting rooms. Ms. Choi handles expense reports.', kr: '그들은 3층 회의실 근처에 있고, 최 대리가 경비 정산서를 담당합니다.' },
        { role: 'tutor', en: 'One more thing. We are out of pens in this room.', kr: '한 가지 더요. 이 방에 펜이 없어요.' },
        { role: 'student', en: 'OK. I will ask the office admin to order more pens today.', kr: '알겠습니다. 오늘 사무 관리자에게 펜을 더 주문해 달라고 하겠습니다.' },
      ],
      freeTitle: 'Step 4 - Final Office Support Task',
      freeInstructionEn: 'Handle one connected office support situation using at least 6 sentences.',
      freeInstructionKr: '6문장 이상으로 연결된 사무실 지원 상황을 해결하세요.',
      freePromptItems: [
        'Explain one machine step',
        'Give one department route',
        'Name one responsible coworker',
        'Describe one missing supply',
        'Request one order politely',
      ],
    },
    challenge: {
      scenarioEn: 'Final review: support a new teammate on the floor by combining directions, office equipment language, and supply requests.',
      scenarioKr: '최종 복습: 새 팀원을 도우며 길 안내, 기기 표현, 비품 요청을 함께 사용하세요.',
      guideQuestions: [
        'Help with one machine first.',
        'Guide the teammate to one department.',
        'Mention the correct person in charge.',
        'Solve one supply problem.',
        'Keep the conversation polite and smooth.',
      ],
      roleplayTable: {
        you: 'Your own name',
        coworkers: ['Minji Kim', 'Jisoo Park', 'Taemin Choi', 'Sujin Choi'],
      },
    },
    discussion: {
      categories: [
        {
          title: 'REVIEW',
          questions: [
            'Which Chapter 2 expression is easiest for you now?',
            'Which Chapter 2 skill still needs practice?',
            'What will you practice again after this lesson?',
          ],
        },
        {
          title: 'OFFICE SUPPORT',
          questions: [
            'What kind of help do new employees need most?',
            'What office problem happens often in real life?',
            'How can offices make navigation easier?',
          ],
        },
        {
          title: 'NEXT CHAPTER',
          questions: [
            'What part of time and schedules is hardest for you?',
            'Do you often change meeting times?',
            'Do you prefer fixed or flexible schedules?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[3],
      nextLessonName: 'Lesson 1: What Time Is It?',
    },
    reviewScope: 'Lessons 1-9',
    isDynamicFallback: true,
  },
  {
    chapter: 3,
    lessonNumber: 6,
    skill: 'listening',
    lessonType: 'LISTENING',
    slug: 'the-morning-meeting',
    chapterName: 'Time and Schedules',
    lessonName: 'The Morning Meeting',
    goalEn: 'Can understand the main schedule points in a short morning meeting.',
    goalKr: '짧은 아침 회의의 주요 일정 내용을 이해할 수 있다.',
    situationEn: 'Your team lead opens the day with a short meeting about tasks, times, and deadlines.',
    situationKr: '팀장이 업무, 시간, 마감에 대한 짧은 아침 회의를 시작합니다.',
    pronunciationShort: '/d/ and /t/ in schedule words',
    patterns: [
      { en: '<b>The morning meeting starts at</b> 9:15.', kr: '아침 회의는 9시 15분에 시작합니다.' },
      { en: '<b>After that</b>, we review today’s tasks.', kr: '그 후에 오늘의 업무를 검토합니다.' },
      { en: '<b>Please be back by</b> 2 PM.', kr: '오후 2시까지 돌아와 주세요.' },
      { en: '<b>The deadline is</b> Friday afternoon.', kr: '마감은 금요일 오후입니다.' },
    ],
    vocabulary: [
      {
        word: 'deadline',
        pos: 'noun',
        translation: '마감',
        definition: 'the latest time by which something must be finished',
        pronunciation: '/ˈdedlaɪn/',
      },
      {
        word: 'agenda',
        pos: 'noun',
        translation: '안건',
        definition: 'the list of items to discuss in a meeting',
        pronunciation: '/əˈdʒendə/',
      },
      {
        word: 'task',
        pos: 'noun',
        translation: '업무',
        definition: 'a piece of work that needs to be done',
        pronunciation: '/tæsk/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /d/ and /t/ in meeting words.",
      instructionKr: '회의 관련 단어에서 /d/와 /t/를 연습합시다.',
      left: {
        symbol: '/d/',
        words: [
          { en: 'deadline', kr: '마감' },
          { en: 'today', kr: '오늘' },
          { en: 'agenda', kr: '안건' },
          { en: 'done', kr: '완료된' },
          { en: 'discussion', kr: '토론' },
        ],
      },
      right: {
        symbol: '/t/',
        words: [
          { en: 'task', kr: '업무' },
          { en: 'time', kr: '시간' },
          { en: 'team', kr: '팀' },
          { en: 'two', kr: '둘' },
          { en: 'late', kr: '늦은' },
        ],
      },
    },
    fillRows: [
      { answer: 'The morning meeting starts at', suffix: ' 9:15.' },
      { answer: 'After that', suffix: ', we review today’s tasks.' },
      { answer: 'Please be back by', suffix: ' 2 PM.' },
      { answer: 'The deadline is', suffix: ' Friday afternoon.' },
    ],
    patternDrills: [
      {
        label: 'Meeting timing',
        labelKr: '회의 시간',
        template: 'The ___ starts at ___.',
        examples: [
          { en: 'The call starts at 10:00.', kr: '통화는 10시에 시작합니다.' },
          { en: 'The briefing starts at 9:15.', kr: '브리핑은 9시 15분에 시작합니다.' },
        ],
      },
      {
        label: 'Task order',
        labelKr: '업무 순서',
        template: 'After that, we ___.',
        examples: [
          { en: 'After that, we check the report.', kr: '그 후에 보고서를 확인합니다.' },
          { en: 'After that, we meet the client.', kr: '그 후에 고객을 만납니다.' },
        ],
      },
      {
        label: 'Deadlines',
        labelKr: '마감 말하기',
        template: 'The deadline is ___.',
        examples: [
          { en: 'The deadline is Thursday morning.', kr: '마감은 목요일 오전입니다.' },
          { en: 'The deadline is tomorrow at noon.', kr: '마감은 내일 정오입니다.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'The morning meeting starts at 9:15.',
        'After that, we review today’s tasks.',
        'Please be back by 2 PM.',
        'The deadline is Friday afternoon.',
        'The client call is after lunch.',
        'The report is due before the team meeting.',
      ],
      completeLines: [
        'The morning meeting starts at _______________.',
        'After that, we _______________.',
        'Please be back by _______________.',
        'The deadline is _______________.',
        'The client call is _______________.',
        'The report is due _______________.',
      ],
      dialogue: [
        { role: 'tutor', en: 'Good morning, team. The morning meeting starts at 9:15.', kr: '좋은 아침입니다, 여러분. 아침 회의는 9시 15분에 시작합니다.' },
        { role: 'student', en: 'OK. What do we do after that?', kr: '알겠습니다. 그 후에는 무엇을 하나요?' },
        { role: 'tutor', en: 'After that, we review today’s tasks and call the client.', kr: '그 후에 오늘 업무를 검토하고 고객과 통화합니다.' },
        { role: 'student', en: 'What time do we need to be back?', kr: '몇 시까지 돌아와야 하나요?' },
        { role: 'tutor', en: 'Please be back by 2 PM. The deadline is Friday afternoon.', kr: '오후 2시까지 돌아와 주세요. 마감은 금요일 오후입니다.' },
        { role: 'student', en: 'Got it. I will update my schedule.', kr: '알겠습니다. 일정을 업데이트하겠습니다.' },
      ],
      freePromptItems: [
        'Say the meeting start time',
        'Mention one task after the meeting',
        'Mention one return time',
        'Mention one deadline',
        'Summarize the plan in order',
      ],
    },
    challenge: {
      scenarioEn: 'You listen to the team lead in a morning meeting and explain the main schedule points to a coworker who arrived late.',
      scenarioKr: '아침 회의 내용을 늦게 온 동료에게 설명합니다.',
      guideQuestions: [
        'When does the meeting start?',
        'What happens after the meeting?',
        'What time should the team be back?',
        'What is the deadline?',
        'What is the most important task today?',
      ],
    },
    discussion: {
      categories: [
        {
          title: 'MORNING MEETINGS',
          questions: [
            'Does your team have morning meetings?',
            'What should a short morning meeting include?',
            'Do you prefer daily or weekly meetings?',
          ],
        },
        {
          title: 'WORK PRIORITIES',
          questions: [
            'How do you decide your first task of the day?',
            'What kind of deadline feels stressful?',
            'Do you like clear schedules or flexible plans?',
          ],
        },
        {
          title: 'TEAM COMMUNICATION',
          questions: [
            'What happens if someone misses a meeting?',
            'How do teams share task updates?',
            'What makes a meeting easy to understand?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[3],
      nextLessonName: 'Lesson 7: Meeting Email Reply',
    },
  },
  {
    chapter: 3,
    lessonNumber: 7,
    skill: 'reading',
    lessonType: 'READING',
    slug: 'meeting-email-reply',
    chapterName: 'Time and Schedules',
    lessonName: 'Meeting Email Reply',
    goalEn: 'Can read a short email reply about confirming or changing a meeting time.',
    goalKr: '회의 시간 확인 또는 변경에 대한 짧은 이메일 답장을 읽을 수 있다.',
    situationEn: 'You receive an email reply about tomorrow’s meeting and need to confirm the time.',
    situationKr: '내일 회의에 대한 이메일 답장을 받고 시간을 확인해야 합니다.',
    pronunciationShort: '/m/ and /v/ in meeting words',
    patterns: [
      { en: '<b>Thanks for your email.</b>', kr: '이메일 감사합니다.' },
      { en: '<b>That time works for me.</b>', kr: '그 시간 괜찮습니다.' },
      { en: '<b>Could we move it to</b> 4 PM?', kr: '오후 4시로 옮길 수 있을까요?' },
      { en: '<b>Please confirm</b> the new time.', kr: '새 시간을 확인해 주세요.' },
    ],
    vocabulary: [
      {
        word: 'confirm',
        pos: 'verb',
        translation: '확인하다',
        definition: 'to say that something is correct or agreed',
        pronunciation: '/kənˈfɜːrm/',
      },
      {
        word: 'reschedule',
        pos: 'verb',
        translation: '일정을 변경하다',
        definition: 'to move an event to a different time',
        pronunciation: '/riːˈskedʒuːl/',
      },
      {
        word: 'available',
        pos: 'adjective',
        translation: '시간이 되는',
        definition: 'free to meet or talk',
        pronunciation: '/əˈveɪləbəl/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /m/ and /v/ in meeting emails.",
      instructionKr: '회의 이메일에서 /m/와 /v/를 연습합시다.',
      left: {
        symbol: '/m/',
        words: [
          { en: 'move', kr: '옮기다' },
          { en: 'meeting', kr: '회의' },
          { en: 'morning', kr: '오전' },
          { en: 'me', kr: '나' },
          { en: 'message', kr: '메시지' },
        ],
      },
      right: {
        symbol: '/v/',
        words: [
          { en: 'available', kr: '가능한' },
          { en: 'move', kr: '옮기다' },
          { en: 'five', kr: '5' },
          { en: 'review', kr: '검토' },
          { en: 'confirm', kr: '확인하다' },
        ],
      },
    },
    fillRows: [
      { answer: 'Thanks for', suffix: ' your email.' },
      { answer: 'That time', suffix: ' works for me.' },
      { answer: 'Could we move it to', suffix: ' 4 PM?' },
      { answer: 'Please confirm', suffix: ' the new time.' },
    ],
    patternDrills: [
      {
        label: 'Confirming a time',
        labelKr: '시간 확인',
        template: 'That time works for me.',
        examples: [
          { en: 'Tuesday at 3 works for me.', kr: '화요일 3시는 괜찮습니다.' },
          { en: 'The new schedule works for me.', kr: '새 일정 괜찮습니다.' },
        ],
      },
      {
        label: 'Changing a time',
        labelKr: '시간 변경',
        template: 'Could we move it to ___?',
        examples: [
          { en: 'Could we move it to 10:30?', kr: '10시 30분으로 옮길 수 있을까요?' },
          { en: 'Could we move it to tomorrow morning?', kr: '내일 오전으로 옮길 수 있을까요?' },
        ],
      },
      {
        label: 'Reply ending',
        labelKr: '답장 마무리',
        template: 'Please confirm ___.',
        examples: [
          { en: 'Please confirm the final time.', kr: '최종 시간을 확인해 주세요.' },
          { en: 'Please confirm if you are available.', kr: '가능한지 확인해 주세요.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Thanks for your email.',
        'That time works for me.',
        'Could we move it to 4 PM?',
        'Please confirm the new time.',
        'I am available after lunch.',
        'Friday morning is difficult for me.',
      ],
      completeLines: [
        'Thanks for your _______________.',
        'That time _______________ for me.',
        'Could we move it to _______________?',
        'Please confirm the _______________ time.',
        'I am available _______________.',
        'Friday morning is _______________ for me.',
      ],
      dialogue: [
        { role: 'tutor', en: 'I sent a reply about tomorrow’s meeting. Can you read the main point?', kr: '내일 회의에 대한 답장을 보냈어요. 핵심 내용을 읽어 줄 수 있나요?' },
        { role: 'student', en: 'Yes. It says that 2 PM works for me.', kr: '네. 오후 2시가 괜찮다고 적혀 있습니다.' },
        { role: 'tutor', en: 'Did the time stay the same?', kr: '시간이 그대로인가요?' },
        { role: 'student', en: 'No. The email asks if we can move it to 4 PM.', kr: '아니요. 오후 4시로 바꿀 수 있는지 묻고 있습니다.' },
        { role: 'tutor', en: 'What should we do next?', kr: '다음에는 무엇을 해야 하나요?' },
        { role: 'student', en: 'We should confirm the new time.', kr: '새 시간을 확인해야 합니다.' },
      ],
      freePromptItems: [
        'Say the purpose of the reply',
        'Say whether the time works',
        'Say one new time',
        'Say one action to take next',
        'Summarize the email in your own words',
      ],
    },
    challenge: {
      scenarioEn: 'You need to explain a short meeting email reply to a teammate who has not read it yet.',
      scenarioKr: '아직 이메일을 읽지 않은 동료에게 회의 답장 메일 내용을 설명해야 합니다.',
      guideQuestions: [
        'Who sent the reply?',
        'Does the original time work?',
        'What new time is suggested?',
        'What should the team confirm?',
        'What is the final action?',
      ],
    },
    discussion: {
      categories: [
        {
          title: 'EMAIL REPLIES',
          questions: [
            'Do you reply to meeting emails quickly?',
            'What makes a reply clear and helpful?',
            'Do you prefer short or detailed replies?',
          ],
        },
        {
          title: 'SCHEDULE CHANGES',
          questions: [
            'How often do your meetings change?',
            'What is the best way to change a meeting time?',
            'Do morning or afternoon meetings change more often?',
          ],
        },
        {
          title: 'TEAM PLANNING',
          questions: [
            'Is it easy to agree on one time?',
            'Who usually confirms final meeting times?',
            'What detail is most important in a meeting email?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[3],
      nextLessonName: 'Lesson 8: Schedule Check',
    },
  },
  {
    chapter: 3,
    lessonNumber: 8,
    skill: 'speaking',
    lessonType: 'SPEAKING',
    slug: 'schedule-check',
    chapterName: 'Time and Schedules',
    lessonName: 'Schedule Check',
    goalEn: 'Can ask about availability and suggest a meeting time.',
    goalKr: '상대의 가능한 시간을 묻고 회의 시간을 제안할 수 있다.',
    situationEn: 'You need to check a coworker’s schedule before booking a short meeting.',
    situationKr: '짧은 회의를 잡기 전에 동료의 일정을 확인해야 합니다.',
    pronunciationShort: '/f/ in free / after',
    patterns: [
      { en: '<b>Are you available at</b> 3 PM?', kr: '오후 3시에 시간 되세요?' },
      { en: '<b>I am free after</b> lunch.', kr: '점심 후에는 시간이 됩니다.' },
      { en: '<b>I have</b> a client call <b>at</b> 2.', kr: '2시에 고객 통화가 있습니다.' },
      { en: '<b>Could we meet on</b> Thursday instead?', kr: '대신 목요일에 만날 수 있을까요?' },
    ],
    vocabulary: [
      {
        word: 'available',
        pos: 'adjective',
        translation: '가능한',
        definition: 'free to meet or do something',
        pronunciation: '/əˈveɪləbəl/',
      },
      {
        word: 'client call',
        pos: 'noun',
        translation: '고객 통화',
        definition: 'a phone or online meeting with a client',
        pronunciation: '/ˈklaɪənt kɔːl/',
      },
      {
        word: 'instead',
        pos: 'adverb',
        translation: '대신에',
        definition: 'as an alternative',
        pronunciation: '/ɪnˈsted/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /f/ clearly in time phrases.",
      instructionKr: '시간 표현에서 /f/ 발음을 또렷하게 연습합시다.',
      left: {
        symbol: '/f/',
        words: [
          { en: 'free', kr: '시간이 되는' },
          { en: 'after', kr: '후에' },
          { en: 'four', kr: '4' },
          { en: 'Friday', kr: '금요일' },
          { en: 'afternoon', kr: '오후' },
        ],
      },
      right: {
        symbol: 'other',
        words: [
          { en: 'busy', kr: '바쁜' },
          { en: 'meeting', kr: '회의' },
          { en: 'call', kr: '통화' },
          { en: 'today', kr: '오늘' },
          { en: 'schedule', kr: '일정' },
        ],
      },
    },
    fillRows: [
      { answer: 'Are you available at', suffix: ' 3 PM?' },
      { answer: 'I am free after', suffix: ' lunch.' },
      { answer: 'I have', suffix: ' a client call at 2.' },
      { answer: 'Could we meet on', suffix: ' Thursday instead?' },
    ],
    patternDrills: [
      {
        label: 'Checking availability',
        labelKr: '가용 시간 확인',
        template: 'Are you available at ___?',
        examples: [
          { en: 'Are you available at 10?', kr: '10시에 시간 되세요?' },
          { en: 'Are you available tomorrow afternoon?', kr: '내일 오후에 시간 되세요?' },
        ],
      },
      {
        label: 'Saying your schedule',
        labelKr: '내 일정 말하기',
        template: 'I am free after ___. / I have ___ at ___.',
        examples: [
          { en: 'I am free after 1.', kr: '1시 이후는 가능합니다.' },
          { en: 'I have training at 11.', kr: '11시에 교육이 있습니다.' },
        ],
      },
      {
        label: 'Offering another time',
        labelKr: '다른 시간 제안',
        template: 'Could we meet on ___ instead?',
        examples: [
          { en: 'Could we meet on Friday instead?', kr: '대신 금요일에 만날 수 있을까요?' },
          { en: 'Could we meet after lunch instead?', kr: '대신 점심 후에 만날 수 있을까요?' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Are you available at 3 PM?',
        'I am free after lunch.',
        'I have a client call at 2.',
        'Could we meet on Thursday instead?',
        'Friday morning is better for me.',
        'Let’s confirm the time now.',
      ],
      completeLines: [
        'Are you available at _______________?',
        'I am free after _______________.',
        'I have a _______________ at _______________.',
        'Could we meet on _______________ instead?',
        '_______________ is better for me.',
        'Let’s confirm the _______________ now.',
      ],
      dialogue: [
        { role: 'tutor', en: 'Hi, are you available at 3 PM for a short meeting?', kr: '안녕하세요, 오후 3시에 짧은 회의 가능하세요?' },
        { role: 'student', en: 'I have a client call at 2, but I am free after lunch.', kr: '2시에 고객 통화가 있지만 점심 후에는 가능합니다.' },
        { role: 'tutor', en: 'Great. Could we meet on Thursday instead of today?', kr: '좋아요. 오늘 대신 목요일에 만날 수 있을까요?' },
        { role: 'student', en: 'Yes, Thursday works for me.', kr: '네, 목요일 괜찮습니다.' },
        { role: 'tutor', en: 'What time is best?', kr: '몇 시가 가장 좋나요?' },
        { role: 'student', en: 'Let’s meet at 3 PM on Thursday.', kr: '목요일 오후 3시에 만납시다.' },
      ],
      freePromptItems: [
        'Ask about one meeting time',
        'Say one busy time',
        'Say one free time',
        'Offer one alternative day or time',
        'Confirm the final plan',
      ],
    },
    challenge: {
      scenarioEn: 'You and a teammate need to find a short time to meet this week.',
      scenarioKr: '이번 주 안에 팀원과 짧게 만날 시간을 찾아야 합니다.',
      guideQuestions: [
        'Ask about one specific time.',
        'Share one busy time.',
        'Share one free time.',
        'Suggest one new time.',
        'Confirm the final meeting time.',
      ],
      roleplayTable: {
        you: 'Your own name',
        coworkers: KOREAN_NAMES.schedule,
      },
    },
    discussion: {
      categories: [
        {
          title: 'AVAILABILITY',
          questions: [
            'What time of day are you usually most available?',
            'Do you prefer morning or afternoon meetings?',
            'How do you tell someone you are busy?',
          ],
        },
        {
          title: 'WORK WEEK',
          questions: [
            'Which day is the busiest for you?',
            'Which day is easiest for meetings?',
            'Do your plans change often during the week?',
          ],
        },
        {
          title: 'PLANNING',
          questions: [
            'Is it easy to schedule meetings in your team?',
            'Do you like fixed schedules?',
            'What detail should be confirmed every time?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[3],
      nextLessonName: 'Lesson 9: Changing the Time',
    },
  },
  {
    chapter: 3,
    lessonNumber: 9,
    skill: 'speaking',
    lessonType: 'SPEAKING',
    slug: 'changing-the-time',
    chapterName: 'Time and Schedules',
    lessonName: 'Changing the Time',
    goalEn: 'Can reschedule a simple meeting politely.',
    goalKr: '간단한 회의 시간을 정중하게 다시 잡을 수 있다.',
    situationEn: 'A schedule problem came up, so you need to move a planned meeting with a coworker.',
    situationKr: '일정 문제가 생겨서 동료와 예정된 회의 시간을 바꿔야 합니다.',
    pronunciationShort: '/m/ in move / morning',
    patterns: [
      { en: '<b>Can we move the meeting to</b> Friday morning?', kr: '회의를 금요일 오전으로 옮길 수 있을까요?' },
      { en: '<b>Something came up</b> this afternoon.', kr: '오늘 오후에 급한 일이 생겼습니다.' },
      { en: '<b>Does 10:30 work for you?</b>', kr: '10시 30분 괜찮으세요?' },
      { en: '<b>Thanks for adjusting</b> the schedule.', kr: '일정을 조정해 주셔서 감사합니다.' },
    ],
    vocabulary: [
      {
        word: 'reschedule',
        pos: 'verb',
        translation: '일정을 다시 잡다',
        definition: 'to arrange a new time for something',
        pronunciation: '/riːˈskedʒuːl/',
      },
      {
        word: 'slot',
        pos: 'noun',
        translation: '시간대',
        definition: 'a small available time period in a schedule',
        pronunciation: '/slɑːt/',
      },
      {
        word: 'adjust',
        pos: 'verb',
        translation: '조정하다',
        definition: 'to change something slightly to fit a situation',
        pronunciation: '/əˈdʒʌst/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /m/ in time-change phrases.",
      instructionKr: '시간 변경 표현에서 /m/ 발음을 연습합시다.',
      left: {
        symbol: '/m/',
        words: [
          { en: 'move', kr: '옮기다' },
          { en: 'meeting', kr: '회의' },
          { en: 'morning', kr: '오전' },
          { en: 'moment', kr: '순간' },
          { en: 'time', kr: '시간' },
        ],
      },
      right: {
        symbol: 'other',
        words: [
          { en: 'slot', kr: '시간대' },
          { en: 'change', kr: '변경하다' },
          { en: 'Thursday', kr: '목요일' },
          { en: 'today', kr: '오늘' },
          { en: 'later', kr: '나중에' },
        ],
      },
    },
    fillRows: [
      { answer: 'Can we move the meeting to', suffix: ' Friday morning?' },
      { answer: 'Something came up', suffix: ' this afternoon.' },
      { answer: 'Does 10:30 work for', suffix: ' you?' },
      { answer: 'Thanks for adjusting', suffix: ' the schedule.' },
    ],
    patternDrills: [
      {
        label: 'Changing the time',
        labelKr: '시간 변경',
        template: 'Can we move the meeting to ___?',
        examples: [
          { en: 'Can we move the meeting to tomorrow morning?', kr: '회의를 내일 오전으로 옮길 수 있을까요?' },
          { en: 'Can we move the call to 4 PM?', kr: '통화를 오후 4시로 옮길 수 있을까요?' },
        ],
      },
      {
        label: 'Explaining the reason',
        labelKr: '이유 설명',
        template: 'Something came up ___.',
        examples: [
          { en: 'Something came up this afternoon.', kr: '오늘 오후에 급한 일이 생겼습니다.' },
          { en: 'Something came up at noon.', kr: '정오에 급한 일이 생겼습니다.' },
        ],
      },
      {
        label: 'Checking the new slot',
        labelKr: '새 시간 확인',
        template: 'Does ___ work for you?',
        examples: [
          { en: 'Does 10:30 work for you?', kr: '10시 30분 괜찮으세요?' },
          { en: 'Does Friday morning work for you?', kr: '금요일 오전 괜찮으세요?' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Can we move the meeting to Friday morning?',
        'Something came up this afternoon.',
        'Does 10:30 work for you?',
        'Thanks for adjusting the schedule.',
        'I need a different time slot.',
        'Thursday afternoon is better for me.',
      ],
      completeLines: [
        'Can we move the meeting to _______________?',
        'Something came up _______________.',
        'Does _______________ work for you?',
        'Thanks for adjusting the _______________.',
        'I need a different _______________.',
        '_______________ is better for me.',
      ],
      dialogue: [
        { role: 'tutor', en: 'Hi, can we still meet this afternoon?', kr: '안녕하세요, 오늘 오후에 아직 만날 수 있을까요?' },
        { role: 'student', en: 'Actually, something came up this afternoon.', kr: '사실 오늘 오후에 급한 일이 생겼습니다.' },
        { role: 'tutor', en: 'No problem. Can we move the meeting to Friday morning?', kr: '괜찮습니다. 금요일 오전으로 회의를 옮길 수 있을까요?' },
        { role: 'student', en: 'Yes. Does 10:30 work for you?', kr: '네. 10시 30분 괜찮으세요?' },
        { role: 'tutor', en: 'Yes, that works for me.', kr: '네, 괜찮습니다.' },
        { role: 'student', en: 'Great. Thanks for adjusting the schedule.', kr: '좋습니다. 일정 조정해 주셔서 감사합니다.' },
      ],
      freePromptItems: [
        'Explain why the original time is difficult',
        'Suggest one new day or time',
        'Check whether the new time works',
        'Confirm the final slot',
        'Thank the other person politely',
      ],
    },
    challenge: {
      scenarioEn: 'A meeting cannot happen at the original time. Reschedule it politely and confirm a new slot.',
      scenarioKr: '원래 시간에 회의를 할 수 없습니다. 정중하게 다시 잡고 새 시간을 확인하세요.',
      guideQuestions: [
        'State the original problem.',
        'Suggest one new time.',
        'Ask if the new time works.',
        'Confirm the final schedule.',
        'Close politely.',
      ],
      roleplayTable: {
        you: 'Your own name',
        coworkers: ['Sujin Lee', 'Minho Han', 'Yuna Seo'],
      },
    },
    discussion: {
      categories: [
        {
          title: 'RESCHEDULING',
          questions: [
            'How often do you reschedule meetings?',
            'What is a polite way to change a time?',
            'What is the hardest part of rescheduling?',
          ],
        },
        {
          title: 'POLITE LANGUAGE',
          questions: [
            'How do you sound polite when asking for a change?',
            'Do you say sorry first or suggest a new time first?',
            'What phrase sounds most professional to you?',
          ],
        },
        {
          title: 'TIME HABITS',
          questions: [
            'Do you prefer planning early or last minute?',
            'What time is hardest to protect in your day?',
            'What is your best meeting time?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[3],
      nextLessonName: 'Lesson 10: Chapter 3 Personal Review',
    },
  },
  {
    chapter: 3,
    lessonNumber: 10,
    skill: 'review',
    lessonType: 'REVIEW',
    slug: 'chapter-3-personal-review',
    chapterName: 'Time and Schedules',
    lessonName: 'Chapter 3 Personal Review',
    goalEn: 'Can handle schedule checks, meeting changes, and time-based updates more confidently.',
    goalKr: '일정 확인, 회의 시간 변경, 시간 관련 업데이트를 더 자신 있게 할 수 있다.',
    situationEn: 'You need to manage one full meeting flow: understand the plan, check availability, change the time, and confirm the final schedule.',
    situationKr: '하나의 회의 흐름 전체를 관리해야 합니다. 일정 이해, 가능 시간 확인, 시간 변경, 최종 일정 확인을 모두 합니다.',
    pronunciationShort: 'Review: time, meeting, and availability language',
    patterns: [
      { en: '<b>The morning meeting starts at</b> 9:15.', kr: '아침 회의는 9시 15분에 시작합니다.' },
      { en: '<b>That time works for me.</b>', kr: '그 시간 괜찮습니다.' },
      { en: '<b>Are you available at</b> 3 PM?', kr: '오후 3시에 시간 되세요?' },
      { en: '<b>Can we move the meeting to</b> Friday morning?', kr: '회의를 금요일 오전으로 옮길 수 있을까요?' },
    ],
    vocabulary: [
      {
        word: 'deadline',
        pos: 'noun',
        translation: '마감',
        definition: 'the latest time to finish something',
        pronunciation: '/ˈdedlaɪn/',
      },
      {
        word: 'confirm',
        pos: 'verb',
        translation: '확인하다',
        definition: 'to say something is agreed or correct',
        pronunciation: '/kənˈfɜːrm/',
      },
      {
        word: 'available',
        pos: 'adjective',
        translation: '가능한',
        definition: 'free to meet or act',
        pronunciation: '/əˈveɪləbəl/',
      },
    ],
    pronunciation: {
      instruction: 'Review the core meeting and schedule sounds with a calm pace.',
      instructionKr: '차분한 속도로 회의와 일정 관련 핵심 발음을 복습합시다.',
      left: {
        symbol: 'Review A',
        words: [
          { en: 'meeting', kr: '회의' },
          { en: 'deadline', kr: '마감' },
          { en: 'move', kr: '옮기다' },
          { en: 'available', kr: '가능한' },
          { en: 'Friday', kr: '금요일' },
        ],
      },
      right: {
        symbol: 'Review B',
        words: [
          { en: 'time', kr: '시간' },
          { en: 'task', kr: '업무' },
          { en: 'confirm', kr: '확인하다' },
          { en: 'morning', kr: '오전' },
          { en: 'schedule', kr: '일정' },
        ],
      },
    },
    fillRows: [
      { answer: 'The morning meeting starts at', suffix: ' 9:15.' },
      { answer: 'That time', suffix: ' works for me.' },
      { answer: 'Are you available at', suffix: ' 3 PM?' },
      { answer: 'Can we move the meeting to', suffix: ' Friday morning?' },
    ],
    patternDrills: [
      {
        label: 'Meeting flow',
        labelKr: '회의 흐름',
        template: 'The meeting starts at ___. After that, we ___.',
        examples: [
          { en: 'The meeting starts at 9. After that, we review tasks.', kr: '회의는 9시에 시작하고, 그 후에 업무를 검토합니다.' },
        ],
      },
      {
        label: 'Availability + reply',
        labelKr: '가능 시간 + 답변',
        template: 'Are you available at ___? That time works for me.',
        examples: [
          { en: 'Are you available at 2? Yes, that time works for me.', kr: '2시에 시간 되세요? 네, 그 시간 괜찮습니다.' },
        ],
      },
      {
        label: 'Rescheduling',
        labelKr: '일정 변경',
        template: 'Something came up. Can we move the meeting to ___?',
        examples: [
          { en: 'Something came up. Can we move the meeting to tomorrow morning?', kr: '급한 일이 생겼습니다. 회의를 내일 오전으로 옮길 수 있을까요?' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'The morning meeting starts at 9:15.',
        'After that, we review today’s tasks.',
        'That time works for me.',
        'Are you available at 3 PM?',
        'Can we move the meeting to Friday morning?',
        'Please confirm the new time.',
      ],
      completeTitle: 'Step 2 - Repair and Personalize',
      completeInstructionEn: 'Complete the schedule lines using the expressions you still need to strengthen.',
      completeInstructionKr: '아직 더 연습이 필요한 표현으로 일정 문장을 완성하세요.',
      completeLines: [
        'The meeting starts at _______________.',
        'After that, we _______________.',
        'Are you available at _______________?',
        'That time _______________ for me.',
        'Can we move the meeting to _______________?',
        'Please confirm the _______________.',
      ],
      dialogueTitle: 'Step 3 - Review Role-play',
      dialogueInstructionEn: 'Review the whole chapter through one connected scheduling conversation.',
      dialogueInstructionKr: '하나의 연결된 일정 대화로 장 전체를 복습하세요.',
      dialogue: [
        { role: 'tutor', en: 'Let’s check the plan for tomorrow. The morning meeting starts at 9:15.', kr: '내일 계획을 확인합시다. 아침 회의는 9시 15분에 시작합니다.' },
        { role: 'student', en: 'OK. After that, we review today’s tasks and client notes.', kr: '알겠습니다. 그 후에 오늘 업무와 고객 메모를 검토합니다.' },
        { role: 'tutor', en: 'Are you available at 3 PM for a follow-up?', kr: '오후 3시에 후속 미팅 가능하세요?' },
        { role: 'student', en: 'Actually, something came up. Can we move the meeting to Friday morning?', kr: '사실 급한 일이 생겼습니다. 회의를 금요일 오전으로 옮길 수 있을까요?' },
        { role: 'tutor', en: 'Yes, that time works for me.', kr: '네, 그 시간 괜찮습니다.' },
        { role: 'student', en: 'Great. Please confirm the new time in the email.', kr: '좋습니다. 새 시간을 이메일로 확인해 주세요.' },
      ],
      freeTitle: 'Step 4 - Final Scheduling Task',
      freeInstructionEn: 'Manage one full meeting plan using at least 6 connected sentences.',
      freeInstructionKr: '6문장 이상으로 하나의 회의 계획 전체를 관리하세요.',
      freePromptItems: [
        'Mention the original meeting time',
        'Mention one task after the meeting',
        'Check one coworker’s availability',
        'Change one meeting time',
        'Confirm the final schedule politely',
      ],
    },
    challenge: {
      scenarioEn: 'Final review: manage a full meeting plan by combining schedule details, availability checks, and rescheduling.',
      scenarioKr: '최종 복습: 일정 내용, 가용 시간 확인, 일정 변경을 결합해 회의 계획 전체를 관리하세요.',
      guideQuestions: [
        'State the original schedule clearly.',
        'Check one time with the other person.',
        'Change one part of the plan.',
        'Confirm the new time.',
        'Use polite meeting language throughout.',
      ],
      roleplayTable: {
        you: 'Your own name',
        coworkers: ['Sujin Lee', 'Minho Han', 'Yuna Seo', 'Jisoo Park'],
      },
    },
    discussion: {
      categories: [
        {
          title: 'REVIEW',
          questions: [
            'Which Chapter 3 pattern feels strongest now?',
            'Which Chapter 3 expression still feels difficult?',
            'What part of schedule English do you want to improve next?',
          ],
        },
        {
          title: 'MEETING HABITS',
          questions: [
            'Do you prefer short or long meetings?',
            'What makes a meeting efficient?',
            'How should a team confirm a final time?',
          ],
        },
        {
          title: 'NEXT CHAPTER',
          questions: [
            'What workplace requests do you make most often?',
            'Do you often ask coworkers for help?',
            'What is the hardest request to make in English?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[4],
      nextLessonName: 'Lesson 1: Can You Help Me?',
    },
    reviewScope: 'Lessons 1-9',
    isDynamicFallback: true,
  },
  {
    chapter: 4,
    lessonNumber: 6,
    skill: 'listening',
    lessonType: 'LISTENING',
    slug: 'coffee-for-the-meeting',
    chapterName: 'Making Requests',
    lessonName: 'Coffee for the Meeting',
    goalEn: 'Can understand simple requests and offers while preparing a meeting room.',
    goalKr: '회의실을 준비하면서 간단한 요청과 제안을 이해할 수 있다.',
    situationEn: 'Your team is preparing drinks, materials, and equipment before guests arrive.',
    situationKr: '손님이 오기 전에 팀이 음료, 자료, 기기를 준비하고 있습니다.',
    pronunciationShort: '/k/ vs /g/',
    patterns: [
      { en: '<b>Could you bring</b> coffee to the meeting room?', kr: '회의실로 커피를 가져다주실 수 있나요?' },
      { en: '<b>Can you help me set up</b> the projector?', kr: '프로젝터 설치를 도와주실 수 있나요?' },
      { en: "<b>I'll take care of</b> the name tags.", kr: '명찰은 제가 맡을게요.' },
      { en: '<b>No problem. I can get</b> the cups and napkins.', kr: '문제없어요. 컵과 냅킨은 제가 가져올게요.' },
    ],
    vocabulary: [
      {
        word: 'projector',
        pos: 'noun',
        translation: '프로젝터',
        definition: 'a machine that shows images on a wall or screen',
        pronunciation: '/prəˈdʒektər/',
      },
      {
        word: 'name tag',
        pos: 'noun',
        translation: '명찰',
        definition: "a small card that shows a person's name",
        pronunciation: '/ˈneɪm tæɡ/',
      },
      {
        word: 'napkin',
        pos: 'noun',
        translation: '냅킨',
        definition: 'a small piece of paper or cloth used while eating or drinking',
        pronunciation: '/ˈnæpkɪn/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /k/ and /g/ in meeting setup words.",
      instructionKr: '회의 준비 단어에서 /k/와 /g/를 연습합시다.',
      left: {
        symbol: '/k/',
        words: [
          { en: 'coffee', kr: '커피' },
          { en: 'cups', kr: '컵' },
          { en: 'copy', kr: '복사본' },
          { en: 'client', kr: '고객' },
          { en: 'can', kr: '할 수 있다' },
        ],
      },
      right: {
        symbol: '/g/',
        words: [
          { en: 'guest', kr: '손님' },
          { en: 'get', kr: '가져오다' },
          { en: 'green', kr: '초록색' },
          { en: 'go', kr: '가다' },
          { en: 'good', kr: '좋은' },
        ],
      },
    },
    fillRows: [
      { answer: 'Could you bring', suffix: ' coffee to the meeting room?' },
      { answer: 'Can you help me set up', suffix: ' the projector?' },
      { answer: "I'll take care of", suffix: ' the name tags.' },
      { answer: 'No problem. I can get', suffix: ' the cups and napkins.' },
    ],
    patternDrills: [
      {
        label: 'Requesting help',
        labelKr: '도움 요청하기',
        template: 'Could you bring ___ to ___?',
        examples: [
          { en: 'Could you bring the folders to Room B?', kr: '폴더를 B회의실로 가져다주실 수 있나요?' },
          { en: 'Could you bring water to the front desk?', kr: '물을 프런트 데스크로 가져다주실 수 있나요?' },
        ],
      },
      {
        label: 'Setting up',
        labelKr: '준비하기',
        template: 'Can you help me set up ___?',
        examples: [
          { en: 'Can you help me set up the screen?', kr: '스크린 설치를 도와주실 수 있나요?' },
          { en: 'Can you help me set up the speaker?', kr: '스피커 설치를 도와주실 수 있나요?' },
        ],
      },
      {
        label: 'Taking ownership',
        labelKr: '업무 맡기',
        template: "I'll take care of ___.",
        examples: [
          { en: "I'll take care of the guest list.", kr: '손님 명단은 제가 맡을게요.' },
          { en: "I'll take care of the sign-in table.", kr: '등록 테이블은 제가 맡을게요.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Could you bring coffee to the meeting room?',
        'Can you help me set up the projector?',
        "I'll take care of the name tags.",
        'No problem. I can get the cups and napkins.',
        'The guests will arrive in ten minutes.',
        "Let's finish the setup quickly.",
      ],
      completeTitle: 'Step 2 - Complete the Setup Requests',
      completeInstructionEn: 'Complete the meeting setup requests with the missing words.',
      completeInstructionKr: '빠진 단어를 넣어 회의 준비 요청 문장을 완성하세요.',
      completeLines: [
        'Could you _______________ coffee to the meeting room?',
        'Can you help me set up the _______________?',
        "I'll take care of the _______________.",
        'No problem. I can get the _______________ and napkins.',
        'The _______________ will arrive in ten minutes.',
        "Let's finish the _______________ quickly.",
      ],
      dialogue: [
        { role: 'tutor', en: 'The guests will arrive soon. Could you bring coffee to the meeting room?', kr: '곧 손님들이 도착합니다. 회의실로 커피를 가져다주실 수 있나요?' },
        { role: 'student', en: 'Sure. I can bring coffee right away.', kr: '네. 바로 커피를 가져다드릴게요.' },
        { role: 'tutor', en: 'Thanks. Can you also help me set up the projector?', kr: '감사합니다. 프로젝터 설치도 도와주실 수 있나요?' },
        { role: 'student', en: 'Of course. I can do that after the coffee.', kr: '물론입니다. 커피를 가져다드린 후에 할게요.' },
        { role: 'tutor', en: "Great. I'll take care of the name tags.", kr: '좋아요. 명찰은 제가 맡을게요.' },
        { role: 'student', en: 'No problem. I can get the cups and napkins too.', kr: '문제없어요. 컵과 냅킨도 제가 가져올게요.' },
      ],
      freePromptItems: [
        'Mention one drink or item',
        'Ask for one piece of help',
        'Offer to do one task yourself',
        'Mention the meeting time or guest arrival',
        'Finish with a polite response',
      ],
    },
    challenge: {
      scenarioEn: 'A manager asks you to help prepare a small client meeting. Respond to the requests and offer one extra task.',
      scenarioKr: '관리자가 작은 고객 미팅 준비를 도와달라고 합니다. 요청에 답하고 추가로 한 가지 일을 제안하세요.',
      guideQuestions: [
        'Respond to one request politely.',
        'Offer to handle one task yourself.',
        'Mention one meeting item.',
        'Show that you understand the time pressure.',
        'Close in a helpful way.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.request },
      tutorTip: 'Keep the language practical and teamwork-focused, not overly formal.',
    },
    discussion: {
      categories: [
        {
          title: 'REQUESTS',
          questions: [
            'What kind of help do people ask for before a meeting?',
            'What is easy for you to help with at work?',
            'How do you sound polite when asking for help?',
          ],
        },
        {
          title: 'MEETING SETUP',
          questions: [
            'What should be ready before guests arrive?',
            'What item is often forgotten in a meeting room?',
            'Who usually prepares the room in your workplace?',
          ],
        },
        {
          title: 'TEAM SUPPORT',
          questions: [
            'Do you like when coworkers ask you for help?',
            'What makes teamwork smooth before an event?',
            'How can a team divide small tasks better?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[4],
      nextLessonName: 'Lesson 7: Refreshment Request Form',
    },
  },
  {
    chapter: 4,
    lessonNumber: 7,
    skill: 'reading',
    lessonType: 'READING',
    slug: 'refreshment-request-form',
    chapterName: 'Making Requests',
    lessonName: 'Refreshment Request Form',
    goalEn: 'Can read a short refreshment request form and understand what is needed.',
    goalKr: '짧은 다과 요청 양식을 읽고 무엇이 필요한지 이해할 수 있다.',
    situationEn: 'You check a request form for drinks and supplies before an internal meeting.',
    situationKr: '사내 회의 전에 음료와 물품 요청 양식을 확인합니다.',
    pronunciationShort: '/iː/ in request words',
    patterns: [
      { en: '<b>We need</b> 8 bottles of water.', kr: '생수 8병이 필요합니다.' },
      { en: '<b>Please prepare</b> 10 paper cups.', kr: '종이컵 10개를 준비해 주세요.' },
      { en: '<b>The request is for</b> the 3 PM meeting.', kr: '이 요청은 오후 3시 회의를 위한 것입니다.' },
      { en: '<b>Please place everything in</b> Room C.', kr: '모든 것을 C회의실에 놓아 주세요.' },
    ],
    vocabulary: [
      {
        word: 'request form',
        pos: 'noun',
        translation: '요청 양식',
        definition: 'a document used to ask for something officially',
        pronunciation: '/rɪˈkwest fɔːrm/',
      },
      {
        word: 'paper cup',
        pos: 'noun',
        translation: '종이컵',
        definition: 'a disposable cup made of paper',
        pronunciation: '/ˈpeɪpər kʌp/',
      },
      {
        word: 'bottle',
        pos: 'noun',
        translation: '병',
        definition: 'a container for drinks',
        pronunciation: '/ˈbɑːtəl/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice the long /iː/ sound in request words.",
      instructionKr: '요청 관련 단어의 긴 /iː/ 발음을 연습합시다.',
      left: {
        symbol: '/iː/',
        words: [
          { en: 'need', kr: '필요하다' },
          { en: 'please', kr: '부디, 제발' },
          { en: 'meeting', kr: '회의' },
          { en: 'tea', kr: '차' },
          { en: 'sheet', kr: '용지' },
        ],
      },
      right: {
        symbol: 'Contrast',
        words: [
          { en: 'give', kr: '주다' },
          { en: 'list', kr: '목록' },
          { en: 'milk', kr: '우유' },
          { en: 'ticket', kr: '표' },
          { en: 'minute', kr: '분' },
        ],
      },
    },
    fillRows: [
      { answer: 'We need', suffix: ' 8 bottles of water.' },
      { answer: 'Please prepare', suffix: ' 10 paper cups.' },
      { answer: 'The request is for', suffix: ' the 3 PM meeting.' },
      { answer: 'Please place everything in', suffix: ' Room C.' },
    ],
    patternDrills: [
      {
        label: 'Needed items',
        labelKr: '필요한 물품',
        template: 'We need ___ for the meeting.',
        examples: [
          { en: 'We need tea for the meeting.', kr: '회의를 위해 차가 필요합니다.' },
          { en: 'We need extra chairs for the meeting.', kr: '회의를 위해 여분의 의자가 필요합니다.' },
        ],
      },
      {
        label: 'Preparation requests',
        labelKr: '준비 요청',
        template: 'Please prepare ___.',
        examples: [
          { en: 'Please prepare three markers.', kr: '마커 세 개를 준비해 주세요.' },
          { en: 'Please prepare the sign-in sheet.', kr: '출석부를 준비해 주세요.' },
        ],
      },
      {
        label: 'Location details',
        labelKr: '장소 정보',
        template: 'Please place everything in ___.',
        examples: [
          { en: 'Please place everything in Room A.', kr: '모든 것을 A회의실에 놓아 주세요.' },
          { en: 'Please place everything near the reception desk.', kr: '모든 것을 리셉션 데스크 근처에 놓아 주세요.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'We need 8 bottles of water.',
        'Please prepare 10 paper cups.',
        'The request is for the 3 PM meeting.',
        'Please place everything in Room C.',
        'The guests prefer coffee and tea.',
        'The list must be ready by noon.',
      ],
      completeTitle: 'Step 2 - Complete the Request Form',
      completeInstructionEn: 'Complete the request lines using the missing details.',
      completeInstructionKr: '빠진 내용을 넣어 요청 양식 문장을 완성하세요.',
      completeLines: [
        'We need _______________ bottles of water.',
        'Please prepare _______________ paper cups.',
        'The request is for the _______________ meeting.',
        'Please place everything in _______________.',
        'The guests prefer _______________ and tea.',
        'The list must be ready by _______________.',
      ],
      dialogueTitle: 'Step 3 - Read and Confirm',
      dialogueInstructionEn: 'Read the request details, then confirm them with your coworker.',
      dialogueInstructionKr: '요청 내용을 읽은 뒤 동료와 확인하세요.',
      dialogue: [
        { role: 'tutor', en: "Can you check the request form for today's meeting?", kr: '오늘 회의 요청 양식을 확인해 주실 수 있나요?' },
        { role: 'student', en: 'Sure. We need 8 bottles of water and 10 paper cups.', kr: '네. 생수 8병과 종이컵 10개가 필요합니다.' },
        { role: 'tutor', en: 'What time is the request for?', kr: '몇 시 회의를 위한 요청인가요?' },
        { role: 'student', en: 'It is for the 3 PM meeting.', kr: '오후 3시 회의를 위한 것입니다.' },
        { role: 'tutor', en: 'Where should we place everything?', kr: '모든 것을 어디에 두어야 하나요?' },
        { role: 'student', en: 'Please place everything in Room C.', kr: '모든 것을 C회의실에 놓아 주세요.' },
      ],
      freePromptItems: [
        'Mention two requested items',
        'Mention the meeting time',
        'Mention the room',
        'Use one please sentence',
        'Check one detail again politely',
      ],
    },
    challenge: {
      scenarioEn: 'You are reading a request form and must explain the needed items and location to a coworker.',
      scenarioKr: '요청 양식을 읽고 필요한 물품과 장소를 동료에게 설명해야 합니다.',
      guideQuestions: [
        'State what items are needed.',
        'Mention how many of each item are needed.',
        'Mention the meeting time.',
        'Tell where to place everything.',
        'Check one detail at the end.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.request },
    },
    discussion: {
      categories: [
        {
          title: 'FORMS',
          questions: [
            'What request forms do you use at work?',
            'What information should always be on a form?',
            'Is it better to read a form or an email for small requests?',
          ],
        },
        {
          title: 'SUPPLIES',
          questions: [
            'What meeting supplies are used often in your office?',
            'What supply runs out quickly?',
            'How do you track small office items?',
          ],
        },
        {
          title: 'DETAILS',
          questions: [
            'Why are numbers important in request forms?',
            'What happens when a room or time is missing?',
            'How do you double-check small details?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[4],
      nextLessonName: 'Lesson 8: Could You Bring More Cups?',
    },
  },
  {
    chapter: 4,
    lessonNumber: 8,
    skill: 'speaking',
    lessonType: 'SPEAKING',
    slug: 'could-you-bring-more-cups',
    chapterName: 'Making Requests',
    lessonName: 'Could You Bring More Cups?',
    goalEn: 'Can ask a coworker for extra items in a polite and clear way.',
    goalKr: '동료에게 추가 물품을 정중하고 분명하게 요청할 수 있다.',
    situationEn: 'You notice that the meeting room is missing a few items and need quick help.',
    situationKr: '회의실에 몇 가지 물품이 부족한 것을 보고 빠르게 도움을 요청해야 합니다.',
    pronunciationShort: '/m/ in polite request phrases',
    patterns: [
      { en: '<b>Could you bring</b> more cups?', kr: '컵을 더 가져다주실 수 있나요?' },
      { en: '<b>We also need</b> two markers.', kr: '마커 두 개도 더 필요합니다.' },
      { en: '<b>Can you bring them</b> before the meeting starts?', kr: '회의 시작 전에 그것들을 가져다주실 수 있나요?' },
      { en: '<b>Thanks. That would help</b> a lot.', kr: '감사합니다. 큰 도움이 될 거예요.' },
    ],
    vocabulary: [
      {
        word: 'marker',
        pos: 'noun',
        translation: '마커',
        definition: 'a pen used for writing on a whiteboard',
        pronunciation: '/ˈmɑːrkər/',
      },
      {
        word: 'extra',
        pos: 'adjective',
        translation: '추가의',
        definition: 'more than the usual number or amount',
        pronunciation: '/ˈekstrə/',
      },
      {
        word: 'before',
        pos: 'preposition',
        translation: '전에',
        definition: 'earlier than a specific time',
        pronunciation: '/bɪˈfɔːr/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice the /m/ sound in request phrases.",
      instructionKr: '요청 표현의 /m/ 소리를 연습합시다.',
      left: {
        symbol: '/m/',
        words: [
          { en: 'more', kr: '더 많은' },
          { en: 'marker', kr: '마커' },
          { en: 'meeting', kr: '회의' },
          { en: 'moment', kr: '잠깐' },
          { en: 'room', kr: '방' },
        ],
      },
      right: {
        symbol: 'Contrast',
        words: [
          { en: 'cups', kr: '컵' },
          { en: 'bring', kr: '가져오다' },
          { en: 'need', kr: '필요하다' },
          { en: 'help', kr: '도움' },
          { en: 'desk', kr: '책상' },
        ],
      },
    },
    fillRows: [
      { answer: 'Could you bring', suffix: ' more cups?' },
      { answer: 'We also need', suffix: ' two markers.' },
      { answer: 'Can you bring them', suffix: ' before the meeting starts?' },
      { answer: 'Thanks. That would help', suffix: ' a lot.' },
    ],
    patternDrills: [
      {
        label: 'Asking for more items',
        labelKr: '추가 물품 요청',
        template: 'Could you bring more ___?',
        examples: [
          { en: 'Could you bring more folders?', kr: '폴더를 더 가져다주실 수 있나요?' },
          { en: 'Could you bring more chairs?', kr: '의자를 더 가져다주실 수 있나요?' },
        ],
      },
      {
        label: 'Stating another need',
        labelKr: '추가 필요 사항 말하기',
        template: 'We also need ___.',
        examples: [
          { en: 'We also need a speaker cable.', kr: '스피커 케이블도 필요합니다.' },
          { en: 'We also need one sign-in sheet.', kr: '출석부 한 장도 필요합니다.' },
        ],
      },
      {
        label: 'Time request',
        labelKr: '시간 요청',
        template: 'Can you bring them before ___?',
        examples: [
          { en: 'Can you bring them before 2 PM?', kr: '오후 2시 전에 가져다주실 수 있나요?' },
          { en: 'Can you bring them before the guests arrive?', kr: '손님이 오기 전에 가져다주실 수 있나요?' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Could you bring more cups?',
        'We also need two markers.',
        'Can you bring them before the meeting starts?',
        'Thanks. That would help a lot.',
        'The room is almost ready.',
        'We only need a few more things.',
      ],
      completeLines: [
        'Could you bring more _______________?',
        'We also need _______________.',
        'Can you bring them before _______________?',
        'Thanks. That would help _______________.',
        'The room is almost _______________.',
        'We only need a few more _______________.',
      ],
      dialogue: [
        { role: 'tutor', en: 'The guests are coming soon. What do we still need?', kr: '곧 손님들이 옵니다. 아직 무엇이 필요하죠?' },
        { role: 'student', en: 'Could you bring more cups? We do not have enough.', kr: '컵을 더 가져다주실 수 있나요? 충분하지 않습니다.' },
        { role: 'tutor', en: 'Sure. Anything else?', kr: '네. 또 필요한 게 있나요?' },
        { role: 'student', en: 'Yes. We also need two markers for the whiteboard.', kr: '네. 화이트보드용 마커 두 개도 더 필요합니다.' },
        { role: 'tutor', en: 'When do you need them?', kr: '언제까지 필요하신가요?' },
        { role: 'student', en: 'Can you bring them before the meeting starts? Thanks. That would help a lot.', kr: '회의 시작 전에 가져다주실 수 있나요? 감사합니다. 큰 도움이 될 거예요.' },
      ],
      freePromptItems: [
        'Ask for one missing item',
        'Add one more item',
        'Mention a time limit',
        'Thank the coworker naturally',
        'Speak in one short connected request',
      ],
    },
    challenge: {
      scenarioEn: 'You are in the meeting room and realize some items are missing. Ask a coworker for help quickly and politely.',
      scenarioKr: '회의실에서 몇 가지 물품이 부족하다는 것을 알게 되었습니다. 동료에게 빠르고 정중하게 도움을 요청하세요.',
      guideQuestions: [
        'State what item is missing.',
        'Add one more needed item.',
        'Mention when you need them.',
        'Use a polite thanks sentence.',
        'Keep the request clear and short.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.request },
    },
    discussion: {
      categories: [
        {
          title: 'SMALL REQUESTS',
          questions: [
            'What small items do you ask coworkers for most often?',
            'Do you usually ask once or explain the reason too?',
            'What makes a request sound polite but natural?',
          ],
        },
        {
          title: 'MEETING ROOMS',
          questions: [
            'What is usually missing in a meeting room?',
            'What should always be checked before a meeting starts?',
            'Who is usually responsible for checking the room?',
          ],
        },
        {
          title: 'WORK STYLE',
          questions: [
            'Do you like to prepare early or at the last minute?',
            'How do you react when something is missing?',
            'What is your best habit before a meeting?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[4],
      nextLessonName: 'Lesson 9: Let Me Help With the Guests',
    },
  },
  {
    chapter: 4,
    lessonNumber: 9,
    skill: 'speaking',
    lessonType: 'SPEAKING',
    slug: 'let-me-help-with-the-guests',
    chapterName: 'Making Requests',
    lessonName: 'Let Me Help With the Guests',
    goalEn: 'Can offer help and divide simple tasks before guests arrive.',
    goalKr: '손님이 오기 전에 도움을 제안하고 간단한 업무를 나눌 수 있다.',
    situationEn: 'Your team needs to welcome visitors, so you offer help and divide last-minute tasks.',
    situationKr: '방문객을 맞이해야 해서 팀이 막바지 업무를 나누고 도움을 제안합니다.',
    pronunciationShort: '/l/ in help and welcome language',
    patterns: [
      { en: '<b>Let me help with</b> the guests.', kr: '손님 응대는 제가 도와드릴게요.' },
      { en: '<b>I can welcome</b> them at the door.', kr: '제가 문 앞에서 맞이할 수 있습니다.' },
      { en: '<b>Could you handle</b> the sign-in table?', kr: '등록 테이블을 맡아주실 수 있나요?' },
      { en: '<b>That would be great.</b>', kr: '그러면 정말 좋겠습니다.' },
    ],
    vocabulary: [
      {
        word: 'welcome',
        pos: 'verb',
        translation: '맞이하다',
        definition: 'to greet someone when they arrive',
        pronunciation: '/ˈwelkəm/',
      },
      {
        word: 'handle',
        pos: 'verb',
        translation: '처리하다, 맡다',
        definition: 'to take responsibility for a task',
        pronunciation: '/ˈhændəl/',
      },
      {
        word: 'sign-in table',
        pos: 'noun',
        translation: '등록 테이블',
        definition: 'the desk where visitors write their names when they arrive',
        pronunciation: '/ˈsaɪn ɪn ˌteɪbəl/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice clear /l/ sounds in welcome language.",
      instructionKr: '환영 표현의 분명한 /l/ 발음을 연습합시다.',
      left: {
        symbol: '/l/',
        words: [
          { en: 'let', kr: '하게 하다' },
          { en: 'help', kr: '도움' },
          { en: 'welcome', kr: '맞이하다' },
          { en: 'table', kr: '테이블' },
          { en: 'call', kr: '전화하다' },
        ],
      },
      right: {
        symbol: 'Contrast',
        words: [
          { en: 'guest', kr: '손님' },
          { en: 'door', kr: '문' },
          { en: 'great', kr: '좋은' },
          { en: 'task', kr: '업무' },
          { en: 'room', kr: '방' },
        ],
      },
    },
    fillRows: [
      { answer: 'Let me help with', suffix: ' the guests.' },
      { answer: 'I can welcome', suffix: ' them at the door.' },
      { answer: 'Could you handle', suffix: ' the sign-in table?' },
      { answer: 'That would be', suffix: ' great.' },
    ],
    patternDrills: [
      {
        label: 'Offering help',
        labelKr: '도움 제안하기',
        template: 'Let me help with ___.',
        examples: [
          { en: 'Let me help with the visitor list.', kr: '방문자 명단은 제가 도와드릴게요.' },
          { en: 'Let me help with the drinks.', kr: '음료는 제가 도와드릴게요.' },
        ],
      },
      {
        label: 'Taking a task',
        labelKr: '업무 맡기',
        template: 'I can ___ at the ___.',
        examples: [
          { en: 'I can wait at the front desk.', kr: '제가 프런트 데스크에서 기다릴 수 있습니다.' },
          { en: 'I can welcome them at the elevator.', kr: '제가 엘리베이터 앞에서 맞이할 수 있습니다.' },
        ],
      },
      {
        label: 'Asking another person',
        labelKr: '다른 사람에게 부탁하기',
        template: 'Could you handle ___?',
        examples: [
          { en: 'Could you handle the guest badges?', kr: '방문자 배지를 맡아주실 수 있나요?' },
          { en: 'Could you handle the coffee station?', kr: '커피 코너를 맡아주실 수 있나요?' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Let me help with the guests.',
        'I can welcome them at the door.',
        'Could you handle the sign-in table?',
        'That would be great.',
        'We need to be ready in five minutes.',
        'The visitors are from a new client company.',
      ],
      completeLines: [
        'Let me help with _______________.',
        'I can welcome them at _______________.',
        'Could you handle _______________?',
        'That would be _______________.',
        'We need to be ready in _______________.',
        'The visitors are from _______________.',
      ],
      dialogue: [
        { role: 'tutor', en: 'The visitors will arrive soon. We still have a few tasks.', kr: '방문객이 곧 도착합니다. 아직 몇 가지 업무가 남아 있습니다.' },
        { role: 'student', en: 'Let me help with the guests. I can welcome them at the door.', kr: '손님 응대는 제가 도와드릴게요. 제가 문 앞에서 맞이하겠습니다.' },
        { role: 'tutor', en: 'That would be great. Could you also guide them to the meeting room?', kr: '그러면 정말 좋겠습니다. 회의실까지 안내도 해주실 수 있나요?' },
        { role: 'student', en: 'Yes, I can do that.', kr: '네, 그렇게 할 수 있습니다.' },
        { role: 'tutor', en: 'Then could you handle the sign-in table?', kr: '그럼 등록 테이블도 맡아주실 수 있나요?' },
        { role: 'student', en: 'Sure. I can handle that too.', kr: '물론입니다. 그것도 맡을 수 있습니다.' },
      ],
      freePromptItems: [
        'Offer one task',
        'Say where you will stand or wait',
        'Ask the coworker to do one task',
        'Use one positive response',
        'Sound calm and professional',
      ],
    },
    challenge: {
      scenarioEn: 'Your team is about to receive visitors. Offer help, divide two tasks, and confirm who will do what.',
      scenarioKr: '팀이 곧 방문객을 맞이합니다. 도움을 제안하고 두 가지 업무를 나눈 뒤 누가 무엇을 할지 확인하세요.',
      guideQuestions: [
        'Offer one task first.',
        'Take responsibility for one area.',
        'Ask the coworker to handle another task.',
        'Confirm the final task split.',
        'Use one encouraging sentence.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.request },
    },
    discussion: {
      categories: [
        {
          title: 'VISITORS',
          questions: [
            'How should a company welcome visitors well?',
            'What makes visitors feel comfortable?',
            'What first impression is important in business?',
          ],
        },
        {
          title: 'TEAMWORK',
          questions: [
            'When do you usually offer help first?',
            'Is it easy for you to ask others to handle a task?',
            'What kind of teammate is most helpful before an event?',
          ],
        },
        {
          title: 'SERVICE',
          questions: [
            'What small service feels professional to you?',
            'How can a team stay calm under time pressure?',
            'What should be prepared before guests enter a room?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[4],
      nextLessonName: 'Lesson 10: Chapter 4 Personal Review',
    },
  },
  {
    chapter: 4,
    lessonNumber: 10,
    skill: 'review',
    lessonType: 'REVIEW',
    slug: 'chapter-4-personal-review',
    chapterName: 'Making Requests',
    lessonName: 'Chapter 4 Personal Review',
    goalEn: 'Can make, answer, and support workplace requests more confidently.',
    goalKr: '직장에서 요청하고, 응답하고, 도움을 제안하는 일을 더 자신 있게 할 수 있다.',
    situationEn: 'You must manage a short support situation by making requests, offering help, and dividing tasks clearly.',
    situationKr: '짧은 지원 상황에서 요청하고 도움을 제안하며 업무를 분명히 나누어야 합니다.',
    pronunciationShort: 'Review: request, support, and meeting setup language',
    patterns: [
      { en: '<b>Could you bring</b> coffee to the meeting room?', kr: '회의실로 커피를 가져다주실 수 있나요?' },
      { en: '<b>Please prepare</b> 10 paper cups.', kr: '종이컵 10개를 준비해 주세요.' },
      { en: '<b>Can you bring them</b> before the meeting starts?', kr: '회의 시작 전에 그것들을 가져다주실 수 있나요?' },
      { en: '<b>Let me help with</b> the guests.', kr: '손님 응대는 제가 도와드릴게요.' },
    ],
    vocabulary: [
      {
        word: 'refreshment',
        pos: 'noun',
        translation: '다과',
        definition: 'food or drinks served during a meeting or event',
        pronunciation: '/rɪˈfreʃmənt/',
      },
      {
        word: 'support',
        pos: 'noun/verb',
        translation: '지원 / 지원하다',
        definition: 'help given to another person or team',
        pronunciation: '/səˈpɔːrt/',
      },
      {
        word: 'prepare',
        pos: 'verb',
        translation: '준비하다',
        definition: 'to get something ready',
        pronunciation: '/prɪˈper/',
      },
    ],
    pronunciation: {
      instruction: 'Review the most useful request and support sounds from the chapter.',
      instructionKr: '이 장의 핵심 요청 및 지원 표현 발음을 복습합시다.',
      left: {
        symbol: 'Review A',
        words: [
          { en: 'coffee', kr: '커피' },
          { en: 'prepare', kr: '준비하다' },
          { en: 'more', kr: '더 많은' },
          { en: 'help', kr: '도움' },
          { en: 'guest', kr: '손님' },
        ],
      },
      right: {
        symbol: 'Review B',
        words: [
          { en: 'meeting', kr: '회의' },
          { en: 'cups', kr: '컵' },
          { en: 'handle', kr: '맡다' },
          { en: 'welcome', kr: '맞이하다' },
          { en: 'great', kr: '좋은' },
        ],
      },
    },
    fillRows: [
      { answer: 'Could you bring', suffix: ' coffee to the meeting room?' },
      { answer: 'Please prepare', suffix: ' 10 paper cups.' },
      { answer: 'Can you bring them', suffix: ' before the meeting starts?' },
      { answer: 'Let me help with', suffix: ' the guests.' },
    ],
    patternDrills: [
      {
        label: 'Request + item',
        labelKr: '요청 + 물품',
        template: 'Could you bring ___ before ___?',
        examples: [
          { en: 'Could you bring the markers before 2 PM?', kr: '오후 2시 전에 마커를 가져다주실 수 있나요?' },
        ],
      },
      {
        label: 'Preparation',
        labelKr: '준비',
        template: 'Please prepare ___ for ___.',
        examples: [
          { en: 'Please prepare water for the guests.', kr: '손님을 위해 물을 준비해 주세요.' },
        ],
      },
      {
        label: 'Offering help',
        labelKr: '도움 제안',
        template: 'Let me help with ___. I can ___.',
        examples: [
          { en: 'Let me help with the setup. I can arrange the chairs.', kr: '준비는 제가 도와드릴게요. 의자를 정리할 수 있습니다.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Could you bring coffee to the meeting room?',
        'Please prepare 10 paper cups.',
        'Can you bring them before the meeting starts?',
        'Let me help with the guests.',
        'I can welcome them at the door.',
        'That would be great.',
      ],
      completeTitle: 'Step 2 - Review the Support Phrases',
      completeInstructionEn: 'Complete the review lines with the support language you need most.',
      completeInstructionKr: '가장 더 연습이 필요한 지원 표현으로 복습 문장을 완성하세요.',
      completeLines: [
        'Could you bring _______________?',
        'Please prepare _______________.',
        'Can you bring them before _______________?',
        'Let me help with _______________.',
        'I can welcome them at _______________.',
        'That would be _______________.',
      ],
      dialogueTitle: 'Step 3 - Final Support Role-play',
      dialogueInstructionEn: 'Run one full workplace support conversation from request to task division.',
      dialogueInstructionKr: '요청부터 업무 분담까지 하나의 완전한 직장 지원 대화를 진행하세요.',
      dialogue: [
        { role: 'tutor', en: 'The visitors will arrive in ten minutes. Could you bring coffee to the meeting room?', kr: '방문객이 10분 후 도착합니다. 회의실로 커피를 가져다주실 수 있나요?' },
        { role: 'student', en: 'Yes. I can bring coffee and paper cups right away.', kr: '네. 커피와 종이컵을 바로 가져다드릴게요.' },
        { role: 'tutor', en: 'Thanks. We also need two markers before the meeting starts.', kr: '감사합니다. 회의 시작 전에 마커 두 개도 더 필요합니다.' },
        { role: 'student', en: 'No problem. Let me help with the guests too.', kr: '문제없습니다. 손님 응대도 제가 도와드릴게요.' },
        { role: 'tutor', en: 'Great. Could you welcome them at the door?', kr: '좋습니다. 문 앞에서 맞이해 주실 수 있나요?' },
        { role: 'student', en: 'Sure. I can do that.', kr: '물론입니다. 그렇게 하겠습니다.' },
      ],
      freeTitle: 'Step 4 - Final Support Task',
      freeInstructionEn: 'Handle one full support situation using at least 6 connected sentences.',
      freeInstructionKr: '6문장 이상으로 하나의 지원 상황 전체를 처리하세요.',
      freePromptItems: [
        'Ask for one needed item',
        'Add one extra request',
        'Offer help for one task',
        'Divide one responsibility',
        'Close with a helpful sentence',
      ],
    },
    challenge: {
      scenarioEn: 'Final review: handle a short meeting-support situation by making requests, answering them, and offering help.',
      scenarioKr: '최종 복습: 짧은 회의 지원 상황에서 요청하고, 응답하고, 도움을 제안하세요.',
      guideQuestions: [
        'Make one clear request.',
        'Respond positively to one request.',
        'Add one more needed item or task.',
        'Offer help with one part of the work.',
        'Keep the tone supportive and polite.',
      ],
      roleplayTable: {
        you: 'Your own name',
        coworkers: ['Jiho Kim', 'Haneul Park', 'Seojun Lee', 'Minji Kim'],
      },
    },
    discussion: {
      categories: [
        {
          title: 'REVIEW',
          questions: [
            'Which Chapter 4 request expression feels easiest now?',
            'Which support phrase do you still want to practice?',
            'What kind of request is hardest for you in English?',
          ],
        },
        {
          title: 'WORK HELP',
          questions: [
            'What kind of support do coworkers need most often?',
            'What is the best way to answer a request quickly?',
            'When should you offer help before being asked?',
          ],
        },
        {
          title: 'NEXT CHAPTER',
          questions: [
            'Do you answer phone calls often at work?',
            'What kind of email do you receive most often?',
            'What is difficult about business phone English?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[5],
      nextLessonName: "Lesson 1: Who's Calling?",
    },
    reviewScope: 'Lessons 1-9',
    isDynamicFallback: true,
  },
  {
    chapter: 5,
    lessonNumber: 6,
    skill: 'listening',
    lessonType: 'LISTENING',
    slug: 'please-hold-and-transfer',
    chapterName: 'Phone & Email',
    lessonName: 'Please Hold and Transfer',
    goalEn: 'Can understand simple hold and transfer language on the phone.',
    goalKr: '전화에서 간단한 대기 및 연결 표현을 이해할 수 있다.',
    situationEn: 'You answer an incoming business call and need to hold, transfer, or take a message.',
    situationKr: '회사로 걸려온 전화를 받고 대기시키거나 연결하거나 메시지를 받아야 합니다.',
    pronunciationShort: '/h/ in phone phrases',
    patterns: [
      { en: '<b>Please hold</b> for a moment.', kr: '잠시만 기다려 주세요.' },
      { en: "<b>I'll transfer</b> your call.", kr: '전화를 연결해 드리겠습니다.' },
      { en: "<b>She's away from</b> her desk right now.", kr: '지금 자리에 안 계십니다.' },
      { en: '<b>Can I take</b> a message?', kr: '메시지를 받아드릴까요?' },
    ],
    vocabulary: [
      {
        word: 'transfer',
        pos: 'verb',
        translation: '연결하다',
        definition: 'to connect a phone call to another person or department',
        pronunciation: '/trænsˈfɜːr/',
      },
      {
        word: 'extension',
        pos: 'noun',
        translation: '내선 번호',
        definition: 'a phone number inside a company system',
        pronunciation: '/ɪkˈstenʃən/',
      },
      {
        word: 'desk',
        pos: 'noun',
        translation: '자리, 책상',
        definition: 'the place where someone usually works in the office',
        pronunciation: '/desk/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /h/ in common phone expressions.",
      instructionKr: '전화 표현에서 자주 나오는 /h/ 발음을 연습합시다.',
      left: {
        symbol: '/h/',
        words: [
          { en: 'hold', kr: '기다리다' },
          { en: 'hello', kr: '안녕하세요' },
          { en: 'help', kr: '도움' },
          { en: 'him', kr: '그를' },
          { en: 'her', kr: '그녀를' },
        ],
      },
      right: {
        symbol: 'Contrast',
        words: [
          { en: 'call', kr: '전화' },
          { en: 'desk', kr: '자리' },
          { en: 'message', kr: '메시지' },
          { en: 'phone', kr: '전화기' },
          { en: 'line', kr: '회선' },
        ],
      },
    },
    fillRows: [
      { answer: 'Please hold', suffix: ' for a moment.' },
      { answer: "I'll transfer", suffix: ' your call.' },
      { answer: "She's away from", suffix: ' her desk right now.' },
      { answer: 'Can I take', suffix: ' a message?' },
    ],
    patternDrills: [
      {
        label: 'Holding language',
        labelKr: '대기 표현',
        template: 'Please hold for ___.',
        examples: [
          { en: 'Please hold for one minute.', kr: '1분만 기다려 주세요.' },
          { en: 'Please hold for a short moment.', kr: '잠시만 기다려 주세요.' },
        ],
      },
      {
        label: 'Transferring calls',
        labelKr: '전화 연결',
        template: "I'll transfer your call to ___.",
        examples: [
          { en: "I'll transfer your call to the sales team.", kr: '전화를 영업팀으로 연결해 드리겠습니다.' },
          { en: "I'll transfer your call to Minseo.", kr: '전화를 민서 씨에게 연결해 드리겠습니다.' },
        ],
      },
      {
        label: 'Taking messages',
        labelKr: '메시지 받기',
        template: 'Can I take a message for ___?',
        examples: [
          { en: 'Can I take a message for Ms. Kang?', kr: '강 과장님 대신 메시지를 받아드릴까요?' },
          { en: 'Can I take a message for the manager?', kr: '매니저 대신 메시지를 받아드릴까요?' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Please hold for a moment.',
        "I'll transfer your call.",
        "She's away from her desk right now.",
        'Can I take a message?',
        'Please stay on the line.',
        'I will check her extension now.',
      ],
      completeTitle: 'Step 2 - Complete the Call Phrases',
      completeInstructionEn: 'Complete the phone expressions with the missing words.',
      completeInstructionKr: '빠진 단어를 넣어 전화 표현을 완성하세요.',
      completeLines: [
        'Please _______________ for a moment.',
        "I'll _______________ your call.",
        "She's away from her _______________ right now.",
        'Can I take a _______________?',
        'Please stay on the _______________.',
        'I will check her _______________ now.',
      ],
      dialogue: [
        { role: 'tutor', en: 'Hello, may I speak with Ms. Kang in Finance?', kr: '안녕하세요, 재무팀 강 과장님과 통화할 수 있을까요?' },
        { role: 'student', en: 'Certainly. Please hold for a moment.', kr: '네, 알겠습니다. 잠시만 기다려 주세요.' },
        { role: 'tutor', en: 'Thank you.', kr: '감사합니다.' },
        { role: 'student', en: "I'm sorry. She's away from her desk right now.", kr: '죄송합니다. 지금 자리에 안 계십니다.' },
        { role: 'tutor', en: 'I see. Can you transfer me to her teammate?', kr: '그렇군요. 동료에게 연결해 주실 수 있나요?' },
        { role: 'student', en: "Of course. I'll transfer your call now.", kr: '물론입니다. 지금 연결해 드리겠습니다.' },
      ],
      freePromptItems: [
        'Answer one incoming call',
        'Ask the caller to hold',
        'Explain one person is away',
        'Transfer the call or offer a message',
        'Use a polite closing',
      ],
    },
    challenge: {
      scenarioEn: 'You answer a phone call for another coworker. Hold the line, explain the situation, and either transfer the call or take a message.',
      scenarioKr: '다른 동료 앞으로 온 전화를 받습니다. 대기 요청을 하고 상황을 설명한 뒤 전화를 연결하거나 메시지를 받으세요.',
      guideQuestions: [
        'Greet the caller professionally.',
        'Ask the caller to hold.',
        'Explain whether the coworker is available.',
        'Transfer the call or offer to take a message.',
        'Close the call politely.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.phone },
    },
    discussion: {
      categories: [
        {
          title: 'PHONE TASKS',
          questions: [
            'What is difficult about answering business calls?',
            'Do you prefer taking a message or transferring a call?',
            'What phone phrase do you use most often?',
          ],
        },
        {
          title: 'POLITENESS',
          questions: [
            'How do you sound polite on the phone in English?',
            'Is it important to speak slowly on work calls?',
            'What makes a phone call feel professional?',
          ],
        },
        {
          title: 'OFFICE CALLS',
          questions: [
            'Who usually answers calls in your workplace?',
            'What kind of calls are common in your office?',
            'When is it better to move from phone to email?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[5],
      nextLessonName: 'Lesson 7: Phone Message Slip',
    },
  },
  {
    chapter: 5,
    lessonNumber: 7,
    skill: 'reading',
    lessonType: 'READING',
    slug: 'phone-message-slip',
    chapterName: 'Phone & Email',
    lessonName: 'Phone Message Slip',
    goalEn: 'Can read a short phone message slip and understand key details.',
    goalKr: '짧은 전화 메모를 읽고 핵심 내용을 이해할 수 있다.',
    situationEn: 'You return to your desk and read a phone message left by a coworker.',
    situationKr: '자리로 돌아와 동료가 남긴 전화 메모를 읽습니다.',
    pronunciationShort: '/ɔː/ in call and talk words',
    patterns: [
      { en: '<b>Mr. Choi called</b> at 10:20.', kr: '최 씨가 10시 20분에 전화했습니다.' },
      { en: '<b>He left a message</b> for you.', kr: '그가 당신에게 메시지를 남겼습니다.' },
      { en: '<b>Please call him back</b> this afternoon.', kr: '오늘 오후에 다시 전화해 주세요.' },
      { en: '<b>The number is</b> 02-555-0148.', kr: '번호는 02-555-0148입니다.' },
    ],
    vocabulary: [
      {
        word: 'message slip',
        pos: 'noun',
        translation: '전화 메모지',
        definition: 'a short written note that records a phone message',
        pronunciation: '/ˈmesɪdʒ slɪp/',
      },
      {
        word: 'call back',
        pos: 'verb phrase',
        translation: '다시 전화하다',
        definition: 'to return a phone call',
        pronunciation: '/ˈkɔːl bæk/',
      },
      {
        word: 'mobile',
        pos: 'noun',
        translation: '휴대전화',
        definition: 'a cell phone',
        pronunciation: '/ˈmoʊbaɪl/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /ɔː/ in phone message words.",
      instructionKr: '전화 메모 단어의 /ɔː/ 발음을 연습합시다.',
      left: {
        symbol: '/ɔː/',
        words: [
          { en: 'call', kr: '전화하다' },
          { en: 'talk', kr: '이야기하다' },
          { en: 'morning', kr: '아침' },
          { en: 'four', kr: '넷' },
          { en: 'forward', kr: '전달하다' },
        ],
      },
      right: {
        symbol: 'Contrast',
        words: [
          { en: 'desk', kr: '책상' },
          { en: 'left', kr: '남겼다' },
          { en: 'message', kr: '메시지' },
          { en: 'text', kr: '문자' },
          { en: 'check', kr: '확인하다' },
        ],
      },
    },
    fillRows: [
      { answer: 'Mr. Choi called', suffix: ' at 10:20.' },
      { answer: 'He left a message', suffix: ' for you.' },
      { answer: 'Please call him back', suffix: ' this afternoon.' },
      { answer: 'The number is', suffix: ' 02-555-0148.' },
    ],
    patternDrills: [
      {
        label: 'Who called',
        labelKr: '전화한 사람',
        template: '___ called at ___.',
        examples: [
          { en: 'Ms. Park called at 9:40.', kr: '박 씨가 9시 40분에 전화했습니다.' },
          { en: 'The delivery driver called at noon.', kr: '배송 기사님이 정오에 전화했습니다.' },
        ],
      },
      {
        label: 'Message details',
        labelKr: '메시지 내용',
        template: 'He/She left a message for ___.',
        examples: [
          { en: 'She left a message for Minseo.', kr: '민서 씨에게 메시지를 남겼습니다.' },
          { en: 'He left a message for the manager.', kr: '매니저에게 메시지를 남겼습니다.' },
        ],
      },
      {
        label: 'Callback request',
        labelKr: '다시 전화 요청',
        template: 'Please call ___ back ___.',
        examples: [
          { en: 'Please call her back after lunch.', kr: '점심 후에 그녀에게 다시 전화해 주세요.' },
          { en: 'Please call him back before 5 PM.', kr: '오후 5시 전에 그에게 다시 전화해 주세요.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Mr. Choi called at 10:20.',
        'He left a message for you.',
        'Please call him back this afternoon.',
        'The number is 02-555-0148.',
        'He asked about the delivery time.',
        'The note is on your desk.',
      ],
      completeTitle: 'Step 2 - Complete the Message Slip',
      completeInstructionEn: 'Complete the message note with the missing details.',
      completeInstructionKr: '빠진 내용을 넣어 전화 메모를 완성하세요.',
      completeLines: [
        'Mr. Choi called at _______________.',
        'He left a _______________ for you.',
        'Please call him back this _______________.',
        'The number is _______________.',
        'He asked about the _______________ time.',
        'The note is on your _______________.',
      ],
      dialogueTitle: 'Step 3 - Read and Report',
      dialogueInstructionEn: 'Read the message slip and report the key information to your coworker.',
      dialogueInstructionKr: '전화 메모를 읽고 핵심 정보를 동료에게 전달하세요.',
      dialogue: [
        { role: 'tutor', en: 'Did anyone call while I was out?', kr: '제가 없을 때 누가 전화했나요?' },
        { role: 'student', en: 'Yes. Mr. Choi called at 10:20.', kr: '네. 최 씨가 10시 20분에 전화했습니다.' },
        { role: 'tutor', en: 'Did he leave a message?', kr: '메시지를 남겼나요?' },
        { role: 'student', en: 'Yes. He left a message for you.', kr: '네. 당신에게 메시지를 남겼습니다.' },
        { role: 'tutor', en: 'What should I do?', kr: '제가 무엇을 해야 하나요?' },
        { role: 'student', en: 'Please call him back this afternoon. The number is 02-555-0148.', kr: '오늘 오후에 다시 전화해 주세요. 번호는 02-555-0148입니다.' },
      ],
      freePromptItems: [
        'Say who called',
        'Say when they called',
        'Report the message',
        'Give the callback number',
        'Add one detail about the reason for the call',
      ],
    },
    challenge: {
      scenarioEn: 'Read a phone message slip and explain the important details to the person who missed the call.',
      scenarioKr: '전화 메모를 읽고 부재중 전화를 놓친 사람에게 중요한 내용을 설명하세요.',
      guideQuestions: [
        'Say who called.',
        'Say when the call came in.',
        'Explain the message briefly.',
        'Give the phone number clearly.',
        'Mention when the callback should happen.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.phone },
    },
    discussion: {
      categories: [
        {
          title: 'MESSAGES',
          questions: [
            'What information should be on every phone message slip?',
            'Do you prefer written phone notes or instant messages?',
            'What makes a message clear and useful?',
          ],
        },
        {
          title: 'CALLBACKS',
          questions: [
            'How quickly should people return business calls?',
            'What do you say when you call back someone?',
            'Is time or purpose more important in a phone note?',
          ],
        },
        {
          title: 'WORK HABITS',
          questions: [
            'Do you often miss calls at work?',
            'How do coworkers usually leave messages in your office?',
            'What is your best way to organize small notes?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[5],
      nextLessonName: "Lesson 8: I'm Calling About the Delivery",
    },
  },
  {
    chapter: 5,
    lessonNumber: 8,
    skill: 'speaking',
    lessonType: 'SPEAKING',
    slug: 'im-calling-about-the-delivery',
    chapterName: 'Phone & Email',
    lessonName: "I'm Calling About the Delivery",
    goalEn: 'Can make a simple business phone inquiry and confirm delivery details.',
    goalKr: '간단한 업무 전화를 걸어 배송 정보를 확인할 수 있다.',
    situationEn: 'A delivery is late, so you call to check the arrival time and current status.',
    situationKr: '배송이 늦어져 도착 시간과 현재 상태를 확인하려고 전화합니다.',
    pronunciationShort: '/d/ in delivery and detail words',
    patterns: [
      { en: "<b>I'm calling about</b> the delivery.", kr: '배송 건으로 전화드렸습니다.' },
      { en: '<b>Could you confirm</b> the arrival time?', kr: '도착 시간을 확인해 주실 수 있나요?' },
      { en: '<b>There seems to be</b> a delay.', kr: '지연이 있는 것 같습니다.' },
      { en: "<b>I'll send</b> the details by email.", kr: '상세 내용은 이메일로 보내드리겠습니다.' },
    ],
    vocabulary: [
      {
        word: 'delivery',
        pos: 'noun',
        translation: '배송',
        definition: 'the act of bringing goods to a place',
        pronunciation: '/dɪˈlɪvəri/',
      },
      {
        word: 'delay',
        pos: 'noun',
        translation: '지연',
        definition: 'something happening later than planned',
        pronunciation: '/dɪˈleɪ/',
      },
      {
        word: 'arrival time',
        pos: 'noun phrase',
        translation: '도착 시간',
        definition: 'the expected time when something arrives',
        pronunciation: '/əˈraɪvəl taɪm/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice the /d/ sound in delivery language.",
      instructionKr: '배송 관련 표현의 /d/ 발음을 연습합시다.',
      left: {
        symbol: '/d/',
        words: [
          { en: 'delivery', kr: '배송' },
          { en: 'delay', kr: '지연' },
          { en: 'details', kr: '상세 정보' },
          { en: 'desk', kr: '책상' },
          { en: 'driver', kr: '기사' },
        ],
      },
      right: {
        symbol: 'Contrast',
        words: [
          { en: 'time', kr: '시간' },
          { en: 'call', kr: '전화' },
          { en: 'late', kr: '늦은' },
          { en: 'ship', kr: '보내다' },
          { en: 'line', kr: '회선' },
        ],
      },
    },
    fillRows: [
      { answer: "I'm calling about", suffix: ' the delivery.' },
      { answer: 'Could you confirm', suffix: ' the arrival time?' },
      { answer: 'There seems to be', suffix: ' a delay.' },
      { answer: "I'll send", suffix: ' the details by email.' },
    ],
    patternDrills: [
      {
        label: 'Phone reason',
        labelKr: '전화 이유',
        template: "I'm calling about ___.",
        examples: [
          { en: "I'm calling about tomorrow's shipment.", kr: '내일 배송 건으로 전화드렸습니다.' },
          { en: "I'm calling about the office supplies order.", kr: '사무용품 주문 건으로 전화드렸습니다.' },
        ],
      },
      {
        label: 'Checking details',
        labelKr: '상세 확인',
        template: 'Could you confirm ___?',
        examples: [
          { en: 'Could you confirm the driver name?', kr: '기사님 성함을 확인해 주실 수 있나요?' },
          { en: 'Could you confirm the new time?', kr: '새 시간을 확인해 주실 수 있나요?' },
        ],
      },
      {
        label: 'Delay explanation',
        labelKr: '지연 설명',
        template: 'There seems to be a delay with ___.',
        examples: [
          { en: 'There seems to be a delay with the documents.', kr: '서류에 지연이 있는 것 같습니다.' },
          { en: 'There seems to be a delay with the package.', kr: '소포에 지연이 있는 것 같습니다.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        "I'm calling about the delivery.",
        'Could you confirm the arrival time?',
        'There seems to be a delay.',
        "I'll send the details by email.",
        'The package was supposed to arrive this morning.',
        'We need the boxes before 3 PM.',
      ],
      completeLines: [
        "I'm calling about the _______________.",
        'Could you confirm the _______________ time?',
        'There seems to be a _______________.',
        "I'll send the _______________ by email.",
        'The package was supposed to arrive _______________.',
        'We need the boxes before _______________.',
      ],
      dialogue: [
        { role: 'tutor', en: 'Good afternoon. How can I help you?', kr: '안녕하세요. 무엇을 도와드릴까요?' },
        { role: 'student', en: "Hi. I'm calling about the delivery for our office.", kr: '안녕하세요. 저희 사무실 배송 건으로 전화드렸습니다.' },
        { role: 'tutor', en: 'Of course. What would you like to check?', kr: '네. 무엇을 확인하고 싶으신가요?' },
        { role: 'student', en: 'Could you confirm the arrival time? There seems to be a delay.', kr: '도착 시간을 확인해 주실 수 있나요? 지연이 있는 것 같습니다.' },
        { role: 'tutor', en: 'I see. The driver will arrive at 2:30 PM.', kr: '알겠습니다. 기사님이 오후 2시 30분에 도착할 예정입니다.' },
        { role: 'student', en: "Thank you. I'll send the details by email to my manager.", kr: '감사합니다. 상세 내용은 매니저에게 이메일로 보내겠습니다.' },
      ],
      freePromptItems: [
        'State why you are calling',
        'Ask for the arrival time',
        'Mention a delay or problem',
        'Repeat the confirmed time',
        'Mention one email follow-up action',
      ],
    },
    challenge: {
      scenarioEn: 'You need to call a delivery company, confirm the updated arrival time, and explain that you will follow up by email.',
      scenarioKr: '배송 회사에 전화해 변경된 도착 시간을 확인하고 이메일로 후속 조치하겠다고 설명해야 합니다.',
      guideQuestions: [
        'Say why you are calling.',
        'Ask one clear delivery question.',
        'Mention the delay.',
        'Confirm the answer you hear.',
        'End with one email follow-up sentence.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.phone },
    },
    discussion: {
      categories: [
        {
          title: 'DELIVERIES',
          questions: [
            'What deliveries are common in your workplace?',
            'What problems happen with deliveries?',
            'How important is accurate arrival time information?',
          ],
        },
        {
          title: 'PHONE CHECKS',
          questions: [
            'When is a phone call better than an email?',
            'What should you confirm on a business call?',
            'How do you repeat details to avoid mistakes?',
          ],
        },
        {
          title: 'FOLLOW-UP',
          questions: [
            'Why is a follow-up email useful after a call?',
            'What details should be included in a follow-up message?',
            'How fast should follow-up happen?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[5],
      nextLessonName: "Lesson 9: I'll Send the Follow-Up",
    },
  },
  {
    chapter: 5,
    lessonNumber: 9,
    skill: 'speaking',
    lessonType: 'SPEAKING',
    slug: 'ill-send-the-follow-up',
    chapterName: 'Phone & Email',
    lessonName: "I'll Send the Follow-Up",
    goalEn: 'Can summarize a phone call and mention a simple follow-up email action.',
    goalKr: '전화 내용을 요약하고 간단한 후속 이메일 조치를 말할 수 있다.',
    situationEn: 'After a phone call, you tell a coworker what happened and explain the email you will send.',
    situationKr: '전화 후 동료에게 무슨 일이 있었는지 말하고 보낼 이메일 내용을 설명합니다.',
    pronunciationShort: '/f/ in follow-up language',
    patterns: [
      { en: "<b>I'll send</b> a follow-up email.", kr: '후속 이메일을 보내겠습니다.' },
      { en: '<b>I spoke with</b> the delivery team.', kr: '배송팀과 통화했습니다.' },
      { en: '<b>They said</b> the boxes will arrive at 2:30.', kr: '그들은 상자가 2시 30분에 도착할 거라고 했습니다.' },
      { en: '<b>Please check</b> the email later.', kr: '나중에 이메일을 확인해 주세요.' },
    ],
    vocabulary: [
      {
        word: 'follow-up',
        pos: 'noun/adjective',
        translation: '후속 조치',
        definition: 'something done after the first contact or action',
        pronunciation: '/ˈfɑːloʊ ʌp/',
      },
      {
        word: 'summary',
        pos: 'noun',
        translation: '요약',
        definition: 'a short explanation of the main points',
        pronunciation: '/ˈsʌməri/',
      },
      {
        word: 'confirm again',
        pos: 'phrase',
        translation: '다시 확인하다',
        definition: 'to check the same information one more time',
        pronunciation: '/kənˈfɜːrm əˈɡen/',
      },
    ],
    pronunciation: {
      instruction: "Let's practice /f/ in follow-up expressions.",
      instructionKr: '후속 표현의 /f/ 발음을 연습합시다.',
      left: {
        symbol: '/f/',
        words: [
          { en: 'follow-up', kr: '후속 조치' },
          { en: 'phone', kr: '전화' },
          { en: 'forward', kr: '전달하다' },
          { en: 'file', kr: '파일' },
          { en: 'confirm', kr: '확인하다' },
        ],
      },
      right: {
        symbol: 'Contrast',
        words: [
          { en: 'email', kr: '이메일' },
          { en: 'later', kr: '나중에' },
          { en: 'spoke', kr: '말했다' },
          { en: 'said', kr: '말했다' },
          { en: 'boxes', kr: '상자들' },
        ],
      },
    },
    fillRows: [
      { answer: "I'll send", suffix: ' a follow-up email.' },
      { answer: 'I spoke with', suffix: ' the delivery team.' },
      { answer: 'They said', suffix: ' the boxes will arrive at 2:30.' },
      { answer: 'Please check', suffix: ' the email later.' },
    ],
    patternDrills: [
      {
        label: 'Follow-up action',
        labelKr: '후속 조치',
        template: "I'll send a follow-up email about ___.",
        examples: [
          { en: "I'll send a follow-up email about the new schedule.", kr: '새 일정에 대한 후속 이메일을 보내겠습니다.' },
          { en: "I'll send a follow-up email about the meeting room.", kr: '회의실에 대한 후속 이메일을 보내겠습니다.' },
        ],
      },
      {
        label: 'Reporting the call',
        labelKr: '통화 내용 보고',
        template: 'I spoke with ___ about ___.',
        examples: [
          { en: 'I spoke with the supplier about the order.', kr: '주문 건으로 공급업체와 통화했습니다.' },
          { en: 'I spoke with Minseo about the client call.', kr: '고객 전화 건으로 민서 씨와 통화했습니다.' },
        ],
      },
      {
        label: 'Reporting the answer',
        labelKr: '답변 전달',
        template: 'They said ___.',
        examples: [
          { en: 'They said the driver is on the way.', kr: '기사님이 오는 중이라고 했습니다.' },
          { en: 'They said the documents will arrive tomorrow.', kr: '서류가 내일 도착한다고 했습니다.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        "I'll send a follow-up email.",
        'I spoke with the delivery team.',
        'They said the boxes will arrive at 2:30.',
        'Please check the email later.',
        'I will include the updated details.',
        'I can confirm the time again if needed.',
      ],
      completeLines: [
        "I'll send a follow-up _______________.",
        'I spoke with the _______________ team.',
        'They said the boxes will arrive at _______________.',
        'Please check the _______________ later.',
        'I will include the updated _______________.',
        'I can confirm the time again if _______________.',
      ],
      dialogue: [
        { role: 'tutor', en: 'Did you talk to the delivery company?', kr: '배송 회사와 통화하셨나요?' },
        { role: 'student', en: 'Yes. I spoke with the delivery team.', kr: '네. 배송팀과 통화했습니다.' },
        { role: 'tutor', en: 'What did they say?', kr: '그들이 뭐라고 했나요?' },
        { role: 'student', en: 'They said the boxes will arrive at 2:30.', kr: '상자가 2시 30분에 도착할 거라고 했습니다.' },
        { role: 'tutor', en: 'Can you share that with the team?', kr: '그 내용을 팀에 공유해 주실 수 있나요?' },
        { role: 'student', en: "Of course. I'll send a follow-up email. Please check the email later.", kr: '물론입니다. 후속 이메일을 보내겠습니다. 나중에 이메일을 확인해 주세요.' },
      ],
      freePromptItems: [
        'Report who you spoke with',
        'Report the main answer',
        'Mention one confirmed detail',
        'Say you will send a follow-up email',
        'Ask the other person to check it later',
      ],
    },
    challenge: {
      scenarioEn: 'After a business phone call, explain the result to a coworker and tell them what follow-up email you will send.',
      scenarioKr: '업무 전화 후 동료에게 결과를 설명하고 어떤 후속 이메일을 보낼지 말하세요.',
      guideQuestions: [
        'State who you spoke with.',
        'Report the main information clearly.',
        'Mention one time or number.',
        'Say you will send an email.',
        'Ask the coworker to check it later.',
      ],
      roleplayTable: { you: 'Your own name', coworkers: KOREAN_NAMES.phone },
    },
    discussion: {
      categories: [
        {
          title: 'FOLLOW-UP',
          questions: [
            'Why is follow-up important after a phone call?',
            'What details should be included in a follow-up email?',
            'How short or long should a follow-up message be?',
          ],
        },
        {
          title: 'REPORTING',
          questions: [
            'How do you summarize information for coworkers?',
            'Is it better to give the result first or the reason first?',
            'What makes a spoken summary easy to understand?',
          ],
        },
        {
          title: 'COMMUNICATION',
          questions: [
            'Do you prefer phone calls or email for work updates?',
            'When should teams use both phone and email?',
            'What communication habit helps avoid mistakes?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: CHAPTER_LABELS[5],
      nextLessonName: 'Lesson 10: Chapter 5 Personal Review',
    },
  },
  {
    chapter: 5,
    lessonNumber: 10,
    skill: 'review',
    lessonType: 'REVIEW',
    slug: 'chapter-5-personal-review',
    chapterName: 'Phone & Email',
    lessonName: 'Chapter 5 Personal Review',
    goalEn: 'Can manage basic phone calls and follow-up messages more confidently.',
    goalKr: '기본적인 전화 업무와 후속 메시지를 더 자신 있게 처리할 수 있다.',
    situationEn: 'You must handle an incoming call, pass on a short message, and explain a follow-up email action.',
    situationKr: '걸려온 전화를 처리하고 짧은 메시지를 전달하며 후속 이메일 조치를 설명해야 합니다.',
    pronunciationShort: 'Review: phone, message, and follow-up language',
    patterns: [
      { en: '<b>Please hold</b> for a moment.', kr: '잠시만 기다려 주세요.' },
      { en: '<b>Can I take</b> a message?', kr: '메시지를 받아드릴까요?' },
      { en: "<b>I'm calling about</b> the delivery.", kr: '배송 건으로 전화드렸습니다.' },
      { en: "<b>I'll send</b> a follow-up email.", kr: '후속 이메일을 보내겠습니다.' },
    ],
    vocabulary: [
      {
        word: 'caller',
        pos: 'noun',
        translation: '전화한 사람',
        definition: 'the person who makes a phone call',
        pronunciation: '/ˈkɔːlər/',
      },
      {
        word: 'callback',
        pos: 'noun',
        translation: '답전화',
        definition: 'a return phone call',
        pronunciation: '/ˈkɔːlˌbæk/',
      },
      {
        word: 'follow-up email',
        pos: 'noun',
        translation: '후속 이메일',
        definition: 'an email sent after a phone call or meeting',
        pronunciation: '/ˈfɑːloʊ ʌp ˈiːmeɪl/',
      },
    ],
    pronunciation: {
      instruction: 'Review the key sounds from phone and email communication.',
      instructionKr: '전화와 이메일 커뮤니케이션의 핵심 발음을 복습합시다.',
      left: {
        symbol: 'Review A',
        words: [
          { en: 'hold', kr: '기다리다' },
          { en: 'message', kr: '메시지' },
          { en: 'delivery', kr: '배송' },
          { en: 'follow-up', kr: '후속 조치' },
          { en: 'email', kr: '이메일' },
        ],
      },
      right: {
        symbol: 'Review B',
        words: [
          { en: 'call', kr: '전화' },
          { en: 'desk', kr: '자리' },
          { en: 'details', kr: '상세 정보' },
          { en: 'later', kr: '나중에' },
          { en: 'number', kr: '번호' },
        ],
      },
    },
    fillRows: [
      { answer: 'Please hold', suffix: ' for a moment.' },
      { answer: 'Can I take', suffix: ' a message?' },
      { answer: "I'm calling about", suffix: ' the delivery.' },
      { answer: "I'll send", suffix: ' a follow-up email.' },
    ],
    patternDrills: [
      {
        label: 'Call handling',
        labelKr: '전화 처리',
        template: 'Please hold ___. Can I take ___?',
        examples: [
          { en: 'Please hold for one minute. Can I take a message?', kr: '1분만 기다려 주세요. 메시지를 받아드릴까요?' },
        ],
      },
      {
        label: 'Reason for call',
        labelKr: '전화 이유',
        template: "I'm calling about ___.",
        examples: [
          { en: "I'm calling about the office delivery.", kr: '사무실 배송 건으로 전화드렸습니다.' },
        ],
      },
      {
        label: 'Follow-up',
        labelKr: '후속 조치',
        template: "I'll send a follow-up email about ___.",
        examples: [
          { en: "I'll send a follow-up email about the new arrival time.", kr: '새 도착 시간에 대한 후속 이메일을 보내겠습니다.' },
        ],
      },
    ],
    practice: {
      repeatLines: [
        'Please hold for a moment.',
        'Can I take a message?',
        "I'm calling about the delivery.",
        "I'll send a follow-up email.",
        'The number is on the message slip.',
        'Please check the email later.',
      ],
      completeTitle: 'Step 2 - Review the Communication Phrases',
      completeInstructionEn: 'Complete the review phrases with the language you need most.',
      completeInstructionKr: '가장 더 연습이 필요한 표현으로 복습 문장을 완성하세요.',
      completeLines: [
        'Please hold for _______________.',
        'Can I take a _______________?',
        "I'm calling about the _______________.",
        "I'll send a follow-up _______________.",
        'The number is on the _______________.',
        'Please check the email _______________.',
      ],
      dialogueTitle: 'Step 3 - Final Phone and Email Role-play',
      dialogueInstructionEn: 'Handle one full communication flow from phone call to follow-up message.',
      dialogueInstructionKr: '전화부터 후속 메시지까지 하나의 완전한 커뮤니케이션 흐름을 처리하세요.',
      dialogue: [
        { role: 'tutor', en: 'Hello. May I speak with Minseo Kang?', kr: '안녕하세요. 강민서 씨와 통화할 수 있을까요?' },
        { role: 'student', en: 'Certainly. Please hold for a moment.', kr: '네. 잠시만 기다려 주세요.' },
        { role: 'tutor', en: 'Thank you.', kr: '감사합니다.' },
        { role: 'student', en: "I'm sorry. She's away from her desk. Can I take a message?", kr: '죄송합니다. 지금 자리에 안 계십니다. 메시지를 받아드릴까요?' },
        { role: 'tutor', en: "Yes. I'm calling about the delivery. Please ask her to call me back.", kr: '네. 배송 건으로 전화드렸습니다. 다시 전화해 달라고 전해 주세요.' },
        { role: 'student', en: "Of course. I'll send a follow-up email and share the message.", kr: '물론입니다. 후속 이메일을 보내고 메시지를 전달하겠습니다.' },
      ],
      freeTitle: 'Step 4 - Final Communication Task',
      freeInstructionEn: 'Handle one full business communication situation using at least 6 connected sentences.',
      freeInstructionKr: '6문장 이상으로 하나의 업무 커뮤니케이션 상황 전체를 처리하세요.',
      freePromptItems: [
        'Answer one call professionally',
        'Use one hold or message phrase',
        'Mention the reason for the call',
        'Report one key detail',
        'Say what follow-up email you will send',
      ],
    },
    challenge: {
      scenarioEn: 'Final review: handle an incoming call, record the main message, and explain the follow-up email you will send.',
      scenarioKr: '최종 복습: 걸려온 전화를 처리하고 핵심 메시지를 기록한 뒤 보낼 후속 이메일을 설명하세요.',
      guideQuestions: [
        'Start the call professionally.',
        'Use one hold or transfer phrase.',
        'Take or report the main message.',
        'Mention one important detail or number.',
        'Explain the follow-up email action.',
      ],
      roleplayTable: {
        you: 'Your own name',
        coworkers: ['Jiyoon Choi', 'Minseo Kang', 'Taeyang Yoo', 'Sujin Lee'],
      },
    },
    discussion: {
      categories: [
        {
          title: 'REVIEW',
          questions: [
            'Which Chapter 5 phrase feels easiest now?',
            'Which phone or email expression still needs practice?',
            'What part of business communication is hardest for you?',
          ],
        },
        {
          title: 'WORK COMMUNICATION',
          questions: [
            'Do you use phone calls or email more often at work?',
            'What information should always be confirmed twice?',
            'What makes communication smooth inside a company?',
          ],
        },
        {
          title: 'NEXT STEP',
          questions: [
            'What skill do you want to improve in the next level?',
            'Do you want more speaking, reading, or listening practice?',
            'What business situation do you want to handle better in English?',
          ],
        },
      ],
    },
    feedback: {
      nextLessonLabel: 'LEVEL 3 COMPLETE',
      nextLessonName: 'Prepare for Level 4',
    },
    reviewScope: 'Lessons 1-9',
    isDynamicFallback: true,
  },
];

async function main() {
  await loadEnvFile();

  await mkdir(SOURCE_DIR, { recursive: true });

  await initDriver(
    process.env.MEMGRAPH_URI || 'bolt://localhost:7687',
    process.env.MEMGRAPH_USER || 'fluentxverse',
    process.env.MEMGRAPH_PASSWORD || 'devpassword123!ChangeMe'
  );

  const session = getDriver().session();
  const created: string[] = [];
  const updated: string[] = [];

  try {
    await updateLessonFiveHandoffs(session);

    for (const spec of lessonSpecs) {
      const sourceJson = buildLessonPayload(spec);
      const sourcePath = path.join(
        SOURCE_DIR,
        `ch0${spec.chapter}-L${spec.lessonNumber}-${spec.slug}.json`
      );
      await Bun.write(sourcePath, `${JSON.stringify(sourceJson, null, 2)}\n`);

      const result = await upsertLesson(session, spec, sourceJson);
      const label = `C${spec.chapter}-L${spec.lessonNumber} ${spec.lessonName}`;
      if (result.action === 'created') {
        created.push(label);
      } else {
        updated.push(label);
      }
    }

    await updateSyllabus(lessonSpecs);

    console.log(`Created lessons: ${created.length}`);
    for (const item of created) console.log(`  + ${item}`);
    console.log(`Updated lessons: ${updated.length}`);
    for (const item of updated) console.log(`  ~ ${item}`);
    console.log('Business English Level 3 extension generation complete.');
  } finally {
    await session.close();
    await closeDriver();
  }
}

main().catch((error) => {
  console.error('Failed to generate Business English Level 3 extension lessons.');
  console.error(error);
  process.exit(1);
});
