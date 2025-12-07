import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface AdminUser {
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'superadmin';
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: AdminUser;
  error?: string;
}

export interface MeResponse {
  success: boolean;
  user?: AdminUser;
  error?: string;
}

export const authApi = {
  /**
   * Login admin user
   */
  login: async (username: string, password: string): Promise<AdminUser> => {
    const response = await api.post<LoginResponse>('/admin/login', { username, password });
    if (!response.data.success || !response.data.user) {
      throw new Error(response.data.error || 'Login failed');
    }
    return response.data.user;
  },

  /**
   * Logout admin user
   */
  logout: async (): Promise<void> => {
    await api.post('/admin/logout');
  },

  /**
   * Get current admin user
   */
  getMe: async (): Promise<AdminUser | null> => {
    try {
      const response = await api.get<MeResponse>('/admin/me');
      if (!response.data.success || !response.data.user) {
        return null;
      }
      return response.data.user;
    } catch {
      return null;
    }
  },
};
