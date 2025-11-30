import axios from 'axios';
import type { 
  Tutor, 
  TutorProfile, 
  TutorSearchParams, 
  TutorSearchResponse 
} from '../types/tutor.types';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

export const tutorApi = {
  /**
   * Search tutors with filters
   */
  searchTutors: async (params: TutorSearchParams): Promise<TutorSearchResponse> => {
    const response = await api.get<{ success: boolean; data: TutorSearchResponse }>('/tutor/search', {
      params: {
        q: params.query,
        languages: params.languages,
        specializations: params.specializations,
        minRating: params.minRating,
        maxHourlyRate: params.maxHourlyRate,
        minHourlyRate: params.minHourlyRate,
        isAvailable: params.isAvailable,
        sortBy: params.sortBy,
        page: params.page,
        limit: params.limit
      }
    });

    if (!response.data.success) {
      throw new Error('Failed to search tutors');
    }

    return response.data.data;
  },

  /**
   * Get featured tutors
   */
  getFeaturedTutors: async (limit = 6): Promise<Tutor[]> => {
    const response = await api.get<{ success: boolean; data: Tutor[] }>('/tutor/featured', {
      params: { limit }
    });

    if (!response.data.success) {
      throw new Error('Failed to get featured tutors');
    }

    return response.data.data;
  },

  /**
   * Get tutor profile by ID
   */
  getTutorProfile: async (tutorId: string): Promise<TutorProfile> => {
    const response = await api.get<{ success: boolean; data: TutorProfile }>(`/tutor/${tutorId}`);

    if (!response.data.success) {
      throw new Error('Tutor not found');
    }

    return response.data.data;
  },

  /**
   * Get available filter options
   */
  getFilterLanguages: async (): Promise<string[]> => {
    const response = await api.get<{ success: boolean; data: string[] }>('/tutor/filters/languages');

    if (!response.data.success) {
      throw new Error('Failed to get languages');
    }

    return response.data.data;
  },

  getFilterSpecializations: async (): Promise<string[]> => {
    const response = await api.get<{ success: boolean; data: string[] }>('/tutor/filters/specializations');

    if (!response.data.success) {
      throw new Error('Failed to get specializations');
    }

    return response.data.data;
  },

  /**
   * Get tutor weekly availability grid
   */
  getAvailability: async (
      tutorId: string
    ): Promise<Array<{ date: string; time: string; status: 'AVAIL' | 'TAKEN' | 'BOOKED'; studentId?: string }>> => {
      const response = await api.get<{
        success: boolean;
        data: Array<{ date: string; time: string; status: 'AVAIL' | 'TAKEN' | 'BOOKED'; studentId?: string }>;
      }>(`/tutor/${tutorId}/availability`);

      if (!response.data.success) {
        throw new Error('Failed to get availability');
      }

      return response.data.data;
    }
};
