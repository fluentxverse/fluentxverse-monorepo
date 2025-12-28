import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { lessonApi, type Lesson, type MergeRequest, type LessonVersion, type MergeRequestComment, type LessonMaterial } from '../api/lesson.api';
import { DiffViewer } from '../Components/DiffViewer/DiffViewer';
import { useLessonSocket, type ActiveEditor } from '../hooks/useLessonSocket';
import { AnalyticsDashboard } from '../Components/AnalyticsDashboard/AnalyticsDashboard';
import { toast, toastConfirm } from '../Components/Toast/Toast';
import { useExport, type LessonExportData } from '../utils/export';
import './LessonMaterialMakerPage.css';

type HeaderConfig = {
  backgroundImage: string;
  overlayColor: string;
  levelBadge: string;
  chapterLabel: string;
  lessonLabel: string;
  goalText: string;
  goalSubtext: string;
};

type VocabularyItem = {
  id: string;
  word: string;
  reading: string;
  english: string;
};

type GrammarPoint = {
  id: string;
  structure: string;
  meaning: string;
  example: string;
  translation: string;
};

type ExerciseItem = {
  id: string;
  type: 'fill-blank' | 'multiple-choice' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string;
};

type LessonGoalStep = {
  id: string;
  instruction: string;
  scriptLines?: string[]; // Multiple green italic script lines
  scriptLine?: string; // Single green italic text (legacy support)
  tipText?: string; // Orange tip text
};

type VocabCard = {
  id: string;
  image: string;
  wordEn: string;
  wordJp: string;
};

type ImageCard = {
  id: string;
  image: string;
  label: string;
};

type PronunciationWord = {
  id: string;
  wordEn: string;
  wordJp: string;
};

type PronunciationColumn = {
  id: string;
  soundLabel: string; // e.g., "/w/" or "/p/"
  image: string; // mouth position image
  words: PronunciationWord[];
};

type GrammarExample = {
  id: string;
  sentenceEn: string; // e.g., "Who's that girl?"
  sentenceJp: string; // e.g., "あの少女は誰ですか？"
  boldWords?: string[]; // words to bold in the sentence
};

type GrammarRule = {
  id: string;
  ruleEn: string; // e.g., "Use who to ask about people."
  ruleJp: string;
  examples: GrammarExample[];
};

type DialogueLine = {
  id: string;
  speaker: string; // e.g., "Masa" or "Saori"
  lineEn: string; // The dialogue line in English
  isItalic?: boolean; // For stage directions like (laughs)
};

type TriviaExample = {
  id: string;
  speakerA: string; // e.g., "A:" or "A"
  lineA: string; // First line
  speakerB: string; // e.g., "B:" or "X B:" or "O B:"
  lineB: string; // Response line
  isCorrect: boolean; // true = O (correct), false = X (wrong)
  lineAJp?: string; // Japanese translation
  lineBJp?: string; // Japanese translation
};

type PracticeItem = {
  id: string;
  question: string; // e.g., "(when / they / do) eat out?"
  answer: string; // e.g., "When do they"
};

type ConversationLine = {
  id: string;
  speaker: 'Student' | 'Tutor'; // Who is speaking
  text: string; // The dialogue text with _____ for blanks
};

type ChallengeQuestion = {
  id: string;
  question: string; // The main question
  subQuestions?: string[]; // Sub-questions with italic styling
};

// Listening template types
type ListeningQuestion = {
  id: string;
  questionEn: string;
  questionJp: string;
  answerCorrect: string;
  answerWrong: string;
};

type ListeningScriptWord = {
  id: string;
  word: string;
  isUnderlined: boolean;
};

type ListeningScriptLine = {
  id: string;
  text: string;
  hasUnderline?: boolean; // Words to emphasize
};

type RoleplayConversationLine = {
  id: string;
  number: number;
  text: string;
  comment?: string; // Green italic comment
  isHeader?: boolean; // For headers like "(Pretend you're answering the phone.)"
  isFooter?: boolean; // For footers like "(Say that you have to go...)"
};

type TopicBox = {
  id: string;
  topicNumber: number;
  topicTitle: string;
  questions: ChallengeQuestion[];
};

type FeedbackGuideRow = {
  id: string;
  category: string; // RANGE, ACCURACY, FLUENCY
  categoryJp: string; // Japanese translation
  categoryDesc: string; // Description of the category
  focusOn: string; // Focus column content
  exampleFeedback: string; // Example feedback content (HTML allowed)
};

// Reading template types
type ReadingDialogueLine = {
  id: string;
  speaker: string; // Character name like "Saori", "Masa"
  lineEn: string; // The dialogue text in English
  underlineWords?: string[]; // Words to be underlined (like "What time", "6 p.m.")
};

type ReadingQuestion = {
  id: string;
  questionEn: string;
  answer: string; // Answer with parentheses like "(It opens at 6 p.m.)"
};

type SectionContent = {
  id: string;
  sectionNumber: number;
  sectionTitle: string;
  // For INTRODUCE type sections
  explanationEn: string;
  explanationJp: string;
  sectionImage: string;
  importantNote: string;
  copyTemplate: string;
  // For PRESENT/vocabulary type sections
  sectionType: 'introduce' | 'vocabulary' | 'question' | 'pronunciation' | 'grammar' | 'dialogue' | 'trivia' | 'practice' | 'produce' | 'challenge' | 'challenge2' | 'feedback' | 'listening' | 'listeningChallenge' | 'reading';
  stepTitle?: string; // e.g., "STEP A VOCABULARY"
  instructionEn?: string; // e.g., "I. Listen and repeat."
  instructionJp?: string; // e.g., "聴いて、リピートしましょう。"
  vocabCards?: VocabCard[];
  imageCards?: ImageCard[]; // For question sections with labeled images
  pronunciationColumns?: PronunciationColumn[]; // For pronunciation practice sections
  grammarRules?: GrammarRule[]; // For grammar tip sections
  dialogueLines?: DialogueLine[]; // For dialogue/conversation sections
  dialogueImage?: string; // Scene illustration for dialogue
  triviaExamples?: TriviaExample[]; // For trivia sections
  triviaImage?: string; // Image for trivia section
  // Practice section fields
  practiceExample?: string; // e.g., "ex. (you / when / do) take ikebana lessons?"
  practiceExampleAnswer?: string; // e.g., "→ When do you take ikebana lessons?"
  practiceItems?: PracticeItem[]; // Numbered exercise questions
  practiceImage?: string; // Image for practice section
  answerItems?: string[]; // Correct answers list for sidebar box
  // Conversation practice fields (Step B style)
  wordBox?: string[]; // Word options like ["who", "what", "when", "where", "how"]
  conversationLines?: ConversationLine[]; // Student/Tutor conversation with blanks
  // Challenge section fields
  challengeTitle?: string; // e.g., "Challenge 1"
  situationEn?: string; // Scenario in English
  situationJp?: string; // Scenario in Japanese
  grammarTipTitle?: string; // e.g., "Today's grammar tip"
  grammarTipItems?: string[]; // Bullet list items
  challengeQuestions?: ChallengeQuestion[]; // Questions for sidebar
  isOptional?: boolean; // "If Time Allows" badge
  topicBoxes?: TopicBox[]; // For Challenge 2 two-column topics
  // Feedback section fields
  feedbackRubric?: { score: number; label: string; description: string }[]; // Lesson Goal Achievement rubric
  feedbackCategories?: { id: string; title: string; titleJp: string; descJp: string }[]; // RANGE, ACCURACY, FLUENCY
  feedbackGuide?: FeedbackGuideRow[]; // Personalized Feedback Guide table
  feedbackTemplate?: string; // Click to Copy template content
  // Listening section fields (UNDERSTAND/LISTENING)
  listeningScript?: ListeningScriptWord[]; // Words in the script with underline toggle
  listeningScriptText?: string; // Full script text for sidebar display
  listeningQuestions?: ListeningQuestion[]; // Questions with answers
  // Listening Challenge section fields
  roleplaySetupLines?: string[]; // Setup instructions for roleplay
  roleplayScript?: string; // The listening/roleplay script
  roleplayTips?: string[]; // Orange diamond tips
  roleplayConversation?: RoleplayConversationLine[]; // Numbered conversation lines
  // Reading section fields (UNDERSTAND/READING)
  readingImage?: string; // Scene illustration for reading
  readingDialogueLines?: ReadingDialogueLine[]; // Text message conversation lines
  readingQuestions?: ReadingQuestion[]; // Questions with answers for sidebar
  // Sidebar content
  sidebarTitle?: string; // e.g., "PRESENT"
  sidebarSubtitle?: string; // e.g., "STEP A I (2 minutes)"
  lessonGoalTitle: string;
  lessonGoalSteps: LessonGoalStep[];
};

type LessonMaterialDraft = {
  version: 2;
  header: HeaderConfig;
  sections: SectionContent[];
  vocabulary: VocabularyItem[];
  grammar: GrammarPoint[];
  exercises: ExerciseItem[];
};

// Template types for the course list
type TemplateInfo = {
  id: string;
  name: string;
  course: string;
  category: string;
  icon: string;
  description: string;
  sections: number;
  lastUpdated: string;
  status: 'draft' | 'finished' | 'published';
};

// Saved lesson type - instances created from templates
type SavedLesson = {
  id: string;
  templateId: string;
  templateName: string;
  level: number;
  chapter: number;
  lessonNumber: number;
  goalName: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'finished' | 'published';
  draft: LessonMaterialDraft;
  // Fork/merge fields from server
  isFork?: boolean;
  forkOf?: string | null;
  parentId?: string | null;
  createdBy?: string;
  createdByName?: string | null;
  currentVersion?: number;
  forkCount?: number;
  hasPendingMergeRequest?: boolean;
  serverLesson?: Lesson; // Full server lesson data if available
};

// Form data for creating a new lesson
type NewLessonFormData = {
  level: number;
  chapter: number;
  lessonNumber: number;
  goalName: string;
};

// Version history types
type VersionChange = {
  id: string;
  type: 'added' | 'removed' | 'modified';
  category: 'section' | 'header' | 'vocabulary' | 'grammar' | 'exercise' | 'image';
  target: string; // e.g., "Section 3", "Header Background", "Vocabulary Item"
  targetId?: string; // ID for scrolling (e.g., section id)
  sectionIndex?: number; // Section index for navigation
  description: string;
  oldValue?: string;
  newValue?: string;
};

type VersionHistoryEntry = {
  id: string;
  lessonId: string;
  version: number;
  snapshot: LessonMaterialDraft;
  timestamp: string;
  changeDescription: string;
  changes?: VersionChange[]; // Detailed list of changes
  autoSave: boolean;
  changedByName?: string;
};

type LessonVersionHistory = {
  lessonId: string;
  versions: VersionHistoryEntry[];
  maxVersions: number;
};

const SAVED_LESSONS_KEY = 'fxv_admin_saved_lessons';
const EDITING_LESSON_KEY = 'fxv_admin_editing_lesson_id';
const VERSION_HISTORY_KEY = 'fxv_admin_version_history';

// Course templates matching the tutor app's material courses
const COURSE_TEMPLATES: TemplateInfo[] = [
  // Conversational Skills - 5 Templates
  {
    id: 'conversational-skills-speaking',
    name: 'Speaking Template',
    course: 'Conversational Skills',
    category: 'Conversation',
    icon: '💬',
    description: 'Everyday conversations and natural speaking patterns.',
    sections: 6,
    lastUpdated: '2024-12-21',
    status: 'published',
  },
  {
    id: 'conversational-skills-listening',
    name: 'Listening Template',
    course: 'Conversational Skills',
    category: 'Conversation',
    icon: '👂',
    description: 'Active listening and comprehension exercises.',
    sections: 5,
    lastUpdated: '2024-12-20',
    status: 'draft',
  },
  {
    id: 'conversational-skills-reading',
    name: 'Reading Template',
    course: 'Conversational Skills',
    category: 'Conversation',
    icon: '📖',
    description: 'Reading comprehension and text analysis.',
    sections: 6,
    lastUpdated: '2024-12-22',
    status: 'draft',
  },
  {
    id: 'conversational-skills-roleplay',
    name: 'Role Play Template',
    course: 'Conversational Skills',
    category: 'Conversation',
    icon: '🎭',
    description: 'Situational role-playing scenarios.',
    sections: 5,
    lastUpdated: '2024-12-18',
    status: 'draft',
  },
  {
    id: 'conversational-skills-debate',
    name: 'Debate Template',
    course: 'Conversational Skills',
    category: 'Conversation',
    icon: '⚖️',
    description: 'Structured debate and argumentation.',
    sections: 5,
    lastUpdated: '2024-12-17',
    status: 'draft',
  },
  // Other courses
  {
    id: 'business-english-meetings',
    name: 'Business Meetings',
    course: 'Business English',
    category: 'Business',
    icon: '💼',
    description: 'Professional meetings and presentations.',
    sections: 6,
    lastUpdated: '2024-12-15',
    status: 'draft',
  },
  {
    id: 'job-interview-prep',
    name: 'Interview Prep',
    course: 'Job Interview',
    category: 'Career',
    icon: '👔',
    description: 'Interview techniques and common questions.',
    sections: 5,
    lastUpdated: '2024-12-10',
    status: 'draft',
  },
  {
    id: 'travel-english-basics',
    name: 'Travel Basics',
    course: 'Travel English',
    category: 'Travel',
    icon: '✈️',
    description: 'Airport, hotel, and tourism vocabulary.',
    sections: 5,
    lastUpdated: '2024-12-08',
    status: 'draft',
  },
  {
    id: 'pronunciation-sounds',
    name: 'Sounds & Phonetics',
    course: 'Pronunciation',
    category: 'Speaking',
    icon: '🎤',
    description: 'Phonetics and accent improvement.',
    sections: 4,
    lastUpdated: '2024-12-05',
    status: 'draft',
  },
  {
    id: 'grammar-tenses',
    name: 'Grammar Tenses',
    course: 'Grammar',
    category: 'Grammar',
    icon: '📝',
    description: 'Tenses and sentence structure.',
    sections: 5,
    lastUpdated: '2024-12-01',
    status: 'draft',
  },
];

const STORAGE_KEY = 'fxv_admin_lesson_material_draft_v2';

// Helper to format time ago
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const createBlankDraft = (): LessonMaterialDraft => ({
  version: 2,
  header: {
    backgroundImage: '',
    overlayColor: '#0369a1cc',
    levelBadge: 'STARTER',
    chapterLabel: 'Chapter 1: All About Me',
    lessonLabel: 'Lesson 1: Greetings',
    goalText: 'I can say basic greetings.',
    goalSubtext: '基本的な挨拶ができるようになる。',
  },
  sections: [
    {
      id: 'section-1',
      sectionNumber: 1,
      sectionTitle: 'WARM-UP',
      sectionType: 'introduce',
      explanationEn: 'A list of services has a lot of important information. It shows how much and how long each service is.',
      explanationJp: 'サービスのリストにはたくさんの重要な情報が載っています。サービスの値段や時間などです。',
      sectionImage: '',
      importantNote: 'Effective feedback is specific to the student\'s actual performance.',
      copyTemplate: 'Copy the easy-to-use template on a NOTEPAD. Use this template to take note of the student\'s performance all throughout the lesson.',
      lessonGoalTitle: 'LESSON GOAL (1 minute)',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce the lesson topic.', scriptLine: '"Today, let\'s talk about services."' },
        { id: 'step-2', instruction: 'Read the lesson goal and ask if it\'s clear.' },
        { id: 'step-3', instruction: 'Read the Introduce explanation.' },
        { id: 'step-4', instruction: 'Ask the question below.' },
        { id: 'step-5', instruction: 'Transition to the next section.', scriptLine: '"Good! Let\'s go to the next part!"' },
      ],
    },
    {
      id: 'section-2',
      sectionNumber: 2,
      sectionTitle: 'LEARN',
      sectionType: 'vocabulary',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP A VOCABULARY',
      instructionEn: 'I. Listen and repeat.',
      instructionJp: '聴いて、リピートしましょう。',
      vocabCards: [
        { id: 'vocab-1', image: '', wordEn: 'relax', wordJp: 'くつろぐ' },
        { id: 'vocab-2', image: '', wordEn: 'exercise', wordJp: '運動をする' },
        { id: 'vocab-3', image: '', wordEn: 'stay at home', wordJp: '家で過ごす' },
        { id: 'vocab-4', image: '', wordEn: 'go out', wordJp: '出かける' },
        { id: 'vocab-5', image: '', wordEn: 'read a book', wordJp: '本を読む' },
        { id: 'vocab-6', image: '', wordEn: 'watch TV', wordJp: 'テレビを見る' },
        { id: 'vocab-7', image: '', wordEn: 'cook', wordJp: '料理をする' },
        { id: 'vocab-8', image: '', wordEn: 'take a nap', wordJp: '昼寝をする' },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A I (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Present.', scriptLine: '"Now, let\'s try Present."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Read the first vocabulary and ask the student to repeat. Correct their pronunciation if necessary.' },
        { id: 'step-4', instruction: 'Repeat Step 3 with the remaining vocabulary.' },
        { id: 'step-5', instruction: 'Transition to the next part.', scriptLine: '"Great! Let\'s go to the next part!"' },
      ],
    },
    {
      id: 'section-3',
      sectionNumber: 2,
      sectionTitle: 'LEARN',
      sectionType: 'question',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP B',
      instructionEn: 'II. Which of the things above do your parents do? Which does your best friend do?',
      instructionJp: '上記のうち、あなたの両親はどれをしますか？あなたの親友はどれをしますか？',
      imageCards: [
        { id: 'img-1', image: '', label: 'your parents' },
        { id: 'img-2', image: '', label: 'your best friend' },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A II (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Part II.', scriptLine: '"Okay, now let\'s do Part II."' },
        { id: 'step-2', instruction: 'Read the instructions and ask if they\'re clear.' },
        { id: 'step-3', instruction: 'Have the student use some of the vocabulary to answer the question.', tipText: 'The student doesn\'t have to use complete sentences. We just want to test their understanding of the vocabulary.' },
        { id: 'step-4', instruction: 'Transition to the next part.', scriptLine: '"Good job! Let\'s go to the next part!"' },
      ],
    },
    {
      id: 'section-4',
      sectionNumber: 2,
      sectionTitle: '',
      sectionType: 'pronunciation',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP C',
      instructionEn: 'III. Practice reading the words.',
      instructionJp: '単語を読む練習をしましょう。',
      pronunciationColumns: [
        {
          id: 'col-1',
          soundLabel: '/w/',
          image: '',
          words: [
            { id: 'w1', wordEn: 'work', wordJp: '仕事' },
            { id: 'w2', wordEn: 'will', wordJp: '意思' },
            { id: 'w3', wordEn: 'we', wordJp: '私たち' },
          ],
        },
        {
          id: 'col-2',
          soundLabel: '/p/',
          image: '',
          words: [
            { id: 'w4', wordEn: 'pork', wordJp: '豚肉' },
            { id: 'w5', wordEn: 'pill', wordJp: '錠剤' },
            { id: 'w6', wordEn: 'pea', wordJp: 'エンドウ豆' },
          ],
        },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A III (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Part III.', scriptLine: '"Okay, now let\'s do Part III."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Introduce the pronunciation point.', scriptLine: '"Today, we\'re going to practice /w/ (the w in work) and /p/ (the p in pork)."' },
        { id: 'step-4', instruction: 'Demonstrate the sound on the left and have the student repeat.' },
        { id: 'step-5', instruction: 'Read the words on the left one by one. Have the student repeat after each one.' },
        { id: 'step-6', instruction: 'Repeat Steps 4-5 with the sound and words on the right.' },
        { id: 'step-7', instruction: 'Read the left-right pairs of words. Have the student repeat after each pair.', scriptLine: '"Now let\'s compare the two sets of words. Repeat after me."' },
        { id: 'step-8', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is the difference between the two sounds clear?"' },
        { id: 'step-9', instruction: 'Transition to the next step.', scriptLine: '"Fantastic! Let\'s go to the next step!"' },
      ],
    },
    {
      id: 'section-5',
      sectionNumber: 2,
      sectionTitle: '',
      sectionType: 'grammar',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP D GRAMMAR TIP',
      instructionEn: 'Use who, what, when, where, and how to ask questions.',
      instructionJp: 'who、what、when、where、howを使って、質問をすることができます。',
      grammarRules: [
        {
          id: 'rule-1',
          ruleEn: 'Use who to ask about people. Add with at the end of the question when you ask about activities that people do together.',
          ruleJp: 'whoは人について質問をするときに使います。誰かと一緒に行動をする時は、質問の最後にwithを付けます。',
          examples: [
            { id: 'ex-1', sentenceEn: "Who's that girl?", sentenceJp: 'あの少女は誰ですか？', boldWords: ['Who'] },
            { id: 'ex-2', sentenceEn: 'Who do you drink with?', sentenceJp: 'あなたは誰と一緒に飲みますか？', boldWords: ['Who', 'with'] },
          ],
        },
        {
          id: 'rule-2',
          ruleEn: 'Use what to ask about things or activities.',
          ruleJp: 'whatは物や行動について質問するときに使います。',
          examples: [
            { id: 'ex-3', sentenceEn: 'What does she drink?', sentenceJp: '彼女は何を飲みますか？', boldWords: ['What'] },
          ],
        },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP B (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Step B Grammar Tip.', scriptLine: '"Okay, now let\'s do Step B Grammar Tip."' },
        { id: 'step-2', instruction: 'Read the bold grammar tip.' },
        { id: 'step-3', instruction: 'Read the unbolded explanation part(s). Have the student read the example sentences.' },
        { id: 'step-4', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is it clear?"' },
        { id: 'step-5', instruction: 'Transition to the next section.', scriptLine: '"Very good! Let\'s go to the next section!"' },
      ],
    },
    {
      id: 'section-6',
      sectionNumber: 3,
      sectionTitle: 'APPLY',
      sectionType: 'dialogue',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'SPEAKING',
      instructionEn: 'The school day is done. Saori and her coworker Masa are chatting in the teachers\' lounge.',
      instructionJp: '学校の一日が終わりました。サオリと同僚のマサは職員室で話をしています。',
      dialogueImage: '',
      dialogueLines: [
        { id: 'line-1', speaker: 'Masa', lineEn: 'So, Saori, what do you do after work?' },
        { id: 'line-2', speaker: 'Saori', lineEn: 'I usually eat out with my best friend, Catherine. Then, we go to karaoke.' },
        { id: 'line-3', speaker: 'Masa', lineEn: 'Sounds fun! Where do you usually eat out?' },
        { id: 'line-4', speaker: 'Saori', lineEn: 'Well, we go to different restaurants. But our favorite place is the Pearl Café.' },
        { id: 'line-5', speaker: 'Masa', lineEn: 'The Pearl Café? That\'s far from your home, right? How do you get home?' },
        { id: 'line-6', speaker: 'Saori', lineEn: 'I take the bus. Catherine usually takes a taxi.' },
        { id: 'line-7', speaker: 'Masa', lineEn: 'Wow, your best friend\'s rich! (laughs) Anyway, do you want to go for a drink tonight?' },
        { id: 'line-8', speaker: 'Saori', lineEn: 'Sorry, maybe next time. I have plans tonight.' },
      ],
      sidebarTitle: 'APPLY',
      sidebarSubtitle: 'SPEAKING (3 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce the activity.', scriptLine: '"Okay, now let\'s do a speaking activity."' },
        { id: 'step-2', instruction: 'Set up the story.', scriptLine: '"Do you remember Saori from before?"', tipText: 'If the student doesn\'t remember the character, say that Saori is an elementary school teacher in Kyoto.' },
        { id: 'step-3', instruction: 'Read the situation.' },
        { id: 'step-4', instruction: 'Set up the dialogue.', scriptLine: '"Let\'s read their dialogue. I\'ll be Masa. Please be Saori. Is it clear? Okay, I\'ll start."' },
        { id: 'step-5', instruction: 'Read the dialogue with the student.' },
        { id: 'step-6', instruction: 'After you finish the dialogue, correct their pronunciation mistakes.', tipText: 'Limit this to 2-3 corrections. If the student made a lot of mistakes, focus on the biggest ones.' },
        { id: 'step-7', instruction: 'Ask the questions below.' },
        { id: 'step-8', instruction: 'Transition to the next part.', scriptLine: '"Great! Let\'s go to the next part!"' },
      ],
    },
    {
      id: 'section-7',
      sectionNumber: 3,
      sectionTitle: 'APPLY',
      sectionType: 'trivia',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'TRIVIA',
      instructionEn: 'When people invite you somewhere, it\'s rude to just say no. Instead, you should use the phrases sorry, maybe next time or sorry, maybe another time.',
      instructionJp: '誰かに招待された場合、「no（いいえ）」と言うだけでは失礼です。そんなときは、「sorry, maybe next time.（ごめんなさい、また今度）」または、「sorry, maybe another time.（ごめんなさい、またの機会に）」と言うといいでしょう。',
      triviaImage: '',
      triviaExamples: [
        {
          id: 'trivia-ex-1',
          speakerA: 'A',
          lineA: 'Do you want to see a movie?',
          speakerB: 'B',
          lineB: 'No.',
          isCorrect: false,
          lineAJp: '映画を見ませんか？',
          lineBJp: 'いいえ。',
        },
        {
          id: 'trivia-ex-2',
          speakerA: 'A',
          lineA: 'Do you want to see a movie?',
          speakerB: 'B',
          lineB: 'Sorry, maybe next time.',
          isCorrect: true,
          lineAJp: '映画を見ませんか？',
          lineBJp: 'ごめんなさい、また今度。',
        },
      ],
      sidebarTitle: 'APPLY',
      sidebarSubtitle: 'TRIVIA (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce the Trivia.', scriptLine: '"Let\'s look at the Trivia."' },
        { id: 'step-2', instruction: 'Read the trivia.' },
        { id: 'step-3', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is it clear?"' },
        { id: 'step-4', instruction: 'Ask the question below.' },
        { id: 'step-5', instruction: 'Transition to the next section.', scriptLine: '"Excellent! Let\'s go to the next section!"' },
      ],
    },
    // Section 8 - PRACTICE (Exercise section)
    {
      id: 'section-8',
      sectionNumber: 4,
      sectionTitle: 'TRY IT',
      sectionType: 'practice',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP A EXERCISE',
      instructionEn: 'Unscramble the words in parentheses to make a question.',
      instructionJp: 'カッコ内の単語を並び替えて質問文を作りましょう。',
      practiceExample: 'ex. (you / when / do) take ikebana lessons?',
      practiceExampleAnswer: '→ When do you take ikebana lessons?',
      practiceItems: [
        { id: 'practice-1', question: '(when / they / do) eat out?', answer: 'When do they' },
        { id: 'practice-2', question: '(she / does / where) go after work?', answer: 'Where does she' },
        { id: 'practice-3', question: '(who / you / do) go to karaoke with?', answer: 'Who do you' },
        { id: 'practice-4', question: '(does / how / she) get home?', answer: 'How does she' },
        { id: 'practice-5', question: '(do / what / you) do after work?', answer: 'What do you' },
      ],
      practiceImage: '',
      answerItems: ['When do they', 'Where does she', 'Who do you', 'How does she', 'What do you'],
      sidebarTitle: 'TRY IT',
      sidebarSubtitle: 'STEP A (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Practice.', scriptLine: '"Okay, now let\'s do Practice."' },
        { id: 'step-2', instruction: '', scriptLine: '"We\'re going to practice the grammar tip we read earlier."' },
        { id: 'step-3', instruction: '', scriptLine: '"First we have Step A."' },
        { id: 'step-4', instruction: 'Read the instructions.' },
        { id: 'step-5', instruction: 'Read the example.' },
        { id: 'step-6', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is it clear?"' },
        { id: 'step-7', instruction: 'Have the student read each question with the correct answer.' },
        { id: 'step-8', instruction: 'Transition to the next step.', scriptLine: '"Good! Let\'s go to the next step!"' },
      ],
    },
    // Section 9 - PRACTICE STEP B (Conversation exercise)
    {
      id: 'section-9',
      sectionNumber: 4,
      sectionTitle: '',
      sectionType: 'practice',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP B EXERCISE',
      instructionEn: 'Complete the conversation using the words in the box. Not every word will be used.',
      instructionJp: 'ボックス内の単語を使って、会話を完成させましょう。すべての単語を使うとは限りません。',
      wordBox: ['who', 'what', 'when', 'where', 'how'],
      conversationLines: [
        { id: 'conv-1', speaker: 'Student', text: '_____ do you usually do after work?' },
        { id: 'conv-2', speaker: 'Tutor', text: 'I like to try new restaurants for dinner.' },
        { id: 'conv-3', speaker: 'Student', text: 'Nice! _____ do you eat out with?' },
        { id: 'conv-4', speaker: 'Tutor', text: 'I eat out with my husband.' },
        { id: 'conv-5', speaker: 'Student', text: '_____ do you usually go? Do you eat around here?' },
        { id: 'conv-6', speaker: 'Tutor', text: 'No, we usually go to Ebisu. There are lots of good restaurants there!' },
        { id: 'conv-7', speaker: 'Student', text: 'Oh, nice! _____ do you get there? Do you take the train or walk from here?' },
        { id: 'conv-8', speaker: 'Tutor', text: 'We usually take the train. We\'re actually going to try a new restaurant tonight. Do you want to go with us?' },
        { id: 'conv-9', speaker: 'Student', text: 'Sorry, maybe another time! I have to work late tonight.' },
      ],
      practiceImage: '',
      answerItems: ['What', 'Who', 'Where', 'How'],
      sidebarTitle: 'TRY IT',
      sidebarSubtitle: 'STEP B (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Step B.', scriptLine: '"Okay, now let\'s do Step B."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Set up the conversation.', scriptLine: '"Now, I\'ll read the tutor parts."' },
        { id: 'step-4', instruction: '', scriptLine: '"Please read the student parts."' },
        { id: 'step-5', instruction: '', scriptLine: '"Is it clear?"' },
        { id: 'step-6', instruction: '', scriptLine: '"Please start."' },
        { id: 'step-7', instruction: 'Read the conversation with the student.' },
        { id: 'step-8', instruction: 'Transition to the next section.', scriptLine: '"Great! Let\'s go to the next section!"' },
      ],
    },
    // Section 10 - CHALLENGE 1
    {
      id: 'section-10',
      sectionNumber: 5,
      sectionTitle: 'CHALLENGE',
      sectionType: 'challenge',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      challengeTitle: 'Challenge 1',
      situationEn: 'You are on a first date.\n\nAnswer your date\'s questions about what you usually do after work. Ask your date questions as well.',
      situationJp: '初めてのデート中です。\n\n仕事の後、いつも何をするかという相手の質問に答えましょう。相手にも質問をしましょう。',
      instructionEn: '',
      instructionJp: '',
      grammarTipTitle: 'Today\'s grammar tip',
      grammarTipItems: ['who', 'what', 'when', 'where', 'how'],
      practiceImage: '',
      challengeQuestions: [
        { id: 'cq-1', question: 'How\'s your work? Are you busy?' },
        { id: 'cq-2', question: 'By the way, do you want a drink?', subQuestions: ['(If yes, ask, "What do you want to drink?")', '(If no, ask, "Are you hungry?")'] },
        { id: 'cq-3', question: 'Do you usually eat out?', subQuestions: ['(If yes, ask, "When do you usually eat out?")', '(If no, ask "What do you usually do after work?")'] },
        { id: 'cq-4', question: 'What else do you do after work?', subQuestions: ['(Ask specific questions.)', 'Who do you [activity] with?', 'Where do you usually go?'] },
        { id: 'cq-5', question: 'Sounds interesting. I\'m usually really busy after work (too).' },
        { id: 'cq-6', question: 'This restaurant has great food. Let\'s order! What do you want to order?', subQuestions: ['(Answer the student\'s questions about your after-work activities.)'] },
      ],
      sidebarTitle: 'CHALLENGE',
      sidebarSubtitle: 'CHALLENGE 1 (5-6 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Challenge 1.', scriptLine: '"Okay, now let\'s do the Challenge."' },
        { id: 'step-2', instruction: '', scriptLine: '"First we have Challenge 1."' },
        { id: 'step-3', instruction: 'Read the situation.' },
        { id: 'step-4', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is it clear?"' },
        { id: 'step-5', instruction: 'Set up the roleplay.', scriptLine: '"Now, I\'ll be your date."' },
        { id: 'step-6', instruction: '', scriptLine: '"Please remember to ask me questions."' },
        { id: 'step-7', instruction: '', scriptLine: '"Remember to use today\'s grammar tip."' },
        { id: 'step-8', instruction: '', scriptLine: '"Is it clear?"' },
        { id: 'step-9', instruction: '', scriptLine: '"I\'ll start."' },
        { id: 'step-10', instruction: 'Ask the questions below.', tipText: 'Use the questions below only as guides. Ask other questions based on the flow of the conversation.' },
        { id: 'step-11', instruction: '', tipText: 'Make sure that you simulate a real-life situation.' },
        { id: 'step-12', instruction: '', tipText: 'Change your tone according to the character you are playing.' },
        { id: 'step-13', instruction: 'Transition to the next part.', scriptLine: '"Well done! Let\'s go to the last section!"' },
      ],
    },
    // Section 11 - CHALLENGE 2 (If Time Allows)
    {
      id: 'section-11',
      sectionNumber: 5,
      sectionTitle: '',
      sectionType: 'challenge2',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      challengeTitle: 'Challenge 2',
      isOptional: true,
      instructionEn: 'Discuss your ideas.',
      instructionJp: 'あなたの意見を言いましょう。',
      topicBoxes: [
        {
          id: 'topic-1',
          topicNumber: 1,
          topicTitle: 'AFTER WORK',
          questions: [
            { id: 'tq-1', question: 'Do you prefer to relax at home or go out and have fun after work?' },
            { id: 'tq-2', question: 'Do you sometimes do household chores after work?' },
            { id: 'tq-3', question: 'Do you sometimes cancel plans after work?' },
            { id: 'tq-4', question: 'How do you get home after work (ex. take the train, walk)?' },
          ],
        },
        {
          id: 'topic-2',
          topicNumber: 2,
          topicTitle: 'COWORKERS',
          questions: [
            { id: 'tq-5', question: 'How many coworkers do you have?' },
            { id: 'tq-6', question: 'Do you have a best friend at work?' },
            { id: 'tq-7', question: 'Do you eat out with your coworkers?' },
            { id: 'tq-8', question: 'Do you do any activities with your coworkers outside of work (ex. take English lessons together, play futsal)?' },
          ],
        },
      ],
      sidebarTitle: 'CHALLENGE',
      sidebarSubtitle: 'CHALLENGE 2 (2-3 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Challenge 2.', scriptLine: '"Okay, now let\'s do Challenge 2."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Read the topics and ask the student to choose one.', tipText: 'If the student cannot decide, choose a topic for them.' },
        { id: 'step-4', instruction: 'Ask the questions for that topic, adding follow-up questions and comments to make the conversation natural.', tipText: 'Continue as time allows. You do not have to ask all the questions.' },
        { id: 'step-5', instruction: 'Transition to the last section.', scriptLine: '"Well done! Let\'s go to the last section!"' },
      ],
    },
    // Section 12: FEEDBACK
    {
      id: 'section-12',
      sectionNumber: 6,
      sectionTitle: 'FEEDBACK',
      sectionType: 'feedback',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      feedbackRubric: [
        { score: 4, label: 'Very Good', description: 'Could complete the task with ease' },
        { score: 3, label: 'Good', description: 'Could complete the task with some clarifications' },
        { score: 2, label: 'Fair', description: 'Could complete the task with additional instructions' },
        { score: 1, label: 'Poor', description: 'Could somehow complete the task with difficulty' },
      ],
      feedbackCategories: [
        { id: 'fc-1', title: 'RANGE', titleJp: '表現の幅', descJp: '語彙をどの程度使えるか' },
        { id: 'fc-2', title: 'ACCURACY', titleJp: '正確さ', descJp: '文法が正しく使えているかどうか' },
        { id: 'fc-3', title: 'FLUENCY', titleJp: '流暢さ', descJp: '円滑に喋ることができるかどうか' },
      ],
      feedbackGuide: [
        {
          id: 'fg-1',
          category: 'RANGE',
          categoryJp: '',
          categoryDesc: 'the ability to use a wide variety of vocabulary',
          focusOn: '<strong>words</strong> the student <strong>learned</strong>\n+\n<strong>words</strong> the student <strong>overused</strong>',
          exampleFeedback: 'the latest - something that is the newest version\n\nYou said: My job is <span class="error">VERY</span> fun. I like it <span class="error">VERY</span> much, but I\'m <span class="error">VERY</span> busy.\n\nBetter: My job is <strong>A LOT OF</strong> fun. I like it <strong>VERY</strong> much, but I\'m <strong>QUITE</strong> busy.',
        },
        {
          id: 'fg-2',
          category: 'ACCURACY',
          categoryJp: '',
          categoryDesc: 'the ability to speak correctly',
          focusOn: '<strong>grammar mistakes</strong>',
          exampleFeedback: 'You said: I <span class="error">GO</span> to the park yesterday.\nCorrect: I <strong>WENT</strong> to the park yesterday.\n\nYou said: I <span class="error">HAVE NOT</span> started yet.\nBetter: I <strong>HAVEN\'T</strong> started yet.',
        },
        {
          id: 'fg-3',
          category: 'FLUENCY',
          categoryJp: '',
          categoryDesc: 'the ability to speak smoothly without pauses or fillers',
          focusOn: 'unnaturally <strong>long pauses</strong>\n+\nJapanese or English <strong>fillers</strong>\n(etto..., ano..., um..., etc.)',
          exampleFeedback: 'You said: I went shopping. ... It was fun.\nBetter: I went shopping. It was fun.\n\nYou said: I went shopping. <span class="error">ETTO</span>, it was fun.\nBetter: I went shopping. It was fun.',
        },
      ],
      feedbackTemplate: '*Lesson Goal Achievement SCORE*\n4 / 3 / 2 / 1\n\n*Personalized FEEDBACK*\n\n*RANGE*\n[word] - [meaning]\n\nYou said:\nBetter:\n\n*ACCURACY*\nYou said:\nCorrect:\n\n*FLUENCY*\nYou said:\nBetter:',
      sidebarTitle: 'FEEDBACK',
      sidebarSubtitle: 'FEEDBACK (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Feedback.', scriptLine: '"Okay, now let\'s do Feedback."' },
        { id: 'step-2', instruction: 'Have the student read the lesson goal.' },
        { id: 'step-3', instruction: 'Ask if they achieved the lesson goal.', scriptLine: '"Did you achieve the lesson goal?"' },
        { id: 'step-4', instruction: 'Give the student a score for their lesson goal achievement using the rubric.', tipText: 'Base your score on how well they did Challenge 1.' },
        { id: 'step-5', instruction: 'Give feedback on the student\'s range, accuracy, and fluency using the template below.', tipText: 'Refer to the Personalized Feedback Guide for more information.' },
        { id: 'step-6', instruction: 'Wrap up the lesson.', scriptLine: '"You did a great job! Thank you very much for today."' },
      ],
    },
  ],
  vocabulary: [],
  grammar: [],
  exercises: [],
});

