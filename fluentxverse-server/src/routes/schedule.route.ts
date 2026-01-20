import Elysia, { t } from 'elysia';
import { ScheduleService } from '../services/schedule.services/schedule.service';
import { verifyAuthToken, refreshJwtCookie, type JwtAuthPayload } from '../utils/jwt';
import { rateLimitMiddleware } from '../utils/rateLimiter';
import { cacheGetOrSet, invalidateCache, getRedis } from '../db/redis';
import { DateString, TimeString, ID, SafeString } from '../utils/validation';

const scheduleService = new ScheduleService();

// Cache TTLs in seconds
const STUDENT_STATS_CACHE_TTL = 60; // 1 minute - stats change on booking/completion
const STUDENT_BOOKINGS_CACHE_TTL = 120; // 2 minutes - bookings list
const STUDENT_ACTIVITY_CACHE_TTL = 300; // 5 minutes - activity changes less frequently

const Schedule = new Elysia({ prefix: '/schedule' })
  /**
   * Open time slots for tutoring
   * POST /schedule/open
   */
  .post('/open', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const tutorId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      await scheduleService.openSlots({
        tutorId,
        slots: body.slots
      });

      // Invalidate tutor search cache since availability changed
      await invalidateCache('tutor:search:*');

      return {
        success: true,
        message: 'Slots opened successfully'
      };
    } catch (error: any) {
      console.error('Error in /schedule/open:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to open slots'
      };
    }
  }, {
    body: t.Object({
      slots: t.Array(t.Object({
        date: DateString(),
        time: TimeString()
      }), { minItems: 1, maxItems: 100 })
    })
  })

  /**
   * Close time slots
   * POST /schedule/close
   */
  .post('/close', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const tutorId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      await scheduleService.closeSlots({
        tutorId,
        slotIds: body.slotIds
      });

      // Invalidate tutor search cache since availability changed
      await invalidateCache('tutor:search:*');

      return {
        success: true,
        message: 'Slots closed successfully'
      };
    } catch (error: any) {
      console.error('Error in /schedule/close:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to close slots'
      };
    }
  }, {
    body: t.Object({
      slotIds: t.Array(ID(), { minItems: 1, maxItems: 100 })
    })
  })

  /**
   * Get tutor's schedule for a week
   * GET /schedule/week
   */
  .get('/week', async ({ query, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const tutorId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const weekOffset = query.weekOffset ? parseInt(query.weekOffset, 10) : 0;

      const schedule = await scheduleService.getTutorSchedule({
        tutorId,
        weekOffset
      });


      console.log('Fetched schedule:', schedule);

      return {
        success: true,
        data: schedule
      };
    } catch (error: any) {
      console.error('Error in /schedule/week:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get schedule'
      };
    }
  })

  /**
   * Mark attendance for a booking
   * POST /schedule/attendance
   */
  .post('/attendance', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const tutorId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      await scheduleService.markAttendance({
        bookingId: body.bookingId,
        tutorId,
        role: 'tutor',
        status: body.status
      });

      return {
        success: true,
        message: 'Attendance marked successfully'
      };
    } catch (error: any) {
      console.error('Error in /schedule/attendance:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to mark attendance'
      };
    }
  }, {
    body: t.Object({
      bookingId: t.String(),
      status: t.Union([t.Literal('present'), t.Literal('absent')])
    })
  })

  /**
   * Get student's bookings
   * GET /schedule/student-bookings
   */
  .get('/student-bookings', async ({ cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'studentAuth');

      const cacheKey = `student:bookings:${studentId}`;
      const bookings = await cacheGetOrSet(
        cacheKey, 
        STUDENT_BOOKINGS_CACHE_TTL, 
        async () => scheduleService.getStudentBookings(studentId)
      );

      return {
        success: true,
        data: bookings
      };
    } catch (error: any) {
      console.error('Error in /schedule/student-bookings:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get bookings'
      };
    }
  })

  /**
   * Get student statistics for dashboard
   * GET /schedule/student-stats
   */
  .get('/student-stats', async ({ cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'studentAuth');

      const cacheKey = `student:stats:${studentId}`;
      const stats = await cacheGetOrSet(
        cacheKey, 
        STUDENT_STATS_CACHE_TTL, 
        async () => scheduleService.getStudentStats(studentId)
      );

      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      console.error('Error in /schedule/student-stats:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get student stats'
      };
    }
  })

  /**
   * Get recent activity for student dashboard
   * GET /schedule/student-activity
   */
  .get('/student-activity', async ({ cookie, query, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'studentAuth');

      const limit = query.limit ? parseInt(query.limit as string) : 10;

      const cacheKey = `student:activity:${studentId}:${limit}`;
      const activity = await cacheGetOrSet(
        cacheKey,
        STUDENT_ACTIVITY_CACHE_TTL,
        async () => scheduleService.getStudentRecentActivity(studentId, limit)
      );

      return {
        success: true,
        data: activity
      };
    } catch (error: any) {
      console.error('Error in /schedule/student-activity:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get student activity'
      };
    }
  })

  /**
   * Get lesson details by booking ID
   * GET /schedule/lesson/:bookingId
   */
  .get('/lesson/:bookingId', async ({ cookie, params, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'studentAuth');

      const { bookingId } = params;

      const lessonDetails = await scheduleService.getLessonDetails(bookingId, studentId);
      return {
        success: true,
        data: lessonDetails
      };
    } catch (error: any) {

      console.error('Error message:', error.message);

      return {
        success: false,
        error: error.message || 'Failed to get lesson details'
      };
    }
  })

  /**
   * Get available slots for a tutor
   * GET /schedule/available/:tutorId
   */
  .get('/available/:tutorId', async ({ params, query, set }) => {
    try {
      const { tutorId } = params;
      
      if (!tutorId) {
        return { success: false, error: 'Tutor ID is required' };
      }
      
      // Default to next 7 days if not specified
      const now = new Date();
      const startDate = (query.startDate as string) || now.toISOString().split('T')[0] || "";
      const endDate = (query.endDate as string) || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || "";

 
      const slots = await scheduleService.getAvailableSlots(tutorId, startDate, endDate);

      return {
        success: true,
        data: slots
      };
    } catch (error: any) {
      console.error('Error in /schedule/available:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to get available slots'
      };
    }
  })

  /**
   * Book a time slot
   * POST /schedule/book
   * Rate limited: 5 bookings per minute per user
   */
  .post('/book', async ({ body, cookie, set }) => {
    try {
      console.log('=== BOOKING REQUEST STARTED ===');
      console.log('Request body:', JSON.stringify(body, null, 2));
      
      const raw = cookie.studentAuth?.value;
      console.log('Cookie studentAuth raw:', raw ? 'Present' : 'Missing');
      
      if (!raw) {
        console.log('ERROR: No authentication cookie found');
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      console.log('Auth payload verified:', JSON.stringify(payload, null, 2));
      
      const studentId = payload.userId;
      console.log('Student ID:', studentId);
      
      // Rate limiting check
      const rateLimitError = await rateLimitMiddleware(studentId, 'booking', set as any);
      if (rateLimitError) {
        console.log('ERROR: Rate limit exceeded for student:', studentId);
        return rateLimitError;
      }
      
      console.log('Slot ID from body:', body.slotId);

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'studentAuth');
      console.log('Cookie refreshed');

      console.log('Calling scheduleService.bookSlot...');
      console.log('Ticket transfer tx hash:', body.ticketTransferTxHash || 'Not provided');
      
      const booking = await scheduleService.bookSlot({
        studentId,
        slotId: body.slotId,
        ticketTransferTxHash: body.ticketTransferTxHash
      });
      
      console.log('Booking successful:', JSON.stringify(booking, null, 2));
      console.log('=== BOOKING REQUEST COMPLETED ===');

      // Invalidate tutor search cache since slot is no longer available
      await invalidateCache('tutor:search:*');

      return {
        success: true,
        data: booking,
        message: 'Booking confirmed successfully'
      };
    } catch (error: any) {
      console.error('=== BOOKING ERROR ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error('=== END BOOKING ERROR ===');
      
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to book slot'
      };
    }
  }, {
    body: t.Object({
      slotId: ID(),
      ticketTransferTxHash: t.Optional(t.String({ maxLength: 66 }))
    })
  })

  /**
   * Cancel a booking (student action)
   * POST /schedule/cancel
   * Refunds ticket if cancellation is more than 1 hour before scheduled time
   */
  .post('/cancel', async ({ body, cookie, set }) => {
    try {
      console.log('=== CANCEL BOOKING REQUEST ===');
      
      const raw = cookie.studentAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'studentAuth');

      console.log('Cancelling booking:', body.bookingId, 'for student:', studentId);

      const result = await scheduleService.cancelBooking({
        bookingId: body.bookingId,
        cancelledBy: studentId,
        reason: body.reason
      });

      console.log('Cancellation result:', result);

      // Invalidate tutor search cache since slot may be available again
      await invalidateCache('tutor:search:*');

      return {
        success: result.success,
        refunded: result.refunded,
        message: result.message
      };
    } catch (error: any) {
      console.error('Error in /schedule/cancel:', error);
      set.status = 400;
      return {
        success: false,
        error: error.message || 'Failed to cancel booking'
      };
    }
  }, {
    body: t.Object({
      bookingId: ID(),
      reason: t.Optional(SafeString({ maxLength: 500 }))
    })
  })

  /**
   * Get lesson details by booking ID (Tutor view)
   * GET /schedule/tutor-lesson/:bookingId
   */
  .get('/tutor-lesson/:bookingId', async ({ cookie, params, set }) => {
    try {
      const raw = cookie.tutorAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const tutorId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'tutorAuth');

      const { bookingId } = params;

      const lessonDetails = await scheduleService.getTutorLessonDetails(bookingId, tutorId);
      return {
        success: true,
        data: lessonDetails
      };
    } catch (error: any) {
      console.error('Error in /schedule/tutor-lesson:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get lesson details'
      };
    }
  })

  /**
   * Preload/warm cache for student's upcoming lesson data
   * POST /schedule/preload
   * This endpoint fetches and caches all relevant data for a student's dashboard
   */
  .post('/preload', async ({ cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      // Refresh JWT cookie on every request
      await refreshJwtCookie(cookie, payload, 'studentAuth');

      // Warm all student-related caches in parallel
      const [stats, bookings, activity] = await Promise.all([
        cacheGetOrSet(
          `student:stats:${studentId}`,
          STUDENT_STATS_CACHE_TTL,
          async () => scheduleService.getStudentStats(studentId)
        ),
        cacheGetOrSet(
          `student:bookings:${studentId}`,
          STUDENT_BOOKINGS_CACHE_TTL,
          async () => scheduleService.getStudentBookings(studentId)
        ),
        cacheGetOrSet(
          `student:activity:${studentId}:50`, // Default activity limit
          STUDENT_ACTIVITY_CACHE_TTL,
          async () => scheduleService.getStudentRecentActivity(studentId, 50)
        )
      ]);

      return {
        success: true,
        message: 'Data preloaded successfully',
        data: {
          stats,
          bookingsCount: bookings.length,
          activityCount: activity.length
        }
      };
    } catch (error: any) {
      console.error('Error in /schedule/preload:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to preload data'
      };
    }
  })

  /**
   * Invalidate student's cache (called after booking/cancellation)
   * POST /schedule/invalidate-cache
   */
  .post('/invalidate-cache', async ({ cookie, set }) => {
    try {
      const raw = cookie.studentAuth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const payload = await verifyAuthToken(String(raw));
      if (!payload) {
        set.status = 401;
        return { success: false, error: 'Invalid or expired token' };
      }
      const studentId = payload.userId;

      // Invalidate all student-related caches
      await Promise.all([
        invalidateCache(`student:stats:${studentId}`),
        invalidateCache(`student:bookings:${studentId}`),
        invalidateCache(`student:activity:${studentId}:10`),
        invalidateCache(`student:activity:${studentId}:50`)
      ]);

      return {
        success: true,
        message: 'Cache invalidated successfully'
      };
    } catch (error: any) {
      console.error('Error in /schedule/invalidate-cache:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Failed to invalidate cache'
      };
    }
  });

export default Schedule;
