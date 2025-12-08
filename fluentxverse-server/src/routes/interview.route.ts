import Elysia, { t } from 'elysia';
import { InterviewService } from '../services/interview.services/interview.service';
import { NotificationService } from '../services/notification.services/notification.service';
import { getIO } from '../socket/socket.server';
import type { AuthData } from '@/services/auth.services/auth.interface';
import { refreshAuthCookie } from '../utils/refreshCookie';

const interviewService = new InterviewService();
const notificationService = new NotificationService();

const Interview = new Elysia({ prefix: '/interview' })
  // Helper: verify admin authentication via adminAuth cookie
  .derive(({ cookie, set }) => {
    const requireAdmin = (): AuthData | null => {
      const raw = cookie.adminAuth?.value;
      if (!raw) {
        set.status = 401;
        return null;
      }
      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      // Check for admin or superadmin role
      const role = (authData as any).role;
      if (role && role !== 'admin' && role !== 'superadmin') {
        set.status = 403;
        return null;
      }
      // Note: adminAuth refresh not supported by refreshAuthCookie helper; skip refresh
      return authData;
    };
    return { requireAdmin };
  })
  /**
   * Create interview slots (Admin only)
   * POST /interview/slots
   */
  .post('/slots', async ({ body, set, requireAdmin }) => {
    try {
      const admin = requireAdmin();
      if (!admin) {
        return { success: false, error: 'Not authenticated' };
      }
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
  .delete('/slots', async ({ body, set, requireAdmin }) => {
    try {
      const admin = requireAdmin();
      if (!admin) {
        return { success: false, error: 'Not authenticated' };
      }
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
  .get('/week', async ({ query, set, requireAdmin }) => {
    try {
      const admin = requireAdmin();
      if (!admin) {
        return { success: false, error: 'Not authenticated' };
      }
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

      // Send notification for interview scheduled
      try {
        console.log('📧 Sending interview notification to tutor:', tutorId);
        console.log('📧 Booking details:', booking.date, booking.time);
        
        const notification = await notificationService.notifyInterviewScheduled(
          tutorId,
          booking.date,
          booking.time
        );
        
        console.log('📧 Notification created:', notification.id);
        
        // Emit real-time notification via Socket.IO
        const io = getIO();
        console.log('📧 Socket.IO instance:', io ? 'available' : 'NOT available');
        
        if (io) {
          // Use the same room format as notification.handler.ts
          const room = `notifications:${tutorId}`;
          console.log('📧 Emitting to room:', room);
          io.to(room).emit('notification:new', notification);
          console.log('📧 Notification emitted successfully');
        }
      } catch (notifError) {
        console.error('Failed to send interview notification:', notifError);
        // Don't fail the booking if notification fails
      }

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

      // Get booking details before cancelling (for notification)
      const existingBooking = await interviewService.getTutorInterview(tutorId);

      await interviewService.cancelBooking(body.slotId, tutorId);

      // Send cancellation notification
      if (existingBooking) {
        try {
          const notification = await notificationService.notifyInterviewCancelled(
            tutorId,
            existingBooking.date,
            existingBooking.time
          );
          
          const io = getIO();
          if (io) {
            io.to(`notifications:${tutorId}`).emit('notification:new', notification);
          }
        } catch (notifError) {
          console.error('Failed to send cancellation notification:', notifError);
        }
      }

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
  .post('/admin/cancel', async ({ body, set, requireAdmin }) => {
    try {
      const admin = requireAdmin();
      if (!admin) {
        return { success: false, error: 'Not authenticated' };
      }
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
  .post('/complete', async ({ body, set, requireAdmin }) => {
    try {
      const admin = requireAdmin();
      if (!admin) {
        return { success: false, error: 'Not authenticated' };
      }
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
   * Admin: Save interview result with rubric scores
   * POST /interview/result
   */
  .post('/result', async ({ body, set, requireAdmin }) => {
    try {
      const admin = requireAdmin();
      if (!admin) {
        return { success: false, error: 'Not authenticated' };
      }
      
      await interviewService.saveInterviewResult({
        slotId: body.slotId,
        tutorId: body.tutorId,
        result: body.result,
        rubricScores: body.rubricScores,
        notes: body.notes,
        timestamps: body.timestamps,
        adminId: (admin as any).userId
      });

      return {
        success: true,
        message: `Interview marked as ${body.result}`
      };
    } catch (error: any) {
      console.error('Error in POST /interview/result:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to save interview result'
      };
    }
  }, {
    body: t.Object({
      slotId: t.String(),
      tutorId: t.String(),
      result: t.Union([t.Literal('pass'), t.Literal('fail')]),
      rubricScores: t.Object({
        grammar: t.Number(),
        fluency: t.Number(),
        pronunciation: t.Number(),
        vocabulary: t.Number(),
        professionalism: t.Number()
      }),
      notes: t.String(),
      timestamps: t.Array(t.Object({
        time: t.String(),
        note: t.String()
      }))
    })
  })

  /**
   * Admin: Get interview result for a tutor
   * GET /interview/result/:tutorId
   */
  .get('/result/:tutorId', async ({ params, set, requireAdmin }) => {
    try {
      const admin = requireAdmin();
      if (!admin) {
        return { success: false, error: 'Not authenticated' };
      }
      
      const result = await interviewService.getInterviewResult(params.tutorId);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('Error in GET /interview/result:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get interview result'
      };
    }
  })

  /**
   * Admin: Get pending interviews
   * GET /interview/pending
   */
  .get('/pending', async ({ query, set, requireAdmin }) => {
    try {
      const admin = requireAdmin();
      if (!admin) {
        return { success: false, error: 'Not authenticated' };
      }
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
