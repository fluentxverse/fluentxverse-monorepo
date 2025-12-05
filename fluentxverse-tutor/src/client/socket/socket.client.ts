import { io, Socket } from 'socket.io-client';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents 
} from '../../types/socket.types';

// Dynamic socket URL for LAN access - uses current hostname
const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // Use same hostname as current page for LAN access
  const hostname = window.location.hostname;
  return `http://${hostname}:8767`;
};

const SOCKET_URL = getSocketUrl();

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (!socket) {
    throw new Error('Socket not initialized. Call initSocket() first.');
  }
  return socket;
};

export const initSocket = (token?: string): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (socket) {
    return socket;
  }

  // Get auth cookie for authentication
  const authCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth='))
    ?.split('=')[1];
  
  let authData = null;
  if (authCookie) {
    try {
      authData = JSON.parse(decodeURIComponent(authCookie));
    } catch (e) {
      console.warn('Failed to parse auth cookie');
    }
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    auth: {
      // Pass auth data or indicate this is a tutor app
      token: authData ? JSON.stringify(authData) : JSON.stringify({
        userId: `tutor-${Date.now()}`,
        email: 'tutor@dev.local',
        tier: 2 // tier 2+ = tutor
      })
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
};

export const connectSocket = () => {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    console.log('Socket manually disconnected');
  }
};

export const destroySocket = () => {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    console.log('Socket destroyed');
  }
};
