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
  profilePicture?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  initialLoading: boolean; // initial /me check
  loginLoading: boolean; // active login attempt
  sessionExpired: boolean;
  sessionExpiredMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getUserId: () => string | undefined; // Helper to get userId consistently
  setUserFromRegistration: (userData: AuthUser) => void; // Set user after successful registration
  clearSessionExpired: () => void;
}
const allowedRole = 'tutor';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  // Ref to track login in progress - survives re-renders and is synchronously readable
  const loginInProgressRef = useRef(false);
  // Ref to track if initial auth check has been done
  const initialCheckDoneRef = useRef(false);

  // Clear session expired state
  const clearSessionExpired = () => {
    setSessionExpired(false);
    setSessionExpiredMessage(null);
  };

  useEffect(() => {
    const checkAuth = async () => {
      if (loginInProgressRef.current || initialCheckDoneRef.current) {
        setInitialLoading(false);
        return;
      }
      
      initialCheckDoneRef.current = true;
      
      const hasLocalSession = localStorage.getItem('fxv_user_id');
      if (!hasLocalSession) {
        setInitialLoading(false);
        return;
      }
      
      try {
        const me = await getMe();
        if (loginInProgressRef.current) return;
        if (me?.user) {
          setUser(me.user as AuthUser);
        }
      } catch (err) {
        if (!loginInProgressRef.current) {
          setUser(null);
        }
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
      // Show session expired modal instead of immediate redirect
      setSessionExpired(true);
      setSessionExpiredMessage('Your session has expired. Please log in again to continue.');
    });
  }, [loginLoading]);

  const login = async (email: string, password: string) => {
    loginInProgressRef.current = true;
    setLoginLoading(true);
    setLoginInProgress(true);
    forceAuthCleanup();
    
    try {
      const data = await loginUser(email, password);

      if (!loginInProgressRef.current) return;

      if (data?.user) {
        const loggedInUser = data.user as AuthUser;
        
        if (loggedInUser.role && loggedInUser.role !== allowedRole) {
          setUser(null);
          throw new Error('You are not allowed to log in to the tutor app.');
        }
        setUser(loggedInUser);
        
        // Persist name for cases where /me returns minimal fields
        const first = loggedInUser.firstName || '';
        const last = loggedInUser.lastName || '';
        if (first || last) {
          localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
        }
        if (loggedInUser.userId) {
          localStorage.setItem('fxv_user_id', loggedInUser.userId);
        }
      } else {
        throw new Error('Login failed - no user data returned');
      }
    } catch (err: any) {
      setUser(null);
      throw new Error(err?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
      setTimeout(() => {
        setLoginInProgress(false);
        loginInProgressRef.current = false;
      }, 300);
    }
  };

  // Helper to get user ID
  const getUserId = () => {
    return user?.userId;
  };

  // Set user directly after successful registration (cookie already set by server)
  const setUserFromRegistration = (userData: AuthUser) => {
    setUser(userData);
    // Persist to localStorage for session persistence
    const first = userData.firstName || '';
    const last = userData.lastName || '';
    if (first || last) {
      localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
    }
    if (userData.userId) {
      localStorage.setItem('fxv_user_id', userData.userId);
    }
  };

  const logout = async () => {
    // IMPORTANT: Clear local state FIRST to prevent race conditions
    // This ensures checkAuth won't find a session and auto-login won't trigger
    setUser(null);
    
    // Clear localStorage BEFORE calling server - prevents checkAuth from running
    try {
      localStorage.removeItem('fxv_user_fullname');
      localStorage.removeItem('fxv_user_id');
    } catch (e) {}
    
    // Mark that we're intentionally logging out (prevents 401 handler from interfering)
    loginInProgressRef.current = true;
    
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
      // Continue with logout even if server call fails
    } finally {
      loginInProgressRef.current = false;
      // Force a full page reload to clear all state and prevent any race conditions
      if (typeof window !== 'undefined') {
        // Use replace to prevent back button from going to authenticated page
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
      logout, 
      getUserId, 
      setUserFromRegistration,
      clearSessionExpired
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
