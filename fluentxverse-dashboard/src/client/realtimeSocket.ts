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

const toWebSocketUrl = (url: string) => {
  const normalized = normalizeSocketUrl(url);
  if (normalized.startsWith('wss://') || normalized.startsWith('ws://')) return normalized;
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

const getApiBaseUrl = () => (import.meta.env.VITE_API_URL || 'http://localhost:8765').replace(/\/+$/, '');

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

class NativeRealtimeSocket implements RealtimeSocket {
  connected = false;
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private callbacks = new Map<string, Listener>();
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
    const url = new URL('/ws', getSocketUrl().endsWith('/') ? getSocketUrl() : `${getSocketUrl()}/`);
    const token = await fetchAdminSocketToken();
    if (token) url.searchParams.set('token', token);
    this.ws = new WebSocket(url.toString());
    this.ws.onopen = () => {
      this.connected = true;
      this.dispatch('connect');
    };
    this.ws.onclose = event => {
      this.connected = false;
      this.dispatch('disconnect', event.reason || 'transport close');
    };
    this.ws.onerror = () => this.dispatch('connect_error', new Error('WebSocket connection error'));
    this.ws.onmessage = event => this.handleMessage(event.data);
    return this;
  }

  disconnect() {
    this.manualClose = true;
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    return this;
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
      this.dispatch(envelope.event, envelope.data);
    } catch (error) {
      this.dispatch('connect_error', error);
    }
  }

  private dispatch(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(listener => listener(...args));
  }
}

export const createRealtimeSocket = (): RealtimeSocket => new NativeRealtimeSocket();
