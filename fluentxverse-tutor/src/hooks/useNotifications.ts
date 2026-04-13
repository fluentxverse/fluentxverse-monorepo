import { useEffect } from 'preact/hooks';
import { useNotificationStore } from '../context/NotificationContext';
import { initSocket, connectSocket, destroySocket } from '../client/socket/socket.client';
import { useAuthContext } from '../context/AuthContext';
import type { Notification } from '../types/notification.types';

let notificationRealtimeDisabled = false;
let notificationSocketWarningShown = false;
const notificationSocketEnabled =
  String(import.meta.env.VITE_ENABLE_NOTIFICATION_SOCKET || 'false').toLowerCase() === 'true';

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
    fetchNotifications();

    if (!notificationSocketEnabled) {
      return;
    }

    if (notificationRealtimeDisabled) {
      return;
    }

    try {
      const token = user ? JSON.stringify({
        userId: user.userId,
        email: user.email,
        tier: 2
      }) : undefined;
      const socket = initSocket(token);

      const subscribeToNotifications = () => {
        socket.emit('notification:subscribe');
      };

      const handleConnectError = (error: Error) => {
        if (!notificationSocketWarningShown) {
          console.warn('Notification realtime connection unavailable. Falling back to standard refresh.');
          notificationSocketWarningShown = true;
        }
        notificationRealtimeDisabled = true;
        destroySocket();
        fetchNotifications();
      };

      // Listen for new notifications
      socket.on('notification:new', (notification: Notification) => {
        
        addNotification(notification);
        
        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/assets/img/logo/icon_logo.png'
          });
        }
      });

      // Listen for notification list
      socket.on('notification:list', (data: { notifications: Notification[]; unreadCount: number }) => {
        
        // Update store with initial data
        useNotificationStore.setState({
          notifications: data.notifications,
          unreadCount: data.unreadCount
        });
      });

      // Listen for read updates
      socket.on('notification:read', (data: { notificationId: string; unreadCount: number }) => {
        // Update unread count
        setUnreadCount(data.unreadCount);
        // Update local list: mark the specific notification as read
        useNotificationStore.setState((state) => ({
          notifications: state.notifications.map(n => n.id === data.notificationId ? { ...n, isRead: true } : n)
        }));
      });

      // Listen for read-all updates
      socket.on('notification:read-all', (data: { unreadCount: number }) => {
        setUnreadCount(data.unreadCount);
        // Update all to read
        useNotificationStore.setState((state) => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true }))
        }));
      });

      // Listen for deletion
      socket.on('notification:delete', (data: { notificationId: string; unreadCount: number }) => {
        setUnreadCount(data.unreadCount);
        useNotificationStore.setState((state) => ({
          notifications: state.notifications.filter(n => n.id !== data.notificationId)
        }));
      });

      socket.on('connect', subscribeToNotifications);
      socket.on('connect_error', handleConnectError);

      connectSocket();

      if (socket.connected) {
        subscribeToNotifications();
      }

      return () => {
        socket.off('connect', subscribeToNotifications);
        socket.off('connect_error', handleConnectError);
        socket.off('notification:new');
        socket.off('notification:list');
        socket.off('notification:read');
        socket.off('notification:read-all');
        socket.off('notification:delete');
      };
    } catch (error) {
      notificationRealtimeDisabled = true;
      fetchNotifications();
    }
  }, [user?.userId, user?.email]);

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
