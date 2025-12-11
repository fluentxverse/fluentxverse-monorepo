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
