/**
 * Shared Lesson Material Types
 * This file defines all types for lesson content that can be rendered by LessonRenderer
 * The dashboard creates this JSON, and student/tutor apps render it
 */

// ============================================================================
// HEADER
// ============================================================================

export interface LessonHeader {
  backgroundImage: string;
  overlayColor: string;
  levelBadge: string;
  chapterLabel: string;
  lessonLabel: string;
  goalText: string;
  goalSubtext: string;
}

// ============================================================================
// VOCABULARY ELEMENTS
// ============================================================================

export interface VocabCard {
  id: string;
  image: string;
  wordEn: string;
  wordJp: string;
}

export interface ImageCard {
  id: string;
  image: string;
  label: string;
}

// ============================================================================
// PRONUNCIATION ELEMENTS
// ============================================================================

export interface PronunciationWord {
  id: string;
  wordEn: string;
  wordJp: string;
}

export interface PronunciationColumn {
  id: string;
  soundLabel: string; // e.g., "/w/" or "/p/"
  image: string; // mouth position image
  words: PronunciationWord[];
}

// ============================================================================
// GRAMMAR ELEMENTS
// ============================================================================

export interface GrammarExample {
  id: string;
  sentenceEn: string;
  sentenceJp: string;
  boldWords?: string[];
}

export interface GrammarRule {
  id: string;
  ruleEn: string;
  ruleJp: string;
  examples: GrammarExample[];
}

// ============================================================================
// DIALOGUE ELEMENTS
// ============================================================================

export interface DialogueLine {
  id: string;
  speaker: string;
  lineEn: string;
  isItalic?: boolean;
}

// ============================================================================
// TRIVIA ELEMENTS
// ============================================================================

export interface TriviaExample {
  id: string;
  speakerA: string;
  lineA: string;
  speakerB: string;
  lineB: string;
  isCorrect: boolean;
  lineAJp?: string;
  lineBJp?: string;
}

// ============================================================================
// PRACTICE ELEMENTS
// ============================================================================

export interface PracticeItem {
  id: string;
  question: string;
  questionJp?: string;
  answer: string;
}

export interface ConversationLine {
  id: string;
  speaker: 'Student' | 'Tutor';
  text: string; // with _____ for blanks
}

// ============================================================================
// CHALLENGE ELEMENTS
// ============================================================================

export interface ChallengeQuestion {
  id: string;
  question: string;
  subQuestions?: string[];
}

export interface TopicBox {
  id: string;
  topicNumber: number;
  topicTitle: string;
  questions: ChallengeQuestion[];
}

// ============================================================================
// FEEDBACK ELEMENTS
// ============================================================================

export interface FeedbackRubricItem {
  score: number;
  label: string;
  description: string;
}

export interface FeedbackCategory {
  id: string;
  title: string;
  titleJp: string;
  descJp: string;
}

export interface FeedbackGuideRow {
  id: string;
  category: string;
  categoryJp: string;
  categoryDesc: string;
  focusOn: string;
  exampleFeedback: string;
}

// ============================================================================
// LISTENING ELEMENTS
// ============================================================================

export interface ListeningQuestion {
  id: string;
  questionEn: string;
  questionJp: string;
  answerCorrect: string;
  answerWrong: string;
}

export interface RoleplayConversationLine {
  id: string;
  number: number;
  text: string;
  comment?: string;
  isHeader?: boolean;
  isFooter?: boolean;
}

// ============================================================================
// READING ELEMENTS
// ============================================================================

export interface ReadingDialogueLine {
  id: string;
  speaker: string;
  lineEn: string;
  underlineWords?: string[];
}

export interface ReadingQuestion {
  id: string;
  questionEn: string;
  answer: string;
}

// ============================================================================
// DISCUSSION QUESTIONS
// ============================================================================

export interface DiscussionQuestion {
  id: string;
  number: number;
  question: string;
  category: string;
}

// ============================================================================
// LESSON GOAL STEPS (TUTOR SIDEBAR)
// ============================================================================

export interface LessonGoalStep {
  id: string;
  instruction: string;
  scriptLines?: string[];
  scriptLine?: string;
  tipText?: string;
}

// ============================================================================
// SECTION TYPES
// ============================================================================

export type SectionType =
  | 'introduce'
  | 'vocabulary'
  | 'question'
  | 'pronunciation'
  | 'grammar'
  | 'dialogue'
  | 'trivia'
  | 'practice'
  | 'produce'
  | 'challenge'
  | 'challenge2'
  | 'feedback'
  | 'listening'
  | 'listeningChallenge'
  | 'reading'
  | 'discussion-questions';

// ============================================================================
// SECTION CONTENT - UNIFIED
// ============================================================================

export interface LessonSection {
  id: string;
  sectionNumber: number;
  sectionTitle: string;
  sectionType: SectionType;

  // Common fields
  explanationEn?: string;
  explanationJp?: string;
  sectionImage?: string;
  importantNote?: string;
  copyTemplate?: string;

  // Step info
  stepTitle?: string;
  instructionEn?: string;
  instructionJp?: string;

  // Vocabulary section
  vocabCards?: VocabCard[];
  imageCards?: ImageCard[];

  // Pronunciation section
  pronunciationColumns?: PronunciationColumn[];

  // Grammar section
  grammarRules?: GrammarRule[];

  // Dialogue section
  dialogueLines?: DialogueLine[];
  dialogueImage?: string;

  // Trivia section
  triviaExamples?: TriviaExample[];
  triviaImage?: string;

  // Practice section
  practiceExample?: string;
  practiceExampleAnswer?: string;
  practiceItems?: PracticeItem[];
  practiceImage?: string;
  answerItems?: string[];
  wordBox?: string[];
  conversationLines?: ConversationLine[];

  // Challenge section
  challengeTitle?: string;
  situationEn?: string;
  situationJp?: string;
  grammarTipTitle?: string;
  grammarTipItems?: string[];
  challengeQuestions?: ChallengeQuestion[];
  isOptional?: boolean;
  topicBoxes?: TopicBox[];

  // Feedback section
  feedbackRubric?: FeedbackRubricItem[];
  feedbackCategories?: FeedbackCategory[];
  feedbackGuide?: FeedbackGuideRow[];
  feedbackTemplate?: string;

  // Listening section
  listeningScriptText?: string;
  listeningQuestions?: ListeningQuestion[];
  roleplaySetupLines?: string[];
  roleplayScript?: string;
  roleplayTips?: string[];
  roleplayConversation?: RoleplayConversationLine[];

  // Reading section
  readingImage?: string;
  readingDialogueLines?: ReadingDialogueLine[];
  readingQuestions?: ReadingQuestion[];

  // Discussion Questions section
  discussionQuestions?: DiscussionQuestion[];

  // Sidebar content (for tutor view)
  sidebarTitle?: string;
  sidebarSubtitle?: string;
  lessonGoalTitle?: string;
  lessonGoalSteps?: LessonGoalStep[];
}

// ============================================================================
// MAIN LESSON MATERIAL TYPE
// ============================================================================

export interface LessonMaterial {
  version: number;
  header: LessonHeader;
  sections: LessonSection[];
  course?: string;
  category?: string;
}

// ============================================================================
// RENDERER PROPS
// ============================================================================

export interface LessonRendererProps {
  data: LessonMaterial;
  mode?: 'student' | 'tutor';
  showTutorSidebar?: boolean;
  currentSectionIndex?: number;
  onSectionChange?: (index: number) => void;
}
