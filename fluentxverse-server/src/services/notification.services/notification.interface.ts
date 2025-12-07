// Notification service interfaces

export type NotificationType = 
  | 'booking_new'
  | 'booking_cancelled'
  | 'session_reminder'
  | 'session_started'
  | 'interview_scheduled'
  | 'interview_reminder'
  | 'payment_received'
  | 'review_received'
  | 'system'
  | 'message';

export interface Notification {
  id: string;
  userId: string;
  userType: 'tutor' | 'student' | 'admin';
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
    tutorId?: string;
    tutorName?: string;
    date?: string;
    time?: string;
    amount?: number;
    rating?: number;
    link?: string;
  };
}

export interface CreateNotificationParams {
  userId: string;
  userType: 'tutor' | 'student' | 'admin';
  type: NotificationType;
  title: string;
  message: string;
  data?: Notification['data'];
}

export interface NotificationFilters {
  userId: string;
  isRead?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}
