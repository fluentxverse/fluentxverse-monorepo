import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
// Only allow tutors to log in to tutor app
import { createContext } from "solid-js";
import { loginUser, logoutUser, getMe, refreshSession } from '../api/auth.api';
import { PROTECTED_PATHS } from '../config/protectedPaths';
import { registerUnauthorizedHandler, setLoginInProgress, forceAuthCleanup } from '../api/utils';
import { destroySocket } from '../client/socket/socket.client';
const LOGOUT_EVENT_KEY = 'fxv_tutor_logout';
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
    logoutLoading: boolean;
    logoutError: string | null;
    sessionExpired: boolean;
    sessionExpiredMessage: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    getUserId: () => string | undefined; // Helper to get userId consistently
    setUserFromRegistration: (userData: AuthUser) => void; // Set user after successful registration
    clearSessionExpired: () => void;
    renewSession: () => Promise<void>;
}
const allowedRole = 'tutor';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export const AuthProvider = (_props0: {
    children: any;
}) => {
    const [user, setUser] = createSignal<AuthUser | null>(null);
    const [initialLoading, setInitialLoading] = createSignal(true);
    const [loginLoading, setLoginLoading] = createSignal(false);
    const [logoutLoading, setLogoutLoading] = createSignal(false);
    const [logoutError, setLogoutError] = createSignal<string | null>(null);
    const [sessionExpired, setSessionExpired] = createSignal(false);
    const [sessionExpiredMessage, setSessionExpiredMessage] = createSignal<string | null>(null);
    // Ref to track login in progress - survives re-renders and is synchronously readable
    const loginInProgressRef = { current: false } as {
        current: any;
    };
    // Ref to track if initial auth check has been done
    const initialCheckDoneRef = { current: false } as {
        current: any;
    };
    const authGenerationRef = { current: 0 } as {
        current: any;
    };
    const logoutInProgressRef = { current: false } as {
        current: any;
    };
    const unauthorizedCheckInProgressRef = { current: false } as {
        current: any;
    };
    const userRef = { current: user() } as {
        current: any;
    };
    const renewalRef = { current: null } as {
        current: (Promise<void> | null) | null;
    };
    createEffect(() => userRef.current = user());
    // Clear session expired state
    const clearSessionExpired = () => {
        setSessionExpired(false);
        setSessionExpiredMessage(null);
    };
    const renewSession = (): Promise<void> => {
        if (logoutInProgressRef.current || !userRef.current)
            return Promise.reject(new Error('Session is not active'));
        if (renewalRef.current)
            return renewalRef.current;
        const pending = refreshSession().then(result => {
            if (result?.success !== true)
                throw new Error('Session renewal was not confirmed');
        });
        renewalRef.current = pending;
        void pending.finally(() => {
            if (renewalRef.current === pending)
                renewalRef.current = null;
        }).catch(() => { });
        return pending;
    };
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            const checkAuth = async () => {
                if (loginInProgressRef.current || initialCheckDoneRef.current) {
                    setInitialLoading(false);
                    return;
                }
                initialCheckDoneRef.current = true;
                const generation = authGenerationRef.current;
                try {
                    const me = await getMe();
                    if (generation !== authGenerationRef.current)
                        return;
                    // /tutor/me validates the tutor cookie server-side; legacy responses omit role.
                    if (me?.user?.userId && (me.user.role === undefined || me.user.role === allowedRole)) {
                        const restoredUser = { ...me.user, role: allowedRole } as AuthUser;
                        setUser(restoredUser);
                        clearSessionExpired();
                        try {
                            if (restoredUser.userId)
                                localStorage.setItem('fxv_user_id', restoredUser.userId);
                        }
                        catch {
                            // The server cookie, not browser storage, owns the session.
                        }
                    }
                }
                catch (err) {
                    if (generation !== authGenerationRef.current)
                        return;
                    setUser(null);
                    forceAuthCleanup();
                }
                finally {
                    setInitialLoading(false);
                }
            };
            checkAuth();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            const onStorage = (event: StorageEvent) => {
                if (event.key !== LOGOUT_EVENT_KEY || !event.newValue)
                    return;
                authGenerationRef.current += 1;
                logoutInProgressRef.current = true;
                setLogoutLoading(true);
                setLoginInProgress(true);
                setUser(null);
                forceAuthCleanup();
                clearSessionExpired();
                destroySocket();
                window.location.replace('/');
            };
            window.addEventListener('storage', onStorage);
            return () => window.removeEventListener('storage', onStorage);
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    // Redirect away from protected routes if session expired
    createEffect(on(() => [initialLoading(), user(), loginLoading(), sessionExpired()], () => {
        const _cleanup3 = untrack(() => {
            if (typeof window === 'undefined')
                return;
            if (initialLoading())
                return;
            if (sessionExpired())
                return;
            // CRITICAL: Don't redirect if login is in progress (check both state and ref)
            if (user() || loginLoading() || loginInProgressRef.current || logoutInProgressRef.current)
                return;
            const path = window.location.pathname;
            if (PROTECTED_PATHS.some(p => path.startsWith(p))) {
                window.location.href = '/';
            }
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    // Register 401 handler for axios interceptor
    createEffect(on(() => [loginLoading()], () => {
        const _cleanup4 = untrack(() => {
            return registerUnauthorizedHandler(async () => {
                // Prevent clearing user during active login request (check both state and ref)
                if (!userRef.current || loginInProgressRef.current || logoutInProgressRef.current)
                    return;
                if (unauthorizedCheckInProgressRef.current)
                    return;
                unauthorizedCheckInProgressRef.current = true;
                const generation = authGenerationRef.current;
                try {
                    // A denied feature request does not necessarily mean the login expired.
                    await getMe();
                }
                catch (error: any) {
                    if (generation !== authGenerationRef.current || error?.response?.status !== 401)
                        return;
                    forceAuthCleanup();
                    destroySocket();
                    setUser(null);
                    setSessionExpired(true);
                    setSessionExpiredMessage('Your session has expired. Please log in again to continue.');
                }
                finally {
                    unauthorizedCheckInProgressRef.current = false;
                }
            });
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const login = async (email: string, password: string) => {
        if (logoutInProgressRef.current)
            return;
        setLogoutError(null);
        authGenerationRef.current += 1;
        loginInProgressRef.current = true;
        setLoginLoading(true);
        setLoginInProgress(true);
        forceAuthCleanup();
        try {
            const data = await loginUser(email, password);
            if (!loginInProgressRef.current)
                return;
            // Check for server-provided error message first
            if (data?.success === false || data?.error) {
                throw new Error(data.error || 'Invalid email or password. Please try again.');
            }
            if (data?.user) {
                const loggedInUser = data.user as AuthUser;
                if (loggedInUser.role && loggedInUser.role !== allowedRole) {
                    setUser(null);
                    throw new Error('You are not allowed to log in to the tutor app.');
                }
                setUser(loggedInUser);
                clearSessionExpired();
                // Persist name for cases where /me returns minimal fields
                const first = loggedInUser.firstName || '';
                const last = loggedInUser.lastName || '';
                if (first || last) {
                    localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
                }
                if (loggedInUser.userId) {
                    localStorage.setItem('fxv_user_id', loggedInUser.userId);
                }
            }
            else {
                throw new Error('Unable to sign in. Please check your credentials and try again.');
            }
        }
        catch (err: any) {
            setUser(null);
            // Extract user-friendly error message from Axios error response
            let errorMessage = 'Login failed. Please try again.';
            // Check for server-provided error message in response data
            if (err?.response?.data?.error) {
                errorMessage = err.response.data.error;
            }
            else if (err?.response?.data?.message) {
                errorMessage = err.response.data.message;
            }
            else if (err?.message && !err.message.includes('status code')) {
                // Use error.message only if it's not the generic Axios message
                errorMessage = err.message;
            }
            throw new Error(errorMessage);
        }
        finally {
            setLoginLoading(false);
            setLoginInProgress(false);
            loginInProgressRef.current = false;
        }
    };
    // Helper to get user ID
    const getUserId = () => {
        return user()?.userId;
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
        if (loginInProgressRef.current || logoutInProgressRef.current)
            return;
        authGenerationRef.current += 1;
        logoutInProgressRef.current = true;
        setLogoutError(null);
        setLogoutLoading(true);
        setLoginInProgress(true);
        let completed = false;
        try {
            // Finish cookie renewal before deleting the session cookie.
            await renewalRef.current?.catch(() => { });
            await logoutUser();
            completed = true;
            setUser(null);
            forceAuthCleanup();
            clearSessionExpired();
            destroySocket();
            try {
                localStorage.setItem(LOGOUT_EVENT_KEY, `${Date.now()}:${Math.random()}`);
            }
            catch {
                // Cookies still end the session when browser storage is unavailable.
            }
            if (typeof window !== 'undefined') {
                window.location.replace('/');
            }
        }
        catch (err) {
            console.error('Logout error:', err);
            setLogoutError('Unable to sign out. Please try again.');
        }
        finally {
            if (!completed) {
                setLoginInProgress(false);
                logoutInProgressRef.current = false;
                setLogoutLoading(false);
            }
        }
    };
    return (<AuthContext.Provider value={{
            get user() {
                return user();
            },
            get isAuthenticated() {
                return !!user();
            },
            get initialLoading() {
                return initialLoading();
            },
            get loginLoading() {
                return loginLoading();
            },
            get logoutLoading() {
                return logoutLoading();
            },
            get logoutError() {
                return logoutError();
            },
            get sessionExpired() {
                return sessionExpired();
            },
            get sessionExpiredMessage() {
                return sessionExpiredMessage();
            },
            login,
            logout,
            getUserId,
            setUserFromRegistration,
            clearSessionExpired,
            renewSession
        }}>
      {_props0["children"]}
    </AuthContext.Provider>);
};
export const useAuthContext = () => {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuthContext must be used within AuthProvider');
    return ctx;
};
