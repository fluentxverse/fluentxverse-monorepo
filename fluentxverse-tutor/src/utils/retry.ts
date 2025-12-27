/**
 * Retry Logic with Exponential Backoff
 * Utility for retrying failed API calls with increasing delays
 */

export interface RetryOptions {
  maxRetries?: number;           // Maximum number of retry attempts (default: 3)
  baseDelay?: number;            // Initial delay in ms (default: 1000)
  maxDelay?: number;             // Maximum delay in ms (default: 30000)
  backoffFactor?: number;        // Multiplier for each retry (default: 2)
  retryCondition?: (error: any) => boolean; // When to retry (default: network/5xx errors)
  onRetry?: (attempt: number, delay: number, error: any) => void; // Callback on each retry
  jitter?: boolean;              // Add random jitter to delays (default: true)
}

// Default retry condition: retry on network errors or 5xx server errors
const defaultRetryCondition = (error: any): boolean => {
  // Network error (no response)
  if (!error.response && error.message) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('timeout') || message.includes('failed to fetch')) {
      return true;
    }
  }
  
  // Server errors (5xx)
  if (error.response?.status >= 500) {
    return true;
  }
  
  // Rate limiting (429)
  if (error.response?.status === 429) {
    return true;
  }
  
  // Specific error codes that should retry
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }
  
  return false;
};

// Calculate delay with exponential backoff and optional jitter
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitter: boolean
): number {
  // Exponential backoff: baseDelay * factor^attempt
  let delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
  
  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);
  
  // Add jitter (±25% random variance)
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    delay = Math.floor(delay * jitterFactor);
  }
  
  return delay;
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryCondition = defaultRetryCondition,
    onRetry,
    jitter = true,
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we've exhausted retries
      if (attempt > maxRetries) {
        break;
      }
      
      // Check if error is retryable
      if (!retryCondition(error)) {
        throw error;
      }
      
      // Calculate delay
      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffFactor, jitter);
      
      // Call retry callback
      if (onRetry) {
        onRetry(attempt, delay, error);
      }
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // Throw the last error
  throw lastError;
}

/**
 * Create a retryable version of a function
 */
export function createRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => withRetry(() => fn(...args), options)) as T;
}

/**
 * Hook for retry with state management
 */
import { useState, useCallback } from 'preact/hooks';

export interface UseRetryOptions<T> extends RetryOptions {
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

export interface UseRetryResult<T, Args extends any[]> {
  execute: (...args: Args) => Promise<T | undefined>;
  data: T | undefined;
  error: any;
  isLoading: boolean;
  attempt: number;
  reset: () => void;
}

export function useRetry<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  options: UseRetryOptions<T> = {}
): UseRetryResult<T, Args> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const { onSuccess, onError, ...retryOptions } = options;

  const execute = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      setIsLoading(true);
      setError(null);
      setAttempt(0);

      try {
        const result = await withRetry(
          () => fn(...args),
          {
            ...retryOptions,
            onRetry: (attemptNum, delay, err) => {
              setAttempt(attemptNum);
              retryOptions.onRetry?.(attemptNum, delay, err);
            },
          }
        );
        
        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err) {
        setError(err);
        onError?.(err);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [fn, retryOptions, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsLoading(false);
    setAttempt(0);
  }, []);

  return {
    execute,
    data,
    error,
    isLoading,
    attempt,
    reset,
  };
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Specific retry configurations for common use cases
 */
export const RetryConfigs = {
  // Quick retry for simple operations
  quick: {
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 2000,
  } as RetryOptions,
  
  // Standard retry for API calls
  standard: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  } as RetryOptions,
  
  // Aggressive retry for critical operations
  aggressive: {
    maxRetries: 5,
    baseDelay: 500,
    maxDelay: 30000,
  } as RetryOptions,
  
  // Gentle retry for rate-limited endpoints
  rateLimited: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffFactor: 3,
  } as RetryOptions,
  
  // Upload retry configuration
  upload: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 20000,
    retryCondition: (error: any) => {
      // Retry on network errors or specific upload errors
      if (!error.response) return true;
      if (error.response.status >= 500) return true;
      if (error.response.status === 429) return true;
      return false;
    },
  } as RetryOptions,
};

export default withRetry;
