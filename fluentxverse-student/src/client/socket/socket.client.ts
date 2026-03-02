import { io, Socket } from 'socket.io-client';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents 
} from '../../types/socket.types';

// Known production domains
const PRODUCTION_DOMAINS = ['fluentxverse.xyz', 'tutor.fluentxverse.xyz', 'student.fluentxverse.xyz'];
const PRODUCTION_SOCKET_URL = 'https://socket.fluentxverse.xyz';

// Dynamic socket URL - handles both dev and production
const getSocketUrl = () => {
  // 1. Explicit env var takes priority
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isProduction = PRODUCTION_DOMAINS.some(domain => hostname.endsWith(domain));
    
    // Production: use dedicated socket URL
    if (isProduction) {
      return PRODUCTION_SOCKET_URL;
    }
    
    // Local dev
    if (isLocalhost) {
      return 'http://localhost:8767';
    }
    
    // LAN access: use same protocol to avoid mixed content
    return `${protocol}//${hostname}:8767`;
  }
  
  return 'http://localhost:8767';
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

  // Get auth cookie for authentication - now a JWT token
  // The cookie is opaque (JWT), server will verify it via withCredentials
  const authCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth='))
    ?.split('=')[1];
  
  // Pass the raw JWT token (or decoded for dev fallback)
  // Server will verify the JWT token sent via cookies
  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    auth: {
      // Pass raw JWT token - server will verify it
      // For authenticated users, the cookie is sent via withCredentials
      // For dev fallback without cookie, create a placeholder
      token: authCookie ? decodeURIComponent(authCookie) : JSON.stringify({
        userId: `student-${Date.now()}`,
        email: 'student@dev.local',
        tier: 1 // tier 1 = student
      })
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
  });

  socket.on('disconnect', (reason) => {
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
  }
};

export const destroySocket = () => {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
};
