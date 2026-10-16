import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import { useLocation, useRoute } from "../routing";
import { lessonApi } from '../api/lesson.api';
import { API_BASE_URL } from '../config/api';
import { normalizeLessonMedia } from '../../../shared/lessonMedia';
import { FixedFeedbackGuide } from '../Components/FixedFeedbackGuide';
import { ConversationalExerciseMarking } from '../Components/ConversationalExerciseMarking';
import { getMarkableExerciseItems } from '../utils/conversationalExerciseMarks';
import './ConversationalSkillsLessonPage.css';
type ConversationalTheme = 'light' | 'dark';
interface LessonMaterial {
    id?: string;
    course?: string;
    level?: number;
    chapter?: number;
    lessonNumber?: number;
    skill?: string;
    chapterName?: string;
    lessonName?: string;
    goalTextEn?: string;
    goalTextJp?: string;
    backgroundImage?: string;
    overlayColor?: string;
    status?: string;
    levelBadge?: string;
    introductionData?: IntroductionData;
    learnData?: LearnSectionData;
    stepBData?: StepBData;
    applyData?: ApplySectionData;
    exerciseData?: ExerciseSectionData;
    missionData?: MissionSectionData;
    missionData2?: MissionSectionData;
    missionData3?: MissionSectionData;
    feedbackData?: FeedbackSectionData;
    [key: string]: unknown;
}
const getCurrentStudentTheme = (): ConversationalTheme | null => {
    if (typeof document === 'undefined') {
        return null;
    }
    const rootTheme = document.documentElement.dataset.theme;
    const bodyTheme = document.body?.dataset.theme;
    if (rootTheme === 'dark' || bodyTheme === 'dark') {
        return 'dark';
    }
    if (rootTheme === 'light' || bodyTheme === 'light') {
        return 'light';
    }
    return null;
};
const getStoredConversationalTheme = (): ConversationalTheme => {
    try {
        const studentTheme = getCurrentStudentTheme();
        if (studentTheme) {
            return studentTheme;
        }
        const storedTheme = localStorage.getItem('csve-theme');
        return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'light';
    }
    catch {
        return 'light';
    }
};
const getPreviewThemeFromQuery = (): ConversationalTheme | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    const theme = new URLSearchParams(window.location.search).get('theme');
    return theme === 'dark' || theme === 'light' ? theme : null;
};
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
        { instruction: "Read the lesson objective and ask if it's clear.", script: null, question: null },
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
    translation?: string; // Optional translation (Japanese, Korean, Vietnamese, Chinese)
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
interface StepBData {
    stepType: StepBType;
    speakYourMind?: SpeakYourMindData;
    grammarTip?: GrammarTipData;
    pronunciation?: StepBPronunciationData;
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
    prompts?: {
        text: string;
    }[];
    listeningScript?: string; // Rich text HTML for listening script
}
interface TriviaTutorStep {
    instruction: string;
    scripts?: TutorScriptBullet[];
    questions?: TutorQuestion[];
    prompts?: {
        text: string;
    }[];
}
interface ApplySectionData {
    sectionNumber: number;
    sectionTitle: string;
    activityType: ApplyActivityType;
    activityTitle: string;
    activityDuration: string;
    situationText: string;
    situationTranslation?: string;
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
    prompts?: {
        text: string;
    }[];
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
interface CompareExerciseItem {
    sentence: string;
}
interface CompareImageItem {
    image: string;
    label: string;
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
type ExerciseStepBType = 'conversation' | 'multiple-choice' | 'speech' | 'compare';
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
    stepBType?: ExerciseStepBType;
    stepBName?: string;
    stepBInstruction?: string;
    stepBInstructionTranslation?: string;
    // Step B - Conversation type
    conversations?: ExerciseConversation[];
    // Step B - Multiple Choice type
    multipleChoiceItems?: {
        boldSentence: string;
        optionA: string;
        optionB: string;
    }[];
    multipleChoiceImage?: string;
    // Step B - Speech type
    speechSpeakerImage?: string;
    speechContent?: string;
    // Step B - Compare type
    compareWordBox?: string[];
    compareImages?: CompareImageItem[];
    compareExample?: string;
    compareItems?: CompareExerciseItem[];
    // Step B - Tutor steps
    stepBTutorSteps?: ExerciseTutorStep[];
    exampleImage?: string;
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
    listeningScript?: string;
    scripts?: {
        text: string;
    }[];
    prompts?: {
        text: string;
    }[];
    tips?: {
        text: string;
    }[];
    questions?: {
        question: string;
        answer?: string;
    }[];
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
    scripts?: {
        text: string;
    }[];
    prompts?: {
        text: string;
    }[];
    tips?: {
        text: string;
    }[];
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
export default function ConversationalSkillsPreview() {
    const _state0 = useRoute();
    const _state1 = useLocation();
    const [lesson, setLesson] = createSignal<LessonMaterial | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>('');
    const [previewOverrides, setPreviewOverrides] = createSignal<{
        theme?: ConversationalTheme;
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
        exerciseData?: ExerciseSectionData;
        missionData?: MissionSectionData;
        missionData2?: MissionSectionData;
        missionData3?: MissionSectionData;
        feedbackData?: FeedbackSectionData;
    } | null>(null);
    const [hasSessionData, setHasSessionData] = createSignal(false);
    const [theme, setTheme] = createSignal<ConversationalTheme>((() => getPreviewThemeFromQuery() ?? getStoredConversationalTheme())());
    const id = createMemo(() => _state0.params?.id || (_state0.query?.id as string | undefined));
    const classroomSessionId = typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('sessionId');
    createEffect(on(() => [theme()], () => {
        const _cleanup10 = untrack(() => {
            if (typeof document === 'undefined') {
                return;
            }
            const root = document.documentElement;
            const body = document.body;
            const previousRootTheme = root.dataset.theme;
            const previousBodyTheme = body?.dataset.theme;
            const previousRootDarkMode = root.classList.contains('dark-mode');
            const previousBodyDarkMode = body?.classList.contains('dark-mode') ?? false;
            const previousColorScheme = root.style.colorScheme;
            const isDark = theme() === 'dark';
            root.dataset.theme = theme();
            root.classList.toggle('dark-mode', isDark);
            root.style.colorScheme = theme();
            if (body) {
                body.dataset.theme = theme();
                body.classList.toggle('dark-mode', isDark);
            }
            return () => {
                if (previousRootTheme) {
                    root.dataset.theme = previousRootTheme;
                }
                else {
                    delete root.dataset.theme;
                }
                root.classList.toggle('dark-mode', previousRootDarkMode);
                root.style.colorScheme = previousColorScheme;
                if (body) {
                    if (previousBodyTheme) {
                        body.dataset.theme = previousBodyTheme;
                    }
                    else {
                        delete body.dataset.theme;
                    }
                    body.classList.toggle('dark-mode', previousBodyDarkMode);
                }
            };
        });
        if (typeof _cleanup10 === "function")
            onCleanup(_cleanup10);
    }));
    createEffect(on(() => [id()], () => {
        const _cleanup11 = untrack(() => {
            if (id()) {
                const queryTheme = getPreviewThemeFromQuery();
                if (queryTheme) {
                    setTheme(queryTheme);
                }
                // Check sessionStorage for unsaved preview data
                const storedData = sessionStorage.getItem(`preview-${id()}`);
                if (storedData) {
                    try {
                        const parsed = normalizeLessonMedia(JSON.parse(storedData), API_BASE_URL);
                        setPreviewOverrides(parsed);
                        if (!queryTheme && (parsed.theme === 'dark' || parsed.theme === 'light')) {
                            setTheme(parsed.theme);
                        }
                        setHasSessionData(true);
                    }
                    catch (e) {
                        console.error('Failed to parse preview data:', e);
                    }
                }
                loadLesson(id());
            }
            else {
                setError('No lesson ID provided');
                setLoading(false);
            }
        });
        if (typeof _cleanup11 === "function")
            onCleanup(_cleanup11);
    }));
    const loadLesson = async (lessonId: string) => {
        try {
            setLoading(true);
            const result = /-(?:5|10)-review(?:-\d+)?$/.test(lessonId)
                ? await lessonApi.getCheckpointLessonMaterial(lessonId, classroomSessionId)
                : await lessonApi.getPublicLessonMaterial(lessonId);
            if (!result.success || !result.lesson) {
                throw new Error(result.error || 'Failed to load lesson preview');
            }
            setLesson(result.lesson as LessonMaterial);
            setError(null);
        }
        catch (err) {
            console.error('Failed to load lesson from API:', err);
            // Don't set error if we have session data - we can still preview
            if (!sessionStorage.getItem(`preview-${lessonId}`)) {
                setError('Failed to load lesson preview');
            }
        }
        finally {
            setLoading(false);
        }
    };
    const closePreview = () => {
        if (window.opener) {
            window.close();
            return;
        }
        _state1.route('/materials/conversational-skills');
    };
    return createMemo(() => {
        if (loading()) {
            return (<div class="csp-fullpage csp-loading">
        <div class="csp-loader">
          <div class="csp-loader-ring" aria-hidden="true"/>
          <p>Loading lesson, please wait...</p>
        </div>
      </div>);
        }
        // Only show error if we have no lesson AND no session data to preview
        if ((error() || !lesson()) && !hasSessionData()) {
            return (<div class="csp-fullpage csp-error">
        <TutorIcon name="ri-error-warning-line"/>
        <h2>{error() || 'Lesson not found'}</h2>
        <button onClick={closePreview}>Back to Materials</button>
      </div>);
        }
        // Apply overrides from sessionStorage if present, otherwise use saved lesson data (or defaults)
        const backgroundImage = createMemo(() => previewOverrides()?.backgroundImage ?? lesson()?.backgroundImage ?? '');
        const overlayColor = createMemo(() => previewOverrides()?.overlayColor ?? (lesson()?.overlayColor || '#134e4acc'));
        const chapterName = createMemo(() => previewOverrides()?.chapterName ?? lesson()?.chapterName ?? 'Preview');
        const lessonName = createMemo(() => previewOverrides()?.lessonName ?? lesson()?.lessonName ?? 'Untitled Lesson');
        const goalTextEn = createMemo(() => previewOverrides()?.goalTextEn ?? lesson()?.goalTextEn ?? '');
        const goalTextJp = createMemo(() => previewOverrides()?.goalTextJp ?? lesson()?.goalTextJp ?? '');
        // Introduction data: prioritize sessionStorage > saved lesson > default
        const introductionData: Accessor<IntroductionData> = createMemo(() => previewOverrides()?.introductionData ??
            lesson()?.introductionData ??
            DEFAULT_INTRODUCTION_DATA);
        // Learn data: prioritize sessionStorage > saved lesson > default
        const learnData: Accessor<LearnSectionData> = createMemo(() => previewOverrides()?.learnData ??
            lesson()?.learnData ??
            DEFAULT_LEARN_DATA);
        // Step B data: prioritize sessionStorage > saved lesson
        const stepBData: Accessor<StepBData | undefined> = createMemo(() => previewOverrides()?.stepBData ??
            lesson()?.stepBData);
        // Apply data: prioritize sessionStorage > saved lesson
        const applyData: Accessor<ApplySectionData | undefined> = createMemo(() => previewOverrides()?.applyData ??
            lesson()?.applyData);
        // Exercise data: prioritize sessionStorage > saved lesson
        const exerciseData: Accessor<ExerciseSectionData | undefined> = createMemo(() => previewOverrides()?.exerciseData ??
            (lesson() as any)?.exerciseData);
        // Mission data: prioritize sessionStorage > saved lesson
        const missionData: Accessor<MissionSectionData | undefined> = createMemo(() => previewOverrides()?.missionData ??
            (lesson() as any)?.missionData);
        // Mission data 2 (Challenge 2 / Discussion): prioritize sessionStorage > saved lesson
        const missionData2: Accessor<MissionSectionData | undefined> = createMemo(() => previewOverrides()?.missionData2 ??
            (lesson() as any)?.missionData2);
        const missionData3: Accessor<MissionSectionData | undefined> = createMemo(() => previewOverrides()?.missionData3 ??
            (lesson() as any)?.missionData3);
        // Feedback data: prioritize sessionStorage > saved lesson
        const feedbackData: Accessor<FeedbackSectionData | undefined> = createMemo(() => previewOverrides()?.feedbackData ??
            (lesson() as any)?.feedbackData);
        // Get lesson metadata with fallbacks for unpublished lessons
        const levelBadge = createMemo(() => lesson()?.levelBadge ?? 'L1');
        const skill = createMemo(() => lesson()?.skill ?? 'speaking');
        const chapter = createMemo(() => lesson()?.chapter ?? 1);
        const lessonNumber = createMemo(() => lesson()?.lessonNumber ?? 1);
        const toggleTheme = () => {
            const next = theme() === 'dark' ? 'light' : 'dark';
            setTheme(next);
            try {
                localStorage.setItem('csve-theme', next);
            }
            catch { }
        };
        return (<div class={`csp-fullpage csp-${theme()}${missionData3() ? ' csp-checkpoint' : ''}`}>
      {/* Top Navigation Bar */}
      <nav class="csp-topbar">
        <div class="csp-topbar-content">
          <span class="csp-course-info">
            Conversational Skills {levelBadge()} | {skill().toUpperCase()} | Chapter {chapter()}: {chapterName()}
          </span>
        </div>
      </nav>

      {/* Hero Header Section */}
      <header class="csp-hero" style={cssStyle({
                get backgroundImage() {
                    return backgroundImage() ? `url(${backgroundImage()})` : undefined;
                }
            })}>
        <div class="csp-hero-overlay" style={cssStyle({ get backgroundColor() {
                    return overlayColor();
                } })}/>
        <div class="csp-hero-content">
          <p class="csp-lesson-label">Lesson {lessonNumber()}</p>
          <h1 class="csp-lesson-name">{lessonName()}</h1>

          <div class="csp-goal-wrapper">
            <div class="csp-goal-row">
              <span class="csp-goal-badge">LESSON OBJECTIVE</span>
              <p class="csp-goal-en">{goalTextEn()}</p>
            </div>
            <p class="csp-goal-jp">{goalTextJp()}</p>
          </div>
        </div>
      </header>

      {/* Content Sections */}
      <main class="csp-main">
        <div class="csp-sections">
          {/* Introduction Section */}
          <IntroductionSection data={introductionData()}/>

          {/* Learn/Present Section - Vocabulary/Expressions */}
          <LearnSection data={learnData()}/>

          {/* Step B Section - Speak Your Mind / Grammar Tip / Pronunciation */}
          {stepBData() && <StepBSection data={stepBData()}/>}

          {/* Apply Section - Speaking/Understanding */}
          {applyData() && <ApplySection data={applyData()}/>}

          {/* Exercise Section */}
          {exerciseData() && <ExerciseSection data={exerciseData()} sessionId={classroomSessionId} lessonId={id()}/>}

          {/* Mission Section (Challenge 1) */}
          {missionData() && <MissionSection data={missionData()}/>}

          {/* Mission Section 2 (Challenge 2 / Discussion) */}
          {missionData2() && <MissionSection data={missionData2()} hideHeader/>}

          {missionData3() && <MissionSection data={missionData3()} hideHeader/>}

          {/* Feedback Section */}
          {feedbackData() && <FeedbackSection data={feedbackData()}/>}
        </div>
      </main>

      {/* Close Button */}
      <button class="csp-theme-btn" onClick={toggleTheme} title={`Switch to ${theme() === 'dark' ? 'light' : 'dark'} theme`}>
        <TutorIcon name={theme() === 'dark' ? 'ri-sun-line' : 'ri-moon-line'}/>
        <span>{theme() === 'dark' ? 'Light' : 'Dark'}</span>
      </button>

      <button class="csp-close-btn" onClick={closePreview} title="Close Preview">
        <TutorIcon name="ri-close-line"/>
      </button>
    </div>);
    }) as unknown as JSX.Element;
}
// ============================================================================
// INTRODUCTION SECTION COMPONENT
// ============================================================================
interface IntroductionSectionProps {
    data: IntroductionData;
}
function IntroductionSection(_props2: IntroductionSectionProps) {
    return (<section class="csp-intro-section">
      <div class="csp-intro-layout">
        {/* Left Column - Main Content */}
        <div class="csp-intro-left">
          {/* FIXED: Section number and title */}
          <div class="csp-section-number">
            <span class="csp-number-badge">1</span>
            <h2 class="csp-section-title">INTRODUCE</h2>
            <div class="csp-section-line"/>
          </div>

          {/* EDITABLE: Intro texts (supports multiple languages) */}
          {_props2["data"].introTexts.map((introText, i) => (<p class="csp-intro-text" data-lang={introText.language}>
              {introText.text}
            </p>))}

          {/* EDITABLE: Optional intro image */}
          {_props2["data"].introImage && (<div class="csp-intro-image">
              <img src={_props2["data"].introImage} alt="Introduction visual"/>
            </div>)}
        </div>

        {/* Right Column - Tutor Guide */}
        <div class="csp-intro-right">
          <div class="csp-intro-right-sticky">
            {/* EDITABLE & OPTIONAL: Lesson Issue Box - only shown if data exists */}
            {_props2["data"].lessonIssue && (<div class="csp-lesson-issue">
                {/* FIXED: Header structure and badges */}
                <div class="csp-issue-header">
                  <span>THIS LESSON'S ISSUE</span>
                  <div class="csp-issue-badges">
                    <small>For tutors only.</small>
                    <small class="csp-warning">DO NOT SHARE WITH THE STUDENT!</small>
                  </div>
                </div>
                {/* EDITABLE: Title and points */}
                <div class="csp-issue-content">
                  <h3>{_props2["data"].lessonIssue.title}</h3>
                  <ul>
                    {_props2["data"].lessonIssue.points.map((point, i) => (<li>{point}</li>))}
                  </ul>
                </div>
              </div>)}

            {/* Lesson Goal Box */}
            <div class="csp-lesson-goal-box">
              {/* FIXED: "LESSON GOAL" label, EDITABLE: duration */}
              <div class="csp-goal-header">LESSON OBJECTIVE ({_props2["data"].lessonGoalDuration})</div>
              {/* EDITABLE: Steps */}
              <div class="csp-goal-steps">
                {_props2["data"].lessonGoalSteps.map((step, i) => (<div class="csp-goal-step">
                    <span class="csp-step-number">{i + 1}</span>
                    <div class="csp-step-content">
                      {/* EDITABLE: Instruction text */}
                      <p class="csp-step-instruction">{step.instruction}</p>
                      {/* EDITABLE & OPTIONAL: Script text */}
                      {step.script && (<p class="csp-step-script">
                          "{step.script}"
                        </p>)}
                      {/* EDITABLE & OPTIONAL: Question/Tip box */}
                      {step.question && (<div class="csp-step-question">
                          {step.question}
                        </div>)}
                    </div>
                  </div>))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>);
}
// ============================================================================
// LEARN SECTION COMPONENT (Section 2 - Vocabulary Template)
// ============================================================================
interface LearnSectionProps {
    data: LearnSectionData;
}
function LearnSection(_props3: LearnSectionProps) {
    // Helper to render text with highlighted word (for vocabulary)
    const renderHighlightedText = (text: string, highlightedWord?: string) => {
        if (!highlightedWord)
            return text;
        const parts = text.split(new RegExp(`(${highlightedWord})`, 'gi'));
        return parts.map((part, i) => part.toLowerCase() === highlightedWord.toLowerCase()
            ? <span class="csp-highlight">{part}</span>
            : part);
    };
    // Render vocabulary content
    const renderVocabularyContent = (step: LearnStepData) => (<>
      {/* Part Label */}
      <div class="csp-part-label">
        <p class="csp-part-english">{step.partLabel}</p>
        <p class="csp-part-translation">{step.partTranslation}</p>
      </div>

      {/* Vocabulary Grid */}
      <div class="csp-vocab-grid">
        {(step.vocabularyItems || []).map((item, i) => (<div class="csp-vocab-card">
            <div class="csp-vocab-image">
              {item.image ? (<img src={item.image} alt={item.englishText}/>) : (<div class="csp-image-placeholder">
                  <span class="csp-placeholder-dims">150 × 100</span>
                </div>)}
            </div>
            <p class="csp-vocab-english">
              {renderHighlightedText(item.englishText, item.highlightedWord)}
            </p>
            <p class="csp-vocab-translation">{item.translation}</p>
          </div>))}
      </div>

      {/* Part II - Discussion (shared for vocabulary and expressions) */}
      {step.discussionPart && renderDiscussionPart(step)}

      {/* Part III - Pronunciation (shared) */}
      {step.pronunciationPart && renderPronunciationPart(step)}
    </>);
    // Render expressions content - uses rich text HTML
    const renderExpressionsContent = (step: LearnStepData) => (<>
      {/* Part I - Expressions */}
      <div class="csp-part-label">
        <p class="csp-part-english">{step.partLabel}</p>
        <p class="csp-part-translation">{step.partTranslation}</p>
      </div>

      {/* Expressions List */}
      <div class="csp-expr-list">
        {(step.expressionItems || []).map((item, i) => (<div class="csp-expr-item">
            <div class="csp-expr-image">
              {item.image ? (<img src={item.image} alt="expression"/>) : (<div class="csp-image-placeholder">
                  <span class="csp-placeholder-dims">200 × 150</span>
                </div>)}
            </div>
            <div class="csp-expr-content">
              <p class="csp-expr-definition">
                <span class="csp-expr-number">{i + 1}.</span>
                {' '}
                <span innerHTML={{ __html: item.definitionLine }.__html}/>
              </p>
              <p class="csp-expr-example" innerHTML={{ __html: item.exampleSentence }.__html}/>
              {item.translation && (<p class="csp-expr-translation" style={cssStyle({ fontStyle: 'italic', color: '#666', marginTop: '4px' })}>
                  {item.translation}
                </p>)}
              {item.extraText && (<p class="csp-expr-extra" innerHTML={{ __html: item.extraText }.__html}/>)}
            </div>
          </div>))}
      </div>

      {/* Part II - Discussion */}
      {step.discussionPart && renderDiscussionPart(step)}

      {/* Part III - Pronunciation */}
      {step.pronunciationPart && renderPronunciationPart(step)}
    </>);
    // Render Discussion Part (shared for vocabulary and expressions)
    const renderDiscussionPart = (step: LearnStepData) => (<div class="csp-discuss-part">
      <p class="csp-discuss-instruction">{step.discussionPart!.instruction}</p>
      {step.discussionPart!.instructionTranslation && (<p class="csp-discuss-instruction-trans">{step.discussionPart!.instructionTranslation}</p>)}

      {/* Images Grid - Up to 3 images horizontally */}
      {step.discussionPart!.images && step.discussionPart!.images.length > 0 && (<div class={`csp-discuss-images csp-discuss-images-${step.discussionPart!.images.length}`}>
          {step.discussionPart!.images.map((img, imgIdx) => (<div class="csp-discuss-image-item">
              <div class="csp-discuss-image">
                {img.image ? (<img src={img.image} alt={img.label || 'Discussion'}/>) : (<div class="csp-image-placeholder">
                    <span class="csp-placeholder-dims">300 × 200</span>
                  </div>)}
              </div>
              {img.label && <p class="csp-discuss-img-label">{img.label}</p>}
              {img.translation && <p class="csp-discuss-img-translation">{img.translation}</p>}
            </div>))}
        </div>)}
    </div>);
    // Render Pronunciation Part (shared for vocabulary and expressions)
    const renderPronunciationPart = (step: LearnStepData) => {
        // Dynamic numeral: II if no discussion, III if discussion exists
        const numeral = step.discussionPart ? 'III' : 'II';
        return (<div class="csp-pronunciation-part">
        <p class="csp-pronunciation-instruction">{numeral}. {step.pronunciationPart!.instruction}</p>
        <p class="csp-pronunciation-instruction-trans">{step.pronunciationPart!.instructionTranslation}</p>

        <div class="csp-pronunciation-table">
          {/* Left Column */}
          <div class="csp-pronunciation-column">
            <p class="csp-pronunciation-sound">{step.pronunciationPart!.leftColumn.soundSymbol}</p>
            <div class="csp-pronunciation-images">
              {step.pronunciationPart!.leftColumn.images.map((img, i) => (img ? <img src={img} alt="mouth position"/> : (<div class="csp-pronunciation-img-placeholder">
                    <span>120 × 90</span>
                  </div>)))}
            </div>
            <div class="csp-pronunciation-words">
              {step.pronunciationPart!.leftColumn.words.map((word, i) => (<div class="csp-pronunciation-word-item">
                  <p class={`csp-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}>{word.word}</p>
                  <p class="csp-pronunciation-trans">{word.translation}</p>
                </div>))}
            </div>
          </div>

          {/* Right Column */}
          <div class="csp-pronunciation-column">
            <p class="csp-pronunciation-sound">{step.pronunciationPart!.rightColumn.soundSymbol}</p>
            <div class="csp-pronunciation-images">
              {step.pronunciationPart!.rightColumn.images.map((img, i) => (img ? <img src={img} alt="mouth position"/> : (<div class="csp-pronunciation-img-placeholder">
                    <span>120 × 90</span>
                  </div>)))}
            </div>
            <div class="csp-pronunciation-words">
              {step.pronunciationPart!.rightColumn.words.map((word, i) => (<div class="csp-pronunciation-word-item">
                  <p class={`csp-pronunciation-word ${word.isHighlighted ? 'highlighted' : ''}`}>{word.word}</p>
                  <p class="csp-pronunciation-trans">{word.translation}</p>
                </div>))}
            </div>
          </div>
        </div>
      </div>);
    };
    return (<section class="csp-learn-section">
      {/* Section Header */}
      <div class="csp-section-number">
        <span class="csp-number-badge">2</span>
        <h2 class="csp-section-title">{_props3["data"].sectionTitle}</h2>
        <div class="csp-section-line"/>
      </div>

      {/* Render each step */}
      {_props3["data"].steps.map((step, stepIndex) => (<div class="csp-learn-step">
          {/* Step Name */}
          <h3 class="csp-step-name">{step.stepName}</h3>

          {/* Two-column layout: Content + Tutor Guide */}
          <div class="csp-learn-layout">
            {/* Left Column - Main Content */}
            <div class="csp-learn-left">
              {step.stepType === 'expressions'
                ? renderExpressionsContent(step)
                : renderVocabularyContent(step)}
            </div>

            {/* Right Column - Tutor Guides */}
            <div class="csp-learn-right">
              {/* Part I Tutor Guide */}
              <div class="csp-tutor-guide">
                {/* Header - matches Lesson Goal style */}
                <div class="csp-guide-header">
                  {_props3["data"].sectionTitle} - {step.stepName.split(' ').slice(0, 2).join(' ')} ({step.duration})
                </div>
                {/* Steps */}
                <div class="csp-guide-steps">
                  {step.tutorSteps.map((tutorStep, i) => (<div class="csp-guide-step">
                      <span class="csp-guide-number">{i + 1}</span>
                      <div class="csp-guide-content">
                        <p class="csp-guide-instruction">{tutorStep.instruction}</p>
                        {tutorStep.script && (<p class="csp-guide-script">
                            "{tutorStep.script}"
                          </p>)}
                        {tutorStep.tip && (<div class="csp-guide-tip">
                            {tutorStep.tip}
                          </div>)}
                      </div>
                    </div>))}
                </div>
              </div>

              {/* Part II - Discussion Tutor Guide */}
              {step.discussionPart?.tutorSteps && step.discussionPart.tutorSteps.length > 0 && (<div class="csp-tutor-guide csp-part-tutor-guide">
                  <div class="csp-guide-header">
                    Part II - Discussion
                  </div>
                  <div class="csp-guide-steps">
                    {step.discussionPart.tutorSteps.map((tutorStep, i) => (<div class="csp-guide-step">
                        <span class="csp-guide-number">{i + 1}</span>
                        <div class="csp-guide-content">
                          <p class="csp-guide-instruction">{tutorStep.instruction}</p>
                          {tutorStep.script && (<p class="csp-guide-script">
                              "{tutorStep.script}"
                            </p>)}
                          {tutorStep.tip && (<div class="csp-guide-tip">
                              {tutorStep.tip}
                            </div>)}
                        </div>
                      </div>))}
                  </div>
                </div>)}

              {/* Part III - Pronunciation Tutor Guide */}
              {step.pronunciationPart?.tutorSteps && step.pronunciationPart.tutorSteps.length > 0 && (<div class="csp-tutor-guide csp-part-tutor-guide">
                  <div class="csp-guide-header">
                    Part {step.discussionPart ? 'III' : 'II'} - Pronunciation
                  </div>
                  <div class="csp-guide-steps">
                    {step.pronunciationPart.tutorSteps.map((tutorStep, i) => (<div class="csp-guide-step">
                        <span class="csp-guide-number">{i + 1}</span>
                        <div class="csp-guide-content">
                          <p class="csp-guide-instruction">{tutorStep.instruction}</p>
                          {tutorStep.script && (<p class="csp-guide-script">
                              "{tutorStep.script}"
                            </p>)}
                          {tutorStep.tip && (<div class="csp-guide-tip">
                              {tutorStep.tip}
                            </div>)}
                        </div>
                      </div>))}
                  </div>
                </div>)}
            </div>
          </div>
        </div>))}
    </section>);
}
// ============================================================================
// STEP B SECTION COMPONENT (Speak Your Mind / Grammar Tip / Pronunciation)
// ============================================================================
interface StepBSectionProps {
    data: StepBData;
}
function StepBSection(_props4: StepBSectionProps) {
    // Get current step name and duration based on type
    const getStepName = () => {
        if (_props4["data"].stepType === 'speak-your-mind' && _props4["data"].speakYourMind) {
            return _props4["data"].speakYourMind.stepName;
        }
        if (_props4["data"].stepType === 'grammar-tip' && _props4["data"].grammarTip) {
            return _props4["data"].grammarTip.stepName;
        }
        if (_props4["data"].stepType === 'pronunciation' && _props4["data"].pronunciation) {
            return _props4["data"].pronunciation.stepName;
        }
        return 'STEP B';
    };
    const getDuration = () => {
        if (_props4["data"].stepType === 'speak-your-mind' && _props4["data"].speakYourMind) {
            return _props4["data"].speakYourMind.duration;
        }
        if (_props4["data"].stepType === 'grammar-tip' && _props4["data"].grammarTip) {
            return _props4["data"].grammarTip.duration;
        }
        if (_props4["data"].stepType === 'pronunciation' && _props4["data"].pronunciation) {
            return _props4["data"].pronunciation.duration;
        }
        return '1 minute';
    };
    const getTutorSteps = () => {
        if (_props4["data"].stepType === 'speak-your-mind' && _props4["data"].speakYourMind) {
            return _props4["data"].speakYourMind.tutorSteps;
        }
        if (_props4["data"].stepType === 'grammar-tip' && _props4["data"].grammarTip) {
            return _props4["data"].grammarTip.tutorSteps;
        }
        if (_props4["data"].stepType === 'pronunciation' && _props4["data"].pronunciation) {
            return _props4["data"].pronunciation.tutorSteps;
        }
        return [];
    };
    // Get tutor guide header based on type
    const getTutorGuideHeader = () => {
        return 'PRESENT';
    };
    // Render Speak Your Mind content
    const renderSpeakYourMindContent = () => {
        const speakData = _props4["data"].speakYourMind!;
        return (<>
        {/* Explanation */}
        <p class="csp-stepb-explanation">{speakData.explanation}</p>
        {speakData.explanationTranslation && (<p class="csp-stepb-explanation-trans">{speakData.explanationTranslation}</p>)}

        {/* Conversation */}
        <div class="csp-conversation">
          {/* Speaker 1 - Left side */}
          <div class="csp-conversation-row csp-speaker-left">
            <div class="csp-speaker-image">
              {speakData.speaker1.image ? (<img src={speakData.speaker1.image} alt="Speaker 1"/>) : (<div class="csp-image-placeholder">
                  <span class="csp-placeholder-dims">150 × 150</span>
                </div>)}
            </div>
            <div class="csp-speech-bubble csp-speech-left">
              <p innerHTML={{ __html: speakData.speaker1.speechBubble }.__html}/>
            </div>
          </div>

          {/* Speaker 2 - Right side */}
          <div class="csp-conversation-row csp-speaker-right">
            <div class="csp-speech-bubble csp-speech-right">
              <p innerHTML={{ __html: speakData.speaker2.speechBubble }.__html}/>
            </div>
            <div class="csp-speaker-image">
              {speakData.speaker2.image ? (<img src={speakData.speaker2.image} alt="Speaker 2"/>) : (<div class="csp-image-placeholder">
                  <span class="csp-placeholder-dims">150 × 150</span>
                </div>)}
            </div>
          </div>
        </div>

        {/* Question - only show if there is one */}
        {speakData.question && (<div class="csp-stepb-question">
            <span class="csp-question-bullet">•</span>
            <p>{speakData.question}</p>
          </div>)}
      </>);
    };
    // Render Grammar Tip content
    const renderGrammarTipContent = () => {
        const grammarData = _props4["data"].grammarTip!;
        return (<div class="csp-grammar-blocks">
        {grammarData.explanations.map((expl, explIdx) => (<div class="csp-grammar-block">
            {/* Rule text with rich formatting */}
            <p class="csp-grammar-rule" innerHTML={{ __html: expl.ruleText }.__html}/>

            {/* Rule translation */}
            <p class="csp-grammar-translation">{expl.ruleTranslation}</p>

            {/* Examples box (if any) */}
            {expl.examples && expl.examples.length > 0 && (<div class="csp-grammar-examples">
                <p class="csp-examples-title">{expl.examplesTitle || 'EXAMPLES'}</p>
                <ul class="csp-examples-list">
                  {expl.examples.map((ex, exIdx) => (<li class="csp-example-item">
                      <p class="csp-example-sentence" innerHTML={{ __html: ex.sentence }.__html}/>
                      <p class="csp-example-translation">{ex.translation}</p>
                    </li>))}
                </ul>
              </div>)}
          </div>))}
      </div>);
    };
    // Render Pronunciation content
    const renderPronunciationContent = () => {
        const pronData = _props4["data"].pronunciation!;
        return (<>
        {/* Tip */}
        <p class="csp-pronunciation-tip" innerHTML={{ __html: pronData.tip }.__html}/>

        {/* Phrases Table */}
        <div class="csp-pronunciation-phrases-table">
          <div class="csp-phrases-header">
            <div class="csp-phrases-col-phrase">Phrase</div>
            <div class="csp-phrases-col-example">Example</div>
          </div>
          {pronData.phrases.map((phrase, phraseIdx) => (<div class="csp-phrases-row">
              <div class="csp-phrases-col-phrase">
                <p class="csp-phrase-text">{phrase.phrase}</p>
                <p class="csp-phrase-guide">{phrase.pronunciationGuide}</p>
              </div>
              <div class="csp-phrases-col-example">
                <p innerHTML={{ __html: phrase.exampleSentence }.__html}/>
              </div>
            </div>))}
        </div>
      </>);
    };
    const tutorSteps = getTutorSteps();
    return (<section class="csp-stepb-section">
      {/* Step Name */}
      <h3 class="csp-step-name">{getStepName()}</h3>

      {/* Two-column layout: Content + Tutor Guide */}
      <div class="csp-stepb-layout">
        {/* Left Column - Main Content */}
        <div class="csp-stepb-left">
          {_props4["data"].stepType === 'speak-your-mind' && _props4["data"].speakYourMind && renderSpeakYourMindContent()}
          {_props4["data"].stepType === 'grammar-tip' && _props4["data"].grammarTip && renderGrammarTipContent()}
          {_props4["data"].stepType === 'pronunciation' && _props4["data"].pronunciation && renderPronunciationContent()}
        </div>

        {/* Right Column - Tutor Guide */}
        <div class="csp-stepb-right">
          <div class="csp-tutor-guide">
            <div class="csp-guide-header">
              {getTutorGuideHeader()} - {getStepName().split(' ').slice(0, 2).join(' ')} ({getDuration()})
            </div>
            <div class="csp-guide-steps">
              {tutorSteps.map((tutorStep, i) => (<div class="csp-guide-step">
                  <span class="csp-guide-number">{i + 1}</span>
                  <div class="csp-guide-content">
                    <p class="csp-guide-instruction">{tutorStep.instruction}</p>
                    {tutorStep.script && (<p class="csp-guide-script">
                        "{tutorStep.script}"
                      </p>)}
                    {tutorStep.tip && (<div class="csp-guide-tip">
                        {tutorStep.tip}
                      </div>)}
                  </div>
                </div>))}
            </div>
          </div>
        </div>
      </div>
    </section>);
}
// ============================================================================
// APPLY SECTION COMPONENT (Section 3 - Speaking/Understanding)
// ============================================================================
interface ApplySectionProps {
    data: ApplySectionData;
}
function ApplySection(_props5: ApplySectionProps) {
    return (<section class="csp-apply-section">
      {/* Section Header */}
      <div class="csp-section-number">
        <span class="csp-number-badge">{_props5["data"].sectionNumber}</span>
        <h2 class="csp-section-title">{_props5["data"].sectionTitle}</h2>
        <div class="csp-section-line"/>
      </div>

      {/* Activity Title */}
      <h3 class="csp-apply-activity-title">{_props5["data"].activityTitle}</h3>

      <div class="csp-apply-layout">
        {/* Left Column - Main Content */}
        <div class="csp-apply-left">
          {/* Situation Text */}
          <p class="csp-apply-situation">{_props5["data"].situationText}</p>
          {_props5["data"].situationTranslation && (<p class="csp-mission-translation">{_props5["data"].situationTranslation}</p>)}

          {/* Situation Image */}
          {_props5["data"].situationImage && (<div class="csp-apply-image">
              <img src={_props5["data"].situationImage} alt="Situation"/>
            </div>)}

          {/* Dialogue Lines (SPEAKING only) */}
          {_props5["data"].activityType === 'speaking' && _props5["data"].dialogueLines.length > 0 && (<div class="csp-dialogue-lines">
            {_props5["data"].dialogueLines.map((line, lineIdx) => (<div class={`csp-dialogue-line ${line.isAction ? 'csp-dialogue-action' : ''}`}>
                <span class="csp-dialogue-speaker">{line.speaker}:</span>
                {line.isAction ? (<span class="csp-dialogue-text csp-action-text">{line.text}</span>) : (<span class="csp-dialogue-text" innerHTML={{ __html: line.text }.__html}/>)}
              </div>))}
          </div>)}

          {/* Reading Text (READING only) */}
          {_props5["data"].activityType === 'reading' && (_props5["data"].readingText || _props5["data"].readingImage) && (<div class="csp-reading-text-box">
              {_props5["data"].readingImage && (<div class="csp-reading-image">
                  <img src={_props5["data"].readingImage} alt="Reading"/>
                  {_props5["data"].readingImageLabel && (<div class="csp-reading-image-label" innerHTML={{ get __html() {
                            return _props5["data"].readingImageLabel;
                        } }.__html}/>)}
                </div>)}
              {_props5["data"].readingText && (<div class="csp-reading-text-content" innerHTML={{ get __html() {
                        return _props5["data"].readingText;
                    } }.__html}/>)}
            </div>)}
        </div>

        {/* Right Column - Tutor Guide */}
        <div class="csp-apply-right">
          <div class="csp-tutor-guide csp-apply-guide">
            <div class="csp-guide-header">
              {_props5["data"].sectionTitle} - {_props5["data"].activityTitle} ({_props5["data"].activityDuration})
            </div>
            <div class="csp-guide-steps">
              {_props5["data"].tutorSteps.map((step, stepIdx) => (<div class="csp-guide-step csp-apply-step">
                  <span class="csp-guide-number">{stepIdx + 1}</span>
                  <div class="csp-guide-content">
                    {/* Instruction */}
                    <p class="csp-guide-instruction">{step.instruction}</p>

                    {/* Scripts (green bullets) */}
                    {step.scripts && step.scripts.map((script, scriptIdx) => (<p class="csp-apply-script">
                        <span class="csp-script-bullet">●</span>
                        <span>"{script.text}"</span>
                      </p>))}

                    {/* Prompts (blue) */}
                    {step.prompts && step.prompts.map((prompt, promptIdx) => (<p class="csp-apply-prompt">
                        <span class="csp-prompt-bullet">▸</span>
                        <span>{prompt.text}</span>
                      </p>))}

                    {/* Tips (red text) */}
                    {step.tips && step.tips.map((tip, tipIdx) => (<p class="csp-apply-tip">
                        <span class="csp-tip-icon">◆</span>
                        <span>{tip.text}</span>
                      </p>))}

                    {/* Listening Script (green box - LISTENING only) */}
                    {step.listeningScript && (<div class="csp-listening-script-box" innerHTML={{ __html: step.listeningScript }.__html}/>)}

                    {/* Questions box */}
                    {step.questions && step.questions.length > 0 && (<div class="csp-apply-questions-box">
                        {step.questions.map((q, qIdx) => (<div class="csp-apply-question-item">
                            <span class="csp-question-bullet">•</span>
                            <div class="csp-question-content">
                              <p class="csp-question-text">{q.question}</p>
                              {q.answer && (<p class="csp-answer-text">({q.answer})</p>)}
                            </div>
                          </div>))}
                      </div>)}
                  </div>
                </div>))}
            </div>
          </div>
        </div>
      </div>

      {/* Trivia Time Section - Always Enabled */}
      {(_props5["data"].triviaText || _props5["data"].triviaImage || (_props5["data"].triviaTutorSteps && _props5["data"].triviaTutorSteps.length > 0)) && (<div class="csp-trivia-row">
          {/* Left - Trivia Box */}
          <div class="csp-trivia-left">
            <div class="csp-trivia-box-inner">
              <div class="csp-trivia-header">
                <TutorIcon name="ri-lightbulb-line"/>
                <span>TRIVIA TIME</span>
              </div>
              <div class="csp-trivia-body">
                {_props5["data"].triviaImage && (<div class="csp-trivia-image">
                    <img src={_props5["data"].triviaImage} alt="Trivia"/>
                  </div>)}
                {_props5["data"].triviaText && (<div class="csp-trivia-content" innerHTML={{ get __html() {
                        return _props5["data"].triviaText;
                    } }.__html}/>)}
                {_props5["data"].triviaTranslation && (<div class="csp-trivia-translation">
                    {_props5["data"].triviaTranslation}
                  </div>)}
              </div>
            </div>
          </div>

          {/* Right - Trivia Tutor Guide */}
          {_props5["data"].triviaTutorSteps && _props5["data"].triviaTutorSteps.length > 0 && (<div class="csp-trivia-right">
              <div class="csp-tutor-guide csp-trivia-guide">
                <div class="csp-guide-header csp-trivia-guide-header">
                  TRIVIA TIME ({_props5["data"].triviaDuration || '1 minute'})
                </div>
                <div class="csp-guide-steps">
                  {_props5["data"].triviaTutorSteps.map((step, stepIdx) => (<div class="csp-guide-step csp-apply-step">
                      <span class="csp-guide-number">{stepIdx + 1}</span>
                      <div class="csp-guide-content">
                        <p class="csp-guide-instruction">{step.instruction}</p>

                        {/* Scripts (green bullets) */}
                        {step.scripts && step.scripts.map((script, scriptIdx) => (<p class="csp-apply-script">
                            <span class="csp-script-bullet">●</span>
                            <span>"{script.text}"</span>
                          </p>))}

                        {/* Prompts (blue) */}
                        {step.prompts && step.prompts.map((prompt, promptIdx) => (<p class="csp-apply-prompt">
                            <span class="csp-prompt-bullet">▸</span>
                            <span>{prompt.text}</span>
                          </p>))}

                        {/* Questions Box */}
                        {step.questions && step.questions.length > 0 && (<div class="csp-apply-questions-box">
                            {step.questions.map((q, qIdx) => (<div class="csp-apply-question-item">
                                <span class="csp-question-bullet">•</span>
                                <div class="csp-question-content">
                                  <p class="csp-question-text">{q.question}</p>
                                  {q.answer && <p class="csp-answer-text">{q.answer}</p>}
                                </div>
                              </div>))}
                          </div>)}
                      </div>
                    </div>))}
                </div>
              </div>
            </div>)}
        </div>)}
    </section>);
}
// ============================================================================
// EXERCISE SECTION COMPONENT (Section 4)
// ============================================================================
function ExerciseSection(_props6: {
    data: ExerciseSectionData;
    sessionId?: string | null;
    lessonId?: string;
}) {
    const stepAType = createMemo(() => _props6["data"].stepAType || 'rephrase');
    const markingItems = createMemo(() => getMarkableExerciseItems(_props6["data"]));
    const canMark = createMemo(() => Boolean(_props6["sessionId"] && _props6["lessonId"]));
    const renderMarking = (step: 'A' | 'B') => (<ConversationalExerciseMarking sessionId={_props6["sessionId"]!} lessonId={_props6["lessonId"]!} step={step} items={markingItems()[step]} renderPrompt={item => {
            if (step === 'B' && item.itemType === 'multiple-choice') {
                const choice = _props6["data"].multipleChoiceItems?.[item.itemIndex];
                return <div>
            <strong>{choice?.boldSentence}</strong>
            <div class="csp-mc-options">
              <p class="csp-mc-option"><span class="csp-mc-label">a.</span> <span innerHTML={{ __html: choice?.optionA || '' }.__html}/></p>
              <p class="csp-mc-option"><span class="csp-mc-label">b.</span> <span innerHTML={{ __html: choice?.optionB || '' }.__html}/></p>
            </div>
          </div>;
            }
            const image = step === 'A' && item.itemType === 'rephrase'
                ? _props6["data"].exerciseItems[item.itemIndex]?.image
                : step === 'B' && item.itemType === 'conversation'
                    ? _props6["data"].conversations?.[item.itemIndex]?.speakerImage
                    : step === 'B' && item.itemType === 'speech' ? _props6["data"].speechSpeakerImage : null;
            const imageOnRight = step === 'B' && item.itemType === 'conversation'
                && _props6["data"].conversations?.[item.itemIndex]?.position === 'right';
            return <div class={`csp-marking-prompt-content${imageOnRight ? ' csp-marking-prompt-content--image-right' : ''}`}>
          {image && <div class="csp-exercise-item-image"><img src={image} alt={`Exercise ${item.itemIndex + 1}`}/></div>}
          <span class="csp-item-sentence" innerHTML={{ __html: item.prompt }.__html}/>
        </div>;
        }}/>);
    return (<section class="csp-section csp-exercise-section">
      <div class="csp-section-number">
        <span class="csp-number-badge">{_props6["data"].sectionNumber}</span>
        <h2 class="csp-section-title">{_props6["data"].sectionTitle}</h2>
        <span class="csp-section-line"/>
      </div>

      <div class="csp-exercise-layout">
        {/* Left Column - Content */}
        <div class="csp-exercise-left">
          {/* STEP A Header - Only show if Step B is enabled */}
          {_props6["data"].hasStepB && (<h3 class="csp-step-name">{_props6["data"].stepAName || 'STEP A'}</h3>)}

          {/* Instructions */}
          <p class="csp-exercise-instructions" innerHTML={{ get __html() {
                return _props6["data"].instructions;
            } }.__html}/>
          {_props6["data"].instructionsTranslation && (<p class="csp-exercise-instructions-translation" innerHTML={{ get __html() {
                    return _props6["data"].instructionsTranslation;
                } }.__html}/>)}

          {/* REPHRASE TYPE CONTENT */}
          {stepAType() === 'rephrase' && (<>
          {/* Expression Box */}
          {_props6["data"].showExpressions && _props6["data"].expressions && _props6["data"].expressions.length > 0 && (<div class="csp-expression-box">
              {_props6["data"].expressions.map((expr, idx) => (<span class="csp-expression-item">{expr}</span>))}
            </div>)}

          {/* Info Box (Comparison Table) */}
          {_props6["data"].showInfoBox && _props6["data"].infoBox && (<div class="csp-info-box">
              <h4 class="csp-info-box-title">{_props6["data"].infoBox.title}</h4>
              <table class="csp-info-box-table">
                <thead>
                  <tr>
                    <th class="csp-info-box-row-label"></th>
                    {_props6["data"].infoBox.columns.map((col, colIdx) => (<th class="csp-info-box-header">{col.header}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {_props6["data"].infoBox.rowLabels.map((rowLabel, rowIdx) => (<tr>
                      <td class="csp-info-box-row-label">{rowLabel}</td>
                      {_props6["data"].infoBox!.columns.map((col, colIdx) => (<td class="csp-info-box-cell">{col.rows?.[rowIdx] || ''}</td>))}
                    </tr>))}
                </tbody>
              </table>
            </div>)}

          {/* Example */}
          {_props6["data"].showExample && (<div class="csp-exercise-example">
              <div class="csp-exercise-example-image">
                {_props6["data"].exampleImage ? (<img src={_props6["data"].exampleImage} alt="Example"/>) : (<div class="csp-image-placeholder">
                    <span class="csp-placeholder-dims">120 × 80</span>
                  </div>)}
              </div>
              <div class="csp-example-content">
                <p class="csp-example-sentence" innerHTML={{ get __html() {
                        return _props6["data"].exampleSentence;
                    } }.__html}/>
                <p class="csp-example-answer">
                  <span class="csp-arrow">→</span>
                  <span class="csp-answer-underline" innerHTML={{ get __html() {
                        return _props6["data"].exampleAnswer;
                    } }.__html}/>
                </p>
              </div>
            </div>)}

          {/* Exercise Items */}
          <div class="csp-exercise-items">
            {canMark() ? renderMarking('A') : _props6["data"].exerciseItems.map((item, idx) => (<div class="csp-exercise-item">
                <div class="csp-exercise-item-image">
                  {item.image ? (<img src={item.image} alt={`Exercise ${idx + 1}`}/>) : (<div class="csp-image-placeholder">
                      <span class="csp-placeholder-dims">120 × 80</span>
                    </div>)}
                </div>
                <div class="csp-exercise-item-text">
                  <span class="csp-item-number">{idx + 1}.</span>
                  <span class="csp-item-sentence" innerHTML={{ __html: item.sentence }.__html}/>
                </div>
              </div>))}
          </div>
            </>)}

          {/* CHOOSE TYPE CONTENT */}
          {stepAType() === 'choose' && (<>
              {/* Choose Items List */}
              <div class="csp-choose-items">
                {canMark() ? renderMarking('A') : (_props6["data"].chooseItems || []).map((item, idx) => (<div class="csp-choose-item">
                    <span class="csp-item-number">{idx + 1}.</span>
                    <span class="csp-item-sentence" innerHTML={{ __html: item.sentence }.__html}/>
                  </div>))}
              </div>

              {/* Info Box (Comparison Table) */}
              {_props6["data"].showInfoBox && _props6["data"].infoBox && (<div class="csp-info-box">
                  <h4 class="csp-info-box-title">{_props6["data"].infoBox.title}</h4>
                  <table class="csp-info-box-table">
                    <thead>
                      <tr>
                        <th class="csp-info-box-row-label"></th>
                        {_props6["data"].infoBox.columns.map((col, colIdx) => (<th class="csp-info-box-header">{col.header}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {_props6["data"].infoBox.rowLabels.map((rowLabel, rowIdx) => (<tr>
                          <td class="csp-info-box-row-label">{rowLabel}</td>
                          {_props6["data"].infoBox!.columns.map((col, colIdx) => (<td class="csp-info-box-cell">{col.rows?.[rowIdx] || ''}</td>))}
                        </tr>))}
                    </tbody>
                  </table>
                </div>)}

              {/* Optional Image */}
              {_props6["data"].chooseImage && (<div class="csp-choose-image">
                  <img src={_props6["data"].chooseImage} alt="Exercise"/>
                </div>)}
            </>)}

          {/* CHANGE TYPE CONTENT */}
          {stepAType() === 'change' && (<>
              {/* Expression Box */}
              {_props6["data"].showExpressions && _props6["data"].expressions && _props6["data"].expressions.length > 0 && (<div class="csp-expression-box">
                  {_props6["data"].expressions.map((expr, idx) => (<span class="csp-expression-item">{expr}</span>))}
                </div>)}

              {/* Change Items List */}
              <div class="csp-change-items">
                {canMark() ? renderMarking('A') : (_props6["data"].changeItems || []).map((item, idx) => (<div class="csp-change-item">
                    <span class="csp-item-number">{idx + 1}.</span>
                    <span class="csp-change-text" innerHTML={{ __html: item.sentence }.__html}/>
                  </div>))}
              </div>

              {/* Optional Image */}
              {_props6["data"].changeImage && (<div class="csp-choose-image">
                  <img src={_props6["data"].changeImage} alt="Exercise"/>
                </div>)}
            </>)}
        </div>

        {/* Right Column - Tutor Guide */}
        <div class="csp-exercise-right">
          {/* Step A Tutor Guide */}
          <div class="csp-tutor-guide">
            <div class="csp-guide-header">
              {_props6["data"].hasStepB ? (_props6["data"].stepAName || 'STEP A') : _props6["data"].sectionTitle} ({_props6["data"].duration})
            </div>
            <div class="csp-guide-steps">
              {_props6["data"].tutorSteps.map((step, stepIdx) => (<div class="csp-guide-step csp-apply-step">
                  <span class="csp-guide-number">{stepIdx + 1}</span>
                  <div class="csp-guide-content">
                    <p class="csp-guide-instruction">{step.instruction}</p>

                    {/* Scripts (green bullets) */}
                    {step.scripts && step.scripts.map((script, scriptIdx) => (<p class="csp-apply-script">
                        <span class="csp-script-bullet">●</span>
                        <span>"{script.text}"</span>
                      </p>))}

                    {/* Prompts (blue) */}
                    {step.prompts && step.prompts.map((prompt, promptIdx) => (<p class="csp-apply-prompt">
                        <span class="csp-prompt-bullet">▸</span>
                        <span>{prompt.text}</span>
                      </p>))}

                    {/* Tips (red text) */}
                    {step.tips && step.tips.map((tip, tipIdx) => (<p class="csp-apply-tip">
                        <span class="csp-tip-icon">◆</span>
                        <span>{tip.text}</span>
                      </p>))}

                    {/* Answer Key Box */}
                    {step.answerKey && step.answerKey.length > 0 && (<div class="csp-tutor-answer-key-box">
                        <div class="csp-tutor-answer-key-header">ANSWER KEY</div>
                        <div class="csp-tutor-answer-key-items">
                          {step.answerKey.map((answer, answerIdx) => (<p class="csp-tutor-answer-key-item">
                              <span class="csp-tutor-answer-number">{answerIdx + 1}.</span>
                              <span>{answer.text}</span>
                            </p>))}
                        </div>
                      </div>)}
                  </div>
                </div>))}
            </div>
          </div>
        </div>
      </div>

      {/* STEP B ROW - Separate layout row for Step B */}
      {_props6["data"].hasStepB && (<div class="csp-exercise-layout csp-stepb-row">
          {/* Left Column - Step B Content */}
          <div class="csp-exercise-left">
            <div class="csp-stepb-section">
              <h3 class="csp-step-name csp-stepb-name">{_props6["data"].stepBName || 'STEP B'}</h3>

              {/* Step B Instruction */}
              <p class="csp-exercise-instructions">{_props6["data"].stepBInstruction}</p>
              {_props6["data"].stepBInstructionTranslation && (<p class="csp-exercise-instructions-translation">{_props6["data"].stepBInstructionTranslation}</p>)}

              {/* Conversation Type */}
              {(!_props6["data"].stepBType || _props6["data"].stepBType === 'conversation') && (<div class="csp-exercise-conversations">
                  {canMark() ? renderMarking('B') : (_props6["data"].conversations || []).map((conv, convIdx) => (<div class={`csp-exercise-conv-row csp-exercise-conv-${conv.position}`}>
                      {conv.position === 'left' && (<div class="csp-exercise-speaker-image">
                          {conv.speakerImage ? (<img src={conv.speakerImage} alt={`Speaker ${convIdx + 1}`}/>) : (<div class="csp-image-placeholder">
                              <span class="csp-placeholder-dims">150 × 150</span>
                            </div>)}
                        </div>)}

                      <div class="csp-exercise-speech-bubble">
                        <p innerHTML={{ __html: conv.speechBubble }.__html}/>
                      </div>

                      {conv.position === 'right' && (<div class="csp-exercise-speaker-image">
                          {conv.speakerImage ? (<img src={conv.speakerImage} alt={`Speaker ${convIdx + 1}`}/>) : (<div class="csp-image-placeholder">
                              <span class="csp-placeholder-dims">150 × 150</span>
                            </div>)}
                        </div>)}
                    </div>))}
                </div>)}

              {/* Multiple Choice Type */}
              {_props6["data"].stepBType === 'multiple-choice' && (<div class="csp-stepb-multiple-choice">
                  {canMark() ? renderMarking('B') : (_props6["data"].multipleChoiceItems || []).map((item, mcIdx) => (<div class="csp-mc-item">
                      <p class="csp-mc-sentence">
                        <span class="csp-mc-number">{mcIdx + 1}.</span>
                        <strong>{item.boldSentence}</strong>
                      </p>
                      <div class="csp-mc-options">
                        <p class="csp-mc-option"><span class="csp-mc-label">a.</span> <span innerHTML={{ __html: item.optionA }.__html}/></p>
                        <p class="csp-mc-option"><span class="csp-mc-label">b.</span> <span innerHTML={{ __html: item.optionB }.__html}/></p>
                      </div>
                    </div>))}

                  {/* Optional Image */}
                  {_props6["data"].multipleChoiceImage && (<div class="csp-mc-image">
                      <img src={_props6["data"].multipleChoiceImage} alt="Multiple choice"/>
                    </div>)}
                </div>)}

              {/* Speech Type - Single speaker with speech bubble */}
              {_props6["data"].stepBType === 'speech' && (<div class="csp-stepb-speech">
                  {canMark() ? renderMarking('B') : <div class="csp-speech-layout">
                    <div class="csp-speech-speaker-image">
                      {_props6["data"].speechSpeakerImage ? (<img src={_props6["data"].speechSpeakerImage} alt="Speaker"/>) : (<div class="csp-image-placeholder">
                          <span class="csp-placeholder-dims">150 × 200</span>
                        </div>)}
                    </div>
                    <div class="csp-speech-bubble">
                      <p innerHTML={{ get __html() {
                            return _props6["data"].speechContent || '';
                        } }.__html}/>
                    </div>
                  </div>}
                </div>)}

              {_props6["data"].stepBType === 'compare' && (<div class="csp-stepb-compare">
                  {(_props6["data"].compareWordBox || []).length > 0 && (<div class="csp-expression-box csp-compare-word-box">
                      {(_props6["data"].compareWordBox || []).map((word, wordIdx) => (<span class="csp-expression-item">{word}</span>))}
                    </div>)}

                  {(_props6["data"].compareImages || []).length > 0 && (<div class="csp-compare-images">
                      {(_props6["data"].compareImages || []).map((item, imageIdx) => (<div class="csp-compare-image-card">
                          <div class="csp-compare-image">
                            {item.image ? (<img src={item.image} alt={item.label || `Compare option ${imageIdx + 1}`}/>) : (<div class="csp-image-placeholder">
                                <span class="csp-placeholder-dims">160 × 120</span>
                              </div>)}
                          </div>
                          <p class="csp-compare-image-label">{item.label}</p>
                        </div>))}
                    </div>)}

                  {_props6["data"].compareExample && (<p class="csp-compare-example">
                      <span class="csp-arrow">→</span>
                      <span innerHTML={{ get __html() {
                            return _props6["data"].compareExample;
                        } }.__html}/>
                    </p>)}

                  {(_props6["data"].compareItems || []).length > 0 && (<div class="csp-compare-items">
                      {canMark() ? renderMarking('B') : (_props6["data"].compareItems || []).map((item, compareIdx) => (<div class="csp-compare-item">
                          <span class="csp-item-number">{compareIdx + 1}.</span>
                          <span class="csp-item-sentence" innerHTML={{ __html: item.sentence }.__html}/>
                        </div>))}
                    </div>)}
                </div>)}
            </div>
          </div>

          {/* Right Column - Step B Tutor Guide */}
          <div class="csp-exercise-right">
            {_props6["data"].stepBTutorSteps && (<div class="csp-tutor-guide csp-stepb-tutor-guide">
                <div class="csp-guide-header">
                  {_props6["data"].stepBName || 'STEP B'}
                </div>
                <div class="csp-guide-steps">
                  {_props6["data"].stepBTutorSteps.map((step, stepIdx) => (<div class="csp-guide-step csp-apply-step">
                      <span class="csp-guide-number">{stepIdx + 1}</span>
                      <div class="csp-guide-content">
                        <p class="csp-guide-instruction">{step.instruction}</p>

                        {/* Scripts (green bullets) */}
                        {step.scripts && step.scripts.map((script, scriptIdx) => (<p class="csp-apply-script">
                            <span class="csp-script-bullet">●</span>
                            <span>"{script.text}"</span>
                          </p>))}

                        {/* Prompts (blue) */}
                        {step.prompts && step.prompts.map((prompt, promptIdx) => (<p class="csp-apply-prompt">
                            <span class="csp-prompt-bullet">▸</span>
                            <span>{prompt.text}</span>
                          </p>))}

                        {/* Tips (red text) */}
                        {step.tips && step.tips.map((tip, tipIdx) => (<p class="csp-apply-tip">
                            <span class="csp-tip-icon">◆</span>
                            <span>{tip.text}</span>
                          </p>))}

                        {/* Answer Key Box */}
                        {step.answerKey && step.answerKey.length > 0 && (<div class="csp-tutor-answer-key-box">
                            <div class="csp-tutor-answer-key-header">ANSWER KEY</div>
                            <div class="csp-tutor-answer-key-items">
                              {step.answerKey.map((answer, answerIdx) => (<p class="csp-tutor-answer-key-item">
                                  <span class="csp-tutor-answer-number">{answerIdx + 1}.</span>
                                  <span>{answer.text}</span>
                                </p>))}
                            </div>
                          </div>)}
                      </div>
                    </div>))}
                </div>
              </div>)}
          </div>
        </div>)}
    </section>);
}
// ============================================================================
// MISSION SECTION COMPONENT (Section 5)
// ============================================================================
interface MissionSectionProps {
    data: MissionSectionData;
    hideHeader?: boolean;
}
/** Detect if a script line is tutor dialogue (numbered) */
const _isDlg = (t: string) => !t || /^\s*\d+[.):]/.test(t);
/** Format a script line: put quotes only around the spoken text, not the number prefix */
const _fmtScript = (text: string) => {
    const m = text.match(/^(\s*\d+[.):])\s*(.*)/);
    if (m)
        return <>{m[1]} "{m[2]}"</>;
    return <>"{text}"</>;
};
/** Merge scripts + prompts into a single interleaved list.
 *  Hints (prompts) are placed BEFORE each numbered question.
 *  Non-numbered scripts before the first question go at the top (intro),
 *  non-numbered scripts after the last question go at the bottom (closing). */
function interleaveStepContent(scripts: {
    text: string;
}[], prompts: {
    text: string;
}[]): {
    text: string;
    type: 'script' | 'prompt';
}[] {
    const items: {
        text: string;
        type: 'script' | 'prompt';
    }[] = [];
    let firstNum = -1;
    for (let i = 0; i < scripts.length; i++) {
        if (/^\s*\d+[.):]/.test(scripts[i].text)) {
            if (firstNum === -1)
                firstNum = i;
        }
    }
    const beforeScripts: {
        text: string;
    }[] = [];
    const numberedScripts: {
        text: string;
    }[] = [];
    const afterScripts: {
        text: string;
    }[] = [];
    for (let i = 0; i < scripts.length; i++) {
        if (/^\s*\d+[.):]/.test(scripts[i].text))
            numberedScripts.push(scripts[i]);
        else if (firstNum === -1 || i < firstNum)
            beforeScripts.push(scripts[i]);
        else
            afterScripts.push(scripts[i]);
    }
    // Intro scripts at top
    for (const s of beforeScripts) {
        items.push({ text: s.text, type: /^\s*\(/.test(s.text) ? 'prompt' : 'script' });
    }
    if (numberedScripts.length > 0 && prompts.length > 0) {
        const hintsPerQ = Math.ceil(prompts.length / numberedScripts.length);
        numberedScripts.forEach((q, idx) => {
            const start = idx * hintsPerQ;
            const end = idx === numberedScripts.length - 1 ? prompts.length : Math.min(start + hintsPerQ, prompts.length);
            for (let j = start; j < end; j++) {
                items.push({ text: prompts[j].text, type: 'prompt' });
            }
            items.push({ text: q.text, type: 'script' });
        });
    }
    else {
        for (const s of numberedScripts) {
            items.push({ text: s.text, type: 'script' });
        }
        for (const p of prompts) {
            items.push({ text: p.text, type: 'prompt' });
        }
    }
    // Closing scripts at bottom
    for (const s of afterScripts) {
        items.push({ text: s.text, type: /^\s*\(/.test(s.text) ? 'prompt' : 'script' });
    }
    return items;
}
function MissionSection(_props7: MissionSectionProps) {
    // Render speaking type content
    const renderSpeakingContent = () => (<>
      {/* Situation Box */}
      <div class="csp-mission-situation-box">
        <p class="csp-mission-situation" innerHTML={{ get __html() {
                return _props7["data"].situation;
            } }.__html}/>
        {_props7["data"].situationTranslation && (<p class="csp-mission-translation">{_props7["data"].situationTranslation}</p>)}
      </div>

      {/* Instruction (only for non-speaking types) */}
      {_props7["data"].instruction && (<div class="csp-mission-instruction-box">
        <p class="csp-mission-instruction" innerHTML={{ get __html() {
                    return _props7["data"].instruction;
                } }.__html}/>
        {_props7["data"].instructionTranslation && (<p class="csp-mission-translation">{_props7["data"].instructionTranslation}</p>)}
      </div>)}

      {/* Grammar Tip */}
      {_props7["data"].showGrammarTip && _props7["data"].grammarTipItems.length > 0 && (<div class="csp-mission-grammar-tip">
          <div class="csp-grammar-tip-header">
            <TutorIcon name="ri-lightbulb-line"/>
            <span>{_props7["data"].grammarTipTitle}</span>
          </div>
          <ul class="csp-grammar-tip-items">
            {_props7["data"].grammarTipItems.map((item, idx) => (<li>{item}</li>))}
          </ul>
        </div>)}

      {/* Image */}
      {_props7["data"].image && (<div class="csp-mission-image">
          <img src={_props7["data"].image} alt="Mission"/>
        </div>)}
    </>);
    // Render reading type content
    const renderReadingContent = () => (<>
      {/* Situation Box */}
      <div class="csp-mission-situation-box">
        <p class="csp-mission-situation" innerHTML={{ get __html() {
                return _props7["data"].situation;
            } }.__html}/>
        {_props7["data"].situationTranslation && (<p class="csp-mission-translation">{_props7["data"].situationTranslation}</p>)}
      </div>

      {/* Instruction */}
      <div class="csp-mission-instruction-box">
        <p class="csp-mission-instruction" innerHTML={{ get __html() {
                return _props7["data"].instruction;
            } }.__html}/>
        {_props7["data"].instructionTranslation && (<p class="csp-mission-translation">{_props7["data"].instructionTranslation}</p>)}
      </div>

      {/* Reading Passage */}
      {_props7["data"].readingPassage && (<div class="csp-mission-reading-passage">
          <div class="csp-reading-header" style={cssStyle({ get textAlign() {
                    return _props7["data"].readingPassage.headerAlignment || 'center';
                } })}>
            <h4 class="csp-reading-title">{_props7["data"].readingPassage.title}</h4>
            {_props7["data"].readingPassage.showAuthor !== false && _props7["data"].readingPassage.author && (<p class="csp-reading-author">by {_props7["data"].readingPassage.author}</p>)}
          </div>
          <div class="csp-reading-blocks">
            {(_props7["data"].readingPassage.blocks || []).map((block, idx) => (<div class="csp-reading-block">
                {block.type === 'paragraph' && block.content && (<p class="csp-reading-paragraph" innerHTML={{ __html: block.content }.__html}/>)}
                {block.type === 'images' && block.images && block.images.length > 0 && (<div class="csp-reading-images">
                    {block.images.map((img, imgIdx) => (<img src={img} alt="" class="csp-reading-image"/>))}
                  </div>)}
              </div>))}
          </div>
          {_props7["data"].readingPassage.closingQuestion && (<p class="csp-reading-closing-question">{_props7["data"].readingPassage.closingQuestion}</p>)}
        </div>)}

      {/* Grammar Tip */}
      {_props7["data"].showGrammarTip && _props7["data"].grammarTipItems.length > 0 && (<div class="csp-mission-grammar-tip">
          <div class="csp-grammar-tip-header">
            <TutorIcon name="ri-lightbulb-line"/>
            <span>{_props7["data"].grammarTipTitle}</span>
          </div>
          <ul class="csp-grammar-tip-items">
            {_props7["data"].grammarTipItems.map((item, idx) => (<li>{item}</li>))}
          </ul>
        </div>)}
    </>);
    // Render listening type content
    const renderListeningContent = () => (<>
      {/* Situation Box */}
      <div class="csp-mission-situation-box">
        <p class="csp-mission-situation" innerHTML={{ get __html() {
                return _props7["data"].situation;
            } }.__html}/>
        {_props7["data"].situationTranslation && (<p class="csp-mission-translation">{_props7["data"].situationTranslation}</p>)}
      </div>

      {/* Instruction (only for non-listening types) */}
      {_props7["data"].instruction && (<div class="csp-mission-instruction-box">
        <p class="csp-mission-instruction" innerHTML={{ get __html() {
                    return _props7["data"].instruction;
                } }.__html}/>
        {_props7["data"].instructionTranslation && (<p class="csp-mission-translation">{_props7["data"].instructionTranslation}</p>)}
      </div>)}

      {/* Image */}
      {_props7["data"].image && (<div class="csp-mission-image">
          <img src={_props7["data"].image} alt="Mission"/>
        </div>)}
    </>);
    // Render discussion type content
    const renderDiscussionContent = () => (<>
      {/* Situation Box */}
      <div class="csp-mission-situation-box">
        <p class="csp-mission-situation" innerHTML={{ get __html() {
                return _props7["data"].situation;
            } }.__html}/>
        {_props7["data"].situationTranslation && (<p class="csp-mission-translation">{_props7["data"].situationTranslation}</p>)}
      </div>

      {/* Instruction */}
      <div class="csp-mission-instruction-box">
        <p class="csp-mission-instruction" innerHTML={{ get __html() {
                return _props7["data"].instruction;
            } }.__html}/>
        {_props7["data"].instructionTranslation && (<p class="csp-mission-translation">{_props7["data"].instructionTranslation}</p>)}
      </div>

      {/* Topics Grid */}
      {_props7["data"].topics && _props7["data"].topics.length > 0 && (<div class="csp-mission-topics">
          {_props7["data"].topics.map((topic, topicIdx) => (<div class="csp-mission-topic-card">
              <div class="csp-mission-topic-header">
                <span class="csp-topic-label">TOPIC {topicIdx + 1}</span>
                <span class="csp-topic-title">{topic.title}</span>
              </div>
              <ol class="csp-mission-topic-questions">
                {topic.questions.map((q, qIdx) => (<li>{q}</li>))}
              </ol>
            </div>))}
        </div>)}
    </>);
    return (<section class="csp-mission-section">
      {/* Section Header */}
      {!(_props7["hideHeader"] === undefined ? false : _props7["hideHeader"]) && (<div class="csp-section-number">
          <span class="csp-number-badge">{_props7["data"].sectionNumber}</span>
          <h2 class="csp-section-title">{_props7["data"].sectionTitle}</h2>
          <div class="csp-section-line"/>
        </div>)}

      {/* Challenge Name */}
      <h3 class="csp-challenge-name">
        {_props7["data"].challengeName}
      </h3>

      <div class="csp-mission-layout">
        {/* Left Column - Student Content */}
        <div class="csp-mission-left">
          {_props7["data"].missionType === 'speaking' && renderSpeakingContent()}
          {_props7["data"].missionType === 'reading' && renderReadingContent()}
          {_props7["data"].missionType === 'listening' && renderListeningContent()}
          {_props7["data"].missionType === 'discussion' && renderDiscussionContent()}
        </div>

        {/* Right Column - Tutor Guide */}
        <div class="csp-mission-right">
          <div class="csp-tutor-guide">
            <div class="csp-guide-header">
              {_props7["data"].sectionTitle}
            </div>
            <div class="csp-mission-challenge-header">
              <span class="csp-mission-challenge-name">{_props7["data"].challengeName}</span>
              <span class="csp-mission-challenge-duration">({_props7["data"].duration})</span>
            </div>
            <div class="csp-guide-steps">
              {_props7["data"].tutorSteps.map((step, stepIdx) => (<div class="csp-guide-step">
                  <span class="csp-guide-number">{stepIdx + 1}</span>
                  <div class="csp-guide-content">
                    <p class="csp-guide-instruction">{step.instruction}</p>

                    {step.listeningScript && (<div class="csp-listening-script-box">
                        <strong>Listening script</strong>
                        <div innerHTML={{ __html: step.listeningScript }.__html}/>
                      </div>)}

                    {/* Scripts + Prompts interleaved */}
                    {interleaveStepContent(step.scripts || [], step.prompts || []).map((item, idx) => (<p class={item.type === 'script' ? "csp-apply-script" : "csp-apply-prompt"}>
                        <span class={item.type === 'script' ? "csp-script-bullet" : "csp-prompt-bullet"}>{item.type === 'script' ? '●' : '▸'}</span>
                        <span>{item.type === 'script' ? _fmtScript(item.text) : item.text.replace(/^\s*\((.+)\)\s*$/s, '$1')}</span>
                      </p>))}

                    {/* Tips */}
                    {step.tips && step.tips.map((tip, tipIdx) => (<p class="csp-apply-tip">
                        <span class="csp-tip-icon">◆</span>
                        <span>{tip.text}</span>
                      </p>))}

                    {/* Questions */}
                    {step.questions && step.questions.length > 0 && (<div class="csp-apply-questions-box">
                        {step.questions.map((q, qIdx) => (<div class="csp-apply-question-item">
                            <span class="csp-question-bullet">•</span>
                            <div class="csp-question-content">
                              <p class="csp-question-text">{q.question}</p>
                              {q.answer && <p class="csp-answer-text">({q.answer})</p>}
                            </div>
                          </div>))}
                      </div>)}
                  </div>
                </div>))}
            </div>
          </div>
        </div>
      </div>
    </section>);
}
// ============================================================================
// FEEDBACK SECTION COMPONENT (Section 6)
// ============================================================================
interface FeedbackSectionProps {
    data: FeedbackSectionData;
}
function FeedbackSection(_props8: FeedbackSectionProps) {
    return (<section class="csp-feedback-section">
      {/* Section Header */}
      <div class="csp-section-number">
        <span class="csp-number-badge">{_props8["data"].sectionNumber}</span>
        <h2 class="csp-section-title">{_props8["data"].sectionTitle}</h2>
        <div class="csp-section-line"/>
      </div>

      <div class="csp-feedback-layout">
        {/* Left Column - Student View */}
        <div class="csp-feedback-left">
          {/* Goal Card */}
          <div class="csp-fb-goal-card">
            <div class="csp-fb-goal-accent"/>
            <div class="csp-fb-goal-body">
              <span class="csp-fb-goal-label">LESSON OBJECTIVE</span>
              <p class="csp-fb-goal-text">{_props8["data"].goal}</p>
              <p class="csp-fb-goal-jp">{_props8["data"].goalJp}</p>
            </div>
          </div>

          {/* Performance Levels */}
          <div class="csp-fb-rubric-card">
            <div class="csp-fb-rubric-title-row">{_props8["data"].rubricTitle === 'LESSON GOAL ACHIEVEMENT' ? 'LESSON OBJECTIVE ACHIEVEMENT' : _props8["data"].rubricTitle}</div>
            <div class="csp-fb-rubric-scale">
              {_props8["data"].rubricLevels.map((level, idx) => (<div class={`csp-fb-rubric-item csp-fb-rubric-${level.score}`}>
                  <div class="csp-fb-rubric-circle">{level.score}</div>
                  <div class="csp-fb-rubric-details">
                    <span class="csp-fb-rubric-label">{level.label}</span>
                    <span class="csp-fb-rubric-desc">{level.description}</span>
                  </div>
                </div>))}
            </div>
          </div>

          <FixedFeedbackGuide />
        </div>

        {/* Right Column - Tutor Guide */}
        <div class="csp-feedback-right">
          <div class="csp-tutor-guide">
            <div class="csp-guide-header">
              {_props8["data"].sectionTitle} ({_props8["data"].duration})
            </div>
            <div class="csp-guide-steps">
              {_props8["data"].tutorSteps.map((step, stepIdx) => (<div class="csp-guide-step">
                  <span class="csp-guide-number">{stepIdx + 1}</span>
                  <div class="csp-guide-content">
                    <p class="csp-guide-instruction">{step.instruction}</p>

                    {/* Scripts */}
                    {step.scripts && step.scripts.map((script, scriptIdx) => (<p class="csp-apply-script">
                        <span class="csp-script-bullet">●</span>
                        <span>"{script.text}"</span>
                      </p>))}

                    {/* Prompts */}
                    {step.prompts && step.prompts.map((prompt, promptIdx) => (<p class="csp-apply-prompt">
                        <span class="csp-prompt-bullet">▸</span>
                        <span>{prompt.text}</span>
                      </p>))}

                    {/* Tips */}
                    {step.tips && step.tips.map((tip, tipIdx) => (<p class="csp-apply-tip">
                        <span class="csp-tip-icon">◆</span>
                        <span>{tip.text}</span>
                      </p>))}
                  </div>
                </div>))}
            </div>
          </div>
        </div>
      </div>
    </section>);
}
// ============================================================================
// PLACEHOLDER SECTION COMPONENT
// ============================================================================
function PlaceholderSection(_props9: {
    icon: string;
    title: string;
    description: string;
}) {
    return (<section class="csp-section">
      <div class="csp-section-header">
        <TutorIcon name={_props9["icon"]}/>
        <h2>{_props9["title"]}</h2>
      </div>
      <div class="csp-section-body">
        <p class="csp-placeholder-text">{_props9["description"]}</p>
        <span class="csp-coming-soon">Content coming soon...</span>
      </div>
    </section>);
}
