  // Only allow students to log in to student app
  const allowedRole = 'student';
import { createContext } from 'preact';
import { useContext, useState, useEffect, useRef } from 'preact/hooks';
import { loginUser, logoutUser, getMe, loginWithWallet, registerWithWallet, loginWithPrivy, registerWithPrivy, type PrivyProfile, type PrivyRegisterParams, type WalletRegisterParams } from '../api/auth.api';
import { PROTECTED_PATHS } from '../config/protectedPaths';
import { registerUnauthorizedHandler, setLoginInProgress, forceAuthCleanup } from '../api/utils';
import { appWallet } from '../config/wallet';
import { scheduleApi } from '../api/schedule.api';
import { usePrivyIntegration } from './PrivyContext';

interface AuthUser {
  userId: string;
  email: string;
  givenName: string;
  familyName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  mobileNumber?: string;
  smartWalletAddress?: string;
  tier?: number;
  walletAddress?: string;
  role?: string;
}

interface WalletLoginResult {
  status: 'authenticated' | 'incomplete_registration' | 'not_found' | 'error';
  user: AuthUser | null;
  missingFields?: string[];
}

interface WalletAuthParams {
  walletAddress: string;
  signature: string;
  message: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  initialLoading: boolean; // initial /me check
  loginLoading: boolean; // active login attempt
  sessionExpired: boolean;
  sessionExpiredMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginByWallet: (params: WalletAuthParams) => Promise<WalletLoginResult>;
  registerByWallet: (params: WalletRegisterParams) => Promise<void>;
  registerByPrivy: (params: PrivyRegisterParams) => Promise<void>;
  privyProfile: PrivyProfile | null;
  isPrivyAuthenticated: boolean;
  logout: () => Promise<void>;
  getUserId: () => string | undefined;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [privyProfile, setPrivyProfile] = useState<PrivyProfile | null>(null);
  const [socialAuthError, setSocialAuthError] = useState<string | null>(null);
  const privyAttemptRef = useRef<string | null>(null);
  const loggingOutRef = useRef(false);
  const exchangeRef = useRef<Promise<void> | null>(null);
  const {
    ready: privyReady,
    authenticated: isPrivyAuthenticated,
    userId: privyUserId,
    getAccessToken,
    logout: logoutPrivy,
  } = usePrivyIntegration();

