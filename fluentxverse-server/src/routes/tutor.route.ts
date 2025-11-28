import Elysia, { t } from 'elysia';
import { TutorService } from '../services/tutor.services/tutor.service';

const tutorService = new TutorService();

const Tutor = new Elysia({ prefix: '/tutor' })
  /**
   * Search and filter tutors
   * GET /tutor/search
   */
  .get('/search', async ({ query }) => {
    try {
      const params = {
        query: query.q,
        languages: query.languages ? (Array.isArray(query.languages) ? query.languages : [query.languages]) : undefined,
        specializations: query.specializations ? (Array.isArray(query.specializations) ? query.specializations : [query.specializations]) : undefined,
        minRating: query.minRating ? Number(query.minRating) : undefined,
        maxHourlyRate: query.maxHourlyRate ? Number(query.maxHourlyRate) : undefined,
        minHourlyRate: query.minHourlyRate ? Number(query.minHourlyRate) : undefined,
        isAvailable: query.isAvailable === 'true',
        sortBy: query.sortBy as any || 'rating',
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 12
      };

      const result = await tutorService.searchTutors(params);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error in /tutor/search:', error);
      return {
        success: false,
        error: 'Failed to search tutors'
      };
    }
  })

  /**
   * Get featured tutors
   * GET /tutor/featured
   */
  .get('/featured', async ({ query }) => {
    try {
      const limit = query.limit ? Number(query.limit) : 6;
      const tutors = await tutorService.getFeaturedTutors(limit);

      return {
        success: true,
        data: tutors
      };
    } catch (error) {
      console.error('Error in /tutor/featured:', error);
      return {
        success: false,
        error: 'Failed to get featured tutors'
      };
    }
  })

  /**
   * Get tutor profile by ID
   * GET /tutor/:tutorId
   */
  .get('/:tutorId', async ({ params }) => {
    try {
      const tutor = await tutorService.getTutorProfile(params.tutorId);

      if (!tutor) {
        return {
          success: false,
          error: 'Tutor not found'
        };
      }

      return {
        success: true,
        data: tutor
      };
    } catch (error) {
      console.error('Error in /tutor/:tutorId:', error);
      return {
        success: false,
        error: 'Failed to get tutor profile'
      };
    }
  })

  /**
   * Get available languages
   * GET /tutor/filters/languages
   */
  .get('/filters/languages', async () => {
    try {
      const languages = await tutorService.getAvailableLanguages();

      return {
        success: true,
        data: languages
      };
    } catch (error) {
      console.error('Error in /tutor/filters/languages:', error);
      return {
        success: false,
        error: 'Failed to get languages'
      };
    }
  })

  /**
   * Get available specializations
   * GET /tutor/filters/specializations
   */
  .get('/filters/specializations', async () => {
    try {
      const specializations = await tutorService.getAvailableSpecializations();

      return {
        success: true,
        data: specializations
      };
    } catch (error) {
      console.error('Error in /tutor/filters/specializations:', error);
      return {
        success: false,
        error: 'Failed to get specializations'
      };
    }
  });

export default Tutor;
