import { io, type Socket } from 'socket.io-client';
import { productionEndpoints } from '../../config/productionDomains';
import { API_BASE_URL, getAuthToken, isProductionHost } from '../../config/api';

const normalizeSocketUrl = (url: string) => url.trim().replace(/\/+$/, '');

const toHttpUrl = (url: string) => {
  const normalized = normalizeSocketUrl(url);
  return normalized.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
};

const getSocketUrl = () => {
  if (typeof window !== 'undefined' && isProductionHost(window.location.hostname)) {
    return productionEndpoints(window.location.hostname)!.socketUrl;
  }

  const envSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
  if (envSocketUrl) return toHttpUrl(envSocketUrl);

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocalhost) return 'http://localhost:8767';
    return `${protocol}//${hostname}:8767`;
  }

  return 'http://localhost:8767';
};

const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) throw new Error('Socket not initialized. Call initSocket() first.');
  return socket;
};

const resolveAuthToken = (token?: string) => {
  if (token) return token;
  const storedToken = getAuthToken();
  if (storedToken) return storedToken;
  const authCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('studentAuth=') || row.startsWith('auth='))
    ?.split('=')[1];
  return authCookie ? decodeURIComponent(authCookie) : undefined;
};

export const fetchSocketAuthToken = async (): Promise<string | undefined> => {
  const response = await fetch(`${API_BASE_URL}/student/socket-token`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-store' }
  });
  if (!response.ok) return undefined;
  const data = await response.json();
  return data?.success && data?.token ? data.token : undefined;
};

export const initSocket = (token?: string): Socket => {
  const resolvedToken = resolveAuthToken(token);

  if (socket) {
    socket.auth = resolvedToken ? { token: resolvedToken } : socket.auth;
    return socket;
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    auth: async callback => {
      const socketToken = await fetchSocketAuthToken() || resolvedToken;
      callback(socketToken ? { token: socketToken } : {});
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    transports: ['websocket', 'polling']
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
