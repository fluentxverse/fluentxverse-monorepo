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
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  userType: 'tutor' | 'student';
  sessionId?: string;
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
}

export interface SendMessageData {
  sessionId: string;
  text: string;
  correction?: string;
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
