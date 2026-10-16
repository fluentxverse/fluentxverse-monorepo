import { useEffect, useRef, useState } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { connectSocket, initSocket } from '../client/socket/socket.client';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  timestamp: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user) return;

    // Initialize native WebSocket connection through the shared realtime adapter.
    const initNotificationSocket = async () => {
      try {
        const socket = initSocket();
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('notification:subscribe');
        });

        socket.on('notification:list', (data: any) => {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
          setIsLoading(false);
        });

        socket.on('notification:new', (notification: Notification) => {
          setNotifications((prev) => [notification, ...prev]);
          if (!notification.isRead) {
            setUnreadCount((prev) => prev + 1);
          }

          // Show browser notification
          if (Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/assets/img/logo/icon_logo.png'
            });
          }
        });

        socket.on('notification:read', (data: any) => {
          setUnreadCount(data.unreadCount);
          setNotifications((prev) =>
            prev.map((n) => (n.id === data.notificationId ? { ...n, isRead: true } : n))
          );
        });

        socket.on('notification:read-all', (data: any) => {
          setUnreadCount(data.unreadCount);
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        });

        socket.on('notification:delete', (data: any) => {
          setUnreadCount(data.unreadCount);
          setNotifications((prev) => prev.filter((n) => n.id !== data.notificationId));
        });

        connectSocket();
        if (socket.connected) {
          socket.emit('notification:subscribe');
        }
      } catch (err) {
        console.error('Socket initialization error:', err);
        setError(err instanceof Error ? err.message : 'Connection error');
        setIsLoading(false);
      }
    };

    initNotificationSocket();

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('notification:list');
        socketRef.current.off('notification:new');
        socketRef.current.off('notification:read');
        socketRef.current.off('notification:read-all');
        socketRef.current.off('notification:delete');
      }
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('notification:read', { notificationId });
    }
  };

  const markAllAsRead = async () => {
    if (socketRef.current) {
      socketRef.current.emit('notification:read-all');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('notification:delete', { notificationId });
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };
};

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
