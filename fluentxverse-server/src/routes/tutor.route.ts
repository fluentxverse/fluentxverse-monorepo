import Elysia, { t } from 'elysia';
import { TutorService } from '../services/tutor.services/tutor.service';
import type { AuthData } from '@/services/auth.services/auth.interface';
import { MAX_PROFILE_PIC_BYTES } from '../config/constant';
import { refreshAuthCookie } from '../utils/refreshCookie';

const tutorService = new TutorService();

const Tutor = new Elysia({ prefix: '/tutor' })
  /**
   * Search and filter tutors
   * GET /tutor/search
   */
  .get('/search', async ({ query }) => {
    try {

  
      const params = {
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 12,
        dateFilter: query.dateFilter || undefined,
        startTime: query.startTime || undefined,
        endTime: query.endTime || undefined
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
   * Upload tutor intro video (multipart/form-data)
   * Field name: file
   */
  .post('/intro-video', async ({ request, cookie }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) return { success: false, error: 'Not authenticated' };
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'tutorAuth');

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

      // Delete previous video if exists
      const previousVideo = await tutorService.getVideoIntroUrl(userId);
      if (previousVideo) {
        try {
          await fetch(previousVideo, { method: 'DELETE' });
        } catch (e) {
          console.warn('Failed to delete previous intro video:', e);
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
      await tutorService.updateProfile(userId, { videoIntroUrl: uploadUrl });

      return { success: true, url: uploadUrl };
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
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      refreshAuthCookie(cookie, authData, 'tutorAuth');

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
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'tutorAuth');

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

      // Delete previous file if exists
      const previous = await tutorService.getCurrentProfilePicture(userId);
      if (previous) {
        try {
          await fetch(previous, { method: 'DELETE' });
        } catch (e) {
          console.warn('Failed to delete previous profile picture:', e);
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

      await tutorService.setProfilePicture(userId, uploadUrl);

      return { success: true, url: uploadUrl };
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
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'tutorAuth');

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
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'tutorAuth');

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

      await tutorService.updateProfile(userId, filteredData);

      return { success: true, data: filteredData };
    } catch (error) {
      console.error('Error in PATCH /tutor/profile:', error);
      return { success: false, error: 'Failed to update profile' };
    }
  })

  /**
   * Get tutor profile by ID
   * GET /tutor/:tutorId
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

      const tutor = await tutorService.getTutorProfile(tutorId);

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
    console.log('[TutorRoute] GET /tutor/student/:studentId - Request received');
    console.log('[TutorRoute] Params:', params);
    
    try {
      const raw = cookie.tutorAuth?.value;
      console.log('[TutorRoute] tutorAuth cookie present:', !!raw);
      
      if (!raw) {
        console.error('[TutorRoute] No tutorAuth cookie found');
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;
      console.log('[TutorRoute] TutorId from cookie:', tutorId);

      refreshAuthCookie(cookie, authData, 'tutorAuth');

      const { studentId } = params;
      if (!studentId) {
        console.error('[TutorRoute] No studentId in params');
        set.status = 400;
        return { success: false, error: 'Student ID is required' };
      }

      console.log('[TutorRoute] Calling getStudentProfile with:', { studentId, tutorId });
      const studentProfile = await tutorService.getStudentProfile(studentId, tutorId);
      console.log('[TutorRoute] Service returned student profile:', studentProfile ? 'SUCCESS' : 'NULL');
      
      return { success: true, data: studentProfile };
    } catch (error: any) {
      console.error('[TutorRoute] Error in /tutor/student/:studentId:', error);
      set.status = error.message === 'Student not found' ? 404 : 500;
      return { success: false, error: error.message || 'Failed to get student profile' };
    }
  })


export default Tutor;
