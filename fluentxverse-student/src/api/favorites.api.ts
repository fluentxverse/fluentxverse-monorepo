import { api } from '../client/api';

export interface FavoriteTutor {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar: string | null;
  addedAt: string;
}

export const favoritesApi = {
  /**
   * Get all favorite tutors for the logged-in student
   */
  getFavorites: async (): Promise<FavoriteTutor[]> => {
    const response = await api.get<{ success: boolean; data: FavoriteTutor[] }>('/student/favorites');
    
    if (!response.data.success) {
      throw new Error('Failed to get favorites');
    }
    
    return response.data.data;
  },

  /**
   * Add a tutor to favorites
   */
  addFavorite: async (tutorId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post<{ success: boolean; message: string }>(`/student/favorites/${tutorId}`);
    return response.data;
  },

  /**
   * Remove a tutor from favorites
   */
  removeFavorite: async (tutorId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<{ success: boolean; message: string }>(`/student/favorites/${tutorId}`);
    return response.data;
  },

  /**
   * Check if a tutor is in favorites
   */
  checkFavorite: async (tutorId: string): Promise<boolean> => {
    const response = await api.get<{ success: boolean; isFavorite: boolean }>(`/student/favorites/${tutorId}/check`);
    return response.data.isFavorite;
  },

  /**
   * Toggle favorite status (add if not favorite, remove if favorite)
   */
  toggleFavorite: async (tutorId: string, currentlyFavorite: boolean): Promise<{ success: boolean; isFavorite: boolean }> => {
    if (currentlyFavorite) {
      const result = await favoritesApi.removeFavorite(tutorId);
      return { success: result.success, isFavorite: false };
    } else {
      const result = await favoritesApi.addFavorite(tutorId);
      return { success: result.success, isFavorite: true };
    }
  }
};
