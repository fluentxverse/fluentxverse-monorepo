/**
 * ConversationalSkillsLessonPage
 * Full-page standalone renderer for Conversational Skills lessons
 * Matches the rarejob.com.ph lesson material design
 */
import { useState, useEffect } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import { lessonApi } from '../api/lesson.api';
import './ConversationalSkillsLessonPage.css';

// ============================================================================
// SHARED TYPES (same as Visual Editor)
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

// Default introduction data (fallback if no data saved)
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
// LEARN SECTION TYPES (Section 2 - Vocabulary/Expressions)
// ============================================================================

type StepAType = 'vocabulary' | 'expressions';

interface VocabularyItem {
  image: string;
  englishText: string;
  highlightedWord?: string; // Word to highlight in green
  translation: string;
}

// ExpressionItem uses rich text (HTML) for formatting
interface ExpressionItem {
  image: string;
  definitionLine: string; // Rich text HTML like "To <strong>cost an arm and a leg</strong> means..."
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
  images: DiscussionImage[]; // Up to 3 images with optional labels
  tutorSteps?: TutorStep[];
}

// Pronunciation Part structure
interface PronunciationWord {
  word: string;
  translation: string;
  isHighlighted?: boolean;
}

interface PronunciationColumn {
  soundSymbol: string;
  images: string[];
  words: PronunciationWord[];
}

interface PronunciationPart {
  instruction: string;
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
  stepType?: StepAType;
  stepName: string;
  duration: string;
  partLabel: string;
  partTranslation?: string;
  vocabularyItems?: VocabularyItem[];
  expressionItems?: ExpressionItem[];
  discussionPart?: DiscussionPart;
  pronunciationPart?: PronunciationPart;
  tutorSteps: TutorStep[];
}

interface LearnSectionData {
  sectionTitle: string;
  steps: LearnStepData[];
}

// ============================================================================
// STEP B SECTION TYPES (Speak Your Mind / Grammar Tip / Pronunciation / Exercise)
// ============================================================================

type StepBType = 'speak-your-mind' | 'grammar-tip' | 'pronunciation' | 'exercise';

interface ConversationSpeaker {
  image: string;
  speechBubble: string; // Rich text HTML
}

interface SpeakYourMindData {
  stepName: string;
  duration: string;
  explanation: string;
  explanationTranslation?: string;
  speaker1: ConversationSpeaker;
  speaker2: ConversationSpeaker;
  question: string;
  tutorSteps: TutorStep[];
}

interface GrammarExample {
  sentence: string;
  translation: string;
}

interface GrammarExplanation {
  ruleText: string;
  ruleTranslation: string;
  examplesTitle?: string;
  examples?: GrammarExample[];
}

interface GrammarTipData {
  stepName: string;
  duration: string;
  explanations: GrammarExplanation[];
  tutorSteps: TutorStep[];
}

interface PronunciationPhrase {
  phrase: string;
  pronunciationGuide: string;
  exampleSentence: string;
}

interface StepBPronunciationData {
  stepName: string;
  duration: string;
  tip: string;
  phrases: PronunciationPhrase[];
  tutorSteps: TutorStep[];
}

interface StepBExerciseConversation {
  speakerImage: string;
  speechBubble: string;
  position: 'left' | 'right';
}

interface StepBExerciseData {
  stepName: string;
  duration: string;
  instruction: string;
  instructionTranslation?: string;
  conversations: StepBExerciseConversation[];
  tutorSteps: TutorStep[];
}

interface StepBData {
  stepType: StepBType;
  speakYourMind?: SpeakYourMindData;
  grammarTip?: GrammarTipData;
  pronunciation?: StepBPronunciationData;
  exercise?: StepBExerciseData;
}

// ============================================================================
// APPLY SECTION TYPES (Section 3 - Speaking/Listening/Reading)
// ============================================================================

type ApplyActivityType = 'speaking' | 'listening' | 'reading';

interface DialogueLine {
  speaker: string;
  text: string;
  isAction?: boolean;
}

interface TutorScriptBullet {
  text: string;
}

interface TutorTipItem {
  text: string;
}

interface TutorQuestion {
  question: string;
  answer?: string;
}

interface ApplyTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  tips?: TutorTipItem[];
  questions?: TutorQuestion[];
  listeningScript?: string; // Rich text HTML for listening script
}

interface TriviaTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  questions?: TutorQuestion[];
}

interface ApplySectionData {
  sectionNumber: number;
  sectionTitle: string;
  activityType: ApplyActivityType;
  activityTitle: string;
  activityDuration: string;
  situationText: string;
  situationImage: string;
  dialogueLines: DialogueLine[];
  readingText?: string; // Rich text HTML for reading passage
  readingImage?: string; // Optional image inside reading card
  readingImageLabel?: string; // Rich text label under reading image
  tutorSteps: ApplyTutorStep[];
  // Trivia Time (optional)
  triviaEnabled?: boolean;
  triviaText?: string;
  triviaTranslation?: string;
  triviaImage?: string;
  triviaDuration?: string;
  triviaTutorSteps?: TriviaTutorStep[];
}

// Exercise Section Types (Section 4)
interface ExerciseItem {
  image: string;
  sentence: string;
}

interface ExerciseAnswer {
  text: string;
}

interface TutorAnswerKeyItem {
  text: string;
}

interface ExerciseTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  tips?: TutorTipItem[];
  answerKey?: TutorAnswerKeyItem[];
}

interface ExerciseConversation {
  speakerImage: string;
  speechBubble: string;
  position: 'left' | 'right';
}

interface ChooseExerciseItem {
  sentence: string;
}

interface ChangeExerciseItem {
  sentence: string;
}

interface InfoBoxColumn {
  header: string;
  rows: string[];
}

interface InfoBoxData {
  title: string;
  rowLabels: string[];
  columns: InfoBoxColumn[];
}

type ExerciseStepAType = 'rephrase' | 'choose' | 'change';

interface ExerciseSectionData {
  sectionNumber: number;
  sectionTitle: string;
  duration: string;
  // Step A type
  stepAType?: ExerciseStepAType;
  // Step A - Common
  stepAName?: string;
  instructions: string;
  instructionsTranslation?: string;
  // Step A - Rephrase type
  showExpressions?: boolean;
  expressions: string[];
  showExample?: boolean;
  exampleSentence: string;
  exampleAnswer: string;
  exerciseItems: ExerciseItem[];
  // Step A - Choose type
  chooseItems?: ChooseExerciseItem[];
  chooseImage?: string;
  // Step A - Change type
  changeItems?: ChangeExerciseItem[];
  changeImage?: string;
  // Step A - Info Box (optional)
  showInfoBox?: boolean;
  infoBox?: InfoBoxData;
  // Common
  answers: ExerciseAnswer[];
  tutorSteps: ExerciseTutorStep[];
  // Step B (optional)
  hasStepB?: boolean;
  stepBType?: 'conversation' | 'multiple-choice' | 'speech';
  stepBName?: string;
  stepBInstruction?: string;
  stepBInstructionTranslation?: string;
  // Step B - Conversation type
  conversations?: ExerciseConversation[];
  // Step B - Multiple Choice type
  multipleChoiceItems?: { boldSentence: string; optionA: string; optionB: string; }[];
  multipleChoiceImage?: string;
  // Step B - Speech type
  speechSpeakerImage?: string;
  speechContent?: string;
  // Step B - Tutor steps
  stepBTutorSteps?: ExerciseTutorStep[];

  exampleImage: any
}

// ============================================================================
// MISSION SECTION TYPES (Section 5)
// ============================================================================

type MissionType = 'speaking' | 'discussion' | 'reading' | 'listening';

interface MissionQuestion {
  question: string;
  hints?: string[];
}

interface MissionTutorStep {
  instruction: string;
  scripts?: { text: string }[];
  tips?: { text: string }[];
  questions?: { question: string; answer?: string }[];
}

interface MissionTopic {
  title: string;
  questions: string[];
}

// Reading passage block (text or image)
interface ReadingBlock {
  type: 'paragraph' | 'images';
  content?: string; // For paragraph
  images?: string[]; // For images (array of URLs)
}

// Reading passage data
interface ReadingPassage {
  title: string;
  showAuthor?: boolean;
  author?: string;
  headerAlignment?: 'left' | 'center' | 'right';
  blocks: ReadingBlock[];
  closingQuestion?: string;
}

