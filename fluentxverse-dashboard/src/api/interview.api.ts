import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true
});

export interface InterviewSlot {
  id: string;
  date: string;
  time: string;
  status: 'open' | 'booked' | 'completed' | 'cancelled';
  tutorId?: string;
  tutorName?: string;
  tutorEmail?: string;
  createdAt: string;
  bookedAt?: string;
  notes?: string;
}

export interface InterviewWeekSchedule {
  weekStart: string;
  weekEnd: string;
  slots: InterviewSlot[];
}

export interface PendingInterview {
  id: string;
  date: string;
  time: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  bookedAt: string;
}

export const interviewApi = {
  /**
   * Create interview slots (Admin)
   */
  createSlots: async (slots: { date: string; time: string }[]): Promise<InterviewSlot[]> => {
    const response = await api.post('/interview/slots', { slots });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create interview slots');
    }
    return response.data.data;
  },

  /**
   * Delete interview slots (Admin)
   */
  deleteSlots: async (slotIds: string[]): Promise<void> => {
    const response = await api.delete('/interview/slots', { data: { slotIds } });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete interview slots');
    }
  },

  /**
   * Get interview schedule for a week (Admin view)
   */
  getWeekSchedule: async (weekOffset: number = 0): Promise<InterviewWeekSchedule> => {
    const response = await api.get('/interview/week', { params: { weekOffset } });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get interview schedule');
    }
    return response.data.data;
  },

  /**
   * Get pending interviews (Admin)
   */
  getPendingInterviews: async (limit: number = 20): Promise<PendingInterview[]> => {
    const response = await api.get('/interview/pending', { params: { limit } });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get pending interviews');
    }
    return response.data.data;
  },

  /**
   * Cancel interview booking (Admin)
   */
  adminCancelBooking: async (slotId: string): Promise<void> => {
    const response = await api.post('/interview/admin/cancel', { slotId });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cancel interview');
    }
  },

  /**
   * Mark interview as completed (Admin)
   */
  completeInterview: async (slotId: string, notes?: string): Promise<void> => {
    const response = await api.post('/interview/complete', { slotId, notes });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to complete interview');
    }
  }
};
