/**
 * ConversationalSkillsPreview
 * Full-page standalone preview renderer for Conversational Skills lessons
 * Matches the rarejob.com.ph lesson material design
 */
import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { getLessonById, type LessonMaterial } from '../api/lessonMaterial.api';
import './ConversationalSkillsPreview.css';

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
  partTranslation: string;
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
// STEP B SECTION TYPES (Speak Your Mind / Grammar Tip / Pronunciation)
// ============================================================================

type StepBType = 'speak-your-mind' | 'grammar-tip' | 'pronunciation';

interface ConversationSpeaker {
  image: string;
  speechBubble: string; // Rich text HTML
}

interface SpeakYourMindData {
  stepName: string;
  duration: string;
  explanation: string;
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

interface ApplySectionData {
  sectionNumber: number;
  sectionTitle: string;
  activityType: ApplyActivityType;
  activityTitle: string;
  activityDuration: string;
  situationText: string;
  situationImage: string;
  dialogueLines: DialogueLine[];
  tutorSteps: ApplyTutorStep[];
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

export default function ConversationalSkillsPreview() {
  const { params } = useRoute();
  const [lesson, setLesson] = useState<LessonMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewOverrides, setPreviewOverrides] = useState<{
    backgroundImage?: string;
    overlayColor?: string;
    chapterName?: string;
    lessonName?: string;
    goalTextEn?: string;
    goalTextJp?: string;
    introductionData?: IntroductionData;
    learnData?: LearnSectionData;
    stepBData?: StepBData;
    applyData?: ApplySectionData;
  } | null>(null);

  const id = params?.id;

  useEffect(() => {
    if (id) {
      // Check sessionStorage for unsaved preview data
      const storedData = sessionStorage.getItem(`preview-${id}`);
      if (storedData) {
        try {
          setPreviewOverrides(JSON.parse(storedData));
        } catch (e) {
          console.error('Failed to parse preview data:', e);
        }
      }
      loadLesson(id);
    }
  }, [id]);

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      const data = await getLessonById(lessonId);
      setLesson(data);
    } catch (err) {
      console.error('Failed to load lesson:', err);
      setError('Failed to load lesson preview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="csp-fullpage csp-loading">
        <div className="csp-loader">
          <i className="ri-loader-4-line" />
          <p>Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="csp-fullpage csp-error">
        <i className="ri-error-warning-line" />
        <h2>{error || 'Lesson not found'}</h2>
        <button onClick={() => window.close()}>Close Preview</button>
      </div>
    );
  }

  // Apply overrides from sessionStorage if present, otherwise use saved lesson data
  const backgroundImage = previewOverrides?.backgroundImage ?? lesson.backgroundImage;
  const overlayColor = previewOverrides?.overlayColor ?? (lesson.overlayColor || '#134e4acc');
  const chapterName = previewOverrides?.chapterName ?? lesson.chapterName;
  const lessonName = previewOverrides?.lessonName ?? lesson.lessonName;
  const goalTextEn = previewOverrides?.goalTextEn ?? lesson.goalTextEn;
  const goalTextJp = previewOverrides?.goalTextJp ?? lesson.goalTextJp;
  
  // Introduction data: prioritize sessionStorage > saved lesson > default
  const introductionData: IntroductionData = 
    previewOverrides?.introductionData ?? 
    lesson.introductionData ?? 
    DEFAULT_INTRODUCTION_DATA;

  // Learn data: prioritize sessionStorage > saved lesson > default
  const learnData: LearnSectionData = 
    previewOverrides?.learnData ?? 
    lesson.learnData ?? 
    DEFAULT_LEARN_DATA;

  // Step B data: prioritize sessionStorage > saved lesson
  const stepBData: StepBData | undefined = 
    previewOverrides?.stepBData ?? 
    lesson.stepBData;

  // Apply data: prioritize sessionStorage > saved lesson
  const applyData: ApplySectionData | undefined = 
    previewOverrides?.applyData ?? 
    lesson.applyData;

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
          <p className="csp-lesson-label">Lesson {lesson.lessonNumber}: {chapterName}</p>
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

          <PlaceholderSection 
            icon="ri-headphone-line" 
            title="Listening" 
            description="Comprehension exercises"
          />
          <PlaceholderSection 
            icon="ri-edit-line" 
            title="Practice" 
            description="Apply what you've learned"
          />
        </div>
      </main>

      {/* Close Button */}
      <button className="csp-close-btn" onClick={() => window.close()} title="Close Preview">
        <i className="ri-close-line" />
      </button>
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

            {/* Right Column - Tutor Guide */}
            <div className="csp-learn-right">
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

  // Render Speak Your Mind content
  const renderSpeakYourMindContent = () => {
    const speakData = data.speakYourMind!;
    return (
      <>
        {/* Explanation */}
        <p className="csp-stepb-explanation">{speakData.explanation}</p>

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

        {/* Question */}
        <div className="csp-stepb-question">
          <span className="csp-question-bullet">•</span>
          <p>{speakData.question}</p>
        </div>
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
              PRESENT - {getStepName().split(' ').slice(0, 2).join(' ')} ({getDuration()})
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
