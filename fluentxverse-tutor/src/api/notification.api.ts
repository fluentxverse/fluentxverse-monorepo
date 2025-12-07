import axios from 'axios';
import type { Notification } from '../types/notification.types';

// Dynamically determine API host
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

export interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

export const notificationApi = {
  /**
   * Get all notifications
   */
  getNotifications: async (limit = 50, offset = 0): Promise<NotificationResponse> => {
    const response = await api.get<{ success: boolean; data: NotificationResponse }>('/notifications', {
      params: { limit, offset }
    });

    if (!response.data.success) {
      throw new Error('Failed to get notifications');
    }

    return response.data.data;
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (): Promise<number> => {
    const response = await api.get<{ success: boolean; data: { unreadCount: number } }>('/notifications/unread-count');

    if (!response.data.success) {
      throw new Error('Failed to get unread count');
    }

    return response.data.data.unreadCount;
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (notificationId: string): Promise<void> => {
    const response = await api.post<{ success: boolean }>(`/notifications/${notificationId}/read`);

    if (!response.data.success) {
      throw new Error('Failed to mark notification as read');
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<void> => {
    const response = await api.post<{ success: boolean }>('/notifications/read-all');

    if (!response.data.success) {
      throw new Error('Failed to mark all as read');
    }
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (notificationId: string): Promise<void> => {
    const response = await api.delete<{ success: boolean }>(`/notifications/${notificationId}`);

    if (!response.data.success) {
      throw new Error('Failed to delete notification');
    }
  }
};
