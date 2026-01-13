/**
 * Lesson Material API
 * API functions for managing lesson materials (Memgraph-backed)
 */
import apiClient from './apiClient';

// ============================================================================
// TYPES
// ============================================================================

export type Skill = 'speaking' | 'listening' | 'reading';
export type LevelBadge = 'STARTER' | 'BEGINNER' | 'ELEMENTARY' | 'INTERMEDIATE' | 'ADVANCED';

// Introduction Section Types
export interface IntroText {
  language: string;
  text: string;
}

export interface LessonIssue {
  title: string;
  points: string[];
}

export interface LessonGoalStep {
  instruction: string;
  script?: string | null;
  question?: string | null;
}

export interface IntroductionData {
  introTexts: IntroText[];
  introImage: string | null;
  lessonIssue: LessonIssue | null;
  lessonGoalDuration: string;
  lessonGoalSteps: LessonGoalStep[];
}

// Learn Section Types (Section 2 - Vocabulary/Expressions)
export type StepAType = 'vocabulary' | 'expressions';

export interface VocabularyItem {
  image: string;
  englishText: string;
  highlightedWord?: string;
  translation: string;
}

export interface ExpressionItem {
  image: string;
  definitionLine: string;
  exampleSentence: string;
  extraText?: string;
}

export interface DiscussionImage {
  image: string;
  label?: string;
  translation?: string;
}

export interface DiscussionPart {
  instruction: string;
  instructionTranslation?: string;
  images: DiscussionImage[];
}

export interface PronunciationWord {
  word: string;
  translation: string;
  isHighlighted?: boolean;
}

export interface PronunciationColumn {
  soundSymbol: string;
  images: string[];
  words: PronunciationWord[];
}

export interface PronunciationPart {
  instruction: string;
  instructionTranslation: string;
  leftColumn: PronunciationColumn;
  rightColumn: PronunciationColumn;
}

export interface TutorStep {
  instruction: string;
  script?: string | null;
  tip?: string | null;
}

export interface LearnStepData {
  stepType: StepAType;
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

export interface LearnSectionData {
  sectionTitle: string;
  steps: LearnStepData[];
}

export interface CreateLessonInput {
  course: string;
  level: number;
  chapter: number;
  lessonNumber: number;
  skill: Skill;
  chapterName: string;
  lessonName: string;
  goalTextEn: string;
  goalTextJp: string;
}

export interface LessonMaterial {
  id: string;
  course: string;
  level: number;
  chapter: number;
  lessonNumber: number;
  skill: Skill;
  chapterName: string;
  lessonName: string;
  goalTextEn: string;
  goalTextJp: string;
  backgroundImage: string;
  overlayColor: string;
  introductionData?: IntroductionData;
  learnData?: LearnSectionData;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  levelBadge: LevelBadge;
  chapterLabel: string;
  lessonTitle: string;
}

export interface UpdateHeaderInput {
  backgroundImage?: string;
  overlayColor?: string;
  chapterName?: string;
  lessonName?: string;
  goalTextEn?: string;
  goalTextJp?: string;
  introductionData?: IntroductionData;
  learnData?: LearnSectionData;
}

export interface ChapterInfo {
  chapter: number;
  chapterName: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Create a new lesson
 */
export async function createLesson(input: CreateLessonInput): Promise<LessonMaterial> {
  const response = await apiClient.post('/lesson-materials', input);
  return response.data.lesson;
}

/**
 * Get a lesson by ID
 */
export async function getLessonById(id: string): Promise<LessonMaterial> {
  const response = await apiClient.get(`/lesson-materials/${id}`);
  return response.data.lesson;
}

/**
 * List all lessons for a course
 */
export async function listLessonsByCourse(course: string): Promise<LessonMaterial[]> {
  const response = await apiClient.get(`/lesson-materials/course/${course}`);
  return response.data.lessons;
}

/**
 * Get existing chapters for a course/level (for auto-fill)
 */
export async function getChapters(course: string, level: number): Promise<ChapterInfo[]> {
  const response = await apiClient.get(`/lesson-materials/chapters/${course}/${level}`);
  return response.data.chapters;
}

/**
 * Get existing chapter name if any
 */
export async function getExistingChapterName(course: string, level: number, chapter: number): Promise<string | null> {
  const response = await apiClient.get(`/lesson-materials/chapter-name/${course}/${level}/${chapter}`);
  return response.data.chapterName;
}

/**
 * Check if a lesson combination already exists
 */
export async function checkDuplicate(
  course: string,
  level: number,
  chapter: number,
  lessonNumber: number,
  skill: Skill
): Promise<boolean> {
  const response = await apiClient.get('/lesson-materials/check-duplicate', {
    params: { course, level, chapter, lessonNumber, skill }
  });
  return response.data.exists;
}

/**
 * Update lesson header styling
 */
export async function updateLessonHeader(id: string, input: UpdateHeaderInput): Promise<LessonMaterial> {
  const response = await apiClient.patch(`/lesson-materials/${id}/header`, input);
  return response.data.lesson;
}

/**
 * Delete a lesson
 */
export async function deleteLesson(id: string): Promise<void> {
  await apiClient.delete(`/lesson-materials/${id}`);
}
