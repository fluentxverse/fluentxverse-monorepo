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
  });

export default Schedule;
