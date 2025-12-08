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