  // Clear session expired state
  const clearSessionExpired = () => {
    setSessionExpired(false);
    setSessionExpiredMessage(null);
  };

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = async () => {
      try {
        const me = await getMe();

        if (me?.user && !loggingOutRef.current) {
          // /me returns { userId, email }
          const restoredUser = me.user as AuthUser;
          setUser(restoredUser);
          try {
            if (restoredUser.userId) localStorage.setItem('fxv_user_id', restoredUser.userId);
          } catch {
            // Browser storage is optional; the server session is authoritative.
          }
        }
      } catch (err) {
        // Not authenticated or session expired
        setUser(null);
      } finally {
        setInitialLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (loggingOutRef.current || sessionStorage.getItem('fxv_pending_logout') === 'true') return;
    if (!isPrivyAuthenticated) privyAttemptRef.current = null;
    if (initialLoading || !privyReady || !isPrivyAuthenticated || !privyUserId || user) return;
    if (privyAttemptRef.current === privyUserId) return;

    privyAttemptRef.current = privyUserId;
    setSocialAuthError(null);
    setLoginLoading(true);
    setLoginInProgress(true);

    const exchangePrivySession = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error('Privy session is unavailable');

        const response = await loginWithPrivy(accessToken);
        if (loggingOutRef.current) return;
        if (response.status === 'authenticated' && response.user) {
          const loggedInUser = response.user as AuthUser;
          setUser(loggedInUser);
          setPrivyProfile(null);
          sessionStorage.removeItem('fxv_privy_auth_error');
          sessionStorage.removeItem('fxv_pending_privy_profile');
          const fullName = `${loggedInUser.givenName || ''} ${loggedInUser.familyName || ''}`.trim();
          if (fullName) localStorage.setItem('fxv_user_fullname', fullName);
          if (loggedInUser.userId) localStorage.setItem('fxv_user_id', loggedInUser.userId);
          const authProvider = sessionStorage.getItem('fxv_pending_auth_provider');
          if (authProvider === 'twitter' || authProvider === 'google' || authProvider === 'apple') {
            localStorage.setItem('fxv_last_auth_provider', authProvider);
          }
          sessionStorage.removeItem('fxv_pending_auth_provider');

          if (sessionStorage.getItem('fxv_privy_login_pending') === 'true') {
            sessionStorage.removeItem('fxv_privy_login_pending');
            window.location.replace('/home');
          }
          return;
        }

        if (response.status === 'registration_required' && response.profile) {
          const profile = response.profile as PrivyProfile;
          setPrivyProfile(profile);
          sessionStorage.setItem('fxv_pending_privy_profile', JSON.stringify(profile));
          sessionStorage.removeItem('fxv_privy_login_pending');
          if (window.location.pathname !== '/register') {
            window.location.assign('/register?auth=privy');
          }
          return;
        }

        throw new Error(response.error || 'Unable to sign in with Privy');
      } catch (error: any) {
        console.error('Privy session exchange failed:', error);
        const message = error?.response?.status === 429
          ? error?.response?.data?.error || 'Too many sign-in attempts. Please try again later.'
          : 'Sign-in could not be completed. Please open Login and try again.';
        sessionStorage.setItem('fxv_privy_auth_error', message);
        setSocialAuthError(message);
        sessionStorage.removeItem('fxv_privy_login_pending');
        sessionStorage.removeItem('fxv_pending_auth_provider');
      } finally {
        setLoginLoading(false);
        setTimeout(() => setLoginInProgress(false), 500);
      }
    };

