import axios from 'axios';
import type { 
  Tutor, 
  TutorProfile, 
  TutorSearchParams, 
  TutorSearchResponse 
} from '../types/tutor.types';

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


  /**
   * Upload tutor profile picture
   */
  uploadProfilePicture: async (file: File): Promise<string> => {
    const MAX_BYTES = 5 * 1024 * 1024; // 5MB safeguard client-side
    if (file.size > MAX_BYTES) {
      throw new Error(`File too large. Max ${(MAX_BYTES / (1024*1024)).toFixed(1)}MB`);
    }
    const form = new FormData();
    form.append('file', file);

    const response = await api.post<{ success: boolean; url?: string; error?: string }>(
      '/tutor/profile-picture',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    if (!response.data.success || !response.data.url) {
      throw new Error(response.data.error || 'Failed to upload profile picture');
    }

    return response.data.url;
  },

  /**
   * Submit profile for admin review
   */
  submitProfileForReview: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.post<{ success: boolean; message?: string; error?: string }>(
      '/tutor/profile/submit'
    );

    return response.data;
  }
};
