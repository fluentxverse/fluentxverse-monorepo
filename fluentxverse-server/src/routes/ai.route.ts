/**
 * AI Routes - Grammar checking and language assistance
 */
import { Elysia, t } from 'elysia';
import { checkGrammar, getVocabularyDefinition, getPronunciation, generateIntroductionContent } from '../services/ai.service';
import { createAdminGuard, createTutorGuard } from '../middleware/auth.middleware';

export const aiRoute = new Elysia({ prefix: '/ai' })
  // ============================================================================
  // GRAMMAR CHECK (Tutor only)
  // ============================================================================
  .post(
    '/grammar-check',
    async ({ body, cookie, set }) => {
      // Verify tutor authentication
      const tutorPayload = await createTutorGuard(cookie, set);
      if (!tutorPayload) {
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const result = await checkGrammar(body.text);
        return {
          success: true,
          corrected: result.corrected,
          simpleExplanation: result.simpleExplanation,
          technicalExplanation: result.technicalExplanation,
          hasErrors: result.hasErrors,
        };
      } catch (error) {
        console.error('Grammar check failed:', error);
        set.status = 500;
        return {
          success: false,
          error: 'Failed to check grammar. Please try again.',
        };
      }
    },
    {
      body: t.Object({
        text: t.String({ minLength: 1, maxLength: 1000 }),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Check grammar and get correction with explanation',
        description: 'Uses OpenAI to check grammar, provide corrections, and explain errors concisely.',
      },
    }
  )
  // ============================================================================
  // VOCABULARY DEFINITION (Tutor only)
  // ============================================================================
  .post(
    '/vocabulary-definition',
    async ({ body, cookie, set }) => {
      // Verify tutor authentication
      const tutorPayload = await createTutorGuard(cookie, set);
      if (!tutorPayload) {
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const result = await getVocabularyDefinition(body.word);
        return {
          success: true,
          definitions: result.definitions,
        };
      } catch (error) {
        console.error('Vocabulary definition failed:', error);
        set.status = 500;
        return {
          success: false,
          error: 'Failed to get definition. Please try again.',
        };
      }
    },
    {
      body: t.Object({
        word: t.String({ minLength: 1, maxLength: 200 }),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Get vocabulary definition and translations',
        description: 'Uses OpenAI to provide word definitions and Korean/Vietnamese translations.',
      },
    }
  )
  // ============================================================================
  // PRONUNCIATION (Tutor only)
  // ============================================================================
  .post(
    '/pronunciation',
    async ({ body, cookie, set }) => {
      // Verify tutor authentication
      const tutorPayload = await createTutorGuard(cookie, set);
      if (!tutorPayload) {
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const result = await getPronunciation(body.word);
        return {
          success: true,
          word: result.word,
          phonetic: result.phonetic,
        };
      } catch (error) {
        console.error('Pronunciation failed:', error);
        set.status = 500;
        return {
          success: false,
          error: 'Failed to get pronunciation. Please try again.',
        };
      }
    },
    {
      body: t.Object({
        word: t.String({ minLength: 1, maxLength: 200 }),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Get word pronunciation with phonetic spelling',
        description: 'Uses OpenAI to provide phonetic spelling with stressed syllable capitalized.',
      },
    }
  )
  // ============================================================================
  // GENERATE INTRODUCTION CONTENT (Admin/Teacher only)
  // ============================================================================
  .post(
    '/generate-introduction',
    async ({ body, cookie, set }) => {
      // Verify admin authentication
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const result = await generateIntroductionContent(
          body.topic,
          body.skillLevel,
          body.skill,
          body.customPrompt, // Pass custom prompt
          body.currentContent, // Pass current content for context
          body.baseInstructions, // Pass fixed instructions
          body.level, // Pass lesson level for complexity adjustment
          body.chapter, // Pass chapter for context
          body.lessonNumber, // Pass lesson number for context
          body.generationMode, // Pass generation mode ('new' or 'improve')
          body.includeLessonIssue, // Pass lesson issue toggle flag
          body.lessonGoal, // Pass lesson goal for context-based generation
          body.learnType, // Pass Step A subtype (vocabulary/expressions)
          body.stepBType, // Pass Step B type (speak-your-mind/grammar-tip/pronunciation)
          body.includeTranslation, // Pass translation toggle
          body.translationLanguage, // Pass translation language
          body.vocabularyCount, // Pass current vocabulary count from editor
          body.expressionCount, // Pass current expression count from editor
          body.applyType, // Pass Apply activity type (speaking/listening/reading)
          body.dialogueLineCount, // Pass current dialogue line count from editor
          body.generateTrivia, // Pass trivia generation flag
          body.exerciseType, // Pass exercise type (rephrase/choose/change or conversation/multiple-choice/speech/compare)
          body.exerciseStep, // Pass exercise step (stepA or stepB)
          body.exerciseItemCount, // Pass exercise item count from editor
          body.missionType, // Pass mission type (speaking/discussion/reading/listening)
          body.missionQuestionCount, // Pass mission question count from editor
          body.isMission2, // Pass flag for mission 2 (challenge 2)
          body.storyData, // Pass story data for K-Drama style generation
          body.currentLearnData // Pass Learn section data for cross-section cohesion
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('Failed to generate introduction content:', error);
        set.status = 500;
        return {
          success: false,
          error: 'Failed to generate introduction content. Please try again.',
        };
      }
    },
    {
      body: t.Object({
        topic: t.String({ minLength: 1, maxLength: 200 }),
        skillLevel: t.String(), // e.g., "BEGINNER", "INTERMEDIATE"
        skill: t.Union([t.Literal('speaking'), t.Literal('listening'), t.Literal('reading')]),
        customPrompt: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))), // Optional custom prompt
        currentContent: t.Optional(t.Nullable(t.Any())), // Optional current introduction data
        baseInstructions: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))), // Optional fixed instructions
        level: t.Optional(t.Nullable(t.Number({ minimum: 1, maximum: 10 }))), // Lesson level (1-10) for complexity
        chapter: t.Optional(t.Nullable(t.Number())), // Chapter number for context
        lessonNumber: t.Optional(t.Nullable(t.Number())), // Lesson number for context
        generationMode: t.Optional(t.Nullable(t.Union([t.Literal('new'), t.Literal('improve')]))), // 'new' or 'improve'
        includeLessonIssue: t.Optional(t.Boolean()), // Whether to generate lesson issue
        lessonGoal: t.String({ maxLength: 500 }), // Lesson goal/objective (REQUIRED)
        includeTranslation: t.Optional(t.Boolean()), // Whether to include translations
        translationLanguage: t.Optional(t.Union([t.Literal('japanese'), t.Literal('korean'), t.Literal('vietnamese'), t.Literal('chinese')])), // Translation language
        learnType: t.Optional(t.Nullable(t.Union([t.Literal('vocabulary'), t.Literal('expressions')]))), // Step A subtype
        stepBType: t.Optional(t.Nullable(t.Union([t.Literal('speak-your-mind'), t.Literal('grammar-tip'), t.Literal('pronunciation')]))), // Step B type
        vocabularyCount: t.Optional(t.Nullable(t.Number({ minimum: 1, maximum: 20 }))), // Current vocabulary count in editor
        expressionCount: t.Optional(t.Nullable(t.Number({ minimum: 1, maximum: 20 }))), // Current expression count in editor
        applyType: t.Optional(t.Nullable(t.Union([t.Literal('speaking'), t.Literal('listening'), t.Literal('reading')]))), // Apply activity type
        dialogueLineCount: t.Optional(t.Nullable(t.Number({ minimum: 1, maximum: 30 }))), // Current dialogue line count in editor
        generateTrivia: t.Optional(t.Boolean()), // Whether to generate standalone trivia content
        exerciseType: t.Optional(t.Nullable(t.String())), // Exercise type (rephrase/choose/change or conversation/multiple-choice/speech/compare)
        exerciseStep: t.Optional(t.Nullable(t.Union([t.Literal('stepA'), t.Literal('stepB')]))), // Exercise step (A or B)
        exerciseItemCount: t.Optional(t.Nullable(t.Number({ minimum: 1, maximum: 20 }))), // Current exercise item count in editor
        missionType: t.Optional(t.Nullable(t.Union([t.Literal('speaking'), t.Literal('discussion'), t.Literal('reading'), t.Literal('listening')]))), // Mission type
        missionQuestionCount: t.Optional(t.Nullable(t.Number({ minimum: 1, maximum: 20 }))), // Current mission question count in editor
        isMission2: t.Optional(t.Boolean()), // Whether this is mission 2 (challenge 2)
        storyData: t.Optional(t.Object({
          enabled: t.Boolean(),
          storyTitle: t.String(),
          characters: t.Array(t.Object({
            id: t.String(),
            name: t.String(),
            koreanName: t.Optional(t.String()),
            role: t.Union([t.Literal('main'), t.Literal('supporting'), t.Literal('minor')]),
            description: t.String(),
            personality: t.Optional(t.String()),
          })),
          setting: t.String(),
          previousSummary: t.String(),
          currentPlotPoints: t.Array(t.String()),
          storyNotes: t.String(),
        })), // Story data for K-Drama style generation
        currentLearnData: t.Optional(t.Object({
          steps: t.Optional(t.Array(t.Object({
            id: t.String(),
            label: t.String(),
            items: t.Optional(t.Array(t.Object({
              foreign: t.String(),
              foreignLabel: t.Optional(t.String()),
              native: t.String(),
              audio: t.Optional(t.String()),
              image: t.Optional(t.String()),
            }))),
          }))),
          stepBType: t.Optional(t.Union([
            t.String(), // Simple string like 'speak-your-mind', 'grammar-tip', 'pronunciation'
            t.Object({
              format: t.Optional(t.String()),
              type: t.Optional(t.String()),
              items: t.Optional(t.Array(t.Object({
                foreign: t.String(),
                foreignLabel: t.Optional(t.String()),
                native: t.String(),
                audio: t.Optional(t.String()),
                image: t.Optional(t.String()),
              }))),
            }),
          ])),
          grammarTip: t.Optional(t.Object({
            title: t.Optional(t.String()),
            content: t.Optional(t.String()),
            items: t.Optional(t.Array(t.Object({
              pattern: t.Optional(t.String()),
              explanation: t.Optional(t.String()),
              example: t.Optional(t.String()),
            }))),
          })),
        })), // Learn section data for cross-section cohesion
      }),
      detail: {
        tags: ['AI'],
        summary: 'Generate introduction content for a lesson',
        description: 'Uses AI to generate contextual introduction texts, lesson issues, and tutor steps for a lesson. Adjusts complexity based on lesson level (1-10). Can include custom instructions and current content for context.',
      },
    }
  )
  // ============================================================================
  // GENERATE EPISODE SUMMARY (Admin only)
  // ============================================================================
  .post(
    '/generate-episode-summary',
    async ({ body, cookie, set }) => {
      // Verify admin authentication
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const { generateEpisodeSummary } = await import('../services/ai.service');
        const result = await generateEpisodeSummary(
          body.storyData,
          body.missionContent,
          body.lessonTopic
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('Episode summary generation failed:', error);
        set.status = 500;
        return {
          success: false,
          error: 'Failed to generate episode summary. Please try again.',
        };
      }
    },
    {
      body: t.Object({
        storyData: t.Object({
          storyTitle: t.String(),
          characters: t.Array(t.Object({
            name: t.String(),
            role: t.String(),
            description: t.String(),
          })),
          setting: t.String(),
          previousSummary: t.String(),
          currentPlotPoints: t.Array(t.String()),
        }),
        missionContent: t.Object({
          situation: t.String(),
          instruction: t.String(),
          questions: t.Optional(t.Array(t.Object({
            question: t.String(),
          }))),
          topics: t.Optional(t.Array(t.Object({
            title: t.String(),
            questions: t.Array(t.String()),
          }))),
        }),
        lessonTopic: t.String(),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Generate episode summary after Mission content',
        description: 'Creates a summary of the current episode and a hook for the next episode to maintain story continuity.',
      },
    }
  );
