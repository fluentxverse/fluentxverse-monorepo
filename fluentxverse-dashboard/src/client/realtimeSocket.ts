import { io, type Socket } from 'socket.io-client';

const PRODUCTION_DOMAINS = [
  'fluentxverse.xyz',
  'student.fluentxverse.xyz',
  'tutor.fluentxverse.xyz',
  'dashboard.fluentxverse.xyz'
];

type Listener = (...args: any[]) => void;

export interface RealtimeSocket {
  connected: boolean;
  on(event: string, listener: Listener): RealtimeSocket;
  off(event: string, listener?: Listener): RealtimeSocket;
  emit(event: string, data?: any, callback?: Listener): RealtimeSocket;
  connect(): Promise<RealtimeSocket>;
  disconnect(): RealtimeSocket;
}

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

const getApiBaseUrl = () => {
  const envApiUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envApiUrl) return envApiUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) return 'https://api.fluentxverse.xyz';
  }
  return 'http://localhost:8765';
};

const fetchAdminSocketToken = async () => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/admin/socket-token`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store' }
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data?.success && data?.token ? data.token as string : undefined;
  } catch {
    return undefined;
  }
};

class SocketIoRealtimeSocket implements RealtimeSocket {
  private socket: Socket;

  constructor() {
    this.socket = io(getSocketUrl(), {
      withCredentials: true,
      autoConnect: false,
      auth: async callback => {
        const token = await fetchAdminSocketToken();
        callback(token ? { token } : {});
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling']
    });
  }

  get connected() {
    return this.socket.connected;
  }

  on(event: string, listener: Listener) {
    this.socket.on(event, listener);
    return this;
  }

  off(event: string, listener?: Listener) {
    if (listener) this.socket.off(event, listener);
    else this.socket.off(event);
    return this;
  }

  emit(event: string, data?: any, callback?: Listener) {
    if (callback) this.socket.emit(event, data, callback);
    else this.socket.emit(event, data);
    return this;
  }

  async connect() {
    if (!this.socket.connected) this.socket.connect();
    return this;
  }

  disconnect() {
    this.socket.disconnect();
    return this;
  }
}

export const createRealtimeSocket = (): RealtimeSocket => new SocketIoRealtimeSocket();
