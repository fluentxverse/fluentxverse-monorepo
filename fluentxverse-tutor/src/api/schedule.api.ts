import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

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
    console.log('📡 scheduleApi.openSlots called with:', {
      baseURL: API_BASE_URL,
      endpoint: '/schedule/open',
      slots
    });
    
    try {
      const response = await api.post('/schedule/open', { slots });
      console.log('📡 scheduleApi.openSlots response:', response.data);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to open slots');
      }
    } catch (error) {
      console.error('❌ scheduleApi.openSlots error:', error);
      if (axios.isAxiosError(error)) {
        console.error('  Request:', error.config?.url, error.config?.method);
        console.error('  Response status:', error.response?.status);
        console.error('  Response data:', error.response?.data);
      }
      throw error;
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
  }
};
