import axios from 'axios'

let unauthorizedHandler: (() => void) | null = null;
let isLoginInProgress = false;

export const registerUnauthorizedHandler = (fn: () => void) => {
  unauthorizedHandler = fn;
};

export const setLoginInProgress = (inProgress: boolean) => {
  isLoginInProgress = inProgress;
};

// Clear client-side auth state (localStorage only, don't call server)
// Server cookie will be overwritten on next successful login
export const forceAuthCleanup = () => {
  try {
    localStorage.removeItem('fxv_user_fullname');
    localStorage.removeItem('fxv_user_id');
  } catch (e) {}
};

// Configure Axios client to send cookies with requests
// Use direct URL like student app does (which works)
export const client = axios.create({
  baseURL: 'http://localhost:8765',
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  }
})

// Request interceptor to add cache-busting for auth requests
client.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching of auth-related requests
    if (config.url === '/tutor/me' || config.url === '/tutor/login' || config.url === '/tutor/logout' || config.url === '/tutor/refresh') {
      config.params = { ...config.params, _t: Date.now() };
      if (!config.headers) config.headers = {} as any;
      (config.headers as any)['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      (config.headers as any)['Pragma'] = 'no-cache';
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for 401 handling
let last401 = 0;
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Don't trigger unauthorized handler during login process
      // or for login/logout endpoints themselves
      const url = error?.config?.url || '';
      const isAuthEndpoint = url.includes('/login') || url.includes('/logout') || url.includes('/register');
      const now = Date.now();
      // Debounce 401 handling to avoid race conditions
      if (!isLoginInProgress && !isAuthEndpoint && unauthorizedHandler && (now - last401 > 500)) {
        last401 = now;
        // Clear client-side state
        forceAuthCleanup();
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

// Send logs from frontend to server terminal
export const logToServer = async (
  message: string,
  opts?: { tag?: string; level?: 'info'|'warn'|'error'; data?: any }
) => {
  try {
    await client.post('/debug/log', {
      tag: opts?.tag ?? 'tutor-app',
      level: opts?.level ?? 'info',
      message,
      data: opts?.data ?? null
    });
  } catch (e) {
    // Swallow errors to avoid breaking app flow
  }
};