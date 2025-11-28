// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8765';

export const API_CONFIG = {
  BASE_URL: 'https://consumer.decentragri.com',
  ENDPOINTS: {
    FARM_LIST: '/api/farm/list',
    FARM_SCANS: '/api/farm/scans',
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