// Create Listening template draft
const createListeningDraft = (): LessonMaterialDraft => ({
  version: 2,
  header: {
    backgroundImage: '',
    overlayColor: '#0369a1cc',
    levelBadge: 'STARTER',
    chapterLabel: 'Chapter 1: All About Me',
    lessonLabel: 'Lesson 1: Listening',
    goalText: 'I can understand basic conversations.',
    goalSubtext: '基本的な会話を理解することができる。',
  },
  sections: [
    {
      id: 'listening-section-1',
      sectionNumber: 1,
      sectionTitle: 'WARM-UP',
      sectionType: 'introduce',
      explanationEn: 'Today we will practice listening to everyday conversations.',
      explanationJp: '今日は日常会話を聞く練習をします。',
      sectionImage: '',
      importantNote: 'Focus on understanding the main idea first, then details.',
      copyTemplate: '',
      lessonGoalTitle: 'LESSON GOAL (1 minute)',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce the lesson topic.', scriptLine: '"Today, let\'s practice listening."' },
        { id: 'step-2', instruction: 'Read the lesson goal and ask if it\'s clear.' },
        { id: 'step-3', instruction: 'Read the Introduce explanation.' },
        { id: 'step-4', instruction: 'Transition to the next section.', scriptLine: '"Good! Let\'s go to the next part!"' },
      ],
    },
    {
      id: 'listening-section-2',
      sectionNumber: 2,
      sectionTitle: 'LEARN',
      sectionType: 'vocabulary',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP A VOCABULARY',
      instructionEn: 'I. Listen and repeat.',
      instructionJp: '聴いて、リピートしましょう。',
      vocabCards: [
        { id: 'vocab-1', image: '', wordEn: 'listen', wordJp: '聞く' },
        { id: 'vocab-2', image: '', wordEn: 'understand', wordJp: '理解する' },
        { id: 'vocab-3', image: '', wordEn: 'repeat', wordJp: '繰り返す' },
        { id: 'vocab-4', image: '', wordEn: 'answer', wordJp: '答える' },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A I (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Present.', scriptLine: '"Now, let\'s learn some vocabulary."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Read each vocabulary and ask the student to repeat.' },
        { id: 'step-4', instruction: 'Transition to the next part.', scriptLine: '"Great! Let\'s go to the next part!"' },
      ],
    },
    // Section 2b - STEP B (Question/Image Cards)
    {
      id: 'listening-section-2b',
      sectionNumber: 2,
      sectionTitle: '',
      sectionType: 'question',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP B',
      instructionEn: 'II. Which of the things above do you often hear? Which is difficult to understand?',
      instructionJp: '上記のうち、よく聞くものはどれですか？理解するのが難しいものはどれですか？',
      imageCards: [
        { id: 'img-1', image: '', label: 'often hear' },
        { id: 'img-2', image: '', label: 'difficult to understand' },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A II (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Part II.', scriptLine: '"Okay, now let\'s do Part II."' },
        { id: 'step-2', instruction: 'Read the instructions and ask if they\'re clear.' },
        { id: 'step-3', instruction: 'Have the student use some of the vocabulary to answer the question.', tipText: 'The student doesn\'t have to use complete sentences. We just want to test their understanding of the vocabulary.' },
        { id: 'step-4', instruction: 'Transition to the next part.', scriptLine: '"Good job! Let\'s go to the next part!"' },
      ],
    },
    // Section 2c - STEP C (Pronunciation)
    {
      id: 'listening-section-2c',
      sectionNumber: 2,
      sectionTitle: '',
      sectionType: 'pronunciation',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP C',
      instructionEn: 'III. Practice reading the words.',
      instructionJp: '単語を読む練習をしましょう。',
      pronunciationColumns: [
        {
          id: 'col-1',
          soundLabel: '/ɪ/',
          image: '',
          words: [
            { id: 'w1', wordEn: 'listen', wordJp: '聞く' },
            { id: 'w2', wordEn: 'script', wordJp: '台本' },
            { id: 'w3', wordEn: 'quick', wordJp: '速い' },
          ],
        },
        {
          id: 'col-2',
          soundLabel: '/iː/',
          image: '',
          words: [
            { id: 'w4', wordEn: 'speak', wordJp: '話す' },
            { id: 'w5', wordEn: 'scene', wordJp: '場面' },
            { id: 'w6', wordEn: 'please', wordJp: 'お願いします' },
          ],
        },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A III (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Part III.', scriptLine: '"Okay, now let\'s do Part III."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Introduce the pronunciation point.', scriptLine: '"Today, we\'re going to practice /ɪ/ (the i in listen) and /iː/ (the ee in speak)."' },
        { id: 'step-4', instruction: 'Demonstrate the sound on the left and have the student repeat.' },
        { id: 'step-5', instruction: 'Read the words on the left one by one. Have the student repeat after each one.' },
        { id: 'step-6', instruction: 'Repeat Steps 4-5 with the sound and words on the right.' },
        { id: 'step-7', instruction: 'Read the left-right pairs of words. Have the student repeat after each pair.', scriptLine: '"Now let\'s compare the two sets of words. Repeat after me."' },
        { id: 'step-8', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is the difference between the two sounds clear?"' },
        { id: 'step-9', instruction: 'Transition to the next step.', scriptLine: '"Fantastic! Let\'s go to the next step!"' },
      ],
    },
    // Section 2d - STEP D (Grammar Tip)
    {
      id: 'listening-section-2d',
      sectionNumber: 2,
      sectionTitle: '',
      sectionType: 'grammar',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP D GRAMMAR TIP',
      instructionEn: 'Use question words to ask for specific information.',
      instructionJp: '疑問詞を使って、特定の情報を聞くことができます。',
      grammarRules: [
        {
          id: 'rule-1',
          ruleEn: 'Use what to ask about things or activities you hear.',
          ruleJp: 'whatは聞いた物や行動について質問するときに使います。',
          examples: [
            { id: 'ex-1', sentenceEn: 'What did they say?', sentenceJp: '彼らは何と言いましたか？', boldWords: ['What'] },
            { id: 'ex-2', sentenceEn: 'What time is it?', sentenceJp: '何時ですか？', boldWords: ['What', 'time'] },
          ],
        },
        {
          id: 'rule-2',
          ruleEn: 'Use where to ask about places mentioned in conversations.',
          ruleJp: 'whereは会話で言及された場所について質問するときに使います。',
          examples: [
            { id: 'ex-3', sentenceEn: 'Where are they going?', sentenceJp: '彼らはどこに行きますか？', boldWords: ['Where'] },
          ],
        },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP B (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Step B Grammar Tip.', scriptLine: '"Okay, now let\'s do Step B Grammar Tip."' },
        { id: 'step-2', instruction: 'Read the bold grammar tip.' },
        { id: 'step-3', instruction: 'Read the unbolded explanation part(s). Have the student read the example sentences.' },
        { id: 'step-4', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is it clear?"' },
        { id: 'step-5', instruction: 'Transition to the next section.', scriptLine: '"Very good! Let\'s go to the next section!"' },
      ],
    },
    {
      id: 'listening-section-3',
      sectionNumber: 3,
      sectionTitle: 'UNDERSTAND',
      sectionType: 'listening',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'LISTENING',
      instructionEn: 'Two friends are talking at a coffee shop. Listen to their conversation.',
      instructionJp: '二人の友人がコーヒーショップで話しています。会話を聞いてください。',
      listeningScriptText: 'A: Hey, did you watch the game last night?\nB: Yes! It was so exciting. The final score was 3-2.\nA: I know! I couldn\'t believe that last goal.\nB: Me neither. Want to watch the next game together?',
      sidebarTitle: 'UNDERSTAND',
      sidebarSubtitle: 'LISTENING (3 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce the listening section.', scriptLine: '"Now, let\'s practice listening."', scriptLines: ['Read the situation to the student.', 'Make sure they understand the context.'] },
        { id: 'step-2', instruction: 'Play the audio or read the script.', tipText: 'Read slowly and clearly for beginners.' },
        { id: 'step-3', instruction: 'Ask comprehension questions.', scriptLines: ['What were they talking about?', 'What was the score?'] },
        { id: 'step-4', instruction: 'Transition to the next part.', scriptLine: '"Great listening! Let\'s continue."' },
      ],
    },
    {
      id: 'listening-section-4',
      sectionNumber: 4,
      sectionTitle: 'TRY IT',
      sectionType: 'practice',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'COMPREHENSION CHECK',
      instructionEn: 'Answer the questions based on what you heard.',
      instructionJp: '聞いた内容に基づいて質問に答えましょう。',
      practiceItems: [
        { id: 'q-1', questionEn: 'Where are the two friends?', questionJp: '二人の友人はどこにいますか？', answer: 'At a coffee shop' },
        { id: 'q-2', questionEn: 'What did they watch?', questionJp: '彼らは何を見ましたか？', answer: 'A game' },
        { id: 'q-3', questionEn: 'How did they feel about it?', questionJp: 'それについてどう感じましたか？', answer: 'Excited' },
      ],
      sidebarTitle: 'TRY IT',
      sidebarSubtitle: 'COMPREHENSION (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Have the student answer the comprehension questions.' },
        { id: 'step-2', instruction: 'Check their answers and provide feedback.' },
        { id: 'step-3', instruction: 'Transition to the next section.', scriptLine: '"Excellent! Let\'s move to the challenge!"' },
      ],
    },
    // Section 5 - CHALLENGE 1
    {
      id: 'listening-section-5',
      sectionNumber: 5,
      sectionTitle: 'CHALLENGE',
      sectionType: 'challenge',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      challengeTitle: 'Challenge 1',
      situationEn: 'You are at a train station.\n\nListen to the announcement and answer the questions.',
      situationJp: '駅にいます。\n\nアナウンスを聞いて、質問に答えましょう。',
      instructionEn: '',
      instructionJp: '',
      grammarTipTitle: 'Listening tips',
      grammarTipItems: ['numbers', 'times', 'platform', 'destination', 'delay'],
      practiceImage: '',
      challengeQuestions: [
        { id: 'cq-1', question: 'What platform is the train departing from?' },
        { id: 'cq-2', question: 'What time will the train arrive?', subQuestions: ['(Ask if they need to hear it again.)'] },
        { id: 'cq-3', question: 'Where is the train going?', subQuestions: ['(If they\'re not sure, give hints.)', '(Repeat key parts if needed.)'] },
        { id: 'cq-4', question: 'Is there any delay mentioned?', subQuestions: ['(Ask specific questions.)', 'How long is the delay?', 'What is the reason?'] },
        { id: 'cq-5', question: 'What should passengers do?' },
      ],
      sidebarTitle: 'CHALLENGE',
      sidebarSubtitle: 'CHALLENGE 1 (5-6 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Challenge 1.', scriptLine: '"Okay, now let\'s do the Challenge."' },
        { id: 'step-2', instruction: '', scriptLine: '"First we have Challenge 1."' },
        { id: 'step-3', instruction: 'Read the situation.' },
        { id: 'step-4', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is it clear?"' },
        { id: 'step-5', instruction: 'Set up the listening task.', scriptLine: '"Now, I\'ll read an announcement."' },
        { id: 'step-6', instruction: '', scriptLine: '"Please listen carefully."' },
        { id: 'step-7', instruction: '', scriptLine: '"Remember today\'s listening tips."' },
        { id: 'step-8', instruction: '', scriptLine: '"Is it clear?"' },
        { id: 'step-9', instruction: '', scriptLine: '"I\'ll start."' },
        { id: 'step-10', instruction: 'Read the listening script and ask comprehension questions.', tipText: 'Use the questions below only as guides. Ask other questions based on the student\'s responses.' },
        { id: 'step-11', instruction: '', tipText: 'Read slowly and clearly. Repeat if necessary.' },
        { id: 'step-12', instruction: '', tipText: 'Adjust your pace according to the student\'s level.' },
        { id: 'step-13', instruction: 'Transition to the next part.', scriptLine: '"Well done! Let\'s go to Challenge 2!"' },
      ],
    },
    // Section 5b - CHALLENGE 2 (If Time Allows)
    {
      id: 'listening-section-6',
      sectionNumber: 5,
      sectionTitle: '',
      sectionType: 'challenge2',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      challengeTitle: 'Challenge 2',
      isOptional: true,
      instructionEn: 'Discuss your ideas.',
      instructionJp: 'あなたの意見を言いましょう。',
      topicBoxes: [
        {
          id: 'topic-1',
          topicNumber: 1,
          topicTitle: 'LISTENING IN DAILY LIFE',
          questions: [
            { id: 'tq-1', question: 'What kind of announcements do you often hear in your daily life?' },
            { id: 'tq-2', question: 'Do you find it easy or difficult to understand English announcements?' },
            { id: 'tq-3', question: 'How do you practice your listening skills?' },
            { id: 'tq-4', question: 'What English media do you like to listen to (ex. podcasts, music, movies)?' },
          ],
        },
        {
          id: 'topic-2',
          topicNumber: 2,
          topicTitle: 'TRAVEL EXPERIENCES',
          questions: [
            { id: 'tq-5', question: 'Have you ever traveled to an English-speaking country?' },
            { id: 'tq-6', question: 'Did you have any difficulty understanding announcements there?' },
            { id: 'tq-7', question: 'What was the most difficult thing to understand?' },
            { id: 'tq-8', question: 'Do you have any tips for improving listening comprehension?' },
          ],
        },
      ],
      sidebarTitle: 'CHALLENGE',
      sidebarSubtitle: 'CHALLENGE 2 (2-3 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Challenge 2.', scriptLine: '"Okay, now let\'s do Challenge 2."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Read the topics and ask the student to choose one.', tipText: 'If the student cannot decide, choose a topic for them.' },
        { id: 'step-4', instruction: 'Ask the questions for that topic, adding follow-up questions and comments to make the conversation natural.', tipText: 'Continue as time allows. You do not have to ask all the questions.' },
        { id: 'step-5', instruction: 'Transition to the last section.', scriptLine: '"Well done! Let\'s go to the last section!"' },
      ],
    },
    // Section 6: FEEDBACK
    {
      id: 'listening-section-7',
      sectionNumber: 6,
      sectionTitle: 'FEEDBACK',
      sectionType: 'feedback',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      feedbackRubric: [
        { score: 4, label: 'Very Good', description: 'Could complete the task with ease' },
        { score: 3, label: 'Good', description: 'Could complete the task with some clarifications' },
        { score: 2, label: 'Fair', description: 'Could complete the task with additional instructions' },
        { score: 1, label: 'Poor', description: 'Could somehow complete the task with difficulty' },
      ],
      feedbackCategories: [
        { id: 'fc-1', title: 'COMPREHENSION', titleJp: '理解力', descJp: '聞いた内容をどの程度理解できているか' },
        { id: 'fc-2', title: 'ACCURACY', titleJp: '正確さ', descJp: '詳細を正確に聞き取れているか' },
        { id: 'fc-3', title: 'RESPONSE', titleJp: '応答', descJp: '質問に適切に答えられるかどうか' },
      ],
      feedbackGuide: [
        {
          id: 'fg-1',
          category: 'COMPREHENSION',
          categoryJp: '',
          categoryDesc: 'the ability to understand the main idea and details',
          focusOn: '<strong>key information</strong> the student <strong>understood</strong>\n+\n<strong>parts</strong> they <strong>missed</strong>',
          exampleFeedback: 'You correctly understood:\n• The train platform number\n• The departure time\n\nYou missed:\n• The reason for the delay\n\nTip: Listen for key words like "because" or "due to" for reasons.',
        },
        {
          id: 'fg-2',
          category: 'ACCURACY',
          categoryJp: '',
          categoryDesc: 'the ability to hear details correctly',
          focusOn: '<strong>numbers, times, names</strong> they heard correctly\n+\n<strong>details</strong> they misheard',
          exampleFeedback: 'You heard: Platform <span class="error">3</span>\nCorrect: Platform <strong>13</strong>\n\nYou heard: Arrives at <span class="error">2:30</span>\nCorrect: Arrives at <strong>2:13</strong>\n\nTip: Pay attention to numbers like "thirteen" vs "thirty".',
        },
        {
          id: 'fg-3',
          category: 'RESPONSE',
          categoryJp: '',
          categoryDesc: 'the ability to respond appropriately to questions',
          focusOn: '<strong>complete answers</strong>\n+\n<strong>incomplete or unclear</strong> responses',
          exampleFeedback: 'You answered: "Train go Tokyo."\nBetter: "The train is going <strong>TO</strong> Tokyo."\n\nYou answered: "Yes."\nBetter: "Yes, there is a <strong>10-MINUTE</strong> delay."',
        },
      ],
      feedbackTemplate: '*Lesson Goal Achievement SCORE*\n4 / 3 / 2 / 1\n\n*Personalized FEEDBACK*\n\n*COMPREHENSION*\nYou understood:\nYou missed:\n\n*ACCURACY*\nYou heard:\nCorrect:\n\n*RESPONSE*\nYou answered:\nBetter:',
      sidebarTitle: 'FEEDBACK',
      sidebarSubtitle: 'FEEDBACK (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Feedback.', scriptLine: '"Okay, now let\'s do Feedback."' },
        { id: 'step-2', instruction: 'Have the student read the lesson goal.' },
        { id: 'step-3', instruction: 'Ask if they achieved the lesson goal.', scriptLine: '"Did you achieve the lesson goal?"' },
        { id: 'step-4', instruction: 'Give the student a score for their lesson goal achievement using the rubric.', tipText: 'Base your score on how well they did Challenge 1.' },
        { id: 'step-5', instruction: 'Give feedback on the student\'s comprehension, accuracy, and response using the template below.', tipText: 'Refer to the Personalized Feedback Guide for more information.' },
        { id: 'step-6', instruction: 'Wrap up the lesson.', scriptLine: '"You did a great job! Thank you very much for today."' },
      ],
    },
  ],
  vocabulary: [],
  grammar: [],
  exercises: [],
});

// Create Reading template draft
const createReadingDraft = (): LessonMaterialDraft => ({
  version: 2,
  header: {
    backgroundImage: '',
    overlayColor: '#0369a1cc',
    levelBadge: 'STARTER',
    chapterLabel: 'Chapter 1: All About Me',
    lessonLabel: 'Lesson 1: Reading',
    goalText: 'I can understand simple text messages.',
    goalSubtext: '簡単なテキストメッセージを理解することができる。',
  },
  sections: [
    // Section 1 - INTRODUCE
    {
      id: 'reading-section-1',
      sectionNumber: 1,
      sectionTitle: 'WARM-UP',
      sectionType: 'introduce',
      explanationEn: 'Today we will practice reading text messages and short conversations.',
      explanationJp: '今日はテキストメッセージや短い会話を読む練習をします。',
      sectionImage: '',
      importantNote: 'Focus on understanding the main message first, then the details.',
      copyTemplate: '',
      lessonGoalTitle: 'LESSON GOAL (1 minute)',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce the lesson topic.', scriptLine: '"Today, let\'s practice reading."' },
        { id: 'step-2', instruction: 'Read the lesson goal and ask if it\'s clear.' },
        { id: 'step-3', instruction: 'Read the Introduce explanation.' },
        { id: 'step-4', instruction: 'Transition to the next section.', scriptLine: '"Good! Let\'s go to the next part!"' },
      ],
    },
    // Section 2a - PRESENT STEP A VOCABULARY
    {
      id: 'reading-section-2',
      sectionNumber: 2,
      sectionTitle: 'LEARN',
      sectionType: 'vocabulary',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP A VOCABULARY',
      instructionEn: 'I. Listen and repeat.',
      instructionJp: '聴いて、リピートしましょう。',
      vocabCards: [
        { id: 'vocab-1', image: '', wordEn: 'text', wordJp: 'テキスト' },
        { id: 'vocab-2', image: '', wordEn: 'message', wordJp: 'メッセージ' },
        { id: 'vocab-3', image: '', wordEn: 'meet', wordJp: '会う' },
        { id: 'vocab-4', image: '', wordEn: 'time', wordJp: '時間' },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A I (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Present.', scriptLine: '"Now, let\'s learn some vocabulary."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Read each vocabulary and ask the student to repeat.' },
        { id: 'step-4', instruction: 'Transition to the next part.', scriptLine: '"Great! Let\'s go to the next part!"' },
      ],
    },
    // Section 2b - STEP B (Question/Image Cards)
    {
      id: 'reading-section-2b',
      sectionNumber: 2,
      sectionTitle: '',
      sectionType: 'question',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP B',
      instructionEn: 'II. Which of the things above do you often read? Which is difficult to understand?',
      instructionJp: '上記のうち、よく読むものはどれですか？理解するのが難しいものはどれですか？',
      imageCards: [
        { id: 'img-1', image: '', label: 'often read' },
        { id: 'img-2', image: '', label: 'difficult to understand' },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A II (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Part II.', scriptLine: '"Okay, now let\'s do Part II."' },
        { id: 'step-2', instruction: 'Read the instructions and ask if they\'re clear.' },
        { id: 'step-3', instruction: 'Have the student use some of the vocabulary to answer the question.', tipText: 'The student doesn\'t have to use complete sentences. We just want to test their understanding of the vocabulary.' },
        { id: 'step-4', instruction: 'Transition to the next part.', scriptLine: '"Good job! Let\'s go to the next part!"' },
      ],
    },
    // Section 2c - STEP C (Pronunciation)
    {
      id: 'reading-section-2c',
      sectionNumber: 2,
      sectionTitle: '',
      sectionType: 'pronunciation',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP C',
      instructionEn: 'III. Practice reading the words.',
      instructionJp: '単語を読む練習をしましょう。',
      pronunciationColumns: [
        {
          id: 'col-1',
          soundLabel: '/iː/',
          image: '',
          words: [
            { id: 'w1', wordEn: 'meet', wordJp: '会う' },
            { id: 'w2', wordEn: 'read', wordJp: '読む' },
            { id: 'w3', wordEn: 'please', wordJp: 'お願いします' },
          ],
        },
        {
          id: 'col-2',
          soundLabel: '/ɪ/',
          image: '',
          words: [
            { id: 'w4', wordEn: 'mit', wordJp: 'ミット' },
            { id: 'w5', wordEn: 'rid', wordJp: '取り除く' },
            { id: 'w6', wordEn: 'fill', wordJp: '満たす' },
          ],
        },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP A III (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Part III.', scriptLine: '"Okay, now let\'s do Part III."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Introduce the pronunciation point.', scriptLine: '"Today, we\'re going to practice /iː/ (the ee in meet) and /ɪ/ (the i in mit)."' },
        { id: 'step-4', instruction: 'Demonstrate the sound on the left and have the student repeat.' },
        { id: 'step-5', instruction: 'Read the words on the left one by one. Have the student repeat after each one.' },
        { id: 'step-6', instruction: 'Repeat Steps 4-5 with the sound and words on the right.' },
        { id: 'step-7', instruction: 'Read the left-right pairs of words. Have the student repeat after each pair.', scriptLine: '"Now let\'s compare the two sets of words. Repeat after me."' },
        { id: 'step-8', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is the difference between the two sounds clear?"' },
        { id: 'step-9', instruction: 'Transition to the next step.', scriptLine: '"Fantastic! Let\'s go to the next step!"' },
      ],
    },
    // Section 2d - STEP D (Grammar Tip)
    {
      id: 'reading-section-2d',
      sectionNumber: 2,
      sectionTitle: '',
      sectionType: 'grammar',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'STEP D GRAMMAR TIP',
      instructionEn: 'Use what time to ask about specific times.',
      instructionJp: 'what timeを使って、特定の時間を聞くことができます。',
      grammarRules: [
        {
          id: 'rule-1',
          ruleEn: 'Use what time to ask about when something happens.',
          ruleJp: 'what timeは何かが起こる時間について質問するときに使います。',
          examples: [
            { id: 'ex-1', sentenceEn: 'What time should we meet?', sentenceJp: '何時に会いましょうか？', boldWords: ['What', 'time'] },
            { id: 'ex-2', sentenceEn: 'What time does it open?', sentenceJp: '何時に開きますか？', boldWords: ['What', 'time'] },
          ],
        },
        {
          id: 'rule-2',
          ruleEn: 'Use at + time to answer questions about time.',
          ruleJp: 'at + 時間を使って、時間についての質問に答えます。',
          examples: [
            { id: 'ex-3', sentenceEn: 'Let\'s meet at 7 o\'clock.', sentenceJp: '7時に会いましょう。', boldWords: ['at', '7 o\'clock'] },
          ],
        },
      ],
      sidebarTitle: 'LEARN',
      sidebarSubtitle: 'STEP B (1 minute)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Step B Grammar Tip.', scriptLine: '"Okay, now let\'s do Step B Grammar Tip."' },
        { id: 'step-2', instruction: 'Read the bold grammar tip.' },
        { id: 'step-3', instruction: 'Read the unbolded explanation part(s). Have the student read the example sentences.' },
        { id: 'step-4', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is it clear?"' },
        { id: 'step-5', instruction: 'Transition to the next section.', scriptLine: '"Very good! Let\'s go to the next section!"' },
      ],
    },
    // Section 3 - UNDERSTAND (READING)
    {
      id: 'reading-section-3',
      sectionNumber: 3,
      sectionTitle: 'UNDERSTAND',
      sectionType: 'reading',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'READING',
      instructionEn: 'It\'s Sunday morning. Saori and Masa are texting each other.',
      instructionJp: '日曜の朝です。サオリはマサとメールのやり取りをしています。',
      readingImage: '',
      readingDialogueLines: [
        { id: 'line-1', speaker: 'Saori', lineEn: 'Hi, Masa. Sorry, I can\'t meet up tonight. I have plans with Catherine.' },
        { id: 'line-2', speaker: 'Masa', lineEn: 'Okay. Do you want to have dinner together after school tomorrow? There\'s a new ramen restaurant near our school. It\'s called Kame Ramen.' },
        { id: 'line-3', speaker: 'Saori', lineEn: 'Kame Ramen? lol Sure. Can Catherine come with us?' },
        { id: 'line-4', speaker: 'Masa', lineEn: 'No problem.' },
        { id: 'line-5', speaker: 'Saori', lineEn: 'Great! What time should we meet her?', underlineWords: ['What time'] },
        { id: 'line-6', speaker: 'Masa', lineEn: 'I think Kame Ramen opens at 6 p.m. Let\'s meet her there at 7 o\'clock.', underlineWords: ['6 p.m.', '7 o\'clock'] },
        { id: 'line-7', speaker: 'Saori', lineEn: 'All right. I\'ll tell her that.' },
      ],
      sidebarTitle: 'UNDERSTAND',
      sidebarSubtitle: 'READING (3 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Understand.', scriptLines: ['"Okay, now let\'s do Understand."', '"First we have a reading activity."'] },
        { id: 'step-2', instruction: 'Set up the story.', scriptLine: '"Do you remember Saori and Masa from before?"', tipText: 'If the student doesn\'t remember the characters, say that they are coworkers.' },
        { id: 'step-3', instruction: 'Read the situation.' },
        { id: 'step-4', instruction: 'Set up the reading.', scriptLine: '"Let\'s read the text messages."' },
        { id: 'step-5', instruction: 'Have the student read the reading text aloud.' },
        { id: 'step-6', instruction: 'After they finish reading, correct their pronunciation mistakes.', tipText: 'Limit this to 2-3 corrections.', tipText2: 'If the student made a lot of mistakes, focus on the biggest ones.' },
        { id: 'step-7', instruction: 'Ask the questions below.' },
        { id: 'step-8', instruction: 'Transition to the next part.', scriptLine: '"Great! Let\'s go to the next part!"' },
      ],
      readingQuestions: [
        { id: 'rq-1', questionEn: 'What time does Kame Ramen open?', answer: '(It opens at 6 p.m.)' },
        { id: 'rq-2', questionEn: 'Do you like to try new restaurants?', answer: '(student\'s own answer)' },
      ],
    },
    // Section 4 - PRACTICE
    {
      id: 'reading-section-4',
      sectionNumber: 4,
      sectionTitle: 'TRY IT',
      sectionType: 'practice',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      stepTitle: 'COMPREHENSION CHECK',
      instructionEn: 'Answer the questions based on what you read.',
      instructionJp: '読んだ内容に基づいて質問に答えましょう。',
      practiceItems: [
        { id: 'q-1', questionEn: 'Why can\'t Saori meet up tonight?', questionJp: 'なぜサオリは今夜会えないのですか？', answer: 'She has plans with Catherine.' },
        { id: 'q-2', questionEn: 'What is the name of the new restaurant?', questionJp: '新しいレストランの名前は何ですか？', answer: 'Kame Ramen' },
        { id: 'q-3', questionEn: 'What time will they meet?', questionJp: '彼らは何時に会いますか？', answer: '7 o\'clock' },
      ],
      sidebarTitle: 'TRY IT',
      sidebarSubtitle: 'COMPREHENSION (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Have the student answer the comprehension questions.' },
        { id: 'step-2', instruction: 'Check their answers and provide feedback.' },
        { id: 'step-3', instruction: 'Transition to the next section.', scriptLine: '"Excellent! Let\'s move to the challenge!"' },
      ],
    },
    // Section 5 - CHALLENGE 1
    {
      id: 'reading-section-5',
      sectionNumber: 5,
      sectionTitle: 'CHALLENGE',
      sectionType: 'challenge',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      challengeTitle: 'Challenge 1',
      situationEn: 'You received a text message from a friend.\n\nRead the message and answer your friend\'s questions.',
      situationJp: '友達からテキストメッセージを受け取りました。\n\nメッセージを読んで、友達の質問に答えましょう。',
      instructionEn: '',
      instructionJp: '',
      grammarTipTitle: 'Reading tips',
      grammarTipItems: ['times', 'places', 'names', 'questions', 'plans'],
      practiceImage: '',
      challengeQuestions: [
        { id: 'cq-1', question: 'What does your friend want to do?' },
        { id: 'cq-2', question: 'When does your friend want to meet?', subQuestions: ['(Ask if they understood the time.)'] },
        { id: 'cq-3', question: 'Where does your friend suggest meeting?', subQuestions: ['(If they\'re not sure, have them re-read.)', '(Point out key words if needed.)'] },
        { id: 'cq-4', question: 'How will you respond to your friend?', subQuestions: ['(Help them compose a reply.)', 'What time works for you?', 'Do you have any questions?'] },
      ],
      sidebarTitle: 'CHALLENGE',
      sidebarSubtitle: 'CHALLENGE 1 (5-6 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Challenge 1.', scriptLine: '"Okay, now let\'s do the Challenge."' },
        { id: 'step-2', instruction: '', scriptLine: '"First we have Challenge 1."' },
        { id: 'step-3', instruction: 'Read the situation.' },
        { id: 'step-4', instruction: 'Confirm the student\'s understanding.', scriptLine: '"Is it clear?"' },
        { id: 'step-5', instruction: 'Set up the reading task.', scriptLine: '"Now, read the text message."' },
        { id: 'step-6', instruction: '', scriptLine: '"Please read carefully."' },
        { id: 'step-7', instruction: '', scriptLine: '"Remember today\'s reading tips."' },
        { id: 'step-8', instruction: '', scriptLine: '"Is it clear?"' },
        { id: 'step-9', instruction: '', scriptLine: '"Please start."' },
        { id: 'step-10', instruction: 'Have them read and ask comprehension questions.', tipText: 'Use the questions below only as guides. Ask other questions based on the student\'s responses.' },
        { id: 'step-11', instruction: '', tipText: 'Help with difficult words if needed.' },
        { id: 'step-12', instruction: '', tipText: 'Adjust the difficulty according to the student\'s level.' },
        { id: 'step-13', instruction: 'Transition to the next part.', scriptLine: '"Well done! Let\'s go to Challenge 2!"' },
      ],
    },
    // Section 5b - CHALLENGE 2 (If Time Allows)
    {
      id: 'reading-section-6',
      sectionNumber: 5,
      sectionTitle: '',
      sectionType: 'challenge2',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      challengeTitle: 'Challenge 2',
      isOptional: true,
      instructionEn: 'Discuss your ideas.',
      instructionJp: 'あなたの意見を言いましょう。',
      topicBoxes: [
        {
          id: 'topic-1',
          topicNumber: 1,
          topicTitle: 'READING IN DAILY LIFE',
          questions: [
            { id: 'tq-1', question: 'What kind of text messages do you often receive?' },
            { id: 'tq-2', question: 'Do you prefer reading text messages or talking on the phone?' },
            { id: 'tq-3', question: 'How do you practice your reading skills?' },
            { id: 'tq-4', question: 'What English texts do you like to read (ex. books, news, social media)?' },
          ],
        },
        {
          id: 'topic-2',
          topicNumber: 2,
          topicTitle: 'MAKING PLANS',
          questions: [
            { id: 'tq-5', question: 'Do you usually make plans through text or in person?' },
            { id: 'tq-6', question: 'Have you ever had a misunderstanding because of a text message?' },
            { id: 'tq-7', question: 'What information is important when making plans?' },
            { id: 'tq-8', question: 'Do you use any abbreviations or emojis when texting?' },
          ],
        },
      ],
      sidebarTitle: 'CHALLENGE',
      sidebarSubtitle: 'CHALLENGE 2 (2-3 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Challenge 2.', scriptLine: '"Okay, now let\'s do Challenge 2."' },
        { id: 'step-2', instruction: 'Read the instructions.' },
        { id: 'step-3', instruction: 'Read the topics and ask the student to choose one.', tipText: 'If the student cannot decide, choose a topic for them.' },
        { id: 'step-4', instruction: 'Ask the questions for that topic, adding follow-up questions and comments to make the conversation natural.', tipText: 'Continue as time allows. You do not have to ask all the questions.' },
        { id: 'step-5', instruction: 'Transition to the last section.', scriptLine: '"Well done! Let\'s go to the last section!"' },
      ],
    },
    // Section 6: FEEDBACK
    {
      id: 'reading-section-7',
      sectionNumber: 6,
      sectionTitle: 'FEEDBACK',
      sectionType: 'feedback',
      explanationEn: '',
      explanationJp: '',
      sectionImage: '',
      importantNote: '',
      copyTemplate: '',
      feedbackRubric: [
        { score: 4, label: 'Very Good', description: 'Could complete the task with ease' },
        { score: 3, label: 'Good', description: 'Could complete the task with some clarifications' },
        { score: 2, label: 'Fair', description: 'Could complete the task with additional instructions' },
        { score: 1, label: 'Poor', description: 'Could somehow complete the task with difficulty' },
      ],
      feedbackCategories: [
        { id: 'fc-1', title: 'COMPREHENSION', titleJp: '理解力', descJp: '読んだ内容をどの程度理解できているか' },
        { id: 'fc-2', title: 'PRONUNCIATION', titleJp: '発音', descJp: '正確に読み上げることができるか' },
        { id: 'fc-3', title: 'RESPONSE', titleJp: '応答', descJp: '質問に適切に答えられるかどうか' },
      ],
      feedbackGuide: [
        {
          id: 'fg-1',
          category: 'COMPREHENSION',
          categoryJp: '',
          categoryDesc: 'the ability to understand the main idea and details',
          focusOn: '<strong>key information</strong> the student <strong>understood</strong>\n+\n<strong>parts</strong> they <strong>missed</strong>',
          exampleFeedback: 'You correctly understood:\n• The meeting time\n• The restaurant name\n\nYou missed:\n• Why Saori can\'t meet tonight\n\nTip: Look for key words like "because" or "sorry" for reasons.',
        },
        {
          id: 'fg-2',
          category: 'PRONUNCIATION',
          categoryJp: '',
          categoryDesc: 'the ability to read aloud correctly',
          focusOn: '<strong>words read correctly</strong>\n+\n<strong>words mispronounced</strong>',
          exampleFeedback: 'You read: "res-tau-RANT"\nCorrect: "RES-tuh-rahnt"\n\nYou read: "to-MOR-row"\nCorrect: "tuh-MOR-oh"\n\nTip: Practice reading aloud regularly to improve pronunciation.',
        },
        {
          id: 'fg-3',
          category: 'RESPONSE',
          categoryJp: '',
          categoryDesc: 'the ability to respond appropriately to questions',
          focusOn: '<strong>complete answers</strong>\n+\n<strong>incomplete or unclear</strong> responses',
          exampleFeedback: 'You answered: "7 clock."\nBetter: "They will meet at <strong>7 O\'CLOCK</strong>."\n\nYou answered: "Yes."\nBetter: "Yes, <strong>THE RESTAURANT IS CALLED</strong> Kame Ramen."',
        },
      ],
      feedbackTemplate: '*Lesson Goal Achievement SCORE*\n4 / 3 / 2 / 1\n\n*Personalized FEEDBACK*\n\n*COMPREHENSION*\nYou understood:\nYou missed:\n\n*PRONUNCIATION*\nYou read:\nCorrect:\n\n*RESPONSE*\nYou answered:\nBetter:',
      sidebarTitle: 'FEEDBACK',
      sidebarSubtitle: 'FEEDBACK (2 minutes)',
      lessonGoalTitle: '',
      lessonGoalSteps: [
        { id: 'step-1', instruction: 'Introduce Feedback.', scriptLine: '"Okay, now let\'s do Feedback."' },
        { id: 'step-2', instruction: 'Have the student read the lesson goal.' },
        { id: 'step-3', instruction: 'Ask if they achieved the lesson goal.', scriptLine: '"Did you achieve the lesson goal?"' },
        { id: 'step-4', instruction: 'Give the student a score for their lesson goal achievement using the rubric.', tipText: 'Base your score on how well they did Challenge 1.' },
        { id: 'step-5', instruction: 'Give feedback on the student\'s comprehension, pronunciation, and response using the template below.', tipText: 'Refer to the Personalized Feedback Guide for more information.' },
        { id: 'step-6', instruction: 'Wrap up the lesson.', scriptLine: '"You did a great job! Thank you very much for today."' },
      ],
    },
  ],
  vocabulary: [],
  grammar: [],
  exercises: [],
});

