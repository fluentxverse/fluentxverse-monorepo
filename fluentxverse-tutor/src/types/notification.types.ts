// Notification types for FluentXVerse tutor app

export type NotificationType = 
  | 'booking_new'           // New booking received
  | 'booking_cancelled'     // Student cancelled booking
  | 'session_reminder'      // Session starting soon
  | 'session_started'       // Session has started
  | 'interview_scheduled'   // Interview scheduled
  | 'interview_reminder'    // Interview starting soon
  | 'payment_received'      // Payment received
  | 'review_received'       // Student left a review
  | 'system'                // System notification
  | 'message';              // New message

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  data?: {
    bookingId?: string;
    sessionId?: string;
    studentId?: string;
    studentName?: string;
    date?: string;
    time?: string;
    amount?: number;
    rating?: number;
    link?: string;
  };
}

export interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

// Socket events for notifications
export interface NotificationSocketEvents {
  // Server to client
  'notification:new': (notification: Notification) => void;
  'notification:list': (notifications: Notification[]) => void;
  'notification:read': (notificationId: string) => void;
  'notification:read-all': () => void;
  
  // Client to server
  'notification:subscribe': () => void;
  'notification:mark-read': (notificationId: string) => void;
  'notification:mark-all-read': () => void;
  'notification:get-all': () => void;
}
