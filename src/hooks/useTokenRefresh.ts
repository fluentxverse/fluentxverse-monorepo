import { useEffect, useRef } from 'react';
import { setupTokenRefresh, clearTokenRefresh } from '../client/tokenRefresh';
import { useAuthStore } from '../context/AuthContext';

// Helper to check if the error is likely a network error
const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('network') || 
         message.includes('failed to fetch') ||
         message.includes('offline');
};

export function useTokenRefresh() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setupAttemptRef = useRef(0);
  const lastErrorRef = useRef<Error | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      console.debug('[useTokenRefresh] User is not logged in, clearing refresh timer');
      clearTokenRefresh();
      setupAttemptRef.current = 0;
      return;
    }

    let isMounted = true;
    let retryTimer: NodeJS.Timeout | null = null;
    
    const setupRefresh = async (attempt = 1) => {
      if (!isMounted) return;
      
      try {
        console.debug(`[useTokenRefresh] Setting up token refresh (attempt ${attempt})`);
        setupAttemptRef.current = attempt;
        
        await setupTokenRefresh();
        
        // Reset error state on successful setup
        if (lastErrorRef.current) {
          console.debug('[useTokenRefresh] Token refresh setup recovered from previous error');
          lastErrorRef.current = null;
        }
      } catch (error) {
        if (!isMounted) return;
        
        console.error('[useTokenRefresh] Error setting up token refresh:', error);
        
        // Only update error state if it's a new error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!lastErrorRef.current || lastErrorRef.current.message !== errorMessage) {
          lastErrorRef.current = error instanceof Error ? error : new Error(errorMessage);
        }
        
        // Don't log out for network errors or if we've already retried too many times
        if (isNetworkError(error) || attempt >= 3) {
          const retryIn = Math.min(30000, 5000 * attempt); // Exponential backoff with max 30s
          console.warn(`[useTokenRefresh] Will retry token refresh in ${retryIn}ms`);
          
          retryTimer = setTimeout(() => {
            if (isMounted) {
              setupRefresh(attempt + 1);
            }
          }, retryIn);
          return;
        }
        
        // For non-network errors, log out if we've retried too many times
        console.error('[useTokenRefresh] Max retries reached, logging out');
        useAuthStore.getState().logout();
      }
    };

    setupRefresh();

    // Clean up on unmount
    return () => {
      isMounted = false;
      // Don't clear the timer here as it's needed across route changes
      // The timer will be cleared when the user logs out or when the page is refreshed
    };
  }, [isLoggedIn]);

  return null;
}
