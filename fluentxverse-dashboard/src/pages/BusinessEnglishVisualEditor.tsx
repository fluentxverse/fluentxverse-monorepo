/**
 * BusinessEnglishVisualEditor
 * WYSIWYG visual editor for Business English PCPP lesson materials.
 *
 * 7-page scrollable document matching the reference PDF structure:
 *   Page 1: ① Introduce (Goal + Situation) + ② Present (Useful Patterns)
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
import './BusinessEnglishVisualEditor.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PatternItem { en: string; jp: string; }
interface VocabItem { word: string; pos: string; translation: string; definition?: string; pronunciation?: string; }
interface PronunColumn { symbol: string; words: { en: string; jp: string }[]; }
interface DialogueLine { role: 'tutor' | 'student'; en: string; jp: string; }
interface FillRow { parts: { text: string; isBlank: boolean }[]; }
interface DiscussionCategory { title: string; questions: string[]; }
interface TutorNote { type: 'instruction' | 'script' | 'tip'; text: string; }
interface GuideQuestion { text: string; }

interface BELessonData {
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
    tutorNotes: TutorNote[];
  };
  practice: {
    steps: {
      title: string; instructionEn: string; instructionJp: string;
      content: string; dialogue?: DialogueLine[]; tutorNotes: TutorNote[];
    }[];
  };
  challenge: {
    scenarioEn: string; scenarioJp: string;
    guideQuestions: GuideQuestion[];
    roleplayTable?: { you: string; coworkers: string[] };
    tutorNotes: TutorNote[];
  };
  discussion: {
    instructionEn: string; instructionJp: string;
    categories: DiscussionCategory[];
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
      if (data.beData) setBeData({ ...DEFAULT_BE_DATA, ...data.beData });
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
  const updateSection = <K extends keyof BELessonData>(section: K, updates: Partial<BELessonData[K]>) => {
    setBeData(prev => ({ ...prev, [section]: { ...prev[section], ...updates } }));
    triggerAutosave();
  };

  const updateTutorNotes = (section: keyof BELessonData, notes: TutorNote[]) => {
    setBeData(prev => ({ ...prev, [section]: { ...prev[section], tutorNotes: notes } }));
    triggerAutosave();
  };

  const addTutorNote = (section: keyof BELessonData, type: TutorNote['type'] = 'instruction') => {
    const current = (beData[section] as any).tutorNotes || [];
    updateTutorNotes(section, [...current, { type, text: '' }]);
  };

  const removeTutorNote = (section: keyof BELessonData, idx: number) => {
    const current = [...(beData[section] as any).tutorNotes];
    current.splice(idx, 1);
    updateTutorNotes(section, current);
  };

  const updateTutorNoteText = (section: keyof BELessonData, idx: number, text: string) => {
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

  const renderTutorNotes = (section: keyof BELessonData) => {
    const notes: TutorNote[] = (beData[section] as any).tutorNotes || [];
    return (
      <>
        <div className="beve-col-tutor-title">Teaching Notes</div>
        <div className="beve-tutor-notes">
          {notes.map((note, i) => (
            <div key={i} className={`beve-tutor-note ${note.type}`}>
              <div className="beve-tutor-note-type">{note.type}</div>
              <div className="beve-editable" contentEditable
                onBlur={(e) => updateTutorNoteText(section, i, (e.target as HTMLElement).innerText)}
                dangerouslySetInnerHTML={{ __html: note.text }} />
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
      {/* Row 2: Chapter + Skill */}
      <div className="beve-header-row2">
        <span className="beve-header-chapter">CHAPTER {lesson.chapter}: {chapterName.toUpperCase() || 'UNTITLED'}</span>
        <span className="beve-skill-badge">{lesson.skill.toUpperCase()}</span>
      </div>
      {/* Row 3: Lesson name */}
      <div className="beve-header-row3">
        <span className="beve-header-lesson">Lesson {lesson.lessonNumber}: {lessonName || 'Untitled'}</span>
      </div>
    </div>
  );

  const renderHintBox = () => (
    <div className="beve-hint-box">
      <div className="beve-hint-label">Useful Patterns</div>
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
          <span className="beve-editable step-title-text" contentEditable
            onBlur={(e) => {
              const steps = [...beData.practice.steps];
              steps[si] = { ...steps[si], title: (e.target as HTMLElement).innerText };
              updateSection('practice', { steps });
            }}
            dangerouslySetInnerHTML={{ __html: step.title }} />
        </div>
        <div className="beve-step-body">
          <div className="beve-step-instruction">
            <div className="beve-editable" contentEditable
              onBlur={(e) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], instructionEn: (e.target as HTMLElement).innerText }; updateSection('practice', { steps }); }}
              dangerouslySetInnerHTML={{ __html: step.instructionEn }} />
            <div className="beve-step-instruction-jp beve-editable" contentEditable
              onBlur={(e) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], instructionJp: (e.target as HTMLElement).innerText }; updateSection('practice', { steps }); }}
              dangerouslySetInnerHTML={{ __html: step.instructionJp }} />
          </div>
          <div className="beve-editable" contentEditable style={{ minHeight: 40, fontSize: 14, lineHeight: 1.7 }}
            onBlur={(e) => { const steps = [...beData.practice.steps]; steps[si] = { ...steps[si], content: (e.target as HTMLElement).innerHTML }; updateSection('practice', { steps }); }}
            dangerouslySetInnerHTML={{ __html: step.content }} />

          {step.dialogue && step.dialogue.length > 0 && (
            <div className="beve-dialogue" style={{ marginTop: 12 }}>
              {step.dialogue.map((line, li) => (
                <div key={li} className={`beve-dialogue-line ${line.role}`}>
                  <span className="beve-dialogue-role">{line.role === 'tutor' ? 'Tutor:' : 'Student:'}</span>
                  <div style={{ flex: 1 }}>
                    <div className="beve-dialogue-text beve-editable" contentEditable
                      onBlur={(e) => { const steps = [...beData.practice.steps]; const dlg = [...(steps[si].dialogue || [])]; dlg[li] = { ...dlg[li], en: (e.target as HTMLElement).innerText }; steps[si] = { ...steps[si], dialogue: dlg }; updateSection('practice', { steps }); }}
                      dangerouslySetInnerHTML={{ __html: line.en }} />
                    <div className="beve-dialogue-text-jp beve-editable" contentEditable
                      onBlur={(e) => { const steps = [...beData.practice.steps]; const dlg = [...(steps[si].dialogue || [])]; dlg[li] = { ...dlg[li], jp: (e.target as HTMLElement).innerText }; steps[si] = { ...steps[si], dialogue: dlg }; updateSection('practice', { steps }); }}
                      dangerouslySetInnerHTML={{ __html: line.jp }} />
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
        </div>
      </div>
    );
  };

  // Helper: render practice step tutor notes
  const renderPracticeStepNotes = (indices: number[]) => (
    <>
      <div className="beve-col-tutor-title">Teaching Notes</div>
      <div className="beve-tutor-notes">
        {indices.map(si => {
          const step = beData.practice.steps[si];
          if (!step) return null;
          return (
            <div key={si}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginTop: si > indices[0] ? 12 : 0, marginBottom: 6 }}>{step.title}</div>
              {step.tutorNotes.map((note, ni) => (
                <div key={ni} className={`beve-tutor-note ${note.type}`}>
                  <div className="beve-tutor-note-type">{note.type}</div>
                  <div className="beve-editable" contentEditable
                    onBlur={(e) => { const steps = [...beData.practice.steps]; const notes = [...steps[si].tutorNotes]; notes[ni] = { ...notes[ni], text: (e.target as HTMLElement).innerText }; steps[si] = { ...steps[si], tutorNotes: notes }; updateSection('practice', { steps }); }}
                    dangerouslySetInnerHTML={{ __html: note.text }} />
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
  // 7 PAGE RENDERERS — matching PDF structure
  // ========================================================================

  /** PAGE 1: ① Introduce (Goal + Situation) + ② Present (Useful Patterns) */
  const renderPage1 = () => (
    <div className="beve-page" id="beve-page1" ref={(el) => { pageRefs.current['page1'] = el; }}>
      {renderPageHeader(1)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {/* ① Introduce */}
          {renderSectionBanner(1, 'WARM-UP')}
          <div className="beve-goal-box">
            <div className="beve-goal-label">Lesson Goal</div>
            <div className="beve-goal-en beve-editable" contentEditable
              onBlur={(e) => updateSection('introduce', { goalEn: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.introduce.goalEn }} />
            <div className="beve-goal-jp beve-editable" contentEditable
              onBlur={(e) => updateSection('introduce', { goalJp: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.introduce.goalJp }} />
          </div>
          <div className="beve-situation-box">
            <div className="beve-situation-label"><i className="ri-briefcase-line" /> Situation and Task</div>
            <div className="beve-situation-en beve-editable" contentEditable
              onBlur={(e) => updateSection('introduce', { situationEn: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.introduce.situationEn }} />
            <div className="beve-situation-jp beve-editable" contentEditable
              onBlur={(e) => updateSection('introduce', { situationJp: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.introduce.situationJp }} />
          </div>

          {/* ② Present — Useful Patterns */}
          {renderSectionBanner(2, 'KEY EXPRESSIONS')}
          <div className="beve-sub-heading">Common Phrases <span className="jp-label">\u3088\u304F\u4F7F\u3046\u30D5\u30EC\u30FC\u30BA</span></div>
          <div className="beve-patterns-grid">
            {beData.present.patterns.map((p, i) => (
              <div key={i} className="beve-pattern-card">
                <div className="beve-pattern-en beve-editable" contentEditable
                  onBlur={(e) => { const updated = [...beData.present.patterns]; updated[i] = { ...updated[i], en: (e.target as HTMLElement).innerText }; updateSection('present', { patterns: updated }); }}
                  dangerouslySetInnerHTML={{ __html: p.en }} />
                <div className="beve-pattern-jp beve-editable" contentEditable
                  onBlur={(e) => { const updated = [...beData.present.patterns]; updated[i] = { ...updated[i], jp: (e.target as HTMLElement).innerText }; updateSection('present', { patterns: updated }); }}
                  dangerouslySetInnerHTML={{ __html: p.jp }} />
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
          <div className="beve-situation-box">
            <div className="beve-situation-en beve-editable" contentEditable
              onBlur={(e) => updateSection('understand', { instruction: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.understand.instruction }} />
            <div className="beve-situation-jp beve-editable" contentEditable
              onBlur={(e) => updateSection('understand', { instructionJp: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.understand.instructionJp }} />
          </div>
          <div className="beve-patterns-grid">
            {beData.present.patterns.map((p, i) => (
              <div key={i} className="beve-pattern-card">
                <span className="beve-pattern-en">{p.en}</span>
                <span className="beve-pattern-jp">{p.jp}</span>
              </div>
            ))}
          </div>

          {/* Useful Vocabulary */}
          <div className="beve-sub-heading" style={{ marginTop: 24 }}>Word Bank <span className="jp-label">\u5358\u8A9E\u96C6</span></div>
          <table className="beve-vocab-table">
            <thead><tr><th>Word</th><th>Part of Speech</th><th>Translation</th><th>Definition</th><th style={{ width: 40 }} /></tr></thead>
            <tbody>
              {beData.present.vocabulary.map((v, i) => (
                <tr key={i}>
                  <td><span className="beve-vocab-word beve-editable" contentEditable
                    onBlur={(e) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], word: (e.target as HTMLElement).innerText }; updateSection('present', { vocabulary: u }); }}
                    dangerouslySetInnerHTML={{ __html: v.word }} /></td>
                  <td><span className="beve-vocab-pos beve-editable" contentEditable
                    onBlur={(e) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], pos: (e.target as HTMLElement).innerText }; updateSection('present', { vocabulary: u }); }}
                    dangerouslySetInnerHTML={{ __html: v.pos }} /></td>
                  <td><span className="beve-vocab-translation beve-editable" contentEditable
                    onBlur={(e) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], translation: (e.target as HTMLElement).innerText }; updateSection('present', { vocabulary: u }); }}
                    dangerouslySetInnerHTML={{ __html: v.translation }} /></td>
                  <td><span className="beve-editable" contentEditable
                    onBlur={(e) => { const u = [...beData.present.vocabulary]; u[i] = { ...u[i], definition: (e.target as HTMLElement).innerText }; updateSection('present', { vocabulary: u }); }}
                    dangerouslySetInnerHTML={{ __html: v.definition || '' }} /></td>
                  <td><button className="beve-icon-btn danger" onClick={() => { updateSection('present', { vocabulary: beData.present.vocabulary.filter((_, idx) => idx !== i) }); }}>
                    <i className="ri-delete-bin-line" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="beve-add-btn" onClick={() => { updateSection('present', { vocabulary: [...beData.present.vocabulary, { word: '', pos: '', translation: '', definition: '' }] }); }}>
            <i className="ri-add-line" /> Add Vocabulary</button>

          {/* Pronunciation */}
          <div className="beve-sub-heading" style={{ marginTop: 24 }}>Sound Practice <span className="jp-label">{beData.present.pronunciation.instructionJp}</span></div>
          <div className="beve-pronun-box">
            <div className="beve-pronun-title beve-editable" contentEditable
              onBlur={(e) => { updateSection('present', { pronunciation: { ...beData.present.pronunciation, instruction: (e.target as HTMLElement).innerText } }); }}
              dangerouslySetInnerHTML={{ __html: beData.present.pronunciation.instruction }} />
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
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('understand')}
        </div>
      </div>
    </div>
  );

  /** PAGE 3: ④ Practice Steps 1–2 */
  const renderPage3 = () => (
    <div className="beve-page" id="beve-page3" ref={(el) => { pageRefs.current['page3'] = el; }}>
      {renderPageHeader(3)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(4, 'DRILL')}
          {renderPracticeStep(0)}
          {renderPracticeStep(1)}
          {renderHintBox()}
        </div>
        <div className="beve-col-tutor">
          {renderPracticeStepNotes([0, 1])}
        </div>
      </div>
    </div>
  );

  /** PAGE 4: ④ Practice Steps 3–4 */
  const renderPage4 = () => (
    <div className="beve-page" id="beve-page4" ref={(el) => { pageRefs.current['page4'] = el; }}>
      {renderPageHeader(4)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(4, 'DRILL (CONT.)')}
          {renderPracticeStep(2)}
          {renderPracticeStep(3)}
          {renderHintBox()}
        </div>
        <div className="beve-col-tutor">
          {renderPracticeStepNotes([2, 3])}
        </div>
      </div>
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
            <div className="beve-challenge-scenario beve-editable" contentEditable
              onBlur={(e) => updateSection('challenge', { scenarioEn: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.challenge.scenarioEn }} />
            <div className="beve-challenge-scenario-jp beve-editable" contentEditable
              onBlur={(e) => updateSection('challenge', { scenarioJp: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.challenge.scenarioJp }} />
          </div>

          {beData.challenge.roleplayTable && (
            <div className="beve-situation-box">
              <div className="beve-situation-label">Roleplay Assignments</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>YOU</div>
                  <div className="beve-editable" contentEditable
                    onBlur={(e) => updateSection('challenge', { roleplayTable: { ...beData.challenge.roleplayTable!, you: (e.target as HTMLElement).innerText } })}
                    dangerouslySetInnerHTML={{ __html: beData.challenge.roleplayTable.you }} />
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
          )}
          {renderHintBox()}
        </div>
        <div className="beve-col-tutor">
          <div className="beve-col-tutor-title">Teaching Notes</div>
          <div className="beve-tutor-notes">
            {beData.challenge.tutorNotes.map((note, i) => (
              <div key={i} className={`beve-tutor-note ${note.type}`}>
                <div className="beve-tutor-note-type">{note.type}</div>
                <div className="beve-editable" contentEditable
                  onBlur={(e) => updateTutorNoteText('challenge', i, (e.target as HTMLElement).innerText)}
                  dangerouslySetInnerHTML={{ __html: note.text }} />
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
                  <span style={{ fontWeight: 700, color: '#a78bfa', marginRight: 6 }}>{i + 1}.</span>
                  <span className="beve-editable" contentEditable
                    onBlur={(e) => { const gq = [...beData.challenge.guideQuestions]; gq[i] = { text: (e.target as HTMLElement).innerText }; updateSection('challenge', { guideQuestions: gq }); }}
                    dangerouslySetInnerHTML={{ __html: q.text }} />
                </div>
              ))}
              <button className="beve-tutor-add-note" onClick={() => { updateSection('challenge', { guideQuestions: [...beData.challenge.guideQuestions, { text: '' }] }); }}>
                <i className="ri-add-line" /> Add Question</button>
            </div>
          </div>
        </div>
      </div>
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
            <div className="beve-situation-en beve-editable" contentEditable
              onBlur={(e) => updateSection('discussion', { instructionEn: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.discussion.instructionEn }} />
            <div className="beve-situation-jp beve-editable" contentEditable
              onBlur={(e) => updateSection('discussion', { instructionJp: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.discussion.instructionJp }} />
          </div>
          <div className="beve-discussion-categories">
            {beData.discussion.categories.map((cat, ci) => (
              <div key={ci} className="beve-disc-cat">
                <div className="beve-disc-cat-title beve-editable" contentEditable
                  onBlur={(e) => { const cats = [...beData.discussion.categories]; cats[ci] = { ...cats[ci], title: (e.target as HTMLElement).innerText }; updateSection('discussion', { categories: cats }); }}
                  dangerouslySetInnerHTML={{ __html: cat.title }} />
                <div className="beve-disc-questions">
                  {cat.questions.map((q, qi) => (
                    <div key={qi} className="beve-disc-q" data-num={`${qi + 1}.`}>
                      <span className="beve-editable" contentEditable
                        onBlur={(e) => { const cats = [...beData.discussion.categories]; const qs = [...cats[ci].questions]; qs[qi] = (e.target as HTMLElement).innerText; cats[ci] = { ...cats[ci], questions: qs }; updateSection('discussion', { categories: cats }); }}
                        dangerouslySetInnerHTML={{ __html: q }} />
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
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('discussion')}
        </div>
      </div>
    </div>
  );

  /** PAGE 7: ⑥ Feedback */
  const renderPage7 = () => (
    <div className="beve-page" id="beve-page7" ref={(el) => { pageRefs.current['page7'] = el; }}>
      {renderPageHeader(7)}
      <div className="beve-columns">
        <div className="beve-col-student">
          {renderSectionBanner(6, 'WRAP-UP')}
          <div className="beve-goal-box">
            <div className="beve-goal-label">Lesson Goal Review</div>
            <div className="beve-goal-en beve-editable" contentEditable
              onBlur={(e) => updateSection('feedback', { goalReviewEn: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.feedback.goalReviewEn }} />
            <div className="beve-goal-jp beve-editable" contentEditable
              onBlur={(e) => updateSection('feedback', { goalReviewJp: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.feedback.goalReviewJp }} />
          </div>
          {renderHintBox()}
          <div className="beve-sub-heading" style={{ marginTop: 24 }}><i className="ri-chat-check-line" /> Tutor's Review</div>
          <div className="beve-feedback-template">
            <div className="beve-editable" contentEditable style={{ fontFamily: "'Courier New', monospace", whiteSpace: 'pre-wrap' }}
              onBlur={(e) => updateSection('feedback', { feedbackTemplate: (e.target as HTMLElement).innerText })}
              dangerouslySetInnerHTML={{ __html: beData.feedback.feedbackTemplate }} />
          </div>
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
        </div>
        <div className="beve-col-tutor">
          {renderTutorNotes('feedback')}
        </div>
      </div>
      <div className="beve-page-footer">
        <div className="beve-footer-glow" />
        <div className="beve-footer-content">
          <div className="beve-footer-left">
            <span className="beve-page-footer-brand"><span className="brand-fluent">Fluent</span><span className="brand-x">X</span><span className="brand-verse">Verse</span></span>
            <span className="beve-footer-divider">/</span>
            <span className="beve-footer-course">Business English</span>
          </div>
          <div className="beve-footer-center">
            <span className="beve-footer-badge">PCPP Method</span>
            <span className="beve-footer-dot" />
            <span className="beve-footer-badge">Premium Material</span>
          </div>
          <div className="beve-footer-right">
            <span className="beve-footer-copy">&copy; {new Date().getFullYear()} FluentXVerse</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ========================================================================
  // MAIN RENDER — all 7 pages as scrollable document
  // ========================================================================

  return (
    <div className={`beve ${theme}`}>
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
