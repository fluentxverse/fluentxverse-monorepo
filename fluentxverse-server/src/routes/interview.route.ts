import Elysia, { t } from 'elysia';
import { InterviewService } from '../services/interview.services/interview.service';
import type { AuthData } from '@/services/auth.services/auth.interface';
import { refreshAuthCookie } from '../utils/refreshCookie';

const interviewService = new InterviewService();

const Interview = new Elysia({ prefix: '/interview' })
  /**
   * Create interview slots (Admin only)
   * POST /interview/slots
   */
  .post('/slots', async ({ body, set }) => {
    try {
      // TODO: Add admin authentication check
      const slots = await interviewService.createSlots(body.slots);

      return {
        success: true,
        data: slots,
        message: `Created ${slots.length} interview slots`
      };
    } catch (error: any) {
      console.error('Error in POST /interview/slots:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to create interview slots'
      };
    }
  }, {
    body: t.Object({
      slots: t.Array(t.Object({
        date: t.String(),
        time: t.String()
      }))
    })
  })

  /**
   * Delete interview slots (Admin only)
   * DELETE /interview/slots
   */
  .delete('/slots', async ({ body, set }) => {
    try {
      // TODO: Add admin authentication check
      await interviewService.deleteSlots(body.slotIds);

      return {
        success: true,
        message: 'Interview slots deleted'
      };
    } catch (error: any) {
      console.error('Error in DELETE /interview/slots:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to delete interview slots'
      };
    }
  }, {
    body: t.Object({
      slotIds: t.Array(t.String())
    })
  })

  /**
   * Get interview schedule for a week (Admin view - all slots)
   * GET /interview/week
   */
  .get('/week', async ({ query, set }) => {
    try {
      const weekOffset = query.weekOffset ? parseInt(query.weekOffset, 10) : 0;
      const schedule = await interviewService.getWeekSchedule(weekOffset);

      return {
        success: true,
        data: schedule
      };
    } catch (error: any) {
      console.error('Error in GET /interview/week:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get interview schedule'
      };
    }
  })

  /**
   * Get available interview slots (Tutor view - only open slots)
   * GET /interview/available
   */
  .get('/available', async ({ query, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      refreshAuthCookie(cookie, authData, 'tutorAuth');

      const weekOffset = query.weekOffset ? parseInt(query.weekOffset, 10) : 0;
      const slots = await interviewService.getAvailableSlots(weekOffset);

      return {
        success: true,
        data: slots
      };
    } catch (error: any) {
      console.error('Error in GET /interview/available:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get available interview slots'
      };
    }
  })

  /**
   * Get tutor's current interview booking
   * GET /interview/my-booking
   */
  .get('/my-booking', async ({ cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;
      refreshAuthCookie(cookie, authData, 'tutorAuth');

      const booking = await interviewService.getTutorInterview(tutorId);

      return {
        success: true,
        data: booking
      };
    } catch (error: any) {
      console.error('Error in GET /interview/my-booking:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get interview booking'
      };
    }
  })

  /**
   * Book an interview slot (Tutor)
   * POST /interview/book
   */
  .post('/book', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;
      refreshAuthCookie(cookie, authData, 'tutorAuth');

      const booking = await interviewService.bookSlot(body.slotId, tutorId);

      return {
        success: true,
        data: booking,
        message: 'Interview booked successfully'
      };
    } catch (error: any) {
      console.error('Error in POST /interview/book:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to book interview'
      };
    }
  }, {
    body: t.Object({
      slotId: t.String()
    })
  })

  /**
   * Cancel interview booking (Tutor)
   * POST /interview/cancel
   */
  .post('/cancel', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;
      refreshAuthCookie(cookie, authData, 'tutorAuth');

      await interviewService.cancelBooking(body.slotId, tutorId);

      return {
        success: true,
        message: 'Interview cancelled successfully'
      };
    } catch (error: any) {
      console.error('Error in POST /interview/cancel:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to cancel interview'
      };
    }
  }, {
    body: t.Object({
      slotId: t.String()
    })
  })

  /**
   * Admin: Cancel any interview booking
   * POST /interview/admin/cancel
   */
  .post('/admin/cancel', async ({ body, set }) => {
    try {
      // TODO: Add admin authentication check
      await interviewService.cancelBooking(body.slotId);

      return {
        success: true,
        message: 'Interview cancelled by admin'
      };
    } catch (error: any) {
      console.error('Error in POST /interview/admin/cancel:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to cancel interview'
      };
    }
  }, {
    body: t.Object({
      slotId: t.String()
    })
  })

  /**
   * Admin: Mark interview as completed
   * POST /interview/complete
   */
  .post('/complete', async ({ body, set }) => {
    try {
      // TODO: Add admin authentication check
      await interviewService.completeInterview(body.slotId, body.notes);

      return {
        success: true,
        message: 'Interview marked as completed'
      };
    } catch (error: any) {
      console.error('Error in POST /interview/complete:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to complete interview'
      };
    }
  }, {
    body: t.Object({
      slotId: t.String(),
      notes: t.Optional(t.String())
    })
  })

  /**
   * Admin: Get pending interviews
   * GET /interview/pending
   */
  .get('/pending', async ({ query, set }) => {
    try {
      // TODO: Add admin authentication check
      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      const interviews = await interviewService.getPendingInterviews(limit);

      return {
        success: true,
        data: interviews
      };
    } catch (error: any) {
      console.error('Error in GET /interview/pending:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get pending interviews'
      };
    }
  });

export default Interview;
