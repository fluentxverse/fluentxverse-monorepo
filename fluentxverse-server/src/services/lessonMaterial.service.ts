/**
 * Lesson Material Service - Memgraph Storage
 * Handles CRUD operations for lesson materials (Conversational Skills)
 */
import { getDriver } from '../db/memgraph';
import neo4j from 'neo4j-driver';

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
  tutorSteps?: TutorStep[];
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
  tutorSteps?: TutorStep[];
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

// Step B Section Types (Speak Your Mind / Grammar Tip / Pronunciation)
export type StepBType = 'speak-your-mind' | 'grammar-tip' | 'pronunciation';

export interface ConversationSpeaker {
  image: string;
  speechBubble: string; // Rich text HTML
}

export interface SpeakYourMindData {
  stepName: string;
  duration: string;
  explanation: string;
  speaker1: ConversationSpeaker;
  speaker2: ConversationSpeaker;
  question: string;
  tutorSteps: TutorStep[];
}

// Grammar Tip types
export interface GrammarExample {
  sentence: string; // HTML with <strong> for highlighted word
  translation: string;
}

export interface GrammarExplanation {
  ruleText: string; // HTML - can have <em> for italics, <strong> for bold
  ruleTranslation: string;
  examplesTitle?: string; // e.g., "EXAMPLES" or "EXAMPLE"
  examples?: GrammarExample[];
}

export interface GrammarTipData {
  stepName: string;
  duration: string;
  explanations: GrammarExplanation[];
  tutorSteps: TutorStep[];
}

// Pronunciation types
export interface PronunciationPhrase {
  phrase: string;
  pronunciationGuide: string; // e.g., "/ cos-ta fortune /"
  exampleSentence: string; // HTML with <strong> for pronunciation highlight
}

export interface StepBPronunciationData {
  stepName: string;
  duration: string;
  tip: string; // HTML - can have bold for emphasis
  phrases: PronunciationPhrase[];
  tutorSteps: TutorStep[];
}

export interface StepBData {
  stepType: StepBType;
  speakYourMind?: SpeakYourMindData;
  grammarTip?: GrammarTipData;
  pronunciation?: StepBPronunciationData;
}

// ============================================================================
// APPLY SECTION TYPES (Section 3 - Speaking/Understanding)
// ============================================================================

export interface DialogueLine {
  speaker: string;
  text: string;
  isAction?: boolean;
}

export interface TutorScriptBullet {
  text: string;
}

export interface TutorTipItem {
  text: string;
}

export interface TutorQuestion {
  question: string;
  answer?: string;
}

export type ApplyActivityType = 'speaking' | 'listening';

export interface ApplyTutorStep {
  instruction: string;
  scripts?: TutorScriptBullet[];
  tips?: TutorTipItem[];
  questions?: TutorQuestion[];
  listeningScript?: string; // Rich text HTML for listening script
}

