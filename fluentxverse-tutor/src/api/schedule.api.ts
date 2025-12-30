import { client as api, getErrorMessage } from './utils';
import axios from 'axios';

export interface TimeSlot {
  date: string;  // ISO date string (YYYY-MM-DD)
  time: string;  // Time string (HH:MM AM/PM)
}

export interface WeekSchedule {
  weekStart: string;
  weekEnd: string;
  slots: {
    date: string;
    time: string;
    status: 'open' | 'booked' | 'closed';
    bookingId?: string;
    studentId?: string;
    studentName?: string;
    penaltyCode?: string;
    attendanceTutor?: 'present' | 'absent';
    attendanceStudent?: 'present' | 'absent';
  }[];
}

export const scheduleApi = {
  /**
   * Open time slots
   */
  openSlots: async (slots: TimeSlot[]): Promise<void> => {
    try {
      const response = await api.post('/schedule/open', { slots });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to open slots');
      }
    } catch (error) {
      console.error('scheduleApi.openSlots error:', error);
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Close time slots
   */
  closeSlots: async (slotIds: string[]): Promise<void> => {
    const response = await api.post('/schedule/close', { slotIds });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to close slots');
    }
  },

  /**
   * Get tutor's schedule for a week
   */
  getWeekSchedule: async (weekOffset: number): Promise<WeekSchedule> => {
    const response = await api.get('/schedule/week', {
      params: { weekOffset }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get schedule');
    }
    
    return response.data.data;
  },

  /**
   * Mark attendance for a booking
   */
  markAttendance: async (bookingId: string, status: 'present' | 'absent'): Promise<void> => {
    const response = await api.post('/schedule/attendance', {
      bookingId,
      status
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to mark attendance');
    }
  },

  /**
   * Get lesson details for tutor
   */
  getTutorLessonDetails: async (bookingId: string): Promise<{
    bookingId: string;
    studentId: string;
    studentName: string;
    studentAvatar?: string;
    studentEmail?: string;
    slotDate: string;
    slotTime: string;
    durationMinutes: number;
    status: string;
    bookedAt: Date;
    sessionId?: string;
  }> => {
    const response = await api.get(`/schedule/tutor-lesson/${bookingId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get lesson details');
    }
    
    return response.data.data;
  }
};