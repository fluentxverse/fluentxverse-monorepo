import type { Socket } from 'socket.io-client';
import { API_BASE_URL, getAuthToken } from '../../config/api';

const PRODUCTION_DOMAINS = [
  'fluentxverse.xyz',
  'tutor.fluentxverse.xyz',
  'student.fluentxverse.xyz',
  'dashboard.fluentxverse.xyz'
];

const normalizeSocketUrl = (url: string) => url.trim().replace(/\/+$/, '');

const toWebSocketUrl = (url: string) => {
  const normalized = normalizeSocketUrl(url);
  if (normalized.startsWith('wss://') || normalized.startsWith('ws://')) {
    return normalized;
  }
  return normalized.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
};

const getSocketUrl = () => {
  const envSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
  if (envSocketUrl) return toWebSocketUrl(envSocketUrl);

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isProduction = PRODUCTION_DOMAINS.some(domain => hostname.endsWith(domain));
    if (isProduction) return 'wss://ws.fluentxverse.xyz';
    if (isLocalhost) return 'ws://localhost:8765';
    return toWebSocketUrl(`${protocol}//${hostname}:8765`);
  }

  return 'ws://localhost:8765';
};

const SOCKET_URL = getSocketUrl();

type Listener = (...args: any[]) => void;
type AuthConfig = { token?: string };

class NativeRealtimeSocket {
  auth: AuthConfig = {};
  connected = false;
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private callbacks = new Map<string, Listener>();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private manualClose = false;

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener?: Listener) {
    if (!listener) {
      this.listeners.delete(event);
      return this;
    }
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, data?: any, callback?: Listener) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return this;
    const ackId = callback ? `${Date.now()}-${Math.random().toString(16).slice(2)}` : undefined;
    if (ackId && callback) this.callbacks.set(ackId, callback);
    this.ws.send(JSON.stringify({ event, data: data || {}, ackId }));
    return this;
  }

  async connect() {
    if (this.connected || this.ws?.readyState === WebSocket.CONNECTING) return this;
    this.manualClose = false;
    const token = await this.resolveToken();
    const url = new URL('/ws', SOCKET_URL.endsWith('/') ? SOCKET_URL : `${SOCKET_URL}/`);
    if (token) url.searchParams.set('token', token);
    this.ws = new WebSocket(url.toString());
    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.dispatch('connect');
    };
    this.ws.onclose = event => {
      this.connected = false;
      this.dispatch('disconnect', event.reason || 'transport close');
      if (!this.manualClose) this.scheduleReconnect();
    };
    this.ws.onerror = () => this.dispatch('connect_error', new Error('WebSocket connection error'));
    this.ws.onmessage = event => this.handleMessage(event.data);
    return this;
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    return this;
  }

  removeAllListeners() {
    this.listeners.clear();
    this.callbacks.clear();
    return this;
  }

  private async resolveToken() {
    if (this.auth?.token) return this.auth.token;
    const token = await fetchSocketAuthToken();
    if (token) return token;
    return resolveAuthToken();
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= 10) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 5000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => void this.connect(), delay);
  }

  private handleMessage(raw: string) {
    try {
      const envelope = JSON.parse(raw);
      if (envelope.event === 'ack' && envelope.ackId) {
        const callback = this.callbacks.get(envelope.ackId);
        this.callbacks.delete(envelope.ackId);
        callback?.(envelope.data);
        return;
      }
      this.dispatch(envelope.event, normalizeIncomingData(envelope.event, envelope.data));
    } catch (error) {
      this.dispatch('connect_error', error);
    }
  }

  private dispatch(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(listener => listener(...args));
  }
}

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
  if (socket) {
    (socket as any).auth = token ? { token } : { ...(socket as any).auth };
    return socket;
  }
  const native = new NativeRealtimeSocket();
  native.auth = token ? { token: resolveAuthToken(token) } : {};
  socket = native as unknown as Socket;
  return socket;
};

export const connectSocket = () => {
  const socket = getSocket() as any;
  if (!socket.connected) void socket.connect();
};

export const disconnectSocket = () => {
  if (socket) (socket as any).disconnect();
};

export const destroySocket = () => {
  if (socket) {
    (socket as any).disconnect();
    (socket as any).removeAllListeners();
    socket = null;
  }
};

const normalizeIncomingData = (event: string, data: any) => {
  if (event === 'chat:history') return data?.messages || data?.items || data || [];
  if (event === 'classroom:activity-history') return data?.history || data?.items || data || [];
  return data;
};
