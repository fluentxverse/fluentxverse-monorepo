import Elysia, { t } from 'elysia';
import { TutorService } from '../services/tutor.services/tutor.service';
import StudentService from '../services/auth.services/student.service';
import { ScheduleService } from '../services/schedule.services/schedule.service';
import { ClassroomNotesService } from '../services/classroomNotes.services/classroomNotes.service';
import type { AuthData } from '@/services/auth.services/auth.interface';
import { MAX_PROFILE_PIC_BYTES } from '../config/constant';
import { verifyAuthToken, refreshJwtCookie, type JwtAuthPayload } from '../utils/jwt';
import { cacheGetOrSet, invalidateCache } from '../db/redis';

const tutorService = new TutorService();
const scheduleService = new ScheduleService();
const classroomNotesService = new ClassroomNotesService();

const Tutor = new Elysia({ prefix: '/tutor' })
  /**
   * Search and filter tutors
   * GET /tutor/search
   * Cached for 2 minutes to reduce database load for common searches
   */
  .get('/search', async ({ query }) => {
    try {
      const params = {
        query: query.q || undefined, // Search by name
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 12,
        dateFilter: query.dateFilter || undefined,
        startTime: query.startTime || undefined,
        endTime: query.endTime || undefined
      };

      // Create cache key from search params
      const cacheKey = `tutor:search:${JSON.stringify(params)}`;
      
      // Cache search results for 2 minutes (120 seconds)
      const result = await cacheGetOrSet(cacheKey, 120, () => 
        tutorService.searchTutors(params)
      );

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
   * Upload tutor intro video (multipart/form-data)
   * Field name: file
   */
  .post('/intro-video', async ({ request, cookie }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) return { success: false, error: 'Not authenticated' };
      const payload = await verifyAuthToken(String(raw));
      if (!payload) return { success: false, error: 'Invalid or expired token' };
      const userId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return { success: false, error: 'Missing file' };
      }

      // Max 100MB for video
      const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
      if (file.size > MAX_VIDEO_BYTES) {
        return { success: false, error: `File too large. Max 100MB` };
      }

      // Validate video type
      if (!file.type.startsWith('video/')) {
        return { success: false, error: 'File must be a video' };
      }

      // Build Seaweed Filer path: /user/{userId}/video/{timestamp}_{originalName}
      const timestamp = Date.now();
      const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'intro.mp4';
      const filerPath = `/user/${userId}/video/${timestamp}_${safeName}`;
      const filerBase = process.env.SEAWEED_FILER_URL || 'http://localhost:8888';
      const uploadUrl = `${filerBase}${filerPath}`;

      // Check if profile is approved - if so, we keep the old video (new one goes to pending)
      const profileStatus = await tutorService.getProfileStatus(userId);
      const isApproved = profileStatus === 'approved';

      // Only delete previous video if profile is NOT approved (direct update)
      if (!isApproved) {
        const previousVideo = await tutorService.getVideoIntroUrl(userId);
        if (previousVideo) {
          try {
            await fetch(previousVideo, { method: 'DELETE' });
          } catch (e) {
            console.warn('Failed to delete previous intro video:', e);
          }
        }
      }

      // Upload new file to Seaweed Filer
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file.stream(),
        headers: {
          'Content-Type': file.type || 'video/mp4'
        }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { success: false, error: `Upload failed: ${res.status} ${text}` };
      }

      // Save video URL to database
      const result = await tutorService.updateProfile(userId, { videoIntroUrl: uploadUrl });

      return { 
        success: true, 
        url: uploadUrl,
        hasPendingChanges: result.hasPendingChanges,
        message: result.hasPendingChanges 
          ? 'Video uploaded and submitted for review. Your current video will remain visible until approved.'
          : undefined
      };
    } catch (error) {
      console.error('Error in /tutor/intro-video:', error);
      return { success: false, error: 'Failed to upload intro video' };
    }
  })

  /**
   * Delete tutor intro video
   */
  .delete('/intro-video', async ({ cookie }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) return { success: false, error: 'Not authenticated' };
      const payload = await verifyAuthToken(String(raw));
      if (!payload) return { success: false, error: 'Invalid or expired token' };
      const userId = payload.userId;

      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      // Delete from storage
      const previousVideo = await tutorService.getVideoIntroUrl(userId);
      if (previousVideo) {
        try {
          await fetch(previousVideo, { method: 'DELETE' });
        } catch (e) {
          console.warn('Failed to delete intro video:', e);
        }
      }

      // Clear from database
      await tutorService.updateProfile(userId, { videoIntroUrl: null });

      return { success: true };
    } catch (error) {
      console.error('Error in DELETE /tutor/intro-video:', error);
      return { success: false, error: 'Failed to delete intro video' };
    }
  })

  /**
   * Upload tutor profile picture (multipart/form-data)
   * Field name: file
   */
  .post('/profile-picture', async ({ request, cookie }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) return { success: false, error: 'Not authenticated' };
      const payload = await verifyAuthToken(String(raw));
      if (!payload) return { success: false, error: 'Invalid or expired token' };
      const userId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return { success: false, error: 'Missing file' };
      }

      if (file.size > MAX_PROFILE_PIC_BYTES) {
        return { success: false, error: `File too large. Max ${(MAX_PROFILE_PIC_BYTES / (1024*1024)).toFixed(1)}MB` };
      }

      // Build Seaweed Filer path: /user/{userId}/profile/{timestamp}_{originalName}
      const timestamp = Date.now();
      const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'profile.jpg';
      const filerPath = `/user/${userId}/profile/${timestamp}_${safeName}`;
      const filerBase = process.env.SEAWEED_FILER_URL || 'http://localhost:8888';
      const uploadUrl = `${filerBase}${filerPath}`;

      // Check if profile is approved - if so, we keep the old picture (new one goes to pending)
      const profileStatus = await tutorService.getProfileStatus(userId);
      const isApproved = profileStatus === 'approved';
      
      // Only delete previous file if profile is NOT approved (direct update)
      if (!isApproved) {
        const previous = await tutorService.getCurrentProfilePicture(userId);
        if (previous) {
          try {
            await fetch(previous, { method: 'DELETE' });
          } catch (e) {
            console.warn('Failed to delete previous profile picture:', e);
          }
        }
      }

      // Upload new file to Seaweed Filer
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file.stream(),
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { success: false, error: `Upload failed: ${res.status} ${text}` };
      }

      const result = await tutorService.setProfilePicture(userId, uploadUrl);

      return { 
        success: true, 
        url: uploadUrl,
        hasPendingChanges: result.hasPendingChanges,
        message: result.hasPendingChanges 
          ? 'Photo uploaded and submitted for review. Your current photo will remain visible until approved.'
          : undefined
      };
    } catch (error) {
      console.error('Error in /tutor/profile-picture:', error);
      return { success: false, error: 'Failed to upload profile picture' };
    }
  })

  /**
   * Get current tutor's own profile data (bio, introduction, etc.)
   * GET /tutor/profile
   */
  .get('/profile', async ({ cookie }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) return { success: false, error: 'Not authenticated' };
      const payload = await verifyAuthToken(String(raw));
      if (!payload) return { success: false, error: 'Invalid or expired token' };
      const userId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const tutor = await tutorService.getTutorProfile(userId);
      
      if (!tutor) {
        return { success: false, error: 'Tutor profile not found' };
      }

      return { success: true, data: tutor };
    } catch (error) {
      console.error('Error in GET /tutor/profile:', error);
      return { success: false, error: 'Failed to get profile' };
    }
  })

  /**
   * Update tutor profile fields (bio, introduction, etc.)
   * PATCH /tutor/profile
   */
  .patch('/profile', async ({ body, cookie }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) return { success: false, error: 'Not authenticated' };
      const payload = await verifyAuthToken(String(raw));
      if (!payload) return { success: false, error: 'Invalid or expired token' };
      const userId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const updateData = body as Record<string, any>;
      
      // Only allow updating specific fields
      const allowedFields = ['bio', 'introduction', 'teachingStyle', 'hourlyRate', 'videoIntroUrl', 'interests'];
      const filteredData: Record<string, any> = {};
      
      for (const key of allowedFields) {
        if (updateData[key] !== undefined) {
          // Handle interests array - ensure it's an array with max 5 items, stored as JSON string
          if (key === 'interests') {
            let interests = updateData[key];
            if (typeof interests === 'string') {
              interests = interests.split(',').map((i: string) => i.trim()).filter((i: string) => i.length > 0);
            }
            if (Array.isArray(interests)) {
              filteredData[key] = JSON.stringify(interests.slice(0, 5)); // Store as JSON string like other arrays
            }
          } else {
            filteredData[key] = updateData[key];
          }
        }
      }

      if (Object.keys(filteredData).length === 0) {
        return { success: false, error: 'No valid fields to update' };
      }

      const result = await tutorService.updateProfile(userId, filteredData);

      // Invalidate tutor profile cache after update
      await invalidateCache(`tutor:profile:${userId}`);

      return { 
        success: true, 
        data: filteredData,
        hasPendingChanges: result.hasPendingChanges,
        message: result.hasPendingChanges 
          ? 'Changes submitted for review. Your current profile will remain visible until approved.'
          : 'Profile updated successfully.'
      };
    } catch (error) {
      console.error('Error in PATCH /tutor/profile:', error);
      return { success: false, error: 'Failed to update profile' };
    }
  })

  /**
   * Submit profile for admin review
   * POST /tutor/profile/submit
   * Called when tutor completes their profile and wants admin to review
   */
  .post('/profile/submit', async ({ cookie }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) return { success: false, error: 'Not authenticated' };
      const payload = await verifyAuthToken(String(raw));
      if (!payload) return { success: false, error: 'Invalid or expired token' };
      const userId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      // Check profile completeness
      const profile = await tutorService.getTutorProfile(userId);
      if (!profile) {
        return { success: false, error: 'Profile not found' };
      }

      // Validate required fields
      const missingFields: string[] = [];
      if (!profile.bio || profile.bio.length < 10) missingFields.push('Bio');
      if (!profile.profilePicture) missingFields.push('Profile Picture');
      if (!profile.videoIntroUrl) missingFields.push('Introduction Video');
      if (!profile.schoolAttended && (!profile.education || profile.education.length === 0)) missingFields.push('Education');
      if (!profile.interests || profile.interests.length === 0) missingFields.push('Interests');

      if (missingFields.length > 0) {
        return { 
          success: false, 
          error: `Please complete the following before submitting: ${missingFields.join(', ')}` 
        };
      }

      // Mark profile as submitted for review
      await tutorService.submitProfileForReview(userId);

      return { success: true, message: 'Profile submitted for review' };
    } catch (error) {
      console.error('Error in POST /tutor/profile/submit:', error);
      return { success: false, error: 'Failed to submit profile for review' };
    }
  })

  /**
   * Get tutor profile by ID
   * GET /tutor/:tutorId
   * Cached for 5 minutes to reduce DB calls for popular tutors
   * IMPORTANT: This must be last because it's a catch-all route
   */
  .get('/:tutorId', async ({ params }) => {
    try {
      const { tutorId } = params;
      
      if (!tutorId) {
        return {
          success: false,
          error: 'Tutor ID is required'
        };
      }

      // Cache tutor profile for 5 minutes (300 seconds)
      const cacheKey = `tutor:profile:${tutorId}`;
      const tutor = await cacheGetOrSet(cacheKey, 300, () => 
        tutorService.getTutorProfile(tutorId)
      );

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
   * Get tutor weekly availability
   * GET /tutor/:tutorId/availability
   */
  .get('/:tutorId/availability', async ({ params }) => {
    try {
      const { tutorId } = params;
      if (!tutorId) {
        return { success: false, error: 'Tutor ID is required' };
      }

      const availability = await tutorService.getAvailability(tutorId);
      return { success: true, data: availability };
    } catch (error) {
      console.error('Error in /tutor/:tutorId/availability:', error);
      return { success: false, error: 'Failed to get availability' };
    }
  })

  /**
   * Get student profile (for tutor view)
   * GET /tutor/student/:studentId
   */
  .get('/student/:studentId', async ({ params, cookie, set }) => {
    
    try {
      const raw = cookie.tutorAuth?.value;
      
      if (!raw) {
        console.error('[TutorRoute] No tutorAuth cookie found');
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        console.error('[TutorRoute] Invalid or expired JWT token');
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const tutorId = payload.userId;

      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const { studentId } = params;
      if (!studentId) {
        console.error('[TutorRoute] No studentId in params');
        set.status = 400;
        return { success: false, error: 'Student ID is required' };
      }

      const studentProfile = await tutorService.getStudentProfile(studentId, tutorId);
      
      return { success: true, data: studentProfile };
    } catch (error: any) {
      console.error('[TutorRoute] Error in /tutor/student/:studentId:', error);
      set.status = error.message === 'Student not found' ? 404 : 500;
      return { success: false, error: error.message || 'Failed to get student profile' };
    }
  })

  /**
   * Get student's lesson request (last viewed lesson + preferences)
   * GET /tutor/student/:studentId/lesson-request
   */
  .get('/student/:studentId/lesson-request', async ({ params, cookie, set }) => {
    
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid token' };
      }

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const { studentId } = params;
      if (!studentId) {
        set.status = 400;
        return { success: false, error: 'Student ID is required' };
      }

      // Get student's last viewed lesson and profile
      const studentService = new StudentService();
      const [lessonResult, profileResult] = await Promise.all([
        studentService.getLastViewedLesson(studentId),
        tutorService.getStudentProfile(studentId, payload.userId)
      ]);

      if (!lessonResult.success || !lessonResult.data) {
        return { success: true, data: null };
      }

      // Combine lesson data with student preferences
      const lessonRequest = {
        lessonId: lessonResult.data.lessonId,
        courseId: lessonResult.data.courseId,
        title: lessonResult.data.title,
        lessonNumber: lessonResult.data.lessonNumber,
        goal: lessonResult.data.goal,
        studentPreferences: profileResult ? {
          cameraOn: profileResult.lessonPreferences?.preferCameraOn !== false,
          proficiency: profileResult.currentProficiency || 'Not set',
          errorCorrection: profileResult.lessonPreferences?.errorCorrection || 'tutor_choice',
          otherRequests: profileResult.lessonPreferences?.otherRequests || ''
        } : null
      };

      return { success: true, data: lessonRequest };
    } catch (error: any) {
      console.error('[TutorRoute] Error in /tutor/student/:studentId/lesson-request:', error);
      set.status = 500;
      return { success: false, error: error.message || 'Failed to get student lesson request' };
    }
  })

  /**
   * Get persisted classroom notes for a session + active material
   * GET /tutor/classroom-notes/:sessionId?materialType=...&materialId=...
   */
  .get('/classroom-notes/:sessionId', async ({ params, query, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid token' };
      }

      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const { sessionId } = params;
      const { materialType, materialId } = query as { materialType?: string; materialId?: string };

      if (!sessionId || !materialType || !materialId) {
        set.status = 400;
        return { success: false, error: 'sessionId, materialType, and materialId are required' };
      }

      await scheduleService.getTutorLessonDetails(sessionId, payload.userId);

      const notes = await classroomNotesService.getNotes(sessionId, materialType, materialId);
      return { success: true, data: notes };
    } catch (error: any) {
      console.error('[TutorRoute] Error in /tutor/classroom-notes/:sessionId:', error);
      set.status = error.message?.includes('do not have access') ? 403 : 500;
      return { success: false, error: error.message || 'Failed to get classroom notes' };
    }
  }, {
    query: t.Object({
      materialType: t.String(),
      materialId: t.String(),
    })
  })

  /**
   * Save persisted classroom notes for a session + active material
   * PUT /tutor/classroom-notes/:sessionId
   */
  .put('/classroom-notes/:sessionId', async ({ params, body, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid token' };
      }

      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const { sessionId } = params;
      if (!sessionId) {
        set.status = 400;
        return { success: false, error: 'sessionId is required' };
      }

      const lessonDetails = await scheduleService.getTutorLessonDetails(sessionId, payload.userId);
      const notesBody = body as {
        materialType: string;
        materialId: string;
        courseId?: string;
        lessonId?: string;
        articleId?: string;
        vocabularyItems?: any[];
        grammarItems?: any[];
        pronunciationItems?: any[];
        studentComment?: string;
        tutorMemo?: string;
      };

      const notes = await classroomNotesService.saveNotes({
        sessionId,
        tutorId: payload.userId,
        studentId: lessonDetails.studentId || null,
        materialType: notesBody.materialType,
        materialId: notesBody.materialId,
        courseId: notesBody.courseId || null,
        lessonId: notesBody.lessonId || null,
        articleId: notesBody.articleId || null,
        vocabularyItems: notesBody.vocabularyItems || [],
        grammarItems: notesBody.grammarItems || [],
        pronunciationItems: notesBody.pronunciationItems || [],
        studentComment: notesBody.studentComment || '',
        tutorMemo: notesBody.tutorMemo || '',
      });

      return { success: true, data: notes };
    } catch (error: any) {
      console.error('[TutorRoute] Error in PUT /tutor/classroom-notes/:sessionId:', error);
      set.status = error.message?.includes('do not have access') ? 403 : 500;
      return { success: false, error: error.message || 'Failed to save classroom notes' };
    }
  }, {
    body: t.Object({
      materialType: t.String(),
      materialId: t.String(),
      courseId: t.Optional(t.String()),
      lessonId: t.Optional(t.String()),
      articleId: t.Optional(t.String()),
      vocabularyItems: t.Array(t.Any()),
      grammarItems: t.Array(t.Any()),
      pronunciationItems: t.Array(t.Any()),
      studentComment: t.Optional(t.String()),
      tutorMemo: t.Optional(t.String()),
    })
  })


export default Tutor;
