import Elysia, { t } from 'elysia';
import { ScheduleService } from '../services/schedule.services/schedule.service';
import type { AuthData } from '@/services/auth.services/auth.interface';
import { refreshAuthCookie } from '../utils/refreshCookie';

const scheduleService = new ScheduleService();

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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'tutorAuth');

      await scheduleService.openSlots({
        tutorId,
        slots: body.slots
      });

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
        date: t.String(),
        time: t.String()
      }))
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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'tutorAuth');

      await scheduleService.closeSlots({
        tutorId,
        slotIds: body.slotIds
      });

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
      slotIds: t.Array(t.String())
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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'tutorAuth');

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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'tutorAuth');

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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const studentId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'studentAuth');

      const bookings = await scheduleService.getStudentBookings(studentId);

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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const studentId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'studentAuth');

      const stats = await scheduleService.getStudentStats(studentId);


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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const studentId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'studentAuth');

      const limit = query.limit ? parseInt(query.limit as string) : 10;

      const activity = await scheduleService.getStudentRecentActivity(studentId, limit);

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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const studentId = authData.userId;

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'studentAuth');

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

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      console.log('Auth data parsed:', JSON.stringify(authData, null, 2));
      
      const studentId = authData.userId;
      console.log('Student ID:', studentId);
      console.log('Slot ID from body:', body.slotId);

      // Refresh cookie on every request
      refreshAuthCookie(cookie, authData, 'studentAuth');
      console.log('Cookie refreshed');

      console.log('Calling scheduleService.bookSlot...');
      const booking = await scheduleService.bookSlot({
        studentId,
        slotId: body.slotId
      });
      
      console.log('Booking successful:', JSON.stringify(booking, null, 2));
      console.log('=== BOOKING REQUEST COMPLETED ===');

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
      slotId: t.String()
    })
  });

export default Schedule;
