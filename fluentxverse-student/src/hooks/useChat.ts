import { useEffect, useState, useCallback } from 'preact/hooks';
import { getSocket } from '../client/socket/socket.client';
import type { ChatMessageData } from '../types/socket.types';

export const useChat = (sessionId: string) => {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    // Request chat history when component mounts
    socket.emit('chat:request-history', { sessionId });

    // Listen for chat history
    const handleHistory = (history: ChatMessageData[]) => {
      setMessages(history);
    };

    // Listen for new messages
    const handleMessage = (message: ChatMessageData) => {
      setMessages(prev => [...prev, message]);
    };

    // Listen for typing indicators
    const handleTyping = (data: { userId: string; isTyping: boolean }) => {
      setIsTyping(data.isTyping);
      setTypingUserId(data.isTyping ? data.userId : null);
    };

    socket.on('chat:history', handleHistory);
    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);

    return () => {
      socket.off('chat:history', handleHistory);
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
    };
  }, [sessionId]);

  const sendMessage = useCallback((text: string, correction?: string) => {
    const socket = getSocket();
    socket.emit('chat:send', {
      sessionId,
      text,
      correction
    });
  }, [sessionId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = getSocket();
    socket.emit('chat:typing', { isTyping });
  }, []);

  return {
    messages,
    isTyping,
    typingUserId,
    sendMessage,
    sendTyping
  };
};
