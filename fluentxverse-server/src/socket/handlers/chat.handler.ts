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
  editedAt?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
}
const memChatMessages: Record<string, InMemoryMessage[]> = {};

const toClientMessage = (message: Awaited<ReturnType<ChatService['saveMessage']>>): InMemoryMessage => ({
  id: message.id,
  sessionId: message.session_id,
  senderId: message.sender_id,
  senderType: message.sender_type,
  text: message.display_text || message.edited_message_text || message.message_text,
  timestamp: message.created_at.toISOString(),
  correction: message.correction_text || undefined,
  editedAt: message.edited_at?.toISOString(),
  isEdited: Boolean(message.edited_at),
  isDeleted: Boolean(message.is_deleted)
});

export const chatHandler = (io: TypedServer, socket: TypedSocket) => {
  const loadSessionHistory = async (sessionId: string): Promise<InMemoryMessage[]> => {
    try {
      const messages = await chatService.getSessionMessages(sessionId);
      return messages.map(toClientMessage);
    } catch (dbError) {
      console.warn('⚠️ Using in-memory chat history due to DB error');
      return (memChatMessages[sessionId] || []).filter(message => !message.isDeleted);
    }
  };

  const emitSessionHistory = async (sessionId: string) => {
    const historyMessages = await loadSessionHistory(sessionId);

    io.to(sessionId).emit('chat:history', historyMessages);
    io.sockets.sockets.forEach((clientSocket) => {
      if (clientSocket.data.sessionId === sessionId) {
        clientSocket.emit('chat:history', historyMessages);
      }
    });
  };

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
          ...toClientMessage(message),
          fileUrl,
          fileName,
          fileType,
          fileSize
        };
      } catch (dbError) {
        // Fallback: use in-memory storage
        console.warn('⚠️ Using in-memory chat storage due to DB error');
        messageData = {
          id: `mem-${crypto.randomUUID()}`,
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

  socket.on('chat:edit', async (data) => {
    try {
      const { sessionId, messageId, text } = data;
      const nextText = text.trim();

      if (!nextText) {
        socket.emit('chat:error', { message: 'Message text is required' });
        return;
      }

      const userId = socket.data.userId;
      const userType = socket.data.userType;
      let updatedMessage: InMemoryMessage | null = null;

      try {
        const message = await chatService.editMessage(messageId, sessionId, userId, userType, nextText);
        if (message) {
          updatedMessage = toClientMessage(message);
        }
      } catch (dbError) {
        console.warn('⚠️ Editing in-memory chat message due to DB error');
        const sessionMessages = memChatMessages[sessionId] || [];
        const message = sessionMessages.find(item =>
          item.id === messageId &&
          item.senderId === userId &&
          item.senderType === userType &&
          !item.isDeleted
        );

        if (message) {
          message.text = nextText;
          message.editedAt = new Date().toISOString();
          message.isEdited = true;
          updatedMessage = message;
        }
      }

      if (!updatedMessage) {
        socket.emit('chat:error', { message: 'Unable to edit message' });
        return;
      }

      socket.emit('chat:message-updated', updatedMessage);
      socket.to(sessionId).emit('chat:message-updated', updatedMessage);
    } catch (error) {
      console.error('Error handling chat:edit:', error);
      socket.emit('chat:error', { message: 'Failed to edit message' });
    }
  });

  socket.on('chat:delete', async (data, callback) => {
    try {
      const { sessionId, messageId } = data;
      const userId = socket.data.userId;
      const userType = socket.data.userType;
      let deleted = false;

      if (!sessionId || !messageId) {
        callback?.({ success: false, message: 'Missing message data' });
        socket.emit('chat:error', { message: 'Missing message data' });
        return;
      }

      if (socket.data.sessionId && socket.data.sessionId !== sessionId) {
        callback?.({ success: false, message: 'You are not in this classroom session' });
        socket.emit('chat:error', { message: 'You are not in this classroom session' });
        return;
      }

      try {
        deleted = await chatService.softDeleteMessage(messageId, sessionId, userId, userType);
      } catch (dbError) {
        console.warn('⚠️ Deleting in-memory chat message due to DB error');
        const sessionMessages = memChatMessages[sessionId] || [];
        const message = sessionMessages.find(item =>
          item.id === messageId &&
          item.senderId === userId &&
          item.senderType === userType &&
          !item.isDeleted
        );

        if (message) {
          message.isDeleted = true;
          deleted = true;
        }
      }

      if (!deleted) {
        callback?.({ success: false, message: 'Unable to delete message' });
        socket.emit('chat:error', { message: 'Unable to delete message' });
        return;
      }

      const payload = { sessionId, messageId };
      const deletedMessageUpdate: InMemoryMessage = {
        id: messageId,
        sessionId,
        senderId: userId,
        senderType: userType,
        text: '',
        timestamp: new Date().toISOString(),
        isDeleted: true
      };

      io.to(sessionId).emit('chat:message', deletedMessageUpdate);
      io.to(sessionId).emit('chat:message-updated', deletedMessageUpdate);
      io.to(sessionId).emit('chat:message-deleted', payload);

      // Some classroom clients can have session state before room membership settles.
      // Directly notify sockets scoped to this session so receivers update immediately.
      io.sockets.sockets.forEach((clientSocket) => {
        if (clientSocket.data.sessionId === sessionId) {
          clientSocket.emit('chat:message', deletedMessageUpdate);
          clientSocket.emit('chat:message-updated', deletedMessageUpdate);
          clientSocket.emit('chat:message-deleted', payload);
        }
      });

      await emitSessionHistory(sessionId);
      callback?.({ success: true });
    } catch (error) {
      console.error('Error handling chat:delete:', error);
      callback?.({ success: false, message: 'Failed to delete message' });
      socket.emit('chat:error', { message: 'Failed to delete message' });
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
      const historyMessages = await loadSessionHistory(sessionId);

      // Send history to requesting client
      socket.emit('chat:history', historyMessages);

    } catch (error) {
      console.error('Error handling chat:request-history:', error);
      socket.emit('chat:history', []);
    }
  });
};