    exchangeRef.current = exchangePrivySession();
  }, [initialLoading, privyReady, isPrivyAuthenticated, privyUserId, user]);

  // Preload dashboard data when user is authenticated
  useEffect(() => {
    if (user && !initialLoading) {
      // Warm the cache for upcoming lesson data in the background
      // Don't await - let it run in background without blocking UI
      scheduleApi.preloadDashboardData()
        .catch((err) => console.warn('Failed to preload dashboard data:', err));
    }
  }, [user, initialLoading]);

  // Redirect away from protected routes if session expired
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialLoading) return;
    if (user || loginLoading) return; // avoid redirect mid-login attempt
    const path = window.location.pathname;
    if (PROTECTED_PATHS.some(p => path.startsWith(p))) {
      window.location.href = '/';
    }
  }, [initialLoading, user, loginLoading]);

  // Register 401 handler for axios interceptor
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      // Prevent clearing user during active login request
      if (loginLoading) return;
      setUser(null);
      // Show session expired modal instead of immediate redirect
      setSessionExpired(true);
      setSessionExpiredMessage('Your session has expired. Please log in again to continue.');
    });
  }, [loginLoading]);

  const login = async (email: string, password: string) => {
    // Set both local state and global flag to prevent 401 handler interference
    setLoginLoading(true);
    setLoginInProgress(true);
    
    // Clear any stale client-side auth state before attempting login
    forceAuthCleanup();
    
    try {
      const data = await loginUser(email, password);

      // Check for server-provided error message first
      if (data?.success === false || data?.error) {
        throw new Error(data.error || 'Invalid email or password. Please try again.');
      }

      if (data?.user) {
        // /login returns full user data from RegisteredParams
        const loggedInUser = data.user as AuthUser;
        if (loggedInUser.role && loggedInUser.role !== allowedRole) {
          setUser(null);
          throw new Error('You are not allowed to log in to the student app.');
        }
        setUser(loggedInUser);
        // Persist name for cases where /me returns minimal fields
        const first = loggedInUser.givenName || '';
        const last = loggedInUser.familyName || '';
        if (first || last) {
          localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
        }
        if (loggedInUser.userId) {
          localStorage.setItem('fxv_user_id', loggedInUser.userId);
        }

        // Small delay to ensure cookie is fully set before /me call
        await new Promise(resolve => setTimeout(resolve, 150));

        // Immediately refresh from /me to pull cookie-derived fields (walletAddress)
        // This is optional - don't let it break the login flow
        try {
          const me = await getMe();
          if (me?.user) {
            if (me.user.role && me.user.role !== allowedRole) {
              setUser(null);
              throw new Error('You are not allowed to log in to the student app.');
            }
            setUser(prev => ({ ...prev, ...me.user }));
          }
        } catch (e) {
          console.warn('Post-login /me refresh failed - continuing without extra fields:', e);
          // Don't throw - login was successful, just /me failed
        }
      } else {
        throw new Error('Unable to sign in. Please check your credentials and try again.');
      }
    } catch (err: any) {
      // Clear any partial state on error
      setUser(null);
      
      // Extract user-friendly error message from Axios error response
      let errorMessage = 'Login failed. Please try again.';
      
      // Check for server-provided error message in response data
      if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message && !err.message.includes('status code')) {
        // Use error.message only if it's not the generic Axios message
        errorMessage = err.message;
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoginLoading(false);
      // Delay clearing the global flag slightly to cover any in-flight requests
      setTimeout(() => setLoginInProgress(false), 500);
    }
  };

  // Helper to get user ID
  const getUserId = () => {
    return user?.userId;
  };

  /**
   * Login by wallet address with signature verification (SIWE)
   * Returns status to indicate if user needs registration or has incomplete profile
   */
  const loginByWallet = async ({ walletAddress, signature, message }: WalletAuthParams): Promise<WalletLoginResult> => {
    setLoginLoading(true);
    setLoginInProgress(true);
    forceAuthCleanup();

    try {
      const response = await loginWithWallet(walletAddress, signature, message);

      if (response.status === 'error') {
        throw new Error(response.message || 'Authentication failed');
      }

      if (response.status === 'not_found') {
        // User doesn't exist - needs registration
        return { status: 'not_found', user: null };
      }

      if (response.status === 'incomplete_registration') {
        // User exists but profile incomplete
        return {
          status: 'incomplete_registration',
          user: response.user as AuthUser,
          missingFields: response.missingFields
        };
      }

      // Full authentication
      if (response.user) {
        const loggedInUser = response.user as AuthUser;
        
        if (loggedInUser.role && loggedInUser.role !== allowedRole) {
          setUser(null);
          throw new Error('You are not allowed to log in to the student app.');
        }

        setUser(loggedInUser);
        
        // Persist name for cases where /me returns minimal fields
        const first = loggedInUser.givenName || '';
        const last = loggedInUser.familyName || '';
        if (first || last) {
          localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
        }
        if (loggedInUser.userId) {
          localStorage.setItem('fxv_user_id', loggedInUser.userId);
        }

        return { status: 'authenticated', user: loggedInUser };
      }

      throw new Error('Unable to sign in with wallet. Please try again.');
    } catch (err: any) {
      setUser(null);
      throw new Error(err?.message || 'Wallet login failed');
    } finally {
      setLoginLoading(false);
      setTimeout(() => setLoginInProgress(false), 500);
    }
  };

  /**
   * Register a new user with wallet address
   */
  const registerByWallet = async (params: WalletRegisterParams): Promise<void> => {
    setLoginLoading(true);
    setLoginInProgress(true);
    forceAuthCleanup();

    try {
      const response = await registerWithWallet(params);

      if (response.success && response.user) {
        const newUser = response.user as AuthUser;
        
        if (newUser.role && newUser.role !== allowedRole) {
          setUser(null);
          throw new Error('You are not allowed to log in to the student app.');
        }

        setUser(newUser);
        
        const first = newUser.givenName || '';
        const last = newUser.familyName || '';
        if (first || last) {
          localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
        }
        if (newUser.userId) {
          localStorage.setItem('fxv_user_id', newUser.userId);
        }
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (err: any) {
      setUser(null);
      throw new Error(err?.message || 'Wallet registration failed');
    } finally {
      setLoginLoading(false);
      setTimeout(() => setLoginInProgress(false), 500);
    }
  };

  const registerByPrivy = async (params: PrivyRegisterParams): Promise<void> => {
    setLoginLoading(true);
    setLoginInProgress(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Your social sign-in session expired. Please sign in again.');
      }

      const response = await registerWithPrivy(accessToken, params);
      if (!response.success || !response.user) {
        throw new Error(response.error || 'Registration failed');
      }
      setUser(response.user as AuthUser);
      setPrivyProfile(null);
      sessionStorage.removeItem('fxv_pending_privy_profile');
      const authProvider = sessionStorage.getItem('fxv_pending_auth_provider');
      if (authProvider === 'twitter' || authProvider === 'google' || authProvider === 'apple') {
        localStorage.setItem('fxv_last_auth_provider', authProvider);
      }
      sessionStorage.removeItem('fxv_pending_auth_provider');
    } catch (error: any) {
      throw new Error(error?.response?.data?.error || error?.message || 'Registration failed');
    } finally {
      setLoginLoading(false);
      setTimeout(() => setLoginInProgress(false), 500);
    }
  };

  const logout = async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoginLoading(true);
    // IMPORTANT: Clear local state FIRST to prevent race conditions
    // This ensures checkAuth won't find a session and auto-login won't trigger
    setUser(null);
    
    // Clear all cached auth data BEFORE calling server
    forceAuthCleanup();
    
    // Set a flag so the landing page knows we're attempting logout
    // If the cookie doesn't get cleared, the landing page will retry
    try {
      // Finish any request that can set the cookie before deleting that cookie.
      await exchangeRef.current;
      sessionStorage.removeItem('fxv_privy_login_pending');
      sessionStorage.removeItem('fxv_pending_auth_provider');
      sessionStorage.removeItem('fxv_pending_privy_profile');
      sessionStorage.setItem('fxv_pending_logout', 'true');
    } catch (e) {}
    
    // Mark that we're intentionally logging out
    setLoginInProgress(true);
    
    try {
      // Disconnect browser wallet state first to clear the local wallet session
      try {
        await appWallet.disconnect();
      } catch (walletErr) {
        console.warn('Failed to disconnect wallet:', walletErr);
      }

      try {
        await logoutPrivy();
      } catch (privyError) {
        console.warn('Failed to clear Privy session:', privyError);
      }
      
      // Call server to clear cookie
      await logoutUser();
      
      // CRITICAL: Wait for browser to process the Set-Cookie header before navigating.
      // Without this delay, navigation can occur before the cookie is actually deleted,
      // causing the user to be "logged back in" on the next page load.
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Clear the pending logout flag on success
      try {
        sessionStorage.removeItem('fxv_pending_logout');
      } catch (e) {}
    } catch (err) {
      console.error('Logout error:', err);
      // Continue with logout even if server call fails
      // Keep the pending flag so landing page can retry
    } finally {
      setLoginInProgress(false);
      // Force a full page reload to clear all state and prevent any race conditions
      // Use replace to prevent back button from going to authenticated page
      if (typeof window !== 'undefined') {
        window.location.replace('/');
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      initialLoading, 
      loginLoading, 
      sessionExpired,
      sessionExpiredMessage,
      login, 
      loginByWallet, 
      registerByWallet, 
      registerByPrivy,
      privyProfile,
      isPrivyAuthenticated,
      logout, 
      getUserId,
      clearSessionExpired
    }}>
      {children}
      {socialAuthError && <div role="alert" style={{ position: 'fixed', bottom: '16px', left: '16px', right: '16px', zIndex: 100001, padding: '16px', background: '#fff', color: '#b42318', border: '1px solid #b42318', borderRadius: '8px' }}>{socialAuthError}</div>}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
