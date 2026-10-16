import { api } from '../client/api';

export interface FavoriteTutor {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar: string | null;
  addedAt: string;
}

export interface PaginatedFavorites {
  favorites: FavoriteTutor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const favoritesApi = {
  /**
   * Get favorite tutors for the logged-in student with pagination
   * @param page - Page number (default 1)
   * @param limit - Items per page (default 10, max 50)
   */
  getFavorites: async (page: number = 1, limit: number = 10): Promise<PaginatedFavorites> => {
    const response = await api.get<{ success: boolean; data: PaginatedFavorites }>(`/student/favorites?page=${page}&limit=${limit}`);
    
    if (!response.data.success) {
      throw new Error('Failed to get favorites');
    }
    
    return response.data.data;
  },

  /**
   * Get all favorites (for backward compatibility - fetches first 100)
   */
  getAllFavorites: async (): Promise<FavoriteTutor[]> => {
    const result = await favoritesApi.getFavorites(1, 100);
    return result.favorites;
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
