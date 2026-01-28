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
  includeLessonIssue?: boolean
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
