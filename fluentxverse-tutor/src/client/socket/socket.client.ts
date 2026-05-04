import { io, Socket } from 'socket.io-client';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents 
} from '../../types/socket.types';
import { API_BASE_URL } from '../../config/api';

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

export const SOCKET_URL = getSocketUrl();

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let socketConnectWarningShown = false;
let socketTokenWarningShown = false;

export const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (!socket) {
    throw new Error('Socket not initialized. Call initSocket() first.');
  }
  return socket;
};

const isJwtLikeToken = (token?: string) => Boolean(token && token.split('.').length === 3);

const fetchTutorSocketToken = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/tutor/socket-token`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Socket token request failed with ${response.status}`);
    }

    const data = await response.json();
    return typeof data?.token === 'string' ? data.token : undefined;
  } catch (error) {
    if (!socketTokenWarningShown) {
      console.warn('Unable to fetch socket auth token; realtime connection may be unavailable.', error);
      socketTokenWarningShown = true;
    }

    return undefined;
  }
};

const resolveAuthToken = (token?: string) => {
  if (isJwtLikeToken(token)) {
    return token;
  }

  const authCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('tutorAuth='))
    ?.split('=')[1];

  if (isJwtLikeToken(authCookie)) {
    return decodeURIComponent(authCookie);
  }

  return undefined;
};

const createSocketAuth = (token?: string) => {
  const immediateToken = resolveAuthToken(token);
  if (immediateToken) {
    return { token: immediateToken };
  }

  return async (callback: (auth: { token?: string }) => void) => {
    const socketToken = await fetchTutorSocketToken();
    callback(socketToken ? { token: socketToken } : {});
  };
};

export const initSocket = (token?: string): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (socket) {
    socket.auth = createSocketAuth(token) as any;
    return socket;
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    auth: createSocketAuth(token) as any,
    transports: ['websocket', 'polling'],
    rememberUpgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    timeout: 10000
  });

  socket.on('connect', () => {
    socketConnectWarningShown = false;
    socketTokenWarningShown = false;
  });

  socket.on('disconnect', (reason) => {
  });

  socket.on('connect_error', (error) => {
    if (!socketConnectWarningShown) {
      console.warn('Socket connection unavailable; realtime updates are temporarily disabled.', {
        message: error.message,
        data: (error as any).data,
        description: (error as any).description,
        context: (error as any).context
      });
      socketConnectWarningShown = true;
    }
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
