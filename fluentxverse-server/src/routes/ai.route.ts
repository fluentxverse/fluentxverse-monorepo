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
          body.includeLessonIssue // Pass lesson issue toggle flag
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
        customPrompt: t.Optional(t.String({ maxLength: 500 })), // Optional custom prompt
        currentContent: t.Optional(t.Any()), // Optional current introduction data
        baseInstructions: t.Optional(t.String({ maxLength: 500 })), // Optional fixed instructions
        level: t.Optional(t.Number({ minimum: 1, maximum: 10 })), // Lesson level (1-10) for complexity
        chapter: t.Optional(t.Number()), // Chapter number for context
        lessonNumber: t.Optional(t.Number()), // Lesson number for context
        generationMode: t.Optional(t.Union([t.Literal('new'), t.Literal('improve')])), // 'new' or 'improve'
        includeLessonIssue: t.Optional(t.Boolean()), // Whether to generate lesson issue
      }),
      detail: {
        tags: ['AI'],
        summary: 'Generate introduction content for a lesson',
        description: 'Uses AI to generate contextual introduction texts, lesson issues, and tutor steps for a lesson. Adjusts complexity based on lesson level (1-10). Can include custom instructions and current content for context.',
      },
    }
  );