export interface ApplySectionData {
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

export interface CreateLessonInput {
  course: string;             // e.g., "conversational-skills"
  level: number;              // 1-10
  chapter: number;            // 1-5
  lessonNumber: number;       // 1-10
  skill: Skill;
  chapterName: string;        // "All About Me"
  lessonName: string;         // "Greetings"
  goalTextEn: string;         // "I can say basic greetings."
  goalTextJp: string;         // "基本的な挨拶ができるようになる。"
  createdBy: string;          // Admin ID
  createdByName?: string;     // Admin name
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
  stepBData?: StepBData;
  applyData?: ApplySectionData;
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
  stepBData?: StepBData;
  applyData?: ApplySectionData;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map level number to badge
 */
export function getLevelBadge(level: number): LevelBadge {
  if (level <= 2) return 'STARTER';
  if (level <= 4) return 'BEGINNER';
  if (level <= 6) return 'ELEMENTARY';
  if (level <= 8) return 'INTERMEDIATE';
  return 'ADVANCED';
}

/**
 * Generate chapter label from chapter number and name
 */
export function getChapterLabel(chapter: number, chapterName: string): string {
  return `Chapter ${chapter}: ${chapterName}`;
}

/**
 * Generate lesson title from lesson number and name
 */
export function getLessonTitle(lessonNumber: number, lessonName: string): string {
  return `Lesson ${lessonNumber}: ${lessonName}`;
}

/**
 * Transform raw Memgraph record to LessonMaterial
 */
function transformLesson(record: any): LessonMaterial {
  const props = record.properties || record;
  
  // Parse introductionData from JSON string if present
  let introductionData: IntroductionData | undefined;
  if (props.introductionData) {
    try {
      introductionData = typeof props.introductionData === 'string' 
        ? JSON.parse(props.introductionData) 
        : props.introductionData;
    } catch (e) {
      console.error('Failed to parse introductionData:', e);
    }
  }

  // Parse learnData from JSON string if present
  let learnData: LearnSectionData | undefined;
  if (props.learnData) {
    try {
      learnData = typeof props.learnData === 'string' 
        ? JSON.parse(props.learnData) 
        : props.learnData;
    } catch (e) {
      console.error('Failed to parse learnData:', e);
    }
  }

  // Parse stepBData from JSON string if present
  let stepBData: StepBData | undefined;
  if (props.stepBData) {
    try {
      stepBData = typeof props.stepBData === 'string' 
        ? JSON.parse(props.stepBData) 
        : props.stepBData;
    } catch (e) {
      console.error('Failed to parse stepBData:', e);
    }
  }

  // Parse applyData from JSON string if present
  let applyData: ApplySectionData | undefined;
  if (props.applyData) {
    try {
      applyData = typeof props.applyData === 'string' 
        ? JSON.parse(props.applyData) 
        : props.applyData;
    } catch (e) {
      console.error('Failed to parse applyData:', e);
    }
  }
  
  return {
    id: props.id,
    course: props.course,
    level: neo4j.isInt(props.level) ? props.level.toNumber() : props.level,
    chapter: neo4j.isInt(props.chapter) ? props.chapter.toNumber() : props.chapter,
    lessonNumber: neo4j.isInt(props.lessonNumber) ? props.lessonNumber.toNumber() : props.lessonNumber,
    skill: props.skill,
    chapterName: props.chapterName,
    lessonName: props.lessonName,
    goalTextEn: props.goalTextEn,
    goalTextJp: props.goalTextJp,
    backgroundImage: props.backgroundImage || '',
    overlayColor: props.overlayColor || '#0369a1cc',
    introductionData,
    learnData,
    stepBData,
    applyData,
    createdBy: props.createdBy,
    createdByName: props.createdByName || '',
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
    // Computed
    levelBadge: getLevelBadge(neo4j.isInt(props.level) ? props.level.toNumber() : props.level),
    chapterLabel: getChapterLabel(
      neo4j.isInt(props.chapter) ? props.chapter.toNumber() : props.chapter,
      props.chapterName
    ),
    lessonTitle: getLessonTitle(
      neo4j.isInt(props.lessonNumber) ? props.lessonNumber.toNumber() : props.lessonNumber,
      props.lessonName
    ),
  };
}

// ============================================================================
// SERVICE
// ============================================================================

export const lessonMaterialService = {
  /**
   * Check if a lesson with same level+chapter+lesson+skill already exists
   */
  async checkDuplicate(
    course: string,
    level: number,
    chapter: number,
    lessonNumber: number,
    skill: Skill
  ): Promise<boolean> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const result = await session.run(
        `MATCH (l:LessonMaterial {
          course: $course,
          level: $level,
          chapter: $chapter,
          lessonNumber: $lessonNumber,
          skill: $skill
        })
        RETURN l`,
        { course, level: neo4j.int(level), chapter: neo4j.int(chapter), lessonNumber: neo4j.int(lessonNumber), skill }
      );
      
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  },

  /**
   * Get existing chapter name if any lesson in that chapter exists
   */
  async getExistingChapterName(
    course: string,
    level: number,
    chapter: number
  ): Promise<string | null> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const result = await session.run(
        `MATCH (l:LessonMaterial {
          course: $course,
          level: $level,
          chapter: $chapter
        })
        RETURN l.chapterName as chapterName
        LIMIT 1`,
        { course, level: neo4j.int(level), chapter: neo4j.int(chapter) }
      );
      
