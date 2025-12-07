import { useEffect, useRef } from 'preact/hooks';
import { useNotificationStore } from '../context/NotificationContext';
import { initSocket, getSocket, connectSocket, disconnectSocket } from '../client/socket/socket.client';
import { useAuthContext } from '../context/AuthContext';
import type { Notification } from '../types/notification.types';

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
  
  const socketInitialized = useRef(false);
  const { user } = useAuthContext();

  useEffect(() => {
    // Initialize and connect socket with explicit auth token from context
    if (!socketInitialized.current) {
      try {
        const token = user ? JSON.stringify({
          userId: user.userId,
          email: user.email,
          tier: 2
        }) : undefined;
        initSocket(token);
        connectSocket();
        socketInitialized.current = true;
      } catch (error) {
        console.warn('Socket already initialized');
      }
    }

    // Get socket and subscribe to notifications
    try {
      const socket = getSocket();
      
      console.log('🔌 Socket connected, subscribing to notifications...');
      console.log('🔌 Socket ID:', socket.id);
      
      // Subscribe to notification room
      socket.emit('notification:subscribe');
      console.log('🔌 Notification subscription emitted');

      // Listen for new notifications
      socket.on('notification:new', (notification: Notification) => {
        console.log('🔔 ============ NEW NOTIFICATION RECEIVED ============');
        console.log('🔔 Notification ID:', notification.id);
        console.log('🔔 Title:', notification.title);
        console.log('🔔 Message:', notification.message);
        console.log('🔔 Type:', notification.type);
        console.log('🔔 Timestamp:', notification.timestamp);
        console.log('🔔 Full notification object:', notification);
        console.log('🔔 ===================================================');
        
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
        console.log('📋 Notification list received:', data.notifications.length, 'notifications');
        console.log('📋 Unread count:', data.unreadCount);
        
        // Update store with initial data
        useNotificationStore.setState({
          notifications: data.notifications,
          unreadCount: data.unreadCount
        });
      });

      // Listen for read updates
      socket.on('notification:read', (data: { notificationId: string; unreadCount: number }) => {
        setUnreadCount(data.unreadCount);
      });

      // Listen for read-all updates
      socket.on('notification:read-all', (data: { unreadCount: number }) => {
        setUnreadCount(data.unreadCount);
      });

      return () => {
        socket.off('notification:new');
        socket.off('notification:list');
        socket.off('notification:read');
        socket.off('notification:read-all');
      };
    } catch (error) {
      console.warn('Socket not connected, falling back to HTTP');
      // Fallback to HTTP polling
      fetchNotifications();
    }
  }, []);

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
      return { icon: 'fa-user-tie', color: '#8b5cf6' };
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
