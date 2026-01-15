/**
 * ConversationalSkillsVisualEditor
 * WYSIWYG visual editor - edit content directly on the styled layout
 * This is the "no-code" page builder experience
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import {
  getLessonById,
  updateLessonHeader,
  type LessonMaterial,
} from '../api/lessonMaterial.api';
import { toast } from '../Components/Toast/Toast';
import './ConversationalSkillsVisualEditor.css';

// ============================================================================
// SHARED TYPES
// ============================================================================

interface IntroText {
  language: string;
  text: string;
}

interface LessonIssue {
  title: string;
  points: string[];
}

interface LessonGoalStep {
  instruction: string;
  script?: string | null;
  question?: string | null;
}

interface IntroductionData {
  introTexts: IntroText[];
  introImage: string | null;
  lessonIssue: LessonIssue | null;
  lessonGoalDuration: string;
  lessonGoalSteps: LessonGoalStep[];
}

// Default introduction data
const DEFAULT_INTRODUCTION_DATA: IntroductionData = {
  introTexts: [
    { 
      language: "en", 
      text: "Many Italians love to communicate not only through words but also through gestures. Knowing the meaning behind their gestures can save you from a lot of trouble!" 
    }
  ],
  introImage: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&h=400&fit=crop",
  lessonIssue: null,
  lessonGoalDuration: "1 minute",
  lessonGoalSteps: [
    { instruction: "Introduce the lesson topic.", script: "Today, let's talk about gestures.", question: null },
    { instruction: "Read the lesson goal and ask if it's clear.", script: null, question: null },
    { instruction: "Read the Introduce explanation.", script: null, question: null },
    { instruction: "Ask the question below.", script: null, question: null },
    { instruction: "Transition to the next section.", script: "Good! Let's go to the next part!", question: null }
  ]
};

// ============================================================================
// LEARN SECTION TYPES & DEFAULTS
// ============================================================================

// Step A can be either VOCABULARY or EXPRESSIONS
type StepAType = 'vocabulary' | 'expressions';

interface VocabularyItem {
  image: string;
  englishText: string;
  highlightedWord?: string;
  translation: string;
}

// ExpressionItem now uses rich text (HTML) for the definition line
// Users can bold/italic any text with Ctrl+B/Ctrl+I
interface ExpressionItem {
  image: string;
  definitionLine: string; // Rich text HTML like "To <strong>cost an arm and a leg</strong> means to be very expensive."
  exampleSentence: string; // Rich text HTML for example sentence
  extraText?: string; // Optional additional text below example
}

interface DiscussionImage {
  image: string;
  label?: string;
  translation?: string;
}

interface DiscussionPart {
  instruction: string;
  instructionTranslation?: string;
  images: DiscussionImage[]; // Up to 3 images
  tutorSteps?: TutorStep[];
}

// Pronunciation Part III structure
interface PronunciationWord {
  word: string;
  translation: string;
  isHighlighted?: boolean; // Show in green/bold
}

interface PronunciationColumn {
  soundSymbol: string; // e.g., "/d/"
  images: string[]; // 1-3 images showing mouth position
  words: PronunciationWord[];
}

interface PronunciationPart {
  instruction: string; // "III. Practice reading the words."
  instructionTranslation: string;
  leftColumn: PronunciationColumn;
  rightColumn: PronunciationColumn;
  tutorSteps?: TutorStep[];
}

interface TutorStep {
  instruction: string;
  script?: string | null;
  tip?: string | null;
}

interface LearnStepData {
  stepType: StepAType;
  stepName: string;
  duration: string;
  partLabel: string;
  partTranslation: string;
  // For vocabulary type
  vocabularyItems?: VocabularyItem[];
  // For expressions type
  expressionItems?: ExpressionItem[];
  // Part II - Discussion (for both vocabulary and expressions)
  discussionPart?: DiscussionPart;
  // Part III - Pronunciation (for both, can be Part II if discussionPart is not set)
  pronunciationPart?: PronunciationPart;
  // Common
  tutorSteps: TutorStep[];
}

interface LearnSectionData {
  sectionTitle: string;
  steps: LearnStepData[];
}

// Default VOCABULARY template
const DEFAULT_VOCABULARY_STEP: LearnStepData = {
  stepType: 'vocabulary',
  stepName: "STEP A VOCABULARY",
  duration: "2 minutes",
  partLabel: "I. Listen and repeat.",
  partTranslation: "聴いて、リピートしましょう。",
  vocabularyItems: [
    { image: "", englishText: "wake up", translation: "起きる" },
    { image: "", englishText: "do my hair", highlightedWord: "do", translation: "髪を整える" },
    { image: "", englishText: "eat breakfast", translation: "朝ごはんを食べる" },
    { image: "", englishText: "brush my teeth", translation: "歯を磨く" },
  ],
  tutorSteps: [
    { instruction: "Introduce Learn.", script: "Now, let's try Learn. First we have Step A Vocabulary. Let's do Part I. Can you see the pictures and text?", tip: null },
    { instruction: "Read the instructions.", script: null, tip: null },
    { instruction: "Read the first vocabulary and ask the student to repeat. Correct their pronunciation if necessary.", script: null, tip: null },
    { instruction: "Repeat Step 3 with the remaining vocabulary.", script: null, tip: null },
    { instruction: "Transition to the next part.", script: "Great! Let's go to the next part!", tip: null },
  ]
};

// Default EXPRESSIONS template
const DEFAULT_EXPRESSIONS_STEP: LearnStepData = {
  stepType: 'expressions',
  stepName: "STEP A EXPRESSIONS",
  duration: "4 minutes",
  partLabel: "I. Go over the expressions with your tutor.",
  partTranslation: "講師と一緒に表現を確認しましょう。",
  expressionItems: [
    { 
      image: "",
      definitionLine: "To <strong>cost an arm and a leg</strong> means to be very expensive.",
      exampleSentence: "<em>Staying at a five-star hotel will <strong>cost an arm and a leg</strong>.</em>"
    },
    { 
      image: "",
      definitionLine: "To <strong>cost a fortune</strong> requires a lot of money.",
      exampleSentence: "<em>The taxi ride from the airport <strong>cost a fortune</strong> last night!</em>"
    },
    { 
      image: "",
      definitionLine: "<strong>Dirt cheap</strong> means very inexpensive.",
      exampleSentence: "<em>The souvenirs I bought were <strong>dirt cheap</strong>.</em>"
    },
  ],
  tutorSteps: [
    { instruction: "Introduce Present.", script: "Now, let's try Present. First we have Step A Expressions. Let's do Part I. Can you see the pictures and text?", tip: null },
    { instruction: "Read the instructions.", script: null, tip: null },
    { instruction: "Read the first expression's explanation.", script: null, tip: null },
    { instruction: "Read the italicized example sentence and ask the student to repeat. Correct their pronunciation if necessary.", script: null, tip: null },
    { instruction: "Repeat Steps 3-4 with the remaining expressions.", script: null, tip: null },
    { instruction: "Transition to the next part.", script: "Great! Let's go to the next part!", tip: null },
  ]
};

const DEFAULT_LEARN_DATA: LearnSectionData = {
  sectionTitle: "LEARN",
  steps: [DEFAULT_VOCABULARY_STEP]
};

// ============================================================================
// STEP B SECTION TYPES & DEFAULTS
// ============================================================================

// Step B can be different templates
type StepBType = 'speak-your-mind' | 'grammar-tip' | 'pronunciation';

// A conversation exchange (speaker + speech bubble)
interface ConversationSpeaker {
  image: string;
  speechBubble: string; // Rich text HTML - can contain <strong> for highlighted phrase
}

// Speak Your Mind template structure
interface SpeakYourMindData {
  stepName: string; // "STEP B SPEAK YOUR MIND"
  duration: string;
  explanation: string; // Bold text at top explaining the grammar concept
  speaker1: ConversationSpeaker; // Left speaker (asks question)
  speaker2: ConversationSpeaker; // Right speaker (gives response with grammar phrase)
  question: string; // Question at the bottom for student to answer
  tutorSteps: TutorStep[];
}

// Grammar Tip example item (sentence + translation)
interface GrammarExample {
  sentence: string; // HTML with <strong> for highlighted word
  translation: string;
}

// Grammar Tip explanation block (rule + translation + optional examples box)
interface GrammarExplanation {
  ruleText: string; // HTML - can have <em> for italics
  ruleTranslation: string;
  examplesTitle?: string; // e.g., "EXAMPLES" or "EXAMPLE"
  examples?: GrammarExample[];
}

// Grammar Tip template structure
interface GrammarTipData {
  stepName: string; // "STEP B GRAMMAR TIP"
  duration: string;
  explanations: GrammarExplanation[];
  tutorSteps: TutorStep[];
}

// Step B Pronunciation types
interface PronunciationPhrase {
  phrase: string; // e.g., "cost a fortune"
  pronunciationGuide: string; // e.g., "/ cos-ta fortune /"
  exampleSentence: string; // HTML with <strong> for pronunciation highlight
}

interface StepBPronunciationData {
  stepName: string; // "STEP B PRONUNCIATION"
  duration: string;
  tip: string; // The bold pronunciation tip at the top
  phrases: PronunciationPhrase[];
  tutorSteps: TutorStep[];
}

interface StepBData {
  stepType: StepBType;
  speakYourMind?: SpeakYourMindData;
  grammarTip?: GrammarTipData;
  pronunciation?: StepBPronunciationData;
}

// ============================================================================
// APPLY SECTION TYPES (Section 3 - Speaking/Listening)
// ============================================================================

type ApplyActivityType = 'speaking' | 'listening';

// Dialogue line with speaker name and text (for SPEAKING)
interface DialogueLine {
  speaker: string; // e.g., "Heinz", "Naoki"
  text: string; // HTML - can have underlined words for emphasis
  isAction?: boolean; // e.g., "(laughs)" - shown in italics
}

// Script bullet point in tutor guide
interface TutorScriptBullet {
  text: string; // Script text (shown in green italic)
}

// Tip in tutor guide (shown in red)
interface TutorTipItem {
  text: string;
}

// Question in the questions box
interface TutorQuestion {
  question: string;
  answer?: string; // Answer hint (shown in green)
}

// Complex tutor step for APPLY section
interface ApplyTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[]; // Multiple script bullets
  tips?: TutorTipItem[]; // Multiple tips (red text)
  questions?: TutorQuestion[]; // Questions with answers
  listeningScript?: string; // Rich text HTML for listening script (green box)
}

interface ApplySectionData {
  sectionNumber: number; // Usually 3
  sectionTitle: string; // "APPLY"
  activityType: ApplyActivityType; // 'speaking' or 'listening'
  activityTitle: string; // "SPEAKING" or "LISTENING"
  activityDuration: string; // "3 minutes"
  situationText: string; // Situation description (bold)
  situationImage: string; // Main image
  // Speaking-specific
  dialogueLines: DialogueLine[];
  // Listening-specific (script is in tutorSteps)
  tutorSteps: ApplyTutorStep[];
}

// Default APPLY section template (Speaking)
const DEFAULT_APPLY_SPEAKING: ApplySectionData = {
  sectionNumber: 3,
  sectionTitle: "APPLY",
  activityType: "speaking",
  activityTitle: "SPEAKING",
  activityDuration: "3 minutes",
  situationText: "Naoki is having coffee with a German coworker.",
  situationImage: "",
  dialogueLines: [
    { speaker: "Heinz", text: "Ah, it's finally Friday! Do you have any plans for the weekend?" },
    { speaker: "Naoki", text: "Hmm... No, not really. Back in Japan, I normally play golf on weekends, but I guess for now, I'll just take a look around the city." },
    { speaker: "Heinz", text: "Oh, wow! You play golf?" },
    { speaker: "Naoki", text: "Yeah! I'm actually a member of a golf club back home. Originally, I only signed up because my boss invited me, but I'm glad I did. There are so many benefits!" },
    { speaker: "Heinz", text: "Really? Like what?" },
    { speaker: "Naoki", text: "Like meeting a lot of people! I get to interact with a lot of big names in our club, and I've been able to build a good network through it. Now I <u>have connections</u> in several industries!" },
    { speaker: "Heinz", text: "Oh, nice!" },
    { speaker: "Naoki", text: "Yeah, it's really good for business. Like, if you <u>know the right person</u> in a company, it's as good as <u>getting your foot in the door</u> for future partnerships. By the way, are there clubs like that here in Germany?" },
    { speaker: "Heinz", text: "Absolutely. Have you heard of hobby horsing clubs? They're pretty interesting." },
    { speaker: "Naoki", text: "Really? Cool! Are you a member?" },
    { speaker: "Heinz", text: "(laughs) No, I'm not. It's a club where people ride wooden stick horses.", isAction: true },
    { speaker: "Naoki", text: "Really?!" },
  ],
  tutorSteps: [
    {
      instruction: "Introduce Understand.",
      scripts: [
        { text: "Okay, now let's do Understand." },
        { text: "First we have a speaking activity." }
      ]
    },
    {
      instruction: "Set up the story.",
      scripts: [
        { text: "Do you remember Naoki from before?" }
      ],
      tips: [
        { text: "If the student doesn't remember, say that Naoki is a hardworking employee of a trading company who is aiming for a promotion. He's on a business trip in Germany." }
      ]
    },
    {
      instruction: "Read the situation."
    },
    {
      instruction: "Set up the dialogue.",
      scripts: [
        { text: "Let's read their dialogue." },
        { text: "I'll be your coworker Heinz. Please be Naoki." },
        { text: "Is it clear?" },
        { text: "Okay, I'll start." }
      ]
    },
    {
      instruction: "Read the dialogue with the student."
    },
    {
      instruction: "After you finish the dialogue, correct their pronunciation mistakes.",
      tips: [
        { text: "Limit this to 2-3 corrections." },
        { text: "If the student made a lot of mistakes, focus on the biggest ones." }
      ]
    },
    {
      instruction: "Ask the questions below.",
      questions: [
        { question: "According to Naoki, what is one benefit of being part of a sports club?", answer: "One of the benefits of being in a sports club is getting to meet a lot of people." },
        { question: "Would you also join a sports club to expand your social circle/network?", answer: "(student's own answer)" }
      ]
    },
    {
      instruction: "Transition to the next part.",
      scripts: [
        { text: "Great! Let's go to the next part!" }
      ]
    }
  ]
};

// Default APPLY section template (Listening)
const DEFAULT_APPLY_LISTENING: ApplySectionData = {
  sectionNumber: 3,
  sectionTitle: "APPLY",
  activityType: "listening",
  activityTitle: "LISTENING",
  activityDuration: "3 minutes",
  situationText: "Satoshi is doing a homestay in Italy. He's talking with Marco, a member of the family he's staying with.",
  situationImage: "",
  dialogueLines: [],
  tutorSteps: [
    {
      instruction: "Introduce Understand.",
      scripts: [
        { text: "Okay, now let's do Understand." },
        { text: "First we have a listening activity." }
      ]
    },
    {
      instruction: "Read the situation."
    },
    {
      instruction: "Set up the listening.",
      scripts: [
        { text: "Let's listen to Marco." },
        { text: "I'll be Marco." },
        { text: "Is it clear?" },
        { text: "Okay, I'll start." }
      ]
    },
    {
      instruction: "Read the listening script below, emphasizing the underlined words.",
      listeningScript: "Hey, Satoshi, it's nice to see that you're getting used to life in Italy now, but there's one thing you should be careful about. While you were talking with Matteo earlier, I noticed <u>you were using some gestures that have negative connotations</u>. Like when <u>you pointed at the side of your head</u>. Do you know what that means? ... Well, it's like <u>you're saying that he's stupid</u>. Not so nice, eh? <em>(laugh)</em> I think you also moved your arm to your stomach like this... Be careful: It doesn't mean you're hungry. We only do that when we want to tell someone that they're really annoying. <em>(laugh)</em> <u>Matteo knows you and understands you aren't trying to say anything bad about him, but it's dangerous to make gestures you don't understand with strangers</u>. <u>They might assume that you know they're insults and want to start a fight</u>. <u>I know you're trying to act more Italian, but you could get into serious trouble with the gestures!</u> My advice? Just focus on improving your Italian. <u>Don't gesticulate too much and you'll be fine!</u>"
    },
    {
      instruction: "Ask the questions below.",
      questions: [
        { question: "Why did Marco give Satoshi advice about gestures?", answer: "Because Marco noticed Satoshi was using gestures with negative connotations and is afraid that he could get in serious trouble." },
        { question: "If you were Satoshi, would you follow Marco's advice?", answer: "(student's own answer)" }
      ]
    },
    {
      instruction: "Transition to the next part.",
      scripts: [
        { text: "Great! Let's go to the next part!" }
      ]
    }
  ]
};

const DEFAULT_APPLY_DATA: ApplySectionData = DEFAULT_APPLY_SPEAKING;

// Default Speak Your Mind template
const DEFAULT_SPEAK_YOUR_MIND: SpeakYourMindData = {
  stepName: "STEP B SPEAK YOUR MIND",
  duration: "1 minute",
  explanation: "Sometimes you want to say what you would do if you were in someone else's situation.",
  speaker1: {
    image: "",
    speechBubble: "My coworker watches cat videos online at work all day. Do you think I should tell my boss?"
  },
  speaker2: {
    image: "",
    speechBubble: "<strong>If I were you, I would</strong> just ignore it. Don't you always text me while you're at work?"
  },
  question: "What advice would you give the man on the left?",
  tutorSteps: [
    { instruction: "Introduce Step B.", script: "Okay, now let's do Step B Speak Your Mind.", tip: null },
    { instruction: "Read the bold explanation.", script: null, tip: null },
    { instruction: "Do the conversation with the student.", script: null, tip: "The student should read the speech bubble with the bolded phrase." },
    { instruction: "Highlight the bolded part as today's Speak Your Mind phrase.", script: "Okay, the bolded part is today's Speak Your Mind phrase.", tip: null },
    { instruction: "Read just the bolded part one more time and have the student repeat.", script: null, tip: null },
    { instruction: "Ask the question below.", script: null, tip: "The student doesn't have to talk a lot. We just want to test their understanding of the phrase." },
    { instruction: "Transition to the next step.", script: "Fantastic! Let's go to the next step!", tip: null },
  ]
};

const DEFAULT_STEP_B_DATA: StepBData = {
  stepType: 'speak-your-mind',
  speakYourMind: DEFAULT_SPEAK_YOUR_MIND
};

// Default Grammar Tip template
const DEFAULT_GRAMMAR_TIP: GrammarTipData = {
  stepName: "STEP B GRAMMAR TIP",
  duration: "1 minute",
  explanations: [
    {
      ruleText: "<strong>Use simple present tense to talk about facts or routine.</strong>",
      ruleTranslation: "現在形を使って事実や日課について話すことができます。",
      examplesTitle: undefined,
      examples: undefined
    },
    {
      ruleText: "Use the dictionary form of the verb with <em>I</em>, <em>you</em>, <em>we</em>, and <em>they</em>.",
      ruleTranslation: "主語がI、you、we、theyのときには、動詞の原形を使いましょう。",
      examplesTitle: "EXAMPLES",
      examples: [
        { sentence: "I <strong>wake up</strong> at 7 a.m.", translation: "私は午前7時に起きます。" },
        { sentence: "You <strong>wash</strong> the dishes.", translation: "あなたは皿を洗います。" },
        { sentence: "We <strong>make</strong> waffles.", translation: "私たちはワッフルを作ります。" },
        { sentence: "They <strong>eat</strong> breakfast every day.", translation: "彼らは毎日朝ごはんを食べます。" }
      ]
    },
    {
      ruleText: "For negative sentences, add <em>don't</em> before the verb.",
      ruleTranslation: "否定文では、動詞の前にdon't を置きます。",
      examplesTitle: "EXAMPLE",
      examples: [
        { sentence: "I <strong>don't wake up</strong> at 7 a.m.", translation: "私は午前7時に起きません。" }
      ]
    }
  ],
  tutorSteps: [
    { instruction: "Introduce Step B Grammar Tip.", script: "Okay, now let's do Step B Grammar Tip.", tip: null },
    { instruction: "Read the bold grammar tip.", script: null, tip: null },
    { instruction: "Read the unbolded explanation part(s). Have the student read the example sentences.", script: null, tip: null },
    { instruction: "Confirm the student's understanding.", script: "Is it clear?", tip: null },
    { instruction: "Transition to the next section.", script: "Very good! Let's go to the next section!", tip: null },
  ]
};

// Default Pronunciation template
const DEFAULT_STEPB_PRONUNCIATION: StepBPronunciationData = {
  stepName: "STEP B PRONUNCIATION",
  duration: "1-2 minutes",
  tip: "When one word ends with a consonant sound and the next word starts with a vowel sound, they are often linked together.",
  phrases: [
    {
      phrase: "cost a fortune",
      pronunciationGuide: "/ cos-ta fortune /",
      exampleSentence: "The taxi ride from the airport <strong>/ cos-ta fortune /</strong>!"
    },
    {
      phrase: "cost an arm and a leg",
      pronunciationGuide: "/ cos-ta-nar-man-da leg /",
      exampleSentence: "Staying at a five-star hotel will <strong>/ cos-ta-nar-man-da leg /</strong>."
    }
  ],
  tutorSteps: [
    { instruction: "Introduce Step B.", script: "Okay, now let's do Step B.", tip: null },
    { instruction: "Read the bold pronunciation tip.", script: null, tip: null },
    { instruction: "Read the first phrase and have the student repeat.", script: null, tip: "Use the bold pronunciation guide under the phrase." },
    { instruction: "Read the example sentence and have the student repeat.", script: null, tip: null },
    { instruction: "Repeat Steps 3-4 with the remaining phrase(s) and example sentence(s).", script: null, tip: null },
    { instruction: "Transition to the next step.", script: "Fantastic! Let's go to the next step!", tip: null },
  ]
};

// ============================================================================
// RICH TEXT INPUT COMPONENT
// Supports Ctrl+B for bold, Ctrl+I for italic
// ============================================================================

interface RichTextInputProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
}

function RichTextInput({ value, onChange, placeholder, className = '', singleLine = true }: RichTextInputProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasFocus, setHasFocus] = useState(false);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold', false);
      // Trigger change after command
      if (ref.current) {
        onChange(ref.current.innerHTML);
      }
    }
    // Ctrl+I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic', false);
      if (ref.current) {
        onChange(ref.current.innerHTML);
      }
    }
    // Prevent Enter in single line mode
    if (singleLine && e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Handle input changes
  const handleInput = () => {
    if (ref.current) {
      onChange(ref.current.innerHTML);
    }
  };

  // Handle paste - strip non-formatting HTML
  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  };

  // Update content when value prop changes (but not during editing)
  useEffect(() => {
    if (ref.current && !hasFocus) {
      // Only update if different to avoid cursor jumping
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value || '';
      }
    }
  }, [value, hasFocus]);

  // Initial setup
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) {
      ref.current.innerHTML = value || '';
    }
  }, []);

  const showPlaceholder = !value && !hasFocus;

  return (
    <div className={`csve-rich-text-wrapper ${className}`}>
      <div
        ref={ref}
        className={`csve-rich-text-input ${showPlaceholder ? 'csve-placeholder' : ''}`}
        contentEditable
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        data-placeholder={placeholder}
        spellcheck={false}
      />
      <div className="csve-rich-text-hint">
        <kbd>Ctrl</kbd>+<kbd>B</kbd> bold &nbsp; <kbd>Ctrl</kbd>+<kbd>I</kbd> italic
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConversationalSkillsVisualEditor() {
  const { params } = useRoute();
  const [lesson, setLesson] = useState<LessonMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable state - styling
  const [backgroundImage, setBackgroundImage] = useState('');
  const [overlayColor, setOverlayColor] = useState('#134e4acc');
  
  // Editable state - text content
  const [chapterName, setChapterName] = useState('');
  const [lessonName, setLessonName] = useState('');
  const [goalTextEn, setGoalTextEn] = useState('');
  const [goalTextJp, setGoalTextJp] = useState('');
  
  // Introduction section state (lifted up from IntroductionSectionEditor)
  const [introductionData, setIntroductionData] = useState<IntroductionData>(DEFAULT_INTRODUCTION_DATA);
  
  // Learn section state
  const [learnData, setLearnData] = useState<LearnSectionData>(DEFAULT_LEARN_DATA);
  
  // Step B section state
  const [stepBData, setStepBData] = useState<StepBData>(DEFAULT_STEP_B_DATA);
  
  // Apply section state (Section 3 - Understanding/Speaking)
  const [applyData, setApplyData] = useState<ApplySectionData>(DEFAULT_APPLY_DATA);
  
  // UI state
  const [activeElement, setActiveElement] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  const id = params?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadLesson(id);
    }
  }, [id]);

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      const data = await getLessonById(lessonId);
      setLesson(data);
      setBackgroundImage(data.backgroundImage || '');
      setOverlayColor(data.overlayColor || '#134e4acc');
      setChapterName(data.chapterName || '');
      setLessonName(data.lessonName || '');
      setGoalTextEn(data.goalTextEn || '');
      setGoalTextJp(data.goalTextJp || '');
      
      // Load introduction data from lesson if available
      if (data.introductionData) {
        setIntroductionData(data.introductionData);
      }
      
      // Load learn data from lesson if available
      if (data.learnData) {
        setLearnData(data.learnData);
      }
      
      // Load step B data from lesson if available
      if (data.stepBData) {
        setStepBData(data.stepBData);
      }
      
      // Load apply data from lesson if available
      if (data.applyData) {
        setApplyData(data.applyData);
      }
    } catch (err) {
      console.error('Failed to load lesson:', err);
      setError('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lesson) return;
    
    setSaving(true);
    try {
      const updated = await updateLessonHeader(lesson.id, {
        backgroundImage,
        overlayColor,
        chapterName,
        lessonName,
        goalTextEn,
        goalTextJp,
        introductionData,
        learnData,
        stepBData,
        applyData,
      });
      setLesson(updated);
      toast.success('Changes saved!');
    } catch (err) {
      console.error('Failed to save:', err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenPreview = () => {
    if (!lesson) return;
    sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify({
      backgroundImage,
      overlayColor,
      chapterName,
      lessonName,
      goalTextEn,
      goalTextJp,
      introductionData,
      learnData,
      stepBData,
      applyData,
    }));
    window.open(`/conversational-skills-preview/${lesson.id}`, '_blank');
  };

  const handleBack = () => {
    window.location.href = `/conversational-skills-editor`;
  };

  // Parse overlay color
  const baseColor = overlayColor.slice(0, 7);
  const opacity = overlayColor.length === 9 
    ? parseInt(overlayColor.slice(7, 9), 16) / 255 
    : 0.8;

  const handleColorChange = (color: string) => {
    const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    setOverlayColor(color + opacityHex);
  };

  const handleOpacityChange = (newOpacity: number) => {
    const opacityHex = Math.round(newOpacity * 255).toString(16).padStart(2, '0');
    setOverlayColor(baseColor + opacityHex);
  };

  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================

  if (loading) {
    return (
      <div className="csve-fullpage csve-loading">
        <div className="csve-loader">
          <i className="ri-loader-4-line" />
          <p>Loading editor...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="csve-fullpage csve-error">
        <i className="ri-error-warning-line" />
        <h2>{error || 'Lesson not found'}</h2>
        <button onClick={handleBack}>Go Back</button>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="csve-fullpage">
      {/* Editor Toolbar - Fixed at top */}
      <div className="csve-toolbar">
        <div className="csve-toolbar-left">
          <button className="csve-toolbar-btn csve-back-btn" onClick={handleBack}>
            <i className="ri-arrow-left-line" />
            <span>Back</span>
          </button>
          <div className="csve-toolbar-divider" />
          <span className="csve-toolbar-title">
            <span className="csve-badge">{lesson.levelBadge}</span>
            Lesson {lesson.lessonNumber}: {lessonName}
          </span>
        </div>
        <div className="csve-toolbar-center">
          <span className="csve-edit-mode">
            <i className="ri-edit-line" />
            Visual Editor
          </span>
        </div>
        <div className="csve-toolbar-right">
          <button className="csve-toolbar-btn csve-preview-btn" onClick={handleOpenPreview}>
            <i className="ri-eye-line" />
            <span>Preview</span>
          </button>
          <button 
            className="csve-toolbar-btn csve-save-btn" 
            onClick={handleSave}
            disabled={saving}
          >
            <i className="ri-save-line" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas - The actual lesson layout */}
      <div className="csve-canvas" onClick={() => { setActiveElement(null); setEditingField(null); }}>
        {/* Top Navigation Bar */}
        <nav className="csve-topbar">
          <div className="csve-topbar-content">
            <span className="csve-course-info">
              Conversational Skills {lesson.levelBadge} | {lesson.skill.toUpperCase()} | Chapter {lesson.chapter}: {chapterName}
            </span>
          </div>
        </nav>

        {/* Hero Header Section - Clickable to edit */}
        <header
          className={`csve-hero ${activeElement === 'hero' ? 'csve-active' : ''}`}
          style={{
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          }}
          onClick={(e) => { e.stopPropagation(); setActiveElement('hero'); }}
        >
          <div className="csve-hero-overlay" style={{ backgroundColor: overlayColor }} />
          <div className="csve-hero-content">
            {/* Lesson Label - Chapter name is editable */}
            <p className="csve-lesson-label">
              Lesson {lesson.lessonNumber}:{' '}
              <EditableText
                value={chapterName}
                onChange={setChapterName}
                isEditing={editingField === 'chapterName'}
                onStartEdit={() => setEditingField('chapterName')}
                onEndEdit={() => setEditingField(null)}
                placeholder="Chapter Name"
              />
            </p>
            
            {/* Lesson Name - Editable */}
            <h1 className="csve-lesson-name">
              <EditableText
                value={lessonName}
                onChange={setLessonName}
                isEditing={editingField === 'lessonName'}
                onStartEdit={() => setEditingField('lessonName')}
                onEndEdit={() => setEditingField(null)}
                placeholder="Lesson Name"
              />
            </h1>
            
            <div className="csve-goal-wrapper">
              <div className="csve-goal-row">
                <span className="csve-goal-badge">GOAL</span>
                {/* Goal Text English - Editable */}
                <p className="csve-goal-en">
                  <EditableText
                    value={goalTextEn}
                    onChange={setGoalTextEn}
                    isEditing={editingField === 'goalTextEn'}
                    onStartEdit={() => setEditingField('goalTextEn')}
                    onEndEdit={() => setEditingField(null)}
                    placeholder="Goal (English)"
                  />
                </p>
              </div>
              {/* Goal Text Korean/Japanese - Editable */}
              <p className="csve-goal-jp">
                <EditableText
                  value={goalTextJp}
                  onChange={setGoalTextJp}
                  isEditing={editingField === 'goalTextJp'}
                  onStartEdit={() => setEditingField('goalTextJp')}
                  onEndEdit={() => setEditingField(null)}
                  placeholder="Goal (Korean/Japanese)"
                />
              </p>
            </div>
          </div>

          {/* Edit indicator */}
          {!editingField && (
            <div className="csve-edit-indicator">
              <i className="ri-edit-line" />
              Click text to edit • Click header for styling
            </div>
          )}
        </header>

        {/* Content Sections */}
        <main className="csve-main">
          <div className="csve-sections">
            {/* Introduction Section - Matches Preview */}
            <IntroductionSectionEditor 
              data={introductionData}
              onChange={setIntroductionData}
            />
            
            <LearnSectionEditor 
              data={learnData}
              onChange={setLearnData}
            />
            
            <StepBSectionEditor 
              data={stepBData}
              onChange={setStepBData}
            />
            
            <ApplySectionEditor 
              data={applyData}
              onChange={setApplyData}
            />
            
            <PlaceholderSection icon="ri-headphone-line" title="Listening" />
            <PlaceholderSection icon="ri-edit-line" title="Practice" />
          </div>
        </main>
      </div>

      {/* Side Panel - Context-sensitive editing */}
      {activeElement === 'hero' && (
        <aside className="csve-panel" onClick={e => e.stopPropagation()}>
          <div className="csve-panel-header">
            <h3>Header Settings</h3>
            <button className="csve-panel-close" onClick={() => setActiveElement(null)}>
              <i className="ri-close-line" />
            </button>
          </div>
          
          <div className="csve-panel-body">
            {/* Background Image */}
            <div className="csve-control">
              <label>Background Image</label>
              <div className="csve-image-control">
                {backgroundImage ? (
                  <div className="csve-image-thumb">
                    <img src={backgroundImage} alt="Background" />
                    <div className="csve-image-actions">
                      <button onClick={() => fileInputRef.current?.click()}>
                        <i className="ri-image-edit-line" />
                      </button>
                      <button onClick={() => setBackgroundImage('')}>
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="csve-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="ri-image-add-line" />
                    <span>Add Image</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Overlay Color */}
            <div className="csve-control">
              <label>Overlay Color</label>
              <div className="csve-color-row">
                <input
                  type="color"
                  value={baseColor}
                  onChange={e => handleColorChange((e.target as HTMLInputElement).value)}
                />
                <span className="csve-color-value">{baseColor}</span>
              </div>
            </div>

            {/* Opacity */}
            <div className="csve-control">
              <label>Opacity: {Math.round(opacity * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={opacity}
                onChange={e => handleOpacityChange(parseFloat((e.target as HTMLInputElement).value))}
              />
            </div>

            {/* Preset Colors */}
            <div className="csve-control">
              <label>Quick Colors</label>
              <div className="csve-color-presets">
                {['#0369a1', '#1e3a5f', '#134e4a', '#4c1d95', '#9f1239', '#1f2937'].map(color => (
                  <button
                    key={color}
                    className={`csve-preset ${baseColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                  />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="csve-panel-divider" />

            {/* Text Fields Section */}
            <div className="csve-control">
              <label>Chapter Name</label>
              <input
                type="text"
                className="csve-text-input"
                value={chapterName}
                onChange={e => setChapterName((e.target as HTMLInputElement).value)}
                placeholder="e.g., All About Me"
              />
            </div>

            <div className="csve-control">
              <label>Lesson Name</label>
              <input
                type="text"
                className="csve-text-input"
                value={lessonName}
                onChange={e => setLessonName((e.target as HTMLInputElement).value)}
                placeholder="e.g., Greetings"
              />
            </div>

            <div className="csve-control">
              <label>Goal (English)</label>
              <input
                type="text"
                className="csve-text-input"
                value={goalTextEn}
                onChange={e => setGoalTextEn((e.target as HTMLInputElement).value)}
                placeholder="e.g., I can say basic greetings."
              />
            </div>

            <div className="csve-control">
              <label>Goal (Korean/Japanese)</label>
              <input
                type="text"
                className="csve-text-input"
                value={goalTextJp}
                onChange={e => setGoalTextJp((e.target as HTMLInputElement).value)}
                placeholder="e.g., 기본 인사를 할 수 있다."
              />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

// ============================================================================
// EDITABLE TEXT COMPONENT
// ============================================================================

function EditableText({
  value,
  onChange,
  isEditing,
  onStartEdit,
  onEndEdit,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="csve-inline-input"
        value={value}
        onChange={e => onChange((e.target as HTMLInputElement).value)}
        onBlur={onEndEdit}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            onEndEdit();
          }
        }}
        onClick={e => e.stopPropagation()}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      className={`csve-editable-text ${!value ? 'csve-placeholder' : ''}`}
      onClick={e => {
        e.stopPropagation();
        onStartEdit();
      }}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  );
}

// ============================================================================
// PLACEHOLDER SECTION
// ============================================================================

function PlaceholderSection({ icon, title }: { icon: string; title: string }) {
  return (
    <section className="csve-section csve-section-placeholder">
      <div className="csve-section-header">
        <i className={icon} />
        <h2>{title}</h2>
      </div>
      <div className="csve-section-body">
        <p>Section editor coming soon...</p>
      </div>
    </section>
  );
}

// ============================================================================
// INTRODUCTION SECTION EDITOR - FULLY EDITABLE
// ============================================================================

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'vi', label: 'Vietnamese (Tiếng Việt)' },
];

interface IntroductionSectionEditorProps {
  data: IntroductionData;
  onChange: (data: IntroductionData) => void;
}

function IntroductionSectionEditor({ data, onChange }: IntroductionSectionEditorProps) {
  const introImageInputRef = useRef<HTMLInputElement>(null);
  
  // Extract from props for easier access
  const { introTexts, introImage, lessonIssue, lessonGoalDuration, lessonGoalSteps } = data;

  // UI state
  const [editingIntroText, setEditingIntroText] = useState<number | null>(null);
  const [showAddLanguage, setShowAddLanguage] = useState(false);

  // ============================================================================
  // HELPER: Update data
  // ============================================================================
  
  const updateData = (updates: Partial<IntroductionData>) => {
    onChange({ ...data, ...updates });
  };

  // ============================================================================
  // INTRO TEXT HANDLERS
  // ============================================================================
  
  const handleIntroTextChange = (index: number, text: string) => {
    const updated = [...introTexts];
    updated[index] = { ...updated[index], text };
    updateData({ introTexts: updated });
  };

  const handleAddIntroText = (language: string) => {
    if (introTexts.some(t => t.language === language)) {
      toast.error('This language already exists');
      return;
    }
    updateData({ introTexts: [...introTexts, { language, text: '' }] });
    setShowAddLanguage(false);
    setEditingIntroText(introTexts.length);
  };

  const handleRemoveIntroText = (index: number) => {
    if (introTexts.length === 1) {
      toast.error('At least one language is required');
      return;
    }
    updateData({ introTexts: introTexts.filter((_, i) => i !== index) });
  };

  // ============================================================================
  // IMAGE HANDLERS
  // ============================================================================

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateData({ introImage: reader.result as string });
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // LESSON ISSUE HANDLERS
  // ============================================================================

  const handleAddLessonIssue = () => {
    updateData({ lessonIssue: { title: '', points: [''] } });
  };

  const handleRemoveLessonIssue = () => {
    updateData({ lessonIssue: null });
  };

  const handleIssueTitleChange = (title: string) => {
    if (lessonIssue) {
      updateData({ lessonIssue: { ...lessonIssue, title } });
    }
  };

  const handleIssuePointChange = (index: number, text: string) => {
    if (lessonIssue) {
      const points = [...lessonIssue.points];
      points[index] = text;
      updateData({ lessonIssue: { ...lessonIssue, points } });
    }
  };

  const handleAddIssuePoint = () => {
    if (lessonIssue) {
      updateData({ lessonIssue: { ...lessonIssue, points: [...lessonIssue.points, ''] } });
    }
  };

  const handleRemoveIssuePoint = (index: number) => {
    if (lessonIssue && lessonIssue.points.length > 1) {
      updateData({ 
        lessonIssue: { 
          ...lessonIssue, 
          points: lessonIssue.points.filter((_, i) => i !== index) 
        } 
      });
    }
  };

  // ============================================================================
  // LESSON GOAL HANDLERS
  // ============================================================================

  const handleStepChange = (index: number, field: keyof LessonGoalStep, value: string | null) => {
    const updated = [...lessonGoalSteps];
    updated[index] = { ...updated[index], [field]: value };
    updateData({ lessonGoalSteps: updated });
  };

  const handleAddStep = () => {
    updateData({ lessonGoalSteps: [...lessonGoalSteps, { instruction: '', script: null, question: null }] });
  };

  const handleRemoveStep = (index: number) => {
    if (lessonGoalSteps.length > 1) {
      updateData({ lessonGoalSteps: lessonGoalSteps.filter((_, i) => i !== index) });
    }
  };

  const handleDurationChange = (duration: string) => {
    updateData({ lessonGoalDuration: duration });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <section className="csve-intro-section">
      <div className="csve-intro-layout">
        {/* Left Column - Main Content */}
        <div className="csve-intro-left">
          {/* FIXED: Section number and title */}
          <div className="csve-section-number">
            <span className="csve-number-badge">1</span>
            <h2 className="csve-section-title">INTRODUCE</h2>
            <div className="csve-section-line" />
          </div>
          
          {/* EDITABLE: Intro texts with multiple language support */}
          <div className="csve-intro-texts">
            {introTexts.map((introText, i) => (
              <div key={i} className="csve-intro-text-block">
                <div className="csve-intro-text-header">
                  <span className="csve-lang-badge">{introText.language.toUpperCase()}</span>
                  {introTexts.length > 1 && (
                    <button 
                      className="csve-remove-btn"
                      onClick={() => handleRemoveIntroText(i)}
                      title="Remove this translation"
                    >
                      <i className="ri-close-line" />
                    </button>
                  )}
                </div>
                {editingIntroText === i ? (
                  <textarea
                    className="csve-intro-textarea"
                    value={introText.text}
                    onChange={e => handleIntroTextChange(i, (e.target as HTMLTextAreaElement).value)}
                    onBlur={() => setEditingIntroText(null)}
                    placeholder={`Enter introduction text in ${LANGUAGE_OPTIONS.find(l => l.code === introText.language)?.label || introText.language}...`}
                    autoFocus
                  />
                ) : (
                  <p 
                    className="csve-intro-text csve-editable-block"
                    onClick={() => setEditingIntroText(i)}
                  >
                    {introText.text || <span className="csve-placeholder-text">Click to add text...</span>}
                  </p>
                )}
              </div>
            ))}
            
            {/* Add Language Button */}
            <div className="csve-add-language">
              {showAddLanguage ? (
                <div className="csve-language-picker">
                  {LANGUAGE_OPTIONS.filter(lang => !introTexts.some(t => t.language === lang.code)).map(lang => (
                    <button key={lang.code} onClick={() => handleAddIntroText(lang.code)}>
                      {lang.label}
                    </button>
                  ))}
                  <button className="csve-cancel-btn" onClick={() => setShowAddLanguage(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  className="csve-add-btn"
                  onClick={() => setShowAddLanguage(true)}
                  disabled={introTexts.length >= LANGUAGE_OPTIONS.length}
                >
                  <i className="ri-add-line" />
                  Add Translation
                </button>
              )}
            </div>
          </div>
          
          {/* EDITABLE: Intro image */}
          <div className="csve-intro-image-wrapper">
            {introImage ? (
              <div className="csve-intro-image csve-editable-block">
                <img src={introImage} alt="Introduction visual" />
                <div className="csve-image-overlay">
                  <button onClick={() => introImageInputRef.current?.click()}>
                    <i className="ri-image-edit-line" />
                    Change
                  </button>
                  <button onClick={() => updateData({ introImage: null })}>
                    <i className="ri-delete-bin-line" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="csve-add-image-btn"
                onClick={() => introImageInputRef.current?.click()}
              >
                <i className="ri-image-add-line" />
                Add Image
              </button>
            )}
            <input
              ref={introImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csve-intro-right">
          {/* EDITABLE & OPTIONAL: Lesson Issue */}
          {lessonIssue ? (
            <div className="csve-lesson-issue csve-editable-card">
              <div className="csve-issue-header">
                <span>THIS LESSON'S ISSUE</span>
                <div className="csve-issue-badges">
                  <small>For tutors only.</small>
                  <small className="csve-warning">DO NOT SHARE WITH THE STUDENT!</small>
                </div>
                <button 
                  className="csve-card-remove-btn"
                  onClick={handleRemoveLessonIssue}
                  title="Remove Lesson Issue"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="csve-issue-content">
                <input
                  type="text"
                  className="csve-issue-title-input"
                  value={lessonIssue.title}
                  onChange={e => handleIssueTitleChange((e.target as HTMLInputElement).value)}
                  placeholder="Issue title (e.g., Gestures)"
                />
                <ul className="csve-issue-points">
                  {lessonIssue.points.map((point, i) => (
                    <li key={i} className="csve-issue-point-item">
                      <textarea
                        className="csve-issue-point-input"
                        value={point}
                        onChange={e => {
                          const textarea = e.target as HTMLTextAreaElement;
                          textarea.style.height = 'auto';
                          textarea.style.height = textarea.scrollHeight + 'px';
                          handleIssuePointChange(i, textarea.value);
                        }}
                        onFocus={e => {
                          const textarea = e.target as HTMLTextAreaElement;
                          textarea.style.height = 'auto';
                          textarea.style.height = textarea.scrollHeight + 'px';
                        }}
                        placeholder="Enter a point..."
                        rows={1}
                      />
                      {lessonIssue.points.length > 1 && (
                        <button 
                          className="csve-point-remove"
                          onClick={() => handleRemoveIssuePoint(i)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button className="csve-add-point-btn" onClick={handleAddIssuePoint}>
                  <i className="ri-add-line" />
                  Add Point
                </button>
              </div>
            </div>
          ) : (
            <button className="csve-add-card-btn" onClick={handleAddLessonIssue}>
              <i className="ri-add-circle-line" />
              Add Lesson Issue
              <span className="csve-add-card-hint">Optional tutor-only information</span>
            </button>
          )}

          {/* EDITABLE: Lesson Goal */}
          <div className="csve-lesson-goal-box csve-editable-card">
            <div className="csve-goal-header-edit">
              <span className="csve-goal-title">LESSON GOAL</span>
              <span className="csve-goal-duration-wrap">
                (<input
                  type="text"
                  className="csve-duration-input"
                  value={lessonGoalDuration}
                  onChange={e => handleDurationChange((e.target as HTMLInputElement).value)}
                  placeholder="1 minute"
                />)
              </span>
            </div>
            <div className="csve-goal-steps">
              {lessonGoalSteps.map((step, i) => (
                <div className="csve-goal-step csve-goal-step-editable" key={i}>
                  <span className="csve-step-number">{i + 1}</span>
                  <div className="csve-step-content">
                    <input
                      type="text"
                      className="csve-step-instruction-input"
                      value={step.instruction}
                      onChange={e => handleStepChange(i, 'instruction', (e.target as HTMLInputElement).value)}
                      placeholder="Instruction..."
                    />
                    
                    {/* Script - green text with quotes */}
                    {step.script !== null && (
                      <div className="csve-step-script-block">
                        <span className="csve-script-quote">"</span>
                        <input
                          type="text"
                          className="csve-step-script-input"
                          value={step.script || ''}
                          onChange={e => handleStepChange(i, 'script', (e.target as HTMLInputElement).value)}
                          placeholder="Say this..."
                        />
                        <span className="csve-script-quote">"</span>
                        <button 
                          className="csve-remove-extra-btn"
                          onClick={() => handleStepChange(i, 'script', null)}
                          title="Remove script"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    )}
                    
                    {/* Tip - orange text */}
                    {step.question !== null && (
                      <div className="csve-step-tip-block">
                        <input
                          type="text"
                          className="csve-step-tip-input"
                          value={step.question || ''}
                          onChange={e => handleStepChange(i, 'question', (e.target as HTMLInputElement).value)}
                          placeholder="Add a tip..."
                        />
                        <button 
                          className="csve-remove-extra-btn"
                          onClick={() => handleStepChange(i, 'question', null)}
                          title="Remove tip"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    )}
                    
                    {/* Add buttons */}
                    <div className="csve-step-add-btns">
                      {step.script === null && (
                        <button 
                          className="csve-add-script-btn"
                          onClick={() => handleStepChange(i, 'script', '')}
                        >
                          <i className="ri-add-line" />
                          Add Script
                        </button>
                      )}
                      {step.question === null && (
                        <button 
                          className="csve-add-tip-btn"
                          onClick={() => handleStepChange(i, 'question', '')}
                        >
                          <i className="ri-add-line" />
                          Add Tip
                        </button>
                      )}
                    </div>
                    
                    {lessonGoalSteps.length > 1 && (
                      <button 
                        className="csve-step-remove"
                        onClick={() => handleRemoveStep(i)}
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button className="csve-add-step-btn" onClick={handleAddStep}>
                <i className="ri-add-line" />
                Add Step
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// LEARN SECTION EDITOR
// ============================================================================

interface LearnSectionEditorProps {
  data: LearnSectionData;
  onChange: (data: LearnSectionData) => void;
}

function LearnSectionEditor({ data, onChange }: LearnSectionEditorProps) {
  const vocabImageInputRef = useRef<HTMLInputElement>(null);
  const exprImageInputRef = useRef<HTMLInputElement>(null);
  const discussImageInputRef = useRef<HTMLInputElement>(null);
  const [activeVocabIndex, setActiveVocabIndex] = useState<{stepIdx: number, vocabIdx: number} | null>(null);
  const [activeExprIndex, setActiveExprIndex] = useState<{stepIdx: number, exprIdx: number} | null>(null);
  const [activeDiscussIndex, setActiveDiscussIndex] = useState<{stepIdx: number, imgIdx: number} | null>(null);

  // Helper to update data
  const updateData = (updates: Partial<LearnSectionData>) => {
    onChange({ ...data, ...updates });
  };

  const updateStep = (stepIndex: number, updates: Partial<LearnStepData>) => {
    const newSteps = [...data.steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };
    updateData({ steps: newSteps });
  };

  // Switch step type handler
  const handleSwitchStepType = (stepIdx: number, newType: StepAType) => {
    if (newType === 'vocabulary') {
      updateStep(stepIdx, {
        ...DEFAULT_VOCABULARY_STEP,
        stepType: 'vocabulary',
      });
    } else {
      updateStep(stepIdx, {
        ...DEFAULT_EXPRESSIONS_STEP,
        stepType: 'expressions',
      });
    }
  };

  // Vocabulary handlers
  const handleVocabChange = (stepIdx: number, vocabIdx: number, field: keyof VocabularyItem, value: string) => {
    const step = data.steps[stepIdx];
    const newVocab = [...(step.vocabularyItems || [])];
    newVocab[vocabIdx] = { ...newVocab[vocabIdx], [field]: value };
    updateStep(stepIdx, { vocabularyItems: newVocab });
  };

  const handleAddVocab = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const newVocab = [...(step.vocabularyItems || []), { image: '', englishText: '', translation: '' }];
    updateStep(stepIdx, { vocabularyItems: newVocab });
  };

  const handleRemoveVocab = (stepIdx: number, vocabIdx: number) => {
    const step = data.steps[stepIdx];
    if ((step.vocabularyItems || []).length <= 1) {
      toast.error('At least one vocabulary item is required');
      return;
    }
    updateStep(stepIdx, { vocabularyItems: (step.vocabularyItems || []).filter((_, i) => i !== vocabIdx) });
  };

  const handleVocabImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeVocabIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleVocabChange(activeVocabIndex.stepIdx, activeVocabIndex.vocabIdx, 'image', reader.result as string);
      setActiveVocabIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Expression handlers
  const handleExprChange = (stepIdx: number, exprIdx: number, field: keyof ExpressionItem, value: string) => {
    const step = data.steps[stepIdx];
    const newExpr = [...(step.expressionItems || [])];
    newExpr[exprIdx] = { ...newExpr[exprIdx], [field]: value };
    updateStep(stepIdx, { expressionItems: newExpr });
  };

  const handleAddExpr = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const newExpr = [...(step.expressionItems || []), { image: '', definitionLine: 'To <strong>expression</strong> means...', exampleSentence: '<em>Example sentence here.</em>' }];
    updateStep(stepIdx, { expressionItems: newExpr });
  };

  const handleRemoveExpr = (stepIdx: number, exprIdx: number) => {
    const step = data.steps[stepIdx];
    if ((step.expressionItems || []).length <= 1) {
      toast.error('At least one expression is required');
      return;
    }
    updateStep(stepIdx, { expressionItems: (step.expressionItems || []).filter((_, i) => i !== exprIdx) });
  };

  const handleExprImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeExprIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleExprChange(activeExprIndex.stepIdx, activeExprIndex.exprIdx, 'image', reader.result as string);
      setActiveExprIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Discussion part handlers
  const handleDiscussInstructionChange = (stepIdx: number, value: string) => {
    const step = data.steps[stepIdx];
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '', images: [] }), 
        instruction: value 
      } 
    });
  };

  const handleDiscussImageChange = (stepIdx: number, imgIdx: number, field: keyof DiscussionImage, value: string) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    const newImages = [...currentImages];
    newImages[imgIdx] = { ...newImages[imgIdx], [field]: value };
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: newImages 
      } 
    });
  };

  const handleAddDiscussImage = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    if (currentImages.length >= 3) {
      toast.error('Maximum 3 images allowed');
      return;
    }
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: [...currentImages, { image: '', label: '', translation: '' }] 
      } 
    });
  };

  const handleRemoveDiscussImage = (stepIdx: number, imgIdx: number) => {
    const step = data.steps[stepIdx];
    const currentImages = step.discussionPart?.images || [];
    updateStep(stepIdx, { 
      discussionPart: { 
        ...(step.discussionPart || { instruction: '' }), 
        images: currentImages.filter((_, i) => i !== imgIdx) 
      } 
    });
  };

  const handleDiscussImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeDiscussIndex) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleDiscussImageChange(activeDiscussIndex.stepIdx, activeDiscussIndex.imgIdx, 'image', reader.result as string);
      setActiveDiscussIndex(null);
    };
    reader.readAsDataURL(file);
  };

  // Add/Remove Discussion Part
  const handleAddDiscussionPart = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const partNum = step.pronunciationPart ? 'III' : 'II';
    updateStep(stepIdx, {
      discussionPart: {
        instruction: `${partNum}. Discussion question goes here.`,
        instructionTranslation: '',
        images: [{ image: '', label: '', translation: '' }],
        tutorSteps: [
          { instruction: 'Read the instructions.', script: null, tip: null },
          { instruction: 'Ask the student to describe the pictures.', script: null, tip: null },
          { instruction: 'Transition to the next part.', script: "Great! Let's go to the next part!", tip: null },
        ]
      }
    });
  };

  const handleRemoveDiscussionPart = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    const { discussionPart, ...rest } = step;
    updateStep(stepIdx, { discussionPart: undefined });
  };

  // Pronunciation Part handlers
  const handleAddPronunciationPart = (stepIdx: number) => {
    updateStep(stepIdx, {
      pronunciationPart: {
        instruction: 'Practice reading the words.',
        instructionTranslation: '単語を読む練習をしましょう。',
        leftColumn: {
          soundSymbol: '/d/',
          images: [''],
          words: [
            { word: 'do', translation: 'する', isHighlighted: true },
            { word: 'dressed', translation: '服を着た', isHighlighted: true },
            { word: 'dust', translation: 'ほこり' },
          ]
        },
        rightColumn: {
          soundSymbol: '/dʒ/',
          images: [''],
          words: [
            { word: 'Jew', translation: 'ユダヤ人' },
            { word: 'jest', translation: '冗談' },
            { word: 'just', translation: 'ちょうど' },
          ]
        },
        tutorSteps: [
          { instruction: 'Read the instructions.', script: null, tip: null },
          { instruction: 'Read the words in the left column and ask the student to repeat.', script: null, tip: null },
          { instruction: 'Read the words in the right column and ask the student to repeat.', script: null, tip: null },
          { instruction: 'Transition to the next part.', script: "Great! Let's go to the next part!", tip: null },
        ]
      }
    });
  };

  const handleRemovePronunciationPart = (stepIdx: number) => {
    updateStep(stepIdx, { pronunciationPart: undefined });
  };

  const handlePronunciationChange = (
    stepIdx: number, 
    column: 'leftColumn' | 'rightColumn', 
    field: string, 
    value: any
  ) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    updateStep(stepIdx, {
      pronunciationPart: {
        ...step.pronunciationPart,
        [column]: {
          ...step.pronunciationPart[column],
          [field]: value
        }
      }
    });
  };

  const handlePronunciationWordChange = (
    stepIdx: number,
    column: 'leftColumn' | 'rightColumn',
    wordIdx: number,
    field: keyof PronunciationWord,
    value: string | boolean
  ) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    const newWords = [...step.pronunciationPart[column].words];
    newWords[wordIdx] = { ...newWords[wordIdx], [field]: value };
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  const handleAddPronunciationWord = (stepIdx: number, column: 'leftColumn' | 'rightColumn') => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    const newWords = [...step.pronunciationPart[column].words, { word: '', translation: '' }];
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  const handleRemovePronunciationWord = (stepIdx: number, column: 'leftColumn' | 'rightColumn', wordIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    if (step.pronunciationPart[column].words.length <= 1) {
      toast.error('At least one word is required');
      return;
    }
    const newWords = step.pronunciationPart[column].words.filter((_, i) => i !== wordIdx);
    handlePronunciationChange(stepIdx, column, 'words', newWords);
  };

  // Tutor step handlers
  const handleTutorStepChange = (stepIdx: number, tutorIdx: number, field: keyof TutorStep, value: string | null) => {
    const step = data.steps[stepIdx];
    const newTutorSteps = [...step.tutorSteps];
    newTutorSteps[tutorIdx] = { ...newTutorSteps[tutorIdx], [field]: value };
    updateStep(stepIdx, { tutorSteps: newTutorSteps });
  };

  const handleAddTutorStep = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    updateStep(stepIdx, { tutorSteps: [...step.tutorSteps, { instruction: '', script: null, tip: null }] });
  };

  const handleRemoveTutorStep = (stepIdx: number, tutorIdx: number) => {
    const step = data.steps[stepIdx];
    if (step.tutorSteps.length <= 1) {
      toast.error('At least one tutor step is required');
      return;
    }
    updateStep(stepIdx, { tutorSteps: step.tutorSteps.filter((_, i) => i !== tutorIdx) });
  };

  // Discussion Part Tutor Steps handlers
  const handleDiscussionTutorStepChange = (stepIdx: number, tutorIdx: number, field: keyof TutorStep, value: string | null) => {
    const step = data.steps[stepIdx];
    if (!step.discussionPart || !step.discussionPart.tutorSteps) return;
    const newTutorSteps = [...step.discussionPart.tutorSteps];
    newTutorSteps[tutorIdx] = { ...newTutorSteps[tutorIdx], [field]: value };
    updateStep(stepIdx, { discussionPart: { ...step.discussionPart, tutorSteps: newTutorSteps } });
  };

  const handleAddDiscussionTutorStep = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.discussionPart) return;
    const currentSteps = step.discussionPart.tutorSteps || [];
    updateStep(stepIdx, { discussionPart: { ...step.discussionPart, tutorSteps: [...currentSteps, { instruction: '', script: null, tip: null }] } });
  };

  const handleRemoveDiscussionTutorStep = (stepIdx: number, tutorIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.discussionPart || !step.discussionPart.tutorSteps || step.discussionPart.tutorSteps.length <= 1) {
      toast.error('At least one tutor step is required');
      return;
    }
    updateStep(stepIdx, { discussionPart: { ...step.discussionPart, tutorSteps: step.discussionPart.tutorSteps.filter((_, i) => i !== tutorIdx) } });
  };

  // Pronunciation Part Tutor Steps handlers
  const handlePronunciationTutorStepChange = (stepIdx: number, tutorIdx: number, field: keyof TutorStep, value: string | null) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart || !step.pronunciationPart.tutorSteps) return;
    const newTutorSteps = [...step.pronunciationPart.tutorSteps];
    newTutorSteps[tutorIdx] = { ...newTutorSteps[tutorIdx], [field]: value };
    updateStep(stepIdx, { pronunciationPart: { ...step.pronunciationPart, tutorSteps: newTutorSteps } });
  };

  const handleAddPronunciationTutorStep = (stepIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart) return;
    const currentSteps = step.pronunciationPart.tutorSteps || [];
    updateStep(stepIdx, { pronunciationPart: { ...step.pronunciationPart, tutorSteps: [...currentSteps, { instruction: '', script: null, tip: null }] } });
  };

  const handleRemovePronunciationTutorStep = (stepIdx: number, tutorIdx: number) => {
    const step = data.steps[stepIdx];
    if (!step.pronunciationPart || !step.pronunciationPart.tutorSteps || step.pronunciationPart.tutorSteps.length <= 1) {
      toast.error('At least one tutor step is required');
      return;
    }
    updateStep(stepIdx, { pronunciationPart: { ...step.pronunciationPart, tutorSteps: step.pronunciationPart.tutorSteps.filter((_, i) => i !== tutorIdx) } });
  };

  return (
    <section className="csve-learn-section">
      <div className="csve-section-number">
        <span className="csve-number-badge">2</span>
        <h2 className="csve-section-title">{data.sectionTitle}</h2>
        <div className="csve-section-line" />
      </div>

      {data.steps.map((step, stepIdx) => (
        <div key={stepIdx} className="csve-learn-step">
          {/* Step Type Switcher */}
          <div className="csve-step-type-switcher">
            <span className="csve-switcher-label">Step A Type:</span>
            <div className="csve-switcher-buttons">
              <button
                className={`csve-switcher-btn ${step.stepType === 'vocabulary' ? 'active' : ''}`}
                onClick={() => handleSwitchStepType(stepIdx, 'vocabulary')}
              >
                <i className="ri-book-2-line" />
                Vocabulary
              </button>
              <button
                className={`csve-switcher-btn ${step.stepType === 'expressions' ? 'active' : ''}`}
                onClick={() => handleSwitchStepType(stepIdx, 'expressions')}
              >
                <i className="ri-chat-quote-line" />
                Expressions
              </button>
            </div>
          </div>

          {/* Step Header - Editable */}
          <div className="csve-step-header-edit">
            <input
              type="text"
              className="csve-step-name-input"
              value={step.stepName}
              onChange={e => updateStep(stepIdx, { stepName: (e.target as HTMLInputElement).value })}
              placeholder="STEP NAME"
            />
          </div>

          <div className="csve-learn-layout">
            {/* Left Column - Content */}
            <div className="csve-learn-left">
              {/* Part Label - Editable */}
              <div className="csve-part-label-edit">
                <input
                  type="text"
                  className="csve-part-english-input"
                  value={step.partLabel}
                  onChange={e => updateStep(stepIdx, { partLabel: (e.target as HTMLInputElement).value })}
                  placeholder="Part label (e.g., I. Listen and repeat.)"
                />
                <input
                  type="text"
                  className="csve-part-translation-input"
                  value={step.partTranslation}
                  onChange={e => updateStep(stepIdx, { partTranslation: (e.target as HTMLInputElement).value })}
                  placeholder="Translation"
                />
              </div>

              {/* VOCABULARY Content */}
              {step.stepType === 'vocabulary' && (
                <div className="csve-vocab-grid">
                  {(step.vocabularyItems || []).map((item, vocabIdx) => (
                    <div key={vocabIdx} className="csve-vocab-card csve-editable-card">
                      <div 
                        className="csve-vocab-image"
                        onClick={() => {
                          setActiveVocabIndex({ stepIdx, vocabIdx });
                          vocabImageInputRef.current?.click();
                        }}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.englishText} />
                        ) : (
                          <div className="csve-image-placeholder">
                            <span className="csve-placeholder-dims">150 × 100</span>
                            <span className="csve-placeholder-hint">Click to add</span>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        className="csve-vocab-english-input"
                        value={item.englishText}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'englishText', (e.target as HTMLInputElement).value)}
                        placeholder="English text"
                      />
                      <input
                        type="text"
                        className="csve-vocab-highlight-input"
                        value={item.highlightedWord || ''}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'highlightedWord', (e.target as HTMLInputElement).value)}
                        placeholder="Highlight word (optional)"
                      />
                      <input
                        type="text"
                        className="csve-vocab-translation-input"
                        value={item.translation}
                        onChange={e => handleVocabChange(stepIdx, vocabIdx, 'translation', (e.target as HTMLInputElement).value)}
                        placeholder="Translation"
                      />
                      {(step.vocabularyItems || []).length > 1 && (
                        <button className="csve-vocab-remove" onClick={() => handleRemoveVocab(stepIdx, vocabIdx)}>
                          <i className="ri-delete-bin-line" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="csve-add-vocab-btn" onClick={() => handleAddVocab(stepIdx)}>
                    <i className="ri-add-line" />
                    Add Vocabulary
                  </button>
                </div>
              )}

              {/* EXPRESSIONS Content */}
              {step.stepType === 'expressions' && (
                <>
                  <div className="csve-expr-list">
                    {(step.expressionItems || []).map((item, exprIdx) => (
                      <div key={exprIdx} className="csve-expr-item">
                        <div 
                          className="csve-expr-image"
                          onClick={() => {
                            setActiveExprIndex({ stepIdx, exprIdx });
                            exprImageInputRef.current?.click();
                          }}
                        >
                          {item.image ? (
                            <img src={item.image} alt="expression" />
                          ) : (
                            <div className="csve-image-placeholder">
                              <span className="csve-placeholder-dims">220 × 165</span>
                              <span className="csve-placeholder-hint">Click to add</span>
                            </div>
                          )}
                        </div>
                        <div className="csve-expr-content">
                          <div className="csve-expr-number">{exprIdx + 1}.</div>
                          <div className="csve-expr-fields">
                            <RichTextInput
                              value={item.definitionLine}
                              onChange={(html) => handleExprChange(stepIdx, exprIdx, 'definitionLine', html)}
                              placeholder="To cost an arm and a leg means to be very expensive."
                              className="csve-expr-definition-rich"
                            />
                            <RichTextInput
                              value={item.exampleSentence}
                              onChange={(html) => handleExprChange(stepIdx, exprIdx, 'exampleSentence', html)}
                              placeholder="Staying at a five-star hotel will cost an arm and a leg."
                              className="csve-expr-example-rich"
                            />
                            {item.extraText !== undefined ? (
                              <div className="csve-expr-extra-wrap">
                                <RichTextInput
                                  value={item.extraText}
                                  onChange={(html) => handleExprChange(stepIdx, exprIdx, 'extraText', html)}
                                  placeholder="Additional text..."
                                  className="csve-expr-extra-rich"
                                />
                                <button 
                                  className="csve-expr-extra-remove"
                                  onClick={() => {
                                    const step = data.steps[stepIdx];
                                    const newExpr = [...(step.expressionItems || [])];
                                    const { extraText, ...rest } = newExpr[exprIdx];
                                    newExpr[exprIdx] = rest as ExpressionItem;
                                    updateStep(stepIdx, { expressionItems: newExpr });
                                  }}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                className="csve-add-extra-text-btn"
                                onClick={() => handleExprChange(stepIdx, exprIdx, 'extraText', '')}
                              >
                                <i className="ri-add-line" /> Add Text
                              </button>
                            )}
                          </div>
                          {(step.expressionItems || []).length > 1 && (
                            <button className="csve-expr-remove" onClick={() => handleRemoveExpr(stepIdx, exprIdx)}>
                              <i className="ri-delete-bin-line" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button className="csve-add-expr-btn" onClick={() => handleAddExpr(stepIdx)}>
                      <i className="ri-add-line" />
                      Add Expression
                    </button>
                  </div>
                </>
              )}

            </div>

            {/* Right Column - Part I Tutor Guide */}
            <div className="csve-learn-right">
              <div className="csve-tutor-guide csve-editable-card">
                <div className="csve-guide-header-edit">
                  <span className="csve-guide-title">{data.sectionTitle} - {step.stepName.split(' ').slice(0, 2).join(' ')}</span>
                  <span className="csve-guide-duration-wrap">
                    (<input
                      type="text"
                      className="csve-duration-input"
                      value={step.duration}
                      onChange={e => updateStep(stepIdx, { duration: (e.target as HTMLInputElement).value })}
                      placeholder="2 minutes"
                    />)
                  </span>
                </div>
                
                <div className="csve-guide-steps">
                  {step.tutorSteps.map((tutorStep, tutorIdx) => (
                    <div key={tutorIdx} className="csve-guide-step csve-guide-step-editable">
                      <span className="csve-guide-number">{tutorIdx + 1}</span>
                      <div className="csve-guide-content">
                        <input
                          type="text"
                          className="csve-guide-instruction-input"
                          value={tutorStep.instruction}
                          onChange={e => handleTutorStepChange(stepIdx, tutorIdx, 'instruction', (e.target as HTMLInputElement).value)}
                          placeholder="Instruction..."
                        />
                        
                        {tutorStep.script !== null && tutorStep.script !== undefined && (
                          <div className="csve-guide-script-block">
                            <span className="csve-script-quote">"</span>
                            <input
                              type="text"
                              className="csve-guide-script-input"
                              value={tutorStep.script || ''}
                              onChange={e => handleTutorStepChange(stepIdx, tutorIdx, 'script', (e.target as HTMLInputElement).value)}
                              placeholder="Say this..."
                            />
                            <span className="csve-script-quote">"</span>
                            <button 
                              className="csve-remove-extra-btn"
                              onClick={() => handleTutorStepChange(stepIdx, tutorIdx, 'script', null)}
                              title="Remove script"
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        )}
                        
                        {tutorStep.tip !== null && tutorStep.tip !== undefined && (
                          <div className="csve-guide-tip-block">
                            <input
                              type="text"
                              className="csve-guide-tip-input"
                              value={tutorStep.tip || ''}
                              onChange={e => handleTutorStepChange(stepIdx, tutorIdx, 'tip', (e.target as HTMLInputElement).value)}
                              placeholder="Add a tip..."
                            />
                            <button 
                              className="csve-remove-extra-btn"
                              onClick={() => handleTutorStepChange(stepIdx, tutorIdx, 'tip', null)}
                              title="Remove tip"
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        )}
                        
                        <div className="csve-guide-add-btns">
                          {(tutorStep.script === null || tutorStep.script === undefined) && (
                            <button 
                              className="csve-add-script-btn"
                              onClick={() => handleTutorStepChange(stepIdx, tutorIdx, 'script', '')}
                            >
                              <i className="ri-add-line" />
                              Add Script
                            </button>
                          )}
                          {(tutorStep.tip === null || tutorStep.tip === undefined) && (
                            <button 
                              className="csve-add-tip-btn"
                              onClick={() => handleTutorStepChange(stepIdx, tutorIdx, 'tip', '')}
                            >
                              <i className="ri-add-line" />
                              Add Tip
                            </button>
                          )}
                        </div>
                        
                        {step.tutorSteps.length > 1 && (
                          <button 
                            className="csve-guide-step-remove"
                            onClick={() => handleRemoveTutorStep(stepIdx, tutorIdx)}
                          >
                            <i className="ri-delete-bin-line" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    className="csve-add-guide-step-btn"
                    onClick={() => handleAddTutorStep(stepIdx)}
                  >
                    <i className="ri-add-line" />
                    Add Tutor Step
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PART II - Discussion (separate layout for alignment) */}
          {step.discussionPart ? (
            <div className="csve-learn-layout csve-part-layout">
              {/* Left Column - Discussion Content */}
              <div className="csve-learn-left">
                <div className="csve-discuss-part">
                  <div className="csve-part-header">
                    <span className="csve-part-label">Part II</span>
                    <button className="csve-remove-part-btn" onClick={() => handleRemoveDiscussionPart(stepIdx)}>
                      <i className="ri-close-line" /> Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    className="csve-discuss-instruction-input"
                    value={step.discussionPart?.instruction || ''}
                    onChange={e => handleDiscussInstructionChange(stepIdx, (e.target as HTMLInputElement).value)}
                    placeholder="II. Discussion question..."
                  />
                  
                  {/* Images Grid - Up to 3 images horizontally */}
                  <div className={`csve-discuss-images csve-discuss-images-${(step.discussionPart?.images || []).length || 1}`}>
                    {(step.discussionPart?.images || []).map((img, imgIdx) => (
                      <div key={imgIdx} className="csve-discuss-image-item">
                        <div 
                          className="csve-discuss-image"
                          onClick={() => {
                            setActiveDiscussIndex({ stepIdx, imgIdx });
                            discussImageInputRef.current?.click();
                          }}
                        >
                          {img.image ? (
                            <img src={img.image} alt={img.label || 'Discussion'} />
                          ) : (
                            <div className="csve-image-placeholder">
                              <span className="csve-placeholder-dims">300 × 200</span>
                              <span className="csve-placeholder-hint">Click to add</span>
                            </div>
                          )}
                          {(step.discussionPart?.images || []).length > 1 && (
                            <button 
                              className="csve-discuss-image-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDiscussImage(stepIdx, imgIdx);
                              }}
                            >
                              <i className="ri-close-line" />
                            </button>
                          )}
                        </div>
                        
                        {/* Label input */}
                        <div className="csve-discuss-label-row">
                          {img.label !== undefined ? (
                            <input
                              type="text"
                              className="csve-discuss-label-input"
                              value={img.label}
                              onChange={e => handleDiscussImageChange(stepIdx, imgIdx, 'label', (e.target as HTMLInputElement).value)}
                              placeholder="Label (e.g., hotel)"
                            />
                          ) : (
                            <button 
                              className="csve-add-label-btn"
                              onClick={() => handleDiscussImageChange(stepIdx, imgIdx, 'label', '')}
                            >
                              <i className="ri-add-line" /> Add Label
                            </button>
                          )}
                        </div>
                        
                        {/* Translation input */}
                        <div className="csve-discuss-translation-row">
                          {img.translation !== undefined ? (
                            <input
                              type="text"
                              className="csve-discuss-translation-input"
                              value={img.translation}
                              onChange={e => handleDiscussImageChange(stepIdx, imgIdx, 'translation', (e.target as HTMLInputElement).value)}
                              placeholder="Translation (e.g., ホテル)"
                            />
                          ) : (
                            <button 
                              className="csve-add-translation-btn"
                              onClick={() => handleDiscussImageChange(stepIdx, imgIdx, 'translation', '')}
                            >
                              <i className="ri-add-line" /> Add Translation
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Image Button */}
                    {(step.discussionPart?.images || []).length < 3 && (
                      <button 
                        className="csve-add-discuss-image-btn"
                        onClick={() => handleAddDiscussImage(stepIdx)}
                      >
                        <i className="ri-add-line" />
                        <span>Add Image</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Right Column - Discussion Tutor Guide */}
              <div className="csve-learn-right">
                {step.discussionPart.tutorSteps && (
                <div className="csve-tutor-guide csve-editable-card csve-part-tutor-guide">
                  <div className="csve-guide-header-edit">
                    <span className="csve-guide-title">Part {step.pronunciationPart ? 'II' : 'II'} - Discussion</span>
                  </div>
                  
                  <div className="csve-guide-steps">
                    {step.discussionPart.tutorSteps.map((tutorStep, tutorIdx) => (
                      <div key={tutorIdx} className="csve-guide-step csve-guide-step-editable">
                        <span className="csve-guide-number">{tutorIdx + 1}</span>
                        <div className="csve-guide-content">
                          <input
                            type="text"
                            className="csve-guide-instruction-input"
                            value={tutorStep.instruction}
                            onChange={e => handleDiscussionTutorStepChange(stepIdx, tutorIdx, 'instruction', (e.target as HTMLInputElement).value)}
                            placeholder="Instruction..."
                          />
                          
                          {tutorStep.script !== null && tutorStep.script !== undefined && (
                            <div className="csve-guide-script-block">
                              <span className="csve-script-quote">"</span>
                              <input
                                type="text"
                                className="csve-guide-script-input"
                                value={tutorStep.script || ''}
                                onChange={e => handleDiscussionTutorStepChange(stepIdx, tutorIdx, 'script', (e.target as HTMLInputElement).value)}
                                placeholder="Say this..."
                              />
                              <span className="csve-script-quote">"</span>
                              <button 
                                className="csve-remove-extra-btn"
                                onClick={() => handleDiscussionTutorStepChange(stepIdx, tutorIdx, 'script', null)}
                                title="Remove script"
                              >
                                <i className="ri-close-line" />
                              </button>
                            </div>
                          )}
                          
                          {tutorStep.tip !== null && tutorStep.tip !== undefined && (
                            <div className="csve-guide-tip-block">
                              <input
                                type="text"
                                className="csve-guide-tip-input"
                                value={tutorStep.tip || ''}
                                onChange={e => handleDiscussionTutorStepChange(stepIdx, tutorIdx, 'tip', (e.target as HTMLInputElement).value)}
                                placeholder="Add a tip..."
                              />
                              <button 
                                className="csve-remove-extra-btn"
                                onClick={() => handleDiscussionTutorStepChange(stepIdx, tutorIdx, 'tip', null)}
                                title="Remove tip"
                              >
                                <i className="ri-close-line" />
                              </button>
                            </div>
                          )}
                          
                          <div className="csve-guide-add-btns">
                            {(tutorStep.script === null || tutorStep.script === undefined) && (
                              <button 
                                className="csve-add-script-btn"
                                onClick={() => handleDiscussionTutorStepChange(stepIdx, tutorIdx, 'script', '')}
                              >
                                <i className="ri-add-line" />
                                Add Script
                              </button>
                            )}
                            {(tutorStep.tip === null || tutorStep.tip === undefined) && (
                              <button 
                                className="csve-add-tip-btn"
                                onClick={() => handleDiscussionTutorStepChange(stepIdx, tutorIdx, 'tip', '')}
                              >
                                <i className="ri-add-line" />
                                Add Tip
                              </button>
                            )}
                          </div>
                          
                          {(step.discussionPart!.tutorSteps?.length || 0) > 1 && (
                            <button 
                              className="csve-guide-step-remove"
                              onClick={() => handleRemoveDiscussionTutorStep(stepIdx, tutorIdx)}
                            >
                              <i className="ri-delete-bin-line" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <button 
                      className="csve-add-guide-step-btn"
                      onClick={() => handleAddDiscussionTutorStep(stepIdx)}
                    >
                      <i className="ri-add-line" />
                      Add Tutor Step
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : null}

          {/* PART III - Pronunciation (separate layout for alignment) */}
          {step.pronunciationPart ? (
            <div className="csve-learn-layout csve-part-layout">
              {/* Left Column - Pronunciation Content */}
              <div className="csve-learn-left">
                <div className="csve-pronunciation-part">
                  <div className="csve-part-header">
                    <span className="csve-part-label">Part {step.discussionPart ? 'III' : 'II'} - Pronunciation</span>
                    <button className="csve-remove-part-btn" onClick={() => handleRemovePronunciationPart(stepIdx)}>
                      <i className="ri-close-line" /> Remove
                    </button>
                  </div>
                  
                  {/* Instruction - numeral is computed dynamically */}
                  <div className="csve-pronunciation-instruction">
                    <span className="csve-pronunciation-numeral">{step.discussionPart ? 'III' : 'II'}.</span>
                    <input
                      type="text"
                      className="csve-pronunciation-instr-input"
                      value={step.pronunciationPart.instruction}
                      onChange={e => updateStep(stepIdx, {
                        pronunciationPart: { ...step.pronunciationPart!, instruction: (e.target as HTMLInputElement).value }
                      })}
                      placeholder="Practice reading the words."
                    />
                    <input
                      type="text"
                      className="csve-pronunciation-instr-trans"
                      value={step.pronunciationPart.instructionTranslation}
                      onChange={e => updateStep(stepIdx, {
                        pronunciationPart: { ...step.pronunciationPart!, instructionTranslation: (e.target as HTMLInputElement).value }
                      })}
                      placeholder="単語を読む練習をしましょう。"
                    />
                  </div>

                  {/* Two Column Layout */}
                  <div className="csve-pronunciation-columns">
                    {/* Left Column */}
                    <div className="csve-pronunciation-column">
                      <input
                        type="text"
                        className="csve-pronunciation-sound"
                        value={step.pronunciationPart.leftColumn.soundSymbol}
                        onChange={e => handlePronunciationChange(stepIdx, 'leftColumn', 'soundSymbol', (e.target as HTMLInputElement).value)}
                        placeholder="/d/"
                      />
                      <div className="csve-pronunciation-images">
                        {step.pronunciationPart.leftColumn.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="csve-pronunciation-img-slot">
                            {img ? (
                              <img src={img} alt="mouth position" />
                            ) : (
                              <div className="csve-image-placeholder csve-pronunciation-placeholder">
                                <span className="csve-placeholder-dims">120 × 90</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="csve-pronunciation-words">
                        {step.pronunciationPart.leftColumn.words.map((word, wordIdx) => (
                          <div key={wordIdx} className="csve-pronunciation-word-row">
                            <input
                              type="checkbox"
                              checked={word.isHighlighted || false}
                              onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'isHighlighted', (e.target as HTMLInputElement).checked)}
                            />
                            <div className="csve-pronunciation-word-content">
                              <input
                                type="text"
                                className={`csve-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}
                                value={word.word}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'word', (e.target as HTMLInputElement).value)}
                                placeholder="word"
                              />
                              <input
                                type="text"
                                className="csve-pronunciation-trans"
                                value={word.translation}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'leftColumn', wordIdx, 'translation', (e.target as HTMLInputElement).value)}
                                placeholder="翻訳"
                              />
                            </div>
                            {step.pronunciationPart!.leftColumn.words.length > 1 && (
                              <button 
                                className="csve-pronunciation-word-remove"
                                onClick={() => handleRemovePronunciationWord(stepIdx, 'leftColumn', wordIdx)}
                              >
                                <i className="ri-close-line" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button className="csve-add-pronunciation-word" onClick={() => handleAddPronunciationWord(stepIdx, 'leftColumn')}>
                          <i className="ri-add-line" /> Add Word
                        </button>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="csve-pronunciation-column">
                      <input
                        type="text"
                        className="csve-pronunciation-sound"
                        value={step.pronunciationPart.rightColumn.soundSymbol}
                        onChange={e => handlePronunciationChange(stepIdx, 'rightColumn', 'soundSymbol', (e.target as HTMLInputElement).value)}
                        placeholder="/dʒ/"
                      />
                      <div className="csve-pronunciation-images">
                        {step.pronunciationPart.rightColumn.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="csve-pronunciation-img-slot">
                            {img ? (
                              <img src={img} alt="mouth position" />
                            ) : (
                              <div className="csve-image-placeholder csve-pronunciation-placeholder">
                                <span className="csve-placeholder-dims">120 × 90</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="csve-pronunciation-words">
                        {step.pronunciationPart.rightColumn.words.map((word, wordIdx) => (
                          <div key={wordIdx} className="csve-pronunciation-word-row">
                            <input
                              type="checkbox"
                              checked={word.isHighlighted || false}
                              onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'isHighlighted', (e.target as HTMLInputElement).checked)}
                            />
                            <div className="csve-pronunciation-word-content">
                              <input
                                type="text"
                                className={`csve-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}
                                value={word.word}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'word', (e.target as HTMLInputElement).value)}
                                placeholder="word"
                              />
                              <input
                                type="text"
                                className="csve-pronunciation-trans"
                                value={word.translation}
                                onChange={e => handlePronunciationWordChange(stepIdx, 'rightColumn', wordIdx, 'translation', (e.target as HTMLInputElement).value)}
                                placeholder="翻訳"
                              />
                            </div>
                            {step.pronunciationPart!.rightColumn.words.length > 1 && (
                              <button 
                                className="csve-pronunciation-word-remove"
                                onClick={() => handleRemovePronunciationWord(stepIdx, 'rightColumn', wordIdx)}
                              >
                                <i className="ri-close-line" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button className="csve-add-pronunciation-word" onClick={() => handleAddPronunciationWord(stepIdx, 'rightColumn')}>
                          <i className="ri-add-line" /> Add Word
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Pronunciation Tutor Guide */}
              <div className="csve-learn-right">
                {step.pronunciationPart.tutorSteps && (
                <div className="csve-tutor-guide csve-editable-card csve-part-tutor-guide">
                  <div className="csve-guide-header-edit">
                    <span className="csve-guide-title">Part {step.discussionPart ? 'III' : 'II'} - Pronunciation</span>
                  </div>
                  
                  <div className="csve-guide-steps">
                    {step.pronunciationPart.tutorSteps.map((tutorStep, tutorIdx) => (
                      <div key={tutorIdx} className="csve-guide-step csve-guide-step-editable">
                        <span className="csve-guide-number">{tutorIdx + 1}</span>
                        <div className="csve-guide-content">
                          <input
                            type="text"
                            className="csve-guide-instruction-input"
                            value={tutorStep.instruction}
                            onChange={e => handlePronunciationTutorStepChange(stepIdx, tutorIdx, 'instruction', (e.target as HTMLInputElement).value)}
                            placeholder="Instruction..."
                          />
                          
                          {tutorStep.script !== null && tutorStep.script !== undefined && (
                            <div className="csve-guide-script-block">
                              <span className="csve-script-quote">"</span>
                              <input
                                type="text"
                                className="csve-guide-script-input"
                                value={tutorStep.script || ''}
                                onChange={e => handlePronunciationTutorStepChange(stepIdx, tutorIdx, 'script', (e.target as HTMLInputElement).value)}
                                placeholder="Say this..."
                              />
                              <span className="csve-script-quote">"</span>
                              <button 
                                className="csve-remove-extra-btn"
                                onClick={() => handlePronunciationTutorStepChange(stepIdx, tutorIdx, 'script', null)}
                                title="Remove script"
                              >
                                <i className="ri-close-line" />
                              </button>
                            </div>
                          )}
                          
                          {tutorStep.tip !== null && tutorStep.tip !== undefined && (
                            <div className="csve-guide-tip-block">
                              <input
                                type="text"
                                className="csve-guide-tip-input"
                                value={tutorStep.tip || ''}
                                onChange={e => handlePronunciationTutorStepChange(stepIdx, tutorIdx, 'tip', (e.target as HTMLInputElement).value)}
                                placeholder="Add a tip..."
                              />
                              <button 
                                className="csve-remove-extra-btn"
                                onClick={() => handlePronunciationTutorStepChange(stepIdx, tutorIdx, 'tip', null)}
                                title="Remove tip"
                              >
                                <i className="ri-close-line" />
                              </button>
                            </div>
                          )}
                          
                          <div className="csve-guide-add-btns">
                            {(tutorStep.script === null || tutorStep.script === undefined) && (
                              <button 
                                className="csve-add-script-btn"
                                onClick={() => handlePronunciationTutorStepChange(stepIdx, tutorIdx, 'script', '')}
                              >
                                <i className="ri-add-line" />
                                Add Script
                              </button>
                            )}
                            {(tutorStep.tip === null || tutorStep.tip === undefined) && (
                              <button 
                                className="csve-add-tip-btn"
                                onClick={() => handlePronunciationTutorStepChange(stepIdx, tutorIdx, 'tip', '')}
                              >
                                <i className="ri-add-line" />
                                Add Tip
                              </button>
                            )}
                          </div>
                          
                          {(step.pronunciationPart!.tutorSteps?.length || 0) > 1 && (
                            <button 
                              className="csve-guide-step-remove"
                              onClick={() => handleRemovePronunciationTutorStep(stepIdx, tutorIdx)}
                            >
                              <i className="ri-delete-bin-line" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <button 
                      className="csve-add-guide-step-btn"
                      onClick={() => handleAddPronunciationTutorStep(stepIdx)}
                    >
                      <i className="ri-add-line" />
                      Add Tutor Step
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : null}

          {/* Add Part Buttons */}
          <div className="csve-add-parts-row">
            {!step.discussionPart && (
              <button className="csve-add-part-btn" onClick={() => handleAddDiscussionPart(stepIdx)}>
                <i className="ri-add-line" /> Add Part II (Discussion)
              </button>
            )}
            {!step.pronunciationPart && (
              <button className="csve-add-part-btn" onClick={() => handleAddPronunciationPart(stepIdx)}>
                <i className="ri-add-line" /> Add Part {step.discussionPart ? 'III' : 'II'} (Pronunciation)
              </button>
            )}
          </div>
        </div>
      ))}
      
      {/* Hidden file inputs */}
      <input ref={vocabImageInputRef} type="file" accept="image/*" onChange={handleVocabImageUpload} style={{ display: 'none' }} />
      <input ref={exprImageInputRef} type="file" accept="image/*" onChange={handleExprImageUpload} style={{ display: 'none' }} />
      <input ref={discussImageInputRef} type="file" accept="image/*" onChange={handleDiscussImageUpload} style={{ display: 'none' }} />
    </section>
  );
}

// ============================================================================
// STEP B SECTION EDITOR
// ============================================================================

interface StepBSectionEditorProps {
  data: StepBData;
  onChange: (data: StepBData) => void;
}

function StepBSectionEditor({ data, onChange }: StepBSectionEditorProps) {
  const speaker1ImageInputRef = useRef<HTMLInputElement>(null);
  const speaker2ImageInputRef = useRef<HTMLInputElement>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<1 | 2 | null>(null);

  // Switch step type handler
  const handleSwitchStepBType = (newType: StepBType) => {
    if (newType === data.stepType) return;
    
    if (newType === 'speak-your-mind') {
      onChange({
        stepType: 'speak-your-mind',
        speakYourMind: data.speakYourMind || DEFAULT_SPEAK_YOUR_MIND,
        grammarTip: data.grammarTip,
        pronunciation: data.pronunciation
      });
    } else if (newType === 'grammar-tip') {
      onChange({
        stepType: 'grammar-tip',
        speakYourMind: data.speakYourMind,
        grammarTip: data.grammarTip || DEFAULT_GRAMMAR_TIP,
        pronunciation: data.pronunciation
      });
    } else {
      onChange({
        stepType: 'pronunciation',
        speakYourMind: data.speakYourMind,
        grammarTip: data.grammarTip,
        pronunciation: data.pronunciation || DEFAULT_STEPB_PRONUNCIATION
      });
    }
  };

  // Update the speak your mind data
  const updateSpeakYourMind = (updates: Partial<SpeakYourMindData>) => {
    if (!data.speakYourMind) return;
    onChange({
      ...data,
      speakYourMind: { ...data.speakYourMind, ...updates }
    });
  };

  // Update the grammar tip data
  const updateGrammarTip = (updates: Partial<GrammarTipData>) => {
    if (!data.grammarTip) return;
    onChange({
      ...data,
      grammarTip: { ...data.grammarTip, ...updates }
    });
  };

  // Update speaker data
  const updateSpeaker = (speakerNum: 1 | 2, updates: Partial<ConversationSpeaker>) => {
    if (!data.speakYourMind) return;
    const key = speakerNum === 1 ? 'speaker1' : 'speaker2';
    onChange({
      ...data,
      speakYourMind: {
        ...data.speakYourMind,
        [key]: { ...data.speakYourMind[key], ...updates }
      }
    });
  };

  // Tutor step handlers for Speak Your Mind
  const handleTutorStepChange = (idx: number, field: string, value: any) => {
    if (!data.speakYourMind) return;
    const newSteps = [...data.speakYourMind.tutorSteps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    updateSpeakYourMind({ tutorSteps: newSteps });
  };

  const handleAddTutorStep = () => {
    if (!data.speakYourMind) return;
    updateSpeakYourMind({
      tutorSteps: [...data.speakYourMind.tutorSteps, { instruction: '', script: null, tip: null }]
    });
  };

  const handleRemoveTutorStep = (idx: number) => {
    if (!data.speakYourMind) return;
    updateSpeakYourMind({
      tutorSteps: data.speakYourMind.tutorSteps.filter((_, i) => i !== idx)
    });
  };

  // Tutor step handlers for Grammar Tip
  const handleGrammarTutorStepChange = (idx: number, field: string, value: any) => {
    if (!data.grammarTip) return;
    const newSteps = [...data.grammarTip.tutorSteps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    updateGrammarTip({ tutorSteps: newSteps });
  };

  const handleAddGrammarTutorStep = () => {
    if (!data.grammarTip) return;
    updateGrammarTip({
      tutorSteps: [...data.grammarTip.tutorSteps, { instruction: '', script: null, tip: null }]
    });
  };

  const handleRemoveGrammarTutorStep = (idx: number) => {
    if (!data.grammarTip) return;
    updateGrammarTip({
      tutorSteps: data.grammarTip.tutorSteps.filter((_, i) => i !== idx)
    });
  };

  // Grammar explanation handlers
  const handleExplanationChange = (idx: number, field: keyof GrammarExplanation, value: any) => {
    if (!data.grammarTip) return;
    const newExplanations = [...data.grammarTip.explanations];
    newExplanations[idx] = { ...newExplanations[idx], [field]: value };
    updateGrammarTip({ explanations: newExplanations });
  };

  const handleAddExplanation = () => {
    if (!data.grammarTip) return;
    updateGrammarTip({
      explanations: [...data.grammarTip.explanations, { ruleText: '', ruleTranslation: '' }]
    });
  };

  const handleRemoveExplanation = (idx: number) => {
    if (!data.grammarTip) return;
    updateGrammarTip({
      explanations: data.grammarTip.explanations.filter((_, i) => i !== idx)
    });
  };

  // Grammar example handlers
  const handleExampleChange = (explIdx: number, exIdx: number, field: keyof GrammarExample, value: string) => {
    if (!data.grammarTip) return;
    const newExplanations = [...data.grammarTip.explanations];
    const newExamples = [...(newExplanations[explIdx].examples || [])];
    newExamples[exIdx] = { ...newExamples[exIdx], [field]: value };
    newExplanations[explIdx] = { ...newExplanations[explIdx], examples: newExamples };
    updateGrammarTip({ explanations: newExplanations });
  };

  const handleAddExample = (explIdx: number) => {
    if (!data.grammarTip) return;
    const newExplanations = [...data.grammarTip.explanations];
    const currentExamples = newExplanations[explIdx].examples || [];
    newExplanations[explIdx] = {
      ...newExplanations[explIdx],
      examplesTitle: newExplanations[explIdx].examplesTitle || 'EXAMPLES',
      examples: [...currentExamples, { sentence: '', translation: '' }]
    };
    updateGrammarTip({ explanations: newExplanations });
  };

  const handleRemoveExample = (explIdx: number, exIdx: number) => {
    if (!data.grammarTip) return;
    const newExplanations = [...data.grammarTip.explanations];
    const newExamples = (newExplanations[explIdx].examples || []).filter((_, i) => i !== exIdx);
    newExplanations[explIdx] = { 
      ...newExplanations[explIdx], 
      examples: newExamples.length > 0 ? newExamples : undefined,
      examplesTitle: newExamples.length > 0 ? newExplanations[explIdx].examplesTitle : undefined
    };
    updateGrammarTip({ explanations: newExplanations });
  };

  // ========== PRONUNCIATION HANDLERS ==========
  
  // Update the pronunciation data
  const updatePronunciation = (updates: Partial<StepBPronunciationData>) => {
    if (!data.pronunciation) return;
    onChange({
      ...data,
      pronunciation: { ...data.pronunciation, ...updates }
    });
  };

  // Tutor step handlers for Pronunciation
  const handlePronunciationTutorStepChange = (idx: number, field: string, value: any) => {
    if (!data.pronunciation) return;
    const newSteps = [...data.pronunciation.tutorSteps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    updatePronunciation({ tutorSteps: newSteps });
  };

  const handleAddPronunciationTutorStep = () => {
    if (!data.pronunciation) return;
    updatePronunciation({
      tutorSteps: [...data.pronunciation.tutorSteps, { instruction: '', script: null, tip: null }]
    });
  };

  const handleRemovePronunciationTutorStep = (idx: number) => {
    if (!data.pronunciation) return;
    updatePronunciation({
      tutorSteps: data.pronunciation.tutorSteps.filter((_, i) => i !== idx)
    });
  };

  // Pronunciation phrase handlers
  const handlePhraseChange = (idx: number, field: keyof PronunciationPhrase, value: string) => {
    if (!data.pronunciation) return;
    const newPhrases = [...data.pronunciation.phrases];
    newPhrases[idx] = { ...newPhrases[idx], [field]: value };
    updatePronunciation({ phrases: newPhrases });
  };

  const handleAddPhrase = () => {
    if (!data.pronunciation) return;
    updatePronunciation({
      phrases: [...data.pronunciation.phrases, { phrase: '', pronunciationGuide: '', exampleSentence: '' }]
    });
  };

  const handleRemovePhrase = (idx: number) => {
    if (!data.pronunciation) return;
    updatePronunciation({
      phrases: data.pronunciation.phrases.filter((_, i) => i !== idx)
    });
  };

  // Image upload handlers
  const handleSpeakerImageClick = (speakerNum: 1 | 2) => {
    setActiveSpeaker(speakerNum);
    if (speakerNum === 1) {
      speaker1ImageInputRef.current?.click();
    } else {
      speaker2ImageInputRef.current?.click();
    }
  };

  const handleSpeakerImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeSpeaker) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateSpeaker(activeSpeaker, { image: reader.result as string });
    };
    reader.readAsDataURL(file);
    (e.target as HTMLInputElement).value = '';
  };

  // Get current tutor steps based on type
  const getCurrentTutorSteps = () => {
    if (data.stepType === 'speak-your-mind' && data.speakYourMind) {
      return data.speakYourMind.tutorSteps;
    }
    if (data.stepType === 'grammar-tip' && data.grammarTip) {
      return data.grammarTip.tutorSteps;
    }
    if (data.stepType === 'pronunciation' && data.pronunciation) {
      return data.pronunciation.tutorSteps;
    }
    return [];
  };

  const getCurrentStepName = () => {
    if (data.stepType === 'speak-your-mind' && data.speakYourMind) {
      return data.speakYourMind.stepName;
    }
    if (data.stepType === 'grammar-tip' && data.grammarTip) {
      return data.grammarTip.stepName;
    }
    if (data.stepType === 'pronunciation' && data.pronunciation) {
      return data.pronunciation.stepName;
    }
    return 'STEP B';
  };

  const getCurrentDuration = () => {
    if (data.stepType === 'speak-your-mind' && data.speakYourMind) {
      return data.speakYourMind.duration;
    }
    if (data.stepType === 'grammar-tip' && data.grammarTip) {
      return data.grammarTip.duration;
    }
    if (data.stepType === 'pronunciation' && data.pronunciation) {
      return data.pronunciation.duration;
    }
    return '1 minute';
  };

  const setCurrentDuration = (duration: string) => {
    if (data.stepType === 'speak-your-mind') {
      updateSpeakYourMind({ duration });
    } else if (data.stepType === 'grammar-tip') {
      updateGrammarTip({ duration });
    } else if (data.stepType === 'pronunciation') {
      updatePronunciation({ duration });
    }
  };

  const tutorSteps = getCurrentTutorSteps();
  const handleCurrentTutorStepChange = 
    data.stepType === 'speak-your-mind' ? handleTutorStepChange : 
    data.stepType === 'grammar-tip' ? handleGrammarTutorStepChange :
    handlePronunciationTutorStepChange;
  const handleCurrentAddTutorStep = 
    data.stepType === 'speak-your-mind' ? handleAddTutorStep : 
    data.stepType === 'grammar-tip' ? handleAddGrammarTutorStep :
    handleAddPronunciationTutorStep;
  const handleCurrentRemoveTutorStep = 
    data.stepType === 'speak-your-mind' ? handleRemoveTutorStep : 
    data.stepType === 'grammar-tip' ? handleRemoveGrammarTutorStep :
    handleRemovePronunciationTutorStep;

  return (
    <section className="csve-section csve-stepb-section">
      {/* Step Type Switcher */}
      <div className="csve-step-type-switcher">
        <span className="csve-switcher-label">Step B Type:</span>
        <div className="csve-switcher-buttons">
          <button
            className={`csve-switcher-btn ${data.stepType === 'speak-your-mind' ? 'active' : ''}`}
            onClick={() => handleSwitchStepBType('speak-your-mind')}
          >
            <i className="ri-chat-smile-2-line" />
            Speak Your Mind
          </button>
          <button
            className={`csve-switcher-btn ${data.stepType === 'grammar-tip' ? 'active' : ''}`}
            onClick={() => handleSwitchStepBType('grammar-tip')}
          >
            <i className="ri-lightbulb-line" />
            Grammar Tip
          </button>
          <button
            className={`csve-switcher-btn ${data.stepType === 'pronunciation' ? 'active' : ''}`}
            onClick={() => handleSwitchStepBType('pronunciation')}
          >
            <i className="ri-speak-line" />
            Pronunciation
          </button>
        </div>
      </div>

      <div className="csve-stepb-content">
        {/* Left Column - Content */}
        <div className="csve-stepb-left">
          {/* SPEAK YOUR MIND CONTENT */}
          {data.stepType === 'speak-your-mind' && data.speakYourMind && (
            <>
              {/* Step Name Header */}
              <input
                type="text"
                className="csve-stepb-name"
                value={data.speakYourMind.stepName}
                onChange={e => updateSpeakYourMind({ stepName: (e.target as HTMLInputElement).value })}
                placeholder="STEP B SPEAK YOUR MIND"
              />

              {/* Explanation */}
              <input
                type="text"
                className="csve-stepb-explanation"
                value={data.speakYourMind.explanation}
                onChange={e => updateSpeakYourMind({ explanation: (e.target as HTMLInputElement).value })}
                placeholder="Enter the grammar/phrase explanation..."
              />

              {/* Conversation */}
              <div className="csve-conversation">
                {/* Speaker 1 - Left side (asks question) */}
                <div className="csve-conversation-row csve-speaker-left">
                  <div 
                    className="csve-speaker-image"
                    onClick={() => handleSpeakerImageClick(1)}
                  >
                    {data.speakYourMind.speaker1.image ? (
                      <img src={data.speakYourMind.speaker1.image} alt="Speaker 1" />
                    ) : (
                      <div className="csve-image-placeholder csve-speaker-placeholder">
                        <span className="csve-placeholder-dims">150 × 150</span>
                        <span className="csve-placeholder-text">Click to add</span>
                      </div>
                    )}
                  </div>
                  <div className="csve-speech-bubble csve-speech-left">
                    <RichTextInput
                      value={data.speakYourMind.speaker1.speechBubble}
                      onChange={html => updateSpeaker(1, { speechBubble: html })}
                      placeholder="Enter the question/prompt..."
                      className="csve-speech-input"
                      singleLine={false}
                    />
                  </div>
                </div>

                {/* Speaker 2 - Right side (gives response with grammar phrase) */}
                <div className="csve-conversation-row csve-speaker-right">
                  <div className="csve-speech-bubble csve-speech-right">
                    <RichTextInput
                      value={data.speakYourMind.speaker2.speechBubble}
                      onChange={html => updateSpeaker(2, { speechBubble: html })}
                      placeholder="Enter the response (use Ctrl+B to bold the key phrase)..."
                      className="csve-speech-input"
                      singleLine={false}
                    />
                  </div>
                  <div 
                    className="csve-speaker-image"
                    onClick={() => handleSpeakerImageClick(2)}
                  >
                    {data.speakYourMind.speaker2.image ? (
                      <img src={data.speakYourMind.speaker2.image} alt="Speaker 2" />
                    ) : (
                      <div className="csve-image-placeholder csve-speaker-placeholder">
                        <span className="csve-placeholder-dims">150 × 150</span>
                        <span className="csve-placeholder-text">Click to add</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Question */}
              <div className="csve-stepb-question-section">
                <span className="csve-question-bullet">•</span>
                <input
                  type="text"
                  className="csve-stepb-question"
                  value={data.speakYourMind.question}
                  onChange={e => updateSpeakYourMind({ question: (e.target as HTMLInputElement).value })}
                  placeholder="Enter the question for the student..."
                />
              </div>
            </>
          )}

          {/* GRAMMAR TIP CONTENT */}
          {data.stepType === 'grammar-tip' && data.grammarTip && (
            <>
              {/* Step Name Header */}
              <input
                type="text"
                className="csve-stepb-name"
                value={data.grammarTip.stepName}
                onChange={e => updateGrammarTip({ stepName: (e.target as HTMLInputElement).value })}
                placeholder="STEP B GRAMMAR TIP"
              />

              {/* Grammar Explanations */}
              <div className="csve-grammar-explanations">
                {data.grammarTip.explanations.map((expl, explIdx) => (
                  <div key={explIdx} className="csve-grammar-block">
                    {/* Rule text - Rich text for bold/italic */}
                    <div className="csve-grammar-rule">
                      <RichTextInput
                        value={expl.ruleText}
                        onChange={html => handleExplanationChange(explIdx, 'ruleText', html)}
                        placeholder="Enter grammar rule (use Ctrl+B for bold, Ctrl+I for italic)..."
                        className="csve-grammar-rule-input"
                        singleLine={false}
                      />
                    </div>
                    
                    {/* Rule translation */}
                    <input
                      type="text"
                      className="csve-grammar-translation"
                      value={expl.ruleTranslation}
                      onChange={e => handleExplanationChange(explIdx, 'ruleTranslation', (e.target as HTMLInputElement).value)}
                      placeholder="Translation..."
                    />

                    {/* Examples Box (optional) */}
                    {expl.examples && expl.examples.length > 0 ? (
                      <div className="csve-grammar-examples-box">
                        <input
                          type="text"
                          className="csve-examples-title"
                          value={expl.examplesTitle || 'EXAMPLES'}
                          onChange={e => handleExplanationChange(explIdx, 'examplesTitle', (e.target as HTMLInputElement).value)}
                          placeholder="EXAMPLES"
                        />
                        <div className="csve-examples-list">
                          {expl.examples.map((ex, exIdx) => (
                            <div key={exIdx} className="csve-example-item">
                              <span className="csve-example-bullet">•</span>
                              <div className="csve-example-content">
                                <RichTextInput
                                  value={ex.sentence}
                                  onChange={html => handleExampleChange(explIdx, exIdx, 'sentence', html)}
                                  placeholder="Example sentence (use Ctrl+B for bold)..."
                                  className="csve-example-sentence"
                                  singleLine={true}
                                />
                                <input
                                  type="text"
                                  className="csve-example-translation"
                                  value={ex.translation}
                                  onChange={e => handleExampleChange(explIdx, exIdx, 'translation', (e.target as HTMLInputElement).value)}
                                  placeholder="Translation..."
                                />
                              </div>
                              {expl.examples!.length > 1 && (
                                <button 
                                  className="csve-example-remove"
                                  onClick={() => handleRemoveExample(explIdx, exIdx)}
                                >
                                  <i className="ri-close-line" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button className="csve-add-example-btn" onClick={() => handleAddExample(explIdx)}>
                          <i className="ri-add-line" /> Add Example
                        </button>
                      </div>
                    ) : (
                      <button className="csve-add-examples-btn" onClick={() => handleAddExample(explIdx)}>
                        <i className="ri-add-line" /> Add Examples Box
                      </button>
                    )}

                    {/* Remove explanation button */}
                    {data.grammarTip!.explanations.length > 1 && (
                      <button 
                        className="csve-remove-explanation-btn"
                        onClick={() => handleRemoveExplanation(explIdx)}
                      >
                        <i className="ri-delete-bin-line" /> Remove Block
                      </button>
                    )}
                  </div>
                ))}

                <button className="csve-add-explanation-btn" onClick={handleAddExplanation}>
                  <i className="ri-add-line" /> Add Grammar Block
                </button>
              </div>
            </>
          )}

          {/* PRONUNCIATION CONTENT */}
          {data.stepType === 'pronunciation' && data.pronunciation && (
            <>
              {/* Step Name Header */}
              <input
                type="text"
                className="csve-stepb-name"
                value={data.pronunciation.stepName}
                onChange={e => updatePronunciation({ stepName: (e.target as HTMLInputElement).value })}
                placeholder="STEP B PRONUNCIATION"
              />

              {/* Pronunciation Tip */}
              <div className="csve-pronunciation-tip">
                <RichTextInput
                  value={data.pronunciation.tip}
                  onChange={html => updatePronunciation({ tip: html })}
                  placeholder="Enter pronunciation tip (e.g., When one word ends with a consonant sound and the next word starts with a vowel sound, they are often linked together.)"
                  className="csve-pronunciation-tip-input"
                  singleLine={false}
                />
              </div>

              {/* Phrases Table */}
              <div className="csve-pronunciation-table">
                <div className="csve-pronunciation-header">
                  <div className="csve-pronunciation-col-phrase">Phrase</div>
                  <div className="csve-pronunciation-col-example">Example</div>
                </div>
                
                {data.pronunciation.phrases.map((phrase, phraseIdx) => (
                  <div key={phraseIdx} className="csve-pronunciation-row">
                    <div className="csve-pronunciation-col-phrase">
                      <input
                        type="text"
                        className="csve-phrase-text"
                        value={phrase.phrase}
                        onChange={e => handlePhraseChange(phraseIdx, 'phrase', (e.target as HTMLInputElement).value)}
                        placeholder="cost a fortune"
                      />
                      <input
                        type="text"
                        className="csve-phrase-guide"
                        value={phrase.pronunciationGuide}
                        onChange={e => handlePhraseChange(phraseIdx, 'pronunciationGuide', (e.target as HTMLInputElement).value)}
                        placeholder="/ cos-ta fortune /"
                      />
                    </div>
                    <div className="csve-pronunciation-col-example">
                      <RichTextInput
                        value={phrase.exampleSentence}
                        onChange={html => handlePhraseChange(phraseIdx, 'exampleSentence', html)}
                        placeholder="That vacation must have cost a fortune!"
                        className="csve-phrase-example"
                        singleLine={true}
                      />
                      {data.pronunciation!.phrases.length > 1 && (
                        <button 
                          className="csve-phrase-remove"
                          onClick={() => handleRemovePhrase(phraseIdx)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                <button className="csve-add-phrase-btn" onClick={handleAddPhrase}>
                  <i className="ri-add-line" /> Add Phrase
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csve-stepb-right">
          <div className="csve-tutor-guide csve-editable-card">
            <div className="csve-guide-header-edit">
              <span className="csve-guide-title">PRESENT</span>
              <span className="csve-guide-duration-wrap">
                {getCurrentStepName().split(' ').slice(0, 2).join(' ')} (<input
                  type="text"
                  className="csve-duration-input"
                  value={getCurrentDuration()}
                  onChange={e => setCurrentDuration((e.target as HTMLInputElement).value)}
                  placeholder="1 minute"
                />)
              </span>
            </div>
            
            <div className="csve-guide-steps">
              {tutorSteps.map((tutorStep, tutorIdx) => (
                <div key={tutorIdx} className="csve-guide-step csve-guide-step-editable">
                  <span className="csve-guide-number">{tutorIdx + 1}</span>
                  <div className="csve-guide-content">
                    <input
                      type="text"
                      className="csve-guide-instruction-input"
                      value={tutorStep.instruction}
                      onChange={e => handleCurrentTutorStepChange(tutorIdx, 'instruction', (e.target as HTMLInputElement).value)}
                      placeholder="Instruction..."
                    />
                    
                    {tutorStep.script !== null && tutorStep.script !== undefined && (
                      <div className="csve-guide-script-block">
                        <span className="csve-script-quote">"</span>
                        <input
                          type="text"
                          className="csve-guide-script-input"
                          value={tutorStep.script || ''}
                          onChange={e => handleCurrentTutorStepChange(tutorIdx, 'script', (e.target as HTMLInputElement).value)}
                          placeholder="Say this..."
                        />
                        <span className="csve-script-quote">"</span>
                        <button 
                          className="csve-remove-extra-btn"
                          onClick={() => handleCurrentTutorStepChange(tutorIdx, 'script', null)}
                          title="Remove script"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    )}
                    
                    {tutorStep.tip !== null && tutorStep.tip !== undefined && (
                      <div className="csve-guide-tip-block">
                        <input
                          type="text"
                          className="csve-guide-tip-input"
                          value={tutorStep.tip || ''}
                          onChange={e => handleCurrentTutorStepChange(tutorIdx, 'tip', (e.target as HTMLInputElement).value)}
                          placeholder="Add a tip..."
                        />
                        <button 
                          className="csve-remove-extra-btn"
                          onClick={() => handleCurrentTutorStepChange(tutorIdx, 'tip', null)}
                          title="Remove tip"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    )}
                    
                    <div className="csve-guide-add-btns">
                      {(tutorStep.script === null || tutorStep.script === undefined) && (
                        <button 
                          className="csve-add-script-btn"
                          onClick={() => handleCurrentTutorStepChange(tutorIdx, 'script', '')}
                        >
                          <i className="ri-add-line" />
                          Add Script
                        </button>
                      )}
                      {(tutorStep.tip === null || tutorStep.tip === undefined) && (
                        <button 
                          className="csve-add-tip-btn"
                          onClick={() => handleCurrentTutorStepChange(tutorIdx, 'tip', '')}
                        >
                          <i className="ri-add-line" />
                          Add Tip
                        </button>
                      )}
                    </div>
                    
                    {tutorSteps.length > 1 && (
                      <button 
                        className="csve-guide-step-remove"
                        onClick={() => handleCurrentRemoveTutorStep(tutorIdx)}
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <button 
                className="csve-add-guide-step-btn"
                onClick={handleCurrentAddTutorStep}
              >
                <i className="ri-add-line" />
                Add Tutor Step
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={speaker1ImageInputRef} type="file" accept="image/*" onChange={handleSpeakerImageUpload} style={{ display: 'none' }} />
      <input ref={speaker2ImageInputRef} type="file" accept="image/*" onChange={handleSpeakerImageUpload} style={{ display: 'none' }} />
    </section>
  );
}

// ============================================================================
// APPLY SECTION EDITOR (Section 3 - Speaking/Understanding)
// ============================================================================

interface ApplySectionEditorProps {
  data: ApplySectionData;
  onChange: (data: ApplySectionData) => void;
}

function ApplySectionEditor({ data, onChange }: ApplySectionEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Update main data
  const updateData = (updates: Partial<ApplySectionData>) => {
    onChange({ ...data, ...updates });
  };

  // Switch activity type handler
  const handleSwitchActivityType = (newType: ApplyActivityType) => {
    if (newType === data.activityType) return;
    
    if (newType === 'speaking') {
      onChange({
        ...DEFAULT_APPLY_SPEAKING,
        sectionNumber: data.sectionNumber,
        sectionTitle: data.sectionTitle,
        situationImage: data.situationImage,
      });
    } else {
      onChange({
        ...DEFAULT_APPLY_LISTENING,
        sectionNumber: data.sectionNumber,
        sectionTitle: data.sectionTitle,
        situationImage: data.situationImage,
      });
    }
  };

  // Listening script handler
  const handleListeningScriptChange = (stepIndex: number, value: string) => {
    const newSteps = [...data.tutorSteps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], listeningScript: value };
    updateData({ tutorSteps: newSteps });
  };

  const handleAddListeningScript = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], listeningScript: "" };
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveListeningScript = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], listeningScript: undefined };
    updateData({ tutorSteps: newSteps });
  };

  // Dialogue line handlers
  const handleDialogueChange = (index: number, field: keyof DialogueLine, value: string | boolean) => {
    const newLines = [...data.dialogueLines];
    newLines[index] = { ...newLines[index], [field]: value };
    updateData({ dialogueLines: newLines });
  };

  const handleAddDialogueLine = () => {
    const lastSpeaker = data.dialogueLines.length > 0 
      ? data.dialogueLines[data.dialogueLines.length - 1].speaker 
      : "Speaker";
    updateData({
      dialogueLines: [...data.dialogueLines, { speaker: lastSpeaker, text: "" }]
    });
  };

  const handleRemoveDialogueLine = (index: number) => {
    updateData({
      dialogueLines: data.dialogueLines.filter((_, i) => i !== index)
    });
  };

  // Tutor step handlers
  const handleTutorStepChange = (index: number, field: keyof ApplyTutorStep, value: any) => {
    const newSteps = [...data.tutorSteps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    updateData({ tutorSteps: newSteps });
  };

  const handleAddTutorStep = () => {
    updateData({
      tutorSteps: [...data.tutorSteps, { instruction: "" }]
    });
  };

  const handleRemoveTutorStep = (index: number) => {
    updateData({
      tutorSteps: data.tutorSteps.filter((_, i) => i !== index)
    });
  };

  // Script bullet handlers
  const handleAddScript = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const currentScripts = newSteps[stepIndex].scripts || [];
    newSteps[stepIndex] = { ...newSteps[stepIndex], scripts: [...currentScripts, { text: "" }] };
    updateData({ tutorSteps: newSteps });
  };

  const handleScriptChange = (stepIndex: number, scriptIndex: number, value: string) => {
    const newSteps = [...data.tutorSteps];
    const scripts = [...(newSteps[stepIndex].scripts || [])];
    scripts[scriptIndex] = { text: value };
    newSteps[stepIndex] = { ...newSteps[stepIndex], scripts };
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveScript = (stepIndex: number, scriptIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const scripts = (newSteps[stepIndex].scripts || []).filter((_, i) => i !== scriptIndex);
    newSteps[stepIndex] = { ...newSteps[stepIndex], scripts: scripts.length > 0 ? scripts : undefined };
    updateData({ tutorSteps: newSteps });
  };

  // Tip handlers
  const handleAddTip = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const currentTips = newSteps[stepIndex].tips || [];
    newSteps[stepIndex] = { ...newSteps[stepIndex], tips: [...currentTips, { text: "" }] };
    updateData({ tutorSteps: newSteps });
  };

  const handleTipChange = (stepIndex: number, tipIndex: number, value: string) => {
    const newSteps = [...data.tutorSteps];
    const tips = [...(newSteps[stepIndex].tips || [])];
    tips[tipIndex] = { text: value };
    newSteps[stepIndex] = { ...newSteps[stepIndex], tips };
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveTip = (stepIndex: number, tipIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const tips = (newSteps[stepIndex].tips || []).filter((_, i) => i !== tipIndex);
    newSteps[stepIndex] = { ...newSteps[stepIndex], tips: tips.length > 0 ? tips : undefined };
    updateData({ tutorSteps: newSteps });
  };

  // Question handlers
  const handleAddQuestion = (stepIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const currentQuestions = newSteps[stepIndex].questions || [];
    newSteps[stepIndex] = { ...newSteps[stepIndex], questions: [...currentQuestions, { question: "", answer: "" }] };
    updateData({ tutorSteps: newSteps });
  };

  const handleQuestionChange = (stepIndex: number, qIndex: number, field: 'question' | 'answer', value: string) => {
    const newSteps = [...data.tutorSteps];
    const questions = [...(newSteps[stepIndex].questions || [])];
    questions[qIndex] = { ...questions[qIndex], [field]: value };
    newSteps[stepIndex] = { ...newSteps[stepIndex], questions };
    updateData({ tutorSteps: newSteps });
  };

  const handleRemoveQuestion = (stepIndex: number, qIndex: number) => {
    const newSteps = [...data.tutorSteps];
    const questions = (newSteps[stepIndex].questions || []).filter((_, i) => i !== qIndex);
    newSteps[stepIndex] = { ...newSteps[stepIndex], questions: questions.length > 0 ? questions : undefined };
    updateData({ tutorSteps: newSteps });
  };

  // Image upload handler
  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateData({ situationImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="csve-section csve-apply-section">
      {/* Section Header - matches Section 2 */}
      <div className="csve-section-number">
        <span className="csve-number-badge">{data.sectionNumber}</span>
        <h2 className="csve-section-title">{data.sectionTitle}</h2>
        <div className="csve-section-line" />
      </div>

      {/* Activity Type Switcher */}
      <div className="csve-step-type-switcher">
        <span className="csve-switcher-label">Activity Type:</span>
        <div className="csve-switcher-buttons">
          <button
            className={`csve-switcher-btn ${data.activityType === 'speaking' ? 'active' : ''}`}
            onClick={() => handleSwitchActivityType('speaking')}
          >
            <i className="ri-speak-line" />
            Speaking
          </button>
          <button
            className={`csve-switcher-btn ${data.activityType === 'listening' ? 'active' : ''}`}
            onClick={() => handleSwitchActivityType('listening')}
          >
            <i className="ri-headphone-line" />
            Listening
          </button>
        </div>
      </div>

      {/* Activity Title */}
      <h3 className="csve-step-name">{data.activityTitle}</h3>

      <div className="csve-apply-content">
        {/* Left Column - Main Content */}
        <div className="csve-apply-left">
          {/* Situation Text */}
          <input
            type="text"
            className="csve-apply-situation"
            value={data.situationText}
            onChange={e => updateData({ situationText: (e.target as HTMLInputElement).value })}
            placeholder="Describe the situation..."
          />

          {/* Situation Image */}
          <div 
            className="csve-apply-image"
            onClick={handleImageClick}
          >
            {data.situationImage ? (
              <img src={data.situationImage} alt="Situation" />
            ) : (
              <div className="csve-image-placeholder csve-apply-img-placeholder">
                <span className="csve-placeholder-dims">600 × 300</span>
                <span className="csve-placeholder-text">Click to add image</span>
              </div>
            )}
          </div>

          {/* Dialogue Lines (SPEAKING only) */}
          {data.activityType === 'speaking' && (
          <div className="csve-dialogue-lines">
            {data.dialogueLines.map((line, lineIdx) => (
              <div key={lineIdx} className="csve-dialogue-line">
                <input
                  type="text"
                  className="csve-dialogue-speaker"
                  value={line.speaker}
                  onChange={e => handleDialogueChange(lineIdx, 'speaker', (e.target as HTMLInputElement).value)}
                  placeholder="Speaker"
                />
                <span className="csve-dialogue-colon">:</span>
                {line.isAction ? (
                  <input
                    type="text"
                    className="csve-dialogue-text csve-dialogue-action"
                    value={line.text}
                    onChange={e => handleDialogueChange(lineIdx, 'text', (e.target as HTMLInputElement).value)}
                    placeholder="(action)"
                  />
                ) : (
                  <RichTextInput
                    value={line.text}
                    onChange={html => handleDialogueChange(lineIdx, 'text', html)}
                    placeholder="Dialogue text (Ctrl+U for underline)..."
                    className="csve-dialogue-text"
                    singleLine={false}
                  />
                )}
                <label className="csve-dialogue-action-toggle">
                  <input
                    type="checkbox"
                    checked={line.isAction || false}
                    onChange={e => handleDialogueChange(lineIdx, 'isAction', (e.target as HTMLInputElement).checked)}
                  />
                  <span>Action</span>
                </label>
                {data.dialogueLines.length > 1 && (
                  <button 
                    className="csve-dialogue-remove"
                    onClick={() => handleRemoveDialogueLine(lineIdx)}
                  >
                    <i className="ri-close-line" />
                  </button>
                )}
              </div>
            ))}
            <button className="csve-add-dialogue-btn" onClick={handleAddDialogueLine}>
              <i className="ri-add-line" /> Add Dialogue Line
            </button>
          </div>
          )}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csve-apply-right">
          <div className="csve-tutor-guide csve-editable-card">
            <div className="csve-guide-header-edit">
              <span className="csve-guide-title">{data.sectionTitle} - {data.activityTitle}</span>
              <span className="csve-guide-duration-wrap">
                (<input
                  type="text"
                  className="csve-duration-input"
                  value={data.activityDuration}
                  onChange={e => updateData({ activityDuration: (e.target as HTMLInputElement).value })}
                  placeholder="3 minutes"
                />)
              </span>
            </div>

            <div className="csve-guide-steps">
              {data.tutorSteps.map((step, stepIdx) => (
                <div key={stepIdx} className="csve-guide-step csve-guide-step-editable csve-apply-step">
                  <span className="csve-guide-number">{stepIdx + 1}</span>
                  <div className="csve-guide-content">
                    {/* Instruction */}
                    <input
                      type="text"
                      className="csve-guide-instruction-input"
                      value={step.instruction}
                      onChange={e => handleTutorStepChange(stepIdx, 'instruction', (e.target as HTMLInputElement).value)}
                      placeholder="Instruction..."
                    />

                    {/* Scripts (green bullets) */}
                    {step.scripts && step.scripts.map((script, scriptIdx) => (
                      <div key={scriptIdx} className="csve-apply-script-item">
                        <span className="csve-script-bullet">●</span>
                        <input
                          type="text"
                          className="csve-apply-script-input"
                          value={script.text}
                          onChange={e => handleScriptChange(stepIdx, scriptIdx, (e.target as HTMLInputElement).value)}
                          placeholder="Script text..."
                        />
                        <button 
                          className="csve-remove-extra-btn"
                          onClick={() => handleRemoveScript(stepIdx, scriptIdx)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}

                    {/* Tips (red text) */}
                    {step.tips && step.tips.map((tip, tipIdx) => (
                      <div key={tipIdx} className="csve-apply-tip-item">
                        <span className="csve-tip-icon">◆</span>
                        <input
                          type="text"
                          className="csve-apply-tip-input"
                          value={tip.text}
                          onChange={e => handleTipChange(stepIdx, tipIdx, (e.target as HTMLInputElement).value)}
                          placeholder="Tip text..."
                        />
                        <button 
                          className="csve-remove-extra-btn"
                          onClick={() => handleRemoveTip(stepIdx, tipIdx)}
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}

                    {/* Questions box */}
                    {step.questions && step.questions.length > 0 && (
                      <div className="csve-apply-questions-box">
                        {step.questions.map((q, qIdx) => (
                          <div key={qIdx} className="csve-apply-question-item">
                            <span className="csve-question-bullet">•</span>
                            <div className="csve-question-content">
                              <input
                                type="text"
                                className="csve-question-input"
                                value={q.question}
                                onChange={e => handleQuestionChange(stepIdx, qIdx, 'question', (e.target as HTMLInputElement).value)}
                                placeholder="Question..."
                              />
                              <input
                                type="text"
                                className="csve-answer-input"
                                value={q.answer || ''}
                                onChange={e => handleQuestionChange(stepIdx, qIdx, 'answer', (e.target as HTMLInputElement).value)}
                                placeholder="Answer hint..."
                              />
                            </div>
                            <button 
                              className="csve-remove-extra-btn"
                              onClick={() => handleRemoveQuestion(stepIdx, qIdx)}
                            >
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Listening Script (LISTENING only - green box) */}
                    {step.listeningScript !== undefined && (
                      <div className="csve-listening-script-box">
                        <div className="csve-listening-script-header">
                          <span>Listening Script</span>
                          <button 
                            className="csve-remove-extra-btn"
                            onClick={() => handleRemoveListeningScript(stepIdx)}
                          >
                            <i className="ri-close-line" />
                          </button>
                        </div>
                        <RichTextInput
                          value={step.listeningScript}
                          onChange={html => handleListeningScriptChange(stepIdx, html)}
                          placeholder="Enter the listening script... (Ctrl+U for underline, Ctrl+I for italic)"
                          className="csve-listening-script-input"
                          singleLine={false}
                        />
                      </div>
                    )}

                    {/* Add buttons */}
                    <div className="csve-step-add-buttons">
                      <button 
                        className="csve-add-script-btn"
                        onClick={() => handleAddScript(stepIdx)}
                      >
                        <i className="ri-add-line" /> Script
                      </button>
                      <button 
                        className="csve-add-tip-btn"
                        onClick={() => handleAddTip(stepIdx)}
                      >
                        <i className="ri-add-line" /> Tip
                      </button>
                      <button 
                        className="csve-add-question-btn"
                        onClick={() => handleAddQuestion(stepIdx)}
                      >
                        <i className="ri-add-line" /> Question
                      </button>
                      {data.activityType === 'listening' && step.listeningScript === undefined && (
                        <button 
                          className="csve-add-listening-script-btn"
                          onClick={() => handleAddListeningScript(stepIdx)}
                        >
                          <i className="ri-file-text-line" /> Listening Script
                        </button>
                      )}
                    </div>
                  </div>

                  {data.tutorSteps.length > 1 && (
                    <button 
                      className="csve-guide-step-remove"
                      onClick={() => handleRemoveTutorStep(stepIdx)}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  )}
                </div>
              ))}

              <button 
                className="csve-add-guide-step-btn"
                onClick={handleAddTutorStep}
              >
                <i className="ri-add-line" /> Add Tutor Step
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
    </section>
  );
}