import axios from 'axios';

// Dynamically determine API host - use same host as the page but on port 8765
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return `http://${host}:8765`;
  }
  return 'http://localhost:8765';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true
});

export interface InterviewSlot {
  id: string;
  date: string;
  time: string;
  status: 'open' | 'booked' | 'completed' | 'cancelled';
  tutorId?: string;
  createdAt: string;
  bookedAt?: string;
}

export interface MyInterview {
  id: string;
  date: string;
  time: string;
  status: 'booked';
  bookedAt: string;
}

export const interviewApi = {
  /**
   * Get available interview slots (Tutor)
   */
  getAvailableSlots: async (weekOffset: number = 0): Promise<InterviewSlot[]> => {
    const response = await api.get('/interview/available', { params: { weekOffset } });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get available slots');
    }
    return response.data.data;
  },

  /**
   * Get tutor's current interview booking
   */
  getMyBooking: async (): Promise<MyInterview | null> => {
    const response = await api.get('/interview/my-booking');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get interview booking');
    }
    return response.data.data;
  },

  /**
   * Book an interview slot (Tutor)
   */
  bookSlot: async (slotId: string): Promise<InterviewSlot> => {
    const response = await api.post('/interview/book', { slotId });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to book interview');
    }
    return response.data.data;
  },

  /**
   * Cancel interview booking (Tutor)
   */
  cancelBooking: async (slotId: string): Promise<void> => {
    const response = await api.post('/interview/cancel', { slotId });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cancel interview');
    }
  }
};
