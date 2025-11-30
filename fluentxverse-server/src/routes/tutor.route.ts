import Elysia, { t } from 'elysia';
import { TutorService } from '../services/tutor.services/tutor.service';
import type { AuthData } from '@/services/auth.services/auth.interface';
import { MAX_PROFILE_PIC_BYTES } from '../config/constant';

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
        limit: query.limit ? Number(query.limit) : 12
      };

      const result = await tutorService.searchTutors(params);

      console.log('Tutor search result:', result);

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
   * Upload tutor profile picture (multipart/form-data)
   * Field name: file
   */
  .post('/profile-picture', async ({ request, cookie }) => {
    try {
      const raw = cookie.auth?.value;
      if (!raw) return { success: false, error: 'Not authenticated' };
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const userId = authData.userId;

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


export default Tutor;
