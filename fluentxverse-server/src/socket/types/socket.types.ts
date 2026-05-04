// Socket event types

export interface ServerToClientEvents {
  // Chat events
  'chat:message': (data: ChatMessageData) => void;
  'chat:history': (data: ChatMessageData[]) => void;
  'chat:typing': (data: { userId: string; isTyping: boolean }) => void;
  
  // Session events
  'session:user-joined': (data: { userId: string; userType: string }) => void;
  'session:user-left': (data: { userId: string; userType: string }) => void;
  'session:state': (data: SessionState) => void;
  'session:lesson-ended': (data: { tutorId: string; message?: string }) => void;
  
  // WebRTC signaling events
  'webrtc:offer': (data: { offer: any; from: string }) => void;
  'webrtc:answer': (data: { answer: any; from: string }) => void;
  'webrtc:ice-candidate': (data: { candidate: any; from: string }) => void;
  'webrtc:peer-left': () => void;
  
  // Interview events
  'interview:admin-joined': () => void;
  'interview:tutor-joined': () => void;
  'interview:offer': (data: { offer: any }) => void;
  'interview:answer': (data: { answer: any }) => void;
  'interview:ice-candidate': (data: { candidate: any }) => void;
  'interview:ended': () => void;
  'interview:tutor-left': () => void;
  'interview:admin-left': () => void;
  
  // Schedule events
  'schedule:slot-booked': (data: { tutorId: string; slotKey: string; bookingId?: string; studentId: string; studentName?: string; date: string; time: string }) => void;
  'schedule:slot-cancelled': (data: { tutorId: string; slotKey: string; date: string; time: string }) => void;
  
  // Ticket events
  'ticket:received': (data: TicketReceivedData) => void;
  'ticket:balance-updated': (data: TicketBalanceData) => void;
  
  // Notification events
  'notification:new': (data: NotificationData) => void;
  'notification:list': (data: { notifications: NotificationData[]; unreadCount: number }) => void;
  'notification:read': (data: { notificationId: string; unreadCount: number }) => void;
  'notification:read-all': (data: { unreadCount: number }) => void;
}

export interface ClientToServerEvents {
  // Chat events
  'chat:send': (data: SendMessageData) => void;
  'chat:typing': (data: { isTyping: boolean }) => void;
  'chat:request-history': (data: { sessionId: string }) => void;
  
  // Session events
  'session:join': (data: { sessionId: string }) => void;
  'session:leave': () => void;
  'session:end-lesson': (data: { message?: string }) => void;
  
  // WebRTC signaling events
  'webrtc:offer': (data: { offer: any; to: string }) => void;
  'webrtc:answer': (data: { answer: any; to: string }) => void;
  'webrtc:ice-candidate': (data: { candidate: any; to: string }) => void;
  
  // Interview events
  'interview:join': (data: { roomId: string; odIuser?: string; role: 'tutor' | 'admin' }) => void;
  'interview:offer': (data: { roomId: string; offer: any }) => void;
  'interview:answer': (data: { roomId: string; answer: any }) => void;
  'interview:ice-candidate': (data: { roomId: string; candidate: any }) => void;
  'interview:end': (data: { roomId: string }) => void;
  
  // Schedule events
  'schedule:subscribe': (data: { tutorId: string }) => void;
  'schedule:unsubscribe': () => void;
  
  // Ticket events
  'ticket:subscribe': () => void;
  'ticket:unsubscribe': () => void;
  
  // Notification events
  'notification:subscribe': () => void;
  'notification:get-all': (data?: { limit?: number; offset?: number }) => void;
  'notification:mark-read': (notificationId: string) => void;
  'notification:mark-all-read': () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  userType: 'tutor' | 'student';
  sessionId?: string;
  interviewRoomId?: string;
  interviewRole?: 'tutor' | 'admin';
  scheduleSubscribedTo?: string; // Tutor ID for schedule subscription
}

// Data structures
export interface ChatMessageData {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: 'tutor' | 'student';
  text: string;
  timestamp: string;
  correction?: string;
  isSystemMessage?: boolean;
  // File attachment support
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'file';
  fileSize?: number;
}

export interface SendMessageData {
  sessionId: string;
  text: string;
  correction?: string;
  // File attachment support
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'file';
  fileSize?: number;
}

export interface SessionState {
  sessionId: string;
  participants: {
    tutorId?: string;
    studentId?: string;
    tutorSocketId?: string;
    studentSocketId?: string;
  };
  status: 'active' | 'waiting';
}

// Ticket notification data
export interface TicketReceivedData {
  userId: string;
  tier: 'basic' | 'premium' | 'trial';
  quantity: number;
  transactionId: string;
  timestamp: string;
}

export interface TicketBalanceData {
  userId: string;
  balance: {
    basic: number;
    premium: number;
    trial: number;
    total: number;
  };
}

// Notification data
export interface NotificationData {
  id: string;
  userId: string;
  type: 'ticket_received' | 'booking_confirmed' | 'lesson_reminder' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}
