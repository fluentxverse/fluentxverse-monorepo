import { AxiosError } from 'axios';

/**
 * User-friendly error messages for common HTTP status codes
 */
const ERROR_MESSAGES: Record<number, string> = {
  400: 'The request was invalid. Please check your input and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You don\'t have permission to perform this action.',
  404: 'The requested resource was not found.',
  408: 'The request timed out. Please try again.',
  409: 'There was a conflict with your request. Please refresh and try again.',
  422: 'The provided data is invalid. Please check your input.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Please try again later.',
  502: 'Server is temporarily unavailable. Please try again later.',
  503: 'Service is temporarily unavailable. Please try again later.',
  504: 'The server took too long to respond. Please try again.',
};

/**
 * User-friendly error messages for common error scenarios
 */
const NETWORK_ERROR_MESSAGE = 'Unable to connect. Please check your internet connection.';
const TIMEOUT_ERROR_MESSAGE = 'The request timed out. Please try again.';
const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Extract a user-friendly error message from an Axios error
 */
export function getErrorMessage(error: unknown): string {
  // Handle Axios errors
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    
    // Network error (no response)
    if (!axiosError.response) {
      if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        return TIMEOUT_ERROR_MESSAGE;
      }
      return NETWORK_ERROR_MESSAGE;
    }
    
    const status = axiosError.response.status;
    const data = axiosError.response.data;
    
    // Try to get server-provided error message
    if (data?.error && typeof data.error === 'string') {
      // Make server error messages more user-friendly
      return humanizeErrorMessage(data.error);
    }
    if (data?.message && typeof data.message === 'string') {
      return humanizeErrorMessage(data.message);
    }
    
    // Fall back to status code message
    return ERROR_MESSAGES[status] || DEFAULT_ERROR_MESSAGE;
  }
  
  // Handle regular Error objects
  if (error instanceof Error) {
    return humanizeErrorMessage(error.message);
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return humanizeErrorMessage(error);
  }
  
  return DEFAULT_ERROR_MESSAGE;
}

/**
 * Make technical error messages more user-friendly
 */
function humanizeErrorMessage(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Common technical errors -> friendly messages
  const mappings: [RegExp | string, string][] = [
    [/network error/i, NETWORK_ERROR_MESSAGE],
    [/timeout/i, TIMEOUT_ERROR_MESSAGE],
    [/unauthorized/i, 'Your session has expired. Please log in again.'],
    [/forbidden/i, 'You don\'t have permission to perform this action.'],
    [/not found/i, 'The requested item was not found.'],
    [/internal server error/i, 'Something went wrong on our end. Please try again later.'],
    [/bad gateway/i, 'Server is temporarily unavailable. Please try again later.'],
    [/service unavailable/i, 'Service is temporarily unavailable. Please try again later.'],
    [/invalid (token|session)/i, 'Your session has expired. Please log in again.'],
    [/already exists/i, 'This item already exists. Please try a different one.'],
    [/duplicate/i, 'This item already exists. Please try a different one.'],
    [/invalid email/i, 'Please enter a valid email address.'],
    [/invalid password/i, 'Please enter a valid password.'],
    [/password.*short/i, 'Password is too short. Please use at least 8 characters.'],
    [/email.*taken|email.*exists/i, 'This email is already registered. Try logging in instead.'],
    [/user.*not found/i, 'No account found with these credentials.'],
    [/incorrect.*password|wrong.*password|invalid.*credentials/i, 'Incorrect email or password. Please try again.'],
    [/session.*expired|token.*expired/i, 'Your session has expired. Please log in again.'],
    [/rate.*limit/i, 'Too many attempts. Please wait a moment and try again.'],
    [/file.*too.*large/i, 'The file is too large. Please choose a smaller file.'],
    [/invalid.*file.*type/i, 'Invalid file type. Please choose a different file.'],
    [/booking.*conflict|slot.*taken|already.*booked/i, 'This time slot is no longer available. Please choose another.'],
    [/insufficient.*balance|not.*enough.*credits/i, 'Insufficient balance. Please add credits to continue.'],
    [/cancelled/i, 'This booking has been cancelled.'],
  ];
  
  for (const [pattern, friendlyMessage] of mappings) {
    if (typeof pattern === 'string' ? lowerMessage.includes(pattern) : pattern.test(message)) {
      return friendlyMessage;
    }
  }
  
  // If the message is reasonably short and doesn't look too technical, use it as-is
  if (message.length < 100 && !/[{}\[\]<>]|error:|exception/i.test(message)) {
    // Capitalize first letter
    return message.charAt(0).toUpperCase() + message.slice(1);
  }
  
  return DEFAULT_ERROR_MESSAGE;
}

/**
 * Get error details for logging (preserves original error info)
 */
export function getErrorDetails(error: unknown): {
  message: string;
  status?: number;
  code?: string;
  originalError?: string;
} {
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    return {
      message: getErrorMessage(error),
      status: axiosError.response?.status,
      code: axiosError.code,
      originalError: axiosError.response?.data?.error || axiosError.message,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: getErrorMessage(error),
      originalError: error.message,
    };
  }
  
  return {
    message: getErrorMessage(error),
    originalError: String(error),
  };
}

export default { getErrorMessage, getErrorDetails };
