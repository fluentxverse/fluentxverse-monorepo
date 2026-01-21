/**
 * Lesson Material Routes
 * API endpoints for managing lesson materials (Memgraph)
 */
import { Elysia, t } from 'elysia';
import { lessonMaterialService, type Skill } from '../services/lessonMaterial.service';
import { createAdminGuard } from '../middleware/auth.middleware';

// Helper to get dashboard public URL
const getDashboardPublicUrl = (): string => {
  const explicit = process.env.ADMIN_DASHBOARD_PUBLIC_URL || process.env.DASHBOARD_PUBLIC_URL;
  if (explicit) return explicit;

  const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
  const origins = raw
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const preferred = origins.find(o => /dashboard|admin/i.test(o)) || origins[0];
  return preferred || 'http://localhost:5175';
};

export const lessonMaterialRoutes = new Elysia({ prefix: '/lesson-materials' })
  
  // ============================================================================
  // CREATE LESSON
  // ============================================================================
  .post(
    '/',
    async ({ body, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const lesson = await lessonMaterialService.create({
          course: body.course,
          level: body.level,
          chapter: body.chapter,
          lessonNumber: body.lessonNumber,
          skill: body.skill as Skill,
          chapterName: body.chapterName,
          lessonName: body.lessonName,
          goalTextEn: body.goalTextEn,
          goalTextJp: body.goalTextJp,
          createdBy: adminPayload.userId,
          createdByName: adminPayload.firstName || adminPayload.email,
        });
        
        return { success: true, lesson };
      } catch (error) {
        console.error('Error creating lesson:', error);
        return { success: false, error: 'Failed to create lesson' };
      }
    },
    {
      body: t.Object({
        course: t.String(),
        level: t.Number({ minimum: 1, maximum: 10 }),
        chapter: t.Number({ minimum: 1, maximum: 5 }),
        lessonNumber: t.Number({ minimum: 1, maximum: 10 }),
        skill: t.Union([t.Literal('speaking'), t.Literal('listening'), t.Literal('reading')]),
        chapterName: t.String({ minLength: 1 }),
        lessonName: t.String({ minLength: 1 }),
        goalTextEn: t.String({ minLength: 1 }),
        goalTextJp: t.String({ minLength: 1 }),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Create a new lesson material',
      },
    }
  )

  // ============================================================================
  // GET PUBLISHED LESSONS (for student/tutor apps)
  // IMPORTANT: This route MUST be before /:id to avoid being matched by /:id
  // ============================================================================
  .get(
    '/published/:course',
    async ({ params }) => {
      try {
        console.log('[LessonMaterials] Fetching published lessons for course:', params.course);
        const lessons = await lessonMaterialService.listPublishedByCourse(params.course);
        console.log('[LessonMaterials] Found', lessons.length, 'published lessons');
        return { success: true, lessons };
      } catch (error) {
        console.error('Error fetching published lessons:', error);
        return { success: false, error: 'Failed to fetch published lessons', lessons: [] };
      }
    },
    {
      params: t.Object({
        course: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Get all published lessons for a course',
      },
    }
  )
  
  // ============================================================================
  // GET LESSON VIEW URL (public - for student/tutor apps)
  // Returns the dashboard preview URL for viewing a lesson material
  // IMPORTANT: This route MUST be before /:id to avoid being matched by /:id
  // ============================================================================
  .get(
    '/view/:id',
    async ({ params, set }) => {
      try {
        const lesson = await lessonMaterialService.getById(params.id);
        if (!lesson) {
          set.status = 404;
          return { success: false, error: 'Lesson not found' };
        }
        
        // Only allow viewing published lessons publicly
        if (lesson.status !== 'published') {
          set.status = 403;
          return { success: false, error: 'Lesson is not published' };
        }
        
        // Get dashboard URL
        const dashboardBase = getDashboardPublicUrl();
        const viewUrl = `${dashboardBase}/conversational-skills-preview/${lesson.id}`;
        
        return { 
          success: true, 
          lesson: {
            id: lesson.id,
            title: lesson.lessonTitle || `Lesson ${lesson.lessonNumber}: ${lesson.lessonName}`,
            status: lesson.status
          },
          viewUrl 
        };
      } catch (error) {
        console.error('Error getting lesson view URL:', error);
        return { success: false, error: 'Failed to get lesson view URL' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Get the view URL for a published lesson',
      },
    }
  )
  
  // ============================================================================
  // GET PUBLISHED LESSON DATA (public - for preview page)
  // Returns full lesson data for published lessons only
  // IMPORTANT: This route MUST be before /:id to avoid being matched by /:id
  // ============================================================================
  .get(
    '/public/:id',
    async ({ params, set }) => {
      try {
        const lesson = await lessonMaterialService.getById(params.id);
        if (!lesson) {
          set.status = 404;
          return { success: false, error: 'Lesson not found' };
        }
        
        // Only allow viewing published lessons publicly
        if (lesson.status !== 'published') {
          set.status = 403;
          return { success: false, error: 'Lesson is not published' };
        }
        
        return { success: true, lesson };
      } catch (error) {
        console.error('Error fetching public lesson:', error);
        return { success: false, error: 'Failed to fetch lesson' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Get a published lesson by ID (public)',
      },
    }
  )
  
  // ============================================================================
  // GET SINGLE LESSON
  // ============================================================================
  .get(
    '/:id',
    async ({ params, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const lesson = await lessonMaterialService.getById(params.id);
        if (!lesson) {
          set.status = 404;
          return { success: false, error: 'Lesson not found' };
        }
        
        return { success: true, lesson };
      } catch (error) {
        console.error('Error fetching lesson:', error);
        return { success: false, error: 'Failed to fetch lesson' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Get a lesson by ID',
      },
    }
  )
  
  // ============================================================================
  // LIST LESSONS BY COURSE
  // ============================================================================
  .get(
    '/course/:course',
    async ({ params, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const lessons = await lessonMaterialService.listByCourse(params.course);
        return { success: true, lessons };
      } catch (error) {
        console.error('Error listing lessons:', error);
        return { success: false, error: 'Failed to list lessons' };
      }
    },
    {
      params: t.Object({
        course: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'List all lessons for a course',
      },
    }
  )
  
  // ============================================================================
  // GET EXISTING CHAPTERS (for auto-fill)
  // ============================================================================
  .get(
    '/chapters/:course/:level',
    async ({ params, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const chapters = await lessonMaterialService.getChapters(params.course, parseInt(params.level));
        return { success: true, chapters };
      } catch (error) {
        console.error('Error fetching chapters:', error);
        return { success: false, error: 'Failed to fetch chapters' };
      }
    },
    {
      params: t.Object({
        course: t.String(),
        level: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Get existing chapters for a course/level (for dropdown auto-fill)',
      },
    }
  )
  
  // ============================================================================
  // CHECK IF CHAPTER NAME EXISTS
  // ============================================================================
  .get(
    '/chapter-name/:course/:level/:chapter',
    async ({ params, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const chapterName = await lessonMaterialService.getExistingChapterName(
          params.course,
          parseInt(params.level),
          parseInt(params.chapter)
        );
        
        return { success: true, chapterName };
      } catch (error) {
        console.error('Error fetching chapter name:', error);
        return { success: false, error: 'Failed to fetch chapter name' };
      }
    },
    {
      params: t.Object({
        course: t.String(),
        level: t.String(),
        chapter: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Get existing chapter name if any',
      },
    }
  )
  
  // ============================================================================
  // CHECK FOR DUPLICATE
  // ============================================================================
  .get(
    '/check-duplicate',
    async ({ query, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const exists = await lessonMaterialService.checkDuplicate(
          query.course as string,
          parseInt(query.level as string),
          parseInt(query.chapter as string),
          parseInt(query.lessonNumber as string),
          query.skill as Skill
        );
        
        return { success: true, exists };
      } catch (error) {
        console.error('Error checking duplicate:', error);
        return { success: false, error: 'Failed to check duplicate' };
      }
    },
    {
      query: t.Object({
        course: t.String(),
        level: t.String(),
        chapter: t.String(),
        lessonNumber: t.String(),
        skill: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Check if a lesson combination already exists',
      },
    }
  )
  
  // ============================================================================
  // UPDATE HEADER STYLING
  // ============================================================================
  .patch(
    '/:id/header',
    async ({ params, body, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const lesson = await lessonMaterialService.updateHeader(params.id, {
          backgroundImage: body.backgroundImage,
          overlayColor: body.overlayColor,
          chapterName: body.chapterName,
          lessonName: body.lessonName,
          goalTextEn: body.goalTextEn,
          goalTextJp: body.goalTextJp,
          introductionData: body.introductionData,
        });
        
        if (!lesson) {
          set.status = 404;
          return { success: false, error: 'Lesson not found' };
        }
        
        return { success: true, lesson };
      } catch (error) {
        console.error('Error updating header:', error);
        return { success: false, error: 'Failed to update header' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        backgroundImage: t.Optional(t.String()),
        overlayColor: t.Optional(t.String()),
        chapterName: t.Optional(t.String()),
        lessonName: t.Optional(t.String()),
        goalTextEn: t.Optional(t.String()),
        goalTextJp: t.Optional(t.String()),
        introductionData: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Update lesson header styling and content',
      },
    }
  )
  
  // ============================================================================
  // DELETE LESSON
  // ============================================================================
  .delete(
    '/:id',
    async ({ params, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const success = await lessonMaterialService.delete(params.id);
        if (!success) {
          set.status = 404;
          return { success: false, error: 'Lesson not found or already deleted' };
        }
        
        return { success: true };
      } catch (error) {
        console.error('Error deleting lesson:', error);
        return { success: false, error: 'Failed to delete lesson' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Delete a lesson',
      },
    }
  )
  
  // ============================================================================
  // DUPLICATE LESSON
  // ============================================================================
  .post(
    '/:id/duplicate',
    async ({ params, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const lesson = await lessonMaterialService.duplicate(
          params.id,
          adminPayload.userId,
          adminPayload.firstName || adminPayload.email
        );
        
        if (!lesson) {
          set.status = 404;
          return { success: false, error: 'Original lesson not found' };
        }
        
        return { success: true, lesson };
      } catch (error: any) {
        console.error('Error duplicating lesson:', error);
        return { success: false, error: error.message || 'Failed to duplicate lesson' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Duplicate an existing lesson',
      },
    }
  )

  // ============================================================================
  // PUBLISH LESSON
  // ============================================================================
  .post(
    '/:id/publish',
    async ({ params, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const lesson = await lessonMaterialService.publish(params.id);
        
        if (!lesson) {
          set.status = 404;
          return { success: false, error: 'Lesson not found' };
        }
        
        return { success: true, lesson, message: 'Lesson published successfully' };
      } catch (error: any) {
        console.error('Error publishing lesson:', error);
        return { success: false, error: error.message || 'Failed to publish lesson' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Publish a lesson',
      },
    }
  )

  // ============================================================================
  // UNPUBLISH LESSON
  // ============================================================================
  .post(
    '/:id/unpublish',
    async ({ params, cookie, set }) => {
      const adminPayload = await createAdminGuard(cookie, set);
      if (!adminPayload) {
        return { success: false, error: 'Unauthorized' };
      }
      
      try {
        const lesson = await lessonMaterialService.unpublish(params.id);
        
        if (!lesson) {
          set.status = 404;
          return { success: false, error: 'Lesson not found' };
        }
        
        return { success: true, lesson, message: 'Lesson unpublished successfully' };
      } catch (error: any) {
        console.error('Error unpublishing lesson:', error);
        return { success: false, error: error.message || 'Failed to unpublish lesson' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Lesson Materials'],
        summary: 'Unpublish a lesson (set back to draft)',
      },
    }
  );
