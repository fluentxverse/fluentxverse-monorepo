// API Configuration
// IMPORTANT: Never default to an http:// API when the page is served over https://
// (browsers will block it as Mixed Content).
const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

// Known production domains - if we detect these, use the production API
const PRODUCTION_DOMAINS = ['fluentxverse.xyz', 'student.fluentxverse.xyz'];
const PRODUCTION_API_URL = 'https://api.fluentxverse.xyz';

export const isProductionHost = (hostname: string) => PRODUCTION_DOMAINS.includes(hostname);

const getApiBaseUrl = () => {
  // A local build can be served through the production tunnel; its baked-in
  // localhost URL must never become the public site's API destination.
  if (typeof window !== 'undefined' && isProductionHost(window.location.hostname)) {
    return PRODUCTION_API_URL;
  }

  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) {
    return normalizeBaseUrl(envUrl);
  }

  // Runtime detection for local and preview hosts.
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    
    // Local dev: backend runs on 8765 over http.
    if (isLocalhost) {
      return 'http://localhost:8765';
    }

    // Unknown environment: match the current protocol to avoid mixed content
    // This handles LAN access (e.g., 192.168.x.x) during development
    const fallbackUrl = `${protocol}//${hostname}:8765`;
    return fallbackUrl;
  }

  // SSR/Node.js environment fallback
  return 'http://localhost:8765';
};

export const API_BASE_URL = getApiBaseUrl();

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  ENDPOINTS: {
    TUTORS: '/api/tutors',
    SESSIONS: '/api/sessions',
  },
  TIMEOUT: 10000, // 10 seconds
};

// Helper function to get auth token
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
};

// Helper function to get API headers
export const getApiHeaders = (includeAuth = true): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

// Helper function to handle API responses
export const handleApiResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
    
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If it's not JSON, use the text as error message
      if (errorText) {
        errorMessage = errorText;
      }
    }

    if (response.status === 401) {
      errorMessage = 'Unauthorized. Please log in again.';
    }

    throw new Error(errorMessage);
  }

  const data: T = await response.json();
  return data;
};
