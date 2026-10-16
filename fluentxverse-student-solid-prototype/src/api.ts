import type { Api, AuthResult, Student } from './types';

export function createApi(base: string, fetcher: typeof fetch = fetch): Api {
  const request = async <T>(path: string, body?: object, token?: string): Promise<T> => {
    const response = await fetcher(`${base.replace(/\/$/, '')}${path}`, {
      method: body ? 'POST' : 'GET', credentials: 'include', cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }).catch(() => {
      throw new Error('Unable to reach the student API. Check its URL and approved student-origin policy.');
    });
    const data = await response.json();
    if (!response.ok || data.success === false) throw Object.assign(new Error(data.error || data.message || `API request failed (${response.status}).`), { status: response.status });
    return data as T;
  };
  return {
    me: async () => (await request<{ user: Student }>('/student/me')).user,
    refresh: async () => { await request('/student/refresh', {}); },
    password: async (email, password) => { await request('/student/login', { email, password }); },
    exchange: token => request<AuthResult>('/student/auth/privy', {}, token),
    logout: async () => { await request('/student/logout', {}); },
    nonce: walletAddress => request('/student/auth/wallet/nonce', { walletAddress }),
    wallet: (walletAddress, signature, message) => request('/student/auth/wallet', { walletAddress, signature, message }),
  };
}
