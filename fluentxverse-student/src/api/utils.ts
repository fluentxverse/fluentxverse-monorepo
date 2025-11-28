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
export const client = axios.create({
  baseURL: 'http://localhost:8765',
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  }
});

// Request interceptor to add cache-busting for auth requests
client.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching of auth-related requests
    if (config.url === '/me' || config.url === '/login' || config.url === '/logout' || config.url === '/refresh') {
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