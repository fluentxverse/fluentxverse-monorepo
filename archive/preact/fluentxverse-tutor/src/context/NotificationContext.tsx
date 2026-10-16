import { create } from 'zustand';
import type { Notification } from '../types/notification.types';
import { notificationApi } from '../api/notification.api';
import { createNotificationRefresh } from '../utils/notificationRefresh';

let refresh: ((force?: boolean) => Promise<void>) | undefined;

interface NotificationState {
  userId: string | null;
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isDropdownOpen: boolean;
  
  // Actions
  fetchNotifications: (force?: boolean) => Promise<void>;
  setNotificationUser: (userId: string | null) => void;
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
  userId: null,
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  isDropdownOpen: false,

  setNotificationUser: (userId) => {
    if (get().userId === userId) return;
    set({ userId, notifications: [], unreadCount: 0, isLoading: false, error: null });
    refresh = userId ? createNotificationRefresh(async () => {
      if (get().userId !== userId) return;
      set({ isLoading: true, error: null });
      try {
        const data = await notificationApi.getNotifications();
        if (get().userId === userId) set({ notifications: data.notifications, unreadCount: data.unreadCount, isLoading: false });
      } catch (error: any) {
        if (get().userId === userId) set({ error: error.message || 'Failed to fetch notifications', isLoading: false });
        throw error;
      }
    }) : undefined;
  },

  fetchNotifications: async (force = false) => {
    // The refresh gate tracks failures; the store exposes errors without rejecting event handlers.
    await refresh?.(force).catch(() => {});
  },

  addNotification: (notification: Notification) => {
    set(state => {
      const existingNotification = state.notifications.find(n => n.id === notification.id);

      if (existingNotification) {
        return {
          notifications: state.notifications.map(n =>
            n.id === notification.id ? { ...n, ...notification } : n
          ),
          unreadCount: state.unreadCount
        };
      }

      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.isRead ? 0 : 1)
      };
    });
  },

  markAsRead: async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      set(state => {
        const wasUnread = state.notifications.some(n => n.id === notificationId && !n.isRead);

        return {
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
        };
      });
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
