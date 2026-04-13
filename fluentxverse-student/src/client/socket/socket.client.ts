import { io, Socket } from 'socket.io-client';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents 
} from '../../types/socket.types';

// Known production domains
const PRODUCTION_DOMAINS = [
  'fluentxverse.xyz',
  'tutor.fluentxverse.xyz',
  'student.fluentxverse.xyz',
  'dashboard.fluentxverse.xyz'
];
const PRODUCTION_SOCKET_URL = 'https://ws.fluentxverse.xyz';

const normalizeSocketUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:');

// Dynamic socket URL - handles both dev and production
const getSocketUrl = () => {
  // 1. Explicit env var takes priority
  const envSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
  if (envSocketUrl) {
    return normalizeSocketUrl(envSocketUrl);
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
    return normalizeSocketUrl(`${protocol}//${hostname}:8767`);
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

const resolveAuthToken = (token?: string) => {
  if (token) {
    return token;
  }

  const authCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('studentAuth=') || row.startsWith('auth='))
    ?.split('=')[1];

  if (authCookie) {
    return decodeURIComponent(authCookie);
  }

  return JSON.stringify({
    userId: `student-${Date.now()}`,
    email: 'student@dev.local',
    tier: 1
  });
};

export const initSocket = (token?: string): Socket<ServerToClientEvents, ClientToServerEvents> => {
  const authToken = resolveAuthToken(token);

  if (socket) {
    socket.auth = { ...(socket.auth || {}), token: authToken };
    return socket;
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    auth: {
      token: authToken
    },
    transports: ['websocket', 'polling'],
    rememberUpgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    timeout: 10000
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
