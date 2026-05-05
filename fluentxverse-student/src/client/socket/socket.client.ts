import { io, Socket } from 'socket.io-client';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents 
} from '../../types/socket.types';
import { API_BASE_URL, getAuthToken } from '../../config/api';

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

  const storedToken = getAuthToken();
  if (storedToken) {
    return storedToken;
  }

  const authCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('studentAuth=') || row.startsWith('auth='))
    ?.split('=')[1];

  if (authCookie) {
    return decodeURIComponent(authCookie);
  }

  return undefined;
};

export const fetchSocketAuthToken = async (): Promise<string | undefined> => {
  const response = await fetch(`${API_BASE_URL}/student/socket-token`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-store'
    }
  });

  if (!response.ok) {
    return undefined;
  }

  const data = await response.json();
  return data?.success && data?.token ? data.token : undefined;
};

export const initSocket = (token?: string): Socket<ServerToClientEvents, ClientToServerEvents> => {
  const authToken = resolveAuthToken(token);

  if (socket) {
    socket.auth = authToken ? { ...(socket.auth || {}), token: authToken } : { ...(socket.auth || {}) };
    return socket;
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    auth: authToken ? { token: authToken } : {},
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