// Helper function to get the appropriate draft based on template
const getDraftForTemplate = (templateId: string): LessonMaterialDraft => {
  if (templateId === 'conversational-skills-listening') {
    return createListeningDraft();
  }
  if (templateId === 'conversational-skills-reading') {
    return createReadingDraft();
  }
  return createBlankDraft();
};

export default function LessonMaterialMakerPage() {
  const [draft, setDraft] = useState<LessonMaterialDraft>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createBlankDraft();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 2) return createBlankDraft();
      // Merge with defaults to ensure all fields exist (handles old drafts)
      const blank = createBlankDraft();
      
      // Get existing sections or use blank
      let sections = Array.isArray(parsed.sections) ? parsed.sections : blank.sections;
      
      // Migration: Add sectionType to existing sections if missing
      sections = sections.map((section: SectionContent, index: number) => ({
        ...section,
        sectionType: section.sectionType || 'introduce',
      }));
      
      // Migration: Add Section 2 (vocabulary) if only 1 section exists
      if (sections.length === 1 && !sections.find((s: SectionContent) => s.sectionType === 'vocabulary')) {
        sections.push(blank.sections[1]); // Add the vocabulary section from blank template
      }
      
      // Migration: Add Section 3 (question/STEP B) if only 2 sections exist
      if (sections.length === 2 && !sections.find((s: SectionContent) => s.sectionType === 'question')) {
        sections.push(blank.sections[2]); // Add the question section from blank template
      }
      
      // Migration: Add Section 4 (pronunciation/STEP C) if only 3 sections exist
      if (sections.length === 3 && !sections.find((s: SectionContent) => s.sectionType === 'pronunciation')) {
        sections.push(blank.sections[3]); // Add the pronunciation section from blank template
      }
      
      // Migration: Add Section 5 (grammar/STEP D) if only 4 sections exist
      if (sections.length === 4 && !sections.find((s: SectionContent) => s.sectionType === 'grammar')) {
        sections.push(blank.sections[4]); // Add the grammar section from blank template
      }
      
      // Migration: Add Section 6 (dialogue/APPLY) if only 5 sections exist
      if (sections.length === 5 && !sections.find((s: SectionContent) => s.sectionType === 'dialogue')) {
        sections.push(blank.sections[5]); // Add the dialogue section from blank template
      }
      
      // Migration: Add Section 7 (trivia/APPLY) if only 6 sections exist
      if (sections.length === 6 && !sections.find((s: SectionContent) => s.sectionType === 'trivia')) {
        sections.push(blank.sections[6]); // Add the trivia section from blank template
      }
      
      // Migration: Add Section 8 (practice/PRACTICE) if only 7 sections exist
      if (sections.length === 7 && !sections.find((s: SectionContent) => s.sectionType === 'practice')) {
        sections.push(blank.sections[7]); // Add the practice section from blank template
      }
      
      // Migration: Add Section 9 (practice Step B) if only 8 sections exist
      if (sections.length === 8) {
        // Check if the 9th section (Step B) is missing
        const hasStepB = sections.some((s: SectionContent) => 
          s.sectionType === 'practice' && s.stepTitle?.includes('STEP B')
        );
        if (!hasStepB) {
          sections.push(blank.sections[8]); // Add the practice Step B section from blank template
        }
      }
      
      // Migration: Add Section 10 (challenge 1) if only 9 sections exist
      if (sections.length === 9 && !sections.find((s: SectionContent) => s.sectionType === 'challenge')) {
        sections.push(blank.sections[9]); // Add the challenge 1 section from blank template
      }
      
      // Migration: Add Section 11 (challenge 2) if only 10 sections exist
      if (sections.length === 10 && !sections.find((s: SectionContent) => s.sectionType === 'challenge2')) {
        sections.push(blank.sections[10]); // Add the challenge 2 section from blank template
      }
      
      // Migration: Add Section 12 (feedback) if only 11 sections exist
      if (sections.length === 11 && !sections.find((s: SectionContent) => s.sectionType === 'feedback')) {
        sections.push(blank.sections[11]); // Add the feedback section from blank template
      }
      
      // Migration: Add missing vocab cards to vocabulary section (expand from 4 to 8)
      sections = sections.map((section: SectionContent) => {
        if (section.sectionType === 'vocabulary' && section.vocabCards && section.vocabCards.length === 4) {
          const blankVocabSection = blank.sections.find((s: SectionContent) => s.sectionType === 'vocabulary');
          if (blankVocabSection?.vocabCards && blankVocabSection.vocabCards.length > 4) {
            return {
              ...section,
              vocabCards: [
                ...section.vocabCards,
                ...blankVocabSection.vocabCards.slice(4) // Add vocab cards 5-8
              ]
            };
          }
        }
        return section;
      });
      
      return {
        ...blank,
        ...parsed,
        header: { ...blank.header, ...parsed.header },
        sections,
        vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
        grammar: Array.isArray(parsed.grammar) ? parsed.grammar : [],
        exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
      };
    } catch {
      return createBlankDraft();
    }
  });

  const [showHeaderControls, setShowHeaderControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => {
    // If we're restoring an editing session, start in fullscreen
    try {
      const editingId = localStorage.getItem(EDITING_LESSON_KEY);
      return !!editingId;
    } catch {
      return false;
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedLessonUrl, setSavedLessonUrl] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false); // Read-only preview mode
  const [materialViewMode, setMaterialViewMode] = useState<'tutor' | 'student'>('tutor'); // Tutor view (with hints) or Student view (without hints)
  const [activeTab, setActiveTab] = useState<'templates' | 'myLessons'>('templates');
  const [showNewLessonModal, setShowNewLessonModal] = useState(false);
  const [selectedTemplateForLesson, setSelectedTemplateForLesson] = useState<TemplateInfo | null>(null);
  const [newLessonForm, setNewLessonForm] = useState<NewLessonFormData>({
    level: 1,
    chapter: 1,
    lessonNumber: 1,
    goalName: '',
  });
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>(() => {
    try {
      const stored = localStorage.getItem(SAVED_LESSONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  // Restore currentEditingLesson from localStorage if it exists
  const [currentEditingLesson, setCurrentEditingLesson] = useState<SavedLesson | null>(() => {
    try {
      const editingId = localStorage.getItem(EDITING_LESSON_KEY);
      if (!editingId) return null;
      const stored = localStorage.getItem(SAVED_LESSONS_KEY);
      const lessons: SavedLesson[] = stored ? JSON.parse(stored) : [];
      return lessons.find(l => l.id === editingId) || null;
    } catch {
      return null;
    }
  });
  // viewMode should be 'editor' if there's a currentEditingLesson restored
  const [viewMode, setViewMode] = useState<'list' | 'editor'>(() => {
    try {
      const editingId = localStorage.getItem(EDITING_LESSON_KEY);
      return editingId ? 'editor' : 'list';
    } catch {
      return 'list';
    }
  });
  const [expandedLevels, setExpandedLevels] = useState<number[]>([1]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCourses, setExpandedCourses] = useState<string[]>(['Conversational Skills']); // Default expanded
  
  // Version history state
  const [versionHistory, setVersionHistory] = useState<Record<string, LessonVersionHistory>>(() => {
    try {
      const stored = localStorage.getItem(VERSION_HISTORY_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedVersionToPreview, setSelectedVersionToPreview] = useState<VersionHistoryEntry | null>(null);
  const [expandedVersionChanges, setExpandedVersionChanges] = useState<Set<string>>(new Set());

  // Scroll to a section by index or id
  const scrollToSection = useCallback((sectionIndex?: number, sectionId?: string) => {
    // Close the version history panel first
    setShowVersionHistory(false);
    
    // Small delay to let the panel close
    setTimeout(() => {
      let targetElement: Element | null = null;
      
      if (sectionId === 'lm-header') {
        // Scroll to header
        targetElement = document.querySelector('.lm-header');
      } else if (sectionId) {
        // Find section by ID
        const sections = document.querySelectorAll('.lm-section');
        const sectionElements = Array.from(sections);
        const sectionData = draft.sections.find(s => s.id === sectionId);
        if (sectionData) {
          const idx = draft.sections.indexOf(sectionData);
          targetElement = sectionElements[idx];
        }
      } else if (typeof sectionIndex === 'number') {
        // Find section by index
        const sections = document.querySelectorAll('.lm-section');
        targetElement = sections[sectionIndex];
      }
      
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add highlight effect
        targetElement.classList.add('lm-section-highlight');
        setTimeout(() => {
          targetElement?.classList.remove('lm-section-highlight');
        }, 2000);
      }
    }, 300);
  }, [draft.sections]);
  
  // Server-side lessons state (fork/merge system)
  const [serverLessons, setServerLessons] = useState<Lesson[]>([]);
  const [pendingMergeRequests, setPendingMergeRequests] = useState<MergeRequest[]>([]);
  const [isLoadingServerLessons, setIsLoadingServerLessons] = useState(false);
  const [showMergeRequestModal, setShowMergeRequestModal] = useState(false);
  const [showMergeReviewModal, setShowMergeReviewModal] = useState(false);
  const [selectedMergeRequest, setSelectedMergeRequest] = useState<MergeRequest | null>(null);
  const [mergeRequestForm, setMergeRequestForm] = useState({ title: '', description: '' });
  const [lessonToFork, setLessonToFork] = useState<SavedLesson | null>(null);
  const [showForkConfirmModal, setShowForkConfirmModal] = useState(false);
  
  // Analytics panel state
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  // === IMPROVEMENT STATES ===
  // Diff viewer
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [diffSource, setDiffSource] = useState<LessonMaterial | null>(null);
  const [diffTarget, setDiffTarget] = useState<LessonMaterial | null>(null);
  
  // Version restore
  const [showVersionRestoreModal, setShowVersionRestoreModal] = useState(false);
  const [lessonVersions, setLessonVersions] = useState<LessonVersion[]>([]);
  const [versionToRestore, setVersionToRestore] = useState<LessonVersion | null>(null);
  
  // Advanced search/filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'finished' | 'published' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  
  // Bulk actions
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [showBulkActionsBar, setShowBulkActionsBar] = useState(false);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  
  // Merge request comments
  const [mergeRequestComments, setMergeRequestComments] = useState<MergeRequestComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  
  // Fork management
  const [showForksPanel, setShowForksPanel] = useState(false);
  const [lessonForks, setLessonForks] = useState<Lesson[]>([]);
  const [selectedLessonForForks, setSelectedLessonForForks] = useState<string | null>(null);
  
  // Export functionality
  const { exportLessonData, print } = useExport();
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Collaborative editing state
  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ user: string; section: string; action: string; time: Date }[]>([]);
  const [showCollaboratorsBadge, setShowCollaboratorsBadge] = useState(true);
  
  // Get current editing lesson ID for socket
  const currentLessonId = currentEditingLesson?.serverLesson?.id || null;
  
  // Socket hook for collaborative editing
  const {
    isConnected: isSocketConnected,
    activeEditors: socketEditors,
    startEditing,
    stopEditing,
    sendActivity,
    notifySaved
  } = useLessonSocket({
    lessonId: currentLessonId,
    onEditorsChange: (editors) => {
      setActiveEditors(editors);
    },
    onEditorJoined: (editor) => {
      setRecentActivity(prev => [{
        user: editor.userName,
        section: 'lesson',
        action: 'joined',
        time: new Date()
      }, ...prev.slice(0, 9)]);
    },
    onEditorLeft: (editor) => {
      setRecentActivity(prev => [{
        user: editor.userName,
        section: 'lesson',
        action: 'left',
        time: new Date()
      }, ...prev.slice(0, 9)]);
    },
    onActivity: (activity) => {
      setRecentActivity(prev => [{
        user: activity.userName,
        section: activity.section,
        action: activity.action,
        time: new Date(activity.timestamp)
      }, ...prev.slice(0, 9)]);
    },
    onLessonUpdated: (update) => {
      setRecentActivity(prev => [{
        user: update.savedByName,
        section: 'lesson',
        action: 'saved',
        time: new Date(update.timestamp)
      }, ...prev.slice(0, 9)]);
      // Reload the lesson if someone else saved
      if (update.savedBy !== 'current-user') { // TODO: get current user ID
        loadServerLessons();
      }
    }
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const previousDraftRef = useRef<LessonMaterialDraft | null>(null);
  const lastSavedContentRef = useRef<string>(''); // Track last saved content to prevent duplicate saves

  useEffect(() => {
    document.title = 'Lesson Material Maker | FluentXVerse Admin';
  }, []);

  // Warn user before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && viewMode === 'editor') {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, viewMode]);

  // Track unsaved changes by comparing current draft with last saved content
  useEffect(() => {
    if (!currentEditingLesson || viewMode !== 'editor') {
      setHasUnsavedChanges(false);
      return;
    }
    const currentContent = JSON.stringify(draft);
    const hasChanges = lastSavedContentRef.current !== '' && currentContent !== lastSavedContentRef.current;
    setHasUnsavedChanges(hasChanges);
  }, [draft, currentEditingLesson, viewMode]);

  // Handle browser back/forward button navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state?.viewMode === 'editor') {
        // Restore editor view from history state
        if (state.templateId) {
          const template = TEMPLATES.flatMap(c => c.templates).find(t => t.id === state.templateId);
          if (template) {
            setSelectedTemplate(template);
            setDraft(getDraftForTemplate(template.id));
          }
        }
        if (state.lessonId) {
          const lesson = savedLessons.find(l => l.id === state.lessonId);
          if (lesson) {
            setCurrentEditingLesson(lesson);
            setDraft(lesson.draft);
          }
        }
        setViewMode('editor');
        setIsFullscreen(true);
      } else {
        // Default to list view
        setViewMode('list');
        setCurrentEditingLesson(null);
        setSelectedTemplate(null);
        setIsFullscreen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Set initial history state if not already set
    if (!window.history.state?.viewMode) {
      window.history.replaceState({ viewMode: 'list' }, '', window.location.href);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [savedLessons]);

  // Toggle fullscreen mode - hide/show dashboard layout
  useEffect(() => {
    const dashboardLayout = document.querySelector('.dashboard-layout');
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.dashboard-header');
    
    if (isFullscreen) {
      document.body.classList.add('lm-fullscreen-mode');
      dashboardLayout?.classList.add('lm-fullscreen-active');
      sidebar?.classList.add('lm-hidden');
      header?.classList.add('lm-hidden');
    } else {
      document.body.classList.remove('lm-fullscreen-mode');
      dashboardLayout?.classList.remove('lm-fullscreen-active');
      sidebar?.classList.remove('lm-hidden');
      header?.classList.remove('lm-hidden');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('lm-fullscreen-mode');
      dashboardLayout?.classList.remove('lm-fullscreen-active');
      sidebar?.classList.remove('lm-hidden');
      header?.classList.remove('lm-hidden');
    };
  }, [isFullscreen]);

  // Handle collaborative editing - notify when entering/leaving editor
  useEffect(() => {
    if (viewMode === 'editor' && currentLessonId) {
      startEditing();
      return () => {
        stopEditing();
      };
    }
  }, [viewMode, currentLessonId, startEditing, stopEditing]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  // On initial load, if editing a lesson with serverLesson, fetch latest from server
  useEffect(() => {
    const fetchServerContent = async () => {
      if (currentEditingLesson?.serverLesson?.id && viewMode === 'editor') {
        console.log('[Init] Fetching lesson content from server:', currentEditingLesson.serverLesson.id);
        try {
          const response = await lessonApi.getLesson(currentEditingLesson.serverLesson.id);
          if (response.success && response.lessonData) {
            console.log('[Init] Loaded server content successfully');
            // Use ALL data from server, including sections with image URLs
            const serverDraft: LessonMaterialDraft = {
              version: 2,
              header: response.lessonData.header,
              sections: (response.lessonData as any).sections || currentEditingLesson.draft.sections,
              vocabulary: response.lessonData.vocabulary || [],
              grammar: response.lessonData.grammar || [],
              exercises: response.lessonData.exercises || []
            };
            setDraft(serverDraft);
            lastSavedContentRef.current = JSON.stringify(serverDraft);
            // Update savedLessons cache
            setSavedLessons(prev =>
              prev.map(l =>
                l.id === currentEditingLesson.id ? { ...l, draft: serverDraft } : l
              )
            );
          }
        } catch (err) {
          console.error('[Init] Error fetching server content:', err);
        }
      }
    };
    fetchServerContent();
  }, []); // Only run once on mount

  // Save lessons to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_LESSONS_KEY, JSON.stringify(savedLessons));
    } catch {
      // ignore
    }
  }, [savedLessons]);

  // Save version history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(versionHistory));
    } catch {
      // ignore
    }
  }, [versionHistory]);

  // Detect changes and describe them for version history
  const getChangeDescription = useCallback((oldDraft: LessonMaterialDraft | null, newDraft: LessonMaterialDraft): string => {
    if (!oldDraft) return 'Initial version';
    
    const changes: string[] = [];
    
    // Check header changes
    if (oldDraft.header.goalText !== newDraft.header.goalText) {
      changes.push('Updated lesson goal');
    }
    if (oldDraft.header.lessonLabel !== newDraft.header.lessonLabel) {
      changes.push('Changed lesson label');
    }
    if (oldDraft.header.chapterLabel !== newDraft.header.chapterLabel) {
      changes.push('Changed chapter label');
    }
    if (oldDraft.header.backgroundImage !== newDraft.header.backgroundImage) {
      changes.push('Updated header image');
    }
    
    // Check section changes
    const oldSectionCount = oldDraft.sections.length;
    const newSectionCount = newDraft.sections.length;
    if (newSectionCount > oldSectionCount) {
      changes.push(`Added ${newSectionCount - oldSectionCount} section(s)`);
    } else if (newSectionCount < oldSectionCount) {
      changes.push(`Removed ${oldSectionCount - newSectionCount} section(s)`);
    } else {
      // Check if sections content changed
      let sectionsModified = 0;
      for (let i = 0; i < newDraft.sections.length; i++) {
        if (JSON.stringify(oldDraft.sections[i]) !== JSON.stringify(newDraft.sections[i])) {
          sectionsModified++;
        }
      }
      if (sectionsModified > 0) {
        changes.push(`Modified ${sectionsModified} section(s)`);
      }
    }
    
    // Check vocabulary changes
    if (JSON.stringify(oldDraft.vocabulary) !== JSON.stringify(newDraft.vocabulary)) {
      changes.push('Updated vocabulary');
    }
    
    // Check grammar changes
    if (JSON.stringify(oldDraft.grammar) !== JSON.stringify(newDraft.grammar)) {
      changes.push('Updated grammar points');
    }
    
    // Check exercises changes
    if (JSON.stringify(oldDraft.exercises) !== JSON.stringify(newDraft.exercises)) {
      changes.push('Updated exercises');
    }
    
    return changes.length > 0 ? changes.join(', ') : 'Minor changes';
  }, []);

  // Save a version to history
  const saveVersionToHistory = useCallback((lessonId: string, snapshot: LessonMaterialDraft, description: string, isAutoSave: boolean = false) => {
    setVersionHistory(prev => {
      const lessonHistory = prev[lessonId] || { lessonId, versions: [], maxVersions: 50 };
      const nextVersion = lessonHistory.versions.length > 0 
        ? Math.max(...lessonHistory.versions.map(v => v.version)) + 1 
        : 1;
      
      const newEntry: VersionHistoryEntry = {
        id: `v-${lessonId}-${Date.now()}`,
        lessonId,
        version: nextVersion,
        snapshot: JSON.parse(JSON.stringify(snapshot)), // Deep clone
        timestamp: new Date().toISOString(),
        changeDescription: description,
        autoSave: isAutoSave,
      };
      
      // Keep only the last N versions
      const updatedVersions = [...lessonHistory.versions, newEntry].slice(-lessonHistory.maxVersions);
      
      return {
        ...prev,
        [lessonId]: {
          ...lessonHistory,
          versions: updatedVersions,
        },
      };
    });
  }, []);

  // Rollback to a specific version
  const rollbackToVersion = useCallback((entry: VersionHistoryEntry) => {
    if (!currentEditingLesson) return;
    
    // Save current state as a new version before rollback
    saveVersionToHistory(
      currentEditingLesson.id, 
      draft, 
      `State before rollback to v${entry.version}`,
      false
    );
    
    // Apply the rollback
    setDraft(JSON.parse(JSON.stringify(entry.snapshot)));
    setSelectedVersionToPreview(null);
    setShowVersionHistory(false);
  }, [currentEditingLesson, draft, saveVersionToHistory]);

  // Manual save version (user-triggered)
  const handleManualSaveVersion = useCallback((description?: string) => {
    if (!currentEditingLesson) return;
    
    const changeDesc = description || getChangeDescription(previousDraftRef.current, draft);
    saveVersionToHistory(currentEditingLesson.id, draft, changeDesc, false);
    previousDraftRef.current = JSON.parse(JSON.stringify(draft));
  }, [currentEditingLesson, draft, getChangeDescription, saveVersionToHistory]);

  // Server version history state
  const [serverVersions, setServerVersions] = useState<LessonVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Load version history from server when panel opens
  useEffect(() => {
    if (showVersionHistory && currentEditingLesson?.serverLesson?.id) {
      const loadVersions = async () => {
        setIsLoadingVersions(true);
        try {
          const result = await lessonApi.getVersionHistory(currentEditingLesson.serverLesson!.id);
          if (result.success && result.versions) {
            setServerVersions(result.versions);
          }
        } catch (err) {
          console.error('Failed to load version history:', err);
        } finally {
          setIsLoadingVersions(false);
        }
      };
      loadVersions();
    }
  }, [showVersionHistory, currentEditingLesson?.serverLesson?.id]);

  // Generate detailed changes list by comparing versions
  const generateDetailedChanges = useCallback((
    current: any,
    previous: any | null
  ): VersionChange[] => {
    if (!previous) {
      return [{
        id: 'initial',
        type: 'added',
        category: 'section',
        target: 'All Content',
        description: 'Initial version created'
      }];
    }

    const changes: VersionChange[] = [];
    let changeId = 0;

    // Compare header
    if (current.header?.goalText !== previous.header?.goalText) {
      changes.push({
        id: `change-${changeId++}`,
        type: 'modified',
        category: 'header',
        target: 'Lesson Goal',
        targetId: 'lm-header',
        description: 'Goal text updated',
        oldValue: previous.header?.goalText?.substring(0, 50),
        newValue: current.header?.goalText?.substring(0, 50)
      });
    }
    if (current.header?.lessonLabel !== previous.header?.lessonLabel) {
      changes.push({
        id: `change-${changeId++}`,
        type: 'modified',
        category: 'header',
        target: 'Lesson Title',
        targetId: 'lm-header',
        description: 'Lesson title changed',
        oldValue: previous.header?.lessonLabel,
        newValue: current.header?.lessonLabel
      });
    }
    if (current.header?.backgroundImage !== previous.header?.backgroundImage) {
      changes.push({
        id: `change-${changeId++}`,
        type: current.header?.backgroundImage ? 'modified' : 'removed',
        category: 'image',
        target: 'Header Background',
        targetId: 'lm-header',
        description: current.header?.backgroundImage ? 'Background image updated' : 'Background image removed'
      });
    }

    // Compare sections
    const currentSections = current.sections || [];
    const prevSections = previous.sections || [];
    const maxLen = Math.max(currentSections.length, prevSections.length);

    for (let i = 0; i < maxLen; i++) {
      const currSection = currentSections[i];
      const prevSection = prevSections[i];

      if (currSection && !prevSection) {
        // New section added
        changes.push({
          id: `change-${changeId++}`,
          type: 'added',
          category: 'section',
          target: `Section ${i + 1}: ${currSection.sectionTitle || currSection.sectionType || 'New'}`,
          targetId: currSection.id,
          sectionIndex: i,
          description: `Added new ${currSection.sectionType || 'section'} section`
        });
      } else if (!currSection && prevSection) {
        // Section removed
        changes.push({
          id: `change-${changeId++}`,
          type: 'removed',
          category: 'section',
          target: `Section ${i + 1}: ${prevSection.sectionTitle || prevSection.sectionType || 'Deleted'}`,
          sectionIndex: i,
          description: `Removed ${prevSection.sectionType || 'section'} section`
        });
      } else if (currSection && prevSection) {
        // Compare section content
        if (currSection.sectionTitle !== prevSection.sectionTitle) {
          changes.push({
            id: `change-${changeId++}`,
            type: 'modified',
            category: 'section',
            target: `Section ${i + 1} Title`,
            targetId: currSection.id,
            sectionIndex: i,
            description: 'Section title changed',
            oldValue: prevSection.sectionTitle,
            newValue: currSection.sectionTitle
          });
        }

        // Check section image
        if (currSection.sectionImage !== prevSection.sectionImage) {
          changes.push({
            id: `change-${changeId++}`,
            type: currSection.sectionImage ? (prevSection.sectionImage ? 'modified' : 'added') : 'removed',
            category: 'image',
            target: `Section ${i + 1} Image`,
            targetId: currSection.id,
            sectionIndex: i,
            description: currSection.sectionImage 
              ? (prevSection.sectionImage ? 'Image updated' : 'Image added')
              : 'Image removed'
          });
        }

        // Check vocab cards
        const currVocab = currSection.vocabCards || [];
        const prevVocab = prevSection.vocabCards || [];
        if (currVocab.length !== prevVocab.length) {
          changes.push({
            id: `change-${changeId++}`,
            type: currVocab.length > prevVocab.length ? 'added' : 'removed',
            category: 'vocabulary',
            target: `Section ${i + 1} Vocabulary`,
            targetId: currSection.id,
            sectionIndex: i,
            description: `Vocabulary cards: ${prevVocab.length} → ${currVocab.length}`
          });
        } else {
          // Check for vocab card image changes
          for (let v = 0; v < currVocab.length; v++) {
            if (currVocab[v]?.image !== prevVocab[v]?.image) {
              changes.push({
                id: `change-${changeId++}`,
                type: currVocab[v]?.image ? 'modified' : 'removed',
                category: 'image',
                target: `Section ${i + 1} Vocab Card ${v + 1}`,
                targetId: currSection.id,
                sectionIndex: i,
                description: currVocab[v]?.image ? 'Vocabulary image updated' : 'Vocabulary image removed'
              });
            }
          }
        }

        // Check dialogue lines
        const currDialogue = currSection.dialogueLines || [];
        const prevDialogue = prevSection.dialogueLines || [];
        if (JSON.stringify(currDialogue) !== JSON.stringify(prevDialogue)) {
          changes.push({
            id: `change-${changeId++}`,
            type: 'modified',
            category: 'section',
            target: `Section ${i + 1} Dialogue`,
            targetId: currSection.id,
            sectionIndex: i,
            description: `Dialogue content updated (${currDialogue.length} lines)`
          });
        }

        // Check grammar rules
        const currGrammar = currSection.grammarRules || [];
        const prevGrammar = prevSection.grammarRules || [];
        if (JSON.stringify(currGrammar) !== JSON.stringify(prevGrammar)) {
          changes.push({
            id: `change-${changeId++}`,
            type: 'modified',
            category: 'grammar',
            target: `Section ${i + 1} Grammar`,
            targetId: currSection.id,
            sectionIndex: i,
            description: `Grammar rules updated (${currGrammar.length} rules)`
          });
        }

        // Check lesson goal steps
        const currSteps = currSection.lessonGoalSteps || [];
        const prevSteps = prevSection.lessonGoalSteps || [];
        if (JSON.stringify(currSteps) !== JSON.stringify(prevSteps)) {
          changes.push({
            id: `change-${changeId++}`,
            type: 'modified',
            category: 'section',
            target: `Section ${i + 1} Lesson Steps`,
            targetId: currSection.id,
            sectionIndex: i,
            description: `Lesson goal steps updated (${currSteps.length} steps)`
          });
        }

        // Check practice items
        const currPractice = currSection.practiceItems || [];
        const prevPractice = prevSection.practiceItems || [];
        if (JSON.stringify(currPractice) !== JSON.stringify(prevPractice)) {
          changes.push({
            id: `change-${changeId++}`,
            type: 'modified',
            category: 'exercise',
            target: `Section ${i + 1} Practice`,
            targetId: currSection.id,
            sectionIndex: i,
            description: `Practice items updated (${currPractice.length} items)`
          });
        }
      }
    }

    // Compare top-level vocabulary
    const currentVocab = current.vocabulary || [];
    const prevVocab = previous.vocabulary || [];
    if (currentVocab.length !== prevVocab.length) {
      changes.push({
        id: `change-${changeId++}`,
        type: currentVocab.length > prevVocab.length ? 'added' : 'removed',
        category: 'vocabulary',
        target: 'Vocabulary List',
        description: `Vocabulary count: ${prevVocab.length} → ${currentVocab.length}`
      });
    }

    // Compare top-level grammar
    const currentGrammar = current.grammar || [];
    const prevGrammar = previous.grammar || [];
    if (currentGrammar.length !== prevGrammar.length) {
      changes.push({
        id: `change-${changeId++}`,
        type: currentGrammar.length > prevGrammar.length ? 'added' : 'removed',
        category: 'grammar',
        target: 'Grammar Points',
        description: `Grammar count: ${prevGrammar.length} → ${currentGrammar.length}`
      });
    }

    // Compare exercises
    const currentExercises = current.exercises || [];
    const prevExercises = previous.exercises || [];
    if (currentExercises.length !== prevExercises.length) {
      changes.push({
        id: `change-${changeId++}`,
        type: currentExercises.length > prevExercises.length ? 'added' : 'removed',
        category: 'exercise',
        target: 'Exercises',
        description: `Exercise count: ${prevExercises.length} → ${currentExercises.length}`
      });
    }

    return changes.length > 0 ? changes : [{
      id: 'minor',
      type: 'modified',
      category: 'section',
      target: 'Content',
      description: 'Minor content changes'
    }];
  }, []);

  // Generate change description by comparing with previous version
  const generateVersionChangeDescription = (
    current: any, 
    previous: any | null, 
    changeSummary: string | null
  ): string => {
    // If there's an explicit summary, use it (unless it's just "Auto-save")
    if (changeSummary && changeSummary !== 'Auto-save') {
      return changeSummary;
    }
    
    if (!previous) {
      return 'Initial version';
    }
    
    const changes: string[] = [];
    
    // Compare sections
    const currentSections = current.sections || [];
    const prevSections = previous.sections || [];
    
    if (currentSections.length > prevSections.length) {
      changes.push(`Added ${currentSections.length - prevSections.length} section(s)`);
    } else if (currentSections.length < prevSections.length) {
      changes.push(`Removed ${prevSections.length - currentSections.length} section(s)`);
    }
    
    // Check for image changes
    let imagesAdded = 0;
    currentSections.forEach((section: any, idx: number) => {
      const prevSection = prevSections[idx];
      if (!prevSection) return;
      
      // Check section images
      if (section.sectionImage && !prevSection.sectionImage) imagesAdded++;
      
      // Check vocab card images
      const currentVocab = section.vocabCards || [];
      const prevVocab = prevSection.vocabCards || [];
      currentVocab.forEach((card: any, cIdx: number) => {
        const prevCard = prevVocab[cIdx];
        if (card.image && (!prevCard || !prevCard.image)) imagesAdded++;
      });
    });
    
    if (imagesAdded > 0) {
      changes.push(`Added ${imagesAdded} image(s)`);
    }
    
    // Check header changes
    if (current.header?.goalText !== previous.header?.goalText) {
      changes.push('Updated lesson goal');
    }
    if (current.header?.lessonLabel !== previous.header?.lessonLabel) {
      changes.push('Changed lesson title');
    }
    if (current.header?.backgroundImage !== previous.header?.backgroundImage) {
      changes.push('Updated header image');
    }
    
    // Check vocabulary count
    const currentVocabCount = (current.vocabulary || []).length;
    const prevVocabCount = (previous.vocabulary || []).length;
    if (currentVocabCount !== prevVocabCount) {
      changes.push(`Vocabulary: ${prevVocabCount} → ${currentVocabCount}`);
    }
    
    // Check grammar count  
    const currentGrammarCount = (current.grammar || []).length;
    const prevGrammarCount = (previous.grammar || []).length;
    if (currentGrammarCount !== prevGrammarCount) {
      changes.push(`Grammar: ${prevGrammarCount} → ${currentGrammarCount}`);
    }
    
    if (changes.length === 0) {
      return 'Content updated';
    }
    
    return changes.slice(0, 3).join(', ');
  };

  // Get version history for current lesson - prefer server versions
  // Server returns newest first (ORDER BY version_number DESC)
  const currentLessonHistory = serverVersions.length > 0
    ? serverVersions.map((v, idx, arr) => {
        // Previous version is the next item in array (since newest is first)
        const previousVersion = arr[idx + 1];
        const detailedChanges = generateDetailedChanges(v.lessonData, previousVersion?.lessonData || null);
        return {
          id: v.id,
          lessonId: v.lessonId,
          version: v.versionNumber,
          snapshot: v.lessonData as any,
          timestamp: v.createdAt,
          changeDescription: generateVersionChangeDescription(
            v.lessonData, 
            previousVersion?.lessonData || null,
            v.changeSummary
          ),
          changes: detailedChanges,
          autoSave: !v.changeSummary || v.changeSummary === 'Auto-save',
          changedByName: v.changedByName,
        };
      })
    : (currentEditingLesson ? versionHistory[currentEditingLesson.id]?.versions || [] : []);

  // Update savedLessons whenever draft changes (if editing a lesson)
  // This ensures changes are persisted even if the user refreshes before going back to list
  useEffect(() => {
    if (!currentEditingLesson) return;
    
    setSavedLessons(prev =>
      prev.map(l =>
        l.id === currentEditingLesson.id
          ? { ...l, draft, updatedAt: new Date().toISOString() }
          : l
      )
    );
  }, [draft, currentEditingLesson]);

  // Autosave function - uses proper API endpoints with version history
  // Falls back to legacy save if unauthorized
  const saveToServer = useCallback(async (draftToSave: LessonMaterialDraft) => {
    if (!currentEditingLesson) {
      console.log('[Autosave] No current editing lesson, skipping save');
      return;
    }
    
    console.log('[Autosave] Starting save...', { 
      lessonId: currentEditingLesson.id,
      hasServerLesson: !!currentEditingLesson.serverLesson,
      serverLessonId: currentEditingLesson.serverLesson?.id
    });
    
    setIsSaving(true);
    setSaveError(null);
    try {
      // Check if lesson already has a server ID (was created before)
      if (currentEditingLesson.serverLesson?.id) {
        console.log('[Autosave] Updating existing lesson:', currentEditingLesson.serverLesson.id);
        // Update existing lesson (creates new version in database)
        const result = await lessonApi.updateLesson(
          currentEditingLesson.serverLesson.id,
          draftToSave,
          'Auto-save'
        );
        console.log('[Autosave] Update result:', result);
        if (result.success && result.url) {
          setLastSaved(new Date());
          setSavedLessonUrl(result.url);
          setHasUnsavedChanges(false);
          // Update last saved content to prevent duplicate saves
          lastSavedContentRef.current = JSON.stringify(draftToSave);
          // Update the serverLesson with new version info
          if (result.lesson) {
            const updatedLesson = { ...currentEditingLesson, serverLesson: result.lesson, currentVersion: result.version?.versionNumber };
            setCurrentEditingLesson(updatedLesson);
            setSavedLessons(prev =>
              prev.map(l =>
                l.id === currentEditingLesson.id ? updatedLesson : l
              )
            );
          }
        } else if (result.error === 'Unauthorized') {
          // Fall back to legacy save without version history
          console.log('[Autosave] Unauthorized, falling back to legacy save...');
          const legacyResult = await lessonApi.saveLesson(draftToSave);
          if (legacyResult.success && legacyResult.url) {
            setLastSaved(new Date());
            setSavedLessonUrl(legacyResult.url);
          } else {
            setSaveError(legacyResult.error || 'Failed to save');
          }
        } else {
          console.error('[Autosave] Update failed:', result.error);
          setSaveError(result.error || 'Failed to save');
        }
      } else {
        // Create new lesson (first save)
        console.log('[Autosave] Creating new lesson...');
        const result = await lessonApi.createLesson(draftToSave);
        console.log('[Autosave] Create result:', result);
        if (result.success && result.url) {
          setLastSaved(new Date());
          setSavedLessonUrl(result.url);
          setHasUnsavedChanges(false);
          // Update last saved content to prevent duplicate saves
          lastSavedContentRef.current = JSON.stringify(draftToSave);
          // Update the saved lesson with server info
          if (result.lesson) {
            const updatedLesson = { 
              ...currentEditingLesson, 
              serverLesson: result.lesson, 
              currentVersion: result.version?.versionNumber,
              status: result.lesson.status as 'draft' | 'finished' | 'published'
            };
            // IMPORTANT: Update currentEditingLesson so next save becomes an UPDATE, not CREATE
            setCurrentEditingLesson(updatedLesson);
            setSavedLessons(prev =>
              prev.map(l =>
                l.id === currentEditingLesson.id ? updatedLesson : l
              )
            );
            console.log('[Autosave] Updated currentEditingLesson with serverLesson:', result.lesson.id);
          }
        } else if (result.error === 'Unauthorized') {
          // Fall back to legacy save without version history
          console.log('[Autosave] Unauthorized, falling back to legacy save...');
          const legacyResult = await lessonApi.saveLesson(draftToSave);
          if (legacyResult.success && legacyResult.url) {
            setLastSaved(new Date());
            setSavedLessonUrl(legacyResult.url);
          } else {
            setSaveError(legacyResult.error || 'Failed to save');
          }
        } else {
          console.error('[Autosave] Create failed:', result.error);
          setSaveError(result.error || 'Failed to save');
        }
      }
    } catch (err) {
      console.error('[Autosave] Exception:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [currentEditingLesson]);

  // Debounced autosave - triggers 5 seconds after last change
  // Longer debounce to prevent rapid API calls that can cause connection issues
  useEffect(() => {
    // Skip autosave on first render (initial load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Skip if already saving to prevent overlapping requests
    if (isSaving) {
      return;
    }

    // Skip if content hasn't changed since last save
    const currentContent = JSON.stringify(draft);
    if (currentContent === lastSavedContentRef.current) {
      console.log('[Autosave] Content unchanged, skipping save');
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for autosave (5 second debounce)
    saveTimeoutRef.current = setTimeout(() => {
      saveToServer(draft);
    }, 5000);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draft, saveToServer, isSaving]);

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setDraft(prev => ({
        ...prev,
        header: { ...prev.header, backgroundImage: result }
      }));
    };
    reader.readAsDataURL(file);
  };

  // Group templates by course
  const groupedTemplates = COURSE_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.course]) {
      acc[template.course] = {
        icon: template.icon,
        category: template.category,
        templates: []
      };
    }
    acc[template.course].templates.push(template);
    return acc;
  }, {} as Record<string, { icon: string; category: string; templates: TemplateInfo[] }>);

  // Filter courses based on search
  const filteredCourses = Object.entries(groupedTemplates).filter(([course, data]) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return course.toLowerCase().includes(searchLower) ||
           data.templates.some(t => 
             t.name.toLowerCase().includes(searchLower) ||
             t.description.toLowerCase().includes(searchLower)
           );
  });

  const toggleCourse = (course: string) => {
    setExpandedCourses(prev => 
      prev.includes(course) 
        ? prev.filter(c => c !== course)
        : [...prev, course]
    );
  };

  const toggleLevel = (level: number) => {
    setExpandedLevels(prev =>
      prev.includes(level)
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  // Open modal to create new lesson from template
  const handleUseTemplate = (template: TemplateInfo) => {
    setSelectedTemplateForLesson(template);
    setNewLessonForm({
      level: 1,
      chapter: 1,
      lessonNumber: 1,
      goalName: '',
    });
    setShowNewLessonModal(true);
  };

  // Create new lesson from template
  const handleCreateLesson = () => {
    if (!selectedTemplateForLesson || !newLessonForm.goalName.trim()) return;

    const newLesson: SavedLesson = {
      id: `lesson-${Date.now()}`,
      templateId: selectedTemplateForLesson.id,
      templateName: selectedTemplateForLesson.name,
      level: newLessonForm.level,
      chapter: newLessonForm.chapter,
      lessonNumber: newLessonForm.lessonNumber,
      goalName: newLessonForm.goalName.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      draft: {
        ...createBlankDraft(),
        header: {
          ...createBlankDraft().header,
          levelBadge: `LEVEL ${newLessonForm.level}`,
          chapterLabel: `Chapter ${newLessonForm.chapter}`,
          lessonLabel: `Lesson ${newLessonForm.lessonNumber}`,
          goalText: newLessonForm.goalName.trim(),
        },
      },
    };

    setSavedLessons(prev => [...prev, newLesson]);
    setShowNewLessonModal(false);
    setSelectedTemplateForLesson(null);
    
    // Open the lesson for editing
    setCurrentEditingLesson(newLesson);
    setDraft(newLesson.draft);
    setViewMode('editor');
    setIsFullscreen(true);
    // Persist editing lesson ID so it survives page refresh
    localStorage.setItem(EDITING_LESSON_KEY, newLesson.id);
    // Push to browser history so back button works
    window.history.pushState(
      { viewMode: 'editor', lessonId: newLesson.id },
      '',
      `${window.location.pathname}?lesson=${newLesson.id}`
    );
  };

  // Edit an existing saved lesson
  // If lesson has serverLesson, fetch latest content from server
  const handleEditLesson = async (lesson: SavedLesson) => {
    setCurrentEditingLesson(lesson);
    setViewMode('editor');
    setIsFullscreen(true);
    // Persist editing lesson ID so it survives page refresh
    localStorage.setItem(EDITING_LESSON_KEY, lesson.id);
    // Push to browser history so back button works
    window.history.pushState(
      { viewMode: 'editor', lessonId: lesson.id },
      '',
      `${window.location.pathname}?lesson=${lesson.id}`
    );
    
    // If lesson has been saved to server, fetch the latest content from server
    if (lesson.serverLesson?.id) {
      console.log('[Edit] Loading lesson from server:', lesson.serverLesson.id);
      try {
        const response = await lessonApi.getLesson(lesson.serverLesson.id);
        if (response.success && response.lessonData) {
          console.log('[Edit] Loaded server content successfully');
          // Convert LessonMaterial to LessonMaterialDraft - use ALL server data including sections
          const serverDraft: LessonMaterialDraft = {
            version: 2,
            header: response.lessonData.header,
            sections: (response.lessonData as any).sections || lesson.draft.sections,
            vocabulary: response.lessonData.vocabulary || [],
            grammar: response.lessonData.grammar || [],
            exercises: response.lessonData.exercises || []
          };
          setDraft(serverDraft);
          // Update lastSavedContent to prevent immediate re-save
          lastSavedContentRef.current = JSON.stringify(serverDraft);
          // Also update the local savedLessons cache
          setSavedLessons(prev =>
            prev.map(l =>
              l.id === lesson.id ? { ...l, draft: serverDraft } : l
            )
          );
        } else {
          console.log('[Edit] Server fetch failed, using local draft');
          setDraft(lesson.draft);
        }
      } catch (err) {
        console.error('[Edit] Error loading from server:', err);
        setDraft(lesson.draft);
      }
    } else {
      // No server lesson, use local draft
      setDraft(lesson.draft);
    }
  };

  // Delete a saved lesson
  const handleDeleteLesson = async (lessonId: string) => {
    if (!await toastConfirm('Are you sure you want to delete this lesson?', 'Delete Lesson')) return;
    setSavedLessons(prev => prev.filter(l => l.id !== lessonId));
  };

  // ============ FORK/MERGE FUNCTIONS ============
  
  // Load server lessons
  const loadServerLessons = useCallback(async () => {
    setIsLoadingServerLessons(true);
    try {
      const [lessonsRes, mrRes] = await Promise.all([
        lessonApi.getMyLessons(),
        lessonApi.getMyMergeRequests()
      ]);
      
      if (lessonsRes.success) {
        setServerLessons(lessonsRes.lessons);
      }
      if (mrRes.success) {
        setPendingMergeRequests(mrRes.mergeRequests);
      }
    } catch (err) {
      console.error('Failed to load server lessons:', err);
    } finally {
      setIsLoadingServerLessons(false);
    }
  }, []);

  // Load server lessons on mount and when tab changes to myLessons
  useEffect(() => {
    if (activeTab === 'myLessons') {
      loadServerLessons();
    }
  }, [activeTab, loadServerLessons]);

  // Fork a lesson
  const handleForkLesson = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) {
      toast.warning('This lesson is not synced with the server yet. Save it first.');
      return;
    }
    
    setLessonToFork(lesson);
    setShowForkConfirmModal(true);
  };

  const confirmForkLesson = async () => {
    if (!lessonToFork?.serverLesson) return;
    
    try {
      const result = await lessonApi.forkLesson(lessonToFork.serverLesson.id);
      if (result.success && result.lesson) {
        // Add the forked lesson to local state
        const forkedLesson: SavedLesson = {
          id: result.lesson.id,
          templateId: lessonToFork.templateId,
          templateName: lessonToFork.templateName + ' (Fork)',
          level: lessonToFork.level,
          chapter: lessonToFork.chapter,
          lessonNumber: lessonToFork.lessonNumber,
          goalName: lessonToFork.goalName,
          createdAt: result.lesson.createdAt,
          updatedAt: result.lesson.updatedAt,
          status: 'draft',
          draft: lessonToFork.draft,
          isFork: true,
          forkOf: lessonToFork.serverLesson.id,
          serverLesson: result.lesson
        };
        setSavedLessons(prev => [...prev, forkedLesson]);
        setShowForkConfirmModal(false);
        setLessonToFork(null);
        toast.success('Lesson forked successfully! You can now edit your fork.');
      } else {
        toast.error(result.error || 'Failed to fork lesson');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fork lesson');
    }
  };

  // Create merge request
  const handleCreateMergeRequest = (lesson: SavedLesson) => {
    if (!lesson.isFork || !lesson.forkOf) {
      toast.warning('Only forked lessons can create merge requests');
      return;
    }
    setLessonToFork(lesson);
    setMergeRequestForm({ title: '', description: '' });
    setShowMergeRequestModal(true);
  };

  const submitMergeRequest = async () => {
    if (!lessonToFork?.serverLesson) return;
    
    const title = mergeRequestForm.title.trim() || `Update from ${lessonToFork.goalName}`;
    
    try {
      const result = await lessonApi.createMergeRequest(
        lessonToFork.serverLesson.id,
        title,
        mergeRequestForm.description || undefined
      );
      
      if (result.success) {
        // Update local state to reflect pending merge request
        setSavedLessons(prev => prev.map(l => 
          l.id === lessonToFork.id 
            ? { ...l, hasPendingMergeRequest: true }
            : l
        ));
        setShowMergeRequestModal(false);
        setLessonToFork(null);
        toast.success('Merge request submitted! The original author will review it.');
      } else {
        toast.error(result.error || 'Failed to create merge request');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create merge request');
    }
  };

  // Review merge request
  const handleReviewMergeRequest = (mr: MergeRequest) => {
    setSelectedMergeRequest(mr);
    setShowMergeReviewModal(true);
  };

  const submitMergeReview = async (action: 'approve' | 'reject' | 'merge', comment?: string) => {
    if (!selectedMergeRequest) return;
    
    try {
      const result = await lessonApi.reviewMergeRequest(selectedMergeRequest.id, action, comment);
      
      if (result.success) {
        // Remove from pending list
        setPendingMergeRequests(prev => prev.filter(mr => mr.id !== selectedMergeRequest.id));
        setShowMergeReviewModal(false);
        setSelectedMergeRequest(null);
        
        if (action === 'merge') {
          toast.success('Changes merged successfully!');
          // Reload lessons to reflect the merge
          loadServerLessons();
        } else {
          toast.success(`Merge request ${action}ed.`);
        }
      } else {
        toast.error(result.error || `Failed to ${action} merge request`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} merge request`);
    }
  };

  // ============ END FORK/MERGE FUNCTIONS ============

  // ============ IMPROVEMENT HANDLERS ============

  // Version Restore
  const handleShowVersions = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) {
      toast.warning('This lesson is not synced with the server yet.');
      return;
    }
    
    try {
      const result = await lessonApi.getVersionHistory(lesson.serverLesson.id);
      if (result.success && result.versions) {
        setLessonVersions(result.versions);
        setLessonToFork(lesson);
        setShowVersionRestoreModal(true);
      } else {
        toast.error(result.error || 'Failed to load version history');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load version history');
    }
  };

  const handleRestoreVersion = async (version: LessonVersion) => {
    if (!lessonToFork?.serverLesson) return;
    
    if (!await toastConfirm(`Restore to version ${version.versionNumber}? This will create a new version with the old content.`, 'Restore Version')) {
      return;
    }
    
    try {
      const result = await lessonApi.restoreVersion(lessonToFork.serverLesson.id, version.versionNumber);
      if (result.success) {
        toast.success('Version restored successfully!');
        setShowVersionRestoreModal(false);
        loadServerLessons();
      } else {
        toast.error(result.error || 'Failed to restore version');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore version');
    }
  };

  // Publish/Unpublish workflow
  const handlePublishLesson = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) {
      toast.warning('This lesson needs to be saved to the server first.');
      return;
    }
    
    try {
      const result = await lessonApi.publishLesson(lesson.serverLesson.id);
      if (result.success) {
        alert('Lesson published!');
        loadServerLessons();
        // Update local state
        setSavedLessons(prev => prev.map(l => 
          l.id === lesson.id ? { ...l, status: 'published' as const } : l
        ));
      } else {
        alert(result.error || 'Failed to publish lesson');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish lesson');
    }
  };

  const handleUnpublishLesson = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) return;
    
    try {
      const result = await lessonApi.unpublishLesson(lesson.serverLesson.id);
      if (result.success) {
        alert('Lesson unpublished (now draft)');
        loadServerLessons();
        setSavedLessons(prev => prev.map(l => 
          l.id === lesson.id ? { ...l, status: 'draft' as const } : l
        ));
      } else {
        toast.error(result.error || 'Failed to unpublish lesson');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unpublish lesson');
    }
  };

  const handleArchiveLesson = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) return;
    
    if (!await toastConfirm('Archive this lesson? It will be hidden from most views.', 'Archive Lesson')) return;
    
    try {
      const result = await lessonApi.archiveLesson(lesson.serverLesson.id);
      if (result.success) {
        toast.success('Lesson archived');
        loadServerLessons();
        setSavedLessons(prev => prev.map(l => 
          l.id === lesson.id ? { ...l, status: 'archived' as const } : l
        ));
      } else {
        toast.error(result.error || 'Failed to archive lesson');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive lesson');
    }
  };

  // Mark as finished - lesson is complete but not yet published
  const handleMarkAsFinished = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) {
      toast.warning('This lesson needs to be saved to the server first.');
      return;
    }
    
    try {
      const result = await lessonApi.markAsFinished(lesson.serverLesson.id);
      if (result.success) {
        toast.success('Lesson marked as finished!');
        loadServerLessons();
        setSavedLessons(prev => prev.map(l => 
          l.id === lesson.id ? { ...l, status: 'finished' as const } : l
        ));
      } else {
        alert(result.error || 'Failed to mark lesson as finished');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark lesson as finished');
    }
  };

  // Mark as draft - revert from finished back to draft for editing
  const handleMarkAsDraft = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) return;
    
    try {
      const result = await lessonApi.markAsDraft(lesson.serverLesson.id);
      if (result.success) {
        alert('Lesson marked as draft - you can continue editing.');
        loadServerLessons();
        setSavedLessons(prev => prev.map(l => 
          l.id === lesson.id ? { ...l, status: 'draft' as const } : l
        ));
      } else {
        alert(result.error || 'Failed to mark lesson as draft');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark lesson as draft');
    }
  };

  // Save as template
  const handleSaveAsTemplate = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) {
      alert('Save the lesson to server first before creating a template.');
      return;
    }
    
    try {
      const result = await lessonApi.saveAsTemplate(lesson.serverLesson.id);
      if (result.success) {
        alert('Lesson saved as template!');
      } else {
        alert(result.error || 'Failed to save as template');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save as template');
    }
  };

  // Export lesson as PDF, HTML, or print
  const handleExportLesson = useCallback((format: 'pdf' | 'print' | 'html') => {
    if (!draft) {
      toast.warning('No content to export.');
      return;
    }

    // Build export data from current draft - using actual section structure
    const lessonTitle = currentEditingLesson?.goalName || draft.header?.goalText || 'Lesson Material';
    
    // Generate section content HTML properly
    const generateSectionContent = (section: SectionContent): string => {
      let content = '';
      
      // Explanation
      if (section.explanationEn) {
        content += `<p style="font-size:14pt;margin-bottom:8px;">${section.explanationEn}</p>`;
      }
      if (section.explanationJp) {
        content += `<p style="font-size:12pt;color:#64748b;border-left:3px solid #e2e8f0;padding-left:12px;margin-bottom:16px;">${section.explanationJp}</p>`;
      }
      
      // Section image
      if (section.sectionImage) {
        content += `<img src="${section.sectionImage}" alt="Section illustration" style="max-width:100%;border-radius:8px;margin:16px 0;" />`;
      }
      
      // Step title and instructions
      if (section.stepTitle) {
        content += `<p style="font-size:12pt;font-weight:700;color:#3b82f6;text-transform:uppercase;margin-bottom:8px;">${section.stepTitle}</p>`;
      }
      if (section.instructionEn) {
        content += `<p style="margin-bottom:4px;">${section.instructionEn}</p>`;
      }
      if (section.instructionJp) {
        content += `<p style="font-size:11pt;color:#94a3b8;margin-bottom:16px;">${section.instructionJp}</p>`;
      }
      
      // Vocabulary cards
      if (section.vocabCards && section.vocabCards.length > 0) {
        content += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:16px 0;">`;
        for (const card of section.vocabCards) {
          content += `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;text-align:center;">`;
          if (card.imageUrl) {
            content += `<img src="${card.imageUrl}" alt="${card.word || ''}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;margin-bottom:8px;" />`;
          }
          content += `<div style="font-size:16pt;font-weight:700;color:#0369a1;">${card.word || ''}</div>`;
          if (card.reading) content += `<div style="font-size:11pt;color:#64748b;">${card.reading}</div>`;
          content += `<div style="font-size:12pt;color:#334155;">${card.meaning || card.english || ''}</div>`;
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      // Image cards
      if (section.imageCards && section.imageCards.length > 0) {
        content += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin:16px 0;">`;
        for (const card of section.imageCards) {
          content += `<div style="text-align:center;">`;
          if (card.imageUrl) {
            content += `<img src="${card.imageUrl}" alt="${card.label || ''}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`;
          }
          content += `<div style="font-size:12pt;font-weight:600;">${card.label || ''}</div>`;
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      // Grammar rules
      if (section.grammarRules && section.grammarRules.length > 0) {
        for (const rule of section.grammarRules) {
          content += `<div style="background:#fef3c7;border-left:4px solid #eab308;border-radius:8px;padding:12px;margin-bottom:12px;">`;
          content += `<div style="font-weight:700;color:#854d0e;margin-bottom:4px;">${rule.pattern || rule.structure || ''}</div>`;
          if (rule.meaning) content += `<div style="color:#713f12;margin-bottom:4px;">${rule.meaning}</div>`;
          if (rule.example) content += `<div style="font-style:italic;color:#92400e;">${rule.example}</div>`;
          content += `</div>`;
        }
      }
      
      // Dialogue lines
      if (section.dialogueLines && section.dialogueLines.length > 0) {
        if (section.dialogueImage) {
          content += `<img src="${section.dialogueImage}" alt="Dialogue scene" style="max-width:100%;border-radius:8px;margin:16px 0;" />`;
        }
        for (const line of section.dialogueLines) {
          content += `<div style="display:flex;gap:12px;margin-bottom:10px;padding:10px;background:#f8fafc;border-radius:6px;">`;
          content += `<span style="font-weight:700;color:#3b82f6;min-width:70px;">${line.speaker || ''}</span>`;
          content += `<div><div>${line.textEn || line.lineEn || ''}</div>`;
          if (line.textJp || line.lineJp) content += `<div style="font-size:11pt;color:#64748b;">${line.textJp || line.lineJp}</div>`;
          content += `</div></div>`;
        }
      }
      
      // Trivia examples
      if (section.triviaExamples && section.triviaExamples.length > 0) {
        content += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin:16px 0;">`;
        for (const ex of section.triviaExamples) {
          content += `<div style="background:#fdf4ff;border:1px solid #e879f9;border-radius:8px;padding:12px;">`;
          content += `<div style="font-size:16pt;font-weight:700;color:#a21caf;margin-bottom:4px;">${ex.textJp || ex.japanese || ''}</div>`;
          content += `<div style="font-size:12pt;color:#86198f;">${ex.textEn || ex.english || ''}</div>`;
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      // Practice items
      if (section.practiceExample) {
        content += `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;margin-bottom:12px;">`;
        content += `<div style="font-size:11pt;font-weight:700;color:#16a34a;margin-bottom:4px;">Example</div>`;
        content += `<div>${section.practiceExample}</div>`;
        if (section.practiceExampleAnswer) content += `<div style="color:#15803d;font-weight:600;margin-top:4px;">${section.practiceExampleAnswer}</div>`;
        content += `</div>`;
      }
      if (section.practiceItems && section.practiceItems.length > 0) {
        for (let i = 0; i < section.practiceItems.length; i++) {
          const item = section.practiceItems[i];
          content += `<div style="display:flex;gap:8px;padding:8px;background:#f8fafc;border-radius:6px;margin-bottom:6px;">`;
          content += `<span style="font-weight:700;color:#3b82f6;">${i + 1}.</span>`;
          content += `<span>${item.question || item.text || ''}</span>`;
          content += `</div>`;
        }
      }
      
      // Word box
      if (section.wordBox && section.wordBox.length > 0) {
        content += `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin:12px 0;">`;
        for (const word of section.wordBox) {
          content += `<span style="background:#fff;border:1px solid #0ea5e9;color:#0369a1;padding:4px 10px;border-radius:16px;font-size:12pt;">${word}</span>`;
        }
        content += `</div>`;
      }
      
      // Challenge section
      if (section.situationEn || section.situationJp) {
        content += `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin:12px 0;">`;
        content += `<div style="font-size:11pt;font-weight:700;color:#92400e;margin-bottom:4px;">Situation</div>`;
        if (section.situationEn) content += `<div style="color:#78350f;">${section.situationEn}</div>`;
        if (section.situationJp) content += `<div style="font-size:11pt;color:#92400e;margin-top:4px;">${section.situationJp}</div>`;
        content += `</div>`;
      }
      
      // Grammar tip box
      if (section.grammarTipTitle || (section.grammarTipItems && section.grammarTipItems.length > 0)) {
        content += `<div style="background:#f0fdfa;border:1px solid #5eead4;border-radius:8px;padding:12px;margin:12px 0;">`;
        if (section.grammarTipTitle) content += `<div style="font-weight:700;color:#0f766e;margin-bottom:8px;">${section.grammarTipTitle}</div>`;
        for (const item of section.grammarTipItems || []) {
          content += `<div style="padding:2px 0;color:#115e59;">• ${item}</div>`;
        }
        content += `</div>`;
      }
      
      // Listening script
      if (section.listeningScript && section.listeningScript.length > 0) {
        const scriptText = section.listeningScript.map((word: any) => {
          if (word.underline) return `<u>${word.text || word}</u>`;
          return typeof word === 'string' ? word : word.text || '';
        }).join(' ');
        content += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:12px 0;line-height:2;">${scriptText}</div>`;
      }
      
      // Questions (listening/reading/challenge)
      const questions = section.listeningQuestions || section.readingQuestions || section.challengeQuestions;
      if (questions && questions.length > 0) {
        content += `<div style="margin:12px 0;">`;
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          content += `<div style="background:#f8fafc;border-left:4px solid #3b82f6;border-radius:6px;padding:12px;margin-bottom:8px;">`;
          content += `<div style="font-weight:500;">${i + 1}. ${q.question || q.questionEn || q.text || ''}</div>`;
          if (q.answer) content += `<div style="color:#16a34a;font-weight:600;margin-top:4px;">Answer: ${q.answer}</div>`;
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      // Reading dialogue
      if (section.readingDialogueLines && section.readingDialogueLines.length > 0) {
        if (section.readingImage) {
          content += `<img src="${section.readingImage}" alt="Reading scene" style="max-width:100%;border-radius:8px;margin:16px 0;" />`;
        }
        content += `<div style="background:#f8fafc;border-radius:8px;padding:16px;margin:12px 0;">`;
        for (const line of section.readingDialogueLines) {
          content += `<div style="display:flex;gap:12px;margin-bottom:12px;padding:10px;background:#fff;border-radius:6px;">`;
          content += `<span style="font-weight:700;color:#7c3aed;min-width:60px;">${line.speaker || ''}</span>`;
          content += `<span>${line.lineEn || line.text || ''}</span>`;
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      return content;
    };
    
    const exportData: LessonExportData = {
      title: lessonTitle,
      level: draft.header?.levelBadge,
      chapter: draft.header?.chapterLabel,
      lesson: draft.header?.lessonLabel,
      goal: draft.header?.goalText,
      sections: draft.sections?.map((section, idx) => ({
        type: section.sectionType || 'content',
        title: section.sectionTitle || `Section ${idx + 1}`,
        content: generateSectionContent(section),
      })) || [],
    };

    try {
      switch (format) {
        case 'pdf':
          exportLessonData(exportData, 'pdf', { fileName: lessonTitle });
          toast.success('Opening PDF export dialog...');
          break;
        case 'print':
          print(formatLessonForExport(exportData), exportData.title);
          break;
        case 'html':
          exportLessonData(exportData, 'html', { fileName: lessonTitle });
          toast.success('HTML file downloaded!');
          break;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
    
    setShowExportMenu(false);
  }, [currentEditingLesson, draft, exportLessonData, print]);

  // Open lesson preview in a new tab (static page without edit tools)
  const handleOpenPreview = useCallback(() => {
    if (!draft) {
      toast.warning('No content to preview.');
      return;
    }

    // Check if there's a server URL available
    if (currentEditingLesson?.serverLesson?.url) {
      window.open(currentEditingLesson.serverLesson.url, '_blank');
      return;
    }

    // Generate preview HTML from current draft using EXACT same CSS classes as editor
    const lessonTitle = currentEditingLesson?.goalName || draft.header?.goalText || 'Lesson Material';
    
    // Generate section content for preview (main column)
    const generatePreviewSectionHtml = (section: SectionContent): string => {
      let content = '';
      
      // INTRODUCE type content
      if (section.sectionType === 'introduce' || !section.sectionType) {
        // Explanation - English
        if (section.explanationEn) {
          content += `<p class="lm-section-explanation">${section.explanationEn}</p>`;
        }
        // Explanation - Japanese
        if (section.explanationJp) {
          content += `<p class="lm-section-explanation-jp">${section.explanationJp}</p>`;
        }
        // Section Image
        if (section.sectionImage) {
          content += `<div class="lm-section-image-container"><div class="lm-section-image-wrapper"><img src="${section.sectionImage}" alt="Section visual" class="lm-section-image" /></div></div>`;
        }
      }
      
      // VOCABULARY type content
      if (section.sectionType === 'vocabulary') {
        if (section.stepTitle) {
          content += `<h3 class="lm-step-title">${section.stepTitle}</h3>`;
        }
        if (section.instructionEn) {
          content += `<p class="lm-vocab-instruction">${section.instructionEn}</p>`;
        }
        if (section.instructionJp) {
          content += `<p class="lm-vocab-instruction-jp">${section.instructionJp}</p>`;
        }
        // Vocabulary Grid
        if (section.vocabCards && section.vocabCards.length > 0) {
          content += `<div class="lm-vocab-grid">`;
          for (const card of section.vocabCards) {
            content += `<div class="lm-vocab-card-preview">`;
            if (card.imageUrl || card.image) {
              content += `<div class="lm-vocab-image-wrapper"><img src="${card.imageUrl || card.image}" alt="${card.word || card.wordEn || ''}" class="lm-vocab-image" /></div>`;
            }
            content += `<div class="lm-vocab-word">${card.word || card.wordEn || ''}</div>`;
            if (card.reading || card.wordJp) content += `<div class="lm-vocab-reading">${card.reading || card.wordJp || ''}</div>`;
            if (card.meaning || card.english) content += `<div class="lm-vocab-meaning">${card.meaning || card.english || ''}</div>`;
            content += `</div>`;
          }
          content += `</div>`;
        }
      }
      
      // IMAGE type content
      if (section.sectionType === 'image') {
        if (section.stepTitle) {
          content += `<h3 class="lm-step-title">${section.stepTitle}</h3>`;
        }
        if (section.instructionEn) {
          content += `<p class="lm-vocab-instruction">${section.instructionEn}</p>`;
        }
        if (section.instructionJp) {
          content += `<p class="lm-vocab-instruction-jp">${section.instructionJp}</p>`;
        }
        // Image cards
        if (section.imageCards && section.imageCards.length > 0) {
          content += `<div class="lm-image-grid">`;
          for (const card of section.imageCards) {
            content += `<div class="lm-image-card-preview">`;
            if (card.imageUrl || card.image) {
              content += `<img src="${card.imageUrl || card.image}" alt="${card.label || ''}" class="lm-image-card-img" />`;
            }
            content += `<div class="lm-image-card-label">${card.label || ''}</div>`;
            content += `</div>`;
          }
          content += `</div>`;
        }
      }
      
      // PRONUNCIATION type content
      if (section.sectionType === 'pronunciation') {
        if (section.pronunciationColumns && section.pronunciationColumns.length > 0) {
          content += `<div class="lm-pronunciation-grid">`;
          for (const col of section.pronunciationColumns) {
            content += `<div class="lm-pronunciation-column">`;
            content += `<div class="lm-pronunciation-header">${col.soundLabel || ''}</div>`;
            for (const word of col.words || []) {
              content += `<div class="lm-pronunciation-word"><span class="lm-word-en">${word.wordEn || ''}</span> <span class="lm-word-jp">${word.wordJp || ''}</span></div>`;
            }
            content += `</div>`;
          }
          content += `</div>`;
        }
      }
      
      // GRAMMAR type content
      if (section.sectionType === 'grammar') {
        if (section.grammarRules && section.grammarRules.length > 0) {
          for (const rule of section.grammarRules) {
            content += `<div class="lm-grammar-rule">`;
            content += `<div class="lm-grammar-rule-text">${rule.ruleEn || rule.pattern || rule.structure || ''}</div>`;
            if (rule.ruleJp || rule.meaning) content += `<div class="lm-grammar-rule-jp">${rule.ruleJp || rule.meaning || ''}</div>`;
            if (rule.examples && rule.examples.length > 0) {
              for (const ex of rule.examples) {
                content += `<div class="lm-grammar-example">`;
                content += `<div class="lm-grammar-example-en">${ex.sentenceEn || ex.example || ''}</div>`;
                if (ex.sentenceJp || ex.translation) content += `<div class="lm-grammar-example-jp">${ex.sentenceJp || ex.translation || ''}</div>`;
                content += `</div>`;
              }
            }
            content += `</div>`;
          }
        }
      }
      
      // DIALOGUE type content
      if (section.sectionType === 'dialogue') {
        if (section.dialogueImage) {
          content += `<div class="lm-dialogue-image-wrapper"><img src="${section.dialogueImage}" alt="Dialogue scene" class="lm-dialogue-image" /></div>`;
        }
        if (section.dialogueLines && section.dialogueLines.length > 0) {
          content += `<div class="lm-dialogue-lines">`;
          for (const line of section.dialogueLines) {
            content += `<div class="lm-dialogue-line">`;
            content += `<span class="lm-dialogue-speaker">${line.speaker || ''}</span>`;
            content += `<div class="lm-dialogue-text"><div class="lm-dialogue-en">${line.textEn || line.lineEn || ''}</div>`;
            if (line.textJp || line.lineJp) content += `<div class="lm-dialogue-jp">${line.textJp || line.lineJp}</div>`;
            content += `</div></div>`;
          }
          content += `</div>`;
        }
      }
      
      // TRIVIA type content
      if (section.sectionType === 'trivia') {
        if (section.triviaExamples && section.triviaExamples.length > 0) {
          content += `<div class="lm-trivia-grid">`;
          for (const ex of section.triviaExamples) {
            content += `<div class="lm-trivia-card ${ex.isCorrect ? 'correct' : 'incorrect'}">`;
            content += `<div class="lm-trivia-line"><span class="lm-trivia-speaker">${ex.speakerA || 'A'}:</span> ${ex.lineA || ''}</div>`;
            content += `<div class="lm-trivia-line"><span class="lm-trivia-speaker">${ex.speakerB || 'B'}:</span> ${ex.lineB || ''}</div>`;
            content += `<div class="lm-trivia-indicator">${ex.isCorrect ? '✓' : '✗'}</div>`;
            content += `</div>`;
          }
          content += `</div>`;
        }
      }
      
      // PRACTICE type content
      if (section.sectionType === 'practice') {
        if (section.practiceExample) {
          content += `<div class="lm-practice-example">`;
          content += `<div class="lm-practice-example-label">Example</div>`;
          content += `<div class="lm-practice-example-text">${section.practiceExample}</div>`;
          if (section.practiceExampleAnswer) content += `<div class="lm-practice-example-answer">${section.practiceExampleAnswer}</div>`;
          content += `</div>`;
        }
        if (section.practiceItems && section.practiceItems.length > 0) {
          content += `<div class="lm-practice-items">`;
          for (let i = 0; i < section.practiceItems.length; i++) {
            const item = section.practiceItems[i];
            content += `<div class="lm-practice-item">`;
            content += `<span class="lm-practice-number">${i + 1}.</span>`;
            content += `<span class="lm-practice-question">${item.question || ''}</span>`;
            content += `</div>`;
          }
          content += `</div>`;
        }
      }
      
      // Word box
      if (section.wordBox && section.wordBox.length > 0) {
        content += `<div class="lm-word-box">`;
        for (const word of section.wordBox) {
          content += `<span class="lm-word-box-item">${word}</span>`;
        }
        content += `</div>`;
      }
      
      // Conversation lines
      if (section.conversationLines && section.conversationLines.length > 0) {
        content += `<div class="lm-conversation-lines">`;
        for (const line of section.conversationLines) {
          content += `<div class="lm-conversation-line">`;
          content += `<span class="lm-conversation-speaker">${line.speaker || ''}</span>`;
          content += `<span class="lm-conversation-text">${(line.text || '').replace(/___+/g, '<span class="lm-blank"></span>')}</span>`;
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      // Challenge section
      if (section.challengeTitle) {
        content += `<div class="lm-challenge-header">`;
        content += `<span class="lm-challenge-title">${section.challengeTitle}</span>`;
        if (section.isOptional) content += `<span class="lm-challenge-optional">If Time Allows</span>`;
        content += `</div>`;
      }
      if (section.situationEn || section.situationJp) {
        content += `<div class="lm-situation-box">`;
        content += `<div class="lm-situation-label">Situation</div>`;
        if (section.situationEn) content += `<div class="lm-situation-en">${section.situationEn}</div>`;
        if (section.situationJp) content += `<div class="lm-situation-jp">${section.situationJp}</div>`;
        content += `</div>`;
      }
      
      // Grammar tip box
      if (section.grammarTipTitle || (section.grammarTipItems && section.grammarTipItems.length > 0)) {
        content += `<div class="lm-grammar-tip-box">`;
        if (section.grammarTipTitle) content += `<div class="lm-grammar-tip-title">${section.grammarTipTitle}</div>`;
        content += `<div class="lm-grammar-tip-items">`;
        for (const item of section.grammarTipItems || []) {
          content += `<span class="lm-grammar-tip-item">${item}</span>`;
        }
        content += `</div></div>`;
      }
      
      // Challenge questions
      if (section.challengeQuestions && section.challengeQuestions.length > 0) {
        content += `<div class="lm-challenge-questions">`;
        for (let i = 0; i < section.challengeQuestions.length; i++) {
          const q = section.challengeQuestions[i];
          content += `<div class="lm-challenge-question">`;
          content += `<div class="lm-challenge-question-text">${i + 1}. ${q.question || ''}</div>`;
          if (q.subQuestions && q.subQuestions.length > 0) {
            for (const sub of q.subQuestions) {
              content += `<div class="lm-challenge-sub-question">${sub}</div>`;
            }
          }
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      // Topic boxes
      if (section.topicBoxes && section.topicBoxes.length > 0) {
        content += `<div class="lm-topic-boxes">`;
        for (const box of section.topicBoxes) {
          content += `<div class="lm-topic-box">`;
          content += `<div class="lm-topic-title">${box.topicTitle || ''}</div>`;
          for (const q of box.questions || []) {
            content += `<div class="lm-topic-question">• ${q.question || ''}</div>`;
          }
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      // Listening script
      if (section.listeningScriptText) {
        content += `<div class="lm-listening-script">${section.listeningScriptText}</div>`;
      }
      
      // Questions (listening/reading)
      const questions = section.listeningQuestions || section.readingQuestions;
      if (questions && questions.length > 0) {
        content += `<div class="lm-questions">`;
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          content += `<div class="lm-question-item">`;
          content += `<div class="lm-question-text">${i + 1}. ${q.question || q.questionEn || ''}</div>`;
          if (q.answer) content += `<div class="lm-question-answer">Answer: ${q.answer}</div>`;
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      // Reading dialogue
      if (section.readingDialogueLines && section.readingDialogueLines.length > 0) {
        if (section.readingImage) {
          content += `<div class="lm-reading-image-wrapper"><img src="${section.readingImage}" alt="Reading scene" class="lm-reading-image" /></div>`;
        }
        content += `<div class="lm-reading-dialogue">`;
        for (const line of section.readingDialogueLines) {
          content += `<div class="lm-reading-line">`;
          content += `<span class="lm-reading-speaker">${line.speaker || ''}</span>`;
          content += `<span class="lm-reading-text">${line.lineEn || line.text || ''}</span>`;
          content += `</div>`;
        }
        content += `</div>`;
      }
      
      return content;
    };

    // Helper to generate sidebar HTML for a section using exact CSS classes as editor
    const generatePreviewSidebarHtml = (section: SectionContent): string => {
      let sidebar = '';
      
      // For INTRODUCE type sections - use lm-goal-box
      if (section.sectionType === 'introduce' || (!section.sectionType && section.lessonGoalTitle)) {
        sidebar += `<div class="lm-goal-box">`;
        if (section.lessonGoalTitle) {
          sidebar += `<div class="lm-goal-box-header">${section.lessonGoalTitle}</div>`;
        }
        sidebar += `<div class="lm-goal-steps">`;
      } else {
        // For other section types - use lm-vocab-sidebar
        sidebar += `<div class="lm-vocab-sidebar">`;
        if (section.sidebarTitle) {
          sidebar += `<div class="lm-vocab-sidebar-header">${section.sidebarTitle}</div>`;
        }
        if (section.sidebarSubtitle) {
          sidebar += `<div class="lm-vocab-sidebar-subheader">${section.sidebarSubtitle}</div>`;
        }
        sidebar += `<div class="lm-goal-steps">`;
      }
      
      // Lesson goal steps
      if (section.lessonGoalSteps && section.lessonGoalSteps.length > 0) {
        for (let i = 0; i < section.lessonGoalSteps.length; i++) {
          const step = section.lessonGoalSteps[i];
          sidebar += `<div class="lm-goal-step">`;
          sidebar += `<span class="lm-step-number">${i + 1}</span>`;
          sidebar += `<div class="lm-step-content">`;
          
          if (step.instruction) {
            sidebar += `<span class="lm-step-instruction">${step.instruction}</span>`;
          }
          
          // Script lines
          const scriptLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
          for (const line of scriptLines) {
            sidebar += `<div class="lm-step-script">`;
            sidebar += `<span class="lm-script-bullet">●</span>`;
            sidebar += `<span class="lm-script-text">${line}</span>`;
            sidebar += `</div>`;
          }
          
          // Tip text
          if (step.tipText) {
            sidebar += `<div class="lm-step-tip">`;
            sidebar += `<span class="lm-tip-icon">◆</span>`;
            sidebar += `<span class="lm-tip-text">${step.tipText}</span>`;
            sidebar += `</div>`;
          }
          
          sidebar += `</div>`; // Close step content
          sidebar += `</div>`; // Close step
        }
      }
      
      sidebar += `</div>`; // Close goal-steps
      sidebar += `</div>`; // Close sidebar container
      
      return sidebar;
    };

    // Build full HTML document using actual CSS classes
    const sectionsHtml = draft.sections?.map((section, idx) => {
      const sidebarHtml = generatePreviewSidebarHtml(section);
      const hasSidebar = section.lessonGoalSteps && section.lessonGoalSteps.length > 0;
      
      // Generate section title row (only for certain section types)
      const showTitleRow = section.sectionType !== 'question' && 
                          section.sectionType !== 'trivia' && 
                          section.sectionType !== 'challenge2' &&
                          section.sectionType !== 'pronunciation' && 
                          section.sectionType !== 'grammar' &&
                          !(section.sectionType === 'practice' && !section.sectionTitle);
      
      const sectionTitleHtml = showTitleRow && section.sectionTitle ? `
        <div class="lm-section-title-row">
          <span class="lm-section-number">${section.sectionNumber || idx + 1}</span>
          <span class="lm-section-title">${section.sectionTitle}</span>
        </div>
      ` : '';
      
      return `
      <div class="lm-section">
        <div class="lm-section-layout">
          <div class="lm-section-main">
            ${sectionTitleHtml}
            ${generatePreviewSectionHtml(section)}
          </div>
          ${hasSidebar ? `
          <div class="lm-section-sidebar">
            ${sidebarHtml}
          </div>
          ` : ''}
        </div>
      </div>
    `}).join('') || '';

    // CSS styles - using EXACT same styles from LessonMaterialMakerPage.css
    const previewCss = `
      /* CSS Variables */
      :root {
        --primary: #0245ae;
        --primary-light: #4a9eff;
        --primary-dark: #01337d;
        --bg-primary: #f8fafc;
        --bg-secondary: #ffffff;
        --text-primary: #1e293b;
        --text-secondary: #64748b;
        --border-color: #e2e8f0;
        --success: #10b981;
        --warning: #f59e0b;
        --warning-light: #fef3c7;
        --info-light: #dbeafe;
      }
      
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f1f5f9; color: #1e293b; line-height: 1.6; }
      
      /* Section Styles - Two Column Layout */
      .lm-section {
        margin-bottom: 48px;
        background: #fff;
        border-radius: 16px;
        padding: 32px;
        box-shadow: 0 2px 12px rgba(2, 69, 174, 0.06);
      }
      
      .lm-section-layout {
        display: flex;
        gap: 40px;
      }
      
      .lm-section-main {
        flex: 0 0 56%;
        max-width: 56%;
      }
      
      .lm-section-sidebar {
        flex: 0 0 42%;
        max-width: 42%;
      }
      
      /* Section Title Row */
      .lm-section-title-row {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 2px solid #e2e8f0;
      }
      
      .lm-section-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(2, 69, 174, 0.25);
      }
      
      .lm-section-title {
        font-size: 20px;
        font-weight: 800;
        color: var(--primary);
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      
      /* Section Explanation */
      .lm-section-explanation {
        font-size: 17px;
        line-height: 1.7;
        color: #1e293b;
        margin: 0 0 12px 0;
      }
      
      .lm-section-explanation-jp {
        font-size: 15px;
        line-height: 1.7;
        color: #64748b;
        margin: 0 0 28px 0;
        padding-left: 12px;
        border-left: 3px solid var(--primary-light);
      }
      
      /* Section Image */
      .lm-section-image-container { margin-top: 20px; }
      .lm-section-image-wrapper {
        position: relative;
        display: inline-block;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      }
      .lm-section-image { max-width: 100%; height: auto; display: block; }
      
      /* Lesson Goal Box */
      .lm-goal-box {
        border: none;
        border-radius: 12px;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 2px 12px rgba(2, 69, 174, 0.08);
      }
      
      .lm-goal-box-header {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        padding: 14px 20px;
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.3px;
      }
      
      .lm-goal-steps { padding: 20px; }
      
      .lm-goal-step {
        display: flex;
        gap: 14px;
        margin-bottom: 18px;
        padding-bottom: 18px;
        border-bottom: 1px solid #f1f5f9;
      }
      .lm-goal-step:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
      
      .lm-step-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        border-radius: 8px;
        flex-shrink: 0;
      }
      
      .lm-step-content { flex: 1; padding-top: 2px; }
      
      .lm-step-instruction {
        font-size: 14px;
        color: #1e293b;
        display: block;
        line-height: 1.5;
      }
      
      .lm-step-script {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
        padding: 8px 12px;
        background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
        border-radius: 8px;
        border-left: 3px solid var(--success);
      }
      
      .lm-script-bullet { color: var(--success); font-size: 8px; }
      
      .lm-script-text {
        font-size: 14px;
        font-style: italic;
        font-weight: 600;
        color: var(--success);
      }
      
      .lm-step-tip {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-top: 8px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
        border-radius: 8px;
        border-left: 3px solid #f97316;
      }
      
      .lm-tip-icon { color: #f97316; font-size: 10px; line-height: 1.6; }
      
      .lm-tip-text {
        font-size: 13px;
        font-weight: 600;
        color: #ea580c;
        line-height: 1.5;
      }
      
      /* Vocabulary Sidebar */
      .lm-vocab-sidebar {
        border: none;
        border-radius: 12px;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 2px 12px rgba(2, 69, 174, 0.08);
      }
      
      .lm-vocab-sidebar-header {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.3px;
      }
      
      .lm-vocab-sidebar-subheader {
        background: var(--info-light);
        padding: 10px 20px;
        font-size: 13px;
        font-weight: 700;
        color: var(--primary-dark);
      }
      
      /* Step Title */
      .lm-step-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 12px;
      }
      
      /* Vocabulary Instruction */
      .lm-vocab-instruction {
        font-size: 15px;
        line-height: 1.6;
        color: #475569;
        margin-bottom: 8px;
      }
      
      .lm-vocab-instruction-jp {
        font-size: 13px;
        color: #94a3b8;
        margin-bottom: 20px;
      }
      
      /* Vocabulary Grid */
      .lm-vocab-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
        margin: 20px 0;
      }
      
      .lm-vocab-card-preview {
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border: 1px solid #bae6fd;
        border-radius: 12px;
        padding: 16px;
        text-align: center;
      }
      
      .lm-vocab-image-wrapper { margin-bottom: 12px; }
      .lm-vocab-image { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin: 0 auto; }
      .lm-vocab-word { font-size: 20px; font-weight: 700; color: #0369a1; margin-bottom: 4px; }
      .lm-vocab-reading { font-size: 13px; color: #64748b; }
      .lm-vocab-meaning { font-size: 14px; color: #334155; margin-top: 4px; }
      
      /* Image Grid */
      .lm-image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 16px;
        margin: 20px 0;
      }
      
      .lm-image-card-preview { text-align: center; }
      .lm-image-card-img { width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; }
      .lm-image-card-label { font-size: 14px; font-weight: 600; color: #334155; }
      
      /* Pronunciation */
      .lm-pronunciation-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 24px;
        margin: 20px 0;
      }
      
      .lm-pronunciation-column {
        background: #f8fafc;
        border-radius: 8px;
        padding: 16px;
      }
      
      .lm-pronunciation-header {
        font-weight: 700;
        color: #3b82f6;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid #3b82f6;
        font-size: 18px;
      }
      
      .lm-pronunciation-word { padding: 8px 0; font-size: 15px; color: #334155; }
      .lm-word-jp { color: #64748b; font-size: 13px; }
      
      /* Grammar */
      .lm-grammar-rule {
        background: #fef3c7;
        border-left: 4px solid #eab308;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }
      
      .lm-grammar-rule-text { font-weight: 700; color: #854d0e; margin-bottom: 8px; font-size: 16px; }
      .lm-grammar-rule-jp { color: #713f12; margin-bottom: 12px; }
      .lm-grammar-example { background: rgba(255,255,255,0.5); padding: 8px 12px; border-radius: 6px; margin-top: 8px; }
      .lm-grammar-example-en { font-weight: 500; color: #78350f; }
      .lm-grammar-example-jp { font-size: 13px; color: #92400e; margin-top: 4px; }
      
      /* Dialogue */
      .lm-dialogue-image-wrapper { margin: 20px auto; text-align: center; }
      .lm-dialogue-image { max-width: 100%; border-radius: 12px; }
      .lm-dialogue-lines { margin: 20px 0; }
      .lm-dialogue-line {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        padding: 12px 16px;
        background: #f8fafc;
        border-radius: 8px;
      }
      .lm-dialogue-speaker { font-weight: 700; color: #3b82f6; min-width: 80px; }
      .lm-dialogue-en { color: #0f172a; }
      .lm-dialogue-jp { font-size: 13px; color: #64748b; margin-top: 4px; }
      
      /* Trivia */
      .lm-trivia-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin: 20px 0;
      }
      
      .lm-trivia-card {
        border-radius: 12px;
        padding: 16px;
      }
      .lm-trivia-card.correct { background: #f0fdf4; border: 1px solid #86efac; }
      .lm-trivia-card.incorrect { background: #fef2f2; border: 1px solid #fecaca; }
      .lm-trivia-line { margin-bottom: 12px; }
      .lm-trivia-speaker { font-weight: 600; color: #64748b; }
      .lm-trivia-indicator { text-align: right; margin-top: 8px; font-size: 18px; }
      
      /* Practice */
      .lm-practice-example {
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .lm-practice-example-label { font-size: 12px; font-weight: 700; color: #16a34a; text-transform: uppercase; margin-bottom: 8px; }
      .lm-practice-example-text { color: #334155; }
      .lm-practice-example-answer { color: #15803d; font-weight: 600; margin-top: 8px; }
      .lm-practice-items { margin: 16px 0; }
      .lm-practice-item {
        display: flex;
        gap: 12px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .lm-practice-number { font-weight: 700; color: #3b82f6; min-width: 24px; }
      .lm-practice-question { color: #334155; }
      
      /* Word Box */
      .lm-word-box {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 16px;
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 8px;
        margin: 16px 0;
      }
      .lm-word-box-item {
        background: #fff;
        border: 1px solid #0ea5e9;
        color: #0369a1;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
      }
      
      /* Conversation */
      .lm-conversation-lines { margin: 16px 0; }
      .lm-conversation-line {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        padding: 16px;
        background: #f8fafc;
        border-radius: 8px;
      }
      .lm-conversation-speaker { font-weight: 700; color: #3b82f6; min-width: 70px; }
      .lm-conversation-text { color: #334155; }
      .lm-blank { display: inline-block; min-width: 80px; border-bottom: 2px dashed #94a3b8; }
      
      /* Challenge */
      .lm-challenge-header { margin-bottom: 16px; }
      .lm-challenge-title {
        display: inline-block;
        background: #dc2626;
        color: #fff;
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 700;
      }
      .lm-challenge-optional {
        display: inline-block;
        background: #f59e0b;
        color: #fff;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        margin-left: 8px;
      }
      
      .lm-situation-box {
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
      }
      .lm-situation-label { font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase; margin-bottom: 8px; }
      .lm-situation-en { color: #78350f; white-space: pre-line; }
      .lm-situation-jp { font-size: 13px; color: #92400e; margin-top: 8px; white-space: pre-line; }
      
      .lm-grammar-tip-box {
        background: #f0fdfa;
        border: 1px solid #5eead4;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
      }
      .lm-grammar-tip-title { font-weight: 700; color: #0f766e; margin-bottom: 12px; }
      .lm-grammar-tip-items { display: flex; flex-wrap: wrap; gap: 8px; }
      .lm-grammar-tip-item { background: #ccfbf1; color: #0f766e; padding: 4px 12px; border-radius: 16px; font-size: 14px; }
      
      .lm-challenge-questions { margin: 16px 0; }
      .lm-challenge-question {
        background: #f8fafc;
        border-left: 4px solid #3b82f6;
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 10px;
      }
      .lm-challenge-question-text { font-weight: 500; color: #0f172a; }
      .lm-challenge-sub-question { font-size: 13px; color: #64748b; margin-top: 4px; padding-left: 16px; }
      
      .lm-topic-boxes {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        margin: 20px 0;
      }
      .lm-topic-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
      }
      .lm-topic-title {
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 2px solid #3b82f6;
      }
      .lm-topic-question { padding: 8px 0; font-size: 14px; color: #475569; }
      
      .lm-listening-script {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
        margin: 16px 0;
        font-size: 16px;
        line-height: 2;
        color: #334155;
        white-space: pre-line;
      }
      
      .lm-questions { margin: 16px 0; }
      .lm-question-item {
        background: #f8fafc;
        border-left: 4px solid #3b82f6;
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 10px;
      }
      .lm-question-text { font-weight: 500; color: #0f172a; }
      .lm-question-answer { color: #16a34a; font-weight: 600; margin-top: 8px; }
      
      .lm-reading-image-wrapper { margin: 20px auto; text-align: center; }
      .lm-reading-image { max-width: 100%; border-radius: 12px; }
      .lm-reading-dialogue {
        background: #f8fafc;
        border-radius: 12px;
        padding: 20px;
        margin: 16px 0;
      }
      .lm-reading-line {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        padding: 12px;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .lm-reading-speaker { font-weight: 700; color: #7c3aed; min-width: 70px; }
      .lm-reading-text { color: #334155; }
      
      @media print { body { background: #fff; } }
    `;

    const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${lessonTitle} - Preview</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${previewCss}</style>
</head>
<body>
  <header style="position:relative;min-height:140px;display:flex;flex-direction:column;background-size:cover;background-position:center;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);${draft.header?.backgroundImage ? `background-image:url(${draft.header.backgroundImage});` : 'background:linear-gradient(135deg,#0369a1 0%,#0ea5e9 100%);'}">
    <div style="position:absolute;inset:0;background-color:${draft.header?.overlayColor || 'rgba(0,0,0,0.45)'};"></div>
    <div style="position:relative;z-index:2;color:#fff;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px 16px;">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;font-size:11px;font-weight:600;opacity:0.95;text-transform:uppercase;letter-spacing:0.5px;">
        <span style="background:rgba(255,255,255,0.2);padding:3px 8px;border-radius:4px;font-weight:600;">${draft.header?.levelBadge || ''}</span>
        <span style="opacity:0.6;">|</span>
        <span>${draft.header?.chapterLabel || ''}</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;margin-bottom:8px;color:#fbbf24;">${draft.header?.lessonLabel || ''}</h1>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px;">
        <span style="display:inline-block;background:#22c55e;color:#fff;padding:4px 10px;border-radius:4px;font-weight:800;font-size:11px;letter-spacing:0.8px;">GOAL</span>
        <span style="font-size:22px;font-weight:800;text-shadow:0 2px 4px rgba(0,0,0,0.3);">${draft.header?.goalText || ''}</span>
      </div>
      <p style="font-size:14px;opacity:0.9;margin-top:4px;">${draft.header?.goalSubtext || ''}</p>
    </div>
  </header>
  <main style="max-width:1100px;margin:0 auto;padding:32px 24px;">
    ${sectionsHtml}
  </main>
</body>
</html>`;

    // Open in new tab
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(previewHtml);
      previewWindow.document.close();
    } else {
      toast.error('Unable to open preview. Please check your popup blocker settings.');
    }
  }, [currentEditingLesson, draft]);

  // Helper function to format lesson for export (inline for print)
  const formatLessonForExport = (data: LessonExportData): string => {
    let html = '';
    if (data.level || data.chapter || data.lesson) {
      html += `<div style="margin-bottom:16px;color:#6b7280;">${data.level || ''} ${data.chapter || ''} ${data.lesson || ''}</div>`;
    }
    if (data.goal) {
      html += `<div style="margin-bottom:24px;"><h2 style="margin:0 0 8px 0;">🎯 Lesson Goal</h2><p>${data.goal}</p></div>`;
    }
    if (data.sections) {
      for (const section of data.sections) {
        html += `<div style="margin-bottom:20px;page-break-inside:avoid;"><h2>${section.title}</h2><div>${section.content}</div></div>`;
      }
    }
    return html;
  };

  // Merge request comments
  const handleLoadComments = async (mrId: string) => {
    setIsLoadingComments(true);
    try {
      const result = await lessonApi.getMergeRequestComments(mrId);
      if (result.success && result.comments) {
        setMergeRequestComments(result.comments);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedMergeRequest || !newComment.trim()) return;
    
    try {
      const result = await lessonApi.addMergeRequestComment(selectedMergeRequest.id, newComment.trim());
      if (result.success && result.comment) {
        setMergeRequestComments(prev => [...prev, result.comment!]);
        setNewComment('');
      } else {
        alert(result.error || 'Failed to add comment');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add comment');
    }
  };

  // Load comments when opening merge review modal
  useEffect(() => {
    if (showMergeReviewModal && selectedMergeRequest) {
      handleLoadComments(selectedMergeRequest.id);
    } else {
      setMergeRequestComments([]);
      setNewComment('');
    }
  }, [showMergeReviewModal, selectedMergeRequest]);

  // View forks of a lesson
  const handleViewForks = async (lesson: SavedLesson) => {
    if (!lesson.serverLesson) {
      alert('This lesson is not synced with the server.');
      return;
    }
    
    try {
      const result = await lessonApi.getLessonForks(lesson.serverLesson.id);
      if (result.success && result.forks) {
        setLessonForks(result.forks);
        setSelectedLessonForForks(lesson.id);
        setShowForksPanel(true);
      } else {
        alert(result.error || 'Failed to load forks');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load forks');
    }
  };

  // Bulk actions
  const toggleLessonSelection = (lessonId: string) => {
    setSelectedLessonIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  const selectAllLessons = (lessons: SavedLesson[]) => {
    const allIds = lessons.filter(l => l.serverLesson).map(l => l.serverLesson!.id);
    setSelectedLessonIds(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedLessonIds(new Set());
  };

  useEffect(() => {
    setShowBulkActionsBar(selectedLessonIds.size > 0);
  }, [selectedLessonIds.size]);

  const handleBulkAction = async (action: 'publish' | 'unpublish' | 'archive' | 'delete') => {
    if (selectedLessonIds.size === 0) return;
    
    const actionLabel = {
      publish: 'publish',
      unpublish: 'unpublish',
      archive: 'archive',
      delete: 'delete'
    }[action];
    
    if (!await toastConfirm(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} ${selectedLessonIds.size} lesson(s)?`, 'Bulk Action')) {
      return;
    }
    
    setIsBulkActionLoading(true);
    try {
      const result = await lessonApi.bulkAction(action, Array.from(selectedLessonIds));
      if (result.success) {
        toast.success(result.message || `Bulk ${actionLabel} completed`);
        clearSelection();
        loadServerLessons();
      } else {
        toast.error(result.error || `Bulk ${actionLabel} failed`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Bulk ${actionLabel} failed`);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  // Diff viewer - compare two lesson versions
  const handleShowDiff = async (lesson: SavedLesson, versionA: number, versionB: number) => {
    if (!lesson.serverLesson) return;
    
    try {
      const [resA, resB] = await Promise.all([
        lessonApi.getVersion(lesson.serverLesson.id, versionA),
        lessonApi.getVersion(lesson.serverLesson.id, versionB)
      ]);
      
      if (resA.success && resB.success && resA.version && resB.version) {
        setDiffSource(resA.version.lessonData);
        setDiffTarget(resB.version.lessonData);
        setShowDiffViewer(true);
      } else {
        alert('Failed to load versions for comparison');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load versions');
    }
  };

  // Filter lessons based on advanced filters
  const applyFilters = useCallback((lessons: SavedLesson[]) => {
    let filtered = [...lessons];
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(l => l.status === statusFilter);
    }
    
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        l.goalName?.toLowerCase().includes(query) ||
        l.templateName?.toLowerCase().includes(query) ||
        l.chapter?.toLowerCase().includes(query)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = (a.goalName || '').localeCompare(b.goalName || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'date':
        default:
          comparison = new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  }, [statusFilter, searchQuery, sortBy, sortOrder]);

  // ============ END IMPROVEMENT HANDLERS ============

  // View template in read-only mode
  const handleViewTemplate = (template: TemplateInfo) => {
    setSelectedTemplate(template);
    setCurrentEditingLesson(null); // Not editing a lesson
    // Clear the editing lesson ID since we're viewing a template, not editing a lesson
    localStorage.removeItem(EDITING_LESSON_KEY);
    setDraft(getDraftForTemplate(template.id)); // Load template-specific draft
    setViewMode('editor');
    setIsFullscreen(true);
    // Push to browser history so back button works
    window.history.pushState(
      { viewMode: 'editor', templateId: template.id },
      '',
      `${window.location.pathname}?template=${template.id}`
    );
  };

  const handleBackToList = () => {
    // Save current lesson if editing
    if (currentEditingLesson) {
      setSavedLessons(prev =>
        prev.map(l =>
          l.id === currentEditingLesson.id
            ? { ...l, draft, updatedAt: new Date().toISOString() }
            : l
        )
      );
    }
    setViewMode('list');
    setCurrentEditingLesson(null);
    setSelectedTemplate(null);
    setIsFullscreen(false);
    // Clear the editing lesson ID from localStorage
    localStorage.removeItem(EDITING_LESSON_KEY);
    // Update history to list view
    window.history.pushState(
      { viewMode: 'list' },
      '',
      window.location.pathname
    );
  };

  // Group saved lessons by level > chapter > lesson
  const groupedLessons = savedLessons.reduce((acc, lesson) => {
    const levelKey = lesson.level;
    if (!acc[levelKey]) {
      acc[levelKey] = {};
    }
    const chapterKey = lesson.chapter;
    if (!acc[levelKey][chapterKey]) {
      acc[levelKey][chapterKey] = {};
    }
    const lessonKey = lesson.lessonNumber;
    if (!acc[levelKey][chapterKey][lessonKey]) {
      acc[levelKey][chapterKey][lessonKey] = [];
    }
    acc[levelKey][chapterKey][lessonKey].push(lesson);
    return acc;
  }, {} as Record<number, Record<number, Record<number, SavedLesson[]>>>);

  // Template List View - also show when editing but not in fullscreen
  // This allows users to see the lesson list while having an edit session in progress
  if (viewMode === 'list' || (viewMode === 'editor' && !isFullscreen)) {
    return (
      <div className="lm-template-list">
        {/* New Lesson Modal */}
        {showNewLessonModal && selectedTemplateForLesson && (
          <div className="lm-modal-overlay" onClick={() => setShowNewLessonModal(false)}>
            <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="lm-modal-header">
                <h2>Create New Lesson</h2>
                <button
                  type="button"
                  className="lm-modal-close"
                  onClick={() => setShowNewLessonModal(false)}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="lm-modal-body">
                <p className="lm-modal-template-info">
                  <span className="lm-modal-template-icon">{selectedTemplateForLesson.icon}</span>
                  Using template: <strong>{selectedTemplateForLesson.name}</strong>
                </p>
                <div className="lm-form-row">
                  <div className="lm-form-group">
                    <label>Level</label>
                    <input
                      type="number"
                      min="1"
                      value={newLessonForm.level}
                      onInput={(e) => setNewLessonForm(prev => ({
                        ...prev,
                        level: parseInt((e.target as HTMLInputElement).value) || 1
                      }))}
                    />
                  </div>
                  <div className="lm-form-group">
                    <label>Chapter</label>
                    <input
                      type="number"
                      min="1"
                      value={newLessonForm.chapter}
                      onInput={(e) => setNewLessonForm(prev => ({
                        ...prev,
                        chapter: parseInt((e.target as HTMLInputElement).value) || 1
                      }))}
                    />
                  </div>
                  <div className="lm-form-group">
                    <label>Lesson #</label>
                    <input
                      type="number"
                      min="1"
                      value={newLessonForm.lessonNumber}
                      onInput={(e) => setNewLessonForm(prev => ({
                        ...prev,
                        lessonNumber: parseInt((e.target as HTMLInputElement).value) || 1
                      }))}
                    />
                  </div>
                </div>
                <div className="lm-form-group full">
                  <label>Goal Name</label>
                  <input
                    type="text"
                    placeholder="e.g., I can introduce myself"
                    value={newLessonForm.goalName}
                    onInput={(e) => setNewLessonForm(prev => ({
                      ...prev,
                      goalName: (e.target as HTMLInputElement).value
                    }))}
                  />
                </div>
              </div>
              <div className="lm-modal-footer">
                <button
                  type="button"
                  className="lm-modal-btn secondary"
                  onClick={() => setShowNewLessonModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="lm-modal-btn primary"
                  onClick={handleCreateLesson}
                  disabled={!newLessonForm.goalName.trim()}
                >
                  <i className="ri-add-line" />
                  Create Lesson
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fork Confirmation Modal */}
        {showForkConfirmModal && lessonToFork && (
          <div className="lm-modal-overlay" onClick={() => setShowForkConfirmModal(false)}>
            <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="lm-modal-header">
                <h2>
                  <i className="ri-git-branch-line" />
                  Fork Lesson
                </h2>
                <button
                  type="button"
                  className="lm-modal-close"
                  onClick={() => setShowForkConfirmModal(false)}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="lm-modal-body">
                <p>
                  Create a personal copy of <strong>"{lessonToFork.goalName}"</strong> that you can edit independently.
                </p>
                <div className="lm-fork-info">
                  <div className="lm-fork-info-item">
                    <i className="ri-edit-line" />
                    <span>You can make any changes to your fork</span>
                  </div>
                  <div className="lm-fork-info-item">
                    <i className="ri-git-merge-line" />
                    <span>Submit changes back via merge request</span>
                  </div>
                  <div className="lm-fork-info-item">
                    <i className="ri-shield-check-line" />
                    <span>Original author reviews and approves changes</span>
                  </div>
                </div>
              </div>
              <div className="lm-modal-footer">
                <button
                  type="button"
                  className="lm-modal-btn secondary"
                  onClick={() => setShowForkConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="lm-modal-btn primary"
                  onClick={confirmForkLesson}
                >
                  <i className="ri-git-branch-line" />
                  Fork Lesson
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Merge Request Modal */}
        {showMergeRequestModal && lessonToFork && (
          <div className="lm-modal-overlay" onClick={() => setShowMergeRequestModal(false)}>
            <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="lm-modal-header">
                <h2>
                  <i className="ri-git-merge-line" />
                  Submit Merge Request
                </h2>
                <button
                  type="button"
                  className="lm-modal-close"
                  onClick={() => setShowMergeRequestModal(false)}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="lm-modal-body">
                <p>
                  Submit your changes from <strong>"{lessonToFork.goalName}"</strong> to the original lesson for review.
                </p>
                <div className="lm-form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    placeholder="Brief description of your changes"
                    value={mergeRequestForm.title}
                    onInput={(e) => setMergeRequestForm(prev => ({
                      ...prev,
                      title: (e.target as HTMLInputElement).value
                    }))}
                  />
                </div>
                <div className="lm-form-group">
                  <label>Description (optional)</label>
                  <textarea
                    placeholder="Detailed explanation of the changes you made..."
                    value={mergeRequestForm.description}
                    rows={4}
                    onInput={(e) => setMergeRequestForm(prev => ({
                      ...prev,
                      description: (e.target as HTMLTextAreaElement).value
                    }))}
                  />
                </div>
              </div>
              <div className="lm-modal-footer">
                <button
                  type="button"
                  className="lm-modal-btn secondary"
                  onClick={() => setShowMergeRequestModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="lm-modal-btn primary"
                  onClick={submitMergeRequest}
                >
                  <i className="ri-send-plane-line" />
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Merge Review Modal - with comments */}
        {showMergeReviewModal && selectedMergeRequest && (
          <div className="lm-modal-overlay" onClick={() => setShowMergeReviewModal(false)}>
            <div className="lm-modal lm-modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="lm-modal-header">
                <h2>
                  <i className="ri-git-merge-line" />
                  Review Merge Request
                </h2>
                <button
                  type="button"
                  className="lm-modal-close"
                  onClick={() => setShowMergeReviewModal(false)}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="lm-modal-body">
                <div className="lm-mr-details">
                  <h3>{selectedMergeRequest.title}</h3>
                  {selectedMergeRequest.description && (
                    <p className="lm-mr-description">{selectedMergeRequest.description}</p>
                  )}
                  <div className="lm-mr-meta">
                    <span>
                      <i className="ri-user-line" />
                      Submitted by: {selectedMergeRequest.requestedByName || selectedMergeRequest.requestedBy}
                    </span>
                    <span>
                      <i className="ri-time-line" />
                      {new Date(selectedMergeRequest.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Visual Diff Viewer */}
                {selectedMergeRequest.sourceLesson?.content && selectedMergeRequest.targetLesson?.content && (
                  <div className="lm-diff-section">
                    <h4>
                      <i className="ri-file-copy-2-line" />
                      Changes
                    </h4>
                    <DiffViewer
                      source={selectedMergeRequest.sourceLesson.content as LessonMaterial}
                      target={selectedMergeRequest.targetLesson.content as LessonMaterial}
                      sourceName={selectedMergeRequest.sourceLesson.title || 'Fork'}
                      targetName={selectedMergeRequest.targetLesson.title || 'Original'}
                      onClose={() => {}}
                      embedded={true}
                    />
                  </div>
                )}
                
                {/* Comments Section */}
                <div className="lm-mr-comments">
                  <h4>
                    <i className="ri-chat-3-line" />
                    Discussion ({mergeRequestComments.length})
                  </h4>
                  {isLoadingComments ? (
                    <p className="lm-loading">Loading comments...</p>
                  ) : mergeRequestComments.length === 0 ? (
                    <p className="lm-no-comments">No comments yet.</p>
                  ) : (
                    <div className="lm-comments-list">
                      {mergeRequestComments.map(comment => (
                        <div key={comment.id} className="lm-comment">
                          <div className="lm-comment-header">
                            <span className="lm-comment-author">{comment.authorName}</span>
                            <span className="lm-comment-date">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="lm-comment-content">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="lm-add-comment">
                    <textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onInput={(e) => setNewComment((e.target as HTMLTextAreaElement).value)}
                      rows={2}
                    />
                    <button
                      type="button"
                      className="lm-add-comment-btn"
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                    >
                      <i className="ri-send-plane-fill" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="lm-modal-footer lm-mr-actions">
                <button
                  type="button"
                  className="lm-modal-btn secondary"
                  onClick={() => setShowMergeReviewModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="lm-modal-btn danger"
                  onClick={() => submitMergeReview('reject')}
                >
                  <i className="ri-close-circle-line" />
                  Reject
                </button>
                <button
                  type="button"
                  className="lm-modal-btn success"
                  onClick={() => submitMergeReview('merge')}
                >
                  <i className="ri-git-merge-line" />
                  Merge Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Version Restore Modal */}
        {showVersionRestoreModal && lessonToFork && (
          <div className="lm-modal-overlay" onClick={() => setShowVersionRestoreModal(false)}>
            <div className="lm-modal lm-modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="lm-modal-header">
                <h2>
                  <i className="ri-history-line" />
                  Version History
                </h2>
                <button
                  type="button"
                  className="lm-modal-close"
                  onClick={() => setShowVersionRestoreModal(false)}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="lm-modal-body">
                <p className="lm-version-info">
                  <strong>{lessonToFork.goalName}</strong> - Select a version to restore
                </p>
                <div className="lm-versions-list">
                  {lessonVersions.length === 0 ? (
                    <p className="lm-no-versions">No version history available.</p>
                  ) : (
                    lessonVersions.map(version => (
                      <div key={version.id} className="lm-version-item">
                        <div className="lm-version-info-row">
                          <span className="lm-version-number">v{version.versionNumber}</span>
                          <span className="lm-version-date">
                            {new Date(version.createdAt).toLocaleString()}
                          </span>
                          <span className="lm-version-author">
                            by {version.changedByName || version.changedBy}
                          </span>
                        </div>
                        {version.changeSummary && (
                          <p className="lm-version-summary">{version.changeSummary}</p>
                        )}
                        <div className="lm-version-actions">
                          <button
                            type="button"
                            className="lm-version-btn restore"
                            onClick={() => handleRestoreVersion(version)}
                          >
                            <i className="ri-arrow-go-back-line" /> Restore
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="lm-modal-footer">
                <button
                  type="button"
                  className="lm-modal-btn secondary"
                  onClick={() => setShowVersionRestoreModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Forks Panel */}
        {showForksPanel && (
          <div className="lm-modal-overlay" onClick={() => setShowForksPanel(false)}>
            <div className="lm-modal lm-modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="lm-modal-header">
                <h2>
                  <i className="ri-git-repository-line" />
                  Lesson Forks
                </h2>
                <button
                  type="button"
                  className="lm-modal-close"
                  onClick={() => setShowForksPanel(false)}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="lm-modal-body">
                {lessonForks.length === 0 ? (
                  <p className="lm-no-forks">No forks have been created for this lesson.</p>
                ) : (
                  <div className="lm-forks-list">
                    {lessonForks.map(fork => (
                      <div key={fork.id} className="lm-fork-item">
                        <div className="lm-fork-info">
                          <span className="lm-fork-title">{fork.title}</span>
                          <span className="lm-fork-author">
                            by {fork.createdByName || fork.createdBy}
                          </span>
                          <span className="lm-fork-date">
                            {new Date(fork.createdAt).toLocaleDateString()}
                          </span>
                          <span className={`lm-fork-status ${fork.status}`}>
                            {fork.status}
                          </span>
                        </div>
                        {fork.hasPendingMergeRequest && (
                          <span className="lm-fork-mr-badge">
                            <i className="ri-git-merge-line" /> Pending MR
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="lm-modal-footer">
                <button
                  type="button"
                  className="lm-modal-btn secondary"
                  onClick={() => setShowForksPanel(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diff Viewer Modal */}
        {showDiffViewer && diffSource && diffTarget && (
          <div className="lm-modal-overlay" onClick={() => setShowDiffViewer(false)}>
            <div className="lm-modal lm-modal-fullscreen" onClick={(e) => e.stopPropagation()}>
              <div className="lm-modal-header">
                <h2>
                  <i className="ri-file-diff-line" />
                  Version Comparison
                </h2>
                <button
                  type="button"
                  className="lm-modal-close"
                  onClick={() => setShowDiffViewer(false)}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="lm-modal-body lm-diff-body">
                <div className="lm-diff-container">
                  <div className="lm-diff-panel">
                    <h4>Source Version</h4>
                    <pre className="lm-diff-content">
                      {JSON.stringify(diffSource, null, 2)}
                    </pre>
                  </div>
                  <div className="lm-diff-panel">
                    <h4>Target Version</h4>
                    <pre className="lm-diff-content">
                      {JSON.stringify(diffTarget, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
              <div className="lm-modal-footer">
                <button
                  type="button"
                  className="lm-modal-btn secondary"
                  onClick={() => setShowDiffViewer(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="lm-template-header">
          <div className="lm-template-title-row">
            <div className="lm-template-icon">
              <i className="ri-file-list-3-line" />
            </div>
            <div>
              <h1 className="lm-template-title">Lesson Materials</h1>
              <p className="lm-template-subtitle">
                {activeTab === 'templates' 
                  ? `${Object.keys(groupedTemplates).length} courses • ${COURSE_TEMPLATES.length} templates`
                  : `${savedLessons.length} lessons created`
                }
              </p>
            </div>
          </div>
          <div className="lm-search-filter-row">
            <div className="lm-template-search">
              <i className="ri-search-line" />
              <input
                type="text"
                placeholder={activeTab === 'templates' ? 'Search templates...' : 'Search lessons...'}
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </div>
            {activeTab === 'myLessons' && (
              <>
                <button
                  type="button"
                  className={`lm-filter-toggle ${showFiltersPanel ? 'active' : ''}`}
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  title="Toggle filters"
                >
                  <i className="ri-filter-3-line" />
                  Filters
                </button>
                {selectedLessonIds.size > 0 && (
                  <button
                    type="button"
                    className="lm-clear-selection"
                    onClick={clearSelection}
                  >
                    Clear selection ({selectedLessonIds.size})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFiltersPanel && activeTab === 'myLessons' && (
          <div className="lm-filters-panel">
            <div className="lm-filter-group">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value as typeof statusFilter)}
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="finished">Finished</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="lm-filter-group">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as typeof sortBy)}
              >
                <option value="date">Date</option>
                <option value="title">Title</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div className="lm-filter-group">
              <label>Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder((e.target as HTMLSelectElement).value as typeof sortOrder)}
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {showBulkActionsBar && (
          <div className="lm-bulk-actions-bar">
            <span className="lm-bulk-count">{selectedLessonIds.size} selected</span>
            <div className="lm-bulk-buttons">
              <button
                type="button"
                className="lm-bulk-btn publish"
                onClick={() => handleBulkAction('publish')}
                disabled={isBulkActionLoading}
              >
                <i className="ri-upload-cloud-line" /> Publish
              </button>
              <button
                type="button"
                className="lm-bulk-btn unpublish"
                onClick={() => handleBulkAction('unpublish')}
                disabled={isBulkActionLoading}
              >
                <i className="ri-download-cloud-line" /> Unpublish
              </button>
              <button
                type="button"
                className="lm-bulk-btn archive"
                onClick={() => handleBulkAction('archive')}
                disabled={isBulkActionLoading}
              >
                <i className="ri-archive-line" /> Archive
              </button>
              <button
                type="button"
                className="lm-bulk-btn delete"
                onClick={() => handleBulkAction('delete')}
                disabled={isBulkActionLoading}
              >
                <i className="ri-delete-bin-line" /> Delete
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="lm-stats-grid">
          <div className="lm-stat-card">
            <div className="lm-stat-icon blue">
              <i className="ri-book-open-line" />
            </div>
            <div className="lm-stat-content">
              <span className="lm-stat-value">{savedLessons.length}</span>
              <span className="lm-stat-label">Total Lessons</span>
            </div>
          </div>
          <div className="lm-stat-card">
            <div className="lm-stat-icon green">
              <i className="ri-check-double-line" />
            </div>
            <div className="lm-stat-content">
              <span className="lm-stat-value">{savedLessons.filter(l => l.status === 'published').length}</span>
              <span className="lm-stat-label">Published</span>
            </div>
          </div>
          <div className="lm-stat-card">
            <div className="lm-stat-icon orange">
              <i className="ri-draft-line" />
            </div>
            <div className="lm-stat-content">
              <span className="lm-stat-value">{savedLessons.filter(l => l.status === 'draft').length}</span>
              <span className="lm-stat-label">Drafts</span>
            </div>
          </div>
          <div className="lm-stat-card">
            <div className="lm-stat-icon purple">
              <i className="ri-git-branch-line" />
            </div>
            <div className="lm-stat-content">
              <span className="lm-stat-value">{savedLessons.filter(l => l.isFork).length}</span>
              <span className="lm-stat-label">Forks</span>
            </div>
          </div>
          {pendingMergeRequests.length > 0 && (
            <div 
              className="lm-stat-card lm-stat-clickable"
              onClick={() => {
                // Show first pending merge request
                if (pendingMergeRequests.length > 0) {
                  handleReviewMergeRequest(pendingMergeRequests[0]);
                }
              }}
            >
              <div className="lm-stat-icon red">
                <i className="ri-git-merge-line" />
              </div>
              <div className="lm-stat-content">
                <span className="lm-stat-value">{pendingMergeRequests.length}</span>
                <span className="lm-stat-label">Pending Merge Requests</span>
              </div>
            </div>
          )}
        </div>

        {/* Editing in Progress Banner */}
        {currentEditingLesson && (
          <div className="lm-editing-banner">
            <div className="lm-editing-banner-content">
              <i className="ri-edit-circle-line" />
              <div className="lm-editing-banner-info">
                <span className="lm-editing-banner-label">Editing in progress</span>
                <span className="lm-editing-banner-title">
                  Level {currentEditingLesson.level} • Ch.{currentEditingLesson.chapter} • L{currentEditingLesson.lessonNumber}: {currentEditingLesson.goalName}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="lm-editing-banner-btn"
              onClick={() => setIsFullscreen(true)}
              title="Continue Editing"
            >
              <i className="ri-fullscreen-line" />
              <span>Continue Editing</span>
            </button>
          </div>
        )}

        {/* Viewing Template Banner */}
        {selectedTemplate && !currentEditingLesson && (
          <div className="lm-editing-banner lm-viewing-banner">
            <div className="lm-editing-banner-content">
              <i className="ri-eye-line" />
              <div className="lm-editing-banner-info">
                <span className="lm-editing-banner-label">Viewing Template</span>
                <span className="lm-editing-banner-title">{selectedTemplate.name}</span>
              </div>
            </div>
            <div className="lm-viewing-banner-actions">
              <button
                type="button"
                className="lm-editing-banner-btn secondary"
                onClick={() => setIsFullscreen(true)}
                title="View Fullscreen"
              >
                <i className="ri-fullscreen-line" />
                <span>View</span>
              </button>
              <button
                type="button"
                className="lm-editing-banner-btn"
                onClick={() => handleUseTemplate(selectedTemplate)}
                title="Use this template"
              >
                <i className="ri-add-line" />
                <span>Use Template</span>
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="lm-tabs">
          <button
            type="button"
            className={`lm-tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <i className="ri-layout-grid-line" />
            Templates
          </button>
          <button
            type="button"
            className={`lm-tab ${activeTab === 'myLessons' ? 'active' : ''}`}
            onClick={() => setActiveTab('myLessons')}
          >
            <i className="ri-book-open-line" />
            My Lessons
            {savedLessons.length > 0 && (
              <span className="lm-tab-badge">{savedLessons.length}</span>
            )}
          </button>
        </div>

        {/* Templates Tab Content */}
        {activeTab === 'templates' && (
          <>
            <div className="lm-course-list">
              {filteredCourses.map(([course, data]) => {
                const isExpanded = expandedCourses.includes(course);
                const publishedCount = data.templates.filter(t => t.status === 'published').length;
                
                return (
                  <div key={course} className={`lm-course-item ${isExpanded ? 'expanded' : ''}`}>
                    <button
                      type="button"
                      className="lm-course-header"
                      onClick={() => toggleCourse(course)}
                    >
                      <div className="lm-course-info">
                        <span className="lm-course-icon">{data.icon}</span>
                        <div className="lm-course-details">
                          <h3 className="lm-course-name">{course}</h3>
                          <span className="lm-course-meta">
                            {data.templates.length} templates • {publishedCount} published
                          </span>
                        </div>
                      </div>
                      <div className="lm-course-toggle">
                        <span className="lm-course-category">{data.category}</span>
                        <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="lm-course-templates">
                        <table className="lm-templates-table">
                          <thead>
                            <tr>
                              <th>Template</th>
                              <th>Sections</th>
                              <th>Status</th>
                              <th>Updated</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.templates.map(template => (
                              <tr key={template.id}>
                                <td className="lm-tpl-name">
                                  <strong>{template.name}</strong>
                                  <span>{template.description}</span>
                                </td>
                                <td className="lm-tpl-sections">{template.sections}</td>
                                <td>
                                  <span className={`lm-tpl-status ${template.status}`}>
                                    {template.status === 'published' ? 'Published' : 'Draft'}
                                  </span>
                                </td>
                                <td className="lm-tpl-date">{template.lastUpdated}</td>
                                <td className="lm-tpl-actions">
                                  <button
                                    type="button"
                                    className="lm-tpl-btn view"
                                    onClick={() => handleViewTemplate(template)}
                                    title="View Template"
                                  >
                                    <i className="ri-eye-line" />
                                  </button>
                                  <button
                                    type="button"
                                    className="lm-tpl-btn use"
                                    onClick={() => handleUseTemplate(template)}
                                    title="Use Template"
                                  >
                                    <i className="ri-add-line" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredCourses.length === 0 && (
              <div className="lm-template-empty">
                <div className="lm-template-empty-icon">
                  <i className="ri-search-line" />
                </div>
                <h3>No templates found</h3>
                <p>Try adjusting your search criteria</p>
                <button
                  type="button"
                  className="lm-template-reset-btn"
                  onClick={() => setSearchQuery('')}
                >
                  <i className="ri-refresh-line" />
                  Clear Search
                </button>
              </div>
            )}
          </>
        )}

        {/* My Lessons Tab Content */}
        {activeTab === 'myLessons' && (
          <>
            {savedLessons.length === 0 ? (
              <div className="lm-template-empty">
                <div className="lm-template-empty-icon">
                  <i className="ri-book-open-line" />
                </div>
                <h3>No lessons yet</h3>
                <p>Create your first lesson by selecting a template</p>
                <button
                  type="button"
                  className="lm-template-reset-btn"
                  onClick={() => setActiveTab('templates')}
                >
                  <i className="ri-layout-grid-line" />
                  Browse Templates
                </button>
              </div>
            ) : (
              <div className="lm-lessons-list">
                {Object.entries(groupedLessons)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([level, chapters]) => {
                    const levelNum = Number(level);
                    const isLevelExpanded = expandedLevels.includes(levelNum);
                    const lessonCount = Object.values(chapters).reduce(
                      (sum, lessons) => sum + Object.values(lessons).reduce((s, l) => s + l.length, 0),
                      0
                    );

                    return (
                      <div key={level} className={`lm-level-group ${isLevelExpanded ? 'expanded' : ''}`}>
                        <button
                          type="button"
                          className="lm-level-header"
                          onClick={() => toggleLevel(levelNum)}
                        >
                          <div className="lm-level-info">
                            <span className="lm-level-badge">Level {level}</span>
                            <span className="lm-level-count">{lessonCount} lesson{lessonCount !== 1 ? 's' : ''}</span>
                          </div>
                          <i className={`ri-arrow-${isLevelExpanded ? 'up' : 'down'}-s-line`} />
                        </button>

                        {isLevelExpanded && (
                          <div className="lm-level-content">
                            {Object.entries(chapters)
                              .sort(([a], [b]) => Number(a) - Number(b))
                              .map(([chapter, lessons]) => (
                                <div key={chapter} className="lm-chapter-group">
                                  <h4 className="lm-chapter-title">Chapter {chapter}</h4>
                                  {Object.entries(lessons)
                                    .sort(([a], [b]) => Number(a) - Number(b))
                                    .map(([lessonNum, lessonList]) => (
                                      <div key={lessonNum} className="lm-lesson-group">
                                        <h5 className="lm-lesson-title">Lesson {lessonNum}</h5>
                                        <div className="lm-lesson-cards">
                                          {lessonList.map(lesson => (
                                            <div key={lesson.id} className={`lm-lesson-card ${lesson.isFork ? 'is-fork' : ''}`}>
                                              <div className="lm-lesson-card-main">
                                                <div className="lm-lesson-goal">
                                                  {lesson.goalName}
                                                  {lesson.isFork && (
                                                    <span className="lm-fork-badge" title="This is a fork">
                                                      <i className="ri-git-branch-line" /> Fork
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="lm-lesson-meta">
                                                  <span className="lm-lesson-template">
                                                    <i className="ri-file-copy-line" />
                                                    {lesson.templateName}
                                                  </span>
                                                  <span className={`lm-lesson-status ${lesson.status}`}>
                                                    {lesson.status}
                                                  </span>
                                                  {lesson.currentVersion && (
                                                    <span className="lm-lesson-version" title="Current version">
                                                      v{lesson.currentVersion}
                                                    </span>
                                                  )}
                                                  {lesson.forkCount && lesson.forkCount > 0 && (
                                                    <span className="lm-fork-count" title={`${lesson.forkCount} fork(s)`}>
                                                      <i className="ri-git-branch-line" /> {lesson.forkCount}
                                                    </span>
                                                  )}
                                                  {lesson.hasPendingMergeRequest && (
                                                    <span className="lm-mr-badge" title="Has pending merge request">
                                                      <i className="ri-git-merge-line" /> MR
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="lm-lesson-card-actions">
                                                {/* Bulk select checkbox */}
                                                {lesson.serverLesson && (
                                                  <label className="lm-bulk-checkbox" title="Select for bulk action">
                                                    <input
                                                      type="checkbox"
                                                      checked={selectedLessonIds.has(lesson.serverLesson.id)}
                                                      onChange={() => toggleLessonSelection(lesson.serverLesson!.id)}
                                                    />
                                                  </label>
                                                )}
                                                <button
                                                  type="button"
                                                  className="lm-lesson-btn edit"
                                                  onClick={() => handleEditLesson(lesson)}
                                                  title="Edit Lesson"
                                                >
                                                  <i className="ri-edit-line" />
                                                </button>
                                                {/* Version history button */}
                                                {lesson.serverLesson && (
                                                  <button
                                                    type="button"
                                                    className="lm-lesson-btn versions"
                                                    onClick={() => handleShowVersions(lesson)}
                                                    title="View version history"
                                                  >
                                                    <i className="ri-history-line" />
                                                  </button>
                                                )}
                                                {/* Status workflow buttons */}
                                                {/* Draft -> Mark as Finished */}
                                                {lesson.serverLesson && lesson.status === 'draft' && (
                                                  <button
                                                    type="button"
                                                    className="lm-lesson-btn finish"
                                                    onClick={() => handleMarkAsFinished(lesson)}
                                                    title="Mark as finished"
                                                  >
                                                    <i className="ri-check-double-line" />
                                                  </button>
                                                )}
                                                {/* Finished -> Publish or Back to Draft */}
                                                {lesson.serverLesson && lesson.status === 'finished' && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      className="lm-lesson-btn publish"
                                                      onClick={() => handlePublishLesson(lesson)}
                                                      title="Publish lesson"
                                                    >
                                                      <i className="ri-upload-cloud-line" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className="lm-lesson-btn draft"
                                                      onClick={() => handleMarkAsDraft(lesson)}
                                                      title="Back to draft"
                                                    >
                                                      <i className="ri-edit-2-line" />
                                                    </button>
                                                  </>
                                                )}
                                                {/* Published -> Unpublish */}
                                                {lesson.serverLesson && lesson.status === 'published' && (
                                                  <button
                                                    type="button"
                                                    className="lm-lesson-btn unpublish"
                                                    onClick={() => handleUnpublishLesson(lesson)}
                                                    title="Unpublish (back to draft)"
                                                  >
                                                    <i className="ri-download-cloud-line" />
                                                  </button>
                                                )}
                                                {/* Fork button - only for non-fork lessons */}
                                                {!lesson.isFork && lesson.serverLesson && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      className="lm-lesson-btn fork"
                                                      onClick={() => handleForkLesson(lesson)}
                                                      title="Fork this lesson to create your own version"
                                                    >
                                                      <i className="ri-git-branch-line" />
                                                    </button>
                                                    {/* View forks */}
                                                    {lesson.forkCount && lesson.forkCount > 0 && (
                                                      <button
                                                        type="button"
                                                        className="lm-lesson-btn view-forks"
                                                        onClick={() => handleViewForks(lesson)}
                                                        title={`View ${lesson.forkCount} fork(s)`}
                                                      >
                                                        <i className="ri-git-repository-line" />
                                                      </button>
                                                    )}
                                                  </>
                                                )}
                                                {/* Merge request button - only for fork lessons */}
                                                {lesson.isFork && lesson.forkOf && !lesson.hasPendingMergeRequest && (
                                                  <button
                                                    type="button"
                                                    className="lm-lesson-btn merge"
                                                    onClick={() => handleCreateMergeRequest(lesson)}
                                                    title="Submit changes to original"
                                                  >
                                                    <i className="ri-git-merge-line" />
                                                  </button>
                                                )}
                                                {/* Save as template */}
                                                {lesson.serverLesson && !lesson.isFork && (
                                                  <button
                                                    type="button"
                                                    className="lm-lesson-btn template"
                                                    onClick={() => handleSaveAsTemplate(lesson)}
                                                    title="Save as template"
                                                  >
                                                    <i className="ri-file-copy-2-line" />
                                                  </button>
                                                )}
                                                {/* Archive button */}
                                                {lesson.serverLesson && lesson.status !== 'archived' && (
                                                  <button
                                                    type="button"
                                                    className="lm-lesson-btn archive"
                                                    onClick={() => handleArchiveLesson(lesson)}
                                                    title="Archive lesson"
                                                  >
                                                    <i className="ri-archive-line" />
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  className="lm-lesson-btn delete"
                                                  onClick={() => handleDeleteLesson(lesson.id)}
                                                  title="Delete Lesson"
                                                >
                                                  <i className="ri-delete-bin-line" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Editor View (existing code)
  return (
    <div className={`lm-builder ${isFullscreen ? 'lm-builder-fullscreen' : ''} ${isPreviewMode ? 'lm-preview-mode' : ''}`}>
      {/* Hidden file input for header image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="lm-hidden-input"
        onChange={handleImageUpload}
      />

      {/* Floating Toolbar */}
      <div className="lm-toolbar">
        <div className="lm-toolbar-title">
          <button
            type="button"
            className="lm-back-btn"
            onClick={handleBackToList}
            title="Back to List"
          >
            <i className="ri-arrow-left-line" />
          </button>
          {selectedTemplate && !currentEditingLesson ? (
            <>
              <i className="ri-eye-line" />
              <span className="lm-toolbar-template-view">
                <span className="lm-view-badge">VIEW ONLY</span>
                {selectedTemplate.name}
              </span>
            </>
          ) : (
            <>
              <i className="ri-file-edit-line" />
              <span>
                {currentEditingLesson 
                  ? `Level ${currentEditingLesson.level} • Ch.${currentEditingLesson.chapter} • L${currentEditingLesson.lessonNumber}: ${currentEditingLesson.goalName}`
                  : 'Lesson Builder'
                }
              </span>
            </>
          )}
        </div>
        <div className="lm-toolbar-actions">
          {/* Template view mode - show Use Template button */}
          {selectedTemplate && !currentEditingLesson && (
            <button
              type="button"
              className="lm-toolbar-btn primary"
              onClick={() => {
                setIsFullscreen(false);
                handleUseTemplate(selectedTemplate);
              }}
              title="Create lesson from this template"
            >
              <i className="ri-add-line" />
              <span>Use Template</span>
            </button>
          )}

          {/* Only show save controls when editing a lesson */}
          {currentEditingLesson && (
            <>
              {/* Autosave status */}
              <div
                className={`lm-autosave-status ${hasUnsavedChanges ? 'has-changes' : ''}`}
                title={
                  isSaving
                    ? 'Saving...'
                    : saveError
                      ? 'Save failed'
                      : hasUnsavedChanges
                        ? 'You have unsaved changes'
                        : lastSaved
                          ? `Saved ${formatTimeAgo(lastSaved)}`
                          : 'Not saved yet'
                }
              >
            {isSaving ? (
              <>
                <i className="ri-loader-4-line spinning" />
                <span>Saving...</span>
              </>
            ) : saveError ? (
              <>
                <i className="ri-error-warning-line error-icon" />
                <span className="error-text">Save failed</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <i className="ri-edit-circle-line unsaved-icon" />
                <span className="unsaved-text">Unsaved changes</span>
              </>
            ) : lastSaved ? (
              <>
                <i className="ri-check-line success-icon" />
                <span>Saved {formatTimeAgo(lastSaved)}</span>
              </>
            ) : (
              <>
                <i className="ri-cloud-line" />
                <span>Not saved yet</span>
              </>
            )}
          </div>

          {/* Collaborative Editing Indicator */}
          {currentEditingLesson?.serverLesson && socketEditors.length > 0 && (
            <div className="lm-collaborators-badge" title={`${socketEditors.length} editor${socketEditors.length !== 1 ? 's' : ''} online`}>
              <i className="ri-team-line" />
              <span className="count">{socketEditors.length}</span>
              <div className="lm-editor-avatars">
                {socketEditors.slice(0, 3).map((editor, i) => (
                  <div key={editor.odI || i} className="lm-editor-avatar">
                    {editor.userName?.charAt(0)?.toUpperCase() || '?'}
                    <span className="lm-editor-tooltip">{editor.userName}</span>
                  </div>
                ))}
                {socketEditors.length > 3 && (
                  <div className="lm-editor-avatar">+{socketEditors.length - 3}</div>
                )}
              </div>
            </div>
          )}

          {/* Connection Status */}
          {currentEditingLesson?.serverLesson && (
            <div className={`lm-collab-status ${isSocketConnected ? 'connected' : 'disconnected'}`} title={isSocketConnected ? 'Connected to collaboration server' : 'Disconnected from collaboration server'}>
              <span className="status-dot" />
            </div>
          )}

          {/* Toggle Preview Mode */}
          {currentEditingLesson && (
            <button
              type="button"
              className={`lm-toolbar-btn ${isPreviewMode ? 'active' : ''}`}
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              title={isPreviewMode ? 'Exit Preview' : 'Preview Lesson'}
            >
              <i className={isPreviewMode ? 'ri-edit-line' : 'ri-eye-line'} />
              <span>{isPreviewMode ? 'Edit' : 'Preview'}</span>
            </button>
          )}

          {/* Toggle Material View Mode (Tutor/Student) */}
          {currentEditingLesson && (
            <div className="lm-view-mode-toggle">
              <button
                type="button"
                className={`lm-toolbar-btn lm-view-btn ${materialViewMode === 'tutor' ? 'active' : ''}`}
                onClick={() => setMaterialViewMode('tutor')}
                title="Tutor View - Shows tutor hints and instructions"
              >
                <i className="ri-user-settings-line" />
                <span>Tutor</span>
              </button>
              <button
                type="button"
                className={`lm-toolbar-btn lm-view-btn ${materialViewMode === 'student' ? 'active' : ''}`}
                onClick={() => setMaterialViewMode('student')}
                title="Student View - Material without tutor hints"
              >
                <i className="ri-user-3-line" />
                <span>Student</span>
              </button>
            </div>
          )}

          {/* Version History Button */}
          {currentEditingLesson && (
            <button
              type="button"
              className={`lm-toolbar-btn ${showVersionHistory ? 'active' : ''}`}
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              title="Version History"
            >
              <i className="ri-history-line" />
              <span>History</span>
              {currentLessonHistory.length > 0 && (
                <span className="lm-history-badge">{currentLessonHistory.length}</span>
              )}
            </button>
          )}

          {/* Analytics Button */}
          {currentEditingLesson && currentLessonId && (
            <button
              type="button"
              className={`lm-toolbar-btn ${showAnalytics ? 'active' : ''}`}
              onClick={() => setShowAnalytics(!showAnalytics)}
              title="View Analytics"
            >
              <i className="ri-bar-chart-2-line" />
              <span>Analytics</span>
            </button>
          )}

          {/* Preview Button - Opens lesson in new tab as static page */}
          {isFullscreen && draft && (
            <button
              type="button"
              className="lm-toolbar-btn"
              onClick={handleOpenPreview}
              title="Open Preview in New Tab"
            >
              <i className="ri-external-link-line" />
              <span>Preview</span>
            </button>
          )}

          {/* Export Dropdown - Show when in fullscreen/editor mode with content */}
          {isFullscreen && draft && (
            <div className="lm-export-dropdown">
              <button
                type="button"
                className={`lm-toolbar-btn ${showExportMenu ? 'active' : ''}`}
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Options"
              >
                <i className="ri-download-2-line" />
                <span>Export</span>
                <i className="ri-arrow-down-s-line" style={{ marginLeft: '4px', fontSize: '12px' }} />
              </button>
              {showExportMenu && (
                <div className="lm-export-menu">
                  <button
                    type="button"
                    className="lm-export-menu-item"
                    onClick={() => handleExportLesson('pdf')}
                  >
                    <i className="ri-file-pdf-line" />
                    <span>Export as PDF</span>
                  </button>
                  <button
                    type="button"
                    className="lm-export-menu-item"
                    onClick={() => handleExportLesson('html')}
                  >
                    <i className="ri-file-code-line" />
                    <span>Export as HTML</span>
                  </button>
                  <button
                    type="button"
                    className="lm-export-menu-item"
                    onClick={() => handleExportLesson('print')}
                  >
                    <i className="ri-printer-line" />
                    <span>Print</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mark as Finished / Back to Draft Button */}
          {currentEditingLesson && currentEditingLesson.serverLesson && (
            currentEditingLesson.status === 'draft' ? (
              <button
                type="button"
                className="lm-toolbar-btn success"
                onClick={() => handleMarkAsFinished(currentEditingLesson)}
                title="Mark this lesson as finished"
              >
                <i className="ri-check-double-line" />
                <span>Mark Finished</span>
              </button>
            ) : currentEditingLesson.status === 'finished' ? (
              <button
                type="button"
                className="lm-toolbar-btn warning"
                onClick={() => handleMarkAsDraft(currentEditingLesson)}
                title="Mark back as draft for editing"
              >
                <i className="ri-edit-2-line" />
                <span>Back to Draft</span>
              </button>
            ) : null
          )}

          <button
            className="lm-toolbar-btn"
            type="button"
            onClick={async () => {
              if (!await toastConfirm('Reset to blank template? This will delete the current lesson.', 'Reset Lesson')) return;
              localStorage.removeItem(STORAGE_KEY);
              setDraft(createBlankDraft());
              setLastSaved(null);
              setSavedLessonUrl(null);
              setSaveError(null);
            }}
            title="Reset"
          >
            <i className="ri-refresh-line" />
          </button>
          <button
            className="lm-toolbar-btn primary"
            type="button"
            disabled={isSaving}
            onClick={() => saveToServer(draft)}
            title="Save Now"
          >
            <i className={isSaving ? 'ri-loader-4-line spinning' : 'ri-save-line'} />
            <span>Save Now</span>
          </button>
            </>
          )}

          <button
            className={`lm-toolbar-btn ${isFullscreen ? 'active' : ''}`}
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
          >
            <i className={isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} />
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Version History Panel */}
      {showVersionHistory && currentEditingLesson && (
        <div className="lm-version-history-panel">
          <div className="lm-version-history-header">
            <div className="lm-version-history-title">
              <i className="ri-history-line" />
              <h3>Version History</h3>
            </div>
            <button
              type="button"
              className="lm-version-history-close"
              onClick={() => {
                setShowVersionHistory(false);
                setSelectedVersionToPreview(null);
              }}
            >
              <i className="ri-close-line" />
            </button>
          </div>
          
          <div className="lm-version-history-content">
            {isLoadingVersions ? (
              <div className="lm-version-empty">
                <i className="ri-loader-4-line spinning" />
                <p>Loading versions...</p>
              </div>
            ) : currentLessonHistory.length === 0 ? (
              <div className="lm-version-empty">
                <i className="ri-file-history-line" />
                <p>No versions saved yet</p>
                <span>Versions are automatically saved when you make changes</span>
              </div>
            ) : (
              <div className="lm-version-list">
                {currentLessonHistory.map((entry, index) => (
                  <div 
                    key={entry.id} 
                    className={`lm-version-item ${selectedVersionToPreview?.id === entry.id ? 'selected' : ''} ${index === 0 ? 'latest' : ''}`}
                  >
                    <div className="lm-version-item-header">
                      <div className="lm-version-number">
                        <span className="lm-version-badge-number">v{entry.version}</span>
                        {index === 0 && <span className="lm-version-latest-badge">Latest</span>}
                        {entry.autoSave && <span className="lm-version-auto-badge">Auto</span>}
                        {entry.changedByName && <span className="lm-version-author">{entry.changedByName}</span>}
                      </div>
                      <div className="lm-version-time">
                        {new Date(entry.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="lm-version-description">
                      {entry.changeDescription}
                    </div>
                    
                    {/* Detailed Changes List - Clickable */}
                    {entry.changes && entry.changes.length > 0 && (
                      <div className="lm-version-changes">
                        <button
                          type="button"
                          className="lm-version-changes-toggle"
                          onClick={() => {
                            setExpandedVersionChanges(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(entry.id)) {
                                newSet.delete(entry.id);
                              } else {
                                newSet.add(entry.id);
                              }
                              return newSet;
                            });
                          }}
                        >
                          <i className={expandedVersionChanges.has(entry.id) ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} />
                          <span>{entry.changes.length} change{entry.changes.length !== 1 ? 's' : ''}</span>
                        </button>
                        
                        {expandedVersionChanges.has(entry.id) && (
                          <div className="lm-version-changes-list">
                            {entry.changes.map((change) => (
                              <div 
                                key={change.id} 
                                className={`lm-version-change-item lm-version-change-${change.type}`}
                                onClick={() => {
                                  if (change.targetId || typeof change.sectionIndex === 'number') {
                                    scrollToSection(change.sectionIndex, change.targetId);
                                  }
                                }}
                                style={{ cursor: (change.targetId || typeof change.sectionIndex === 'number') ? 'pointer' : 'default' }}
                                title={(change.targetId || typeof change.sectionIndex === 'number') ? 'Click to navigate to this section' : ''}
                              >
                                <div className="lm-version-change-icon">
                                  {change.type === 'added' && <i className="ri-add-circle-line" />}
                                  {change.type === 'removed' && <i className="ri-indeterminate-circle-line" />}
                                  {change.type === 'modified' && <i className="ri-edit-circle-line" />}
                                </div>
                                <div className="lm-version-change-content">
                                  <span className="lm-version-change-target">{change.target}</span>
                                  <span className="lm-version-change-desc">{change.description}</span>
                                  {change.oldValue && change.newValue && (
                                    <div className="lm-version-change-diff">
                                      <span className="lm-version-change-old">{change.oldValue}...</span>
                                      <i className="ri-arrow-right-line" />
                                      <span className="lm-version-change-new">{change.newValue}...</span>
                                    </div>
                                  )}
                                </div>
                                {(change.targetId || typeof change.sectionIndex === 'number') && (
                                  <div className="lm-version-change-nav">
                                    <i className="ri-external-link-line" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="lm-version-actions">
                      <button
                        type="button"
                        className="lm-version-action-btn preview"
                        onClick={() => setSelectedVersionToPreview(
                          selectedVersionToPreview?.id === entry.id ? null : entry
                        )}
                      >
                        <i className={selectedVersionToPreview?.id === entry.id ? 'ri-eye-off-line' : 'ri-eye-line'} />
                        {selectedVersionToPreview?.id === entry.id ? 'Hide Preview' : 'Preview'}
                      </button>
                      <button
                        type="button"
                        className="lm-version-action-btn rollback"
                        onClick={async () => {
                          if (await toastConfirm(`Rollback to version ${entry.version}? Your current changes will be saved as a new version.`, 'Rollback Version')) {
                            rollbackToVersion(entry);
                          }
                        }}
                      >
                        <i className="ri-arrow-go-back-line" />
                        Restore
                      </button>
                    </div>
                    
                    {/* Version Preview Diff */}
                    {selectedVersionToPreview?.id === entry.id && (
                      <div className="lm-version-preview">
                        <div className="lm-version-preview-header">
                          <i className="ri-file-text-line" />
                          <span>Version {entry.version} Preview</span>
                        </div>
                        <div className="lm-version-preview-content">
                          <div className="lm-version-preview-item">
                            <span className="lm-version-preview-label">Goal:</span>
                            <span className="lm-version-preview-value">{entry.snapshot.header.goalText}</span>
                          </div>
                          <div className="lm-version-preview-item">
                            <span className="lm-version-preview-label">Lesson:</span>
                            <span className="lm-version-preview-value">{entry.snapshot.header.lessonLabel}</span>
                          </div>
                          <div className="lm-version-preview-item">
                            <span className="lm-version-preview-label">Sections:</span>
                            <span className="lm-version-preview-value">{entry.snapshot.sections.length} sections</span>
                          </div>
                          <div className="lm-version-preview-item">
                            <span className="lm-version-preview-label">Vocabulary:</span>
                            <span className="lm-version-preview-value">{entry.snapshot.vocabulary.length} items</span>
                          </div>
                          <div className="lm-version-preview-item">
                            <span className="lm-version-preview-label">Grammar:</span>
                            <span className="lm-version-preview-value">{entry.snapshot.grammar.length} points</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="lm-version-history-footer">
            <span className="lm-version-history-info">
              <i className="ri-information-line" />
              Up to 50 versions are stored
            </span>
            {currentLessonHistory.length > 0 && (
              <button
                type="button"
                className="lm-version-clear-btn"
                onClick={async () => {
                  if (await toastConfirm('Clear all version history for this lesson?', 'Clear History')) {
                    setVersionHistory(prev => {
                      const updated = { ...prev };
                      delete updated[currentEditingLesson.id];
                      return updated;
                    });
                  }
                }}
              >
                <i className="ri-delete-bin-line" />
                Clear History
              </button>
            )}
          </div>
        </div>
      )}

      {/* Analytics Panel */}
      {showAnalytics && currentLessonId && (
        <div className="lm-analytics-panel">
          <div className="lm-analytics-header">
            <div className="lm-analytics-title">
              <i className="ri-bar-chart-2-line" />
              <h3>Lesson Analytics</h3>
            </div>
            <button
              type="button"
              className="lm-analytics-close"
              onClick={() => setShowAnalytics(false)}
            >
              <i className="ri-close-line" />
            </button>
          </div>
          <div className="lm-analytics-content">
            <AnalyticsDashboard lessonId={currentLessonId} />
          </div>
        </div>
      )}

      {/* The actual lesson page preview/editor */}
      <div className="lm-page">
        {/* HEADER SECTION */}
        <div
          className={`lm-header ${showHeaderControls ? 'editing' : ''}`}
          style={{
            backgroundImage: draft.header.backgroundImage ? `url(${draft.header.backgroundImage})` : 'none',
          }}
        >
          {/* Overlay */}
          <div
            className="lm-header-overlay"
            style={{ backgroundColor: draft.header.overlayColor }}
          />

          {/* Header Controls - Always visible in header */}
          <div className="lm-header-toolbar">
            <button
              type="button"
              className="lm-header-tool-btn"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Upload Header Image"
            >
              <i className="ri-image-add-line" />
            </button>
            <div className="lm-header-color-picker" onClick={(e) => e.stopPropagation()}>
              <input
                type="color"
                value={draft.header.overlayColor.slice(0, 7)}
                title="Overlay Color"
                onInput={(e) => {
                  const hex = (e.target as HTMLInputElement).value;
                  const alpha = draft.header.overlayColor.length === 9
                    ? draft.header.overlayColor.slice(7)
                    : 'cc';
                  setDraft(prev => ({
                    ...prev,
                    header: { ...prev.header, overlayColor: hex + alpha }
                  }));
                }}
              />
              <select
                value={draft.header.overlayColor.length === 9 ? draft.header.overlayColor.slice(7) : 'cc'}
                title="Overlay Opacity"
                onChange={(e) => {
                  const alpha = (e.target as HTMLSelectElement).value;
                  const hex = draft.header.overlayColor.slice(0, 7);
                  setDraft(prev => ({
                    ...prev,
                    header: { ...prev.header, overlayColor: hex + alpha }
                  }));
                }}
              >
                <option value="ff">100%</option>
                <option value="e6">90%</option>
                <option value="cc">80%</option>
                <option value="b3">70%</option>
                <option value="99">60%</option>
                <option value="80">50%</option>
                <option value="66">40%</option>
                <option value="4d">30%</option>
                <option value="33">20%</option>
              </select>
            </div>
            {draft.header.backgroundImage && (
              <button
                type="button"
                className="lm-header-tool-btn danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(prev => ({
                    ...prev,
                    header: { ...prev.header, backgroundImage: '' }
                  }));
                }}
                title="Remove Image"
              >
                <i className="ri-delete-bin-line" />
              </button>
            )}
          </div>

          {/* Header content */}
          <div className="lm-header-content">
            <div className="lm-header-top">
              <span
                className="lm-level-badge"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setDraft(prev => ({
                  ...prev,
                  header: { ...prev.header, levelBadge: (e.target as HTMLElement).textContent || '' }
                }))}
              >
                {draft.header.levelBadge}
              </span>
              <span className="lm-header-divider">|</span>
              <span
                className="lm-chapter-label"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setDraft(prev => ({
                  ...prev,
                  header: { ...prev.header, chapterLabel: (e.target as HTMLElement).textContent || '' }
                }))}
              >
                {draft.header.chapterLabel}
              </span>
            </div>

            <div
              className="lm-lesson-label"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setDraft(prev => ({
                ...prev,
                header: { ...prev.header, lessonLabel: (e.target as HTMLElement).textContent || '' }
              }))}
            >
              {draft.header.lessonLabel}
            </div>

            <div className="lm-goal-row">
              <span className="lm-goal-badge">GOAL</span>
              <span
                className="lm-goal-text"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setDraft(prev => ({
                  ...prev,
                  header: { ...prev.header, goalText: (e.target as HTMLElement).textContent || '' }
                }))}
              >
                {draft.header.goalText}
              </span>
            </div>

            <div
              className="lm-goal-subtext"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setDraft(prev => ({
                ...prev,
                header: { ...prev.header, goalSubtext: (e.target as HTMLElement).textContent || '' }
              }))}
            >
              {draft.header.goalSubtext}
            </div>
          </div>

          {/* Header controls popover */}
          {showHeaderControls && (
            <div
              className="lm-header-controls"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="lm-control-row">
                <label>Background</label>
                <div className="lm-control-btns">
                  <input
                    type="file"
                    accept="image/*"
                    className="lm-hidden-input"
                    id="header-bg-upload"
                    onChange={handleImageUpload}
                  />
                  <label htmlFor="header-bg-upload" className="lm-ctrl-btn">
                    <i className="ri-upload-2-line" /> Upload
                  </label>
                  {draft.header.backgroundImage && (
                    <button
                      type="button"
                      className="lm-ctrl-btn danger"
                      onClick={() => setDraft(prev => ({
                        ...prev,
                        header: { ...prev.header, backgroundImage: '' }
                      }))}
                    >
                      <i className="ri-delete-bin-6-line" /> Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="lm-control-row">
                <label>Overlay Color</label>
                <div className="lm-color-picker">
                  <input
                    type="color"
                    value={draft.header.overlayColor.slice(0, 7)}
                    onInput={(e) => {
                      const hex = (e.target as HTMLInputElement).value;
                      const alpha = draft.header.overlayColor.length === 9
                        ? draft.header.overlayColor.slice(7)
                        : 'cc';
                      setDraft(prev => ({
                        ...prev,
                        header: { ...prev.header, overlayColor: hex + alpha }
                      }));
                    }}
                  />
                  <select
                    value={draft.header.overlayColor.length === 9 ? draft.header.overlayColor.slice(7) : 'cc'}
                    onChange={(e) => {
                      const alpha = (e.target as HTMLSelectElement).value;
                      const hex = draft.header.overlayColor.slice(0, 7);
                      setDraft(prev => ({
                        ...prev,
                        header: { ...prev.header, overlayColor: hex + alpha }
                      }));
                    }}
                  >
                    <option value="ff">100%</option>
                    <option value="e6">90%</option>
                    <option value="cc">80%</option>
                    <option value="b3">70%</option>
                    <option value="99">60%</option>
                    <option value="80">50%</option>
                    <option value="66">40%</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="lm-ctrl-btn close-btn"
                onClick={() => setShowHeaderControls(false)}
              >
                Done
              </button>
            </div>
          )}

          {/* Edit hint */}
          {draft.header.backgroundImage && !showHeaderControls && (
            <div className="lm-edit-hint">
              <i className="ri-edit-2-line" /> Click to edit header
            </div>
          )}
        </div>

        {/* Page body - sections */}
        <div className="lm-body">
          {draft.sections.map((section, sectionIndex) => {
            // Hide feedback section in student view mode
            if (materialViewMode === 'student' && section.sectionType === 'feedback') {
              return null;
            }
            
            return (
            <div key={section.id} className="lm-section">
              {/* Two-column layout */}
              <div className={`lm-section-layout ${materialViewMode === 'student' ? 'student-view' : ''}`}>
                {/* Left Column - Main Content */}
                <div className="lm-section-main">
                  {/* Section Title - hide for question, trivia types, challenge2, pronunciation, grammar, and practice sections with empty title */}
                  {section.sectionType !== 'question' && section.sectionType !== 'trivia' && section.sectionType !== 'challenge2' &&
                   section.sectionType !== 'pronunciation' && section.sectionType !== 'grammar' &&
                   !(section.sectionType === 'practice' && !section.sectionTitle) && (
                    <div className="lm-section-title-row">
                      <span className="lm-section-number">{section.sectionNumber}</span>
                      <span
                        className="lm-section-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sectionTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sectionTitle}
                      </span>
                    </div>
                  )}

                  {/* INTRODUCE type content */}
                  {(section.sectionType === 'introduce' || !section.sectionType) && (
                    <>
                      {/* Explanation - English */}
                      <p
                        className="lm-section-explanation"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            explanationEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.explanationEn}
                      </p>

                      {/* Explanation - Japanese */}
                      <p
                        className="lm-section-explanation-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            explanationJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.explanationJp}
                      </p>

                      {/* Section Image */}
                      <div className="lm-section-image-container">
                        {section.sectionImage ? (
                          <div className="lm-section-image-wrapper">
                            <img src={section.sectionImage} alt="Section visual" className="lm-section-image" />
                            <button
                              type="button"
                              className="lm-section-image-remove"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                newSections[sectionIndex] = { ...section, sectionImage: '' };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-delete-bin-line" />
                            </button>
                          </div>
                        ) : (
                          <label className="lm-section-image-upload">
                            <input
                              type="file"
                              accept="image/*"
                              className="lm-hidden-input"
                              onChange={(e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const result = ev.target?.result as string;
                                  const newSections = [...draft.sections];
                                  newSections[sectionIndex] = { ...section, sectionImage: result };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <i className="ri-image-add-line" />
                            <span>Click to add section image</span>
                          </label>
                        )}
                      </div>
                    </>
                  )}

                  {/* VOCABULARY type content */}
                  {section.sectionType === 'vocabulary' && (
                    <>
                      {/* Step Title */}
                      <h3
                        className="lm-step-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            stepTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.stepTitle}
                      </h3>

                      {/* Instructions */}
                      <p
                        className="lm-vocab-instruction"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionEn}
                      </p>
                      <p
                        className="lm-vocab-instruction-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionJp}
                      </p>

                      {/* Vocabulary Grid */}
                      <div className="lm-vocab-grid">
                        {section.vocabCards?.map((card, cardIndex) => (
                          <div key={card.id} className="lm-vocab-card">
                            {/* Card Image */}
                            <div className="lm-vocab-card-image">
                              {card.image ? (
                                <div className="lm-vocab-image-wrapper">
                                  <img src={card.image} alt={card.wordEn} />
                                  <button
                                    type="button"
                                    className="lm-vocab-image-remove"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newCards = [...(section.vocabCards || [])];
                                      newCards[cardIndex] = { ...card, image: '' };
                                      newSections[sectionIndex] = { ...section, vocabCards: newCards };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    <i className="ri-delete-bin-line" />
                                  </button>
                                </div>
                              ) : (
                                <label className="lm-vocab-image-upload">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="lm-hidden-input"
                                    onChange={(e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const result = ev.target?.result as string;
                                        const newSections = [...draft.sections];
                                        const newCards = [...(section.vocabCards || [])];
                                        newCards[cardIndex] = { ...card, image: result };
                                        newSections[sectionIndex] = { ...section, vocabCards: newCards };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                  <i className="ri-image-add-line" />
                                </label>
                              )}
                            </div>
                            {/* Card Text */}
                            <div className="lm-vocab-card-text">
                              <span
                                className="lm-vocab-word-en"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newCards = [...(section.vocabCards || [])];
                                  newCards[cardIndex] = { ...card, wordEn: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, vocabCards: newCards };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {card.wordEn}
                              </span>
                              <span
                                className="lm-vocab-word-jp"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newCards = [...(section.vocabCards || [])];
                                  newCards[cardIndex] = { ...card, wordJp: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, vocabCards: newCards };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {card.wordJp}
                              </span>
                            </div>
                            {/* Delete Card Button */}
                            <button
                              type="button"
                              className="lm-vocab-card-delete"
                              title="Delete this card"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newCards = (section.vocabCards || []).filter((_, i) => i !== cardIndex);
                                newSections[sectionIndex] = { ...section, vocabCards: newCards };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        ))}
                        {/* Add New Vocab Card Button */}
                        <button
                          type="button"
                          className="lm-vocab-add-card"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newCard = {
                              id: `vocab-${Date.now()}`,
                              image: '',
                              wordEn: 'new word',
                              wordJp: '新しい言葉',
                            };
                            const newCards = [...(section.vocabCards || []), newCard];
                            newSections[sectionIndex] = { ...section, vocabCards: newCards };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-line" />
                          <span>Add Vocabulary Card</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* QUESTION type content (STEP B style) */}
                  {section.sectionType === 'question' && (
                    <>
                      {/* Step Title */}
                      <h3
                        className="lm-step-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            stepTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.stepTitle}
                      </h3>

                      {/* Question/Instruction */}
                      <p
                        className="lm-question-instruction"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionEn}
                      </p>
                      <p
                        className="lm-question-instruction-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionJp}
                      </p>

                      {/* Image Cards Grid (2 per row) */}
                      <div className="lm-image-cards-grid">
                        {section.imageCards?.map((card, cardIndex) => (
                          <div key={card.id} className="lm-image-card">
                            {/* Card Image */}
                            <div className="lm-image-card-image">
                              {card.image ? (
                                <div className="lm-image-card-wrapper">
                                  <img src={card.image} alt={card.label} />
                                  <button
                                    type="button"
                                    className="lm-image-card-remove"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newCards = [...(section.imageCards || [])];
                                      newCards[cardIndex] = { ...card, image: '' };
                                      newSections[sectionIndex] = { ...section, imageCards: newCards };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    <i className="ri-delete-bin-line" />
                                  </button>
                                </div>
                              ) : (
                                <label className="lm-image-card-upload">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="lm-hidden-input"
                                    onChange={(e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const result = ev.target?.result as string;
                                        const newSections = [...draft.sections];
                                        const newCards = [...(section.imageCards || [])];
                                        newCards[cardIndex] = { ...card, image: result };
                                        newSections[sectionIndex] = { ...section, imageCards: newCards };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                  <i className="ri-image-add-line" />
                                </label>
                              )}
                            </div>
                            {/* Card Label */}
                            <span
                              className="lm-image-card-label"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                const newCards = [...(section.imageCards || [])];
                                newCards[cardIndex] = { ...card, label: (e.target as HTMLElement).textContent || '' };
                                newSections[sectionIndex] = { ...section, imageCards: newCards };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {card.label}
                            </span>
                            {/* Delete Card Button */}
                            <button
                              type="button"
                              className="lm-image-card-delete"
                              title="Delete this card"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newCards = (section.imageCards || []).filter((_, i) => i !== cardIndex);
                                newSections[sectionIndex] = { ...section, imageCards: newCards };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        ))}
                        {/* Add New Image Card Button */}
                        <button
                          type="button"
                          className="lm-image-add-card"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newCard = {
                              id: `img-${Date.now()}`,
                              image: '',
                              label: 'new label',
                            };
                            const newCards = [...(section.imageCards || []), newCard];
                            newSections[sectionIndex] = { ...section, imageCards: newCards };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-line" />
                          <span>Add Image Card</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* PRONUNCIATION type content (STEP C style) */}
                  {section.sectionType === 'pronunciation' && (
                    <>
                      {/* Step Title */}
                      <h3
                        className="lm-step-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            stepTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.stepTitle}
                      </h3>

                      {/* Instruction */}
                      <p
                        className="lm-question-instruction"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionEn}
                      </p>
                      <p
                        className="lm-question-instruction-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionJp}
                      </p>

                      {/* Pronunciation Table */}
                      <div className="lm-pronunciation-table">
                        {section.pronunciationColumns?.map((col, colIndex) => (
                          <div key={col.id} className="lm-pronunciation-column">
                            {/* Sound Image */}
                            <div className="lm-pronunciation-image-cell">
                              {col.image ? (
                                <div className="lm-pronunciation-image-wrapper">
                                  <img src={col.image} alt={col.soundLabel} />
                                  <button
                                    type="button"
                                    className="lm-pronunciation-image-remove"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newCols = [...(section.pronunciationColumns || [])];
                                      newCols[colIndex] = { ...col, image: '' };
                                      newSections[sectionIndex] = { ...section, pronunciationColumns: newCols };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    <i className="ri-delete-bin-line" />
                                  </button>
                                </div>
                              ) : (
                                <label className="lm-pronunciation-image-upload">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="lm-hidden-input"
                                    onChange={(e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const result = ev.target?.result as string;
                                        const newSections = [...draft.sections];
                                        const newCols = [...(section.pronunciationColumns || [])];
                                        newCols[colIndex] = { ...col, image: result };
                                        newSections[sectionIndex] = { ...section, pronunciationColumns: newCols };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                  <i className="ri-image-add-line" />
                                </label>
                              )}
                            </div>
                            {/* Sound Label */}
                            <div className="lm-pronunciation-sound-cell">
                              <span
                                className="lm-pronunciation-sound"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newCols = [...(section.pronunciationColumns || [])];
                                  newCols[colIndex] = { ...col, soundLabel: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, pronunciationColumns: newCols };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {col.soundLabel}
                              </span>
                            </div>
                            {/* Words */}
                            {col.words.map((word, wordIndex) => (
                              <div key={word.id} className="lm-pronunciation-word-cell">
                                <span
                                  className="lm-pronunciation-word-en"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newCols = [...(section.pronunciationColumns || [])];
                                    const newWords = [...col.words];
                                    newWords[wordIndex] = { ...word, wordEn: (e.target as HTMLElement).textContent || '' };
                                    newCols[colIndex] = { ...col, words: newWords };
                                    newSections[sectionIndex] = { ...section, pronunciationColumns: newCols };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {word.wordEn}
                                </span>
                                <span
                                  className="lm-pronunciation-word-jp"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newCols = [...(section.pronunciationColumns || [])];
                                    const newWords = [...col.words];
                                    newWords[wordIndex] = { ...word, wordJp: (e.target as HTMLElement).textContent || '' };
                                    newCols[colIndex] = { ...col, words: newWords };
                                    newSections[sectionIndex] = { ...section, pronunciationColumns: newCols };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {word.wordJp}
                                </span>
                                {/* Delete Word Button */}
                                <button
                                  type="button"
                                  className="lm-pronunciation-word-delete"
                                  title="Delete this word"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newCols = [...(section.pronunciationColumns || [])];
                                    const newWords = col.words.filter((_, i) => i !== wordIndex);
                                    newCols[colIndex] = { ...col, words: newWords };
                                    newSections[sectionIndex] = { ...section, pronunciationColumns: newCols };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ))}
                            {/* Add Word Button */}
                            <button
                              type="button"
                              className="lm-pronunciation-add-word"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newCols = [...(section.pronunciationColumns || [])];
                                const newWord = {
                                  id: `w-${Date.now()}`,
                                  wordEn: 'word',
                                  wordJp: '単語',
                                };
                                const newWords = [...col.words, newWord];
                                newCols[colIndex] = { ...col, words: newWords };
                                newSections[sectionIndex] = { ...section, pronunciationColumns: newCols };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-add-line" />
                            </button>
                          </div>
                        ))}
                        {/* Add Column Button */}
                        <button
                          type="button"
                          className="lm-pronunciation-add-column"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newCol = {
                              id: `col-${Date.now()}`,
                              soundLabel: '/x/',
                              image: '',
                              words: [
                                { id: `w-${Date.now()}-1`, wordEn: 'word', wordJp: '単語' },
                              ],
                            };
                            const newCols = [...(section.pronunciationColumns || []), newCol];
                            newSections[sectionIndex] = { ...section, pronunciationColumns: newCols };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-line" />
                          <span>Add Column</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* GRAMMAR type content (STEP D style) */}
                  {section.sectionType === 'grammar' && (
                    <>
                      {/* Step Title */}
                      <h3
                        className="lm-grammar-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            stepTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.stepTitle}
                      </h3>

                      {/* Main Grammar Tip (bold headline) */}
                      <p
                        className="lm-grammar-headline"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionEn}
                      </p>
                      <p
                        className="lm-grammar-headline-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionJp}
                      </p>

                      {/* Grammar Rules */}
                      <div className="lm-grammar-rules">
                        {section.grammarRules?.map((rule, ruleIndex) => (
                          <div key={rule.id} className="lm-grammar-rule">
                            {/* Rule Explanation */}
                            <p
                              className="lm-grammar-rule-en"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                const newRules = [...(section.grammarRules || [])];
                                newRules[ruleIndex] = { ...rule, ruleEn: (e.target as HTMLElement).textContent || '' };
                                newSections[sectionIndex] = { ...section, grammarRules: newRules };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {rule.ruleEn}
                            </p>
                            <p
                              className="lm-grammar-rule-jp"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                const newRules = [...(section.grammarRules || [])];
                                newRules[ruleIndex] = { ...rule, ruleJp: (e.target as HTMLElement).textContent || '' };
                                newSections[sectionIndex] = { ...section, grammarRules: newRules };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {rule.ruleJp}
                            </p>

                            {/* Examples Box */}
                            <div className="lm-grammar-examples-box">
                              <div className="lm-grammar-examples-header">
                                {rule.examples.length === 1 ? 'EXAMPLE' : 'EXAMPLES'}
                              </div>
                              <div className="lm-grammar-examples-list">
                                {rule.examples.map((example, exIndex) => (
                                  <div key={example.id} className="lm-grammar-example">
                                    <div className="lm-grammar-example-row">
                                      <span className="lm-grammar-bullet">•</span>
                                      <span
                                        className="lm-grammar-example-en"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                          const newSections = [...draft.sections];
                                          const newRules = [...(section.grammarRules || [])];
                                          const newExamples = [...rule.examples];
                                          newExamples[exIndex] = { ...example, sentenceEn: (e.target as HTMLElement).textContent || '' };
                                          newRules[ruleIndex] = { ...rule, examples: newExamples };
                                          newSections[sectionIndex] = { ...section, grammarRules: newRules };
                                          setDraft(prev => ({ ...prev, sections: newSections }));
                                        }}
                                      >
                                        {example.sentenceEn}
                                      </span>
                                      {/* Delete Example Button */}
                                      <button
                                        type="button"
                                        className="lm-grammar-example-delete"
                                        title="Delete this example"
                                        onClick={() => {
                                          const newSections = [...draft.sections];
                                          const newRules = [...(section.grammarRules || [])];
                                          const newExamples = rule.examples.filter((_, i) => i !== exIndex);
                                          newRules[ruleIndex] = { ...rule, examples: newExamples };
                                          newSections[sectionIndex] = { ...section, grammarRules: newRules };
                                          setDraft(prev => ({ ...prev, sections: newSections }));
                                        }}
                                      >
                                        <i className="ri-close-line" />
                                      </button>
                                    </div>
                                    <div className="lm-grammar-example-row lm-grammar-example-jp-row">
                                      <span className="lm-grammar-bullet-sub">◦</span>
                                      <span
                                        className="lm-grammar-example-jp"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                          const newSections = [...draft.sections];
                                          const newRules = [...(section.grammarRules || [])];
                                          const newExamples = [...rule.examples];
                                          newExamples[exIndex] = { ...example, sentenceJp: (e.target as HTMLElement).textContent || '' };
                                          newRules[ruleIndex] = { ...rule, examples: newExamples };
                                          newSections[sectionIndex] = { ...section, grammarRules: newRules };
                                          setDraft(prev => ({ ...prev, sections: newSections }));
                                        }}
                                      >
                                        {example.sentenceJp}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {/* Add Example Button */}
                                <button
                                  type="button"
                                  className="lm-grammar-add-example"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newRules = [...(section.grammarRules || [])];
                                    const newExample = {
                                      id: `ex-${Date.now()}`,
                                      sentenceEn: 'New example sentence.',
                                      sentenceJp: '新しい例文。',
                                      boldWords: [],
                                    };
                                    const newExamples = [...rule.examples, newExample];
                                    newRules[ruleIndex] = { ...rule, examples: newExamples };
                                    newSections[sectionIndex] = { ...section, grammarRules: newRules };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  <i className="ri-add-line" />
                                  <span>Add Example</span>
                                </button>
                              </div>
                            </div>

                            {/* Delete Rule Button */}
                            <button
                              type="button"
                              className="lm-grammar-rule-delete"
                              title="Delete this grammar rule"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newRules = (section.grammarRules || []).filter((_, i) => i !== ruleIndex);
                                newSections[sectionIndex] = { ...section, grammarRules: newRules };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-delete-bin-line" />
                              <span>Delete Rule</span>
                            </button>
                          </div>
                        ))}
                        {/* Add Grammar Rule Button */}
                        <button
                          type="button"
                          className="lm-grammar-add-rule"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newRule = {
                              id: `rule-${Date.now()}`,
                              ruleEn: 'Use [word] to ask about [topic].',
                              ruleJp: '[word]は[topic]について質問するときに使います。',
                              examples: [
                                { id: `ex-${Date.now()}`, sentenceEn: 'Example sentence?', sentenceJp: '例文？', boldWords: [] },
                              ],
                            };
                            const newRules = [...(section.grammarRules || []), newRule];
                            newSections[sectionIndex] = { ...section, grammarRules: newRules };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-line" />
                          <span>Add Grammar Rule</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* DIALOGUE type content (APPLY/SPEAKING style) */}
                  {section.sectionType === 'dialogue' && (
                    <>
                      {/* Activity Type */}
                      <h3
                        className="lm-dialogue-type"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            stepTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.stepTitle}
                      </h3>

                      {/* Context/Situation Description */}
                      <p
                        className="lm-dialogue-context"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionEn}
                      </p>
                      <p
                        className="lm-dialogue-context-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionJp}
                      </p>

                      {/* Scene Illustration */}
                      <div className="lm-dialogue-image">
                        {section.dialogueImage ? (
                          <div className="lm-dialogue-image-wrapper">
                            <img src={section.dialogueImage} alt="Scene illustration" />
                            <button
                              type="button"
                              className="lm-dialogue-image-remove"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                newSections[sectionIndex] = { ...section, dialogueImage: '' };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-delete-bin-line" />
                            </button>
                          </div>
                        ) : (
                          <label className="lm-dialogue-image-upload">
                            <input
                              type="file"
                              accept="image/*"
                              className="lm-hidden-input"
                              onChange={(e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const result = ev.target?.result as string;
                                  const newSections = [...draft.sections];
                                  newSections[sectionIndex] = { ...section, dialogueImage: result };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <i className="ri-image-add-line" />
                            <span>Add Scene Illustration</span>
                          </label>
                        )}
                      </div>

                      {/* Dialogue Lines */}
                      <div className="lm-dialogue-lines">
                        {section.dialogueLines?.map((line, lineIndex) => (
                          <div key={line.id} className="lm-dialogue-line">
                            <span
                              className="lm-dialogue-speaker"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                const newLines = [...(section.dialogueLines || [])];
                                newLines[lineIndex] = { ...line, speaker: (e.target as HTMLElement).textContent || '' };
                                newSections[sectionIndex] = { ...section, dialogueLines: newLines };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {line.speaker}:
                            </span>
                            <span
                              className="lm-dialogue-text"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                const newLines = [...(section.dialogueLines || [])];
                                newLines[lineIndex] = { ...line, lineEn: (e.target as HTMLElement).textContent || '' };
                                newSections[sectionIndex] = { ...section, dialogueLines: newLines };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {line.lineEn}
                            </span>
                            {/* Delete Line Button */}
                            <button
                              type="button"
                              className="lm-dialogue-line-delete"
                              title="Delete this line"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newLines = (section.dialogueLines || []).filter((_, i) => i !== lineIndex);
                                newSections[sectionIndex] = { ...section, dialogueLines: newLines };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        ))}
                        {/* Add Dialogue Line Button */}
                        <button
                          type="button"
                          className="lm-dialogue-add-line"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newLine = {
                              id: `line-${Date.now()}`,
                              speaker: 'Speaker',
                              lineEn: 'New dialogue line.',
                            };
                            const newLines = [...(section.dialogueLines || []), newLine];
                            newSections[sectionIndex] = { ...section, dialogueLines: newLines };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-line" />
                          <span>Add Dialogue Line</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* TRIVIA type content (APPLY - cultural tips) */}
                  {section.sectionType === 'trivia' && (
                    <div className="lm-trivia-container">
                      {/* Trivia Content Box - Blue/Purple background */}
                      <div className="lm-trivia-box">
                        <div className="lm-trivia-content">
                          {/* Trivia Header with lightbulb icon */}
                          <div className="lm-trivia-header">
                            <span className="lm-trivia-icon">💡</span>
                            <h3
                              className="lm-trivia-title"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                newSections[sectionIndex] = {
                                  ...section,
                                  stepTitle: (e.target as HTMLElement).textContent || ''
                                };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {section.stepTitle}
                            </h3>
                          </div>

                          {/* Trivia Explanation */}
                          <p
                            className="lm-trivia-explanation"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newSections = [...draft.sections];
                              newSections[sectionIndex] = {
                                ...section,
                                instructionEn: (e.target as HTMLElement).textContent || ''
                              };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            {section.instructionEn}
                          </p>

                          {/* Trivia Examples */}
                          <div className="lm-trivia-examples">
                            {section.triviaExamples?.map((example, exIndex) => (
                              <div key={example.id} className={`lm-trivia-example ${example.isCorrect ? 'correct' : 'incorrect'}`}>
                                <div className="lm-trivia-example-en">
                                  <div className="lm-trivia-line">
                                    <span className="lm-trivia-speaker">
                                      <span
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                          const newSections = [...draft.sections];
                                          const newExamples = [...(section.triviaExamples || [])];
                                          newExamples[exIndex] = { ...example, speakerA: (e.target as HTMLElement).textContent || '' };
                                          newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                                          setDraft(prev => ({ ...prev, sections: newSections }));
                                        }}
                                      >
                                        {example.speakerA}
                                      </span>:
                                    </span>
                                    <span
                                      className="lm-trivia-text"
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => {
                                        const newSections = [...draft.sections];
                                        const newExamples = [...(section.triviaExamples || [])];
                                        newExamples[exIndex] = { ...example, lineA: (e.target as HTMLElement).textContent || '' };
                                        newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      }}
                                    >
                                      {example.lineA}
                                    </span>
                                  </div>
                                  <div className="lm-trivia-line">
                                    <span className={`lm-trivia-marker ${example.isCorrect ? 'correct' : 'incorrect'}`}>
                                      {example.isCorrect ? 'O' : 'X'}
                                    </span>
                                    <span className="lm-trivia-speaker">
                                      <span
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                          const newSections = [...draft.sections];
                                          const newExamples = [...(section.triviaExamples || [])];
                                          newExamples[exIndex] = { ...example, speakerB: (e.target as HTMLElement).textContent || '' };
                                          newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                                          setDraft(prev => ({ ...prev, sections: newSections }));
                                        }}
                                      >
                                        {example.speakerB}
                                      </span>:
                                    </span>
                                    <span
                                      className="lm-trivia-text"
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => {
                                        const newSections = [...draft.sections];
                                        const newExamples = [...(section.triviaExamples || [])];
                                        newExamples[exIndex] = { ...example, lineB: (e.target as HTMLElement).textContent || '' };
                                        newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      }}
                                    >
                                      {example.lineB}
                                    </span>
                                  </div>
                                </div>
                                {/* Toggle correct/incorrect */}
                                <button
                                  type="button"
                                  className="lm-trivia-toggle"
                                  title={example.isCorrect ? 'Mark as incorrect' : 'Mark as correct'}
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newExamples = [...(section.triviaExamples || [])];
                                    newExamples[exIndex] = { ...example, isCorrect: !example.isCorrect };
                                    newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {example.isCorrect ? '✓' : '✗'}
                                </button>
                                {/* Delete Example Button */}
                                <button
                                  type="button"
                                  className="lm-trivia-example-delete"
                                  title="Delete this example"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newExamples = (section.triviaExamples || []).filter((_, i) => i !== exIndex);
                                    newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Japanese Explanation */}
                          <p
                            className="lm-trivia-explanation-jp"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newSections = [...draft.sections];
                              newSections[sectionIndex] = {
                                ...section,
                                instructionJp: (e.target as HTMLElement).textContent || ''
                              };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            {section.instructionJp}
                          </p>

                          {/* Japanese Examples */}
                          <div className="lm-trivia-examples-jp">
                            {section.triviaExamples?.map((example, exIndex) => (
                              <div key={`${example.id}-jp`} className={`lm-trivia-example-jp ${example.isCorrect ? 'correct' : 'incorrect'}`}>
                                <div className="lm-trivia-line">
                                  <span className="lm-trivia-speaker">{example.speakerA}:</span>
                                  <span
                                    className="lm-trivia-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newExamples = [...(section.triviaExamples || [])];
                                      newExamples[exIndex] = { ...example, lineAJp: (e.target as HTMLElement).textContent || '' };
                                      newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {example.lineAJp}
                                  </span>
                                </div>
                                <div className="lm-trivia-line">
                                  <span className={`lm-trivia-marker ${example.isCorrect ? 'correct' : 'incorrect'}`}>
                                    {example.isCorrect ? 'O' : 'X'}
                                  </span>
                                  <span className="lm-trivia-speaker">{example.speakerB}:</span>
                                  <span
                                    className="lm-trivia-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newExamples = [...(section.triviaExamples || [])];
                                      newExamples[exIndex] = { ...example, lineBJp: (e.target as HTMLElement).textContent || '' };
                                      newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {example.lineBJp}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Add Example Button */}
                          <button
                            type="button"
                            className="lm-trivia-add-example"
                            onClick={() => {
                              const newSections = [...draft.sections];
                              const newExample = {
                                id: `trivia-ex-${Date.now()}`,
                                speakerA: 'A',
                                lineA: 'New question?',
                                speakerB: 'B',
                                lineB: 'New response.',
                                isCorrect: true,
                                lineAJp: '新しい質問？',
                                lineBJp: '新しい回答。',
                              };
                              const newExamples = [...(section.triviaExamples || []), newExample];
                              newSections[sectionIndex] = { ...section, triviaExamples: newExamples };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            <i className="ri-add-line" />
                            <span>Add Example</span>
                          </button>
                        </div>

                        {/* Trivia Image */}
                        <div className="lm-trivia-image-area">
                          {section.triviaImage ? (
                            <div className="lm-trivia-image-wrapper">
                              <img src={section.triviaImage} alt="Trivia illustration" />
                              <button
                                type="button"
                                className="lm-trivia-image-remove"
                                onClick={() => {
                                  const newSections = [...draft.sections];
                                  newSections[sectionIndex] = { ...section, triviaImage: '' };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                <i className="ri-delete-bin-line" />
                              </button>
                            </div>
                          ) : (
                            <label className="lm-trivia-image-upload">
                              <input
                                type="file"
                                accept="image/*"
                                className="lm-hidden-input"
                                onChange={(e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    const result = ev.target?.result as string;
                                    const newSections = [...draft.sections];
                                    newSections[sectionIndex] = { ...section, triviaImage: result };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                              <i className="ri-image-add-line" />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PRACTICE type content (Exercise section) */}
                  {section.sectionType === 'practice' && (
                    <div className="lm-practice-container">
                      {/* Step Title - e.g., "STEP A EXERCISE" */}
                      <h3
                        className="lm-practice-step-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            stepTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.stepTitle}
                      </h3>

                      {/* Instructions - English */}
                      <p
                        className="lm-practice-instruction"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionEn}
                      </p>

                      {/* Instructions - Japanese */}
                      <p
                        className="lm-practice-instruction-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionJp}
                      </p>

                      {/* STEP A STYLE: Example + Numbered Items */}
                      {section.practiceItems && section.practiceItems.length > 0 && !section.conversationLines && (
                        <>
                          {/* Example */}
                          <div className="lm-practice-example">
                            <span
                              className="lm-practice-example-question"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                newSections[sectionIndex] = {
                                  ...section,
                                  practiceExample: (e.target as HTMLElement).textContent || ''
                                };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {section.practiceExample}
                            </span>
                            <span
                              className="lm-practice-example-answer"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                newSections[sectionIndex] = {
                                  ...section,
                                  practiceExampleAnswer: (e.target as HTMLElement).textContent || ''
                                };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              {section.practiceExampleAnswer}
                            </span>
                          </div>

                          {/* Practice Items */}
                          <ol className="lm-practice-items">
                            {section.practiceItems?.map((item, itemIndex) => (
                              <li key={item.id} className="lm-practice-item">
                                <span
                                  className="lm-practice-item-question"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newItems = [...(section.practiceItems || [])];
                                    newItems[itemIndex] = { ...item, question: (e.target as HTMLElement).textContent || '' };
                                    newSections[sectionIndex] = { ...section, practiceItems: newItems };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {item.question}
                                </span>
                                <button
                                  type="button"
                                  className="lm-practice-item-delete"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newItems = (section.practiceItems || []).filter((_, i) => i !== itemIndex);
                                    // Also update answer items
                                    const newAnswers = (section.answerItems || []).filter((_, i) => i !== itemIndex);
                                    newSections[sectionIndex] = { ...section, practiceItems: newItems, answerItems: newAnswers };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </li>
                            ))}
                          </ol>

                          {/* Add Practice Item Button */}
                          <button
                            type="button"
                            className="lm-practice-add-item"
                            onClick={() => {
                              const newSections = [...draft.sections];
                              const newItem = {
                                id: `practice-${Date.now()}`,
                                question: '(new / words / here) question?',
                                answer: 'New words here',
                              };
                              const newItems = [...(section.practiceItems || []), newItem];
                              const newAnswers = [...(section.answerItems || []), newItem.answer];
                              newSections[sectionIndex] = { ...section, practiceItems: newItems, answerItems: newAnswers };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            <i className="ri-add-line" />
                            <span>Add Practice Item</span>
                          </button>
                        </>
                      )}

                      {/* STEP B STYLE: Word Box + Conversation */}
                      {section.conversationLines && section.conversationLines.length > 0 && (
                        <>
                          {/* Word Box */}
                          <div className="lm-word-box">
                            {section.wordBox?.map((word, wordIndex) => (
                              <span
                                key={`word-${wordIndex}`}
                                className="lm-word-box-item"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newWords = [...(section.wordBox || [])];
                                  newWords[wordIndex] = (e.target as HTMLElement).textContent || '';
                                  newSections[sectionIndex] = { ...section, wordBox: newWords };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {word}
                              </span>
                            ))}
                            <button
                              type="button"
                              className="lm-word-box-add"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newWords = [...(section.wordBox || []), 'new'];
                                newSections[sectionIndex] = { ...section, wordBox: newWords };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-add-line" />
                            </button>
                          </div>

                          {/* Conversation Lines */}
                          <div className="lm-conversation">
                            {section.conversationLines?.map((line, lineIndex) => (
                              <div key={line.id} className={`lm-conversation-line ${line.speaker.toLowerCase()}`}>
                                <span className="lm-conversation-speaker">{line.speaker}:</span>
                                <span
                                  className="lm-conversation-text"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newLines = [...(section.conversationLines || [])];
                                    newLines[lineIndex] = { ...line, text: (e.target as HTMLElement).textContent || '' };
                                    newSections[sectionIndex] = { ...section, conversationLines: newLines };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {line.text}
                                </span>
                                <button
                                  type="button"
                                  className="lm-conversation-line-delete"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newLines = (section.conversationLines || []).filter((_, i) => i !== lineIndex);
                                    newSections[sectionIndex] = { ...section, conversationLines: newLines };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Add Conversation Line Buttons */}
                          <div className="lm-conversation-add-buttons">
                            <button
                              type="button"
                              className="lm-conversation-add-line student"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newLine = {
                                  id: `conv-${Date.now()}`,
                                  speaker: 'Student' as const,
                                  text: '_____ new dialogue line?',
                                };
                                const newLines = [...(section.conversationLines || []), newLine];
                                newSections[sectionIndex] = { ...section, conversationLines: newLines };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-add-line" />
                              <span>Add Student Line</span>
                            </button>
                            <button
                              type="button"
                              className="lm-conversation-add-line tutor"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newLine = {
                                  id: `conv-${Date.now()}`,
                                  speaker: 'Tutor' as const,
                                  text: 'New tutor response.',
                                };
                                const newLines = [...(section.conversationLines || []), newLine];
                                newSections[sectionIndex] = { ...section, conversationLines: newLines };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-add-line" />
                              <span>Add Tutor Line</span>
                            </button>
                          </div>
                        </>
                      )}

                      {/* Practice Image */}
                      <div className="lm-practice-image-area">
                        {section.practiceImage ? (
                          <div className="lm-practice-image-wrapper">
                            <img src={section.practiceImage} alt="Practice illustration" />
                            <button
                              type="button"
                              className="lm-practice-image-remove"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                newSections[sectionIndex] = { ...section, practiceImage: '' };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-delete-bin-line" />
                            </button>
                          </div>
                        ) : (
                          <label className="lm-practice-image-upload">
                            <input
                              type="file"
                              accept="image/*"
                              className="lm-hidden-input"
                              onChange={(e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const result = ev.target?.result as string;
                                  const newSections = [...draft.sections];
                                  newSections[sectionIndex] = { ...section, practiceImage: result };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <i className="ri-image-add-line" />
                            <span>Add Image</span>
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CHALLENGE 1 type content */}
                  {section.sectionType === 'challenge' && (
                    <div className="lm-challenge-container">
                      {/* Challenge Title */}
                      <h3
                        className="lm-challenge-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            challengeTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.challengeTitle}
                      </h3>

                      {/* Situation Box */}
                      <div className="lm-situation-box">
                        <p
                          className="lm-situation-text"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = {
                              ...section,
                              situationEn: (e.target as HTMLElement).textContent || ''
                            };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          {section.situationEn}
                        </p>
                        <p
                          className="lm-situation-text-jp"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = {
                              ...section,
                              situationJp: (e.target as HTMLElement).textContent || ''
                            };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          {section.situationJp}
                        </p>
                      </div>

                      {/* Grammar Tip Box */}
                      <div className="lm-grammar-tip-box">
                        <div className="lm-grammar-tip-header">
                          <span className="lm-grammar-tip-icon">📝</span>
                          <span
                            className="lm-grammar-tip-title"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newSections = [...draft.sections];
                              newSections[sectionIndex] = {
                                ...section,
                                grammarTipTitle: (e.target as HTMLElement).textContent || ''
                              };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            {section.grammarTipTitle}
                          </span>
                        </div>
                        <ul className="lm-grammar-tip-list">
                          {section.grammarTipItems?.map((item, itemIndex) => (
                            <li key={`tip-${itemIndex}`} className="lm-grammar-tip-item">
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newItems = [...(section.grammarTipItems || [])];
                                  newItems[itemIndex] = (e.target as HTMLElement).textContent || '';
                                  newSections[sectionIndex] = { ...section, grammarTipItems: newItems };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="lm-grammar-tip-add"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newItems = [...(section.grammarTipItems || []), 'new item'];
                            newSections[sectionIndex] = { ...section, grammarTipItems: newItems };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-line" /> Add Item
                        </button>
                      </div>

                      {/* Challenge Image */}
                      <div className="lm-challenge-image-area">
                        {section.practiceImage ? (
                          <div className="lm-challenge-image-wrapper">
                            <img src={section.practiceImage} alt="Challenge illustration" />
                            <button
                              type="button"
                              className="lm-challenge-image-remove"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                newSections[sectionIndex] = { ...section, practiceImage: '' };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-delete-bin-line" />
                            </button>
                          </div>
                        ) : (
                          <label className="lm-challenge-image-upload">
                            <input
                              type="file"
                              accept="image/*"
                              className="lm-hidden-input"
                              onChange={(e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const result = ev.target?.result as string;
                                  const newSections = [...draft.sections];
                                  newSections[sectionIndex] = { ...section, practiceImage: result };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <i className="ri-image-add-line" />
                            <span>Add Image</span>
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CHALLENGE 2 type content */}
                  {section.sectionType === 'challenge2' && (
                    <div className="lm-challenge-container">
                      {/* If Time Allows Badge */}
                      {section.isOptional && (
                        <div className="lm-optional-badge">
                          <i className="ri-time-line" />
                          <span>If Time Allows</span>
                        </div>
                      )}

                      {/* Challenge Title */}
                      <h3
                        className="lm-challenge-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            challengeTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.challengeTitle}
                      </h3>

                      {/* Instructions */}
                      <p
                        className="lm-challenge-instruction"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionEn}
                      </p>
                      <p
                        className="lm-challenge-instruction-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionJp}
                      </p>

                      {/* Topic Boxes */}
                      <div className="lm-topic-boxes">
                        {section.topicBoxes?.map((topic, topicIndex) => (
                          <div key={topic.id} className="lm-topic-box">
                            <div className="lm-topic-header">
                              <span
                                className="lm-topic-title"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newTopics = [...(section.topicBoxes || [])];
                                  newTopics[topicIndex] = { ...topic, topicTitle: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, topicBoxes: newTopics };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {topic.topicTitle}
                              </span>
                            </div>
                            <ol className="lm-topic-questions">
                              {topic.questions.map((q, qIndex) => (
                                <li key={q.id} className="lm-topic-question">
                                  <span
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newTopics = [...(section.topicBoxes || [])];
                                      const newQuestions = [...topic.questions];
                                      newQuestions[qIndex] = { ...q, question: (e.target as HTMLElement).textContent || '' };
                                      newTopics[topicIndex] = { ...topic, questions: newQuestions };
                                      newSections[sectionIndex] = { ...section, topicBoxes: newTopics };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {q.question}
                                  </span>
                                </li>
                              ))}
                            </ol>
                            <button
                              type="button"
                              className="lm-topic-add-question"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newTopics = [...(section.topicBoxes || [])];
                                const newQuestions = [...topic.questions, { id: `tq-${Date.now()}`, question: 'New question?' }];
                                newTopics[topicIndex] = { ...topic, questions: newQuestions };
                                newSections[sectionIndex] = { ...section, topicBoxes: newTopics };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                            >
                              <i className="ri-add-line" /> Add Question
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FEEDBACK section */}
                  {section.sectionType === 'feedback' && (
                    <div className="lm-feedback-content">
                      {/* Lesson Goal */}
                      <div className="lm-feedback-goal">
                        <span className="lm-feedback-goal-badge">GOAL</span>
                        <span
                          className="lm-feedback-goal-text"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = {
                              ...section,
                              lessonGoalTitle: (e.target as HTMLElement).textContent || ''
                            };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          {section.lessonGoalTitle || draft.header.lessonGoal || 'I can talk about after-work activities.'}
                        </span>
                      </div>
                      <p
                        className="lm-feedback-goal-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            explanationJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.explanationJp || '仕事の後の行動について話せるようになる。'}
                      </p>

                      {/* Lesson Goal Achievement Rubric */}
                      <div className="lm-feedback-rubric">
                        <div className="lm-feedback-rubric-header">LESSON GOAL ACHIEVEMENT</div>
                        <div className="lm-feedback-rubric-grid">
                          {section.feedbackRubric?.map((item, idx) => (
                            <div key={idx} className={`lm-feedback-rubric-item lm-rubric-${item.score}`}>
                              <div className="lm-rubric-score">{item.score}</div>
                              <div
                                className="lm-rubric-label"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newRubric = [...(section.feedbackRubric || [])];
                                  newRubric[idx] = { ...item, label: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, feedbackRubric: newRubric };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {item.label}
                              </div>
                              <div
                                className="lm-rubric-desc"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newRubric = [...(section.feedbackRubric || [])];
                                  newRubric[idx] = { ...item, description: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, feedbackRubric: newRubric };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {item.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Personalized Feedback Categories */}
                      <div className="lm-feedback-categories">
                        <div className="lm-feedback-categories-header">PERSONALIZED FEEDBACK</div>
                        <div className="lm-feedback-categories-grid">
                          {section.feedbackCategories?.map((cat, catIdx) => (
                            <div key={cat.id} className="lm-feedback-category">
                              <div
                                className="lm-feedback-cat-title"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newCats = [...(section.feedbackCategories || [])];
                                  newCats[catIdx] = { ...cat, title: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, feedbackCategories: newCats };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {cat.title}
                              </div>
                              <div
                                className="lm-feedback-cat-jp"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newCats = [...(section.feedbackCategories || [])];
                                  newCats[catIdx] = { ...cat, titleJp: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, feedbackCategories: newCats };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {cat.titleJp}
                              </div>
                              <div
                                className="lm-feedback-cat-desc"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newCats = [...(section.feedbackCategories || [])];
                                  newCats[catIdx] = { ...cat, descJp: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, feedbackCategories: newCats };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {cat.descJp}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Personalized Feedback Guide Table */}
                      <div className="lm-feedback-guide">
                        <div className="lm-feedback-guide-header">PERSONALIZED FEEDBACK GUIDE</div>
                        <table className="lm-feedback-guide-table">
                          <thead>
                            <tr>
                              <th></th>
                              <th>Focus on...</th>
                              <th>example feedback</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.feedbackGuide?.map((row, rowIdx) => (
                              <tr key={row.id}>
                                <td className="lm-guide-category">
                                  <strong
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newGuide = [...(section.feedbackGuide || [])];
                                      newGuide[rowIdx] = { ...row, category: (e.target as HTMLElement).textContent || '' };
                                      newSections[sectionIndex] = { ...section, feedbackGuide: newGuide };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {row.category}
                                  </strong>
                                  <span
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newGuide = [...(section.feedbackGuide || [])];
                                      newGuide[rowIdx] = { ...row, categoryDesc: (e.target as HTMLElement).textContent || '' };
                                      newSections[sectionIndex] = { ...section, feedbackGuide: newGuide };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {row.categoryDesc}
                                  </span>
                                </td>
                                <td
                                  className="lm-guide-focus"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newGuide = [...(section.feedbackGuide || [])];
                                    newGuide[rowIdx] = { ...row, focusOn: (e.target as HTMLElement).innerText || '' };
                                    newSections[sectionIndex] = { ...section, feedbackGuide: newGuide };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  dangerouslySetInnerHTML={{ __html: row.focusOn.replace(/\n/g, '<br/>') }}
                                />
                                <td
                                  className="lm-guide-example"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newGuide = [...(section.feedbackGuide || [])];
                                    newGuide[rowIdx] = { ...row, exampleFeedback: (e.target as HTMLElement).innerText || '' };
                                    newSections[sectionIndex] = { ...section, feedbackGuide: newGuide };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  dangerouslySetInnerHTML={{ __html: row.exampleFeedback.replace(/\n/g, '<br/>') }}
                                />
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* LISTENING (UNDERSTAND) section */}
                  {section.sectionType === 'listening' && (
                    <div className="lm-listening-content">
                      {/* LISTENING Title */}
                      <h2
                        className="lm-listening-main-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            stepTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.stepTitle || 'LISTENING'}
                      </h2>

                      {/* Situation Text */}
                      <p
                        className="lm-listening-situation-text"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            situationEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.situationEn || 'Saori and Catherine are visiting Catherine\'s family in Taiwan.'}
                      </p>
                      <p
                        className="lm-listening-situation-text-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            situationJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.situationJp || 'サオリとキャサリンは台湾にいるキャサリンの家族を訪ねています。'}
                      </p>

                      {/* Large Image */}
                      <div className="lm-listening-main-image">
                        {section.sectionImage ? (
                          <img src={section.sectionImage} alt="Listening scene" className="lm-listening-scene-img" />
                        ) : (
                          <div className="lm-listening-image-placeholder">
                            <i className="ri-image-add-line" />
                            <span>Click to add image</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* READING (UNDERSTAND) section */}
                  {section.sectionType === 'reading' && (
                    <div className="lm-reading-content">
                      {/* READING Title */}
                      <h2
                        className="lm-reading-main-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            stepTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.stepTitle || 'READING'}
                      </h2>

                      {/* Situation Text */}
                      <p
                        className="lm-reading-situation-text"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionEn: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionEn || 'It\'s Sunday morning. Saori and Masa are texting each other.'}
                      </p>
                      <p
                        className="lm-reading-situation-text-jp"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            instructionJp: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.instructionJp || '日曜の朝です。サオリはマサとメールのやり取りをしています。'}
                      </p>

                      {/* Image Area */}
                      <div className="lm-reading-main-image">
                        {section.readingImage ? (
                          <img src={section.readingImage} alt="Reading scene" className="lm-reading-scene-img" />
                        ) : (
                          <div 
                            className="lm-reading-image-placeholder"
                            onClick={() => {
                              if (fileInputRef.current) {
                                fileInputRef.current.dataset.target = `reading-image-${sectionIndex}`;
                                fileInputRef.current.click();
                              }
                            }}
                          >
                            <i className="ri-image-add-line" />
                            <span>Click to add image</span>
                          </div>
                        )}
                      </div>

                      {/* Text Message Dialogue Box */}
                      <div className="lm-reading-dialogue-box">
                        {(section.readingDialogueLines || []).map((line, lineIndex) => (
                          <div key={line.id} className="lm-reading-dialogue-line">
                            <span className="lm-reading-speaker">
                              <strong
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newLines = [...(section.readingDialogueLines || [])];
                                  newLines[lineIndex] = { ...line, speaker: (e.target as HTMLElement).textContent || '' };
                                  newSections[sectionIndex] = { ...section, readingDialogueLines: newLines };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {line.speaker}
                              </strong>:
                            </span>
                            <span
                              className="lm-reading-dialogue-text"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newSections = [...draft.sections];
                                const newLines = [...(section.readingDialogueLines || [])];
                                newLines[lineIndex] = { ...line, lineEn: (e.target as HTMLElement).textContent || '' };
                                newSections[sectionIndex] = { ...section, readingDialogueLines: newLines };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                              dangerouslySetInnerHTML={{
                                __html: line.underlineWords?.reduce(
                                  (text, word) => text.replace(word, `<u>${word}</u>`),
                                  line.lineEn
                                ) || line.lineEn
                              }}
                            />
                            <button
                              type="button"
                              className="lm-reading-line-delete"
                              onClick={() => {
                                const newSections = [...draft.sections];
                                const newLines = (section.readingDialogueLines || []).filter((_, i) => i !== lineIndex);
                                newSections[sectionIndex] = { ...section, readingDialogueLines: newLines };
                                setDraft(prev => ({ ...prev, sections: newSections }));
                              }}
                              title="Delete line"
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        ))}
                        
                        {/* Add Line Button */}
                        <button
                          type="button"
                          className="lm-reading-add-line-btn"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newLines = [...(section.readingDialogueLines || []), {
                              id: `line-${Date.now()}`,
                              speaker: 'Speaker',
                              lineEn: 'New dialogue line...'
                            }];
                            newSections[sectionIndex] = { ...section, readingDialogueLines: newLines };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-circle-line" /> Add Line
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LISTENING CHALLENGE section */}
                  {section.sectionType === 'listeningChallenge' && (
                    <div className="lm-listening-challenge-content">
                      {/* Challenge Title */}
                      <h3
                        className="lm-challenge-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            challengeTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.challengeTitle || 'Challenge 1'}
                      </h3>

                      {/* Situation Box */}
                      <div className="lm-situation-box">
                        <p
                          className="lm-situation-text"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = {
                              ...section,
                              situationEn: (e.target as HTMLElement).textContent || ''
                            };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          {section.situationEn || 'You\'re watching TV. Today\'s special guest is Connie Go, your friend\'s favorite actress.'}
                        </p>
                        <p
                          className="lm-situation-text-jp"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = {
                              ...section,
                              situationJp: (e.target as HTMLElement).textContent || ''
                            };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          {section.situationJp || 'あなたはテレビを見ています。今日のスペシャルゲストは友達が大好きな女優のユニー・ゴーです。'}
                        </p>
                        <p
                          className="lm-situation-instruction"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = {
                              ...section,
                              instructionEn: (e.target as HTMLElement).textContent || ''
                            };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          {section.instructionEn || 'Listen to the show. Then, call and tell your friend about it.'}
                        </p>
                        <p
                          className="lm-situation-instruction-jp"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = {
                              ...section,
                              instructionJp: (e.target as HTMLElement).textContent || ''
                            };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          {section.instructionJp || '番組を聞きましょう。その後、電話でその友達に番組の内容を伝えましょう。'}
                        </p>
                      </div>

                      {/* Grammar Tip Box */}
                      <div className="lm-grammar-tip-box lm-grammar-tip-simple">
                        <div className="lm-grammar-tip-header">
                          <span className="lm-grammar-tip-icon">📝</span>
                          <span
                            className="lm-grammar-tip-title"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newSections = [...draft.sections];
                              newSections[sectionIndex] = {
                                ...section,
                                grammarTipTitle: (e.target as HTMLElement).textContent || ''
                              };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            {section.grammarTipTitle || 'Today\'s grammar tip'}
                          </span>
                        </div>
                        <ul className="lm-grammar-tip-list">
                          {section.grammarTipItems?.map((item, itemIndex) => (
                            <li key={`tip-${itemIndex}`} className="lm-grammar-tip-item">
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newItems = [...(section.grammarTipItems || [])];
                                  newItems[itemIndex] = (e.target as HTMLElement).textContent || '';
                                  newSections[sectionIndex] = { ...section, grammarTipItems: newItems };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="lm-grammar-tip-add"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newItems = [...(section.grammarTipItems || []), 'new item'];
                            newSections[sectionIndex] = { ...section, grammarTipItems: newItems };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-line" /> Add Item
                        </button>
                      </div>

                      {/* Large Image */}
                      <div className="lm-listening-image-container">
                        {section.sectionImage ? (
                          <img src={section.sectionImage} alt="Challenge scene" className="lm-listening-image" />
                        ) : (
                          <div className="lm-listening-image-placeholder">
                            <i className="ri-image-add-line" />
                            <span>Click to add image</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Sidebar (Tutor View Only) */}
                {materialViewMode === 'tutor' && (
                <div className="lm-section-sidebar">
                  {/* INTRODUCE type sidebar */}
                  {(section.sectionType === 'introduce' || !section.sectionType) && (
                    <>
                      {/* Lesson Goal Box */}
                      <div className="lm-goal-box">
                        <div
                          className="lm-goal-box-header"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newSections = [...draft.sections];
                            newSections[sectionIndex] = {
                              ...section,
                              lessonGoalTitle: (e.target as HTMLElement).textContent || ''
                            };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          {section.lessonGoalTitle}
                        </div>
                        <div className="lm-goal-steps">
                          {section.lessonGoalSteps.map((step, stepIndex) => (
                            <div key={step.id} className="lm-goal-step">
                              <span className="lm-step-number">{stepIndex + 1}</span>
                              <div className="lm-step-content">
                                <div className="lm-step-header-row">
                                  <span
                                    className="lm-step-instruction"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        instruction: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.instruction}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-step-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete step"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                                {/* Script Lines */}
                                {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                  <div key={`script-${lineIndex}`} className="lm-step-script">
                                    <span className="lm-script-bullet">●</span>
                                    <span
                                      className="lm-script-text"
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => {
                                        const newSections = [...draft.sections];
                                        const newSteps = [...section.lessonGoalSteps];
                                        const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                        const newLines = [...currentLines];
                                        newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                        newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                        newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      }}
                                    >
                                      {line}
                                    </span>
                                    <button
                                      type="button"
                                      className="lm-script-delete-btn"
                                      onClick={() => {
                                        const newSections = [...draft.sections];
                                        const newSteps = [...section.lessonGoalSteps];
                                        const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                        const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                        newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                        newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      }}
                                      title="Delete script"
                                    >
                                      <i className="ri-close-line" />
                                    </button>
                                  </div>
                                ))}
                                {/* Tip Box */}
                                {step.tipText && (
                                  <div className="lm-step-tip">
                                    <span className="lm-tip-icon">◆</span>
                                    <span
                                      className="lm-tip-text"
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => {
                                        const newSections = [...draft.sections];
                                        const newSteps = [...section.lessonGoalSteps];
                                        newSteps[stepIndex] = {
                                          ...step,
                                          tipText: (e.target as HTMLElement).textContent || ''
                                        };
                                        newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      }}
                                    >
                                      {step.tipText}
                                    </span>
                                    <button
                                      type="button"
                                      className="lm-tip-delete-btn"
                                      onClick={() => {
                                        const newSections = [...draft.sections];
                                        const newSteps = [...section.lessonGoalSteps];
                                        newSteps[stepIndex] = { ...step, tipText: undefined };
                                        newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      }}
                                      title="Delete tip"
                                    >
                                      <i className="ri-close-line" />
                                    </button>
                                  </div>
                                )}
                                {/* Add Script/Tip Buttons */}
                                <div className="lm-step-actions">
                                  <button
                                    type="button"
                                    className="lm-add-script-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add script"
                                  >
                                    <i className="ri-add-line" /> Script
                                  </button>
                                  {!step.tipText && (
                                    <button
                                      type="button"
                                      className="lm-add-tip-btn"
                                      onClick={() => {
                                        const newSections = [...draft.sections];
                                        const newSteps = [...section.lessonGoalSteps];
                                        newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                        newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                        setDraft(prev => ({ ...prev, sections: newSections }));
                                      }}
                                      title="Add tip"
                                    >
                                      <i className="ri-lightbulb-line" /> Tip
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Add Step Button */}
                          <button
                            type="button"
                            className="lm-add-step-btn"
                            onClick={() => {
                              const newSections = [...draft.sections];
                              const newSteps = [...section.lessonGoalSteps, {
                                id: `step-${Date.now()}`,
                                instruction: 'New instruction step.'
                              }];
                              newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            <i className="ri-add-circle-line" /> Add Step
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* VOCABULARY type sidebar */}
                  {section.sectionType === 'vocabulary' && (
                    <div className="lm-vocab-sidebar">
                      {/* Sidebar Header */}
                      <div
                        className="lm-vocab-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-vocab-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                  const newSteps = [...section.lessonGoalSteps];
                                  newSteps[stepIndex] = {
                                    ...step,
                                    instruction: (e.target as HTMLElement).textContent || ''
                                  };
                                  newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {step.instruction}
                              </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Add Step Button */}
                        <button
                          type="button"
                          className="lm-add-step-btn"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newSteps = [...section.lessonGoalSteps, {
                              id: `step-${Date.now()}`,
                              instruction: 'New instruction step.'
                            }];
                            newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-circle-line" /> Add Step
                        </button>
                      </div>
                    </div>
                  )}

                  {/* QUESTION type sidebar */}
                  {section.sectionType === 'question' && (
                    <div className="lm-vocab-sidebar">
                      {/* Sidebar Header */}
                      <div
                        className="lm-vocab-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-vocab-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      instruction: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.instruction}
                                </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Add Step Button */}
                      <button
                        type="button"
                        className="lm-add-step-btn"
                        onClick={() => {
                          const newSections = [...draft.sections];
                          const newSteps = [...section.lessonGoalSteps, {
                            id: `step-${Date.now()}`,
                            instruction: 'New instruction step.'
                          }];
                          newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        <i className="ri-add-circle-line" /> Add Step
                      </button>
                    </div>
                  )}

                  {/* PRONUNCIATION type sidebar */}
                  {section.sectionType === 'pronunciation' && (
                    <div className="lm-vocab-sidebar">
                      {/* Sidebar Header */}
                      <div
                        className="lm-vocab-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-vocab-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      instruction: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.instruction}
                                </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Add Step Button */}
                      <button
                        type="button"
                        className="lm-add-step-btn"
                        onClick={() => {
                          const newSections = [...draft.sections];
                          const newSteps = [...section.lessonGoalSteps, {
                            id: `step-${Date.now()}`,
                            instruction: 'New instruction step.'
                          }];
                          newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        <i className="ri-add-circle-line" /> Add Step
                      </button>
                    </div>
                  )}

                  {/* GRAMMAR type sidebar */}
                  {section.sectionType === 'grammar' && (
                    <div className="lm-vocab-sidebar">
                      {/* Sidebar Header */}
                      <div
                        className="lm-vocab-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-vocab-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      instruction: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.instruction}
                                </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Add Step Button */}
                      <button
                        type="button"
                        className="lm-add-step-btn"
                        onClick={() => {
                          const newSections = [...draft.sections];
                          const newSteps = [...section.lessonGoalSteps, {
                            id: `step-${Date.now()}`,
                            instruction: 'New instruction step.'
                          }];
                          newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        <i className="ri-add-circle-line" /> Add Step
                      </button>
                    </div>
                  )}

                  {/* DIALOGUE type sidebar */}
                  {section.sectionType === 'dialogue' && (
                    <div className="lm-dialogue-sidebar">
                      {/* Sidebar Header - Blue background */}
                      <div
                        className="lm-dialogue-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-dialogue-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      instruction: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.instruction}
                                </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Add Step Button */}
                      <button
                        type="button"
                        className="lm-add-step-btn"
                        onClick={() => {
                          const newSections = [...draft.sections];
                          const newSteps = [...section.lessonGoalSteps, {
                            id: `step-${Date.now()}`,
                            instruction: 'New instruction step.'
                          }];
                          newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        <i className="ri-add-circle-line" /> Add Step
                      </button>
                    </div>
                  )}

                  {/* TRIVIA type sidebar */}
                  {section.sectionType === 'trivia' && (
                    <div className="lm-dialogue-sidebar">
                      {/* Sidebar Header - Blue background */}
                      <div
                        className="lm-dialogue-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-dialogue-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      instruction: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.instruction}
                                </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Add Step Button */}
                      <button
                        type="button"
                        className="lm-add-step-btn"
                        onClick={() => {
                          const newSections = [...draft.sections];
                          const newSteps = [...section.lessonGoalSteps, {
                            id: `step-${Date.now()}`,
                            instruction: 'New instruction step.'
                          }];
                          newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        <i className="ri-add-circle-line" /> Add Step
                      </button>
                    </div>
                  )}

                  {/* PRACTICE type sidebar */}
                  {section.sectionType === 'practice' && (
                    <div className="lm-vocab-sidebar">
                      {/* Sidebar Header - Blue background */}
                      <div
                        className="lm-vocab-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-vocab-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      instruction: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.instruction}
                                </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Add Step Button */}
                      <button
                        type="button"
                        className="lm-add-step-btn"
                        onClick={() => {
                          const newSections = [...draft.sections];
                          const newSteps = [...section.lessonGoalSteps, {
                            id: `step-${Date.now()}`,
                            instruction: 'New instruction step.'
                          }];
                          newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        <i className="ri-add-circle-line" /> Add Step
                      </button>
                      {/* Answer Box - Green border with numbered answers */}
                      {section.answerItems && section.answerItems.length > 0 && (
                        <div className="lm-practice-answer-box">
                          <ol className="lm-practice-answer-list">
                            {section.answerItems.map((answer, ansIndex) => (
                              <li key={`answer-${ansIndex}`} className="lm-practice-answer-item">
                                <span
                                  className="lm-practice-answer-text"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newAnswers = [...(section.answerItems || [])];
                                    newAnswers[ansIndex] = (e.target as HTMLElement).textContent || '';
                                    newSections[sectionIndex] = { ...section, answerItems: newAnswers };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {answer}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CHALLENGE type sidebar */}
                  {(section.sectionType === 'challenge' || section.sectionType === 'challenge2') && (
                    <div className="lm-challenge-sidebar">
                      {/* Sidebar Header - Blue background */}
                      <div
                        className="lm-challenge-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-challenge-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      instruction: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.instruction}
                                </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-bullet">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Add Step Button */}
                      <button
                        type="button"
                        className="lm-add-step-btn"
                        onClick={() => {
                          const newSections = [...draft.sections];
                          const newSteps = [...section.lessonGoalSteps, {
                            id: `step-${Date.now()}`,
                            instruction: 'New instruction step.'
                          }];
                          newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        <i className="ri-add-circle-line" /> Add Step
                      </button>
                    </div>
                  )}

                  {/* FEEDBACK type sidebar */}
                  {section.sectionType === 'feedback' && (
                    <div className="lm-feedback-sidebar">
                      {/* Sidebar Header - Red background */}
                      <div
                        className="lm-feedback-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>

                      {/* Steps List */}
                      <div className="lm-feedback-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-feedback-step">
                            <span className="lm-feedback-step-number">{stepIndex + 1}</span>
                            <div className="lm-feedback-step-content">
                              <span
                                className="lm-feedback-step-instruction"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newSteps = [...section.lessonGoalSteps];
                                  newSteps[stepIndex] = {
                                    ...step,
                                    instruction: (e.target as HTMLElement).textContent || ''
                                  };
                                  newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {step.instruction}
                              </span>
                              {step.scriptLine && (
                                <p
                                  className="lm-feedback-step-script"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      scriptLine: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.scriptLine}
                                </p>
                              )}
                              {step.tipText && (
                                <div className="lm-feedback-step-tip">
                                  <span className="lm-tip-bullet">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Remember Box */}
                      <div className="lm-feedback-remember">
                        <p><strong>REMEMBER:</strong> Effective feedback is specific to the student's actual performance.</p>
                      </div>
                    </div>
                  )}

                  {/* LISTENING type sidebar */}
                  {section.sectionType === 'listening' && (
                    <div className="lm-listening-sidebar">
                      {/* Sidebar Header */}
                      <div
                        className="lm-listening-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle || 'UNDERSTAND'}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-listening-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle || 'LISTENING (3 minutes)'}
                      </div>
                      
                      {/* Steps with Add Button */}
                      <div className="lm-listening-steps-container">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-listening-step">
                            <div className="lm-listening-step-header">
                              <span className="lm-step-number">{stepIndex + 1}</span>
                              <span
                                className="lm-listening-step-instruction"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newSteps = [...section.lessonGoalSteps];
                                  newSteps[stepIndex] = {
                                    ...step,
                                    instruction: (e.target as HTMLElement).textContent || ''
                                  };
                                  newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {step.instruction}
                              </span>
                              <button
                                type="button"
                                className="lm-listening-step-delete"
                                onClick={() => {
                                  const newSections = [...draft.sections];
                                  const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                  newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                                title="Delete step"
                              >
                                <i className="ri-close-line" />
                              </button>
                            </div>
                            
                            {/* Script Lines (Green boxes) */}
                            {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                              <div key={`script-${lineIndex}`} className="lm-listening-script-line-box">
                                <span className="lm-listening-script-bullet">●</span>
                                <span
                                  className="lm-listening-script-line-text"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    const newLines = [...currentLines];
                                    newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                    newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {line}
                                </span>
                                <button
                                  type="button"
                                  className="lm-listening-line-delete"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                    newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete script line"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ))}
                            
                            {/* Tip Box (Orange/Red) */}
                            {step.tipText && (
                              <div className="lm-listening-tip-box">
                                <span className="lm-listening-tip-icon">◆</span>
                                <span
                                  className="lm-listening-tip-text"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      tipText: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.tipText}
                                </span>
                                <button
                                  type="button"
                                  className="lm-listening-tip-delete"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = { ...step, tipText: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete tip"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            )}
                            
                            {/* Add Script/Tip buttons */}
                            <div className="lm-listening-step-actions">
                              <button
                                type="button"
                                className="lm-listening-add-script-btn"
                                onClick={() => {
                                  const newSections = [...draft.sections];
                                  const newSteps = [...section.lessonGoalSteps];
                                  const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                  newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script line..."'], scriptLine: undefined };
                                  newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                                title="Add script line"
                              >
                                <i className="ri-add-line" /> Script
                              </button>
                              {!step.tipText && (
                                <button
                                  type="button"
                                  className="lm-listening-add-tip-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = { ...step, tipText: 'Add a tip or reminder here...' };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add tip"
                                >
                                  <i className="ri-lightbulb-line" /> Tip
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {/* Add Step Button */}
                        <button
                          type="button"
                          className="lm-listening-add-step-btn"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newSteps = [...section.lessonGoalSteps, {
                              id: `step-${Date.now()}`,
                              instruction: 'New instruction step.'
                            }];
                            newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-circle-line" /> Add Step
                        </button>
                      </div>
                      
                      {/* Listening Script Box (Green with underlines) */}
                      <div className="lm-listening-full-script-box">
                        <div className="lm-listening-full-script-content">
                          <pre
                            className="lm-listening-full-script-text"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newSections = [...draft.sections];
                              newSections[sectionIndex] = {
                                ...section,
                                listeningScriptText: (e.target as HTMLElement).textContent || ''
                              };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            {section.listeningScriptText || 'Saori, let\'s eat breakfast together tomorrow. Please wake up at 6:00 a.m. Yes, I know that\'s early! Here in Taiwan, I always wake up early. I take a shower and brush my teeth. Then, I get dressed and do my hair for a long time. (laughs) We don\'t eat breakfast at home. We always eat out for breakfast here. Let\'s eat at a food stand tomorrow. Okay?'}
                          </pre>
                        </div>
                      </div>
                      
                      {/* Questions Box */}
                      {section.listeningQuestions && section.listeningQuestions.length > 0 && (
                        <div className="lm-listening-questions-sidebar">
                          {section.listeningQuestions.map((q, qIdx) => (
                            <div key={q.id} className="lm-listening-q-item">
                              <div className="lm-listening-q-bullet">•</div>
                              <div className="lm-listening-q-content">
                                <div
                                  className="lm-listening-q-text"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newQuestions = [...(section.listeningQuestions || [])];
                                    newQuestions[qIdx] = { ...q, questionEn: (e.target as HTMLElement).textContent || '' };
                                    newSections[sectionIndex] = { ...section, listeningQuestions: newQuestions };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {q.questionEn}
                                </div>
                                <div
                                  className="lm-listening-q-answer"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newQuestions = [...(section.listeningQuestions || [])];
                                    newQuestions[qIdx] = { ...q, answerCorrect: (e.target as HTMLElement).textContent || '' };
                                    newSections[sectionIndex] = { ...section, listeningQuestions: newQuestions };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {q.answerCorrect || '(answer)'}
                                </div>
                              </div>
                            </div>
                          ))}
                          {/* Add Question Button */}
                          <button
                            type="button"
                            className="lm-listening-add-q-btn"
                            onClick={() => {
                              const newSections = [...draft.sections];
                              const newQuestions = [...(section.listeningQuestions || []), {
                                id: `q-${Date.now()}`,
                                questionEn: 'New question?',
                                questionJp: '',
                                answerCorrect: '(answer)',
                                answerWrong: ''
                              }];
                              newSections[sectionIndex] = { ...section, listeningQuestions: newQuestions };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            <i className="ri-add-line" /> Add Question
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* READING type sidebar */}
                  {section.sectionType === 'reading' && (
                    <div className="lm-reading-sidebar">
                      {/* Sidebar Header */}
                      <div
                        className="lm-reading-sidebar-header"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle || 'UNDERSTAND'}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-reading-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle || 'READING (3 minutes)'}
                      </div>
                      
                      {/* Steps with Script/Tip support */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <div className="lm-step-header-row">
                                <span
                                  className="lm-step-instruction"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    newSteps[stepIndex] = {
                                      ...step,
                                      instruction: (e.target as HTMLElement).textContent || ''
                                    };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {step.instruction}
                                </span>
                                <button
                                  type="button"
                                  className="lm-step-delete-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = section.lessonGoalSteps.filter((_, i) => i !== stepIndex);
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Delete step"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                              {/* Script Lines */}
                              {(step.scriptLines || (step.scriptLine ? [step.scriptLine] : [])).map((line, lineIndex) => (
                                <div key={`script-${lineIndex}`} className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = [...currentLines];
                                      newLines[lineIndex] = (e.target as HTMLElement).textContent || '';
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {line}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-script-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                      const newLines = currentLines.filter((_, i) => i !== lineIndex);
                                      newSteps[stepIndex] = { ...step, scriptLines: newLines.length > 0 ? newLines : undefined, scriptLine: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete script"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              ))}
                              {/* Tip Box(es) */}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: undefined };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Second Tip (tipText2) */}
                              {(step as any).tipText2 && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-icon">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      (newSteps[stepIndex] as any).tipText2 = (e.target as HTMLElement).textContent || '';
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {(step as any).tipText2}
                                  </span>
                                  <button
                                    type="button"
                                    className="lm-tip-delete-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      delete (newSteps[stepIndex] as any).tipText2;
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Delete tip"
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </div>
                              )}
                              {/* Add Script/Tip Buttons */}
                              <div className="lm-step-actions">
                                <button
                                  type="button"
                                  className="lm-add-script-btn"
                                  onClick={() => {
                                    const newSections = [...draft.sections];
                                    const newSteps = [...section.lessonGoalSteps];
                                    const currentLines = step.scriptLines || (step.scriptLine ? [step.scriptLine] : []);
                                    newSteps[stepIndex] = { ...step, scriptLines: [...currentLines, '"New script..."'], scriptLine: undefined };
                                    newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                  title="Add script"
                                >
                                  <i className="ri-add-line" /> Script
                                </button>
                                {!step.tipText && (
                                  <button
                                    type="button"
                                    className="lm-add-tip-btn"
                                    onClick={() => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = { ...step, tipText: 'Add tip here...' };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                    title="Add tip"
                                  >
                                    <i className="ri-lightbulb-line" /> Tip
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Add Step Button */}
                        <button
                          type="button"
                          className="lm-add-step-btn"
                          onClick={() => {
                            const newSections = [...draft.sections];
                            const newSteps = [...section.lessonGoalSteps, {
                              id: `step-${Date.now()}`,
                              instruction: 'New instruction step.'
                            }];
                            newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                            setDraft(prev => ({ ...prev, sections: newSections }));
                          }}
                        >
                          <i className="ri-add-circle-line" /> Add Step
                        </button>
                      </div>
                      
                      {/* Questions Box (green background) */}
                      {section.readingQuestions && section.readingQuestions.length > 0 && (
                        <div className="lm-reading-questions-sidebar">
                          {section.readingQuestions.map((q, qIdx) => (
                            <div key={q.id} className="lm-reading-q-item">
                              <div className="lm-reading-q-bullet">•</div>
                              <div className="lm-reading-q-content">
                                <div
                                  className="lm-reading-q-text"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newQuestions = [...(section.readingQuestions || [])];
                                    newQuestions[qIdx] = { ...q, questionEn: (e.target as HTMLElement).textContent || '' };
                                    newSections[sectionIndex] = { ...section, readingQuestions: newQuestions };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {q.questionEn}
                                </div>
                                <div
                                  className="lm-reading-q-answer"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newQuestions = [...(section.readingQuestions || [])];
                                    newQuestions[qIdx] = { ...q, answer: (e.target as HTMLElement).textContent || '' };
                                    newSections[sectionIndex] = { ...section, readingQuestions: newQuestions };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {q.answer || '(answer)'}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="lm-reading-q-delete"
                                onClick={() => {
                                  const newSections = [...draft.sections];
                                  const newQuestions = (section.readingQuestions || []).filter((_, i) => i !== qIdx);
                                  newSections[sectionIndex] = { ...section, readingQuestions: newQuestions };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                                title="Delete question"
                              >
                                <i className="ri-close-line" />
                              </button>
                            </div>
                          ))}
                          {/* Add Question Button */}
                          <button
                            type="button"
                            className="lm-reading-add-q-btn"
                            onClick={() => {
                              const newSections = [...draft.sections];
                              const newQuestions = [...(section.readingQuestions || []), {
                                id: `q-${Date.now()}`,
                                questionEn: 'New question?',
                                answer: '(answer)'
                              }];
                              newSections[sectionIndex] = { ...section, readingQuestions: newQuestions };
                              setDraft(prev => ({ ...prev, sections: newSections }));
                            }}
                          >
                            <i className="ri-add-line" /> Add Question
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* LISTENING CHALLENGE type sidebar */}
                  {section.sectionType === 'listeningChallenge' && (
                    <div className="lm-listening-sidebar">
                      {/* Sidebar Header */}
                      <div
                        className="lm-listening-sidebar-header challenge"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarTitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarTitle}
                      </div>
                      {/* Sidebar Subheader */}
                      <div
                        className="lm-listening-sidebar-subheader"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newSections = [...draft.sections];
                          newSections[sectionIndex] = {
                            ...section,
                            sidebarSubtitle: (e.target as HTMLElement).textContent || ''
                          };
                          setDraft(prev => ({ ...prev, sections: newSections }));
                        }}
                      >
                        {section.sidebarSubtitle}
                      </div>
                      {/* Steps */}
                      <div className="lm-goal-steps">
                        {section.lessonGoalSteps.map((step, stepIndex) => (
                          <div key={step.id} className="lm-goal-step">
                            <span className="lm-step-number">{stepIndex + 1}</span>
                            <div className="lm-step-content">
                              <span
                                className="lm-step-instruction"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newSections = [...draft.sections];
                                  const newSteps = [...section.lessonGoalSteps];
                                  newSteps[stepIndex] = {
                                    ...step,
                                    instruction: (e.target as HTMLElement).textContent || ''
                                  };
                                  newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                  setDraft(prev => ({ ...prev, sections: newSections }));
                                }}
                              >
                                {step.instruction}
                              </span>
                              {step.scriptLine && (
                                <div className="lm-step-script">
                                  <span className="lm-script-bullet">●</span>
                                  <span
                                    className="lm-script-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        scriptLine: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.scriptLine}
                                  </span>
                                </div>
                              )}
                              {step.tipText && (
                                <div className="lm-step-tip">
                                  <span className="lm-tip-bullet">◆</span>
                                  <span
                                    className="lm-tip-text"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const newSections = [...draft.sections];
                                      const newSteps = [...section.lessonGoalSteps];
                                      newSteps[stepIndex] = {
                                        ...step,
                                        tipText: (e.target as HTMLElement).textContent || ''
                                      };
                                      newSections[sectionIndex] = { ...section, lessonGoalSteps: newSteps };
                                      setDraft(prev => ({ ...prev, sections: newSections }));
                                    }}
                                  >
                                    {step.tipText}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Conversation Prompts Box */}
                      {section.conversationPrompts && section.conversationPrompts.length > 0 && (
                        <div className="lm-listening-prompts-box">
                          <div className="lm-listening-prompts-header">Conversation Prompts</div>
                          <div className="lm-listening-prompts-content">
                            {section.conversationPrompts.map((prompt, promptIndex) => (
                              <div key={`prompt-${promptIndex}`} className="lm-listening-prompt-item">
                                <span className="lm-listening-prompt-bullet">●</span>
                                <span
                                  className="lm-listening-prompt-text"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const newSections = [...draft.sections];
                                    const newPrompts = [...(section.conversationPrompts || [])];
                                    newPrompts[promptIndex] = (e.target as HTMLElement).textContent || '';
                                    newSections[sectionIndex] = { ...section, conversationPrompts: newPrompts };
                                    setDraft(prev => ({ ...prev, sections: newSections }));
                                  }}
                                >
                                  {prompt}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {/* Click outside to close header controls */}
      {showHeaderControls && (
        <div
          className="lm-backdrop"
          onClick={() => setShowHeaderControls(false)}
        />
      )}
    </div>
  );
}
