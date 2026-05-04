import { useEffect } from 'preact/hooks';
import { useNotificationStore } from '../context/NotificationContext';
import { initSocket, connectSocket } from '../client/socket/socket.client';
import { useAuthContext } from '../context/AuthContext';
import type { Notification } from '../types/notification.types';

let notificationSocketWarningShown = false;
const dispatchedScheduleNotificationIds = new Set<string>();
const notificationSocketEnabled =
  String(import.meta.env.VITE_ENABLE_NOTIFICATION_SOCKET ?? 'true').toLowerCase() !== 'false';
const NOTIFICATION_REFRESH_INTERVAL_MS = 10000;

const warnNotificationRealtimeUnavailable = () => {
  if (!notificationSocketWarningShown) {
    console.warn('Notification realtime connection unavailable. Falling back to standard refresh.');
    notificationSocketWarningShown = true;
  }
};

const dispatchScheduleNotificationEvent = (notification: Notification) => {
  if (notification.type !== 'booking_new' && notification.type !== 'booking_cancelled') {
    return;
  }

  window.dispatchEvent(new CustomEvent('fxv:schedule-notification', {
    detail: notification
  }));
};

const dispatchScheduleNotificationOnce = (notification: Notification) => {
  if (!notification.id || dispatchedScheduleNotificationIds.has(notification.id)) {
    return;
  }

  dispatchedScheduleNotificationIds.add(notification.id);
  dispatchScheduleNotificationEvent(notification);
};

export const useNotifications = () => {
  const { 
    notifications,
    unreadCount,
    isLoading,
    error,
    isDropdownOpen,
    fetchNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setDropdownOpen,
    toggleDropdown,
    setUnreadCount
  } = useNotificationStore();
  const { user } = useAuthContext();

  useEffect(() => {
    let isActive = true;
    let refreshInterval: ReturnType<typeof setInterval> | undefined;

    const startStandardRefresh = () => {
      if (refreshInterval) {
        return;
      }

      refreshInterval = setInterval(() => {
        if (isActive) {
          void fetchNotifications();
        }
      }, NOTIFICATION_REFRESH_INTERVAL_MS);
    };

    const stopStandardRefresh = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = undefined;
      }
    };

    void fetchNotifications();

    if (!notificationSocketEnabled) {
      startStandardRefresh();
      return () => {
        isActive = false;
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      };
    }

    try {
      const token = user ? JSON.stringify({
        userId: user.userId,
        email: user.email,
        tier: 2
      }) : undefined;
      const socket = initSocket(token);

      const subscribeToNotifications = () => {
        if (!isActive) {
          return;
        }

        stopStandardRefresh();
        socket.emit('notification:subscribe');
        void fetchNotifications();
      };

      const handleDisconnect = () => {
        if (isActive) {
          startStandardRefresh();
        }
      };

      const handleConnectError = () => {
        warnNotificationRealtimeUnavailable();
        startStandardRefresh();
        void fetchNotifications();
      };

      const handleNewNotification = (notification: Notification) => {
        addNotification(notification);
        dispatchScheduleNotificationOnce(notification);

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/assets/img/logo/icon_logo.png'
          });
        }
      };

      const handleNotificationList = (data: { notifications: Notification[]; unreadCount: number }) => {
        useNotificationStore.setState({
          notifications: data.notifications,
          unreadCount: data.unreadCount
        });
      };

      const handleNotificationRead = (data: { notificationId: string; unreadCount: number }) => {
        setUnreadCount(data.unreadCount);
        useNotificationStore.setState((state) => ({
          notifications: state.notifications.map(n => n.id === data.notificationId ? { ...n, isRead: true } : n)
        }));
      };

      const handleNotificationReadAll = (data: { unreadCount: number }) => {
        setUnreadCount(data.unreadCount);
        useNotificationStore.setState((state) => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true }))
        }));
      };

      const handleNotificationDelete = (data: { notificationId: string; unreadCount: number }) => {
        setUnreadCount(data.unreadCount);
        useNotificationStore.setState((state) => ({
          notifications: state.notifications.filter(n => n.id !== data.notificationId)
        }));
      };

      socket.on('connect', subscribeToNotifications);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleConnectError);
      socket.on('notification:new', handleNewNotification);
      socket.on('notification:list', handleNotificationList);
      socket.on('notification:read', handleNotificationRead);
      socket.on('notification:read-all', handleNotificationReadAll);
      socket.on('notification:delete', handleNotificationDelete);

      startStandardRefresh();
      connectSocket();

      if (socket.connected) {
        subscribeToNotifications();
      }

      return () => {
        isActive = false;
        stopStandardRefresh();
        socket.off('connect', subscribeToNotifications);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        socket.off('notification:new', handleNewNotification);
        socket.off('notification:list', handleNotificationList);
        socket.off('notification:read', handleNotificationRead);
        socket.off('notification:read-all', handleNotificationReadAll);
        socket.off('notification:delete', handleNotificationDelete);
      };
    } catch (error) {
      warnNotificationRealtimeUnavailable();
      startStandardRefresh();
      void fetchNotifications();
    }

    return () => {
      isActive = false;
      stopStandardRefresh();
    };
  }, [user?.userId, user?.email]);

  useEffect(() => {
    notifications.forEach((notification) => {
      if (!notification.isRead) {
        dispatchScheduleNotificationOnce(notification);
      }
    });
  }, [notifications]);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    isDropdownOpen,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setDropdownOpen,
    toggleDropdown,
    refreshNotifications: fetchNotifications
  };
};

// Helper function to get notification icon based on type
export const getNotificationIcon = (type: string): { icon: string; color: string } => {
  switch (type) {
    case 'booking_new':
      return { icon: 'fa-calendar-plus', color: '#10b981' };
    case 'booking_cancelled':
      return { icon: 'fa-calendar-times', color: '#ef4444' };
    case 'session_reminder':
      return { icon: 'fa-bell', color: '#f59e0b' };
    case 'session_started':
      return { icon: 'fa-video', color: '#3b82f6' };
    case 'interview_scheduled':
      // Use blue to match modal styling
      return { icon: 'fa-user-tie', color: '#3b82f6' };
    case 'interview_reminder':
      return { icon: 'fa-clock', color: '#f59e0b' };
    case 'payment_received':
      return { icon: 'fa-coins', color: '#10b981' };
    case 'review_received':
      return { icon: 'fa-star', color: '#f59e0b' };
    case 'message':
      return { icon: 'fa-envelope', color: '#3b82f6' };
    default:
      return { icon: 'fa-info-circle', color: '#64748b' };
  }
};

// Format relative time
export const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
