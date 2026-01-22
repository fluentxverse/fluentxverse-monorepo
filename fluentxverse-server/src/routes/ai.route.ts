/**
 * AI Routes - Grammar checking and language assistance
 */
import { Elysia, t } from 'elysia';
import { checkGrammar, getVocabularyDefinition, getPronunciation } from '../services/ai.service';
import { createTutorGuard } from '../middleware/auth.middleware';

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
  );
