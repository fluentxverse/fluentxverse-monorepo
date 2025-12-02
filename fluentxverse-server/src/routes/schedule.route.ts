import Elysia, { t } from 'elysia';
import { ScheduleService } from '../services/schedule.services/schedule.service';
import type { AuthData } from '@/services/auth.services/auth.interface';

const scheduleService = new ScheduleService();

const Schedule = new Elysia({ prefix: '/schedule' })
  /**
   * Open time slots for tutoring
   * POST /schedule/open
   */
  .post('/open', async ({ body, cookie, set }) => {
    try {
      const raw = cookie.auth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;

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
      const raw = cookie.auth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;

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
      const raw = cookie.auth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;

      const weekOffset = query.weekOffset ? parseInt(query.weekOffset as string) : 0;

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
      const raw = cookie.auth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const tutorId = authData.userId;
      const role = authData.tier >= 2 ? 'tutor' : 'student';

      await scheduleService.markAttendance({
        bookingId: body.bookingId,
        tutorId,
        role,
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
      const raw = cookie.auth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const studentId = authData.userId;

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
      const raw = cookie.auth?.value;
      if (!raw) {
        set.status = 401;
        return { success: false, error: 'Not authenticated' };
      }

      const authData: AuthData = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
      const studentId = authData.userId;

      const booking = await scheduleService.bookSlot({
        studentId,
        slotId: body.slotId
      });

      return {
        success: true,
        data: booking,
        message: 'Booking confirmed successfully'
      };
    } catch (error: any) {
      console.error('Error in /schedule/book:', error);
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