interface MissionSectionData {
  sectionNumber: number;
  sectionTitle: string;
  missionType: MissionType;
  challengeNumber: number;
  challengeName: string;
  duration: string;
  situation: string;
  situationTranslation?: string;
  instruction: string;
  instructionTranslation?: string;
  showGrammarTip: boolean;
  grammarTipTitle: string;
  grammarTipItems: string[];
  image?: string;
  tutorSteps: MissionTutorStep[];
  questionsIntro?: string;
  questions: MissionQuestion[];
  isOptional?: boolean;
  topics?: MissionTopic[];
  readingPassage?: ReadingPassage;
  listeningScript?: string;
}

// ============================================================================
// FEEDBACK SECTION TYPES (Section 6)
// ============================================================================

interface FeedbackExample {
  youSaid: string;
  correction: string;
  correctionLabel: string;
}

interface FeedbackCategory {
  id: string;
  title: string;
  titleJp: string;
  focusOn: string;
  exampleFeedbackItems: string[];
  vocabularyExample?: string;
  examples: FeedbackExample[];
}

interface RubricLevel {
  score: number;
  label: string;
  description: string;
}

interface FeedbackTutorStep {
  instruction: string;
  scripts?: { text: string }[];
  tips?: { text: string }[];
}

interface FeedbackSectionData {
  sectionNumber: number;
  sectionTitle: string;
  duration: string;
  goal: string;
  goalJp: string;
  rubricTitle: string;
  rubricLevels: RubricLevel[];
  personalizedFeedbackTitle: string;
  tutorSteps: FeedbackTutorStep[];
  rememberNote: string;
  feedbackGuideTitle: string;
  categories: FeedbackCategory[];
}

// Default LEARN section data
const DEFAULT_LEARN_DATA: LearnSectionData = {
  sectionTitle: "LEARN",
  steps: [
    {
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
    }
  ]
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Lesson Material type for Memgraph data
interface LessonMaterialData {
  id: string;
  course: string;
  level: number;
  chapter: number;
  lessonNumber: number;
  skill: string;
  chapterName: string;
  lessonName: string;
  goalTextEn: string;
  goalTextJp: string;
  backgroundImage?: string;
  overlayColor?: string;
  status: string;
  levelBadge?: string;
  introductionData?: IntroductionData;
  learnData?: LearnSectionData;
  stepBData?: StepBData;
  applyData?: ApplySectionData;
  exerciseData?: ExerciseSectionData;
  missionData?: MissionSectionData;
  missionData2?: MissionSectionData;
  feedbackData?: FeedbackSectionData;
}

export default function ConversationalSkillsLessonPage() {
  const { params, query } = useRoute();
  const { route } = useLocation();
  const [lesson, setLesson] = useState<LessonMaterialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Get lesson ID from params or query string
  const id = params?.id || (query?.id as string);

  useEffect(() => {
    if (id) {
      loadLesson(id);
    } else {
      setError('No lesson ID provided');
      setLoading(false);
    }
  }, [id]);

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      setError('');
      const result = await lessonApi.getPublicLessonMaterial(lessonId);
      if (result.success && result.lesson) {
        setLesson(result.lesson);
      } else {
        setError(result.error || 'Failed to load lesson');
      }
    } catch (err) {
      console.error('Failed to load lesson:', err);
      setError('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (window.opener) {
      window.close();
    } else {
      route('/materials/conversational-skills');
    }
  };

  if (loading) {
    return (
      <div className="csp-fullpage csp-loading">
        <div className="csp-loader">
          <i className="ri-loader-4-line" />
          <p>Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="csp-fullpage csp-error">
        <i className="ri-error-warning-line" />
        <h2>{error || 'Lesson not found'}</h2>
        <button onClick={handleBack}>Back to Materials</button>
      </div>
    );
  }

  // Use saved lesson data directly (no overrides for student view)
  const backgroundImage = lesson.backgroundImage;
  const overlayColor = lesson.overlayColor || '#134e4acc';
  const chapterName = lesson.chapterName;
  const lessonName = lesson.lessonName;
  const goalTextEn = lesson.goalTextEn;
  const goalTextJp = lesson.goalTextJp;
  
  // Introduction data: use saved lesson > default
  const introductionData: IntroductionData = 
    lesson.introductionData ?? 
    DEFAULT_INTRODUCTION_DATA;

  // Learn data: use saved lesson > default
  const learnData: LearnSectionData = 
    lesson.learnData ?? 
    DEFAULT_LEARN_DATA;

  // Step B data: use saved lesson
  const stepBData: StepBData | undefined = lesson.stepBData;

  // Apply data: use saved lesson
  const applyData: ApplySectionData | undefined = lesson.applyData;

  // Exercise data: use saved lesson
  const exerciseData: ExerciseSectionData | undefined = (lesson as any).exerciseData;

  // Mission data: use saved lesson
  const missionData: MissionSectionData | undefined = (lesson as any).missionData;

  // Mission data 2 (Challenge 2 / Discussion): use saved lesson
  const missionData2: MissionSectionData | undefined = (lesson as any).missionData2;

  // Feedback data: use saved lesson
  const feedbackData: FeedbackSectionData | undefined = (lesson as any).feedbackData;

  return (
    <div className="csp-fullpage">
      {/* Top Navigation Bar */}
      <nav className="csp-topbar">
        <div className="csp-topbar-content">
          <span className="csp-course-info">
            Conversational Skills {lesson.levelBadge} | {lesson.skill.toUpperCase()} | Chapter {lesson.chapter}: {chapterName}
          </span>
        </div>
      </nav>

      {/* Hero Header Section */}
      <header
        className="csp-hero"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        }}
      >
        <div className="csp-hero-overlay" style={{ backgroundColor: overlayColor }} />
        <div className="csp-hero-content">
          <p className="csp-lesson-label">Lesson {lesson.lessonNumber}</p>
          <h1 className="csp-lesson-name">{lessonName}</h1>
          
          <div className="csp-goal-wrapper">
            <div className="csp-goal-row">
              <span className="csp-goal-badge">GOAL</span>
              <p className="csp-goal-en">{goalTextEn}</p>
            </div>
            <p className="csp-goal-jp">{goalTextJp}</p>
          </div>
        </div>
      </header>

      {/* Content Sections */}
      <main className="csp-main">
        <div className="csp-sections">
          {/* Introduction Section */}
          <IntroductionSection data={introductionData} />

          {/* Learn/Present Section - Vocabulary/Expressions */}
          <LearnSection data={learnData} />

          {/* Step B Section - Speak Your Mind / Grammar Tip / Pronunciation */}
          {stepBData && <StepBSection data={stepBData} />}

          {/* Apply Section - Speaking/Understanding */}
          {applyData && <ApplySection data={applyData} />}

          {/* Exercise Section */}
          {exerciseData && <ExerciseSection data={exerciseData} />}

          {/* Mission Section (Challenge 1) */}
          {missionData && <MissionSection data={missionData} />}

          {/* Mission Section 2 (Challenge 2 / Discussion) */}
          {missionData2 && <MissionSection data={missionData2} hideHeader />}

          {/* Feedback Section */}
          {feedbackData && <FeedbackSection data={feedbackData} />}
        </div>
      </main>

    </div>
  );
}

// ============================================================================
// INTRODUCTION SECTION COMPONENT
// ============================================================================

interface IntroductionSectionProps {
  data: IntroductionData;
}

