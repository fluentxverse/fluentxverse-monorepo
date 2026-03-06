/**
 * BusinessEnglishVisualEditor
 * WYSIWYG visual editor for Business English PCPP lesson materials.
 *
 * 7-page scrollable document matching the reference PDF structure:
 *   Page 1: ① Introduce (Goal + Situation) + ② Present (Key Expressions)
 *   Page 2: ③ Understand (Table) + Useful Vocabulary + Pronunciation
 *   Page 3: ④ Practice Steps 1-2
 *   Page 4: ④ Practice Steps 3-4
 *   Page 5: ⑤ Challenge (Simulation)
 *   Page 6: ⑤ Challenge – Discussion Questions
 *   Page 7: ⑥ Feedback
 *
 * Design: white page, black bars, dark-purple accent (#4c1d95)
 * Two-column: Student material (left) | Teaching Notes (right)
 */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import {
  getLessonById,
  updateLessonHeader,
  type LessonMaterial,
} from '../api/lessonMaterial.api';
import { toast } from '../Components/Toast/Toast';
import { BEAIContentGenerator } from '../components/BEAIContentGenerator';
import type { BESectionType } from '../api/ai.api';
import './BusinessEnglishVisualEditor.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type LessonType = 'READING' | 'SPEAKING' | 'LISTENING' | 'WRITING' | 'REVIEW';
interface PatternItem { en: string; jp: string; }
interface VocabItem { word: string; pos: string; translation: string; definition?: string; pronunciation?: string; }
interface PronunColumn { symbol: string; words: { en: string; jp: string }[]; }
interface DialogueLine { role: 'tutor' | 'student'; en: string; jp: string; }
interface FillRow { parts: { text: string; isBlank: boolean }[]; }
interface DiscussionCategory { title: string; questions: string[]; }
interface TutorNote { type: 'instruction' | 'script' | 'tip'; text: string; }
interface GuideQuestion { text: string; }
interface PatternDrill {
  label: string; labelJp: string;
  template: string;
  examples: { en: string; jp: string }[];
}
interface WordBoxItem { word: string; translation?: string; }

// ─── Activity Block Types ─────────────────────────────────
type ActivityBlockType = 'matching' | 'multipleChoice' | 'sentenceReorder' | 'errorCorrection' | 'dialogueCompletion' | 'trueFalse' | 'readingPassage' | 'categorization' | 'image';

interface MatchingPair { left: string; right: string; }
interface MatchingBlock { type: 'matching'; id: string; title: string; titleJp: string; pairs: MatchingPair[]; }

interface MCQOption { text: string; isCorrect: boolean; }
interface MCQItem { question: string; questionJp: string; options: MCQOption[]; }
interface MultipleChoiceBlock { type: 'multipleChoice'; id: string; title: string; titleJp: string; items: MCQItem[]; }

interface SentenceReorderItem { jumbled: string; answer: string; }
interface SentenceReorderBlock { type: 'sentenceReorder'; id: string; title: string; titleJp: string; items: SentenceReorderItem[]; }

interface ErrorCorrectionItem { sentence: string; corrected: string; hint: string; }
interface ErrorCorrectionBlock { type: 'errorCorrection'; id: string; title: string; titleJp: string; items: ErrorCorrectionItem[]; }

interface DialogueCompletionSlot { role: 'tutor' | 'student'; text: string; isBlank: boolean; }
interface DialogueCompletionBlock { type: 'dialogueCompletion'; id: string; title: string; titleJp: string; slots: DialogueCompletionSlot[]; }

interface TrueFalseItem { statement: string; statementJp: string; answer: boolean; }
interface TrueFalseBlock { type: 'trueFalse'; id: string; title: string; titleJp: string; items: TrueFalseItem[]; }

interface ReadingPassageBlock { type: 'readingPassage'; id: string; title: string; titleJp: string; passage: string; questions: { question: string; questionJp: string }[]; }

interface CategorizationCategory { name: string; items: string[]; }
interface CategorizationBlock { type: 'categorization'; id: string; title: string; titleJp: string; categories: CategorizationCategory[]; }

interface ImageItem { src: string; label: string; }
interface ImageBlock { type: 'image'; id: string; title: string; titleJp: string; images: ImageItem[]; }

type ActivityBlock = MatchingBlock | MultipleChoiceBlock | SentenceReorderBlock | ErrorCorrectionBlock | DialogueCompletionBlock | TrueFalseBlock | ReadingPassageBlock | CategorizationBlock | ImageBlock;

const ACTIVITY_BLOCK_META: Record<ActivityBlockType, { label: string; labelJp: string; icon: string }> = {
  matching: { label: 'Matching', labelJp: 'マッチング', icon: 'ri-links-line' },
  multipleChoice: { label: 'Multiple Choice', labelJp: '多肢選択', icon: 'ri-checkbox-circle-line' },
  sentenceReorder: { label: 'Sentence Reordering', labelJp: '並べ替え', icon: 'ri-sort-asc' },
  errorCorrection: { label: 'Error Correction', labelJp: '誤り訂正', icon: 'ri-eraser-line' },
  dialogueCompletion: { label: 'Dialogue Completion', labelJp: '会話完成', icon: 'ri-chat-3-line' },
  trueFalse: { label: 'True / False', labelJp: '正誤問題', icon: 'ri-checkbox-line' },
  readingPassage: { label: 'Reading Passage', labelJp: '読解', icon: 'ri-article-line' },
  categorization: { label: 'Categorization', labelJp: '分類', icon: 'ri-layout-grid-line' },
  image: { label: 'Image', labelJp: '画像', icon: 'ri-image-line' },
};

