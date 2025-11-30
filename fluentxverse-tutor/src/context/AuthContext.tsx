  // Only allow tutors to log in to tutor app
  const allowedRole = 'tutor';
import { createContext } from 'preact';
import { useContext, useState, useEffect, useRef } from 'preact/hooks';
import { loginUser, logoutUser, getMe } from '../api/auth.api';
import { PROTECTED_PATHS } from '../config/protectedPaths';
import { registerUnauthorizedHandler, setLoginInProgress, forceAuthCleanup } from '../api/utils';

interface AuthUser {
  userId?: string; // from /me endpoint
  id?: string; // from /login endpoint
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = async () => {
      try {
        const me = await getMe();

        if (me?.user) {
          // /me returns { userId, email }
          setUser(me.user as AuthUser);
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
    // Set both local state and global flag to prevent 401 handler interference
    setLoginLoading(true);
    setLoginInProgress(true);
    
    // Clear any stale client-side auth state before attempting login
    forceAuthCleanup();
    
    try {
      console.log('Starting login request...');
      const data = await loginUser(email, password);
      console.log('Login response received:', data?.success);

      if (data?.user) {
        // /login returns full user data from RegisteredParams
        const loggedInUser = data.user as AuthUser;
        console.log('Logged in user:', loggedInUser);
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
        if (loggedInUser.id || loggedInUser.userId) {
          localStorage.setItem('fxv_user_id', (loggedInUser.id || loggedInUser.userId) as string);
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
              throw new Error('You are not allowed to log in to the tutor app.');
            }
            setUser(prev => ({ ...prev, ...me.user }));
          }
        } catch (e) {
          console.warn('Post-login /me refresh failed - continuing without extra fields:', e);
          // Don't throw - login was successful, just /me failed
        }
      } else {
        throw new Error('Login failed - no user data returned');
      }
    } catch (err: any) {
      // Clear any partial state on error
      setUser(null);
      throw new Error(err?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
      // Delay clearing the global flag slightly to cover any in-flight requests
      setTimeout(() => setLoginInProgress(false), 500);
    }
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
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, initialLoading, loginLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
