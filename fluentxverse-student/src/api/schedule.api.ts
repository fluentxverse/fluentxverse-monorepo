import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

export interface StudentBooking {
  bookingId: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar?: string;
  slotDate: string;
  slotTime: string;
  durationMinutes: number;
  status: string;
  attendanceTutor?: string;
  attendanceStudent?: string;
  bookedAt: Date;
}

export interface AvailableSlot {
  slotId: string;
  tutorId: string;
  date: string;
  time: string;
  durationMinutes: number;
}

export interface StudentStats {
  lessonsCompleted: number;
  upcomingLessons: number;
  totalHours: number;
  nextLesson?: {
    tutorName: string;
    tutorAvatar?: string;
    slotDate: string;
    slotTime: string;
    bookingId: string;
  };
}

export interface RecentActivity {
  type: 'lesson_completed' | 'lesson_booked';
  tutorName: string;
  tutorAvatar?: string;
  date: string;
  action: string;
  bookingId?: string;
  slotDate?: string;
  timestamp: Date;
}

export const scheduleApi = {
  /**
   * Get student's bookings
   */
  getStudentBookings: async (): Promise<StudentBooking[]> => {
    try {
      const response = await api.get('/schedule/student-bookings');
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get bookings');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to get student bookings:', error);
      throw error;
    }
  },

  /**
   * Get student statistics for dashboard
   */
  getStudentStats: async (): Promise<StudentStats> => {
    try {
      const response = await api.get('/schedule/student-stats');
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get student stats');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to get student stats:', error);
      throw error;
    }
  },

  /**
   * Get available slots for a tutor
   */
  getAvailableSlots: async (tutorId: string, startDate?: string, endDate?: string): Promise<AvailableSlot[]> => {
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get(`/schedule/available/${tutorId}`, { params });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get available slots');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to get available slots:', error);
      throw error;
    }
  },

  /**
   * Book a time slot
   */
  bookSlot: async (slotId: string): Promise<any> => {
    try {
      const response = await api.post('/schedule/book', { slotId });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to book slot');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Failed to book slot:', error);
      throw error.response?.data?.error || error.message || 'Failed to book slot';
    }
  },

  /**
   * Get recent activity for student dashboard
   */
  getStudentActivity: async (limit: number = 10): Promise<RecentActivity[]> => {
    try {
      const response = await api.get('/schedule/student-activity', { 
        params: { limit } 
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get student activity');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to get student activity:', error);
      throw error;
    }
  },

  /**
   * Get lesson details by booking ID
   */
  getLessonDetails: async (bookingId: string): Promise<any> => {
    console.log('\n=== FRONTEND API: getLessonDetails ===');
    console.log('Requesting bookingId:', bookingId);
    
    try {
      const response = await api.get(`/schedule/lesson/${bookingId}`);
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      if (!response.data.success) {
        console.error('API returned error:', response.data.error);
        throw new Error(response.data.error || 'Failed to get lesson details');
      }
      
      console.log('Lesson data received:', JSON.stringify(response.data.data, null, 2));
      console.log('=== END FRONTEND API ===\n');
      return response.data.data;
    } catch (error: any) {
      console.error('=== ERROR in FRONTEND API ===');
      console.error('Failed to get lesson details:', error);
      console.error('Error response:', error.response?.data);
      throw error.response?.data?.error || error.message || 'Failed to load lesson';
    }
  }
};