interface BELessonData {
  lessonType: LessonType;
  hiddenBlocks: string[];
  introduce: {
    goalEn: string; goalJp: string;
    situationEn: string; situationJp: string;
    taskEn: string; taskJp: string;
    tutorNotes: TutorNote[];
  };
  present: {
    patterns: PatternItem[];
    vocabulary: VocabItem[];
    pronunciation: { instruction: string; instructionJp: string; left: PronunColumn; right: PronunColumn; };
    tutorNotes: TutorNote[];
  };
  understand: {
    instruction: string; instructionJp: string;
    fillRows: FillRow[];
    patternDrills: PatternDrill[];
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  practice: {
    steps: {
      title: string; instructionEn: string; instructionJp: string;
      content: string; dialogue?: DialogueLine[]; wordBox?: WordBoxItem[];
      tutorNotes: TutorNote[];
    }[];
    activityBlocks: ActivityBlock[];
  };
  challenge: {
    scenarioEn: string; scenarioJp: string;
    guideQuestions: GuideQuestion[];
    roleplayTable?: { you: string; coworkers: string[] };
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  discussion: {
    instructionEn: string; instructionJp: string;
    categories: DiscussionCategory[];
    activityBlocks: ActivityBlock[];
    tutorNotes: TutorNote[];
  };
  feedback: {
    goalReviewEn: string; goalReviewJp: string;
    feedbackTemplate: string;
    nextLessonLabel: string; nextLessonName: string;
    tutorNotes: TutorNote[];
  };
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_BE_DATA: BELessonData = {
  lessonType: 'READING',
  hiddenBlocks: [],
  introduce: {
    goalEn: 'Can introduce yourself and your coworker.',
    goalJp: '\u81EA\u5DF1\u7D39\u4ECB\u3068\u540C\u50DA\u306E\u7D39\u4ECB\u304C\u3067\u304D\u308B\u3088\u3046\u306B\u306A\u308B\u3002',
    situationEn: 'A new coworker joins your team. Introduce yourself and another coworker to him/her.',
    situationJp: '\u3042\u306A\u305F\u306E\u30C1\u30FC\u30E0\u306B\u3001\u65B0\u3057\u3044\u793E\u54E1\u304C\u914D\u5C5E\u3055\u308C\u307E\u3057\u305F\u3002\u307E\u305A\u3042\u306A\u305F\u304C\u81EA\u5DF1\u7D39\u4ECB\u3092\u3057\u3066\u304B\u3089\u3001\u30C1\u30FC\u30E0\u306E\u30E1\u30F3\u30D0\u30FC\u3092\u5F7C/\u5F7C\u5973\u306B\u7D39\u4ECB\u3057\u307E\u3057\u3087\u3046\u3002',
    taskEn: '', taskJp: '',
    tutorNotes: [
      { type: 'script', text: '"Today, we\'re going to talk about introducing yourself and your coworker."' },
      { type: 'instruction', text: 'Read the lesson goal.' },
      { type: 'instruction', text: 'Ask the student to repeat.' },
      { type: 'script', text: '"Is it clear?"' },
      { type: 'script', text: '"Let\'s go to the next part."' },
    ],
  },
  present: {
    patterns: [
      { en: 'My name is John.', jp: '\u79C1\u306E\u540D\u524D\u306F\u30B8\u30E7\u30F3\u3067\u3059\u3002' },
      { en: 'This is Andrew.', jp: '\u3053\u3061\u3089\u304C\u3001\u30A2\u30F3\u30C9\u30EA\u30E5\u30FC\u3067\u3059\u3002' },
      { en: 'We are coworkers.', jp: '\u79C1\u305F\u3061\u306F\u540C\u50DA\u3067\u3059\u3002' },
    ],
    vocabulary: [
      { word: 'pleased', pos: 'adjective', translation: '\u559C\u3093\u3067', definition: 'very happy', pronunciation: '[pleezd]' },
      { word: 'coworker', pos: 'noun', translation: '\u540C\u50DA', definition: 'someone you work with', pronunciation: '[KOH-wur-ker]' },
      { word: 'join', pos: 'verb', translation: '\u52A0\u308F\u308B', definition: 'to become a member of a group', pronunciation: '[join]' },
    ],
    pronunciation: {
      instruction: "Let's practice saying words with /\u00E6/ and /\u028C/.",
      instructionJp: '\u767A\u97F3',
      left: { symbol: '/\u00E6/', words: [{ en: 'bag', jp: '\u30D0\u30C3\u30B0' },{ en: 'fan', jp: '\u6247\u98A8\u6A5F' },{ en: 'cab', jp: '\u30BF\u30AF\u30B7\u30FC' },{ en: 'hat', jp: '\u5E3D\u5B50' },{ en: 'lack', jp: '\u6B20\u3044\u3066\u3044\u308B' }] },
      right: { symbol: '/\u028C/', words: [{ en: 'bug', jp: '\u6606\u866B' },{ en: 'fun', jp: '\u697D\u3057\u307F' },{ en: 'cub', jp: '\u5E7C\u7363' },{ en: 'hut', jp: '\u5C71\u5C0F\u5C4B' },{ en: 'luck', jp: '\u5E78\u904B' }] },
    },
    tutorNotes: [
      { type: 'script', text: '"Let\'s look at patterns used in introducing yourself and your coworker."' },
      { type: 'instruction', text: 'Read the first pattern. Ask the student to repeat.' },
      { type: 'script', text: '"Use this to introduce yourself."' },
      { type: 'instruction', text: 'Read each word. Ask the student to repeat.' },
      { type: 'tip', text: 'For lower-level students, give simple definitions.' },
    ],
  },
  understand: {
    instruction: 'You can use these patterns to introduce yourself and a coworker.',
    instructionJp: '\u81EA\u5DF1\u7D39\u4ECB\u3084\u540C\u50DA\u3092\u7D39\u4ECB\u3059\u308B\u969B\u3001\u4EE5\u4E0B\u306E\u30D1\u30BF\u30FC\u30F3\u3092\u4F7F\u3044\u307E\u3059\u3002',
    fillRows: [],
    patternDrills: [],
    activityBlocks: [],
    tutorNotes: [
      { type: 'instruction', text: 'Read each sentence in the table. Ask the student to repeat.' },
      { type: 'instruction', text: 'Correct mispronounced words after reading.' },
      { type: 'tip', text: 'For lower-level students, explain how each sentence is used.' },
    ],
  },
  practice: {
    steps: [
      {
        title: 'Step 1 \u2014 Repeat',
        instructionEn: 'Repeat after your tutor.',
        instructionJp: '\u8B1B\u5E2B\u306E\u3042\u3068\u306B\u7E70\u308A\u8FD4\u3057\u307E\u3057\u3087\u3046\u3002',
        content: '',
        tutorNotes: [
          { type: 'script', text: '"I will read each sentence. Please repeat after me."' },
          { type: 'instruction', text: 'Adjust the speed according to the student\'s level.' },
          { type: 'instruction', text: 'Correct mispronounced words after reading.' },
        ],
      },
      {
        title: 'Step 2 \u2014 Fill in the Blanks',
        instructionEn: 'Fill in the blanks with the correct pattern.',
        instructionJp: '\u9069\u5207\u306A\u30D1\u30BF\u30FC\u30F3\u3092\u5165\u308C\u307E\u3057\u3087\u3046\u3002',
        content: '',
        tutorNotes: [
          { type: 'script', text: '"Let\'s practice again."' },
          { type: 'instruction', text: 'Read the instruction.' },
          { type: 'script', text: '"Please start with the first sentence."' },
        ],
      },
      {
        title: 'Step 3 \u2014 Dialogue',
        instructionEn: 'Read the dialogue with your tutor.',
        instructionJp: '\u8B1B\u5E2B\u3068\u4E00\u7DD2\u306B\u4F1A\u8A71\u3092\u8AAD\u307F\u307E\u3057\u3087\u3046\u3002',
        content: '',
        dialogue: [
          { role: 'tutor', en: 'Good morning. My name is Evan. It\'s my first day today.', jp: '\u304A\u306F\u3088\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u79C1\u306E\u540D\u524D\u306F\u30A8\u30F4\u30A1\u30F3\u3067\u3059\u3002\u4ECA\u65E5\u306F\u79C1\u306B\u3068\u3063\u3066\u521D\u51FA\u52E4\u306E\u65E5\u3067\u3059\u3002' },
          { role: 'student', en: 'Pleased to meet you, Evan. My name is Akihiro. This is Sandra. We are coworkers.', jp: '\u304A\u4F1A\u3044\u3067\u304D\u3066\u3046\u308C\u3057\u3044\u3067\u3059\u3001\u30A8\u30F4\u30A1\u30F3\u3055\u3093\u3002\u79C1\u306E\u540D\u524D\u306F\u660E\u5B8F\u3067\u3059\u3002\u3053\u3061\u3089\u306F\u30B5\u30F3\u30C9\u30E9\u3055\u3093\u3067\u3059\u3002\u79C1\u305F\u3061\u306F\u540C\u50DA\u3067\u3059\u3002' },
          { role: 'tutor', en: 'Pleased to meet you, too, Akihiro and Sandra.', jp: '\u660E\u5B8F\u3055\u3093\u3001\u30B5\u30F3\u30C9\u30E9\u3055\u3093\u3001\u3053\u3061\u3089\u3053\u305D\u304A\u4F1A\u3044\u3067\u304D\u3066\u3046\u308C\u3057\u3044\u3067\u3059\u3002' },
        ],
        tutorNotes: [
          { type: 'script', text: '"Let\'s read the dialogue."' },
          { type: 'script', text: '"Is it clear?"' },
          { type: 'tip', text: 'For lower-level students, first read each line and have them repeat after you. Then, roleplay.' },
          { type: 'script', text: '"Great job!"' },
        ],
      },
      {
        title: 'Step 4 \u2014 Complete the Dialogue',
        instructionEn: 'Complete the dialogue.',
        instructionJp: '\u4F1A\u8A71\u6587\u3092\u5B8C\u6210\u3055\u305B\u307E\u3057\u3087\u3046\u3002',
        content: '',
        dialogue: [
          { role: 'tutor', en: 'Hello. My name is Shirley. I\'m the new secretary.', jp: '\u3053\u3093\u306B\u3061\u306F\u3002\u79C1\u306E\u540D\u524D\u306F\u30B7\u30E3\u30FC\u30EA\u30FC\u3067\u3059\u3002\u79C1\u306F\u65B0\u3057\u3044\u79D8\u66F8\u3067\u3059\u3002' },
          { role: 'student', en: 'Pleased to meet you, Shirley. ________________. ________________. ________________.', jp: '\u30B7\u30E3\u30FC\u30EA\u30FC\u3055\u3093\u3001\u304A\u4F1A\u3044\u3067\u304D\u3066\u3046\u308C\u3057\u3044\u3067\u3059\u3002________________.' },
          { role: 'tutor', en: 'Pleased to meet you, too!', jp: '\u3053\u3061\u3089\u3053\u305D\u3001\u304A\u4F1A\u3044\u3067\u304D\u3066\u3046\u308C\u3057\u3044\u3067\u3059\u3002' },
        ],
        tutorNotes: [
          { type: 'script', text: '"Let\'s do the last practice."' },
          { type: 'instruction', text: 'Read the instruction.' },
          { type: 'tip', text: 'For lower-level students, ask them to do it step by step.' },
        ],
      },
    ],
    activityBlocks: [],
  },
  challenge: {
    scenarioEn: 'A new coworker joins your team. Using today\'s patterns and the table, introduce yourself and your coworkers. Then, say that you are coworkers.',
    scenarioJp: '\u65B0\u3057\u3044\u540C\u50DA\u304C\u3042\u306A\u305F\u306E\u30C1\u30FC\u30E0\u306B\u52A0\u308F\u308A\u307E\u3059\u3002\u3088\u304F\u4F7F\u3046\u6587\u6CD5\u8868\u73FE\u3068\u4E0B\u306E\u8868\u3092\u4F7F\u3063\u3066\u3001\u81EA\u5DF1\u7D39\u4ECB\u3068\u540C\u50DA\u306E\u7D39\u4ECB\u3092\u3057\u307E\u3057\u3087\u3046\u3002',
    guideQuestions: [
      { text: 'Hi! Nice to meet you. May I know the names of the others, as well?' },
      { text: 'Do you work with all of them?' },
      { text: 'Are we teammates?' },
      { text: 'I see. Do we often have meetings together?' },
      { text: 'What other things do we do together?' },
    ],
    roleplayTable: { you: 'Henry', coworkers: ['Margaret', 'Edison', 'Vanessa', 'Mila', 'Antonia'] },
    activityBlocks: [],
    tutorNotes: [
      { type: 'script', text: '"Are you ready for the challenge?"' },
      { type: 'instruction', text: 'Read the situation.' },
      { type: 'script', text: '"Now, I am your new coworker. I\'ll start."' },
      { type: 'instruction', text: 'Make the discussion as natural as possible.' },
      { type: 'instruction', text: 'Give feedback after finishing the challenge.' },
    ],
  },
  discussion: {
    instructionEn: 'Choose one category, then answer the questions.',
    instructionJp: '\u30AB\u30C6\u30B4\u30EA\u30FC\u3092\u4E00\u3064\u9078\u3073\u3001\u8CEA\u554F\u306B\u7B54\u3048\u307E\u3057\u3087\u3046\u3002',
    categories: [
      { title: 'YOUR BOSS', questions: ['What is the name of your boss?', 'What is his/her position in the company?', 'Is he/she a good boss? Why?'] },
      { title: 'YOUR TEAMMATE', questions: ['Can you name one of your teammates?', 'Can you describe him/her?', 'What is his/her task in the team?'] },
      { title: 'YOUR FAVORITE COWORKER', questions: ['Who is your favorite coworker?', 'What do you like about him/her?', 'What is his/her job?'] },
    ],
    activityBlocks: [],
    tutorNotes: [
      { type: 'script', text: '"Now, let\'s have a discussion."' },
      { type: 'script', text: '"Please choose a category you would like to discuss."' },
      { type: 'instruction', text: 'Ask the questions under the student\'s preferred category.' },
      { type: 'tip', text: 'If the student can\'t choose, pick a category. If there is remaining time, let the student choose another category.' },
    ],
  },
  feedback: {
    goalReviewEn: 'Can introduce yourself and your coworker.',
    goalReviewJp: '\u81EA\u5DF1\u7D39\u4ECB\u3068\u540C\u50DA\u306E\u7D39\u4ECB\u304C\u3067\u304D\u308B\u3088\u3046\u306B\u306A\u308B\u3002',
    feedbackTemplate: '*OVERALL SCORE*\nOverall: (score)\n- comment\n\n*Vocabulary/Phrases*\nVocabulary:\n- word/phrase\n- word/phrase\n\n*Grammar*\nGrammar:\nincorrect grammar = correct grammar\n\n*Pronunciation*\nPronunciation:\n- mispronounced word\n- mispronounced word',
    nextLessonLabel: 'CHAPTER 1: WORK INTRODUCTIONS',
    nextLessonName: 'Lesson 2: All About Me',
    tutorNotes: [
      { type: 'script', text: '"It\'s the end of the lesson. Great job! Now, let\'s review today\'s lesson goal."' },
      { type: 'instruction', text: 'Ask the student to read the lesson goal.' },
      { type: 'script', text: '"Were you able to achieve today\'s lesson goal?"' },
      { type: 'instruction', text: 'Fill in and send the template below via chat box.' },
      { type: 'instruction', text: 'Practice the mispronounced words with the student.' },
      { type: 'tip', text: 'Encourage the student to take the next lesson.' },
    ],
  },
};

// ============================================================================
// PAGE NAV CONFIG — matches 7-page PDF structure
// ============================================================================

const PCPP_PAGES = [
  { key: 'page1', num: '1', label: 'Introduce + Present' },
  { key: 'page2', num: '2', label: 'Understand + Vocab' },
  { key: 'page3', num: '3', label: 'Practice 1-2' },
  { key: 'page4', num: '4', label: 'Practice 3-4' },
  { key: 'page5', num: '5', label: 'Challenge' },
  { key: 'page6', num: '6', label: 'Discussion' },
  { key: 'page7', num: '7', label: 'Feedback' },
] as const;

const AUTOSAVE_DELAY_MS = 5000;

const LEVEL_BADGES: Record<number, string> = {
  3: 'BEGINNER', 4: 'HIGH BEGINNER', 5: 'HIGH BEGINNER',
  6: 'INTERMEDIATE', 7: 'INTERMEDIATE',
  8: 'HIGH INTERMEDIATE', 9: 'HIGH INTERMEDIATE',
  10: 'ADVANCED',
};

// ============================================================================
// RICH TEXT INPUT — contentEditable with Ctrl+B/I/U formatting
// ============================================================================

interface BERichTextInputProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
  style?: Record<string, any>;
}

function BERichTextInput({ value, onChange, placeholder, className = '', singleLine = true, style }: BERichTextInputProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasFocus, setHasFocus] = useState(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold', false);
      if (ref.current) onChange(ref.current.innerHTML);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic', false);
      if (ref.current) onChange(ref.current.innerHTML);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline', false);
      if (ref.current) onChange(ref.current.innerHTML);
    }
    if (singleLine && e.key === 'Enter') e.preventDefault();
  };

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  };

  useEffect(() => {
    if (ref.current && !hasFocus && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value, hasFocus]);

  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) {
      ref.current.innerHTML = value || '';
    }
  }, []);

  const showPlaceholder = !value && !hasFocus;

  return (
    <div className={`beve-rich-wrap ${className}`}>
      <div
        ref={ref}
        className={`beve-rich-input ${showPlaceholder ? 'beve-rich-placeholder' : ''}`}
        contentEditable
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        data-placeholder={placeholder}
        spellcheck={false}
        style={style}
      />
      <div className="beve-rich-hint">
        <kbd>Ctrl</kbd>+<kbd>B</kbd> bold · <kbd>Ctrl</kbd>+<kbd>I</kbd> italic · <kbd>Ctrl</kbd>+<kbd>U</kbd> underline
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BusinessEnglishVisualEditor() {
  const { params } = useRoute();
  const id = params?.id;

  const [lesson, setLesson] = useState<LessonMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnsavedChangesRef = useRef(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('beve-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('beve-theme', next); } catch {}
  };

  const [activePage, setActivePage] = useState<string>('page1');
  const [chapterName, setChapterName] = useState('');
  const [lessonName, setLessonName] = useState('');
  const [goalTextEn, setGoalTextEn] = useState('');
  const [goalTextJp, setGoalTextJp] = useState('');
  const [beData, setBeData] = useState<BELessonData>(DEFAULT_BE_DATA);

  // Refs for scroll-to navigation
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ---- Load ----
  useEffect(() => { if (id) loadLesson(id); }, [id]);

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      const data = await getLessonById(lessonId);
      setLesson(data);
      setChapterName(data.chapterName || '');
      setLessonName(data.lessonName || '');
      setGoalTextEn(data.goalTextEn || '');
      setGoalTextJp(data.goalTextJp || '');
      const skillType = (data.skill?.toUpperCase() || 'READING') as LessonType;
      const merged = { ...DEFAULT_BE_DATA, lessonType: skillType, ...(data.beData || {}) };
      setBeData(merged);
    } catch (e: any) {
      setError(e?.message || 'Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  // ---- Scroll spy — update sidebar active page on scroll ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleScroll = () => {
      const keys = PCPP_PAGES.map(p => p.key);
      for (let i = keys.length - 1; i >= 0; i--) {
        const el = pageRefs.current[keys[i]];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) { setActivePage(keys[i]); break; }
        }
      }
    };
    canvas.addEventListener('scroll', handleScroll, { passive: true });
    return () => canvas.removeEventListener('scroll', handleScroll);
  }, [loading]);

  const scrollToPage = (key: string) => {
    const el = pageRefs.current[key];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- Autosave ----
  const triggerAutosave = useCallback(() => {
    hasUnsavedChangesRef.current = true;
    setAutosaveStatus('pending');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { saveAll(); }, AUTOSAVE_DELAY_MS);
  }, []);

  const saveAll = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      await updateLessonHeader(lesson.id, {
        chapterName, lessonName, goalTextEn, goalTextJp,
        beData: beData as any,
      });
      hasUnsavedChangesRef.current = false;
      setAutosaveStatus('saved');
      setTimeout(() => setAutosaveStatus('idle'), 3000);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleManualSave = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    saveAll();
  };

  // ---- Generic updaters ----
  type BEObjectSections = { [K in keyof BELessonData]: BELessonData[K] extends object ? K : never }[keyof BELessonData];
  const updateSection = <K extends BEObjectSections>(section: K, updates: Partial<BELessonData[K]>) => {
    setBeData(prev => ({ ...prev, [section]: { ...(prev[section] as any), ...updates } }));
    triggerAutosave();
  };

  const updateTutorNotes = (section: BEObjectSections, notes: TutorNote[]) => {
    setBeData(prev => ({ ...prev, [section]: { ...(prev[section] as any), tutorNotes: notes } }));
    triggerAutosave();
  };

  const addTutorNote = (section: BEObjectSections, type: TutorNote['type'] = 'instruction') => {
    const current = (beData[section] as any).tutorNotes || [];
    updateTutorNotes(section, [...current, { type, text: '' }]);
  };

  const removeTutorNote = (section: BEObjectSections, idx: number) => {
    const current = [...(beData[section] as any).tutorNotes];
    current.splice(idx, 1);
    updateTutorNotes(section, current);
  };

  const updateTutorNoteText = (section: BEObjectSections, idx: number, text: string) => {
    const current = [...(beData[section] as any).tutorNotes];
    current[idx] = { ...current[idx], text };
    updateTutorNotes(section, current);
  };

  // ---- Loading / Error UI ----
  if (loading) return (
    <div className="beve-loading"><i className="ri-loader-4-line" /><span>Loading lesson\u2026</span></div>
  );
  if (error || !lesson) return (
    <div className="beve-error">
      <i className="ri-error-warning-line" /><span>{error || 'Lesson not found'}</span>
      <button onClick={() => window.location.href = '/business-english-editor'}>Back to Editor</button>
    </div>
  );

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const renderTutorNotes = (section: BEObjectSections) => {
    const notes: TutorNote[] = (beData[section] as any).tutorNotes || [];
    const noteIcon = { instruction: 'ri-file-list-3-line', script: 'ri-chat-quote-line', tip: 'ri-lightbulb-line' };
    return (
      <>
        <div className="beve-col-tutor-title">
          <i className="ri-booklet-line" /> Teaching Notes
        </div>
        <div className="beve-tutor-notes">
          {notes.map((note, i) => (
            <div key={i} className={`beve-tutor-note ${note.type}`}>
              <div className="beve-tutor-note-type">
                <i className={noteIcon[note.type] || 'ri-file-text-line'} /> {note.type}
              </div>
              <BERichTextInput value={note.text} onChange={(html) => updateTutorNoteText(section, i, html)} placeholder="Type note…" />
              <div className="beve-tutor-note-actions">
                <button className="beve-icon-btn danger" onClick={() => removeTutorNote(section, i)}>
                  <i className="ri-delete-bin-line" /></button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="beve-tutor-add-note" onClick={() => addTutorNote(section, 'instruction')}>
              <i className="ri-add-line" /> Instruction</button>
            <button className="beve-tutor-add-note" onClick={() => addTutorNote(section, 'script')}>
              <i className="ri-add-line" /> Script</button>
            <button className="beve-tutor-add-note" onClick={() => addTutorNote(section, 'tip')}>
              <i className="ri-add-line" /> Tip</button>
          </div>
        </div>
      </>
    );
  };

  const renderPageHeader = (pageNum: number) => (
    <div className="beve-page-header">
      {/* Row 1: Brand + Level/Page */}
      <div className="beve-header-row1">
        <div className="beve-header-brand">
          <span className="beve-header-brand-text"><span className="brand-fluent">Fluent</span><span className="brand-x">X</span><span className="brand-verse">Verse</span></span>
          <span className="beve-header-brand-sub">Business English</span>
        </div>
        <div className="beve-header-meta">
          <span className="beve-header-level">Level <strong>{lesson.level}</strong></span>
          <span className="beve-header-meta-divider">|</span>
          <span className="beve-header-page">Page <strong>{pageNum}</strong></span>
        </div>
      </div>
      {/* Row 2: Chapter + Lesson Type */}
      <div className="beve-header-row2">
        <span className="beve-header-chapter">CHAPTER {lesson.chapter}: {chapterName.toUpperCase() || 'UNTITLED'}</span>
        <div className="beve-header-row2-right">
          <select className="beve-lesson-type-select" value={beData.lessonType}
            onChange={(e) => { setBeData(prev => ({ ...prev, lessonType: (e.target as HTMLSelectElement).value as LessonType })); triggerAutosave(); }}>
            <option value="READING">READING</option>
            <option value="SPEAKING">SPEAKING</option>
            <option value="LISTENING">LISTENING</option>
            <option value="WRITING">WRITING</option>
          </select>
          <span className="beve-skill-badge">{lesson.skill.toUpperCase()}</span>
        </div>
      </div>
      {/* Row 3: Lesson name */}
      <div className="beve-header-row3">
        <span className="beve-header-lesson">Lesson {lesson.lessonNumber}: {lessonName || 'Untitled'}</span>
      </div>
    </div>
  );

  const renderHintBox = () => (
    <div className="beve-hint-box">
      <div className="beve-hint-label">Key Expressions</div>
      <div className="beve-hint-patterns">
        {beData.present.patterns.map((p, i) => (
          <div key={i} className="beve-hint-pattern">
            <span className="beve-hint-en">{p.en}</span>
            <span className="beve-hint-jp">({p.jp})</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Helper: render a practice step
  const renderPracticeStep = (si: number) => {
    const step = beData.practice.steps[si];
    if (!step) return null;
    return (
      <div key={si} className="beve-step-card">
        <div className="beve-step-header">
          <span className="step-num">{si + 1}</span>
          <BERichTextInput className="step-title-text" value={step.title}
            onChange={(html) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], title: html }; updateSection('practice', { steps }); }}
            placeholder="Step title" />
        </div>
        <div className="beve-step-body">
          <div className="beve-step-instruction">
            <BERichTextInput value={step.instructionEn}
              onChange={(html) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], instructionEn: html }; updateSection('practice', { steps }); }}
              placeholder="Instruction (English)" />
            <BERichTextInput className="beve-step-instruction-jp" value={step.instructionJp}
              onChange={(html) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], instructionJp: html }; updateSection('practice', { steps }); }}
              placeholder="指示（日本語）" />
          </div>
          <BERichTextInput value={step.content} singleLine={false}
            onChange={(html) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], content: html }; updateSection('practice', { steps }); }}
            placeholder="Step content…" style={{ minHeight: 40, fontSize: 14, lineHeight: 1.7 }} />

          {step.dialogue && step.dialogue.length > 0 && (
            <div className="beve-dialogue" style={{ marginTop: 12 }}>
              {step.dialogue.map((line, li) => (
                <div key={li} className={`beve-dialogue-line ${line.role}`}>
                  <span className="beve-dialogue-role">{line.role === 'tutor' ? 'Tutor:' : 'Student:'}</span>
                  <div style={{ flex: 1 }}>
                    <BERichTextInput className="beve-dialogue-text" value={line.en}
                      onChange={(html) => { const steps = [...beData.practice.steps]; const dlg = [...(steps[si].dialogue || [])]; dlg[li] = { ...dlg[li], en: html }; steps[si] = { ...steps[si], dialogue: dlg }; updateSection('practice', { steps }); }}
                      placeholder="English dialogue…" />
                    <BERichTextInput className="beve-dialogue-text-jp" value={line.jp}
                      onChange={(html) => { const steps = [...beData.practice.steps]; const dlg = [...(steps[si].dialogue || [])]; dlg[li] = { ...dlg[li], jp: html }; steps[si] = { ...steps[si], dialogue: dlg }; updateSection('practice', { steps }); }}
                      placeholder="日本語訳…" />
                  </div>
                </div>
              ))}
              <button className="beve-add-btn" style={{ marginTop: 6 }} onClick={() => {
                const steps = [...beData.practice.steps];
                const dlg = [...(steps[si].dialogue || []), { role: 'student' as const, en: '', jp: '' }];
                steps[si] = { ...steps[si], dialogue: dlg };
                updateSection('practice', { steps });
              }}><i className="ri-add-line" /> Add Line</button>
            </div>
          )}

          {/* Word Box */}
          {step.wordBox && step.wordBox.length > 0 && (
            <div className="beve-word-box" style={{ marginTop: 12 }}>
              <div className="beve-word-box-label"><i className="ri-price-tag-3-line" /> Word Box</div>
              <div className="beve-word-box-items">
                {step.wordBox.map((wb, wi) => (
                  <div key={wi} className="beve-word-box-item">
                    <span className="beve-editable" contentEditable
                      onBlur={(e) => { const steps = [...beData.practice.steps]; const box = [...(steps[si].wordBox || [])]; box[wi] = { ...box[wi], word: (e.target as HTMLElement).innerText }; steps[si] = { ...steps[si], wordBox: box }; updateSection('practice', { steps }); }}
                      dangerouslySetInnerHTML={{ __html: wb.word }} />
                    {wb.translation && (
                      <span className="beve-word-box-trans">({wb.translation})</span>
                    )}
                    <button className="beve-icon-btn danger" style={{ width: 16, height: 16, fontSize: 9, flexShrink: 0 }}
                      onClick={() => { const steps = [...beData.practice.steps]; const box = (steps[si].wordBox || []).filter((_, idx) => idx !== wi); steps[si] = { ...steps[si], wordBox: box }; updateSection('practice', { steps }); }}>
                      <i className="ri-close-line" /></button>
                  </div>
                ))}
              </div>
              <button className="beve-add-btn" style={{ marginTop: 6 }}
                onClick={() => { const steps = [...beData.practice.steps]; const box = [...(steps[si].wordBox || []), { word: '', translation: '' }]; steps[si] = { ...steps[si], wordBox: box }; updateSection('practice', { steps }); }}>
                <i className="ri-add-line" /> Add Word</button>
            </div>
          )}
          {!step.wordBox || step.wordBox.length === 0 ? (
            <button className="beve-add-btn" style={{ marginTop: 8, opacity: .6 }}
              onClick={() => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], wordBox: [{ word: '', translation: '' }] }; updateSection('practice', { steps }); }}>
              <i className="ri-price-tag-3-line" /> Add Word Box</button>
          ) : null}
        </div>
      </div>
    );
  };

  // Helper: render practice step tutor notes
  const renderPracticeStepNotes = (indices: number[]) => (
    <>
      <div className="beve-col-tutor-title"><i className="ri-booklet-line" /> Teaching Notes</div>
      <div className="beve-tutor-notes">
        {indices.map(si => {
          const step = beData.practice.steps[si];
          if (!step) return null;
          const noteIcon: Record<string, string> = { instruction: 'ri-file-list-3-line', script: 'ri-chat-quote-line', tip: 'ri-lightbulb-line' };
          return (
            <div key={si}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginTop: si > indices[0] ? 12 : 0, marginBottom: 6 }}>{step.title}</div>
              {step.tutorNotes.map((note, ni) => (
                <div key={ni} className={`beve-tutor-note ${note.type}`}>
                  <div className="beve-tutor-note-type"><i className={noteIcon[note.type] || 'ri-file-text-line'} /> {note.type}</div>
                  <BERichTextInput value={note.text}
                    onChange={(html) => { const steps = [...beData.practice.steps]; const notes = [...steps[si].tutorNotes]; notes[ni] = { ...notes[ni], text: html }; steps[si] = { ...steps[si], tutorNotes: notes }; updateSection('practice', { steps }); }}
                    placeholder="Type note…" />
                  <div className="beve-tutor-note-actions">
                    <button className="beve-icon-btn danger" onClick={() => { const steps = [...beData.practice.steps]; const notes = steps[si].tutorNotes.filter((_, idx) => idx !== ni); steps[si] = { ...steps[si], tutorNotes: notes }; updateSection('practice', { steps }); }}>
                      <i className="ri-delete-bin-line" /></button>
                  </div>
                </div>
              ))}
              <button className="beve-tutor-add-note" onClick={() => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], tutorNotes: [...steps[si].tutorNotes, { type: 'instruction', text: '' }] }; updateSection('practice', { steps }); }}>
                <i className="ri-add-line" /> Add Note</button>
            </div>
          );
        })}
      </div>
    </>
  );

  // ========================================================================
  // MODULAR BLOCK WRAPPER — togglable add/remove for content blocks
  // ========================================================================
  const isBlockHidden = (blockId: string) => (beData.hiddenBlocks || []).includes(blockId);

  const toggleBlock = (blockId: string, hide: boolean, btnEl?: HTMLElement | null) => {
    // Capture position of the clicked button relative to viewport
    const scrollContainer = canvasRef.current;
    let savedOffset: number | null = null;
    if (btnEl && scrollContainer) {
      savedOffset = btnEl.getBoundingClientRect().top;
    }

    const current = beData.hiddenBlocks || [];
    const updated = hide
      ? [...current, blockId]
      : current.filter(id => id !== blockId);
    setBeData(prev => ({ ...prev, hiddenBlocks: updated }));
    triggerAutosave();

    // After React re-renders, restore scroll so the element stays in place
    if (savedOffset !== null && scrollContainer) {
      requestAnimationFrame(() => {
        const el = scrollContainer.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
        if (el) {
          const newTop = el.getBoundingClientRect().top;
          scrollContainer.scrollTop += newTop - savedOffset!;
        }
      });
    }
  };

  const BlockWrapper = ({ blockId, label, icon, children }: { blockId: string; label: string; icon: string; children: any }) => {
    if (isBlockHidden(blockId)) {
      return (
        <button className="beve-block-add-btn" data-block-id={blockId}
          onClick={(e) => toggleBlock(blockId, false, e.currentTarget as HTMLElement)}>
          <i className={icon} /> Add {label}
        </button>
      );
    }
    return (
      <div className="beve-block-wrapper" data-block-id={blockId}>
        <button className="beve-block-remove-btn"
          onClick={(e) => toggleBlock(blockId, true, e.currentTarget as HTMLElement)}
          title={`Remove ${label}`}>
          <i className="ri-delete-bin-line" />
        </button>
        {children}
      </div>
    );
  };

  // ========================================================================
  // ACTIVITY BLOCKS — renderers, factory, and add-block dropdown
  // ========================================================================
  const [activityDropdownPage, setActivityDropdownPage] = useState<string | null>(null);

  const generateId = () => `ab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const createActivityBlock = (type: ActivityBlockType): ActivityBlock => {
    const id = generateId();
    const meta = ACTIVITY_BLOCK_META[type];
    switch (type) {
      case 'matching': return { type, id, title: meta.label, titleJp: meta.labelJp, pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }] };
      case 'multipleChoice': return { type, id, title: meta.label, titleJp: meta.labelJp, items: [{ question: '', questionJp: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }] }] };
      case 'sentenceReorder': return { type, id, title: meta.label, titleJp: meta.labelJp, items: [{ jumbled: '', answer: '' }] };
      case 'errorCorrection': return { type, id, title: meta.label, titleJp: meta.labelJp, items: [{ sentence: '', corrected: '', hint: '' }] };
      case 'dialogueCompletion': return { type, id, title: meta.label, titleJp: meta.labelJp, slots: [{ role: 'tutor', text: '', isBlank: false }, { role: 'student', text: '', isBlank: true }, { role: 'tutor', text: '', isBlank: false }] };
      case 'trueFalse': return { type, id, title: meta.label, titleJp: meta.labelJp, items: [{ statement: '', statementJp: '', answer: true }] };
      case 'readingPassage': return { type, id, title: meta.label, titleJp: meta.labelJp, passage: '', questions: [{ question: '', questionJp: '' }] };
      case 'categorization': return { type, id, title: meta.label, titleJp: meta.labelJp, categories: [{ name: 'Category A', items: [''] }, { name: 'Category B', items: [''] }] };
      case 'image': return { type, id, title: meta.label, titleJp: meta.labelJp, images: [] };
    }
  };

  type SectionWithBlocks = 'understand' | 'practice' | 'challenge' | 'discussion';

  const addActivityBlock = (section: SectionWithBlocks, type: ActivityBlockType) => {
    const block = createActivityBlock(type);
    setBeData(prev => {
      const sec = prev[section] as any;
      return { ...prev, [section]: { ...sec, activityBlocks: [...(sec.activityBlocks || []), block] } };
    });
    triggerAutosave();
    setActivityDropdownPage(null);
  };

  const removeActivityBlock = (section: SectionWithBlocks, blockId: string) => {
    setBeData(prev => {
      const sec = prev[section] as any;
      return { ...prev, [section]: { ...sec, activityBlocks: (sec.activityBlocks || []).filter((b: ActivityBlock) => b.id !== blockId) } };
    });
    triggerAutosave();
  };

  const updateActivityBlock = (section: SectionWithBlocks, blockId: string, updates: Partial<ActivityBlock>) => {
    setBeData(prev => {
      const sec = prev[section] as any;
      const blocks = (sec.activityBlocks || []).map((b: ActivityBlock) => b.id === blockId ? { ...b, ...updates } : b);
      return { ...prev, [section]: { ...sec, activityBlocks: blocks } };
    });
    triggerAutosave();
  };

  // ─── Individual Activity Block Renderers ───
  const renderMatchingBlock = (block: MatchingBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-matching">
      <div className="beve-activity-header">
        <i className="ri-links-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      <table className="beve-matching-table"><thead><tr><th>Left</th><th>Right</th><th style={{ width: 30 }} /></tr></thead><tbody>
        {block.pairs.map((p, i) => (
          <tr key={i}>
            <td><BERichTextInput value={p.left} onChange={(html) => { const pairs = [...block.pairs]; pairs[i] = { ...pairs[i], left: html }; updateActivityBlock(section, block.id, { pairs } as any); }} placeholder="Item" singleLine /></td>
            <td><BERichTextInput value={p.right} onChange={(html) => { const pairs = [...block.pairs]; pairs[i] = { ...pairs[i], right: html }; updateActivityBlock(section, block.id, { pairs } as any); }} placeholder="Match" singleLine /></td>
            <td><button className="beve-icon-btn danger" onClick={() => { updateActivityBlock(section, block.id, { pairs: block.pairs.filter((_, idx) => idx !== i) } as any); }}><i className="ri-delete-bin-line" /></button></td>
          </tr>
        ))}
      </tbody></table>
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { pairs: [...block.pairs, { left: '', right: '' }] } as any)}><i className="ri-add-line" /> Add Pair</button>
    </div>
  );

  const renderMultipleChoiceBlock = (block: MultipleChoiceBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-mcq">
      <div className="beve-activity-header">
        <i className="ri-checkbox-circle-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {block.items.map((item, qi) => (
        <div key={qi} className="beve-mcq-item">
          <div className="beve-mcq-question">
            <span className="beve-mcq-num">{qi + 1}.</span>
            <BERichTextInput value={item.question} onChange={(html) => { const items = [...block.items]; items[qi] = { ...items[qi], question: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Question" singleLine />
          </div>
          <div className="beve-mcq-options">
            {item.options.map((opt, oi) => (
              <div key={oi} className={`beve-mcq-option${opt.isCorrect ? ' correct' : ''}`}>
                <button className="beve-mcq-radio" onClick={() => { const items = [...block.items]; items[qi] = { ...items[qi], options: items[qi].options.map((o, idx) => ({ ...o, isCorrect: idx === oi })) }; updateActivityBlock(section, block.id, { items } as any); }}>
                  <i className={opt.isCorrect ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
                </button>
                <BERichTextInput value={opt.text} onChange={(html) => { const items = [...block.items]; const options = [...items[qi].options]; options[oi] = { ...options[oi], text: html }; items[qi] = { ...items[qi], options }; updateActivityBlock(section, block.id, { items } as any); }} placeholder={`Option ${String.fromCharCode(65 + oi)}`} singleLine />
                <button className="beve-icon-btn danger" style={{ width: 18, height: 18, fontSize: 10 }} onClick={() => { const items = [...block.items]; items[qi] = { ...items[qi], options: items[qi].options.filter((_, idx) => idx !== oi) }; updateActivityBlock(section, block.id, { items } as any); }}><i className="ri-close-line" /></button>
              </div>
            ))}
            <button className="beve-add-btn" style={{ fontSize: 11 }} onClick={() => { const items = [...block.items]; items[qi] = { ...items[qi], options: [...items[qi].options, { text: '', isCorrect: false }] }; updateActivityBlock(section, block.id, { items } as any); }}><i className="ri-add-line" /> Add Option</button>
          </div>
          <button className="beve-icon-btn danger" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => { updateActivityBlock(section, block.id, { items: block.items.filter((_, idx) => idx !== qi) } as any); }}><i className="ri-delete-bin-line" /></button>
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { items: [...block.items, { question: '', questionJp: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }] }] } as any)}><i className="ri-add-line" /> Add Question</button>
    </div>
  );

  const renderSentenceReorderBlock = (block: SentenceReorderBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-reorder">
      <div className="beve-activity-header">
        <i className="ri-sort-asc" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {block.items.map((item, i) => (
        <div key={i} className="beve-reorder-item">
          <div className="beve-reorder-row"><span className="beve-reorder-label">Jumbled:</span><BERichTextInput value={item.jumbled} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], jumbled: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="the / is / weather / today / nice" singleLine /></div>
          <div className="beve-reorder-row"><span className="beve-reorder-label">Answer:</span><BERichTextInput value={item.answer} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], answer: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="The weather is nice today" singleLine /></div>
          <button className="beve-icon-btn danger" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => { updateActivityBlock(section, block.id, { items: block.items.filter((_, idx) => idx !== i) } as any); }}><i className="ri-delete-bin-line" /></button>
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { items: [...block.items, { jumbled: '', answer: '' }] } as any)}><i className="ri-add-line" /> Add Sentence</button>
    </div>
  );

  const renderErrorCorrectionBlock = (block: ErrorCorrectionBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-error">
      <div className="beve-activity-header">
        <i className="ri-eraser-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {block.items.map((item, i) => (
        <div key={i} className="beve-error-item">
          <div className="beve-error-row"><span className="beve-error-label">\u2717</span><BERichTextInput value={item.sentence} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], sentence: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Sentence with error" singleLine /></div>
          <div className="beve-error-row"><span className="beve-error-label">\u2713</span><BERichTextInput value={item.corrected} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], corrected: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Corrected sentence" singleLine /></div>
          <div className="beve-error-row"><span className="beve-error-label">?</span><BERichTextInput value={item.hint} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], hint: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Hint (optional)" singleLine /></div>
          <button className="beve-icon-btn danger" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => { updateActivityBlock(section, block.id, { items: block.items.filter((_, idx) => idx !== i) } as any); }}><i className="ri-delete-bin-line" /></button>
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { items: [...block.items, { sentence: '', corrected: '', hint: '' }] } as any)}><i className="ri-add-line" /> Add Item</button>
    </div>
  );

  const renderDialogueCompletionBlock = (block: DialogueCompletionBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-dialogue">
      <div className="beve-activity-header">
        <i className="ri-chat-3-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {block.slots.map((slot, i) => (
        <div key={i} className={`beve-dialogue-slot ${slot.role}${slot.isBlank ? ' blank' : ''}`}>
          <div className="beve-dialogue-slot-header">
            <select className="beve-dialogue-role-select" value={slot.role} onChange={(e) => { const slots = [...block.slots]; slots[i] = { ...slots[i], role: (e.target as HTMLSelectElement).value as 'tutor' | 'student' }; updateActivityBlock(section, block.id, { slots } as any); }}>
              <option value="tutor">Tutor</option><option value="student">Student</option>
            </select>
            <button className={`beve-dialogue-blank-toggle${slot.isBlank ? ' active' : ''}`} onClick={() => { const slots = [...block.slots]; slots[i] = { ...slots[i], isBlank: !slots[i].isBlank }; updateActivityBlock(section, block.id, { slots } as any); }}><i className="ri-question-line" /> {slot.isBlank ? 'Blank' : 'Given'}</button>
            <button className="beve-icon-btn danger" style={{ width: 18, height: 18, fontSize: 10 }} onClick={() => { updateActivityBlock(section, block.id, { slots: block.slots.filter((_, idx) => idx !== i) } as any); }}><i className="ri-close-line" /></button>
          </div>
          <BERichTextInput value={slot.text} onChange={(html) => { const slots = [...block.slots]; slots[i] = { ...slots[i], text: html }; updateActivityBlock(section, block.id, { slots } as any); }} placeholder={slot.isBlank ? 'Answer (hidden from student)' : 'Dialogue line'} />
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { slots: [...block.slots, { role: 'student', text: '', isBlank: true }] } as any)}><i className="ri-add-line" /> Add Line</button>
    </div>
  );

  const renderTrueFalseBlock = (block: TrueFalseBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-tf">
      <div className="beve-activity-header">
        <i className="ri-checkbox-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      {block.items.map((item, i) => (
        <div key={i} className="beve-tf-item">
          <div className="beve-tf-statement">
            <span className="beve-tf-num">{i + 1}.</span>
            <BERichTextInput value={item.statement} onChange={(html) => { const items = [...block.items]; items[i] = { ...items[i], statement: html }; updateActivityBlock(section, block.id, { items } as any); }} placeholder="Statement" singleLine />
          </div>
          <div className="beve-tf-answer">
            <button className={`beve-tf-btn${item.answer ? ' active' : ''}`} onClick={() => { const items = [...block.items]; items[i] = { ...items[i], answer: true }; updateActivityBlock(section, block.id, { items } as any); }}>True</button>
            <button className={`beve-tf-btn${!item.answer ? ' active' : ''}`} onClick={() => { const items = [...block.items]; items[i] = { ...items[i], answer: false }; updateActivityBlock(section, block.id, { items } as any); }}>False</button>
            <button className="beve-icon-btn danger" style={{ marginLeft: 'auto' }} onClick={() => { updateActivityBlock(section, block.id, { items: block.items.filter((_, idx) => idx !== i) } as any); }}><i className="ri-delete-bin-line" /></button>
          </div>
        </div>
      ))}
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { items: [...block.items, { statement: '', statementJp: '', answer: true }] } as any)}><i className="ri-add-line" /> Add Statement</button>
    </div>
  );

  const renderReadingPassageBlock = (block: ReadingPassageBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-reading">
      <div className="beve-activity-header">
        <i className="ri-article-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      <div className="beve-reading-passage">
        <BERichTextInput value={block.passage} onChange={(html) => updateActivityBlock(section, block.id, { passage: html } as any)} placeholder="Paste or type the reading passage here (email, memo, article, etc.)" />
      </div>
      <div className="beve-reading-questions">
        {block.questions.map((q, i) => (
          <div key={i} className="beve-reading-q">
            <span className="beve-reading-q-num">{i + 1}.</span>
            <BERichTextInput value={q.question} onChange={(html) => { const questions = [...block.questions]; questions[i] = { ...questions[i], question: html }; updateActivityBlock(section, block.id, { questions } as any); }} placeholder="Comprehension question" singleLine />
            <button className="beve-icon-btn danger" style={{ width: 18, height: 18, fontSize: 10 }} onClick={() => { updateActivityBlock(section, block.id, { questions: block.questions.filter((_, idx) => idx !== i) } as any); }}><i className="ri-close-line" /></button>
          </div>
        ))}
        <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { questions: [...block.questions, { question: '', questionJp: '' }] } as any)}><i className="ri-add-line" /> Add Question</button>
      </div>
    </div>
  );

  const renderCategorizationBlock = (block: CategorizationBlock, section: SectionWithBlocks) => (
    <div className="beve-activity-block beve-activity-categorize">
      <div className="beve-activity-header">
        <i className="ri-layout-grid-line" />
        <BERichTextInput className="beve-activity-title" value={block.title}
          onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
        <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
      </div>
      <div className="beve-categorize-grid" style={{ gridTemplateColumns: `repeat(${block.categories.length}, 1fr)` }}>
        {block.categories.map((cat, ci) => (
          <div key={ci} className="beve-categorize-col">
            <div className="beve-categorize-col-header">
              <BERichTextInput value={cat.name} onChange={(html) => { const categories = [...block.categories]; categories[ci] = { ...categories[ci], name: html }; updateActivityBlock(section, block.id, { categories } as any); }} placeholder="Category" singleLine />
              <button className="beve-icon-btn danger" style={{ width: 18, height: 18, fontSize: 10 }} onClick={() => { updateActivityBlock(section, block.id, { categories: block.categories.filter((_, idx) => idx !== ci) } as any); }}><i className="ri-close-line" /></button>
            </div>
            {cat.items.map((item, ii) => (
              <div key={ii} className="beve-categorize-item">
                <BERichTextInput value={item} onChange={(html) => { const categories = [...block.categories]; const items = [...categories[ci].items]; items[ii] = html; categories[ci] = { ...categories[ci], items }; updateActivityBlock(section, block.id, { categories } as any); }} placeholder="Item" singleLine />
                <button className="beve-icon-btn danger" style={{ width: 16, height: 16, fontSize: 9 }} onClick={() => { const categories = [...block.categories]; categories[ci] = { ...categories[ci], items: categories[ci].items.filter((_, idx) => idx !== ii) }; updateActivityBlock(section, block.id, { categories } as any); }}><i className="ri-close-line" /></button>
              </div>
            ))}
            <button className="beve-add-btn" style={{ fontSize: 11 }} onClick={() => { const categories = [...block.categories]; categories[ci] = { ...categories[ci], items: [...categories[ci].items, ''] }; updateActivityBlock(section, block.id, { categories } as any); }}><i className="ri-add-line" /> Add Item</button>
          </div>
        ))}
      </div>
      <button className="beve-add-btn" onClick={() => updateActivityBlock(section, block.id, { categories: [...block.categories, { name: '', items: [''] }] } as any)}><i className="ri-add-line" /> Add Category</button>
    </div>
  );

  const handleImageUpload = (section: SectionWithBlocks, blockId: string, existingImages: ImageItem[]) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        if (existingImages.length >= 4) return; // max 4
        updateActivityBlock(section, blockId, { images: [...existingImages, { src, label: '' }] } as any);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const renderImageBlock = (block: ImageBlock, section: SectionWithBlocks) => {
    const count = block.images.length;
    const layoutClass = count === 1 ? 'single' : count === 2 ? 'double' : count === 3 ? 'triple' : 'quad';
    return (
      <div className="beve-activity-block beve-activity-image">
        <div className="beve-activity-header">
          <i className="ri-image-line" />
          <BERichTextInput className="beve-activity-title" value={block.title}
            onChange={(html) => updateActivityBlock(section, block.id, { title: html } as any)} placeholder="Title" singleLine />
          <button className="beve-icon-btn danger" onClick={() => removeActivityBlock(section, block.id)}><i className="ri-delete-bin-line" /></button>
        </div>
        {count > 0 ? (
          <div className={`beve-img-grid beve-img-${layoutClass}`}>
            {block.images.map((img, i) => (
              <div key={i} className="beve-img-cell">
                <div className="beve-img-square">
                  <img src={img.src} alt={img.label || `Image ${i + 1}`} />
                  <button className="beve-img-remove" onClick={() => {
                    updateActivityBlock(section, block.id, { images: block.images.filter((_, idx) => idx !== i) } as any);
                  }}><i className="ri-close-circle-fill" /></button>
                </div>
                <BERichTextInput className="beve-img-label" value={img.label}
                  onChange={(html) => { const images = [...block.images]; images[i] = { ...images[i], label: html }; updateActivityBlock(section, block.id, { images } as any); }}
                  placeholder="Label (optional)" singleLine />
              </div>
            ))}
          </div>
        ) : null}
        {count < 4 && (
          <button className="beve-add-btn beve-img-add-btn" onClick={() => handleImageUpload(section, block.id, block.images)}>
            <i className="ri-image-add-line" /> Add Image {count > 0 ? `(${count}/4)` : ''}
          </button>
        )}
      </div>
    );
  };

  // ─── Dispatcher ───
  const renderActivityBlock = (block: ActivityBlock, section: SectionWithBlocks) => {
    switch (block.type) {
      case 'matching': return renderMatchingBlock(block, section);
      case 'multipleChoice': return renderMultipleChoiceBlock(block, section);
      case 'sentenceReorder': return renderSentenceReorderBlock(block, section);
      case 'errorCorrection': return renderErrorCorrectionBlock(block, section);
      case 'dialogueCompletion': return renderDialogueCompletionBlock(block, section);
      case 'trueFalse': return renderTrueFalseBlock(block, section);
      case 'readingPassage': return renderReadingPassageBlock(block, section);
      case 'categorization': return renderCategorizationBlock(block, section);
      case 'image': return renderImageBlock(block, section);
    }
  };

  // ─── Render all activity blocks for a section + add dropdown ───
  const renderActivityBlocksArea = (section: SectionWithBlocks) => {
    const blocks = (beData[section] as any).activityBlocks || [];
    const dropdownId = `add-${section}`;
    return (
      <div className="beve-activity-blocks-area">
        {blocks.map((block: ActivityBlock) => (
          <div key={block.id}>{renderActivityBlock(block, section)}</div>
        ))}
        <div className="beve-add-activity-wrap">
          <button className="beve-add-activity-btn" onClick={() => setActivityDropdownPage(activityDropdownPage === dropdownId ? null : dropdownId)}>
            <i className="ri-add-circle-line" /> Add Activity Block
          </button>
          {activityDropdownPage === dropdownId && (
            <div className="beve-add-activity-dropdown">
              {(Object.keys(ACTIVITY_BLOCK_META) as ActivityBlockType[]).map(type => {
                const meta = ACTIVITY_BLOCK_META[type];
                return (
                  <button key={type} className="beve-add-activity-option" onClick={() => addActivityBlock(section, type)}>
                    <i className={meta.icon} /> {meta.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ========================================================================
  // SECTION BANNER — chevron step indicator (inspired by PCPP nav design)
  // ========================================================================
  const SECTION_STEPS = [
    { num: 1, short: 'Warm-Up' },
    { num: 2, short: 'Key Expr.' },
    { num: 3, short: 'Compreh.' },
    { num: 4, short: 'Drill' },
    { num: 5, short: 'Simul.' },
    { num: 6, short: 'Wrap-Up' },
  ];

  const renderSectionBanner = (activeNum: number, title: string) => (
    <div className="beve-section-banner">
      <div className="beve-section-banner-left">
        <span className="beve-section-banner-title">{title}</span>
      </div>
      <div className="beve-chevron-bar">
        {SECTION_STEPS.map((step, i) => (
          <div
            key={step.num}
            className={`beve-chevron${step.num === activeNum ? ' active' : ''}${step.num < activeNum ? ' completed' : ''}`}
          >
            {i > 0 && <span className="beve-chevron-connector" />}
            <span className="beve-chevron-num">{step.num}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ========================================================================
  // PAGE FOOTER — shown on every page
  // ========================================================================

  const renderPageFooter = () => (
    <div className="beve-page-footer">
      <div className="beve-footer-glow" />
      <div className="beve-footer-content">
        <div className="beve-footer-left">
          <span className="beve-page-footer-brand"><span className="brand-fluent">Fluent</span><span className="brand-x">X</span><span className="brand-verse">Verse</span></span>
          <span className="beve-footer-divider">/</span>
          <span className="beve-footer-course">Business English</span>
        </div>
        <div className="beve-footer-center" />
        <div className="beve-footer-right">
          <span className="beve-footer-copy">&copy; {new Date().getFullYear()} FluentXVerse</span>
        </div>
      </div>
    </div>
  );

  // ========================================================================
  // 7 PAGE RENDERERS — matching PDF structure
  // ========================================================================

  /** PAGE 1: ① Introduce (Goal + Situation) + ② Present (Key Expressions) */
  const renderPage1 = () => (
    <div className="beve-page" id="beve-page1" ref={(el) => { pageRefs.current['page1'] = el; }}>
      {renderPageHeader(1)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {/* ① Introduce */}
          {renderSectionBanner(1, 'WARM-UP')}
          <div className="beve-goal-box">
            <div className="beve-goal-label">Lesson Goal</div>
            <BERichTextInput className="beve-goal-en" value={beData.introduce.goalEn}
              onChange={(html) => updateSection('introduce', { goalEn: html })} placeholder="Goal (English)" />
            <BERichTextInput className="beve-goal-jp" value={beData.introduce.goalJp}
              onChange={(html) => updateSection('introduce', { goalJp: html })} placeholder="目標（日本語）" />
          </div>
          <div className="beve-situation-box">
            <div className="beve-situation-label"><i className="ri-briefcase-line" /> Situation and Task</div>
            <BERichTextInput className="beve-situation-en" value={beData.introduce.situationEn} singleLine={false}
              onChange={(html) => updateSection('introduce', { situationEn: html })} placeholder="Situation (English)" />
            <BERichTextInput className="beve-situation-jp" value={beData.introduce.situationJp} singleLine={false}
              onChange={(html) => updateSection('introduce', { situationJp: html })} placeholder="状況（日本語）" />
          </div>

          {/* ② Present — Key Expressions */}
          {renderSectionBanner(2, 'KEY EXPRESSIONS')}
          <div className="beve-sub-heading">Key Expressions <span className="jp-label">{'よく使うフレーズ'}</span></div>
          <div className="beve-patterns-grid">
            {beData.present.patterns.map((p, i) => (
              <div key={i} className="beve-pattern-card">
              <BERichTextInput className="beve-pattern-en" value={p.en}
                  onChange={(html) => { const updated = [...beData.present.patterns]; updated[i] = { ...updated[i], en: html }; updateSection('present', { patterns: updated }); }}
                  placeholder="Pattern (English)" />
                <BERichTextInput className="beve-pattern-jp" value={p.jp}
                  onChange={(html) => { const updated = [...beData.present.patterns]; updated[i] = { ...updated[i], jp: html }; updateSection('present', { patterns: updated }); }}
                  placeholder="パターン（日本語）" />
                <div className="beve-pattern-actions">
                  <button className="beve-icon-btn danger" onClick={() => { updateSection('present', { patterns: beData.present.patterns.filter((_, idx) => idx !== i) }); }}>
                    <i className="ri-delete-bin-line" /></button>
                </div>
              </div>
            ))}
            <button className="beve-add-btn" onClick={() => { updateSection('present', { patterns: [...beData.present.patterns, { en: '', jp: '' }] }); }}>
              <i className="ri-add-line" /> Add Pattern</button>
          </div>
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('introduce')}
          <div style={{ marginTop: 20 }}>{renderTutorNotes('present')}</div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 2: ③ Understand (Table) + Useful Vocabulary + Pronunciation */
  const renderPage2 = () => (
    <div className="beve-page" id="beve-page2" ref={(el) => { pageRefs.current['page2'] = el; }}>
      {renderPageHeader(2)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {/* ③ Understand */}
          {renderSectionBanner(3, 'COMPREHENSION')}
          <BlockWrapper blockId="comprehensionIntro" label="Comprehension Intro" icon="ri-question-line">
          <div className="beve-situation-box">
            <BERichTextInput className="beve-situation-en" value={beData.understand.instruction} singleLine={false}
              onChange={(html) => updateSection('understand', { instruction: html })} placeholder="Comprehension instruction (English)" />
            <BERichTextInput className="beve-situation-jp" value={beData.understand.instructionJp} singleLine={false}
              onChange={(html) => updateSection('understand', { instructionJp: html })} placeholder="指示（日本語）" />
          </div>
          </BlockWrapper>

          <BlockWrapper blockId="comprehensionPatterns" label="Key Expression Cards" icon="ri-file-list-3-line">
          <div className="beve-patterns-grid">
            {beData.present.patterns.map((p, i) => (
              <div key={i} className="beve-pattern-card">
                <span className="beve-pattern-en">{p.en}</span>
                <span className="beve-pattern-jp">{p.jp}</span>
              </div>
            ))}
          </div>
          </BlockWrapper>

          {/* Pattern Drill Tables */}
          <BlockWrapper blockId="patternDrills" label="Pattern Drills" icon="ri-table-line">
          {beData.understand.patternDrills.length > 0 && (
            <div className="beve-pattern-drills">
              {beData.understand.patternDrills.map((drill, di) => (
                <div key={di} className="beve-drill-card">
                  <div className="beve-drill-header">
                    <BERichTextInput className="beve-drill-label" value={drill.label}
                      onChange={(html) => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], label: html }; updateSection('understand', { patternDrills: drills }); }}
                      placeholder="Pattern usage description" singleLine />
                    <BERichTextInput className="beve-drill-label-jp" value={drill.labelJp}
                      onChange={(html) => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], labelJp: html }; updateSection('understand', { patternDrills: drills }); }}
                      placeholder="説明（日本語）" singleLine />
                    <button className="beve-icon-btn danger" style={{ position: 'absolute', top: 6, right: 6 }}
                      onClick={() => { updateSection('understand', { patternDrills: beData.understand.patternDrills.filter((_, idx) => idx !== di) }); }}>
                      <i className="ri-delete-bin-line" /></button>
                  </div>
                  <div className="beve-drill-template">
                    <BERichTextInput value={drill.template}
                      onChange={(html) => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], template: html }; updateSection('understand', { patternDrills: drills }); }}
                      placeholder="Pattern template (e.g. Welcome to the _____)" singleLine />
                  </div>
                  <table className="beve-drill-table">
                    <tbody>
                      {drill.examples.map((ex, ei) => (
                        <tr key={ei}>
                          <td><BERichTextInput value={ex.en}
                            onChange={(html) => { const drills = [...beData.understand.patternDrills]; const examples = [...drills[di].examples]; examples[ei] = { ...examples[ei], en: html }; drills[di] = { ...drills[di], examples }; updateSection('understand', { patternDrills: drills }); }}
                            placeholder="Example (English)" singleLine /></td>
                          <td><BERichTextInput value={ex.jp}
                            onChange={(html) => { const drills = [...beData.understand.patternDrills]; const examples = [...drills[di].examples]; examples[ei] = { ...examples[ei], jp: html }; drills[di] = { ...drills[di], examples }; updateSection('understand', { patternDrills: drills }); }}
                            placeholder="例文（日本語）" singleLine /></td>
                          <td style={{ width: 30 }}><button className="beve-icon-btn danger"
                            onClick={() => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], examples: drills[di].examples.filter((_, idx) => idx !== ei) }; updateSection('understand', { patternDrills: drills }); }}>
                            <i className="ri-delete-bin-line" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="beve-add-btn" style={{ marginTop: 6 }}
                    onClick={() => { const drills = [...beData.understand.patternDrills]; drills[di] = { ...drills[di], examples: [...drills[di].examples, { en: '', jp: '' }] }; updateSection('understand', { patternDrills: drills }); }}>
                    <i className="ri-add-line" /> Add Example</button>
                </div>
              ))}
            </div>
          )}
          <button className="beve-add-btn" style={{ marginBottom: 8 }}
            onClick={() => { updateSection('understand', { patternDrills: [...beData.understand.patternDrills, { label: '', labelJp: '', template: '', examples: [{ en: '', jp: '' }] }] }); }}>
            <i className="ri-add-line" /> Add Pattern Drill</button>
          </BlockWrapper>

          {/* Fill-in-the-blank Exercise */}
          <BlockWrapper blockId="fillBlanks" label="Fill in the Blanks" icon="ri-edit-box-line">
          <div className="beve-sub-heading" style={{ marginTop: 0 }}>
            <i className="ri-edit-box-line" /> Fill in the Blanks <span className="jp-label">{'\u7A74\u57CB\u3081'}</span>
          </div>
          {beData.understand.fillRows.length > 0 ? (
            <table className="beve-fill-table">
              <tbody>
                {beData.understand.fillRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.parts.map((part, pi) => (
                      <td key={pi} className={part.isBlank ? 'blank' : ''}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="beve-editable" contentEditable
                            onBlur={(e) => {
                              const rows = [...beData.understand.fillRows];
                              const parts = [...rows[ri].parts];
                              parts[pi] = { ...parts[pi], text: (e.target as HTMLElement).innerText };
                              rows[ri] = { ...rows[ri], parts };
                              updateSection('understand', { fillRows: rows });
                            }}
                            dangerouslySetInnerHTML={{ __html: part.isBlank ? (part.text || '________') : part.text }} />
                          <button className="beve-icon-btn" title={part.isBlank ? 'Make text' : 'Make blank'}
                            onClick={() => {
                              const rows = [...beData.understand.fillRows];
                              const parts = [...rows[ri].parts];
                              parts[pi] = { ...parts[pi], isBlank: !parts[pi].isBlank };
                              rows[ri] = { ...rows[ri], parts };
                              updateSection('understand', { fillRows: rows });
                            }}
                            style={{ flexShrink: 0, width: 20, height: 20, fontSize: 11 }}>
                            <i className={part.isBlank ? 'ri-text' : 'ri-space'} />
                          </button>
                        </div>
                      </td>
                    ))}
                    <td style={{ width: 70 }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="beve-icon-btn" title="Add cell"
                          onClick={() => {
                            const rows = [...beData.understand.fillRows];
                            rows[ri] = { ...rows[ri], parts: [...rows[ri].parts, { text: '', isBlank: false }] };
                            updateSection('understand', { fillRows: rows });
                          }}><i className="ri-add-line" /></button>
                        <button className="beve-icon-btn danger" title="Remove row"
                          onClick={() => {
                            updateSection('understand', { fillRows: beData.understand.fillRows.filter((_, idx) => idx !== ri) });
                          }}><i className="ri-delete-bin-line" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 13, color: '#71717a', padding: '12px 0', fontStyle: 'italic' }}>
              No fill-in-the-blank rows yet. Add rows below or use the AI generator.
            </div>
          )}
          <button className="beve-add-btn" style={{ marginBottom: 20 }} onClick={() => {
            updateSection('understand', {
              fillRows: [...beData.understand.fillRows, { parts: [
                { text: '', isBlank: false }, { text: '', isBlank: true }, { text: '', isBlank: false }
              ] }]
            });
          }}>
            <i className="ri-add-line" /> Add Fill Row
          </button>
          </BlockWrapper>

          {/* Useful Vocabulary */}
          <BlockWrapper blockId="vocabulary" label="Word Bank" icon="ri-book-2-line">
          <div className="beve-sub-heading" style={{ marginTop: 0 }}>Word Bank <span className="jp-label">{'単語集'}</span></div>
          <table className="beve-vocab-table">
            <thead><tr><th>Word</th><th>Part of Speech</th><th>Translation</th><th>Definition</th><th style={{ width: 40 }} /></tr></thead>
            <tbody>
              {beData.present.vocabulary.map((v, i) => (
                <tr key={i}>
                  <td><BERichTextInput className="beve-vocab-word" value={v.word}
                    onChange={(html) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], word: html }; updateSection('present', { vocabulary: u }); }}
                    placeholder="Word" /></td>
                  <td><BERichTextInput className="beve-vocab-pos" value={v.pos}
                    onChange={(html) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], pos: html }; updateSection('present', { vocabulary: u }); }}
                    placeholder="POS" /></td>
                  <td><BERichTextInput className="beve-vocab-translation" value={v.translation}
                    onChange={(html) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], translation: html }; updateSection('present', { vocabulary: u }); }}
                    placeholder="翻訳" /></td>
                  <td><BERichTextInput value={v.definition || ''}
                    onChange={(html) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], definition: html }; updateSection('present', { vocabulary: u }); }}
                    placeholder="Definition" /></td>
                  <td><button className="beve-icon-btn danger" onClick={() => { updateSection('present', { vocabulary: beData.present.vocabulary.filter((_, idx) => idx !== i) }); }}>
                    <i className="ri-delete-bin-line" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="beve-add-btn" onClick={() => { updateSection('present', { vocabulary: [...beData.present.vocabulary, { word: '', pos: '', translation: '', definition: '' }] }); }}>
            <i className="ri-add-line" /> Add Vocabulary</button>
          </BlockWrapper>

          {/* Pronunciation */}
          <BlockWrapper blockId="soundPractice" label="Sound Practice" icon="ri-volume-up-line">
          <div className="beve-sub-heading" style={{ marginTop: 0 }}>Sound Practice <span className="jp-label">{beData.present.pronunciation.instructionJp}</span></div>
          <div className="beve-pronun-box">
            <BERichTextInput className="beve-pronun-title" value={beData.present.pronunciation.instruction}
              onChange={(html) => { updateSection('present', { pronunciation: { ...beData.present.pronunciation, instruction: html } }); }}
              placeholder="Pronunciation instruction" />
            <div className="beve-pronun-columns">
              {(['left', 'right'] as const).map(side => {
                const col = beData.present.pronunciation[side];
                return (
                  <div key={side} className="beve-pronun-col">
                    <div className="beve-pronun-symbol beve-editable" contentEditable
                      onBlur={(e) => { updateSection('present', { pronunciation: { ...beData.present.pronunciation, [side]: { ...col, symbol: (e.target as HTMLElement).innerText } } }); }}
                      dangerouslySetInnerHTML={{ __html: col.symbol }} />
                    <div className="beve-pronun-words">
                      {col.words.map((w, i) => (
                        <div key={i} className="beve-pronun-word">
                          <span className="beve-editable" contentEditable
                            onBlur={(e) => { const words = [...col.words]; words[i] = { ...words[i], en: (e.target as HTMLElement).innerText }; updateSection('present', { pronunciation: { ...beData.present.pronunciation, [side]: { ...col, words } } }); }}
                            dangerouslySetInnerHTML={{ __html: w.en }} />
                          <span style={{ color: '#71717a', fontSize: 12 }}>
                            <span className="beve-editable" contentEditable
                              onBlur={(e) => { const words = [...col.words]; words[i] = { ...words[i], jp: (e.target as HTMLElement).innerText }; updateSection('present', { pronunciation: { ...beData.present.pronunciation, [side]: { ...col, words } } }); }}
                              dangerouslySetInnerHTML={{ __html: w.jp }} />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </BlockWrapper>
          {renderActivityBlocksArea('understand')}
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('understand')}
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  // Compute which step indices go on Page 3 vs Page 4
  const totalSteps = beData.practice.steps.length;
  const page3StepIndices = Array.from({ length: Math.ceil(totalSteps / 2) }, (_, i) => i);
  const page4StepIndices = Array.from({ length: totalSteps - page3StepIndices.length }, (_, i) => i + page3StepIndices.length);

  /** PAGE 3: ④ Practice Steps (first half) */
  const renderPage3 = () => (
    <div className="beve-page" id="beve-page3" ref={(el) => { pageRefs.current['page3'] = el; }}>
      {renderPageHeader(3)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(4, 'DRILL')}
          {page3StepIndices.map(i => renderPracticeStep(i))}
          {renderHintBox()}
          {renderActivityBlocksArea('practice')}
        </div>
        <div className="beve-col-tutor">
          {renderPracticeStepNotes(page3StepIndices)}
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 4: ④ Practice Steps (second half) */
  const renderPage4 = () => (
    <div className="beve-page" id="beve-page4" ref={(el) => { pageRefs.current['page4'] = el; }}>
      {renderPageHeader(4)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(4, 'DRILL (CONT.)')}
          {page4StepIndices.length > 0 ? (
            page4StepIndices.map(i => renderPracticeStep(i))
          ) : (
            <div style={{ fontSize: 13, color: '#71717a', padding: '16px 0', fontStyle: 'italic' }}>
              <i className="ri-information-line" style={{ marginRight: 6 }} />
              All practice steps fit on the previous page. Add more steps to populate this page.
            </div>
          )}
          <button className="beve-add-btn" style={{ marginTop: 12 }} onClick={() => {
            const newStep = {
              title: `Step ${totalSteps + 1}`,
              instructionEn: '', instructionJp: '',
              content: '', tutorNotes: [],
            };
            setBeData(prev => ({
              ...prev,
              practice: { ...prev.practice, steps: [...prev.practice.steps, newStep] },
            }));
            triggerAutosave();
          }}>
            <i className="ri-add-line" /> Add Practice Step
          </button>
          {renderHintBox()}
          {renderActivityBlocksArea('practice')}
        </div>
        <div className="beve-col-tutor">
          {page4StepIndices.length > 0 ? renderPracticeStepNotes(page4StepIndices) : (
            <div className="beve-col-tutor-title"><i className="ri-booklet-line" /> Teaching Notes</div>
          )}
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 5: ⑤ Challenge (Simulation) */
  const renderPage5 = () => (
    <div className="beve-page" id="beve-page5" ref={(el) => { pageRefs.current['page5'] = el; }}>
      {renderPageHeader(5)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(5, 'SIMULATION')}
          <div className="beve-challenge-box">
            <div className="beve-challenge-title"><i className="ri-sword-line" /> Simulation</div>
            <BERichTextInput className="beve-challenge-scenario" value={beData.challenge.scenarioEn}
              onChange={(html) => updateSection('challenge', { scenarioEn: html })} placeholder="Simulation scenario (English)" />
            <BERichTextInput className="beve-challenge-scenario-jp" value={beData.challenge.scenarioJp}
              onChange={(html) => updateSection('challenge', { scenarioJp: html })} placeholder="シミュレーションシナリオ（日本語）" />
          </div>

          {beData.challenge.roleplayTable && (
            <BlockWrapper blockId="roleplayTable" label="Roleplay Table" icon="ri-group-line">
            <div className="beve-situation-box">
              <div className="beve-situation-label">Roleplay Assignments</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>YOU</div>
                  <BERichTextInput value={beData.challenge.roleplayTable.you}
                    onChange={(html) => updateSection('challenge', { roleplayTable: { ...beData.challenge.roleplayTable!, you: html } })}
                    placeholder="Your role" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>YOUR COWORKERS</div>
                  {beData.challenge.roleplayTable.coworkers.map((name, i) => (
                    <div key={i} className="beve-editable" contentEditable style={{ fontSize: 14 }}
                      onBlur={(e) => { const coworkers = [...beData.challenge.roleplayTable!.coworkers]; coworkers[i] = (e.target as HTMLElement).innerText; updateSection('challenge', { roleplayTable: { ...beData.challenge.roleplayTable!, coworkers } }); }}
                      dangerouslySetInnerHTML={{ __html: name }} />
                  ))}
                  <button className="beve-add-btn" style={{ marginTop: 6 }} onClick={() => { updateSection('challenge', { roleplayTable: { ...beData.challenge.roleplayTable!, coworkers: [...beData.challenge.roleplayTable!.coworkers, ''] } }); }}>
                    <i className="ri-add-line" /> Add Name</button>
                </div>
              </div>
            </div>
            </BlockWrapper>
          )}
          {renderHintBox()}
          {renderActivityBlocksArea('challenge')}
        </div>
        <div className="beve-col-tutor">
          <div className="beve-col-tutor-title"><i className="ri-booklet-line" /> Teaching Notes</div>
          <div className="beve-tutor-notes">
            {beData.challenge.tutorNotes.map((note, i) => (
              <div key={i} className={`beve-tutor-note ${note.type}`}>
                <div className="beve-tutor-note-type"><i className={({'instruction':'ri-file-list-3-line','script':'ri-chat-quote-line','tip':'ri-lightbulb-line'})[note.type] || 'ri-file-text-line'} /> {note.type}</div>
                <BERichTextInput value={note.text}
                  onChange={(html) => updateTutorNoteText('challenge', i, html)}
                  placeholder="Note text" />
                <div className="beve-tutor-note-actions">
                  <button className="beve-icon-btn danger" onClick={() => removeTutorNote('challenge', i)}>
                    <i className="ri-delete-bin-line" /></button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button className="beve-tutor-add-note" onClick={() => addTutorNote('challenge', 'instruction')}><i className="ri-add-line" /> Instruction</button>
              <button className="beve-tutor-add-note" onClick={() => addTutorNote('challenge', 'script')}><i className="ri-add-line" /> Script</button>
            </div>
            <div className="beve-sub-heading" style={{ borderBottom: 'none', marginBottom: 6, marginTop: 16 }}>Prompt Questions</div>
            <div className="beve-guide-questions">
              {beData.challenge.guideQuestions.map((q, i) => (
                <div key={i} className="beve-guide-q">
                  <span style={{ fontWeight: 700, color: '#7c3aed', marginRight: 6 }}>{i + 1}.</span>
                  <BERichTextInput value={q.text}
                    onChange={(html) => { const gq = [...beData.challenge.guideQuestions]; gq[i] = { text: html }; updateSection('challenge', { guideQuestions: gq }); }}
                    placeholder="Guide question" />
                </div>
              ))}
              <button className="beve-tutor-add-note" onClick={() => { updateSection('challenge', { guideQuestions: [...beData.challenge.guideQuestions, { text: '' }] }); }}>
                <i className="ri-add-line" /> Add Question</button>
            </div>
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 6: ⑤ Challenge — Discussion Questions */
  const renderPage6 = () => (
    <div className="beve-page" id="beve-page6" ref={(el) => { pageRefs.current['page6'] = el; }}>
      {renderPageHeader(6)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(5, 'SIMULATION \u2014 OPEN TALK')}
          <div className="beve-situation-box">
            <BERichTextInput className="beve-situation-en" value={beData.discussion.instructionEn}
              onChange={(html) => updateSection('discussion', { instructionEn: html })} placeholder="Discussion instruction (English)" />
            <BERichTextInput className="beve-situation-jp" value={beData.discussion.instructionJp}
              onChange={(html) => updateSection('discussion', { instructionJp: html })} placeholder="ディスカッション指示（日本語）" />
          </div>
          <div className="beve-discussion-categories">
            {beData.discussion.categories.map((cat, ci) => (
              <div key={ci} className="beve-disc-cat">
                <BERichTextInput className="beve-disc-cat-title" value={cat.title}
                  onChange={(html) => { const cats = [...beData.discussion.categories]; cats[ci] = { ...cats[ci], title: html }; updateSection('discussion', { categories: cats }); }}
                  placeholder="Category title" singleLine />
                <div className="beve-disc-questions">
                  {cat.questions.map((q, qi) => (
                    <div key={qi} className="beve-disc-q" data-num={`${qi + 1}.`}>
                      <BERichTextInput value={q}
                        onChange={(html) => { const cats = [...beData.discussion.categories]; const qs = [...cats[ci].questions]; qs[qi] = html; cats[ci] = { ...cats[ci], questions: qs }; updateSection('discussion', { categories: cats }); }}
                        placeholder="Discussion question" />
                    </div>
                  ))}
                  <button className="beve-tutor-add-note" onClick={() => { const cats = [...beData.discussion.categories]; cats[ci] = { ...cats[ci], questions: [...cats[ci].questions, ''] }; updateSection('discussion', { categories: cats }); }}>
                    <i className="ri-add-line" /> Add Q</button>
                </div>
              </div>
            ))}
          </div>
          <button className="beve-add-btn" onClick={() => { updateSection('discussion', { categories: [...beData.discussion.categories, { title: 'NEW CATEGORY', questions: [''] }] }); }}>
            <i className="ri-add-line" /> Add Category</button>
          {renderActivityBlocksArea('discussion')}
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('discussion')}
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  /** PAGE 7: ⑥ Feedback */
  const renderPage7 = () => (
    <div className="beve-page" id="beve-page7" ref={(el) => { pageRefs.current['page7'] = el; }}>
      {renderPageHeader(7)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(6, 'WRAP-UP')}

          {/* Lesson Goal — read-only mirror from Page 1 introduce section */}
          <div className="beve-goal-box beve-readonly-ref">
            <div className="beve-goal-label"><i className="ri-bookmark-line" style={{ marginRight: 4 }} /> Lesson Goal</div>
            <div className="beve-goal-en" dangerouslySetInnerHTML={{ __html: beData.introduce.goalEn || '<em style="color:#71717a">Goal not set — edit on Page 1</em>' }} />
            <div className="beve-goal-jp" dangerouslySetInnerHTML={{ __html: beData.introduce.goalJp || '<em style="color:#71717a">ゴール未設定</em>' }} />
          </div>

          {/* Key Expressions — read-only mirror from Page 1 present.patterns */}
          <div className="beve-readonly-ref beve-key-expr-ref">
            <div className="beve-goal-label"><i className="ri-key-2-line" style={{ marginRight: 4 }} /> Key Expressions</div>
            {beData.present.patterns.length > 0 ? beData.present.patterns.map((p, i) => (
              <div key={i} className="beve-key-expr-row">
                <span className="beve-key-expr-num">{i + 1}.</span>
                <div>
                  <div className="beve-key-expr-en" dangerouslySetInnerHTML={{ __html: p.en || '' }} />
                  <div className="beve-key-expr-jp" dangerouslySetInnerHTML={{ __html: p.jp || '' }} />
                </div>
              </div>
            )) : (
              <div style={{ fontSize: 13, color: '#71717a', fontStyle: 'italic', padding: '8px 0' }}>
                <i className="ri-information-line" style={{ marginRight: 4 }} />
                No key expressions yet — add patterns on Page 1
              </div>
            )}
          </div>

          <BlockWrapper blockId="feedbackTemplate" label="Tutor's Review" icon="ri-chat-check-line">
          <div className="beve-sub-heading" style={{ marginTop: 0 }}><i className="ri-chat-check-line" /> Tutor's Review</div>
          <div className="beve-feedback-template">
            <BERichTextInput value={beData.feedback.feedbackTemplate}
              onChange={(html) => updateSection('feedback', { feedbackTemplate: html })}
              placeholder="Feedback template" style={{ fontFamily: "'Courier New', monospace", whiteSpace: 'pre-wrap' }} />
          </div>
          </BlockWrapper>
          <BlockWrapper blockId="nextLesson" label="Next Lesson" icon="ri-arrow-right-circle-line">
          <div className="beve-next-lesson">
            <i className="ri-arrow-right-circle-line" />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 2 }}>Next Lesson</div>
              <div>
                <span className="beve-editable" contentEditable
                  onBlur={(e) => updateSection('feedback', { nextLessonLabel: (e.target as HTMLElement).innerText })}
                  dangerouslySetInnerHTML={{ __html: beData.feedback.nextLessonLabel }} />
                {' \u2014 '}
                <strong><span className="beve-editable" contentEditable
                  onBlur={(e) => updateSection('feedback', { nextLessonName: (e.target as HTMLElement).innerText })}
                  dangerouslySetInnerHTML={{ __html: beData.feedback.nextLessonName }} /></strong>
              </div>
            </div>
          </div>
          </BlockWrapper>
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('feedback')}
        </div>
      </div>
      {renderPageFooter()}
    </div>
  );

  // ========================================================================
  // MAIN RENDER — all 7 pages as scrollable document
  // ========================================================================

  return (
    <div className={`beve ${theme}`}>
      {/* AI Content Generator Widget */}
      <BEAIContentGenerator
        level={lesson.level}
        chapter={lesson.chapter}
        lessonNumber={lesson.lessonNumber}
        lessonName={lessonName}
        goalTextEn={goalTextEn}
        goalTextJp={goalTextJp}
        chapterName={chapterName}
        currentPresentData={{
          patterns: beData.present.patterns,
          vocabulary: beData.present.vocabulary.map(v => ({ word: v.word, pos: v.pos, translation: v.translation })),
        }}
        sectionStatus={{
          introduce: !!(beData.introduce.goalEn && beData.introduce.situationEn),
          present: !!(beData.present.patterns.length > 0 && beData.present.patterns[0].en),
          understand: !!(beData.understand.fillRows.length > 0),
          practice: !!(beData.practice.steps.length > 0 && beData.practice.steps[0].instructionEn),
          challenge: !!(beData.challenge.scenarioEn),
          discussion: !!(beData.discussion.categories.length > 0 && beData.discussion.categories[0].title),
          feedback: !!(beData.feedback.goalReviewEn),
        }}
        onGenerateIntroduce={(data) => {
          updateSection('introduce', {
            goalEn: data.goalEn || beData.introduce.goalEn,
            goalJp: data.goalJp || beData.introduce.goalJp,
            situationEn: data.situationEn || '',
            situationJp: data.situationJp || '',
            taskEn: data.taskEn || '',
            taskJp: data.taskJp || '',
            tutorNotes: data.tutorNotes || beData.introduce.tutorNotes,
          });
          if (data.goalEn) setGoalTextEn(data.goalEn);
          if (data.goalJp) setGoalTextJp(data.goalJp);
        }}
        onGeneratePresent={(data) => {
          updateSection('present', {
            patterns: data.patterns || beData.present.patterns,
            vocabulary: data.vocabulary || beData.present.vocabulary,
            pronunciation: data.pronunciation || beData.present.pronunciation,
            tutorNotes: data.tutorNotes || beData.present.tutorNotes,
          });
        }}
        onGenerateUnderstand={(data) => {
          updateSection('understand', {
            instruction: data.instruction || '',
            instructionJp: data.instructionJp || '',
            fillRows: data.fillRows || [],
            tutorNotes: data.tutorNotes || beData.understand.tutorNotes,
          });
        }}
        onGeneratePractice={(data) => {
          setBeData(prev => ({
            ...prev,
            practice: {
              ...prev.practice,
              steps: (data.steps || []).map((s: any, i: number) => ({
                title: s.title || `Step ${i + 1}`,
                instructionEn: s.instructionEn || '',
                instructionJp: s.instructionJp || '',
                content: s.content || '',
                dialogue: s.dialogue,
                tutorNotes: s.tutorNotes || [],
              })),
            },
          }));
          triggerAutosave();
        }}
        onGenerateChallenge={(data) => {
          updateSection('challenge', {
            scenarioEn: data.scenarioEn || '',
            scenarioJp: data.scenarioJp || '',
            guideQuestions: data.guideQuestions || [],
            roleplayTable: data.roleplayTable,
            tutorNotes: data.tutorNotes || beData.challenge.tutorNotes,
          });
        }}
        onGenerateDiscussion={(data) => {
          updateSection('discussion', {
            instructionEn: data.instructionEn || '',
            instructionJp: data.instructionJp || '',
            categories: data.categories || [],
            tutorNotes: data.tutorNotes || beData.discussion.tutorNotes,
          });
        }}
        onGenerateFeedback={(data) => {
          updateSection('feedback', {
            goalReviewEn: data.goalReviewEn || goalTextEn,
            goalReviewJp: data.goalReviewJp || goalTextJp,
            feedbackTemplate: data.feedbackTemplate || beData.feedback.feedbackTemplate,
            nextLessonLabel: data.nextLessonLabel || beData.feedback.nextLessonLabel,
            nextLessonName: data.nextLessonName || beData.feedback.nextLessonName,
            tutorNotes: data.tutorNotes || beData.feedback.tutorNotes,
          });
        }}
        currentSectionData={(section: BESectionType) => beData[section]}
      />

      {/* Toolbar */}
      <div className="beve-toolbar">
        <div className="beve-toolbar-left">
          <button className="beve-back-btn" onClick={() => window.location.href = '/business-english-editor'}>
            <i className="ri-arrow-left-line" /><span>Back</span>
          </button>
          <div className="beve-toolbar-divider" />
          <div className="beve-toolbar-title">
            <span className="beve-toolbar-badge">{LEVEL_BADGES[lesson.level] || `LEVEL ${lesson.level}`}</span>
            Lesson {lesson.lessonNumber}: {lessonName || 'Untitled'}
          </div>
        </div>
        <div className="beve-toolbar-center">
          <i className="ri-edit-line" /> Business English Editor
        </div>
        <div className="beve-toolbar-right">
          <button className="beve-toolbar-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <i className={theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} />
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <span className={`beve-save-status ${autosaveStatus}`}>
            {autosaveStatus === 'pending' ? 'Unsaved changes\u2026' : autosaveStatus === 'saved' ? '\u2713 Saved' : ''}
          </span>
          <button className="beve-toolbar-btn" onClick={handleManualSave} disabled={saving}>
            <i className={saving ? 'ri-loader-4-line' : 'ri-save-line'} />
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body: Sidebar + Canvas */}
      <div className="beve-body">
        {/* Page Sidebar */}
        <div className="beve-sidebar">
          <div className="beve-sidebar-header">Pages</div>
          <div className="beve-sidebar-pages">
            {PCPP_PAGES.map((page) => (
              <button
                key={page.key}
                className={`beve-sidebar-page ${activePage === page.key ? 'active' : ''}`}
                onClick={() => scrollToPage(page.key)}
              >
                <span className="beve-page-num">{page.num}</span>
                <span className="beve-page-label">{page.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas — all 7 pages scroll */}
        <div className="beve-canvas" ref={canvasRef}>
          {renderPage1()}
          {renderPage2()}
          {renderPage3()}
          {renderPage4()}
          {renderPage5()}
          {renderPage6()}
          {renderPage7()}
        </div>
      </div>
    </div>
  );
}
