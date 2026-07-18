import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../../config/api';

const PRODUCTION_DOMAINS = [
  'fluentxverse.xyz',
  'tutor.fluentxverse.xyz',
  'student.fluentxverse.xyz',
  'dashboard.fluentxverse.xyz'
];

const normalizeSocketUrl = (url: string) => url.trim().replace(/\/+$/, '');

const toHttpUrl = (url: string) => {
  const normalized = normalizeSocketUrl(url);
  return normalized.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
};

const getSocketUrl = () => {
  const envSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
  if (envSocketUrl) return toHttpUrl(envSocketUrl);

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isProduction = PRODUCTION_DOMAINS.some(domain => hostname.endsWith(domain));
    if (isProduction) return 'https://ws.fluentxverse.xyz';
    if (isLocalhost) return 'http://localhost:8767';
    return `${protocol}//${hostname}:8767`;
  }

  return 'http://localhost:8767';
};

export const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;
let socketConnectWarningShown = false;
let socketTokenWarningShown = false;

export const getSocket = (): Socket => {
  if (!socket) throw new Error('Socket not initialized. Call initSocket() first.');
  return socket;
};

const isJwtLikeToken = (token?: string) => Boolean(token && token.split('.').length === 3);

const fetchTutorSocketToken = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/socket-token`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    });
    if (!response.ok) throw new Error(`Socket token request failed with ${response.status}`);
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
  if (isJwtLikeToken(token)) return token;
  const authCookie = document.cookie.split('; ').find(row => row.startsWith('tutorAuth='))?.split('=')[1];
  return isJwtLikeToken(authCookie) ? decodeURIComponent(authCookie) : undefined;
};

export const initSocket = (token?: string): Socket => {
  const immediateToken = resolveAuthToken(token);

  if (socket) {
    socket.auth = immediateToken ? { token: immediateToken } : socket.auth;
    return socket;
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    auth: async callback => {
      const socketToken = immediateToken || await fetchTutorSocketToken();
      callback(socketToken ? { token: socketToken } : {});
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    socketConnectWarningShown = false;
    socketTokenWarningShown = false;
  });

  socket.on('connect_error', error => {
    if (!socketConnectWarningShown) {
      console.warn('Socket connection unavailable; realtime updates are temporarily disabled.', {
        message: error?.message
      });
      socketConnectWarningShown = true;
    }
  });

  return socket;
};

export const connectSocket = () => {
  const socket = getSocket();
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = () => {
  if (socket) socket.disconnect();
};

export const destroySocket = () => {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
};
