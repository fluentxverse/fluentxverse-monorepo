// Frontend Socket event types (mirror of backend types)

export interface ServerToClientEvents {
  // Chat events
  'chat:message': (data: ChatMessageData) => void;
  'chat:message-updated': (data: ChatMessageData) => void;
  'chat:message-deleted': (data: { sessionId: string; messageId: string }) => void;
  'chat:history': (data: ChatMessageData[]) => void;
  'chat:typing': (data: { userId: string; isTyping: boolean }) => void;
  'chat:error': (data: { message: string }) => void;
  
  // Session events
  'session:user-joined': (data: { userId: string; userType: string }) => void;
  'session:user-left': (data: { userId: string; userType: string }) => void;
  'session:state': (data: SessionState) => void;
  'session:lesson-ended': (data: { tutorId: string; message?: string }) => void;
  'classroom:video-state': (data: { sessionId: string; userId: string; userType: 'tutor' | 'student'; enabled: boolean }) => void;
  'classroom:activity-history': (data: ClassroomActivityLogData[]) => void;
  'classroom:activity-log': (data: ClassroomActivityLogData) => void;
  
  // WebRTC signaling events
  'webrtc:offer': (data: { offer: RTCSessionDescriptionInit; from: string }) => void;
  'webrtc:answer': (data: { answer: RTCSessionDescriptionInit; from: string }) => void;
  'webrtc:ice-candidate': (data: { candidate: RTCIceCandidate; from: string }) => void;
  'webrtc:peer-left': () => void;
  
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
  'chat:edit': (data: EditMessageData) => void;
  'chat:delete': (data: DeleteMessageData, callback?: (result: DeleteMessageResult) => void) => void;
  'chat:typing': (data: { isTyping: boolean }) => void;
  'chat:request-history': (data: { sessionId: string }) => void;
  
  // Session events
  'session:join': (data: { sessionId: string }) => void;
  'session:leave': () => void;
  'classroom:video-state': (data: { sessionId: string; enabled: boolean }) => void;
  'classroom:request-activity-history': (data: { sessionId: string }) => void;
  
  // WebRTC signaling events
  'webrtc:offer': (data: { offer: RTCSessionDescriptionInit; to: string }) => void;
  'webrtc:answer': (data: { answer: RTCSessionDescriptionInit; to: string }) => void;
  'webrtc:ice-candidate': (data: { candidate: RTCIceCandidate; to: string }) => void;
  
  // Ticket events
  'ticket:subscribe': () => void;
  'ticket:unsubscribe': () => void;
  
  // Notification events
  'notification:subscribe': () => void;
  'notification:get-all': (data?: { limit?: number; offset?: number }) => void;
  'notification:mark-read': (notificationId: string) => void;
  'notification:mark-all-read': () => void;
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
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
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

export interface EditMessageData {
  sessionId: string;
  messageId: string;
  text: string;
}

export interface DeleteMessageData {
  sessionId: string;
  messageId: string;
}

export interface DeleteMessageResult {
  success: boolean;
  message?: string;
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

export interface ClassroomActivityLogData {
  id: string;
  sessionId: string;
  userId: string;
  userType: 'tutor' | 'student';
  eventType: 'entered' | 'left' | 'lesson_ended';
  message: string;
  createdAt: string;
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
