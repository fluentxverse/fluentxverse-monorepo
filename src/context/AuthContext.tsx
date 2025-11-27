import { createContext } from 'preact';
import { useContext, useState, useEffect } from 'preact/hooks';
import { loginUser, logoutUser, getMe } from '../api/auth.api';

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
}

interface AuthContextValue {
  user: AuthUser | null;
  
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await loginUser(email, password);

      if (data?.user) {
        // /login returns full user data from RegisteredParams
        const loggedInUser = data.user as AuthUser;
        console.log('Logged in user:', loggedInUser);
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

        // Immediately refresh from /me to pull cookie-derived fields (walletAddress)
        try {
          const me = await getMe();
          if (me?.user) {
            setUser(prev => ({ ...prev, ...me.user }));
          }
        } catch (e) {
          console.warn('Post-login /me refresh failed:', e);
        }
      } else {
        throw new Error('Login failed');
      }
    } catch (err: any) {
      throw new Error(err?.message || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