function IntroductionSection({ data }: IntroductionSectionProps) {
  return (
    <section className="csp-intro-section">
      <div className="csp-intro-layout">
        {/* Left Column - Main Content */}
        <div className="csp-intro-left">
          {/* FIXED: Section number and title */}
          <div className="csp-section-number">
            <span className="csp-number-badge">1</span>
            <h2 className="csp-section-title">INTRODUCE</h2>
            <div className="csp-section-line" />
          </div>
          
          {/* EDITABLE: Intro texts (supports multiple languages) */}
          {data.introTexts.map((introText, i) => (
            <p key={i} className="csp-intro-text" data-lang={introText.language}>
              {introText.text}
            </p>
          ))}
          
          {/* EDITABLE: Optional intro image */}
          {data.introImage && (
            <div className="csp-intro-image">
              <img src={data.introImage} alt="Introduction visual" />
            </div>
          )}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csp-intro-right">
          <div className="csp-intro-right-sticky">
            {/* EDITABLE & OPTIONAL: Lesson Issue Box - only shown if data exists */}
            {data.lessonIssue && (
              <div className="csp-lesson-issue">
                {/* FIXED: Header structure and badges */}
                <div className="csp-issue-header">
                  <span>THIS LESSON'S ISSUE</span>
                  <div className="csp-issue-badges">
                    <small>For tutors only.</small>
                    <small className="csp-warning">DO NOT SHARE WITH THE STUDENT!</small>
                  </div>
                </div>
                {/* EDITABLE: Title and points */}
                <div className="csp-issue-content">
                  <h3>{data.lessonIssue.title}</h3>
                  <ul>
                    {data.lessonIssue.points.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Lesson Goal Box */}
            <div className="csp-lesson-goal-box">
              {/* FIXED: "LESSON GOAL" label, EDITABLE: duration */}
              <div className="csp-goal-header">LESSON GOAL ({data.lessonGoalDuration})</div>
              {/* EDITABLE: Steps */}
              <div className="csp-goal-steps">
                {data.lessonGoalSteps.map((step, i) => (
                  <div className="csp-goal-step" key={i}>
                    <span className="csp-step-number">{i + 1}</span>
                    <div className="csp-step-content">
                      {/* EDITABLE: Instruction text */}
                      <p className="csp-step-instruction">{step.instruction}</p>
                      {/* EDITABLE & OPTIONAL: Script text */}
                      {step.script && (
                        <p className="csp-step-script">
                          "{step.script}"
                        </p>
                      )}
                      {/* EDITABLE & OPTIONAL: Question/Tip box */}
                      {step.question && (
                        <div className="csp-step-question">
                          {step.question}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// LEARN SECTION COMPONENT (Section 2 - Vocabulary Template)
// ============================================================================

interface LearnSectionProps {
  data: LearnSectionData;
}

function LearnSection({ data }: LearnSectionProps) {
  // Helper to render text with highlighted word (for vocabulary)
  const renderHighlightedText = (text: string, highlightedWord?: string) => {
    if (!highlightedWord) return text;
    
    const parts = text.split(new RegExp(`(${highlightedWord})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlightedWord.toLowerCase() 
        ? <span key={i} className="csp-highlight">{part}</span>
        : part
    );
  };

  // Render vocabulary content
  const renderVocabularyContent = (step: LearnStepData) => (
    <>
      {/* Part Label */}
      <div className="csp-part-label">
        <p className="csp-part-english">{step.partLabel}</p>
        <p className="csp-part-translation">{step.partTranslation}</p>
      </div>

      {/* Vocabulary Grid */}
      <div className="csp-vocab-grid">
        {(step.vocabularyItems || []).map((item, i) => (
          <div key={i} className="csp-vocab-card">
            <div className="csp-vocab-image">
              {item.image ? (
                <img src={item.image} alt={item.englishText} />
              ) : (
                <div className="csp-image-placeholder">
                  <span className="csp-placeholder-dims">150 × 100</span>
                </div>
              )}
            </div>
            <p className="csp-vocab-english">
              {renderHighlightedText(item.englishText, item.highlightedWord)}
            </p>
            <p className="csp-vocab-translation">{item.translation}</p>
          </div>
        ))}
      </div>

      {/* Part II - Discussion (shared for vocabulary and expressions) */}
      {step.discussionPart && renderDiscussionPart(step)}

      {/* Part III - Pronunciation (shared) */}
      {step.pronunciationPart && renderPronunciationPart(step)}
    </>
  );

  // Render expressions content - uses rich text HTML
  const renderExpressionsContent = (step: LearnStepData) => (
    <>
      {/* Part I - Expressions */}
      <div className="csp-part-label">
        <p className="csp-part-english">{step.partLabel}</p>
        <p className="csp-part-translation">{step.partTranslation}</p>
      </div>

      {/* Expressions List */}
      <div className="csp-expr-list">
        {(step.expressionItems || []).map((item, i) => (
          <div key={i} className="csp-expr-item">
            <div className="csp-expr-image">
              {item.image ? (
                <img src={item.image} alt="expression" />
              ) : (
                <div className="csp-image-placeholder">
                  <span className="csp-placeholder-dims">200 × 150</span>
                </div>
              )}
            </div>
            <div className="csp-expr-content">
              <p className="csp-expr-definition">
                <span className="csp-expr-number">{i + 1}.</span>
                {' '}
                <span dangerouslySetInnerHTML={{ __html: item.definitionLine }} />
              </p>
              <p 
                className="csp-expr-example"
                dangerouslySetInnerHTML={{ __html: item.exampleSentence }}
              />
              {item.extraText && (
                <p 
                  className="csp-expr-extra"
                  dangerouslySetInnerHTML={{ __html: item.extraText }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Part II - Discussion */}
      {step.discussionPart && renderDiscussionPart(step)}

      {/* Part III - Pronunciation */}
      {step.pronunciationPart && renderPronunciationPart(step)}
    </>
  );

  // Render Discussion Part (shared for vocabulary and expressions)
  const renderDiscussionPart = (step: LearnStepData) => (
    <div className="csp-discuss-part">
      <p className="csp-discuss-instruction">{step.discussionPart!.instruction}</p>
      {step.discussionPart!.instructionTranslation && (
        <p className="csp-discuss-instruction-trans">{step.discussionPart!.instructionTranslation}</p>
      )}
      
      {/* Images Grid - Up to 3 images horizontally */}
      {step.discussionPart!.images && step.discussionPart!.images.length > 0 && (
        <div className={`csp-discuss-images csp-discuss-images-${step.discussionPart!.images.length}`}>
          {step.discussionPart!.images.map((img, imgIdx) => (
            <div key={imgIdx} className="csp-discuss-image-item">
              <div className="csp-discuss-image">
                {img.image ? (
                  <img src={img.image} alt={img.label || 'Discussion'} />
                ) : (
                  <div className="csp-image-placeholder">
                    <span className="csp-placeholder-dims">300 × 200</span>
                  </div>
                )}
              </div>
              {img.label && <p className="csp-discuss-img-label">{img.label}</p>}
              {img.translation && <p className="csp-discuss-img-translation">{img.translation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Pronunciation Part (shared for vocabulary and expressions)
  const renderPronunciationPart = (step: LearnStepData) => {
    // Dynamic numeral: II if no discussion, III if discussion exists
    const numeral = step.discussionPart ? 'III' : 'II';
    return (
      <div className="csp-pronunciation-part">
        <p className="csp-pronunciation-instruction">{numeral}. {step.pronunciationPart!.instruction}</p>
        <p className="csp-pronunciation-instruction-trans">{step.pronunciationPart!.instructionTranslation}</p>
        
        <div className="csp-pronunciation-table">
          {/* Left Column */}
          <div className="csp-pronunciation-column">
            <p className="csp-pronunciation-sound">{step.pronunciationPart!.leftColumn.soundSymbol}</p>
            <div className="csp-pronunciation-images">
              {step.pronunciationPart!.leftColumn.images.map((img, i) => (
                img ? <img key={i} src={img} alt="mouth position" /> : (
                  <div key={i} className="csp-pronunciation-img-placeholder">
                    <span>120 × 90</span>
                  </div>
                )
              ))}
            </div>
            <div className="csp-pronunciation-words">
              {step.pronunciationPart!.leftColumn.words.map((word, i) => (
                <div key={i} className="csp-pronunciation-word-item">
                  <p className={`csp-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}>{word.word}</p>
                  <p className="csp-pronunciation-trans">{word.translation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="csp-pronunciation-column">
            <p className="csp-pronunciation-sound">{step.pronunciationPart!.rightColumn.soundSymbol}</p>
            <div className="csp-pronunciation-images">
              {step.pronunciationPart!.rightColumn.images.map((img, i) => (
                img ? <img key={i} src={img} alt="mouth position" /> : (
                  <div key={i} className="csp-pronunciation-img-placeholder">
                    <span>120 × 90</span>
                  </div>
                )
              ))}
            </div>
            <div className="csp-pronunciation-words">
              {step.pronunciationPart!.rightColumn.words.map((word, i) => (
                <div key={i} className="csp-pronunciation-word-item">
                  <p className={`csp-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}>{word.word}</p>
                  <p className="csp-pronunciation-trans">{word.translation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="csp-learn-section">
      {/* Section Header */}
      <div className="csp-section-number">
        <span className="csp-number-badge">2</span>
        <h2 className="csp-section-title">{data.sectionTitle}</h2>
        <div className="csp-section-line" />
      </div>

      {/* Render each step */}
      {data.steps.map((step, stepIndex) => (
        <div key={stepIndex} className="csp-learn-step">
          {/* Step Name */}
          <h3 className="csp-step-name">{step.stepName}</h3>
          
          {/* Two-column layout: Content + Tutor Guide */}
          <div className="csp-learn-layout">
            {/* Left Column - Main Content */}
            <div className="csp-learn-left">
              {step.stepType === 'expressions' 
                ? renderExpressionsContent(step)
                : renderVocabularyContent(step)
              }
            </div>

            {/* Right Column - Tutor Guides */}
            <div className="csp-learn-right">
              {/* Part I Tutor Guide */}
              <div className="csp-tutor-guide">
                {/* Header - matches Lesson Goal style */}
                <div className="csp-guide-header">
                  {data.sectionTitle} - {step.stepName.split(' ').slice(0, 2).join(' ')} ({step.duration})
                </div>
                {/* Steps */}
                <div className="csp-guide-steps">
                  {step.tutorSteps.map((tutorStep, i) => (
                    <div key={i} className="csp-guide-step">
                      <span className="csp-guide-number">{i + 1}</span>
                      <div className="csp-guide-content">
                        <p className="csp-guide-instruction">{tutorStep.instruction}</p>
                        {tutorStep.script && (
                          <p className="csp-guide-script">
                            "{tutorStep.script}"
                          </p>
                        )}
                        {tutorStep.tip && (
                          <div className="csp-guide-tip">
                            {tutorStep.tip}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Part II - Discussion Tutor Guide */}
              {step.discussionPart?.tutorSteps && step.discussionPart.tutorSteps.length > 0 && (
                <div className="csp-tutor-guide csp-part-tutor-guide">
                  <div className="csp-guide-header">
                    Part II - Discussion
                  </div>
                  <div className="csp-guide-steps">
                    {step.discussionPart.tutorSteps.map((tutorStep, i) => (
                      <div key={i} className="csp-guide-step">
                        <span className="csp-guide-number">{i + 1}</span>
                        <div className="csp-guide-content">
                          <p className="csp-guide-instruction">{tutorStep.instruction}</p>
                          {tutorStep.script && (
                            <p className="csp-guide-script">
                              "{tutorStep.script}"
                            </p>
                          )}
                          {tutorStep.tip && (
                            <div className="csp-guide-tip">
                              {tutorStep.tip}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part III - Pronunciation Tutor Guide */}
              {step.pronunciationPart?.tutorSteps && step.pronunciationPart.tutorSteps.length > 0 && (
                <div className="csp-tutor-guide csp-part-tutor-guide">
                  <div className="csp-guide-header">
                    Part {step.discussionPart ? 'III' : 'II'} - Pronunciation
                  </div>
                  <div className="csp-guide-steps">
                    {step.pronunciationPart.tutorSteps.map((tutorStep, i) => (
                      <div key={i} className="csp-guide-step">
                        <span className="csp-guide-number">{i + 1}</span>
                        <div className="csp-guide-content">
                          <p className="csp-guide-instruction">{tutorStep.instruction}</p>
                          {tutorStep.script && (
                            <p className="csp-guide-script">
                              "{tutorStep.script}"
                            </p>
                          )}
                          {tutorStep.tip && (
                            <div className="csp-guide-tip">
                              {tutorStep.tip}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

// ============================================================================
// STEP B SECTION COMPONENT (Speak Your Mind / Grammar Tip / Pronunciation)
// ============================================================================

interface StepBSectionProps {
  data: StepBData;
}

function StepBSection({ data }: StepBSectionProps) {
  // Get current step name and duration based on type
  const getStepName = () => {
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

  const getDuration = () => {
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

  const getTutorSteps = () => {
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

  // Get tutor guide header based on type
  const getTutorGuideHeader = () => {
    return 'PRESENT';
  };

  // Render Speak Your Mind content
  const renderSpeakYourMindContent = () => {
    const speakData = data.speakYourMind!;
    return (
      <>
        {/* Explanation */}
        <p className="csp-stepb-explanation">{speakData.explanation}</p>
        {speakData.explanationTranslation && (
          <p className="csp-stepb-explanation-trans">{speakData.explanationTranslation}</p>
        )}

        {/* Conversation */}
        <div className="csp-conversation">
          {/* Speaker 1 - Left side */}
          <div className="csp-conversation-row csp-speaker-left">
            <div className="csp-speaker-image">
              {speakData.speaker1.image ? (
                <img src={speakData.speaker1.image} alt="Speaker 1" />
              ) : (
                <div className="csp-image-placeholder">
                  <span className="csp-placeholder-dims">150 × 150</span>
                </div>
              )}
            </div>
            <div className="csp-speech-bubble csp-speech-left">
              <p dangerouslySetInnerHTML={{ __html: speakData.speaker1.speechBubble }} />
            </div>
          </div>

          {/* Speaker 2 - Right side */}
          <div className="csp-conversation-row csp-speaker-right">
            <div className="csp-speech-bubble csp-speech-right">
              <p dangerouslySetInnerHTML={{ __html: speakData.speaker2.speechBubble }} />
            </div>
            <div className="csp-speaker-image">
              {speakData.speaker2.image ? (
                <img src={speakData.speaker2.image} alt="Speaker 2" />
              ) : (
                <div className="csp-image-placeholder">
                  <span className="csp-placeholder-dims">150 × 150</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Question - only show if there is one */}
        {speakData.question && (
          <div className="csp-stepb-question">
            <span className="csp-question-bullet">•</span>
            <p>{speakData.question}</p>
          </div>
        )}
      </>
    );
  };

  // Render Grammar Tip content
  const renderGrammarTipContent = () => {
    const grammarData = data.grammarTip!;
    return (
      <div className="csp-grammar-blocks">
        {grammarData.explanations.map((expl, explIdx) => (
          <div key={explIdx} className="csp-grammar-block">
            {/* Rule text with rich formatting */}
            <p 
              className="csp-grammar-rule"
              dangerouslySetInnerHTML={{ __html: expl.ruleText }}
            />
            
            {/* Rule translation */}
            <p className="csp-grammar-translation">{expl.ruleTranslation}</p>

            {/* Examples box (if any) */}
            {expl.examples && expl.examples.length > 0 && (
              <div className="csp-grammar-examples">
                <p className="csp-examples-title">{expl.examplesTitle || 'EXAMPLES'}</p>
                <ul className="csp-examples-list">
                  {expl.examples.map((ex, exIdx) => (
                    <li key={exIdx} className="csp-example-item">
                      <p 
                        className="csp-example-sentence"
                        dangerouslySetInnerHTML={{ __html: ex.sentence }}
                      />
                      <p className="csp-example-translation">{ex.translation}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render Pronunciation content
  const renderPronunciationContent = () => {
    const pronData = data.pronunciation!;
    return (
      <>
        {/* Tip */}
        <p 
          className="csp-pronunciation-tip"
          dangerouslySetInnerHTML={{ __html: pronData.tip }}
        />

        {/* Phrases Table */}
        <div className="csp-pronunciation-phrases-table">
          <div className="csp-phrases-header">
            <div className="csp-phrases-col-phrase">Phrase</div>
            <div className="csp-phrases-col-example">Example</div>
          </div>
          {pronData.phrases.map((phrase, phraseIdx) => (
            <div key={phraseIdx} className="csp-phrases-row">
              <div className="csp-phrases-col-phrase">
                <p className="csp-phrase-text">{phrase.phrase}</p>
                <p className="csp-phrase-guide">{phrase.pronunciationGuide}</p>
              </div>
              <div className="csp-phrases-col-example">
                <p dangerouslySetInnerHTML={{ __html: phrase.exampleSentence }} />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const tutorSteps = getTutorSteps();

  return (
    <section className="csp-stepb-section">
      {/* Step Name */}
      <h3 className="csp-step-name">{getStepName()}</h3>
      
      {/* Two-column layout: Content + Tutor Guide */}
      <div className="csp-stepb-layout">
        {/* Left Column - Main Content */}
        <div className="csp-stepb-left">
          {data.stepType === 'speak-your-mind' && data.speakYourMind && renderSpeakYourMindContent()}
          {data.stepType === 'grammar-tip' && data.grammarTip && renderGrammarTipContent()}
          {data.stepType === 'pronunciation' && data.pronunciation && renderPronunciationContent()}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csp-stepb-right">
          <div className="csp-tutor-guide">
            <div className="csp-guide-header">
              {getTutorGuideHeader()} - {getStepName().split(' ').slice(0, 2).join(' ')} ({getDuration()})
            </div>
            <div className="csp-guide-steps">
              {tutorSteps.map((tutorStep, i) => (
                <div key={i} className="csp-guide-step">
                  <span className="csp-guide-number">{i + 1}</span>
                  <div className="csp-guide-content">
                    <p className="csp-guide-instruction">{tutorStep.instruction}</p>
                    {tutorStep.script && (
                      <p className="csp-guide-script">
                        "{tutorStep.script}"
                      </p>
                    )}
                    {tutorStep.tip && (
                      <div className="csp-guide-tip">
                        {tutorStep.tip}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// APPLY SECTION COMPONENT (Section 3 - Speaking/Understanding)
// ============================================================================

interface ApplySectionProps {
  data: ApplySectionData;
}

function ApplySection({ data }: ApplySectionProps) {
  return (
    <section className="csp-apply-section">
      {/* Section Header */}
      <div className="csp-section-number">
        <span className="csp-number-badge">{data.sectionNumber}</span>
        <h2 className="csp-section-title">{data.sectionTitle}</h2>
        <div className="csp-section-line" />
      </div>

      {/* Activity Title */}
      <h3 className="csp-apply-activity-title">{data.activityTitle}</h3>

      <div className="csp-apply-layout">
        {/* Left Column - Main Content */}
        <div className="csp-apply-left">
          {/* Situation Text */}
          <p className="csp-apply-situation">{data.situationText}</p>

          {/* Situation Image */}
          {data.situationImage && (
            <div className="csp-apply-image">
              <img src={data.situationImage} alt="Situation" />
            </div>
          )}

          {/* Dialogue Lines (SPEAKING only) */}
          {data.activityType === 'speaking' && data.dialogueLines.length > 0 && (
          <div className="csp-dialogue-lines">
            {data.dialogueLines.map((line, lineIdx) => (
              <div key={lineIdx} className={`csp-dialogue-line ${line.isAction ? 'csp-dialogue-action' : ''}`}>
                <span className="csp-dialogue-speaker">{line.speaker}:</span>
                {line.isAction ? (
                  <span className="csp-dialogue-text csp-action-text">{line.text}</span>
                ) : (
                  <span 
                    className="csp-dialogue-text"
                    dangerouslySetInnerHTML={{ __html: line.text }}
                  />
                )}
              </div>
            ))}
          </div>
          )}

          {/* Reading Text (READING only) */}
          {data.activityType === 'reading' && (data.readingText || data.readingImage) && (
            <div className="csp-reading-text-box">
              {data.readingImage && (
                <div className="csp-reading-image">
                  <img src={data.readingImage} alt="Reading" />
                  {data.readingImageLabel && (
                    <div 
                      className="csp-reading-image-label"
                      dangerouslySetInnerHTML={{ __html: data.readingImageLabel }}
                    />
                  )}
                </div>
              )}
              {data.readingText && (
                <div 
                  className="csp-reading-text-content"
                  dangerouslySetInnerHTML={{ __html: data.readingText }}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csp-apply-right">
          <div className="csp-tutor-guide csp-apply-guide">
            <div className="csp-guide-header">
              {data.sectionTitle} - {data.activityTitle} ({data.activityDuration})
            </div>
            <div className="csp-guide-steps">
              {data.tutorSteps.map((step, stepIdx) => (
                <div key={stepIdx} className="csp-guide-step csp-apply-step">
                  <span className="csp-guide-number">{stepIdx + 1}</span>
                  <div className="csp-guide-content">
                    {/* Instruction */}
                    <p className="csp-guide-instruction">{step.instruction}</p>

                    {/* Scripts (green bullets) */}
                    {step.scripts && step.scripts.map((script, scriptIdx) => (
                      <p key={scriptIdx} className="csp-apply-script">
                        <span className="csp-script-bullet">●</span>
                        <span>"{script.text}"</span>
                      </p>
                    ))}

                    {/* Tips (red text) */}
                    {step.tips && step.tips.map((tip, tipIdx) => (
                      <p key={tipIdx} className="csp-apply-tip">
                        <span className="csp-tip-icon">◆</span>
                        <span>{tip.text}</span>
                      </p>
                    ))}

                    {/* Listening Script (green box - LISTENING only) */}
                    {step.listeningScript && (
                      <div 
                        className="csp-listening-script-box"
                        dangerouslySetInnerHTML={{ __html: step.listeningScript }}
                      />
                    )}

                    {/* Questions box */}
                    {step.questions && step.questions.length > 0 && (
                      <div className="csp-apply-questions-box">
                        {step.questions.map((q, qIdx) => (
                          <div key={qIdx} className="csp-apply-question-item">
                            <span className="csp-question-bullet">•</span>
                            <div className="csp-question-content">
                              <p className="csp-question-text">{q.question}</p>
                              {q.answer && (
                                <p className="csp-answer-text">({q.answer})</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trivia Time Section - Always Enabled */}
      {(data.triviaText || data.triviaImage || (data.triviaTutorSteps && data.triviaTutorSteps.length > 0)) && (
        <div className="csp-trivia-row">
          {/* Left - Trivia Box */}
          <div className="csp-trivia-left">
            <div className="csp-trivia-box-inner">
              <div className="csp-trivia-header">
                <i className="ri-lightbulb-line" />
                <span>TRIVIA TIME</span>
              </div>
              <div className="csp-trivia-body">
                {data.triviaImage && (
                  <div className="csp-trivia-image">
                    <img src={data.triviaImage} alt="Trivia" />
                  </div>
                )}
                {data.triviaText && (
                  <div 
                    className="csp-trivia-content"
                    dangerouslySetInnerHTML={{ __html: data.triviaText }}
                  />
                )}
                {data.triviaTranslation && (
                  <div className="csp-trivia-translation">
                    {data.triviaTranslation}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right - Trivia Tutor Guide */}
          {data.triviaTutorSteps && data.triviaTutorSteps.length > 0 && (
            <div className="csp-trivia-right">
              <div className="csp-tutor-guide csp-trivia-guide">
                <div className="csp-guide-header csp-trivia-guide-header">
                  TRIVIA TIME ({data.triviaDuration || '1 minute'})
                </div>
                <div className="csp-guide-steps">
                  {data.triviaTutorSteps.map((step, stepIdx) => (
                    <div key={stepIdx} className="csp-guide-step csp-apply-step">
                      <span className="csp-guide-number">{stepIdx + 1}</span>
                      <div className="csp-guide-content">
                        <p className="csp-guide-instruction">{step.instruction}</p>

                        {/* Scripts (green bullets) */}
                        {step.scripts && step.scripts.map((script, scriptIdx) => (
                          <p key={scriptIdx} className="csp-apply-script">
                            <span className="csp-script-bullet">●</span>
                            <span>"{script.text}"</span>
                          </p>
                        ))}

                        {/* Questions Box */}
                        {step.questions && step.questions.length > 0 && (
                          <div className="csp-apply-questions-box">
                            {step.questions.map((q, qIdx) => (
                              <div key={qIdx} className="csp-apply-question-item">
                                <span className="csp-question-bullet">•</span>
                                <div className="csp-question-content">
                                  <p className="csp-question-text">{q.question}</p>
                                  {q.answer && <p className="csp-answer-text">{q.answer}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// EXERCISE SECTION COMPONENT (Section 4)
// ============================================================================

function ExerciseSection({ data }: { data: ExerciseSectionData }) {
  const stepAType = data.stepAType || 'rephrase';
  
  return (
    <section className="csp-section csp-exercise-section">
      <div className="csp-section-number">
        <span className="csp-number-badge">{data.sectionNumber}</span>
        <h2 className="csp-section-title">{data.sectionTitle}</h2>
        <span className="csp-section-line" />
      </div>

      <div className="csp-exercise-layout">
        {/* Left Column - Content */}
        <div className="csp-exercise-left">
          {/* STEP A Header - Only show if Step B is enabled */}
          {data.hasStepB && (
            <h3 className="csp-step-name">{data.stepAName || 'STEP A'}</h3>
          )}

          {/* Instructions */}
          <p className="csp-exercise-instructions" dangerouslySetInnerHTML={{ __html: data.instructions }} />
          {data.instructionsTranslation && (
            <p className="csp-exercise-instructions-translation" dangerouslySetInnerHTML={{ __html: data.instructionsTranslation }} />
          )}

          {/* REPHRASE TYPE CONTENT */}
          {stepAType === 'rephrase' && (
            <>
          {/* Expression Box */}
          {data.showExpressions && data.expressions && data.expressions.length > 0 && (
            <div className="csp-expression-box">
              {data.expressions.map((expr, idx) => (
                <span key={idx} className="csp-expression-item">{expr}</span>
              ))}
            </div>
          )}

          {/* Info Box (Comparison Table) */}
          {data.showInfoBox && data.infoBox && (
            <div className="csp-info-box">
              <h4 className="csp-info-box-title">{data.infoBox.title}</h4>
              <table className="csp-info-box-table">
                <thead>
                  <tr>
                    <th className="csp-info-box-row-label"></th>
                    {data.infoBox.columns.map((col, colIdx) => (
                      <th key={colIdx} className="csp-info-box-header">{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.infoBox.rowLabels.map((rowLabel, rowIdx) => (
                    <tr key={rowIdx}>
                      <td className="csp-info-box-row-label">{rowLabel}</td>
                      {data.infoBox!.columns.map((col, colIdx) => (
                        <td key={colIdx} className="csp-info-box-cell">{col.rows?.[rowIdx] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Example */}
          {data.showExample && (
            <div className="csp-exercise-example">
              <div className="csp-exercise-example-image">
                {data.exampleImage ? (
                  <img src={data.exampleImage} alt="Example" />
                ) : (
                  <div className="csp-image-placeholder">
                    <span className="csp-placeholder-dims">120 × 80</span>
                  </div>
                )}
              </div>
              <div className="csp-example-content">
                <p className="csp-example-sentence" dangerouslySetInnerHTML={{ __html: data.exampleSentence }} />
                <p className="csp-example-answer">
                  <span className="csp-arrow">→</span>
                  <span className="csp-answer-underline" dangerouslySetInnerHTML={{ __html: data.exampleAnswer }} />
                </p>
              </div>
            </div>
          )}

          {/* Exercise Items */}
          <div className="csp-exercise-items">
            {data.exerciseItems.map((item, idx) => (
              <div key={idx} className="csp-exercise-item">
                <div className="csp-exercise-item-image">
                  {item.image ? (
                    <img src={item.image} alt={`Exercise ${idx + 1}`} />
                  ) : (
                    <div className="csp-image-placeholder">
                      <span className="csp-placeholder-dims">120 × 80</span>
                    </div>
                  )}
                </div>
                <div className="csp-exercise-item-text">
                  <span className="csp-item-number">{idx + 1}.</span>
                  <span className="csp-item-sentence" dangerouslySetInnerHTML={{ __html: item.sentence }} />
                </div>
              </div>
            ))}
          </div>
            </>
          )}

          {/* CHOOSE TYPE CONTENT */}
          {stepAType === 'choose' && (
            <>
              {/* Choose Items List */}
              <div className="csp-choose-items">
                {(data.chooseItems || []).map((item, idx) => (
                  <div key={idx} className="csp-choose-item">
                    <span className="csp-item-number">{idx + 1}.</span>
                    <span className="csp-item-sentence" dangerouslySetInnerHTML={{ __html: item.sentence }} />
                  </div>
                ))}
              </div>

              {/* Info Box (Comparison Table) */}
              {data.showInfoBox && data.infoBox && (
                <div className="csp-info-box">
                  <h4 className="csp-info-box-title">{data.infoBox.title}</h4>
                  <table className="csp-info-box-table">
                    <thead>
                      <tr>
                        <th className="csp-info-box-row-label"></th>
                        {data.infoBox.columns.map((col, colIdx) => (
                          <th key={colIdx} className="csp-info-box-header">{col.header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.infoBox.rowLabels.map((rowLabel, rowIdx) => (
                        <tr key={rowIdx}>
                          <td className="csp-info-box-row-label">{rowLabel}</td>
                          {data.infoBox!.columns.map((col, colIdx) => (
                            <td key={colIdx} className="csp-info-box-cell">{col.rows?.[rowIdx] || ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Optional Image */}
              {data.chooseImage && (
                <div className="csp-choose-image">
                  <img src={data.chooseImage} alt="Exercise" />
                </div>
              )}
            </>
          )}

          {/* CHANGE TYPE CONTENT */}
          {stepAType === 'change' && (
            <>
              {/* Expression Box */}
              {data.showExpressions && data.expressions && data.expressions.length > 0 && (
                <div className="csp-expression-box">
                  {data.expressions.map((expr, idx) => (
                    <span key={idx} className="csp-expression-item">{expr}</span>
                  ))}
                </div>
              )}

              {/* Change Items List */}
              <div className="csp-change-items">
                {(data.changeItems || []).map((item, idx) => (
                  <div key={idx} className="csp-change-item">
                    <span className="csp-item-number">{idx + 1}.</span>
                    <span className="csp-change-text" dangerouslySetInnerHTML={{ __html: item.sentence }} />
                  </div>
                ))}
              </div>

              {/* Optional Image */}
              {data.changeImage && (
                <div className="csp-choose-image">
                  <img src={data.changeImage} alt="Exercise" />
                </div>
              )}
            </>
          )}

          {/* STEP B CONTENT - Only if enabled */}
          {data.hasStepB && (
            <>
              <h3 className="csp-step-name csp-stepb-name">{data.stepBName || 'STEP B'}</h3>
              
              {/* Step B Instruction */}
              <p className="csp-exercise-instructions">{data.stepBInstruction}</p>
              {data.stepBInstructionTranslation && (
                <p className="csp-exercise-instructions-translation">{data.stepBInstructionTranslation}</p>
              )}

              {/* Conversation Type */}
              {(!data.stepBType || data.stepBType === 'conversation') && (
                <div className="csp-exercise-conversations">
                  {(data.conversations || []).map((conv, convIdx) => (
                    <div 
                      key={convIdx} 
                      className={`csp-exercise-conv-row csp-exercise-conv-${conv.position}`}
                    >
                      {conv.position === 'left' && (
                        <div className="csp-exercise-speaker-image">
                          {conv.speakerImage ? (
                            <img src={conv.speakerImage} alt={`Speaker ${convIdx + 1}`} />
                          ) : (
                            <div className="csp-image-placeholder">
                              <span className="csp-placeholder-dims">150 × 150</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="csp-exercise-speech-bubble">
                        <p dangerouslySetInnerHTML={{ __html: conv.speechBubble }} />
                      </div>
                      
                      {conv.position === 'right' && (
                        <div className="csp-exercise-speaker-image">
                          {conv.speakerImage ? (
                            <img src={conv.speakerImage} alt={`Speaker ${convIdx + 1}`} />
                          ) : (
                            <div className="csp-image-placeholder">
                              <span className="csp-placeholder-dims">150 × 150</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Multiple Choice Type */}
              {data.stepBType === 'multiple-choice' && (
                <div className="csp-stepb-multiple-choice">
                  {(data.multipleChoiceItems || []).map((item, mcIdx) => (
                    <div key={mcIdx} className="csp-mc-item">
                      <p className="csp-mc-sentence">
                        <span className="csp-mc-number">{mcIdx + 1}.</span>
                        <strong>{item.boldSentence}</strong>
                      </p>
                      <div className="csp-mc-options">
                        <p className="csp-mc-option"><span className="csp-mc-label">a.</span> {item.optionA}</p>
                        <p className="csp-mc-option"><span className="csp-mc-label">b.</span> {item.optionB}</p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Optional Image */}
                  {data.multipleChoiceImage && (
                    <div className="csp-mc-image">
                      <img src={data.multipleChoiceImage} alt="Multiple choice" />
                    </div>
                  )}
                </div>
              )}

              {/* Speech Type - Single speaker with speech bubble */}
              {data.stepBType === 'speech' && (
                <div className="csp-stepb-speech">
                  <div className="csp-speech-layout">
                    <div className="csp-speech-speaker-image">
                      {data.speechSpeakerImage ? (
                        <img src={data.speechSpeakerImage} alt="Speaker" />
                      ) : (
                        <div className="csp-image-placeholder">
                          <span className="csp-placeholder-dims">150 × 200</span>
                        </div>
                      )}
                    </div>
                    <div className="csp-speech-bubble">
                      <p dangerouslySetInnerHTML={{ __html: data.speechContent || '' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csp-exercise-right">
          {/* Step A Tutor Guide */}
          <div className="csp-tutor-guide">
            <div className="csp-guide-header">
              {data.hasStepB ? (data.stepAName || 'STEP A') : data.sectionTitle} ({data.duration})
            </div>
            <div className="csp-guide-steps">
              {data.tutorSteps.map((step, stepIdx) => (
                <div key={stepIdx} className="csp-guide-step csp-apply-step">
                  <span className="csp-guide-number">{stepIdx + 1}</span>
                  <div className="csp-guide-content">
                    <p className="csp-guide-instruction">{step.instruction}</p>

                    {/* Scripts (green bullets) */}
                    {step.scripts && step.scripts.map((script, scriptIdx) => (
                      <p key={scriptIdx} className="csp-apply-script">
                        <span className="csp-script-bullet">●</span>
                        <span>"{script.text}"</span>
                      </p>
                    ))}

                    {/* Tips (red text) */}
                    {step.tips && step.tips.map((tip, tipIdx) => (
                      <p key={tipIdx} className="csp-apply-tip">
                        <span className="csp-tip-icon">◆</span>
                        <span>{tip.text}</span>
                      </p>
                    ))}

                    {/* Answer Key Box */}
                    {step.answerKey && step.answerKey.length > 0 && (
                      <div className="csp-tutor-answer-key-box">
                        <div className="csp-tutor-answer-key-header">ANSWER KEY</div>
                        <div className="csp-tutor-answer-key-items">
                          {step.answerKey.map((answer, answerIdx) => (
                            <p key={answerIdx} className="csp-tutor-answer-key-item">
                              <span className="csp-tutor-answer-number">{answerIdx + 1}.</span>
                              <span>{answer.text}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step B Tutor Guide - Only if Step B is enabled */}
          {data.hasStepB && data.stepBTutorSteps && (
            <div className="csp-tutor-guide csp-stepb-tutor-guide">
              <div className="csp-guide-header">
                {data.stepBName || 'STEP B'}
              </div>
              <div className="csp-guide-steps">
                {data.stepBTutorSteps.map((step, stepIdx) => (
                  <div key={stepIdx} className="csp-guide-step csp-apply-step">
                    <span className="csp-guide-number">{stepIdx + 1}</span>
                    <div className="csp-guide-content">
                      <p className="csp-guide-instruction">{step.instruction}</p>

                      {/* Scripts (green bullets) */}
                      {step.scripts && step.scripts.map((script, scriptIdx) => (
                        <p key={scriptIdx} className="csp-apply-script">
                          <span className="csp-script-bullet">●</span>
                          <span>"{script.text}"</span>
                        </p>
                      ))}

                      {/* Tips (red text) */}
                      {step.tips && step.tips.map((tip, tipIdx) => (
                        <p key={tipIdx} className="csp-apply-tip">
                          <span className="csp-tip-icon">◆</span>
                          <span>{tip.text}</span>
                        </p>
                      ))}

                      {/* Answer Key Box */}
                      {step.answerKey && step.answerKey.length > 0 && (
                        <div className="csp-tutor-answer-key-box">
                          <div className="csp-tutor-answer-key-header">ANSWER KEY</div>
                          <div className="csp-tutor-answer-key-items">
                            {step.answerKey.map((answer, answerIdx) => (
                              <p key={answerIdx} className="csp-tutor-answer-key-item">
                                <span className="csp-tutor-answer-number">{answerIdx + 1}.</span>
                                <span>{answer.text}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// MISSION SECTION COMPONENT (Section 5)
// ============================================================================

interface MissionSectionProps {
  data: MissionSectionData;
  hideHeader?: boolean;
}

function MissionSection({ data, hideHeader = false }: MissionSectionProps) {
  // Render speaking type content
  const renderSpeakingContent = () => (
    <>
      {/* Situation Box */}
      <div className="csp-mission-situation-box">
        <p className="csp-mission-situation" dangerouslySetInnerHTML={{ __html: data.situation }} />
        {data.situationTranslation && (
          <p className="csp-mission-translation">{data.situationTranslation}</p>
        )}
      </div>

      {/* Instruction */}
      <div className="csp-mission-instruction-box">
        <p className="csp-mission-instruction" dangerouslySetInnerHTML={{ __html: data.instruction }} />
        {data.instructionTranslation && (
          <p className="csp-mission-translation">{data.instructionTranslation}</p>
        )}
      </div>

      {/* Grammar Tip */}
      {data.showGrammarTip && data.grammarTipItems.length > 0 && (
        <div className="csp-mission-grammar-tip">
          <div className="csp-grammar-tip-header">
            <i className="ri-lightbulb-line" />
            <span>{data.grammarTipTitle}</span>
          </div>
          <ul className="csp-grammar-tip-items">
            {data.grammarTipItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Image */}
      {data.image && (
        <div className="csp-mission-image">
          <img src={data.image} alt="Mission" />
        </div>
      )}
    </>
  );

  // Render reading type content
  const renderReadingContent = () => (
    <>
      {/* Situation Box */}
      <div className="csp-mission-situation-box">
        <p className="csp-mission-situation" dangerouslySetInnerHTML={{ __html: data.situation }} />
        {data.situationTranslation && (
          <p className="csp-mission-translation">{data.situationTranslation}</p>
        )}
      </div>

      {/* Instruction */}
      <div className="csp-mission-instruction-box">
        <p className="csp-mission-instruction" dangerouslySetInnerHTML={{ __html: data.instruction }} />
        {data.instructionTranslation && (
          <p className="csp-mission-translation">{data.instructionTranslation}</p>
        )}
      </div>

      {/* Reading Passage */}
      {data.readingPassage && (
        <div className="csp-mission-reading-passage">
          <div className="csp-reading-header" style={{ textAlign: data.readingPassage.headerAlignment || 'center' }}>
            <h4 className="csp-reading-title">{data.readingPassage.title}</h4>
            {data.readingPassage.showAuthor !== false && data.readingPassage.author && (
              <p className="csp-reading-author">by {data.readingPassage.author}</p>
            )}
          </div>
          <div className="csp-reading-blocks">
            {(data.readingPassage.blocks || []).map((block, idx) => (
              <div key={idx} className="csp-reading-block">
                {block.type === 'paragraph' && block.content && (
                  <p className="csp-reading-paragraph">{block.content}</p>
                )}
                {block.type === 'images' && block.images && block.images.length > 0 && (
                  <div className="csp-reading-images">
                    {block.images.map((img, imgIdx) => (
                      <img key={imgIdx} src={img} alt="" className="csp-reading-image" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {data.readingPassage.closingQuestion && (
            <p className="csp-reading-closing-question">{data.readingPassage.closingQuestion}</p>
          )}
        </div>
      )}

      {/* Grammar Tip */}
      {data.showGrammarTip && data.grammarTipItems.length > 0 && (
        <div className="csp-mission-grammar-tip">
          <div className="csp-grammar-tip-header">
            <i className="ri-lightbulb-line" />
            <span>{data.grammarTipTitle}</span>
          </div>
          <ul className="csp-grammar-tip-items">
            {data.grammarTipItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  // Render listening type content
  const renderListeningContent = () => (
    <>
      {/* Situation Box */}
      <div className="csp-mission-situation-box">
        <p className="csp-mission-situation" dangerouslySetInnerHTML={{ __html: data.situation }} />
        {data.situationTranslation && (
          <p className="csp-mission-translation">{data.situationTranslation}</p>
        )}
      </div>

      {/* Instruction */}
      <div className="csp-mission-instruction-box">
        <p className="csp-mission-instruction" dangerouslySetInnerHTML={{ __html: data.instruction }} />
        {data.instructionTranslation && (
          <p className="csp-mission-translation">{data.instructionTranslation}</p>
        )}
      </div>

      {/* Image */}
      {data.image && (
        <div className="csp-mission-image">
          <img src={data.image} alt="Mission" />
        </div>
      )}
    </>
  );

  // Render discussion type content
  const renderDiscussionContent = () => (
    <>
      {/* Situation Box */}
      <div className="csp-mission-situation-box">
        <p className="csp-mission-situation" dangerouslySetInnerHTML={{ __html: data.situation }} />
        {data.situationTranslation && (
          <p className="csp-mission-translation">{data.situationTranslation}</p>
        )}
      </div>

      {/* Instruction */}
      <div className="csp-mission-instruction-box">
        <p className="csp-mission-instruction" dangerouslySetInnerHTML={{ __html: data.instruction }} />
        {data.instructionTranslation && (
          <p className="csp-mission-translation">{data.instructionTranslation}</p>
        )}
      </div>

      {/* Topics Grid */}
      {data.topics && data.topics.length > 0 && (
        <div className="csp-mission-topics">
          {data.topics.map((topic, topicIdx) => (
            <div key={topicIdx} className="csp-mission-topic-card">
              <div className="csp-mission-topic-header">
                <span className="csp-topic-label">TOPIC {topicIdx + 1}</span>
                <span className="csp-topic-title">{topic.title}</span>
              </div>
              <ol className="csp-mission-topic-questions">
                {topic.questions.map((q, qIdx) => (
                  <li key={qIdx}>{q}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <section className="csp-mission-section">
      {/* Section Header */}
      {!hideHeader && (
        <div className="csp-section-number">
          <span className="csp-number-badge">{data.sectionNumber}</span>
          <h2 className="csp-section-title">{data.sectionTitle}</h2>
          <div className="csp-section-line" />
        </div>
      )}

      {/* Challenge Name */}
      <h3 className="csp-challenge-name">
        {data.challengeName}
      </h3>

      <div className="csp-mission-layout">
        {/* Left Column - Student Content */}
        <div className="csp-mission-left">
          {data.missionType === 'speaking' && renderSpeakingContent()}
          {data.missionType === 'reading' && renderReadingContent()}
          {data.missionType === 'listening' && renderListeningContent()}
          {data.missionType === 'discussion' && renderDiscussionContent()}
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csp-mission-right">
          <div className="csp-tutor-guide">
            <div className="csp-guide-header">
              {data.sectionTitle}
            </div>
            <div className="csp-mission-challenge-header">
              <span className="csp-mission-challenge-name">{data.challengeName}</span>
              <span className="csp-mission-challenge-duration">({data.duration})</span>
            </div>
            <div className="csp-guide-steps">
              {data.tutorSteps.map((step, stepIdx) => (
                <div key={stepIdx} className="csp-guide-step">
                  <span className="csp-guide-number">{stepIdx + 1}</span>
                  <div className="csp-guide-content">
                    <p className="csp-guide-instruction">{step.instruction}</p>

                    {/* Scripts */}
                    {step.scripts && step.scripts.map((script, scriptIdx) => (
                      <p key={scriptIdx} className="csp-apply-script">
                        <span className="csp-script-bullet">●</span>
                        <span>"{script.text}"</span>
                      </p>
                    ))}

                    {/* Tips */}
                    {step.tips && step.tips.map((tip, tipIdx) => (
                      <p key={tipIdx} className="csp-apply-tip">
                        <span className="csp-tip-icon">◆</span>
                        <span>{tip.text}</span>
                      </p>
                    ))}

                    {/* Questions */}
                    {step.questions && step.questions.length > 0 && (
                      <div className="csp-apply-questions-box">
                        {step.questions.map((q, qIdx) => (
                          <div key={qIdx} className="csp-apply-question-item">
                            <span className="csp-question-bullet">•</span>
                            <div className="csp-question-content">
                              <p className="csp-question-text">{q.question}</p>
                              {q.answer && <p className="csp-answer-text">({q.answer})</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FEEDBACK SECTION COMPONENT (Section 6)
// ============================================================================

interface FeedbackSectionProps {
  data: FeedbackSectionData;
}

function FeedbackSection({ data }: FeedbackSectionProps) {
  return (
    <section className="csp-feedback-section">
      {/* Section Header */}
      <div className="csp-section-number">
        <span className="csp-number-badge">{data.sectionNumber}</span>
        <h2 className="csp-section-title">{data.sectionTitle}</h2>
        <div className="csp-section-line" />
      </div>

      <div className="csp-feedback-layout">
        {/* Left Column - Student View */}
        <div className="csp-feedback-left">
          {/* Goal Box - Horizontal layout like editor */}
          <div className="csp-feedback-goal">
            <div className="csp-feedback-goal-header">
              <span className="csp-goal-badge">GOAL</span>
            </div>
            <div className="csp-feedback-goal-content">
              <p className="csp-feedback-goal-text">{data.goal}</p>
              <p className="csp-feedback-goal-jp">{data.goalJp}</p>
            </div>
          </div>

          {/* Rubric */}
          <div className="csp-feedback-rubric">
            <div className="csp-feedback-rubric-header">{data.rubricTitle}</div>
            <div className="csp-feedback-rubric-grid">
              {data.rubricLevels.map((level, idx) => (
                <div key={idx} className={`csp-rubric-level csp-rubric-level-${level.score}`}>
                  <div className="csp-rubric-score">{level.score}</div>
                  <div className="csp-rubric-label">{level.label}</div>
                  <div className="csp-rubric-desc">{level.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Personalized Feedback Header */}
          <div className="csp-feedback-pf">
            <div className="csp-feedback-pf-header">{data.personalizedFeedbackTitle}</div>
            <div className="csp-feedback-pf-categories">
              {data.categories.map((cat) => (
                <div key={cat.id} className={`csp-feedback-pf-cat csp-feedback-pf-${cat.id}`}>
                  <div className="csp-feedback-pf-cat-title">{cat.title}</div>
                  <div className="csp-feedback-pf-cat-jp">{cat.titleJp}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback Guide Table - 3-column layout like editor */}
          <div className="csp-feedback-guide">
            <div className="csp-feedback-guide-header">{data.feedbackGuideTitle}</div>
            
            {/* Column Headers */}
            <div className="csp-feedback-table-columns">
              <div className="csp-feedback-col-header"></div>
              <div className="csp-feedback-col-header">Focus on...</div>
              <div className="csp-feedback-col-header">example feedback</div>
            </div>

            {/* Table Rows */}
            {data.categories.map((cat) => (
              <div key={cat.id} className={`csp-feedback-table-row csp-feedback-row-${cat.id}`}>
                {/* Column 1: Category */}
                <div className="csp-feedback-col-category">
                  <span className={`csp-feedback-category-title csp-cat-${cat.id}`}>{cat.title}</span>
                  <span className="csp-feedback-focus-on">{cat.focusOn}</span>
                </div>

                {/* Column 2: Focus Items */}
                <div className="csp-feedback-col-focus">
                  {cat.exampleFeedbackItems.map((item, idx) => (
                    <span key={idx} className="csp-feedback-focus-item">{item}</span>
                  ))}
                </div>

                {/* Column 3: Example Feedback */}
                <div className="csp-feedback-col-examples">
                  {cat.id === 'range' && cat.vocabularyExample && (
                    <div className="csp-feedback-vocab-line">{cat.vocabularyExample}</div>
                  )}
                  {cat.examples.map((ex, exIdx) => (
                    <div key={exIdx} className="csp-feedback-example-block">
                      <div className="csp-feedback-example-row">
                        <span className="csp-feedback-label">You said:</span>
                        <span className="csp-feedback-wrong">"{ex.youSaid}"</span>
                      </div>
                      <div className="csp-feedback-example-row">
                        <span className="csp-feedback-label">{ex.correctionLabel}</span>
                        <span className="csp-feedback-correct">"{ex.correction}"</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Tutor Guide */}
        <div className="csp-feedback-right">
          <div className="csp-tutor-guide">
            <div className="csp-guide-header">
              {data.sectionTitle} ({data.duration})
            </div>
            <div className="csp-guide-steps">
              {data.tutorSteps.map((step, stepIdx) => (
                <div key={stepIdx} className="csp-guide-step">
                  <span className="csp-guide-number">{stepIdx + 1}</span>
                  <div className="csp-guide-content">
                    <p className="csp-guide-instruction">{step.instruction}</p>

                    {/* Scripts */}
                    {step.scripts && step.scripts.map((script, scriptIdx) => (
                      <p key={scriptIdx} className="csp-apply-script">
                        <span className="csp-script-bullet">●</span>
                        <span>"{script.text}"</span>
                      </p>
                    ))}

                    {/* Tips */}
                    {step.tips && step.tips.map((tip, tipIdx) => (
                      <p key={tipIdx} className="csp-apply-tip">
                        <span className="csp-tip-icon">◆</span>
                        <span>{tip.text}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// PLACEHOLDER SECTION COMPONENT
// ============================================================================

function PlaceholderSection({ 
  icon, 
  title, 
  description 
}: { 
  icon: string; 
  title: string;
  description: string;
}) {
  return (
    <section className="csp-section">
      <div className="csp-section-header">
        <i className={icon} />
        <h2>{title}</h2>
      </div>
      <div className="csp-section-body">
        <p className="csp-placeholder-text">{description}</p>
        <span className="csp-coming-soon">Content coming soon...</span>
      </div>
    </section>
  );
}
