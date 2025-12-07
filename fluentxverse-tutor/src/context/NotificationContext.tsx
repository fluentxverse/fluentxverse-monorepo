import { create } from 'zustand';
import type { Notification } from '../types/notification.types';
import { notificationApi } from '../api/notification.api';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isDropdownOpen: boolean;
  
  // Actions
  fetchNotifications: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  setDropdownOpen: (isOpen: boolean) => void;
  toggleDropdown: () => void;
  setUnreadCount: (count: number) => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  isDropdownOpen: false,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await notificationApi.getNotifications();
      set({ 
        notifications: data.notifications, 
        unreadCount: data.unreadCount,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch notifications',
        isLoading: false 
      });
    }
  },

  addNotification: (notification: Notification) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1)
    }));
  },

  markAsRead: async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      set(state => ({
        notifications: state.notifications.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to mark as read' });
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationApi.markAllAsRead();
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to mark all as read' });
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      await notificationApi.deleteNotification(notificationId);
      set(state => {
        const notification = state.notifications.find(n => n.id === notificationId);
        return {
          notifications: state.notifications.filter(n => n.id !== notificationId),
          unreadCount: notification && !notification.isRead 
            ? Math.max(0, state.unreadCount - 1) 
            : state.unreadCount
        };
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete notification' });
    }
  },

  setDropdownOpen: (isOpen: boolean) => set({ isDropdownOpen: isOpen }),
  
  toggleDropdown: () => set(state => ({ isDropdownOpen: !state.isDropdownOpen })),
  
  setUnreadCount: (count: number) => set({ unreadCount: count }),
  
  clearError: () => set({ error: null })
}));
