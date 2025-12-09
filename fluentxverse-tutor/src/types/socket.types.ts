// Frontend Socket event types (mirror of backend types)

import type { Notification } from './notification.types';

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
  'webrtc:offer': (data: { offer: RTCSessionDescriptionInit; from: string }) => void;
  'webrtc:answer': (data: { answer: RTCSessionDescriptionInit; from: string }) => void;
  'webrtc:ice-candidate': (data: { candidate: RTCIceCandidate; from: string }) => void;
  'webrtc:peer-left': () => void;
  
  // Notification events
  'notification:new': (notification: Notification) => void;
  'notification:list': (data: { notifications: Notification[]; unreadCount: number }) => void;
  'notification:read': (data: { notificationId: string; unreadCount: number }) => void;
  'notification:read-all': (data: { unreadCount: number }) => void;
  'notification:delete': (data: { notificationId: string; unreadCount: number }) => void;
  
  // Interview events
  'interview:admin-joined': () => void;
  'interview:tutor-joined': () => void;
  'interview:offer': (data: { offer: RTCSessionDescriptionInit }) => void;
  'interview:answer': (data: { answer: RTCSessionDescriptionInit }) => void;
  'interview:ice-candidate': (data: { candidate: RTCIceCandidateInit }) => void;
  'interview:ended': () => void;
  'interview:tutor-left': () => void;
  'interview:admin-left': () => void;
  
  // Schedule events
  'schedule:slot-booked': (data: { tutorId: string; slotKey: string; studentId: string; studentName?: string; date: string; time: string }) => void;
  'schedule:slot-cancelled': (data: { tutorId: string; slotKey: string; date: string; time: string }) => void;
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
  'webrtc:offer': (data: { offer: RTCSessionDescriptionInit; to: string }) => void;
  'webrtc:answer': (data: { answer: RTCSessionDescriptionInit; to: string }) => void;
  'webrtc:ice-candidate': (data: { candidate: RTCIceCandidate; to: string }) => void;
  
  // Notification events
  'notification:subscribe': () => void;
  'notification:get-all': (data?: { limit?: number; offset?: number }) => void;
  'notification:mark-read': (notificationId: string) => void;
  'notification:mark-all-read': () => void;
  
  // Interview events
  'interview:join': (data: { roomId: string; odIuser?: string; role: 'tutor' | 'admin' }) => void;
  'interview:offer': (data: { roomId: string; offer: RTCSessionDescriptionInit }) => void;
  'interview:answer': (data: { roomId: string; answer: RTCSessionDescriptionInit }) => void;
  'interview:ice-candidate': (data: { roomId: string; candidate: RTCIceCandidateInit }) => void;
  'interview:end': (data: { roomId: string }) => void;
  
  // Schedule events
  'schedule:subscribe': (data: { tutorId: string }) => void;
  'schedule:unsubscribe': () => void;
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
