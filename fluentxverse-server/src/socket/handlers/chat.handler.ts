import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types/socket.types';
import { ChatService } from '../../services/chat.services/chat.service';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const chatService = new ChatService();

// In-memory fallback for chat messages when DB is unavailable
interface InMemoryMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: 'tutor' | 'student';
  text: string;
  timestamp: string;
  correction?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'file';
  fileSize?: number;
}
const memChatMessages: Record<string, InMemoryMessage[]> = {};

export const chatHandler = (io: TypedServer, socket: TypedSocket) => {
  // Send chat message
  socket.on('chat:send', async (data) => {
    try {
      const { sessionId, text, correction, fileUrl, fileName, fileType, fileSize } = data;
      const userId = socket.data.userId;
      const userType = socket.data.userType;

      let messageData: InMemoryMessage;

      try {
        // Try to save message to database
        const message = await chatService.saveMessage({
          sessionId,
          senderId: userId,
          senderType: userType,
          text,
          correction
        });

        messageData = {
          id: message.id,
          sessionId: message.session_id,
          senderId: message.sender_id,
          senderType: message.sender_type,
          text: message.message_text,
          timestamp: message.created_at.toISOString(),
          correction: message.correction_text || undefined,
          fileUrl,
          fileName,
          fileType,
          fileSize
        };
      } catch (dbError) {
        // Fallback: use in-memory storage
        console.warn('⚠️ Using in-memory chat storage due to DB error');
        messageData = {
          id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sessionId,
          senderId: userId,
          senderType: userType,
          text,
          timestamp: new Date().toISOString(),
          correction,
          fileUrl,
          fileName,
          fileType,
          fileSize
        };
        
        // Store in memory
        if (!memChatMessages[sessionId]) {
          memChatMessages[sessionId] = [];
        }
        memChatMessages[sessionId].push(messageData);
      }

      // Broadcast message to all users in the session
      io.to(sessionId).emit('chat:message', messageData);

    } catch (error) {
      console.error('Error handling chat:send:', error);
      socket.emit('chat:message', {
        id: 'error',
        sessionId: data.sessionId,
        senderId: 'system',
        senderType: 'tutor',
        text: 'Failed to send message',
        timestamp: new Date().toISOString(),
        isSystemMessage: true
      });
    }
  });

  // Typing indicator
  socket.on('chat:typing', async (data) => {
    try {
      const { isTyping } = data;
      const userId = socket.data.userId;
      const sessionId = socket.data.sessionId;

      if (sessionId) {
        // Broadcast typing status to other users in the session
        socket.to(sessionId).emit('chat:typing', {
          userId,
          isTyping
        });
      }
    } catch (error) {
      console.error('Error handling chat:typing:', error);
    }
  });

  // Request chat history
  socket.on('chat:request-history', async (data) => {
    try {
      const { sessionId } = data;
      
      let historyMessages: InMemoryMessage[] = [];

      try {
        // Try to fetch message history from database
        const messages = await chatService.getSessionMessages(sessionId);
        historyMessages = messages.map(msg => ({
          id: msg.id,
          sessionId: msg.session_id,
          senderId: msg.sender_id,
          senderType: msg.sender_type,
          text: msg.message_text,
          timestamp: msg.created_at.toISOString(),
          correction: msg.correction_text || undefined
        }));
      } catch (dbError) {
        // Fallback: use in-memory storage
        console.warn('⚠️ Using in-memory chat history due to DB error');
        historyMessages = memChatMessages[sessionId] || [];
      }

      // Send history to requesting client
      socket.emit('chat:history', historyMessages);

      console.log(`📜 Chat history sent for session ${sessionId} (${historyMessages.length} messages)`);
    } catch (error) {
      console.error('Error handling chat:request-history:', error);
      socket.emit('chat:history', []);
    }
  });
};
