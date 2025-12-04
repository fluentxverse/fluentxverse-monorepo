  // Only allow tutors to log in to tutor app

import { createContext } from 'preact';
import { useContext, useState, useEffect, useRef } from 'preact/hooks';
import { loginUser, logoutUser, getMe } from '../api/auth.api';
import { PROTECTED_PATHS } from '../config/protectedPaths';
import { registerUnauthorizedHandler, setLoginInProgress, forceAuthCleanup } from '../api/utils';

interface AuthUser {
  userId: string;
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  birthDate?: string;
  mobileNumber?: string;
  smartWalletAddress?: string;
  tier?: number;
  walletAddress?: string;
  role?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  initialLoading: boolean; // initial /me check
  loginLoading: boolean; // active login attempt
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getUserId: () => string | undefined; // Helper to get userId consistently
}
const allowedRole = 'tutor';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  // Ref to track login in progress - survives re-renders and is synchronously readable
  const loginInProgressRef = useRef(false);
  // Ref to track if initial auth check has been done
  const initialCheckDoneRef = useRef(false);

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = async () => {
      console.log('[AUTH] checkAuth called, loginInProgressRef:', loginInProgressRef.current, 'initialCheckDoneRef:', initialCheckDoneRef.current);
      
      // Skip if login is in progress or initial check already done
      if (loginInProgressRef.current || initialCheckDoneRef.current) {
        console.log('[AUTH] Skipping checkAuth - already in progress or done');
        setInitialLoading(false);
        return;
      }
      
      initialCheckDoneRef.current = true;
      
      // Check if we have any indication of a previous session
      // If not, skip the /me call entirely (it will fail anyway)
      const hasLocalSession = localStorage.getItem('fxv_user_id');
      if (!hasLocalSession) {
        console.log('[AUTH] No local session indicator, skipping /me call');
        setInitialLoading(false);
        return;
      }
      
      try {
        console.log('[AUTH] Calling getMe()...');
        const me = await getMe();
        console.log('[AUTH] getMe() returned:', me);
        // Double-check login hasn't started while we were awaiting
        if (loginInProgressRef.current) {
          console.log('[AUTH] Login started during getMe, aborting');
          return;
        }
        if (me?.user) {
          console.log('[AUTH] Setting user from /me:', me.user);
          setUser(me.user as AuthUser);
        }
      } catch (err) {
        console.log('[AUTH] getMe() failed:', err);
        // Not authenticated or session expired
        // Only clear if login isn't in progress
        if (!loginInProgressRef.current) {
          setUser(null);
        }
        // Clear stale local session indicator
        localStorage.removeItem('fxv_user_id');
        localStorage.removeItem('fxv_user_fullname');
      } finally {
        setInitialLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Redirect away from protected routes if session expired
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialLoading) return;
    // CRITICAL: Don't redirect if login is in progress (check both state and ref)
    if (user || loginLoading || loginInProgressRef.current) return;
    const path = window.location.pathname;
    if (PROTECTED_PATHS.some(p => path.startsWith(p))) {
      window.location.href = '/';
    }
  }, [initialLoading, user, loginLoading]);

  // Register 401 handler for axios interceptor
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      // Prevent clearing user during active login request (check both state and ref)
      if (loginLoading || loginInProgressRef.current) return;
      setUser(null);
      if (typeof window !== 'undefined') {
        const current = window.location.pathname;
        // Avoid redirect loop when already on landing/login page
        const isOnLanding = current === '/' || current === '/home';
        if (!isOnLanding && PROTECTED_PATHS.some(p => current.startsWith(p))) {
          window.location.href = '/';
        }
      }
    });
  }, [loginLoading]);

  const login = async (email: string, password: string) => {
    console.log('[AUTH] login() called with email:', email);
    
    // CRITICAL: Set ref FIRST (synchronous) before any async operation
    // This prevents race conditions with other effects checking this flag
    loginInProgressRef.current = true;
    
    // Set both local state and global flag to prevent 401 handler interference
    setLoginLoading(true);
    setLoginInProgress(true);
    
    // Clear any stale client-side auth state before attempting login
    forceAuthCleanup();
    
    try {
      console.log('[AUTH] Calling loginUser()...');
      const data = await loginUser(email, password);

      console.log("[AUTH] loginUser returned:", data);

      // Check if login was cancelled/superseded
      if (!loginInProgressRef.current) {
        console.log('[AUTH] Login was cancelled, returning');
        return;
      }

      if (data?.user) {
        // /login returns full user data from RegisteredParams
        const loggedInUser = data.user as AuthUser;
        console.log('[AUTH] User data received:', loggedInUser);
        
        if (loggedInUser.role && loggedInUser.role !== allowedRole) {
          setUser(null);
          throw new Error('You are not allowed to log in to the tutor app.');
        }
        console.log('[AUTH] Setting user state...');
        setUser(loggedInUser);
        console.log('[AUTH] User state set successfully');
        
        // Persist name for cases where /me returns minimal fields
        const first = loggedInUser.firstName || '';
        const last = loggedInUser.lastName || '';
        if (first || last) {
          localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
        }
        if (loggedInUser.userId) {
          localStorage.setItem('fxv_user_id', loggedInUser.userId);
        }
        // No page reload needed - user state is already set
        // Client-side navigation will preserve this state
      } else {
        throw new Error('Login failed - no user data returned');
      }
    } catch (err: any) {
      console.log('[AUTH] Login error:', err);
      // Clear any partial state on error
      setUser(null);
      throw new Error(err?.message || 'Login failed');
    } finally {
      console.log('[AUTH] Login finally block');
      setLoginLoading(false);
      // Delay clearing the flags slightly to cover any in-flight requests
      setTimeout(() => {
        setLoginInProgress(false);
        loginInProgressRef.current = false;
        console.log('[AUTH] Flags cleared');
      }, 300);
    }
  };

  // Helper to get user ID
  const getUserId = () => {
    return user?.userId;
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      // Clear any cached auth data
      try {
        localStorage.removeItem('fxv_user_fullname');
        localStorage.removeItem('fxv_user_id');
      } catch (e) {}
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, initialLoading, loginLoading, login, logout, getUserId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