      if (result.records.length > 0 && result.records[0]) {
        return result.records[0].get('chapterName');
      }
      return null;
    } finally {
      await session.close();
    }
  },

  /**
   * Create a new lesson material
   */
  async create(input: CreateLessonInput): Promise<LessonMaterial> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      // Check for duplicate
      const exists = await this.checkDuplicate(
        input.course,
        input.level,
        input.chapter,
        input.lessonNumber,
        input.skill
      );
      
      if (exists) {
        throw new Error(
          `Lesson already exists: Level ${input.level}, Chapter ${input.chapter}, Lesson ${input.lessonNumber}, Skill: ${input.skill}`
        );
      }
      
      const id = `${input.course}-L${input.level}-C${input.chapter}-${input.lessonNumber}-${input.skill}-${Date.now()}`;
      const now = new Date().toISOString();
      
      const result = await session.run(
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
          backgroundImage: $backgroundImage,
          overlayColor: $overlayColor,
          createdBy: $createdBy,
          createdByName: $createdByName,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
        RETURN l`,
        {
          id,
          course: input.course,
          level: neo4j.int(input.level),
          chapter: neo4j.int(input.chapter),
          lessonNumber: neo4j.int(input.lessonNumber),
          skill: input.skill,
          chapterName: input.chapterName,
          lessonName: input.lessonName,
          goalTextEn: input.goalTextEn,
          goalTextJp: input.goalTextJp,
          backgroundImage: '',
          overlayColor: '#0369a1cc',
          createdBy: input.createdBy,
          createdByName: input.createdByName || '',
          createdAt: now,
          updatedAt: now,
        }
      );
      
      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to create lesson - no record returned');
      }
      return transformLesson(record.get('l'));
    } finally {
      await session.close();
    }
  },

  /**
   * Get a lesson by ID
   */
  async getById(id: string): Promise<LessonMaterial | null> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const result = await session.run(
        `MATCH (l:LessonMaterial {id: $id}) RETURN l`,
        { id }
      );
      
      if (result.records.length === 0 || !result.records[0]) return null;
      return transformLesson(result.records[0].get('l'));
    } finally {
      await session.close();
    }
  },

  /**
   * List all lessons for a course
   */
  async listByCourse(course: string): Promise<LessonMaterial[]> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const result = await session.run(
        `MATCH (l:LessonMaterial {course: $course})
        RETURN l
        ORDER BY l.level, l.chapter, l.lessonNumber, l.skill`,
        { course }
      );
      
      return result.records.map(r => transformLesson(r.get('l')));
    } finally {
      await session.close();
    }
  },

  /**
   * Update header styling (background image, overlay color)
   */
  async updateHeader(id: string, input: UpdateHeaderInput): Promise<LessonMaterial> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const setClauses: string[] = ['l.updatedAt = $updatedAt'];
      const params: Record<string, any> = { id, updatedAt: new Date().toISOString() };
      
      if (input.backgroundImage !== undefined) {
        setClauses.push('l.backgroundImage = $backgroundImage');
        params.backgroundImage = input.backgroundImage;
      }
      
      if (input.overlayColor !== undefined) {
        setClauses.push('l.overlayColor = $overlayColor');
        params.overlayColor = input.overlayColor;
      }

      if (input.chapterName !== undefined) {
        setClauses.push('l.chapterName = $chapterName');
        params.chapterName = input.chapterName;
      }

      if (input.lessonName !== undefined) {
        setClauses.push('l.lessonName = $lessonName');
        params.lessonName = input.lessonName;
      }

      if (input.goalTextEn !== undefined) {
        setClauses.push('l.goalTextEn = $goalTextEn');
        params.goalTextEn = input.goalTextEn;
      }

      if (input.goalTextJp !== undefined) {
        setClauses.push('l.goalTextJp = $goalTextJp');
        params.goalTextJp = input.goalTextJp;
      }

      if (input.introductionData !== undefined) {
        setClauses.push('l.introductionData = $introductionData');
        // Store as JSON string
        params.introductionData = JSON.stringify(input.introductionData);
      }

      if (input.learnData !== undefined) {
        setClauses.push('l.learnData = $learnData');
        // Store as JSON string
        params.learnData = JSON.stringify(input.learnData);
      }

      if (input.stepBData !== undefined) {
        setClauses.push('l.stepBData = $stepBData');
        // Store as JSON string
        params.stepBData = JSON.stringify(input.stepBData);
      }

      if (input.applyData !== undefined) {
        setClauses.push('l.applyData = $applyData');
        // Store as JSON string
        params.applyData = JSON.stringify(input.applyData);
      }
      
      const result = await session.run(
        `MATCH (l:LessonMaterial {id: $id})
        SET ${setClauses.join(', ')}
        RETURN l`,
        params
      );
      
      const record = result.records[0];
      if (!record) {
        throw new Error('Lesson not found');
      }
      
      return transformLesson(record.get('l'));
    } finally {
      await session.close();
    }
  },

  /**
   * Delete a lesson
   */
  async delete(id: string): Promise<boolean> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const result = await session.run(
        `MATCH (l:LessonMaterial {id: $id}) 
        DELETE l
        RETURN count(l) as deleted`,
        { id }
      );
      const deletedCount = result.records[0]?.get('deleted')?.toNumber?.() ?? 0;
      return deletedCount > 0;
    } finally {
      await session.close();
    }
  },

  /**
   * Get all unique chapters for a course/level (for dropdown auto-fill)
   */
  async getChapters(course: string, level: number): Promise<{ chapter: number; chapterName: string }[]> {
    const driver = getDriver();
    const session = driver.session();
    
    try {
      const result = await session.run(
        `MATCH (l:LessonMaterial {course: $course, level: $level})
        RETURN DISTINCT l.chapter as chapter, l.chapterName as chapterName
        ORDER BY l.chapter`,
        { course, level: neo4j.int(level) }
      );
      
      return result.records.map(r => ({
        chapter: neo4j.isInt(r.get('chapter')) ? r.get('chapter').toNumber() : r.get('chapter'),
        chapterName: r.get('chapterName'),
      }));
    } finally {
      await session.close();
    }
  },
};
