/**
 * AI Content Generation API
 * Functions for generating lesson content with AI assistance
 */
import apiClient from './apiClient';

// ============================================================================
// TYPES
// ============================================================================

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

export interface GenerateIntroductionResponse {
  success: boolean;
  data?: {
    introTexts: IntroText[];
    lessonIssue: LessonIssue;
    lessonGoalDuration: string;
    lessonGoalSteps: LessonGoalStep[];
  };
  error?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Generate introduction content for a lesson
 */
export async function generateIntroductionContent(
  topic: string,
  skillLevel: string,
  skill: 'speaking' | 'listening' | 'reading',
  customPrompt?: string,
  currentContent?: any,
  baseInstructions?: string,
  level?: number,
  chapter?: number,
  lessonNumber?: number,
  generationMode?: 'new' | 'improve',
  includeLessonIssue?: boolean,
  lessonGoal?: string,
  learnType?: 'vocabulary' | 'expressions',
  stepBType?: 'speak-your-mind' | 'grammar-tip' | 'pronunciation',
  includeTranslation?: boolean,
  translationLanguage?: 'japanese' | 'korean' | 'vietnamese' | 'chinese',
  vocabularyCount?: number,
  expressionCount?: number,
  applyType?: 'speaking' | 'listening' | 'reading',
  dialogueLineCount?: number,
  generateTrivia?: boolean,
  exerciseType?: string,
  exerciseStep?: 'stepA' | 'stepB',
  exerciseItemCount?: number,
  missionType?: 'speaking' | 'discussion' | 'reading' | 'listening',
  missionQuestionCount?: number,
  isMission2?: boolean,
  storyData?: {
    enabled: boolean;
    storyTitle: string;
    characters: Array<{
      id: string;
      name: string;
      koreanName?: string;
      role: 'main' | 'supporting' | 'minor';
      description: string;
      personality?: string;
    }>;
    setting: string;
    previousSummary: string;
    currentPlotPoints: string[];
    storyNotes: string;
  },
  currentLearnData?: {
    steps?: Array<{
      id: string;
      label: string;
      items?: Array<{
        foreign: string;
        foreignLabel?: string;
        native: string;
        audio?: string;
        image?: string;
      }>;
    }>;
    stepBType?: 'speak-your-mind' | 'grammar-tip' | 'pronunciation';
    grammarTip?: {
      title?: string;
      items?: Array<{
        pattern?: string;
        explanation?: string;
        example?: string;
      }>;
    };
  },
  currentApplyData?: {
    activityType: 'speaking' | 'listening' | 'reading';
    situationText?: string;
    dialogueLines?: Array<{ speaker: string; text: string }>;
    readingText?: string;
    tutorSteps?: Array<{ instruction?: string; scripts?: Array<{ text: string }>; listeningScript?: string }>;
  }
): Promise<GenerateIntroductionResponse> {
  try {
    const response = await apiClient.post('/ai/generate-introduction', {
      topic,
      skillLevel,
      skill,
      customPrompt: customPrompt || null,
      currentContent: currentContent || null,
      baseInstructions: baseInstructions || null,
      level: level || null,
      chapter: chapter || null,
      lessonNumber: lessonNumber || null,
      generationMode: generationMode || null,
      includeLessonIssue: includeLessonIssue || false,
      lessonGoal: lessonGoal || '',
      includeTranslation: includeTranslation !== false, // Default to true
      translationLanguage: translationLanguage || 'japanese',
      vocabularyCount: vocabularyCount || null,
      expressionCount: expressionCount || null,
      ...(learnType ? { learnType } : {}),
      ...(stepBType ? { stepBType } : {}),
      ...(applyType ? { applyType } : {}),
      ...(dialogueLineCount ? { dialogueLineCount } : {}),
      ...(generateTrivia ? { generateTrivia } : {}),
      ...(exerciseType ? { exerciseType } : {}),
      ...(exerciseStep ? { exerciseStep } : {}),
      ...(exerciseItemCount ? { exerciseItemCount } : {}),
      ...(missionType ? { missionType } : {}),
      ...(missionQuestionCount ? { missionQuestionCount } : {}),
      ...(isMission2 ? { isMission2 } : {}),
      ...(storyData?.enabled ? { storyData } : {}),
      ...(currentLearnData ? { currentLearnData } : {}),
      ...(currentApplyData ? { currentApplyData } : {}),
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating introduction content:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate content',
    };
  }
}

// ============================================================================
// STORY EPISODE SUMMARY GENERATION
// ============================================================================

export interface GenerateEpisodeSummaryResponse {
  success: boolean;
  data?: {
    currentEpisodeSummary: string;
    nextEpisodeHook: string;
  };
  error?: string;
}

/**
 * Generate episode summary after Mission content is created
 * This creates continuity for the next lesson's story
 */
export async function generateEpisodeSummary(
  storyData: {
    storyTitle: string;
    characters: Array<{ name: string; role: string; description: string }>;
    setting: string;
    previousSummary: string;
    currentPlotPoints: string[];
  },
  missionContent: {
    situation: string;
    instruction: string;
    questions?: Array<{ question: string }>;
    topics?: Array<{ title: string; questions: string[] }>;
  },
  lessonTopic: string
): Promise<GenerateEpisodeSummaryResponse> {
  try {
    const response = await apiClient.post('/ai/generate-episode-summary', {
      storyData,
      missionContent,
      lessonTopic,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating episode summary:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate episode summary',
    };
  }
}
