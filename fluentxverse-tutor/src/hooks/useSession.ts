import { useEffect, useState, useCallback } from 'preact/hooks';
import { getSocket } from '../client/socket/socket.client';
import type { SessionState } from '../types/socket.types';

export const useSession = () => {
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handleUserJoined = (data: { userId: string; userType: string }) => {
      console.log('User joined:', data);
    };

    const handleUserLeft = (data: { userId: string; userType: string }) => {
      console.log('User left:', data);
    };

    const handleSessionState = (state: SessionState) => {
      setSessionState(state);
      setIsConnected(state.status === 'active');
    };

    socket.on('session:user-joined', handleUserJoined);
    socket.on('session:user-left', handleUserLeft);
    socket.on('session:state', handleSessionState);

    return () => {
      socket.off('session:user-joined', handleUserJoined);
      socket.off('session:user-left', handleUserLeft);
      socket.off('session:state', handleSessionState);
    };
  }, []);

  const joinSession = useCallback((sessionId: string) => {
    const socket = getSocket();
    socket.emit('session:join', { sessionId });
  }, []);

  const leaveSession = useCallback(() => {
    const socket = getSocket();
    socket.emit('session:leave');
  }, []);

  return {
    sessionState,
    isConnected,
    joinSession,
    leaveSession
  };
};
